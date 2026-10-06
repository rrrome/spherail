import Foundation
import XCTest
@testable import InkBallMac

final class LANTransportTests: XCTestCase {
    func testTCPFramesSurviveSplitAndCombinedReceives() throws {
        let invite = Data(String(repeating: "map", count: 10_000).utf8)
        let snapshot = Data("{\"type\":\"snapshot\"}".utf8)
        let first = try XCTUnwrap(LANFrameCodec.encode(invite))
        let second = try XCTUnwrap(LANFrameCodec.encode(snapshot))
        var decoder = LANFrameCodec()
        XCTAssertEqual(decoder.append(Data(first.prefix(3)))?.count, 0)
        XCTAssertEqual(decoder.append(Data(first.dropFirst(3).prefix(8_000)))?.count, 0)
        var tail = Data(first.dropFirst(8_003))
        tail.append(second)
        XCTAssertEqual(decoder.append(tail), [invite, snapshot])
    }

    func testTCPFramesRejectInvalidLengths() {
        var decoder = LANFrameCodec()
        XCTAssertNil(decoder.append(Data([0, 0, 0, 0])))
        XCTAssertNil(LANFrameCodec.encode(Data()))
        XCTAssertNil(LANFrameCodec.encode(Data(count: LANFrameCodec.maximumBodySize + 1)))
        var oversized = LANFrameCodec()
        XCTAssertNil(oversized.append(Data([0, 2, 0, 1])))
    }

