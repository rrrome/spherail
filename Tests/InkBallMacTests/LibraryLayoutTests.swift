import AppKit
import WebKit
import XCTest

extension WebSmokeTests {
    func testWorkshopEmptyCardPinnedControlsAndMovingHighlight() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        let bridge = MockBridge()
        config.userContentController.add(bridge, name: "inkball")
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        let loaded = expectation(description: "Library page loads")
        let nav = Navigation(loaded)
        webView.navigationDelegate = nav
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let web = root.appendingPathComponent("Web", isDirectory: true)
        webView.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.querySelector('.app-nav-highlight').dataset.positioned==='true'")
        _ = try await evaluate(webView, "window.highlightBefore=document.querySelector('.app-nav-highlight').style.transform; document.querySelector('[data-route=personal]').click()")
        let highlightMoves = try await evaluate(webView, """
            (() => {
              const highlight=document.querySelector('.app-nav-highlight');
              return highlight.style.transform!==window.highlightBefore &&
                (matchMedia('(prefers-reduced-motion: reduce)').matches ||
                  getComputedStyle(highlight).transitionProperty.includes('transform'));
            })()
            """) as? Bool
        XCTAssertEqual(highlightMoves, true)
        try await awaitTrue(webView, "document.querySelector('#personal-view').getAnimations({subtree:true}).every(a=>a.playState==='finished')")
        try await awaitTrue(webView, "InkballAmbient.communityState?.().tab==='custom' && InkballAmbient.communityState().sprite?.endsWith('/ambient_diy.png')")
        let regularSize = try await evaluate(webView, """
            (() => {
              const create=document.querySelector('#personal-create').getBoundingClientRect();
              const regular=document.querySelector('#personal-map-list article').getBoundingClientRect();
              window.regularCardSize={width:regular.width,height:regular.height};
              return Math.abs(create.width-regular.width)<1 && Math.abs(create.height-regular.height)<1;
            })()
            """) as? Bool
        XCTAssertEqual(regularSize, true)
        for remaining in [1, 0] {
            _ = try await evaluate(webView, "document.querySelector('#personal-map-list article .workshop-card__delete').click(); document.querySelector('#delete-map-confirm').click()")
            try await awaitTrue(webView, "document.querySelectorAll('#personal-map-list article').length===\(remaining)")
        }
        let emptySize = try await evaluate(webView, """
            (() => {
              const create=document.querySelector('#personal-create').getBoundingClientRect();
              return Math.abs(create.width-window.regularCardSize.width)<1 &&
                Math.abs(create.height-window.regularCardSize.height)<1;
            })()
            """) as? Bool
        XCTAssertEqual(emptySize, true)
        webView.frame = NSRect(x: 0, y: 0, width: 1100, height: 320)
        _ = try await evaluate(webView, "document.body.scrollTop=150")
        try await awaitTrue(webView, "document.body.scrollTop>100")
        let pinned = try await evaluate(webView, """
            (() => {
              const header=document.querySelector('.app-header'), toolbar=document.querySelector('.workshop-toolbar');
              const hr=header.getBoundingClientRect(), tr=toolbar.getBoundingClientRect();
              return getComputedStyle(header).position==='sticky' && Math.abs(hr.top)<1 &&
                getComputedStyle(toolbar).position==='sticky' && Math.abs(tr.top-hr.bottom)<1;
            })()
            """) as? Bool
        XCTAssertEqual(pinned, true)
        _ = try await evaluate(webView, "document.querySelector('[data-route=maps]').click()")
        try await awaitTrue(webView, "document.body.scrollTop===0")
        try await awaitTrue(webView, "document.querySelector('.app-header nav').getAnimations({subtree:true}).every(a=>a.playState==='finished')")
        let aligned = try await evaluate(webView, """
            (() => {
              const highlight=document.querySelector('.app-nav-highlight').getBoundingClientRect();
              const active=document.querySelector('.app-header nav button.active').getBoundingClientRect();
              return Math.abs(highlight.left-active.left)<1 && Math.abs(highlight.width-active.width)<1;
            })()
            """) as? Bool
        XCTAssertEqual(aligned, true)
    }
}
