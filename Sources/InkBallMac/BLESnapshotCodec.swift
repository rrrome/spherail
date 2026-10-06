import Compression
import Foundation

/// Compresses only high-frequency game snapshots. Control packets remain plain JSON.
enum BLESnapshotCodec {
    private static let magic = Data("IBS1".utf8)
    private static let limit = 131_072

    static func encode(_ body: Data) -> Data {
        guard body.count >= 512, body.count <= limit else { return body }
        var output = [UInt8](repeating: 0, count: body.count)
        let written = body.withUnsafeBytes { source in
            compression_encode_buffer(&output, output.count,
                source.bindMemory(to: UInt8.self).baseAddress!, body.count,
                nil, COMPRESSION_LZFSE)
        }
        guard written > 0, written + 8 < body.count else { return body }
        var packet = magic
        var length = UInt32(body.count).littleEndian
        withUnsafeBytes(of: &length) { packet.append(contentsOf: $0) }
        packet.append(contentsOf: output.prefix(written))
        return packet
    }

    static func decode(_ packet: Data) -> Data? {
        guard packet.starts(with: magic) else { return packet }
        guard packet.count > 8 else { return nil }
        let size = packet.dropFirst(4).prefix(4).enumerated().reduce(UInt32(0)) {
            $0 | UInt32($1.element) << ($1.offset * 8)
        }
        guard size > 0, size <= limit else { return nil }
        var output = [UInt8](repeating: 0, count: Int(size))
        let compressed = packet.dropFirst(8)
        let written = compressed.withUnsafeBytes { source in
            compression_decode_buffer(&output, output.count,
                source.bindMemory(to: UInt8.self).baseAddress!, compressed.count,
                nil, COMPRESSION_LZFSE)
        }
        guard written == size else { return nil }
        return Data(output)
    }
}