    func testSameMacOnWiFiAndBluetoothAppearsOnce() {
        let id = "12345678-1111-2222-3333-444444444444"
        let bluetooth = NearbyPeerPresence(transport: .bluetooth, endpointID: "ble-uuid",
            playerID: "12345678", name: "player", deviceName: "Mac", avatar: nil, rssi: -52)
        let wifi = NearbyPeerPresence(transport: .wifi, endpointID: id,
            playerID: id, name: "player142425", deviceName: "Alice's MacBook Pro",
            avatar: "genshin-001", rssi: nil)
        let result = NearbyPeerDirectory.merged([bluetooth, wifi])
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0]["id"] as? String, "wifi:\(id)")
        XCTAssertEqual(result[0]["name"] as? String, "player142425")
        XCTAssertEqual(result[0]["deviceName"] as? String, "Alice's MacBook Pro")
        XCTAssertEqual(result[0]["avatar"] as? String, "genshin-001")
        XCTAssertEqual(result[0]["transport"] as? String, "Wi-Fi + 蓝牙")
        XCTAssertEqual(result[0]["rssi"] as? Int, -52)
    }

    func testMissingBluetoothAdvertisedIDUsesUniqueDeviceName() {
        let id = "12345678-1111-2222-3333-444444444444"
        let bluetooth = NearbyPeerPresence(transport: .bluetooth, endpointID: "ble-uuid",
            playerID: "", name: "HUAWEI MacBook Pro", deviceName: "HUAWEI MacBook Pro",
            avatar: nil, rssi: -56)
        let wifi = NearbyPeerPresence(transport: .wifi, endpointID: id,
            playerID: id, name: "player264375", deviceName: "HUAWEI MacBook Pro",
            avatar: "avatar-one", rssi: nil)
        let resolved = NearbyPeerDirectory.resolved([bluetooth, wifi])
        XCTAssertEqual(resolved.first?.playerID, id)
        let rows = NearbyPeerDirectory.merged([bluetooth, wifi])
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows[0]["id"] as? String, "wifi:\(id)")
        XCTAssertEqual(rows[0]["name"] as? String, "player264375")
        XCTAssertEqual(rows[0]["avatar"] as? String, "avatar-one")
        XCTAssertEqual(rows[0]["transport"] as? String, "Wi-Fi + 蓝牙")
    }

    func testAmbiguousOrGenericDeviceNamesRemainSeparate() {
        let id = "12345678-1111-2222-3333-444444444444"
        let wifi = NearbyPeerPresence(transport: .wifi, endpointID: id,
            playerID: id, name: "one", deviceName: "Shared MacBook", avatar: nil, rssi: nil)
        let wifiTwin = NearbyPeerPresence(transport: .wifi, endpointID: "other",
            playerID: "87654321-1111-2222-3333-444444444444", name: "two",
            deviceName: "Shared MacBook", avatar: nil, rssi: nil)
        let bluetooth = NearbyPeerPresence(transport: .bluetooth, endpointID: "ble-one",
            playerID: "", name: "Shared MacBook", deviceName: "Shared MacBook", avatar: nil, rssi: -40)
        XCTAssertEqual(NearbyPeerDirectory.merged([wifi, wifiTwin, bluetooth]).count, 3)
        let generic = NearbyPeerPresence(transport: .bluetooth, endpointID: "ble-two",
            playerID: "", name: "Mac", deviceName: "Mac", avatar: nil, rssi: -50)
        let genericWiFi = NearbyPeerPresence(transport: .wifi, endpointID: "generic-wifi",
            playerID: "11111111-1111-2222-3333-444444444444", name: "three",
            deviceName: "Mac", avatar: nil, rssi: nil)
        XCTAssertEqual(NearbyPeerDirectory.merged([genericWiFi, generic]).count, 2)
    }

    func testTransportChoiceUsesRecentLatencyWhenBothPathsExist() {
        XCTAssertEqual(MatchTransportSelector.preferred(hasWiFi: true, hasBluetooth: true,
            wifiRTT: nil, bluetoothRTT: nil), .wifi)
        XCTAssertEqual(MatchTransportSelector.preferred(hasWiFi: true, hasBluetooth: true,
            wifiRTT: 1000, bluetoothRTT: 55), .bluetooth)
        XCTAssertEqual(MatchTransportSelector.preferred(hasWiFi: true, hasBluetooth: true,
            wifiRTT: 40, bluetoothRTT: 30), .wifi)
        XCTAssertEqual(MatchTransportSelector.preferred(hasWiFi: false, hasBluetooth: true,
            wifiRTT: nil, bluetoothRTT: nil), .bluetooth)
    }

    func testFinishedOpponentScoreDeterminesResultAfterLeaving() {
        XCTAssertEqual(BluetoothMatchService.outcome(
            local: ["score": 5, "duration": 8, "cleared": true],
            remote: ["score": 10, "duration": 7, "cleared": true]), "lost")
        XCTAssertEqual(BluetoothMatchService.outcome(
            local: ["score": 10, "duration": 8, "cleared": true],
            remote: ["score": 5, "duration": 7, "cleared": true]), "won")
    }

    @MainActor
    func testBonjourPeersExchangeFramedPacket() async throws {
        let firstID = UUID().uuidString
        let secondID = UUID().uuidString
        let first = LANTransport(profile: { ["id": firstID, "name": "first", "avatar": ""] })
        let second = LANTransport(profile: { ["id": secondID, "name": "second", "avatar": ""] })
        defer { first.stop(); second.stop() }
        let found = expectation(description: "Bonjour finds the second InkBall instance")
        let received = expectation(description: "TCP carries one framed match packet")
        var didFind = false
        first.onPeersChanged = {
            if !didFind && first.hasPeer(secondID) { didFind = true; found.fulfill() }
        }
        second.onIncoming = { true }
        second.onMessage = { data in
            if data == Data("{\"type\":\"ping\"}".utf8) { received.fulfill() }
        }
        first.onReady = { _ = first.send(Data("{\"type\":\"ping\"}".utf8), priority: true) }
        first.start()
        second.start()
        await fulfillment(of: [found], timeout: 10)
        try first.connect(to: secondID)
        await fulfillment(of: [received], timeout: 10)
    }

    @MainActor
    func testLocalNetworkMatchInvitesSyncsAndSettles() async {
        let hostID = UUID().uuidString
        let guestID = UUID().uuidString
        let host = BluetoothMatchService()
        let guest = BluetoothMatchService()
        host.profile = { ["id": hostID, "name": "host", "avatar": ""] }
        guest.profile = { ["id": guestID, "name": "guest", "avatar": ""] }
        defer { host.leave(); guest.leave() }
        let settledHost = expectation(description: "Host receives a result")
        let settledGuest = expectation(description: "Guest receives a result")
        let map: [String: Any] = ["id": "sample", "name": "Sample", "official": false,
            "difficulties": ["easy": ["time": 10, "balls": ["grey"], "layout_content": "sample"]]]
        var invited = false
        var hostStarted = false
        var guestStarted = false
        var snapshotSent = false
        var snapshotReceived = false
        var failure: String?
        func sendSnapshotWhenReady() {
            guard hostStarted, guestStarted, !snapshotSent else { return }
            snapshotSent = true
            host.sendSnapshot(["sequence": 1, "status": "playing"])
        }
        host.onEvent = { event, payload in
            if event == "matchState", !invited,
               let peers = payload["peers"] as? [[String: Any]],
               peers.contains(where: { $0["id"] as? String == "wifi:\(guestID)" }) {
                invited = true
                do { try host.invite("wifi:\(guestID)", map: map, difficulty: "easy") }
                catch { failure = error.localizedDescription; settledHost.fulfill(); settledGuest.fulfill() }
            } else if event == "matchStart" {
                hostStarted = true
                sendSnapshotWhenReady()
            } else if event == "matchResult" {
                XCTAssertEqual(payload["outcome"] as? String, "won")
                settledHost.fulfill()
            }
        }
        guest.onEvent = { event, payload in
            if event == "matchInvitation" {
                do { try guest.accept() }
                catch { failure = error.localizedDescription; settledHost.fulfill(); settledGuest.fulfill() }
            } else if event == "matchStart" {
                guestStarted = true
                sendSnapshotWhenReady()
            } else if event == "opponentSnapshot", !snapshotReceived {
                snapshotReceived = true
                XCTAssertEqual(payload["sequence"] as? Int, 1)
                guest.finish(["score": 5, "duration": 9, "cleared": true])
                host.finish(["score": 10, "duration": 8, "cleared": true])
            } else if event == "matchResult" {
                XCTAssertEqual(payload["outcome"] as? String, "lost")
                settledGuest.fulfill()
            }
        }
        host.startLANDiscovery()
        guest.startLANDiscovery()
        await fulfillment(of: [settledHost, settledGuest], timeout: 15)
        XCTAssertNil(failure)
        XCTAssertTrue(snapshotReceived)
    }

    @MainActor
    func testFinishedHostCanLeaveBeforeGuestAndGuestUsesHostScore() async {
        let hostID = UUID().uuidString
        let guestID = UUID().uuidString
        let host = BluetoothMatchService()
        let guest = BluetoothMatchService()
        host.profile = { ["id": hostID, "name": "host", "avatar": ""] }
        guest.profile = { ["id": guestID, "name": "guest", "avatar": ""] }
        defer { host.leave(); guest.leave() }
        let settled = expectation(description: "Guest settles using the departed host's score")
        let map: [String: Any] = ["id": "sample", "name": "Sample", "official": false,
            "difficulties": ["easy": ["time": 10, "balls": ["grey"], "layout_content": "sample"]]]
        var invited = false
        var hostStarted = false
        var guestStarted = false
        var hostLeft = false
        var receivedFinish = false
        var receivedLeave = false
        var failure: String?
        func finishAndLeaveWhenReady() {
            guard hostStarted, guestStarted, !hostLeft else { return }
            hostLeft = true
            host.finish(["score": 10, "duration": 7, "cleared": true])
            host.leave()
        }
        host.onEvent = { event, payload in
            if event == "matchState", !invited,
               let peers = payload["peers"] as? [[String: Any]],
               peers.contains(where: { $0["id"] as? String == "wifi:\(guestID)" }) {
                invited = true
                do { try host.invite("wifi:\(guestID)", map: map, difficulty: "easy") }
                catch { failure = error.localizedDescription; settled.fulfill() }
            } else if event == "matchStart" {
                hostStarted = true
                finishAndLeaveWhenReady()
            }
        }
        guest.onEvent = { event, payload in
            if event == "matchInvitation" {
                do { try guest.accept() }
                catch { failure = error.localizedDescription; settled.fulfill() }
            } else if event == "matchStart" {
                guestStarted = true
                finishAndLeaveWhenReady()
            } else if event == "opponentFinished" {
                receivedFinish = true
                XCTAssertEqual(payload["score"] as? Int, 10)
            } else if event == "opponentLeft" {
                receivedLeave = true
                XCTAssertEqual(payload["finished"] as? Bool, true)
                guest.finish(["score": 5, "duration": 9, "cleared": true])
            } else if event == "matchResult" {
                XCTAssertEqual(payload["outcome"] as? String, "lost")
                XCTAssertEqual((payload["remote"] as? [String: Any])?["score"] as? Int, 10)
                XCTAssertNil(payload["reason"])
                settled.fulfill()
            }
        }
        host.startLANDiscovery()
        guest.startLANDiscovery()
        await fulfillment(of: [settled], timeout: 15)
        XCTAssertNil(failure)
        XCTAssertTrue(receivedFinish)
        XCTAssertTrue(receivedLeave)
    }
}
