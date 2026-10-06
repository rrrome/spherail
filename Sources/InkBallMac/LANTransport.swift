import Foundation
import Network

struct LANPeer {
    let id: String
    let name: String
    let avatar: String
    let deviceName: String
}

/// A length prefix is required because one TCP receive may contain part of a
/// message or several messages. Invalid lengths close the connection.
struct LANFrameCodec {
    static let maximumBodySize = 131_072
    private var pending = Data()

    static func encode(_ body: Data) -> Data? {
        guard !body.isEmpty, body.count <= maximumBodySize else { return nil }
        var length = UInt32(body.count).bigEndian
        var frame = Data(bytes: &length, count: 4)
        frame.append(body)
        return frame
    }

    mutating func append(_ chunk: Data) -> [Data]? {
        pending.append(chunk)
        var messages: [Data] = []
        while pending.count >= 4 {
            let length = pending.prefix(4).reduce(0) { ($0 << 8) | Int($1) }
            guard length > 0, length <= Self.maximumBodySize else { return nil }
            guard pending.count >= length + 4 else { break }
            messages.append(Data(pending.dropFirst(4).prefix(length)))
            pending = Data(pending.dropFirst(length + 4))
        }
        return messages
    }
}

/// Bonjour discovery and TCP transport stay on the main queue, like the BLE
/// service. The transport carries the same JSON packets as Bluetooth.
final class LANTransport {
    static let serviceType = "_inkball._tcp"

    var onPeersChanged: (() -> Void)?
    var onIncoming: (() -> Bool)?
    var onReady: (() -> Void)?
    var onMessage: ((Data) -> Void)?
    var onDisconnected: (() -> Void)?
    var onAvailability: ((Bool) -> Void)?

    private let profile: () -> [String: Any]
    private var listener: NWListener?
    private var browser: NWBrowser?
    private var connection: NWConnection?
    private var remoteEndpoint: NWEndpoint?
    private var discovered: [String: (peer: LANPeer, endpoint: NWEndpoint)] = [:]
    private var decoder = LANFrameCodec()
    private var controlFrames: [Data] = []
    private var latestSnapshot: Data?
    private var sendInFlight = false
    private(set) var isReady = false
    private(set) var isConnecting = false
    private(set) var isAvailable = false

    init(profile: @escaping () -> [String: Any]) { self.profile = profile }

    deinit {
        connection?.cancel()
        browser?.cancel()
        listener?.cancel()
    }

    var peers: [LANPeer] { discovered.values.map(\.peer) }

    func hasPeer(_ id: String) -> Bool { discovered[id] != nil }

    func start() {
        guard listener == nil, browser == nil else { return }
        do {
            let parameters = NWParameters.tcp
            parameters.includePeerToPeer = false
            let listener = try NWListener(using: parameters)
            listener.service = serviceDescription()
            listener.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                switch state {
                case .ready:
                    self.isAvailable = true
                    self.onAvailability?(true)
                case .failed:
                    self.isAvailable = false
                    self.onAvailability?(false)
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                guard let self, self.connection == nil, self.onIncoming?() == true else {
                    connection.cancel()
                    return
                }
                self.attach(connection)
            }
            self.listener = listener
            listener.start(queue: .main)

            let browser = NWBrowser(for: .bonjourWithTXTRecord(type: Self.serviceType, domain: nil),
                                    using: parameters)
            browser.browseResultsChangedHandler = { [weak self] results, _ in
                self?.updatePeers(results)
            }
            self.browser = browser
            browser.start(queue: .main)
        } catch {
            isAvailable = false
            onAvailability?(false)
        }
    }

    func stop() {
        closeConnection()
        browser?.cancel()
        browser = nil
        listener?.cancel()
        listener = nil
        discovered.removeAll()
        isAvailable = false
    }

    func refreshProfile() {
        listener?.service = serviceDescription()
    }

