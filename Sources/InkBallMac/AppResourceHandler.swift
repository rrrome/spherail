import Foundation
import WebKit
import UniformTypeIdentifiers

/// One local origin for bundled pages, frames and WebGL textures; no HTTP server.
final class AppResourceHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spherail-resource"
    static let home = URL(string: "spherail-resource://app/index.html")!
    private static let macOneWayPaths: Set<String> = Set(["u", "d", "l", "r"].flatMap { direction in
        (0..<5).map { "/img/inkball/one_way_\(direction)\($0).png" }
    })
    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    }

    func resource(for url: URL) throws -> (data: Data, mimeType: String) {
        guard url.scheme == Self.scheme, url.host == "app", url.user == nil,
              url.password == nil, url.port == nil else { throw URLError(.unsupportedURL) }
        // All Mac previews, editor controls and 2D play share these requests.
        // Both desktop resource handlers resolve the twenty one-way sprites
        // to the same art, while leaving the other image requests unchanged.
        let path = Self.macOneWayPaths.contains(url.path)
            ? "/img/inkball/mac/\(url.lastPathComponent)" : url.path
        let file = root.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/") else { throw URLError(.noPermissionsToReadFile) }
        let mimeType: String
        switch file.pathExtension.lowercased() {
        case "js", "mjs": mimeType = "text/javascript"
        case "html": mimeType = "text/html"
        case "css": mimeType = "text/css"
        case "svg": mimeType = "image/svg+xml"
        case "webp": mimeType = "image/webp"
        default: mimeType = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
        return (try Data(contentsOf: file), mimeType)
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        do {
            guard let url = urlSchemeTask.request.url else { throw URLError(.badURL) }
            let content = try resource(for: url)
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": content.mimeType,
                "Access-Control-Allow-Origin": "*",
                "X-Content-Type-Options": "nosniff",
            ])!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(content.data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Responses above are synchronous; there is no outstanding work to cancel.
    }
}
