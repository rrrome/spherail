import CoreBluetooth
import CryptoKit
import Foundation

/// A two-Mac BLE transport. Both Macs advertise and scan; the inviter becomes
/// the central for one session. All callbacks arrive on the main queue.
final class BluetoothMatchService: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
    static let serviceUUID = CBUUID(string: "149DF70A-6AC6-4A3D-8D9E-12D9A9658A10")
    static let dataUUID = CBUUID(string: "149DF70A-6AC6-4A3D-8D9E-12D9A9658A11")

    var onEvent: ((String, [String: Any]) -> Void)?
    var profile: (() -> [String: Any])?

    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private var discovered: [String: CBPeripheral] = [:]
    private var nearby: [String: [String: Any]] = [:]
    private var lastSeen: [String: Date] = [:]
    private var remotePeripheral: CBPeripheral?
    private var dataCharacteristic: CBCharacteristic?
    private var hostedCharacteristic: CBMutableCharacteristic?
    private var subscriber: CBCentral?
    private var mode = "idle"
    private var phase = "idle"
    private var sessionID = ""
    private var confirmationCode = ""
    private var peerProfile: [String: Any] = [:]
    private var peerSupportsCompact = false
    private var activeTransport = "none"
    private var lanTargetID: String?
    private var lanInviteSent = false
    private var lanConnectTimer: Timer?
    private var lanIncomingTimer: Timer?
    private var lanReconnectAttempts: Timer?
    private var lanBLEFallbackTimer: Timer?
    private var mayUseBLEBackup = false
    private var lanDiscoveryStarted = false
    private lazy var lan = LANTransport(profile: { [weak self] in self?.profile?() ?? [:] })
    private var selectedMap: [String: Any]?
    private var selectedDifficulty = "easy"
    private var localReady = false
    private var remoteReady = false
    private var localFinish: [String: Any]?
    private var remoteFinish: [String: Any]?
    private var peerLeft = false
    private var peerExitReason = "opponent_left"
    private var reconnectTimer: Timer?
    private var leaveTimer: Timer?
    private var invitationTimer: Timer?
    private var countdownTimer: Timer?
    private var metricsTimer: Timer?
    private var lastRemoteIdentifier: UUID?
    private var signalDBm: Int?
    private var latencyMs: Int?
    private struct LinkQuality {
        var rttMs: Int
        var measuredAt: Date
    }
    private var linkQuality: [String: [String: LinkQuality]] = [:]
    private var activePlayerKey: String?
    private var pingSentAt: Date?
    private var pingToken: UInt64?
    private var lastInboundAt: Date?

    private var nextMessageID: UInt32 = 1
    private var priorityFrames: [Data] = []
    private var stateFrames: [Data] = []
    private var pendingStateFrames: [Data] = []
    private var inFlightWrite = false
    private var inFlightFrame: Data?
    private var inFlightPriority = false
    private var writeRetries = 0
    private let reassembler = BLEReassembler()

    private func mapDigest(_ map: [String: Any]) -> String? {
        guard let bytes = try? JSONSerialization.data(withJSONObject: map, options: [.sortedKeys]) else { return nil }
        return SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    static func mapForMatch(_ map: [String: Any], difficulty: String) throws -> [String: Any] {
        guard let level = (map["difficulties"] as? [String: Any])?[difficulty] else {
            throw StoreError.invalid("Map difficulty is unavailable.")
        }
        var transfer = map
        transfer["difficulties"] = [difficulty: level]
        return transfer
    }

    func state() -> [String: Any] {
        let radioState: String
        if centralManager?.state == .poweredOn && peripheralManager?.state == .poweredOn {
            radioState = "ready"
        } else if centralManager?.state == .poweredOff || peripheralManager?.state == .poweredOff {
            radioState = "off"
        } else if centralManager?.state == .unauthorized || peripheralManager?.state == .unauthorized {
            radioState = "unauthorized"
        } else { radioState = "starting" }
        let presences = nearbyPresences()
        return [
            "mode": mode, "phase": phase, "session": sessionID,
            "bluetoothState": radioState,
            "wifiState": lan.isAvailable ? "ready" : "unavailable",
            "transport": activeTransport,
            "connected": isConnected, "code": confirmationCode,
            "peer": peerProfile, "map": selectedMap as Any? ?? NSNull(),
            "difficulty": selectedDifficulty,
            "localReady": localReady, "remoteReady": remoteReady,
            "signalDBm": signalDBm as Any? ?? NSNull(),
            "latencyMs": latencyMs as Any? ?? NSNull(),
            "peers": NearbyPeerDirectory.merged(presences),
        ]
    }

    private func nearbyPresences() -> [NearbyPeerPresence] {
        let blePresences = nearby.compactMap { id, value -> NearbyPeerPresence? in
            guard Date().timeIntervalSince(lastSeen[id] ?? .distantPast) < 15 else { return nil }
            return NearbyPeerPresence(transport: .bluetooth, endpointID: id,
                playerID: value["playerID"] as? String, name: value["name"] as? String ?? "Spherail player",
                deviceName: value["deviceName"] as? String ?? "Mac", avatar: nil, rssi: value["rssi"] as? Int)
        }
        let wifiPresences = lan.peers.map {
            NearbyPeerPresence(transport: .wifi, endpointID: $0.id, playerID: $0.id,
                name: $0.name, deviceName: $0.deviceName, avatar: $0.avatar, rssi: nil)
        }
        return NearbyPeerDirectory.resolved(blePresences + wifiPresences)
    }

    private func matchingBluetoothPeripheral(for wifiID: String) -> CBPeripheral? {
        let key = NearbyPeerPresence.shortID(wifiID)
        guard let presence = nearbyPresences().first(where: {
            $0.transport == .bluetooth && $0.playerID.map(NearbyPeerPresence.shortID) == key
        }) else { return nil }
        return discovered[presence.endpointID]
    }

    private var isConnected: Bool {
        if activeTransport == "wifi" { return lan.isReady }
        if mode == "host" { return remotePeripheral?.state == .connected && dataCharacteristic != nil }
        if mode == "guest" { return subscriber != nil }
        return false
    }

    private func emit(_ name: String, _ payload: [String: Any] = [:]) {
        onEvent?(name, payload)
        onEvent?("matchState", state())
    }

    func startDiscovery() {
        if centralManager == nil { centralManager = CBCentralManager(delegate: self, queue: .main) }
        if peripheralManager == nil { peripheralManager = CBPeripheralManager(delegate: self, queue: .main) }
        startLANDiscovery()
        if mode == "idle" { emit("matchState") }
    }

    func startLANDiscovery() {
        guard !lanDiscoveryStarted else { return }
        lanDiscoveryStarted = true
        lan.onPeersChanged = { [weak self] in self?.emit("matchState") }
        lan.onAvailability = { [weak self] _ in self?.emit("matchState") }
        lan.onIncoming = { [weak self] in
            guard let self else { return false }
            if self.mode == "idle" { self.activeTransport = "wifi"; return true }
            return self.activeTransport == "wifi" && self.mode == "guest" && self.phase == "reconnecting"
        }
        lan.onReady = { [weak self] in self?.lanDidConnect() }
        lan.onMessage = { [weak self] in self?.receiveWireMessage($0, via: "wifi") }
        lan.onDisconnected = { [weak self] in self?.lanDidDisconnect() }
        lan.start()
    }

    func invite(_ identifier: String, map: [String: Any], difficulty: String) throws {
        guard mode == "idle" else {
            throw StoreError.invalid("This Spherail player is no longer nearby.")
        }
        let transfer = try Self.mapForMatch(map, difficulty: difficulty)
        mode = "host"
        phase = "connecting"
        sessionID = UUID().uuidString
        selectedMap = transfer
        selectedDifficulty = difficulty
        if identifier.hasPrefix("wifi:") {
            let id = String(identifier.dropFirst(5))
            guard let peer = lan.peers.first(where: { $0.id == id }) else {
                clearSession()
                throw StoreError.invalid("这位玩家已不在同一局域网中。")
            }
            let key = NearbyPeerPresence.shortID(id)
            activePlayerKey = key
            let blePeripheral = matchingBluetoothPeripheral(for: id)
            let quality = linkQuality[key] ?? [:]
            func recentRTT(_ transport: String) -> Int? {
                guard let sample = quality[transport], Date().timeIntervalSince(sample.measuredAt) < 600 else { return nil }
                return sample.rttMs
            }
            let choice = MatchTransportSelector.preferred(hasWiFi: true,
                hasBluetooth: blePeripheral != nil && centralManager?.state == .poweredOn,
                wifiRTT: recentRTT("wifi"), bluetoothRTT: recentRTT("bluetooth"))
            peerProfile = ["name": peer.name, "avatar": peer.avatar, "deviceName": peer.deviceName]
            if choice == .bluetooth, let peripheral = blePeripheral {
                connectBluetooth(peripheral)
            } else {
                activeTransport = "wifi"
                lanTargetID = id
                lanInviteSent = false
                do { try lan.connect(to: id) }
                catch { clearSession(); throw error }
                lanConnectTimer?.invalidate()
                lanConnectTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { [weak self] _ in
                    guard let self, self.phase == "connecting", self.activeTransport == "wifi",
                          !self.lanInviteSent else { return }
                    self.fallbackFromLAN()
                }
            }
        } else {
            let id = identifier.hasPrefix("bluetooth:") ? String(identifier.dropFirst(10)) : identifier
            guard let peripheral = discovered[id], centralManager?.state == .poweredOn else {
                clearSession()
                throw StoreError.invalid("This Spherail player is no longer nearby.")
            }
            peerProfile = ["name": nearby[id]?["name"] as? String ?? peripheral.name ?? "Spherail player"]
            activePlayerKey = nearby[id]?["playerID"] as? String
            connectBluetooth(peripheral)
        }
        invitationTimer?.invalidate()
        invitationTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
            guard let self, self.phase == "connecting" else { return }
            self.emit("matchError", ["message": "Invitation timed out. Try again."])
            self.clearSession()
        }
        emit("matchState")
    }

    private func connectBluetooth(_ peripheral: CBPeripheral) {
        activeTransport = "bluetooth"
        lastRemoteIdentifier = peripheral.identifier
        remotePeripheral = peripheral
        peripheral.delegate = self
        centralManager?.stopScan()
        peripheralManager?.stopAdvertising()
        centralManager?.connect(peripheral)
    }

    private func fallbackFromLAN() {
        guard phase == "connecting", activeTransport == "wifi", !lanInviteSent else { return }
        guard let target = lanTargetID, centralManager?.state == .poweredOn,
              let peripheral = matchingBluetoothPeripheral(for: target) else {
            emit("matchError", ["message": "Wi-Fi 和蓝牙均无法连接。"])
            clearSession()
            return
        }
        lanConnectTimer?.invalidate()
        lanConnectTimer = nil
        lan.closeConnection()
        connectBluetooth(peripheral)
        emit("matchState")
    }

    private func lanDidConnect() {
        lanConnectTimer?.invalidate()
        lanConnectTimer = nil
        guard activeTransport == "wifi" else { return }
        if mode == "idle" {
            lanIncomingTimer?.invalidate()
            lanIncomingTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { [weak self] _ in
                guard let self, self.mode == "idle", self.activeTransport == "wifi" else { return }
                self.lan.closeConnection()
                self.activeTransport = "none"
                self.emit("matchState")
            }
        }
        if mode == "host", phase == "connecting", let map = selectedMap {
            lanInviteSent = true
            send("invite", ["map": map, "difficulty": selectedDifficulty,
                            "digest": mapDigest(map) ?? "", "profile": profile?() ?? [:],
                            "transport": 2], priority: true)
        } else if mode == "host", phase == "reconnecting" {
            send("hello", ["profile": profile?() ?? [:]], priority: true)
        }
        emit("matchState")
    }

    private func lanDidDisconnect() {
        guard activeTransport == "wifi" else { return }
        if phase == "connecting" {
            if !lanInviteSent { fallbackFromLAN() }
            else { emit("matchError", ["message": "Wi-Fi 邀请中断。"]); clearSession() }
        } else if phase == "playing" && !peerLeft {
            beginReconnect()
        } else if phase != "idle" && phase != "finished" && phase != "reconnecting" && !peerLeft {
            clearSession()
            emit("matchDisconnected")
        } else if mode == "idle" {
            activeTransport = "none"
        }
    }

    func accept() throws {
        guard mode == "guest", isConnected, phase == "invited" else {
            throw StoreError.invalid("No incoming invitation.")
        }
        phase = "accepted"
        send("accepted", ["profile": profile?() ?? [:], "transport": 2], priority: true)
        emit("matchAccepted", state())
    }

    func decline() {
        guard phase == "invited" else { return }
        send("declined", [:], priority: true)
        phase = "finished"
        emit("matchDeclined")
        leaveTimer?.invalidate()
        leaveTimer = Timer.scheduledTimer(withTimeInterval: 0.75, repeats: false) { [weak self] _ in
            self?.clearSession()
        }
    }

    private func beginCountdown() {
        guard selectedMap != nil, isConnected else { return }
        invitationTimer?.invalidate()
        invitationTimer = nil
        phase = "countdown"
        localReady = true
        remoteReady = true
        emit("matchCountdown", ["seconds": 3, "match": state()])
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: false) { [weak self] _ in
            guard let self, self.phase == "countdown", self.isConnected else { return }
            self.phase = "playing"
            self.localFinish = nil
            self.remoteFinish = nil
            self.peerLeft = false
            self.peerExitReason = "opponent_left"
            self.startMetrics()
            self.emit("matchStart", self.state())
        }
    }

    func sendSnapshot(_ snapshot: [String: Any]) {
        guard phase == "playing", !peerLeft, isConnected else { return }
        send("snapshot", snapshot, priority: false)
    }

    func updateLocalProfile() {
        if isConnected { send("profile", ["profile": profile?() ?? [:]], priority: true) }
        lan.refreshProfile()
        if mode == "idle" { peripheralManager?.stopAdvertising(); advertise() }
    }

    func finish(_ result: [String: Any]) {
        guard (phase == "playing" || phase == "reconnecting"), localFinish == nil else { return }
        localFinish = result
        if peerLeft { resolvePeerLeaveIfReady(); return }
        if phase == "playing" && isConnected { send("finish", result, priority: true) }
        resolveResultIfReady()
    }

    func leave() {
        if phase == "finished" { clearSession(); emit("matchLeft"); return }
        guard isConnected else { clearSession(); emit("matchLeft"); return }
        if localFinish == nil && activeTransport == "bluetooth" && peerSupportsCompact {
            enqueue(BLEProbeCodec.encode(.leave, token: sessionToken), priority: true)
        } else {
            send("leave", localFinish.map { ["finish": $0] } ?? [:], priority: true)
        }
        phase = "finished"
        selectedMap = nil
        // Keep GATT alive long enough for the final control packet to leave the queue.
        leaveTimer?.invalidate()
        leaveTimer = Timer.scheduledTimer(withTimeInterval: activeTransport == "wifi" ? 0.75 : peerSupportsCompact ? 1.5 : 3, repeats: false) { [weak self] _ in
            self?.clearSession()
            self?.emit("matchLeft")
        }
    }

    private func clearSession() {
        lanConnectTimer?.invalidate()
        lanConnectTimer = nil
        lanIncomingTimer?.invalidate()
        lanIncomingTimer = nil
        lanReconnectAttempts?.invalidate()
        lanReconnectAttempts = nil
        lanBLEFallbackTimer?.invalidate()
        lanBLEFallbackTimer = nil
        mayUseBLEBackup = false
        lan.closeConnection()
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        leaveTimer?.invalidate()
        leaveTimer = nil
        invitationTimer?.invalidate()
        invitationTimer = nil
        countdownTimer?.invalidate()
        countdownTimer = nil
        metricsTimer?.invalidate()
        metricsTimer = nil
        if let peripheral = remotePeripheral { centralManager?.cancelPeripheralConnection(peripheral) }
        remotePeripheral = nil
        lastRemoteIdentifier = nil
        dataCharacteristic = nil
        subscriber = nil
        priorityFrames.removeAll()
        stateFrames.removeAll()
        pendingStateFrames.removeAll()
        inFlightWrite = false
        inFlightFrame = nil
        writeRetries = 0
        reassembler.reset()
        mode = "idle"
        phase = "idle"
        sessionID = ""
        confirmationCode = ""
        peerProfile = [:]
        peerSupportsCompact = false
        activeTransport = "none"
        activePlayerKey = nil
        lanTargetID = nil
        lanInviteSent = false
        selectedMap = nil
        selectedDifficulty = "easy"
        localReady = false
        remoteReady = false
        localFinish = nil
        remoteFinish = nil
        peerLeft = false
        peerExitReason = "opponent_left"
        signalDBm = nil
        latencyMs = nil
        pingSentAt = nil
        pingToken = nil
        lastInboundAt = nil
        if centralManager?.state == .poweredOn {
            centralManager?.scanForPeripherals(withServices: [Self.serviceUUID],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        }
        advertise()
        emit("matchState")
    }

    // MARK: - Framing and transport

    private var sessionToken: UInt64 {
        UInt64(sessionID.replacingOccurrences(of: "-", with: "").prefix(16), radix: 16) ?? 0
    }

    private func send(_ type: String, _ payload: [String: Any], priority: Bool) {
        let packet: [String: Any] = ["version": 1, "type": type, "session": sessionID, "payload": payload]
        guard let body = try? JSONSerialization.data(withJSONObject: packet), body.count <= 131_072 else {
            emit("matchError", ["message": "Bluetooth message is too large."])
            return
        }
        if activeTransport == "wifi" {
            _ = lan.send(body, priority: priority)
            return
        }
        let wireBody = type == "snapshot" && peerSupportsCompact ? BLESnapshotCodec.encode(body) : body
        enqueue(wireBody, priority: priority)
    }

    private func enqueue(_ wireBody: Data, priority: Bool) {
        let capacity: Int
        if mode == "host" { capacity = max(20, remotePeripheral?.maximumWriteValueLength(for: .withResponse) ?? 20) }
        else { capacity = max(20, subscriber?.maximumUpdateValueLength ?? 20) }
        let frames = BLEFrames.encode(wireBody, id: nextMessageID, capacity: capacity)
        guard !frames.isEmpty else { return }
        nextMessageID &+= 1
        if priority { priorityFrames.append(contentsOf: frames) }
        else if stateFrames.isEmpty { stateFrames = frames }
        else { pendingStateFrames = frames } // Replace only whole unsent states.
        pump()
    }

    private func pump() {
        if mode == "host" {
            guard !inFlightWrite, let peripheral = remotePeripheral,
                  peripheral.state == .connected, let characteristic = dataCharacteristic else { return }
            let next: Data?
            if !priorityFrames.isEmpty { inFlightPriority = true; next = priorityFrames.removeFirst() }
            else if !stateFrames.isEmpty {
                inFlightPriority = false
                next = stateFrames.removeFirst()
                if stateFrames.isEmpty, !pendingStateFrames.isEmpty {
                    stateFrames = pendingStateFrames
                    pendingStateFrames = []
                }
            }
            else { next = nil }
            guard let next else { return }
            inFlightWrite = true
            inFlightFrame = next
            peripheral.writeValue(next, for: characteristic, type: .withResponse)
        } else if mode == "guest" {
            guard let peripheralManager, let characteristic = hostedCharacteristic,
                  let subscriber else { return }
            while !priorityFrames.isEmpty || !stateFrames.isEmpty {
                let isPriority = !priorityFrames.isEmpty
                let next = isPriority ? priorityFrames[0] : stateFrames[0]
                guard peripheralManager.updateValue(next, for: characteristic, onSubscribedCentrals: [subscriber]) else { break }
                if isPriority { priorityFrames.removeFirst() }
                else {
                    stateFrames.removeFirst()
                    if stateFrames.isEmpty, !pendingStateFrames.isEmpty {
                        stateFrames = pendingStateFrames
                        pendingStateFrames = []
                    }
                }
            }
        }
    }

    private func receive(_ data: Data) {
        guard let wireMessage = reassembler.accept(data) else { return }
        receiveWireMessage(wireMessage, via: "bluetooth")
    }

    private func receiveWireMessage(_ wireMessage: Data, via transport: String) {
        if let probe = BLEProbeCodec.decode(wireMessage) {
            guard transport == activeTransport else { return }
            if probe.kind == .leave {
                guard mode != "idle", !sessionID.isEmpty, probe.token == sessionToken else { return }
                lastInboundAt = Date()
                handlePeerLeave()
                return
            }
            guard phase == "playing", isConnected else { return }
            lastInboundAt = Date()
            if probe.kind == .ping && mode == "guest" {
                enqueue(BLEProbeCodec.encode(.pong, token: probe.token), priority: true)
            } else if probe.kind == .pong && mode == "host",
                      let sent = pingSentAt, probe.token == pingToken {
                pingSentAt = nil
                pingToken = nil
                latencyMs = max(0, Int(Date().timeIntervalSince(sent) * 1_000))
                recordLatency()
                emitMetrics()
                send("metrics", ["latencyMs": latencyMs ?? 0,
                                 "signalDBm": signalDBm as Any? ?? NSNull()], priority: true)
            }
            return
        }
        guard let message = BLESnapshotCodec.decode(wireMessage),
              let packet = try? JSONSerialization.jsonObject(with: message) as? [String: Any],
              packet["version"] as? Int == 1,
              let type = packet["type"] as? String,
              let payload = packet["payload"] as? [String: Any] else { return }
        let incomingSession = packet["session"] as? String ?? ""
        guard type == "invite" || (incomingSession == sessionID && !sessionID.isEmpty) else { return }
        if mode != "idle", transport != activeTransport,
           !(type == "hello" && transport == "bluetooth" && activeTransport == "wifi" &&
             (phase == "reconnecting" || phase == "playing")) { return }
        lastInboundAt = Date()
        handle(type, payload, incomingSession: incomingSession, via: transport)
    }

    private func handle(_ type: String, _ payload: [String: Any], incomingSession: String, via transport: String) {
        switch type {
        case "invite" where mode == "idle" && (activeTransport == "wifi" ? lan.isReady : subscriber != nil):
            guard let map = payload["map"] as? [String: Any],
                  let difficulty = payload["difficulty"] as? String,
                  let digest = payload["digest"] as? String,
                  digest == mapDigest(map),
                  (map["difficulties"] as? [String: Any])?[difficulty] != nil,
                  !incomingSession.isEmpty else { return }
            mode = "guest"
            lanIncomingTimer?.invalidate()
            lanIncomingTimer = nil
            if activeTransport != "wifi" { activeTransport = "bluetooth" }
            sessionID = incomingSession
            selectedMap = map
            selectedDifficulty = difficulty
            peerProfile = payload["profile"] as? [String: Any] ?? [:]
            if let id = peerProfile["id"] as? String { activePlayerKey = NearbyPeerPresence.shortID(id) }
            peerSupportsCompact = (payload["transport"] as? Int ?? 1) >= 2
            phase = "invited"
            if activeTransport == "bluetooth" {
                centralManager?.stopScan()
                peripheralManager?.stopAdvertising()
            }
            emit("matchInvitation", state())
        case "hello" where mode == "guest" && (phase == "reconnecting" ||
            (phase == "playing" && activeTransport == "wifi" && transport == "bluetooth")) && !peerLeft:
            if transport == "bluetooth", activeTransport == "wifi" {
                activeTransport = "bluetooth"
                lan.closeConnection()
                centralManager?.stopScan()
                peripheralManager?.stopAdvertising()
            }
            peerProfile = payload["profile"] as? [String: Any] ?? peerProfile
            reconnectTimer?.invalidate()
            reconnectTimer = nil
            lanReconnectAttempts?.invalidate()
            lanReconnectAttempts = nil
            lanBLEFallbackTimer?.invalidate()
            lanBLEFallbackTimer = nil
            mayUseBLEBackup = false
            phase = "playing"
            send("accepted", ["profile": profile?() ?? [:], "resumed": true, "transport": 2], priority: true)
            if let localFinish { send("finish", localFinish, priority: true) }
            emit("matchReconnected")
        case "accepted" where mode == "host" && !peerLeft:
            peerProfile = payload["profile"] as? [String: Any] ?? [:]
            peerSupportsCompact = (payload["transport"] as? Int ?? 1) >= 2
            reconnectTimer?.invalidate()
            reconnectTimer = nil
            lanReconnectAttempts?.invalidate()
            lanReconnectAttempts = nil
            lanBLEFallbackTimer?.invalidate()
            lanBLEFallbackTimer = nil
            mayUseBLEBackup = false
            if payload["resumed"] as? Bool == true {
                phase = "playing"
                startMetrics()
                if let localFinish { send("finish", localFinish, priority: true) }
                emit("matchReconnected")
                resolveResultIfReady()
            } else if phase == "connecting" {
                send("start", ["seconds": 3], priority: true)
                beginCountdown()
            }
        case "declined" where mode == "host":
            emit("matchDeclined")
            clearSession()
        case "start" where mode == "guest" && phase == "accepted":
            beginCountdown()
        case "snapshot" where phase == "playing":
            onEvent?("opponentSnapshot", payload)
        case "ping" where mode == "guest":
            send("pong", ["token": payload["token"] ?? 0], priority: true)
        case "pong" where mode == "host" && (activeTransport == "wifi" || !peerSupportsCompact):
            if let token = payload["token"] as? Double, let sent = pingSentAt,
               abs(token - sent.timeIntervalSince1970) < 0.001 {
                pingSentAt = nil
                latencyMs = max(0, Int(Date().timeIntervalSince(sent) * 1_000))
                recordLatency()
                emitMetrics()
                send("metrics", ["latencyMs": latencyMs ?? 0,
                                 "signalDBm": signalDBm as Any? ?? NSNull()], priority: true)
            }
        case "metrics" where mode == "guest":
            latencyMs = payload["latencyMs"] as? Int
            signalDBm = payload["signalDBm"] as? Int
            emitMetrics()
        case "profile":
            peerProfile = payload["profile"] as? [String: Any] ?? [:]
            emit("matchProfile", state())
        case "finish" where phase == "playing" || phase == "reconnecting":
            remoteFinish = payload
            emit("opponentFinished", payload)
            if peerLeft { resolvePeerLeaveIfReady() }
            else { resolveResultIfReady() }
        case "result" where !peerLeft:
            phase = "finished"
            selectedMap = nil
            emit("matchResult", payload)
        case "leave":
            if remoteFinish == nil, let finish = payload["finish"] as? [String: Any] {
                remoteFinish = finish
                emit("opponentFinished", finish)
            }
            handlePeerLeave()
        default: break
        }
    }

    private func handlePeerLeave(reason: String = "opponent_left") {
        if phase == "finished" { return }
        guard phase == "playing" || phase == "reconnecting" else {
            emit("matchDeclined")
            clearSession()
            return
        }
        guard !peerLeft else { return }
        peerLeft = true
        peerExitReason = reason
        phase = "playing"
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        lanReconnectAttempts?.invalidate()
        lanReconnectAttempts = nil
        lanBLEFallbackTimer?.invalidate()
        lanBLEFallbackTimer = nil
        mayUseBLEBackup = false
        metricsTimer?.invalidate()
        metricsTimer = nil
        emit("opponentLeft", ["peer": peerProfile, "reason": reason,
                              "finished": remoteFinish != nil,
                              "cleared": remoteFinish?["cleared"] as? Bool ?? false])
        resolvePeerLeaveIfReady()
    }

    private func resolvePeerLeaveIfReady() {
        guard peerLeft, phase == "playing", let localFinish else { return }
        phase = "finished"
        selectedMap = nil
        if let remoteFinish {
            emit("matchResult", ["outcome": Self.outcome(local: localFinish, remote: remoteFinish),
                                 "local": localFinish, "remote": remoteFinish])
        } else {
            emit("matchResult", ["outcome": "won", "reason": peerExitReason, "local": localFinish])
        }
    }

    static func outcome(local: [String: Any], remote: [String: Any]) -> String {
        let localCleared = local["cleared"] as? Bool ?? false
        let remoteCleared = remote["cleared"] as? Bool ?? false
        let localScore = local["score"] as? Int ?? 0
        let remoteScore = remote["score"] as? Int ?? 0
        let localTime = local["duration"] as? Int ?? Int.max
        let remoteTime = remote["duration"] as? Int ?? Int.max
        let order = localCleared == remoteCleared
            ? (localScore == remoteScore ? (localTime == remoteTime ? 0 : (localTime < remoteTime ? 1 : -1)) : (localScore > remoteScore ? 1 : -1))
            : (localCleared ? 1 : -1)
        return order > 0 ? "won" : order < 0 ? "lost" : "draw"
    }

    private func resolveResultIfReady() {
        guard mode == "host", phase == "playing", !peerLeft, isConnected,
              let local = localFinish, let remote = remoteFinish else { return }
        phase = "finished"
        let own = Self.outcome(local: local, remote: remote)
        let peer = Self.outcome(local: remote, remote: local)
        send("result", ["outcome": peer, "local": remote, "remote": local], priority: true)
        selectedMap = nil
        emit("matchResult", ["outcome": own, "local": local, "remote": remote])
    }

    private func beginReconnect() {
        guard phase == "playing", !peerLeft else { return }
        phase = "reconnecting"
        emit("matchDisconnected", ["seconds": 20])
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: false) { [weak self] _ in
            guard let self, self.phase == "reconnecting" else { return }
            self.handlePeerLeave(reason: "disconnect_timeout")
        }
        if activeTransport == "wifi" {
            if mode == "host", let id = lanTargetID {
                lan.reconnect(to: id)
                lanReconnectAttempts?.invalidate()
                lanReconnectAttempts = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
                    guard let self, self.phase == "reconnecting", self.activeTransport == "wifi" else { return }
                    self.lan.reconnect(to: id)
                }
                if centralManager?.state == .poweredOn {
                    centralManager?.scanForPeripherals(withServices: [Self.serviceUUID],
                        options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
                    lanBLEFallbackTimer?.invalidate()
                    lanBLEFallbackTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { [weak self] _ in
                        guard let self, self.phase == "reconnecting", self.activeTransport == "wifi" else { return }
                        self.mayUseBLEBackup = true
                        self.tryBLEBackup()
                    }
                }
            } else if mode == "guest" {
                advertise()
            }
        } else if mode == "guest", centralManager?.state == .poweredOn {
            advertise()
        } else if mode == "host", centralManager?.state == .poweredOn {
            centralManager?.scanForPeripherals(withServices: [Self.serviceUUID],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        }
    }

    private func tryBLEBackup() {
        guard mayUseBLEBackup, mode == "host", phase == "reconnecting", activeTransport == "wifi",
              let id = lanTargetID else { return }
        guard let peripheral = matchingBluetoothPeripheral(for: id) else { return }
        lanBLEFallbackTimer?.invalidate()
        lanBLEFallbackTimer = nil
        lanReconnectAttempts?.invalidate()
        lanReconnectAttempts = nil
        mayUseBLEBackup = false
        lan.closeConnection()
        connectBluetooth(peripheral)
        emit("matchState")
    }

    private func emitMetrics() {
        onEvent?("matchMetrics", ["latencyMs": latencyMs as Any? ?? NSNull(),
                                  "signalDBm": signalDBm as Any? ?? NSNull()])
    }

    private func recordLatency() {
        guard let key = activePlayerKey, let latencyMs,
              activeTransport == "wifi" || activeTransport == "bluetooth" else { return }
        let previous = linkQuality[key]?[activeTransport]?.rttMs
        let smoothed = previous.map { Int(Double($0) * 0.65 + Double(latencyMs) * 0.35) } ?? latencyMs
        linkQuality[key, default: [:]][activeTransport] = LinkQuality(rttMs: smoothed, measuredAt: Date())
    }

    private func startMetrics() {
        guard mode == "host" else { return }
        metricsTimer?.invalidate()
        lastInboundAt = Date()
        metricsTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            guard let self, self.phase == "playing", self.isConnected else { return }
            let now = Date()
            if let last = self.lastInboundAt, now.timeIntervalSince(last) > 20 {
                self.latencyMs = nil
                self.emitMetrics()
                if self.activeTransport == "wifi" { self.lan.closeConnection(notify: true) }
                else if let peripheral = self.remotePeripheral { self.centralManager?.cancelPeripheralConnection(peripheral) }
                return
            }
            if self.activeTransport == "bluetooth" { self.remotePeripheral?.readRSSI() }
            if let pending = self.pingSentAt, now.timeIntervalSince(pending) <= 5 { return }
            self.pingSentAt = now
            if self.activeTransport == "wifi" {
                self.send("ping", ["token": now.timeIntervalSince1970], priority: true)
            } else if self.peerSupportsCompact {
                let token = UInt64(now.timeIntervalSince1970 * 1_000)
                self.pingToken = token
                self.enqueue(BLEProbeCodec.encode(.ping, token: token), priority: true)
            } else {
                self.send("ping", ["token": now.timeIntervalSince1970], priority: true)
            }
        }
        metricsTimer?.fire()
    }

    private func advertise() {
        guard let peripheralManager, peripheralManager.state == .poweredOn,
              hostedCharacteristic != nil else { return }
        if peripheralManager.isAdvertising { return }
        let localProfile = profile?() ?? [:]
        let key = NearbyPeerPresence.shortID(localProfile["id"] as? String ?? UUID().uuidString)
        let name = String((localProfile["name"] as? String ?? "Spherail").prefix(8))
        let displayName = "IB:\(key):\(name)"
        peripheralManager.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [Self.serviceUUID],
            CBAdvertisementDataLocalNameKey: displayName,
        ])
    }

    // MARK: - Core Bluetooth delegates

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            if mode == "idle" || (mode == "host" && phase == "reconnecting") {
                central.scanForPeripherals(withServices: [Self.serviceUUID],
                    options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            }
        } else {
            if activeTransport != "wifi" {
                emit("matchError", ["message": "Bluetooth is unavailable or switched off."])
                beginReconnect()
            }
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        discovered[peripheral.identifier.uuidString] = peripheral
        let advertised = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name ?? "Spherail Mac"
        if phase == "reconnecting", mode == "host", activeTransport == "bluetooth",
           peripheral.identifier == lastRemoteIdentifier {
            central.stopScan()
            remotePeripheral = peripheral
            peripheral.delegate = self
            central.connect(peripheral)
        } else if mode == "idle" || (phase == "reconnecting" && activeTransport == "wifi") {
            let id = peripheral.identifier.uuidString
            let candidate = String(advertised.dropFirst(min(3, advertised.count)).prefix(8))
            let playerKey = advertised.hasPrefix("IB:") && candidate.count == 8 &&
                candidate.allSatisfy({ $0.isHexDigit }) ? candidate.lowercased() : ""
            let suffix = playerKey.isEmpty ? "" : String(advertised.dropFirst(11)).trimmingCharacters(in: CharacterSet(charactersIn: ":"))
            let name = playerKey.isEmpty ? advertised : suffix.isEmpty ? "绘轨玩家" : suffix
            nearby[id] = ["id": id, "name": name, "playerID": playerKey,
                          "deviceName": playerKey.isEmpty ? advertised : "Mac", "rssi": RSSI.intValue]
            lastSeen[id] = Date()
            if mode == "idle" { onEvent?("matchState", state()) }
            else { tryBLEBackup() }
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        lastRemoteIdentifier = peripheral.identifier
        remotePeripheral = peripheral
        peripheral.delegate = self
        peripheral.discoverServices([Self.serviceUUID])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        emit("matchError", ["message": error?.localizedDescription ?? "Bluetooth connection failed."])
        if phase == "connecting" { clearSession() }
        else if phase == "reconnecting" {
            central.scanForPeripherals(withServices: [Self.serviceUUID],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        }
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        dataCharacteristic = nil
        remotePeripheral = nil
        inFlightWrite = false
        reassembler.reset()
        priorityFrames.removeAll()
        stateFrames.removeAll()
        pendingStateFrames.removeAll()
        guard activeTransport == "bluetooth" else { return }
        if phase == "playing" && !peerLeft { beginReconnect() }
        else if phase != "idle" && phase != "finished" && !peerLeft {
            clearSession()
            emit("matchDisconnected")
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error { emit("matchError", ["message": error.localizedDescription]); return }
        peripheral.services?.filter { $0.uuid == Self.serviceUUID }.forEach {
            peripheral.discoverCharacteristics([Self.dataUUID], for: $0)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error { emit("matchError", ["message": error.localizedDescription]); return }
        guard let characteristic = service.characteristics?.first(where: { $0.uuid == Self.dataUUID }) else { return }
        dataCharacteristic = characteristic
        peripheral.setNotifyValue(true, for: characteristic)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        if let error { emit("matchError", ["message": error.localizedDescription]); return }
        guard characteristic.isNotifying else { return }
        if mode == "host" && phase == "connecting", let map = selectedMap {
            send("invite", ["map": map, "difficulty": selectedDifficulty,
                            "digest": mapDigest(map) ?? "", "profile": profile?() ?? [:],
                            "transport": 2], priority: true)
        } else if mode == "host" && phase == "reconnecting" {
            send("hello", ["profile": profile?() ?? [:]], priority: true)
        }
        pump()
    }

    func peripheral(_ peripheral: CBPeripheral, didReadRSSI RSSI: NSNumber, error: Error?) {
        guard error == nil, RSSI.intValue < 0 else { return }
        signalDBm = RSSI.intValue
        emitMetrics()
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let value = characteristic.value, error == nil { receive(value) }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        inFlightWrite = false
        if let error {
            if let frame = inFlightFrame, writeRetries < 3, isConnected {
                writeRetries += 1
                if inFlightPriority { priorityFrames.insert(frame, at: 0) }
                else { stateFrames.insert(frame, at: 0) }
            } else {
                emit("matchError", ["message": error.localizedDescription])
                writeRetries = 0
                if phase == "playing", let peripheral = remotePeripheral {
                    centralManager?.cancelPeripheralConnection(peripheral)
                }
            }
        } else { writeRetries = 0 }
        inFlightFrame = nil
        pump()
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn else {
            if activeTransport != "wifi" {
                emit("matchError", ["message": "Bluetooth is unavailable or switched off."])
                beginReconnect()
            }
            return
        }
        let characteristic = CBMutableCharacteristic(
            type: Self.dataUUID,
            properties: [.notify, .write],
            value: nil,
            permissions: [.readable, .writeable]
        )
        hostedCharacteristic = characteristic
        let service = CBMutableService(type: Self.serviceUUID, primary: true)
        service.characteristics = [characteristic]
        peripheral.add(service)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error { emit("matchError", ["message": error.localizedDescription]); return }
        if mode == "idle" || activeTransport == "wifi" || phase == "reconnecting" { advertise() }
        emit("matchState")
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral,
                           didSubscribeTo characteristic: CBCharacteristic) {
        if subscriber != nil && subscriber?.identifier != central.identifier { return }
        subscriber = central
        pump()
        emit("matchState")
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral,
                           didUnsubscribeFrom characteristic: CBCharacteristic) {
        guard subscriber?.identifier == central.identifier else { return }
        subscriber = nil
        guard activeTransport == "bluetooth" else { return }
        reassembler.reset()
        priorityFrames.removeAll()
        stateFrames.removeAll()
        pendingStateFrames.removeAll()
        if phase == "playing" && !peerLeft { beginReconnect() }
        else if phase != "idle" && !peerLeft { clearSession() }
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if request.characteristic.uuid == Self.dataUUID, let value = request.value {
                receive(value)
                peripheral.respond(to: request, withResult: .success)
            } else {
                peripheral.respond(to: request, withResult: .requestNotSupported)
            }
        }
    }

    func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) { pump() }
}