    private func serviceDescription() -> NWListener.Service {
        let value = profile()
        let id = value["id"] as? String ?? ""
        let name = String((value["name"] as? String ?? "Spherail player").prefix(50))
        let avatar = value["avatar"] as? String ?? ""
        let device = String((Host.current().localizedName ?? "Mac").prefix(50))
        let record = NWTXTRecord(["id": id, "name": name, "avatar": avatar,
                                  "device": device, "version": "1"])
        return NWListener.Service(name: "Spherail-\(id.prefix(8))", type: Self.serviceType,
                                  txtRecord: record)
    }

    private func updatePeers(_ results: Set<NWBrowser.Result>) {
        let ownID = profile()["id"] as? String ?? ""
        var next: [String: (peer: LANPeer, endpoint: NWEndpoint)] = [:]
        for result in results {
            guard case .bonjour(let record) = result.metadata else { continue }
            let fields = record.dictionary
            guard fields["version"] == "1", let id = fields["id"],
                  UUID(uuidString: id) != nil, id != ownID else { continue }
            let peer = LANPeer(id: id, name: fields["name"] ?? "Spherail player",
                               avatar: fields["avatar"] ?? "", deviceName: fields["device"] ?? "Mac")
            // Bonjour may return several interfaces for one Mac. Prefer Wi-Fi.
            if next[id] == nil || result.interfaces.contains(where: { $0.type == .wifi }) {
                next[id] = (peer, result.endpoint)
            }
        }
        discovered = next
        onPeersChanged?()
    }

    func connect(to peerID: String) throws {
        guard let target = discovered[peerID] else {
            throw StoreError.invalid("这位玩家已不在同一局域网中。")
        }
        remoteEndpoint = target.endpoint
        beginConnection(to: target.endpoint)
    }

    func reconnect(to peerID: String) {
        guard !isReady, !isConnecting else { return }
        if let endpoint = discovered[peerID]?.endpoint ?? remoteEndpoint {
            beginConnection(to: endpoint)
        }
    }

    private func beginConnection(to endpoint: NWEndpoint) {
        closeConnection()
        isConnecting = true
        let parameters = NWParameters.tcp
        parameters.includePeerToPeer = false
        attach(NWConnection(to: endpoint, using: parameters))
    }

    private func attach(_ incoming: NWConnection) {
        decoder = LANFrameCodec()
        connection = incoming
        incoming.stateUpdateHandler = { [weak self, weak incoming] state in
            guard let self, let incoming, self.connection === incoming else { return }
            switch state {
            case .ready:
                self.isConnecting = false
                self.isReady = true
                self.onReady?()
                self.receive(from: incoming)
                self.pump()
            case .failed, .cancelled:
                self.closeConnection(notify: true)
            default: break
            }
        }
        incoming.start(queue: .main)
    }

    func closeConnection(notify: Bool = false) {
        let old = connection
        connection = nil
        isReady = false
        isConnecting = false
        decoder = LANFrameCodec()
        controlFrames.removeAll()
        latestSnapshot = nil
        sendInFlight = false
        old?.cancel()
        if notify, old != nil { onDisconnected?() }
    }

    @discardableResult
    func send(_ body: Data, priority: Bool) -> Bool {
        guard isReady, let frame = LANFrameCodec.encode(body) else { return false }
        if priority { controlFrames.append(frame) }
        else { latestSnapshot = frame }
        pump()
        return true
    }

    private func pump() {
        guard isReady, !sendInFlight, let connection else { return }
        let frame: Data
        if !controlFrames.isEmpty { frame = controlFrames.removeFirst() }
        else if let snapshot = latestSnapshot { frame = snapshot; latestSnapshot = nil }
        else { return }
        sendInFlight = true
        connection.send(content: frame, completion: .contentProcessed { [weak self, weak connection] error in
            guard let self, let connection, self.connection === connection else { return }
            self.sendInFlight = false
            if error != nil { self.closeConnection(notify: true) }
            else { self.pump() }
        })
    }

    private func receive(from connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self, weak connection] data, _, complete, error in
            guard let self, let connection, self.connection === connection else { return }
            if let data, !data.isEmpty {
                guard let messages = self.decoder.append(data) else {
                    self.closeConnection(notify: true)
                    return
                }
                for message in messages { self.onMessage?(message) }
            }
            if complete || error != nil { self.closeConnection(notify: true) }
            else { self.receive(from: connection) }
        }
    }
}
