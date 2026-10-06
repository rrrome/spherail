import Foundation

/// Chunks one logical BLE message without assuming a fixed negotiated ATT size.
enum BLEFrames {
    static func encode(_ body: Data, id: UInt32, capacity: Int) -> [Data] {
        let size = max(1, capacity - 8)
        let count = (body.count + size - 1) / size
        guard count > 0, count <= 4096 else { return [] }
        return (0..<count).map { part in
            var frame = Data()
            var messageID = id.littleEndian
            var index = UInt16(part).littleEndian
            var total = UInt16(count).littleEndian
            withUnsafeBytes(of: &messageID) { frame.append(contentsOf: $0) }
            withUnsafeBytes(of: &index) { frame.append(contentsOf: $0) }
            withUnsafeBytes(of: &total) { frame.append(contentsOf: $0) }
            frame.append(body.subdata(in: (part * size)..<min(body.count, (part + 1) * size)))
            return frame
        }
    }
}

final class BLEReassembler {
    private var assembling: [UInt32: [Int: Data]] = [:]
    private var expectedParts: [UInt32: Int] = [:]

    func reset() {
        assembling.removeAll()
        expectedParts.removeAll()
    }

    func accept(_ data: Data) -> Data? {
        guard data.count >= 8, data.count <= 2048 else { return nil }
        let bytes = [UInt8](data)
        let id = UInt32(bytes[0]) | UInt32(bytes[1]) << 8 | UInt32(bytes[2]) << 16 | UInt32(bytes[3]) << 24
        let index = Int(UInt16(bytes[4]) | UInt16(bytes[5]) << 8)
        let total = Int(UInt16(bytes[6]) | UInt16(bytes[7]) << 8)
        guard total > 0, total <= 4096, index < total else { return nil }
        if expectedParts[id] == nil {
            if assembling.count >= 8 { reset() }
            expectedParts[id] = total
            assembling[id] = [:]
        }
        guard expectedParts[id] == total else { return nil }
        assembling[id]?[index] = data.dropFirst(8)
        guard let parts = assembling[id], parts.count == total else { return nil }
        assembling[id] = nil
        expectedParts[id] = nil
        var message = Data()
        for part in 0..<total { if let chunk = parts[part] { message.append(chunk) } }
        return message.count <= 131_072 ? message : nil
    }
}
