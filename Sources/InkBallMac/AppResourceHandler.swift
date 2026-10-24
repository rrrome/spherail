import Foundation
import WebKit
import UniformTypeIdentifiers

/// One local origin for bundled pages, frames and WebGL textures; no HTTP server.
final class AppResourceHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spherail-resource"
    static let home = URL(string: "spherail-resource://app/index.html")!
    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    }

    func resource(for url: URL) throws -> (data: Data, mimeType: String) {
        guard url.scheme == Self.scheme, url.host == "app", url.user == nil,
              url.password == nil, url.port == nil else { throw URLError(.unsupportedURL) }
        let file = root.appendingPathComponent(url.path).standardizedFileURL.resolvingSymlinksInPath()
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
