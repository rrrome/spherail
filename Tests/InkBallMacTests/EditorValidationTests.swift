import AppKit
import WebKit
import XCTest

extension WebSmokeTests {
    func testServeQueueRequiresSpawnPointBeforeSavingOrPlaytesting() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        let bridge = MockBridge()
        config.userContentController.add(bridge, name: "inkball")
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        let loaded = expectation(description: "Editor validation page loads")
        let navigation = Navigation(loaded)
        webView.navigationDelegate = navigation
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let web = root.appendingPathComponent("Web", isDirectory: true)
        webView.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.querySelector('[data-carousel-total]').textContent==='/ 10'")
        _ = try await evaluate(webView, """
            document.querySelector('[data-route=personal]').click();
            document.querySelector('#personal-create').click();
            document.querySelector('#editor-name').value='Queue validation';
            window.placeTestTile=(token,x,y)=>{
              document.querySelector(`.community-palette__item[data-token=${token}]`).click();
              const canvas=document.querySelector('#editor-board'), rect=canvas.getBoundingClientRect();
              canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,
                clientX:rect.left+rect.width*(x+.5)/18,clientY:rect.top+rect.height*(y+.5)/18}));
            };
            placeTestTile('H',4,4);
            document.querySelector('#editor-serve-source button').click();
            document.querySelector('#editor-save').click();
            """)
        let message = "萌新：发球顺序中有小球时，至少放置一个发球点。"
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent==='\(message)'")
        XCTAssertNil(bridge.savedMap)
        _ = try await evaluate(webView, "document.querySelector('#editor-status').textContent=''; document.querySelector('#editor-playtest').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent==='\(message)' && !document.querySelector('#editor-view').hidden && document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "placeTestTile('S',2,2); document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent==='已保存在本机。'")
        XCTAssertNotNil(bridge.savedMap)

        // An inactive difficulty must also have its own spawn point.
        bridge.savedMap = nil
        _ = try await evaluate(webView, """
            document.querySelector('[data-difficulty=hard]').click();
            placeTestTile('H',4,4);
            document.querySelector('#editor-serve-source button').click();
            document.querySelector('[data-difficulty=easy]').click();
            document.querySelector('#editor-save').click();
            """)
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent==='进阶：发球顺序中有小球时，至少放置一个发球点。'")
        XCTAssertNil(bridge.savedMap)

        // An empty queue with a ball already on the board is valid without a spawn point.
        _ = try await evaluate(webView, """
            document.querySelector('[data-difficulty=hard]').click();
            document.querySelector('#editor-serve-list button').click();
            placeTestTile('B',2,2);
            document.querySelector('#editor-save').click();
            """)
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent==='已保存在本机。'")
        let levels = try XCTUnwrap(bridge.savedMap?["difficulties"] as? [String: [String: Any]])
        XCTAssertEqual(levels["hard"]?["balls"] as? [String], [])
        XCTAssertFalse((levels["hard"]?["layout_content"] as? String ?? "").contains("S"))
    }
}
