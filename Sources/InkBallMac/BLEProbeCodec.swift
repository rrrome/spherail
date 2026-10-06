import Foundation

/// One ATT frame at the minimum 20-byte payload, including BLEFrames' header.
enum BLEProbeCodec {
    enum Kind: UInt8 { case ping = 0x70, pong = 0x71, leave = 0x72 }

    static func encode(_ kind: Kind, token: UInt64) -> Data {
        var body = Data([kind.rawValue])
        var value = token.littleEndian
        withUnsafeBytes(of: &value) { body.append(contentsOf: $0) }
        return body
    }

    static func decode(_ body: Data) -> (kind: Kind, token: UInt64)? {
        guard body.count == 9, let kind = Kind(rawValue: body[body.startIndex]) else { return nil }
        let token = body.dropFirst().enumerated().reduce(UInt64(0)) {
            $0 | UInt64($1.element) << ($1.offset * 8)
        }
        return (kind, token)
    }
}
