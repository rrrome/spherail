import AppKit
import WebKit
import Foundation
import UniformTypeIdentifiers

@main
struct InkBallMain {
    static func main() {
        let application = NSApplication.shared
        let delegate = InkBallAppDelegate()
        application.delegate = delegate
        application.setActivationPolicy(.regular)
        application.run()
    }
}

final class InkBallAppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var bridge: AppBridge!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.mainMenu = InkBallMenus.mainMenu()

        guard let webFolder = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true) else { return }
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(AppResourceHandler(root: webFolder), forURLScheme: AppResourceHandler.scheme)
        let content = WKUserContentController()
        config.userContentController = content
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.underPageBackgroundColor = NSColor(red: 0.09, green: 0.24, blue: 0.25, alpha: 1)

        do {
            bridge = try AppBridge(webView: webView)
        } catch {
            let alert = NSAlert(error: error)
            alert.runModal()
            NSApplication.shared.terminate(nil)
            return
        }
        content.add(bridge, name: "inkball")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1100, height: 780),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false
        )
        window.title = "Spherail"
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.minSize = NSSize(width: 720, height: 580)
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)

        webView.load(URLRequest(url: AppResourceHandler.home))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url,
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            decisionHandler(.allow)
            return
        }
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("Spherail WebKit navigation failed: %@", error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("Spherail WebKit page failed: %@", error.localizedDescription)
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }
}

enum InkBallMenus {
    static func mainMenu() -> NSMenu {
        let menu = NSMenu()
        let appMenu = NSMenu(title: "Spherail")
        appMenu.addItem(withTitle: "Quit Spherail", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let appItem = NSMenuItem(title: "Spherail", action: nil, keyEquivalent: "")
        appItem.submenu = appMenu
        menu.addItem(appItem)

        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let editItem = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        editItem.submenu = editMenu
        menu.addItem(editItem)
        return menu
    }
}

final class AppBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private let store: LocalStore
    private let bluetooth = BluetoothMatchService()

    init(webView: WKWebView) throws {
        self.webView = webView
        self.store = try LocalStore()
        super.init()
        bluetooth.profile = { [weak self] in (try? self?.store.profile()) ?? [:] }
        bluetooth.onEvent = { [weak self] event, payload in
            self?.emit(event, payload)
        }
    }

    private func script(_ value: [String: Any], method: String) {
        guard JSONSerialization.isValidJSONObject(value),
              let bytes = try? JSONSerialization.data(withJSONObject: value),
              let json = String(data: bytes, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.InkBallNative && InkBallNative.\(method)(\(json));") { _, error in
            if let error { NSLog("Spherail bridge: %@", error.localizedDescription) }
        }
    }

    private func emit(_ event: String, _ payload: [String: Any] = [:]) {
        script(["event": event, "data": payload], method: "emit")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let id = body["id"] as? Int,
              let action = body["action"] as? String else { return }
        let payload = body["payload"] as? [String: Any] ?? [:]
        do {
            let result = try handle(action, payload)
            script(["id": id, "result": result], method: "receive")
        } catch {
            script(["id": id, "error": error.localizedDescription], method: "receive")
        }
    }

    private func handle(_ action: String, _ data: [String: Any]) throws -> [String: Any] {
        switch action {
        case "bootstrap":
            bluetooth.startDiscovery()
            return ["appInfo": ["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Development",
                                "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""],
                    "profile": try store.profile(), "maps": try store.maps(),
                    "records": try store.records(), "achievements": try store.achievements(),
                    "match": bluetooth.state()]
        case "profile": return try store.profile()
        case "updateLanguage": return try store.updateLanguage(data["language"] as? String ?? "")
        case "updateProfile":
            let updated = try store.updateProfile(name: data["name"] as? String ?? "",
                                                  avatarData: data["avatarData"] as? String ?? "",
                                                  detailTransparency: data["detailTransparency"] as? Int)
            bluetooth.updateLocalProfile()
            return updated
        case "maps": return ["maps": try store.maps()]
        case "map": return try store.map(id: data["id"] as? String ?? "")
        case "saveMap":
            guard let map = data["map"] as? [String: Any] else { throw StoreError.invalid("Invalid map.") }
            return try store.saveMap(map)
        case "deleteMap":
            try store.deleteMap(id: data["id"] as? String ?? "")
            return ["ok": true]
        case "exportMap":
            if let officialMap = data["map"] as? [String: Any] {
                return ["code": try store.exportCode(officialMap: officialMap)]
            }
            return ["code": try store.exportCode(id: data["id"] as? String ?? "")]
        case "importMap": return try store.importCode(data["code"] as? String ?? "")
        case "exportDifficultyCode":
            guard let level = data["level"] as? [String: Any] else { throw StoreError.invalid("Invalid difficulty.") }
            return ["code": try store.exportDifficultyCode(level: level, author: data["author"] as? String ?? "")]
        case "importDifficultyCode":
            return ["level": try store.importDifficultyCode(data["code"] as? String ?? "")]
        case "recordResult":
            return try store.recordResult(
                mapID: data["mapID"] as? String ?? "",
                difficulty: data["difficulty"] as? String ?? "",
                score: data["score"] as? Int ?? 0,
                cleared: data["cleared"] as? Bool ?? false,
                duration: data["duration"] as? Int ?? 0,
                correct: data["correct"] as? Int ?? 0,
                wrong: data["wrong"] as? Int ?? 0,
                lines: data["lines"] as? Int ?? 0
            )
        case "copyText":
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(data["text"] as? String ?? "", forType: .string)
            return ["ok": true]
        case "matchState": return bluetooth.state()
        case "matchInvite":
            guard let map = data["map"] as? [String: Any] else { throw StoreError.invalid("Invalid map.") }
            try bluetooth.invite(data["id"] as? String ?? "", map: map,
                                 difficulty: data["difficulty"] as? String ?? "easy")
            return bluetooth.state()
        case "matchAccept": try bluetooth.accept(); return bluetooth.state()
        case "matchDecline": bluetooth.decline(); return bluetooth.state()
        case "openBluetoothSettings":
            if let url = URL(string: "x-apple.systempreferences:com.apple.Bluetooth") {
                NSWorkspace.shared.open(url)
            }
            return ["ok": true]
        case "matchSend":
            if let snapshot = data["snapshot"] as? [String: Any] { bluetooth.sendSnapshot(snapshot) }
            return ["ok": true]
        case "matchFinish": bluetooth.finish(data); return bluetooth.state()
        case "matchLeave": bluetooth.leave(); return bluetooth.state()
        default: throw StoreError.invalid("Unknown app command.")
        }
    }
}
