import Foundation
import XCTest
@testable import InkBallMac

final class AppResourceHandlerTests: XCTestCase {
    func testLocalResourcesAndContainment() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let web = root.appendingPathComponent("Web")
        try FileManager.default.createDirectory(at: web, withIntermediateDirectories: true)
        try Data("const example = true;".utf8).write(to: web.appendingPathComponent("test.js"))
        try Data("private".utf8).write(to: root.appendingPathComponent("private.txt"))
        try FileManager.default.createSymbolicLink(at: web.appendingPathComponent("escape.txt"), withDestinationURL: root.appendingPathComponent("private.txt"))
        let handler = AppResourceHandler(root: web)
        let resource = try handler.resource(for: URL(string: "spherail-resource://app/test.js?v=1")!)
        XCTAssertEqual(resource.mimeType, "text/javascript")
        XCTAssertEqual(String(decoding: resource.data, as: UTF8.self), "const example = true;")
        for path in ["spherail-resource://app/../private.txt", "spherail-resource://app/%2e%2e/private.txt", "spherail-resource://app/escape.txt", "spherail-resource://other/test.js", "https://app/test.js"] {
            XCTAssertThrowsError(try handler.resource(for: URL(string: path)!))
        }
    }
}
