import XCTest
import CryptoKit
@testable import InkBallMac

final class BLEFramesTests: XCTestCase {
    func testLargeMapRoundTripAtMinimumBLEPayload() {
        let body = Data(String(repeating: "X H0 B2  ", count: 2_000).utf8)
        let chunks = BLEFrames.encode(body, id: 42, capacity: 20)
        XCTAssertGreaterThan(chunks.count, 1_000)
        XCTAssertTrue(chunks.allSatisfy { $0.count <= 20 })
        let decoder = BLEReassembler()
        var complete: Data?
        for chunk in chunks.reversed() { if let value = decoder.accept(chunk) { complete = value } }
        XCTAssertEqual(complete, body)
    }

    func testMissingChunkDoesNotProduceTruncatedMessage() {
        let body = Data(String(repeating: "snapshot", count: 200).utf8)
        let chunks = BLEFrames.encode(body, id: 9, capacity: 100)
        let decoder = BLEReassembler()
        for (index, chunk) in chunks.enumerated() where index != 3 {
            XCTAssertNil(decoder.accept(chunk))
        }
        XCTAssertEqual(decoder.accept(chunks[3]), body)
        decoder.reset()
        XCTAssertNil(decoder.accept(chunks[0]))
    }

    func testCompressedSnapshotRoundTripsThroughBLEFrames() throws {
        let balls = (0..<30).map { ["id": $0, "color": 2, "x": $0 * 7,
                                   "y": $0 * 9, "vx": 1, "vy": -1] }
        let lines = (0..<8).map { index in
            ["id": index, "points": (0..<40).map { ["x": $0 * 3, "y": index * 20 + $0] }] as [String: Any]
        }
        let body = try JSONSerialization.data(withJSONObject: ["type": "snapshot",
            "payload": ["balls": balls, "lines": lines]])
        let compressed = BLESnapshotCodec.encode(body)
        XCTAssertLessThan(compressed.count, body.count / 2)
        let frames = BLEFrames.encode(compressed, id: 23, capacity: 100)
        let reassembler = BLEReassembler()
        var received: Data?
        for frame in frames { if let value = reassembler.accept(frame) { received = value } }
        XCTAssertEqual(BLESnapshotCodec.decode(try XCTUnwrap(received)), body)
        XCTAssertEqual(BLESnapshotCodec.decode(body), body)
        XCTAssertNil(BLESnapshotCodec.decode(Data("IBS1".utf8)))
    }

    func testLatencyProbeUsesOneMinimumBLEFrame() {
        let token: UInt64 = 0x1234_5678_90AB_CDEF
        for kind in [BLEProbeCodec.Kind.ping, .pong, .leave] {
            let body = BLEProbeCodec.encode(kind, token: token)
            let frames = BLEFrames.encode(body, id: 31, capacity: 20)
            XCTAssertEqual(frames.count, 1)
            XCTAssertLessThanOrEqual(frames[0].count, 20)
            let recovered = BLEReassembler().accept(frames[0])
            XCTAssertEqual(BLEProbeCodec.decode(recovered ?? Data())?.kind, kind)
            XCTAssertEqual(BLEProbeCodec.decode(recovered ?? Data())?.token, token)
        }
        XCTAssertNil(BLEProbeCodec.decode(Data("{}".utf8)))
    }

    func testOfficialMapFingerprintSurvivesBLEJSONRoundTrip() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let script = try String(contentsOf: root.appendingPathComponent("Web/official-data.js"), encoding: .utf8)
        let json = String(script.dropFirst("window.INKBALL_OFFICIAL=".count).dropLast(2))
        let bundle = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
        var map = try XCTUnwrap((bundle["maps"] as? [[String: Any]])?.first)
        let level = try XCTUnwrap((map["difficulties"] as? [String: Any])?["master"])
        map["difficulties"] = ["master": level]
        let original = try JSONSerialization.data(withJSONObject: map, options: [.sortedKeys])
        let digest = SHA256.hash(data: original)
        let packet = try JSONSerialization.data(withJSONObject: ["version": 1, "map": map])
        let decoder = BLEReassembler()
        var received: Data?
        for frame in BLEFrames.encode(packet, id: 5, capacity: 20) {
            if let complete = decoder.accept(frame) { received = complete }
        }
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(received)) as? [String: Any])
        let roundTripped = try JSONSerialization.data(withJSONObject: try XCTUnwrap(decoded["map"]), options: [.sortedKeys])
        XCTAssertEqual(SHA256.hash(data: roundTripped), digest)
    }

    func testCustomMapTransfersOnlyChosenDifficulty() throws {
        let source: [String: Any] = [
            "id": "local-map", "name": "Own Map", "official": false,
            "difficulties": [
                "easy": ["layout_content": "easy layout", "time": 100],
                "hard": ["layout_content": "hard layout", "time": 80],
                "master": ["layout_content": "master layout", "time": 60],
            ],
        ]
        let transferred = try BluetoothMatchService.mapForMatch(source, difficulty: "master")
        XCTAssertEqual(transferred["id"] as? String, "local-map")
        XCTAssertEqual(transferred["official"] as? Bool, false)
        let levels = try XCTUnwrap(transferred["difficulties"] as? [String: [String: Any]])
        XCTAssertEqual(Set(levels.keys), ["master"])
        XCTAssertEqual(levels["master"]?["layout_content"] as? String, "master layout")
        XCTAssertEqual((source["difficulties"] as? [String: Any])?.count, 3)
        XCTAssertThrowsError(try BluetoothMatchService.mapForMatch(source, difficulty: "missing"))
        let bytes = try JSONSerialization.data(withJSONObject: transferred)
        let decoder = BLEReassembler()
        var received: Data?
        for frame in BLEFrames.encode(bytes, id: 18, capacity: 20) {
            if let packet = decoder.accept(frame) { received = packet }
        }
        XCTAssertEqual(received, bytes)
    }
}
