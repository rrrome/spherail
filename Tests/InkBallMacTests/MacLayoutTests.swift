import AppKit
import WebKit
import XCTest

extension WebSmokeTests {
    // Exercise the real WKWebView layout, including the native minimum window.
    // Optional snapshots are local review artifacts, never bundled resources.
    func testDesktopLayoutsFitWindowAndShareWindowsStyles() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        configureAppResources(config)
        let bridge = MockBridge()
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        config.userContentController.add(bridge, name: "inkball")
        let loaded = expectation(description: "Mac layout page loads")
        let navigation = Navigation(loaded)
        webView.navigationDelegate = navigation
        loadApp(webView)
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.querySelectorAll('#official-map-list .map-card').length===30")
        // Disable only the test's transition delays, keeping production motion intact.
        _ = try await evaluate(webView, """
            const reviewStyle=document.createElement('style');
            reviewStyle.textContent='*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}';
            document.head.append(reviewStyle);
            """)

        for language in ["zh", "en"] {
            _ = try await evaluate(webView, "InkballDesktopI18n.setLanguage('\(language)')")
            for (width, height) in [(720, 580), (1100, 780), (1440, 900)] {
                webView.frame = NSRect(x: 0, y: 0, width: width, height: height)
                _ = try await evaluate(webView, "document.querySelector('[data-route=maps]').click()")
                try await assertLayout(webView, """
                    const header=document.querySelector('.app-header').getBoundingClientRect();
                    const brand=document.querySelector('.brand').getBoundingClientRect();
                    const nav=document.querySelector('.app-header nav').getBoundingClientRect();
                    const profile=document.querySelector('#profile-open').getBoundingClientRect();
                    return brand.right<=nav.left && nav.right<=profile.left && profile.right<=innerWidth && header.height===76;
                    """, "Header \(language) \(width)x\(height)")
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "home") }

                _ = try await evaluate(webView, "document.querySelector('#official-map-list [data-map-index=\"1\"]').click()")
                try await awaitTrue(webView, "!document.querySelector('#detail-view').classList.contains('is-map-entering')")
                for difficulty in ["easy", "hard", "master"] {
                    _ = try await evaluate(webView, "document.querySelector('#detail-difficulties [data-detail-difficulty=\(difficulty)]').click()")
                    try await assertLayout(webView, """
                        const panels=[...document.querySelectorAll('.map-detail__grid>.map-panel')].filter(p=>!p.hidden);
                        const box=document.querySelector('.map-achievements').getBoundingClientRect();
                        const list=document.querySelector('#detail-achievements').getBoundingClientRect();
                        return panels.length===3 && panels.every(p=>{
                          const r=p.getBoundingClientRect();
                          return r.height===256 && r.left>=0 && r.right<=innerWidth && p.scrollHeight<=p.clientHeight+1;
                        }) && Math.abs((list.top+list.bottom)/2-(box.top+box.bottom)/2)<1 &&
                        [...document.querySelectorAll('.map-achievement')].every(p=>{
                          const r=p.getBoundingClientRect(), box=p.closest('.map-panel').getBoundingClientRect();
                          return r.bottom<=box.bottom && r.right<=box.right;
                        });
                        """, "Briefing \(language) \(difficulty) \(width)x\(height)")
                }
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "detail") }
                _ = try await evaluate(webView, "document.querySelector('#detail-duel').click()")
                try await awaitTrue(webView, "!document.querySelector('#match-view').hidden")
                try await assertLayout(webView, """
                    const title=document.querySelector('#match-view .section-heading').getBoundingClientRect();
                    const panel=document.querySelector('.match-setup').getBoundingClientRect();
                    return Math.abs(title.left-panel.left)<1 && Math.abs(title.right-panel.right)<1 && panel.right<=innerWidth;
                    """, "Match \(language) \(width)x\(height)")
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "match") }
                _ = try await evaluate(webView, "document.querySelector('#match-leave').click()")
                try await awaitTrue(webView, "document.querySelector('#match-view').hidden")
                _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click()")
                try await awaitTrue(webView, "!document.querySelector('#personal-view').hidden")
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "workshop") }
                _ = try await evaluate(webView, "document.querySelector('#profile-open').click()")
                try await assertLayout(webView, """
                    const dialog=document.querySelector('#profile-dialog'), r=dialog.getBoundingClientRect();
                    const save=document.querySelector('#profile-save').getBoundingClientRect();
                    return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && dialog.scrollWidth<=dialog.clientWidth+1 &&
                      save.top>=r.top && save.bottom<=r.bottom;
                    """, "Profile \(language) \(width)x\(height)")
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "profile") }
                _ = try await evaluate(webView, "document.querySelector('[data-close=profile-dialog]').click(); document.querySelector('#personal-create').click()")
                try await awaitTrue(webView, "!document.querySelector('#editor-view').hidden")
                try await assertLayout(webView, """
                    const palette=document.querySelector('.community-palette').getBoundingClientRect();
                    const board=document.querySelector('#editor-board').getBoundingClientRect();
                    const settings=document.querySelector('.community-settings').getBoundingClientRect();
                    const body=document.querySelector('.community-body');
                    const history=document.querySelector('.community-edit-history').getBoundingClientRect();
                    const tools=document.querySelector('.community-edit-tools').getBoundingClientRect();
                    return palette.left>=0 && palette.right<board.left && board.right<settings.left && settings.right<=innerWidth &&
                      board.width>=240 && board.bottom<history.top && palette.bottom<history.top && settings.bottom<history.top &&
                      tools.right<history.left && body.scrollWidth<=body.clientWidth+1;
                    """, "Editor \(language) \(width)x\(height)")
                if language == "zh" && width == 1100 { try await saveLayoutSnapshot(webView, "editor") }
                _ = try await evaluate(webView, "document.querySelector('#editor-back').click()")
            }
        }

        _ = try await evaluate(webView, "document.documentElement.dataset.platform='windows'; document.querySelector('#official-map-list [data-map-index=\"1\"]').click()")
        try await assertLayout(webView, """
            return getComputedStyle(document.querySelector('.app-header')).display==='grid' &&
              [...document.querySelectorAll('.map-detail__grid>.map-panel')].filter(p=>!p.hidden).every(p=>p.getBoundingClientRect().height===256);
            """, "Windows shares the Mac desktop layout")

        _ = try await evaluate(webView, "delete document.documentElement.dataset.platform; InkballDesktopI18n.setLanguage('zh'); document.querySelector('#detail-start').click()")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        webView.frame = NSRect(x: 0, y: 0, width: 1100, height: 780)
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click()")
        try await awaitTrue(webView, "document.querySelector('[data-pause-overlay]').open")
        try await saveLayoutSnapshot(webView, "pause")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-resume]').click(); window.inkballApp._finishAttempt(false)")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && !document.querySelector('#result-view').classList.contains('is-result-handoff')")
        for (width, height) in [(720, 580), (1100, 780), (1440, 900)] {
            webView.frame = NSRect(x: 0, y: 0, width: width, height: height)
            try await assertLayout(webView, """
                const card=document.querySelector('#result-board').getBoundingClientRect();
                const content=document.querySelector('.result-card__content').getBoundingClientRect();
                const buttons=[...document.querySelectorAll('.result-btn')].map(b=>b.getBoundingClientRect());
                return content.top>=card.top && content.bottom<=card.bottom && content.left>=card.left && content.right<=card.right &&
                  buttons.every(b=>b.top>card.bottom && b.bottom<=innerHeight && b.left>=0 && b.right<=innerWidth);
                """, "Result \(width)x\(height)")
            if width != 1440 { try await saveLayoutSnapshot(webView, "result-\(width)") }
        }
    }

    private func assertLayout(_ webView: WKWebView, _ script: String, _ context: String) async throws {
        _ = try await evaluate(webView, "document.getAnimations().forEach(a=>{if(a.effect?.getComputedTiming().iterations!==Infinity)try{a.finish()}catch{}})")
        let result = try await evaluate(webView, "(() => { \(script) })()") as? Bool
        if result != true {
            let geometry = try await evaluate(webView, "JSON.stringify(Object.fromEntries(['.community-top','.community-body','.community-palette','#editor-board','.community-settings','.community-edit-history','.community-edit-tools'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()])))") as? String
            XCTFail("\(context): \(geometry ?? "missing geometry")")
        }
    }

    private func saveLayoutSnapshot(_ webView: WKWebView, _ name: String) async throws {
        guard let folder = ProcessInfo.processInfo.environment["INKBALL_LAYOUT_SNAPSHOTS"] else { return }
        _ = try await evaluate(webView, "document.getAnimations().forEach(a=>{if(a.effect?.getComputedTiming().iterations!==Infinity)try{a.finish()}catch{}})")
        try await Task.sleep(nanoseconds: 100_000_000)
        let directory = URL(fileURLWithPath: folder, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let image: NSImage = try await withCheckedThrowingContinuation { continuation in
            webView.takeSnapshot(with: nil) { image, error in
                if let image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? NSError(domain: "LayoutSnapshot", code: 1)) }
            }
        }
        let tiff = try XCTUnwrap(image.tiffRepresentation)
        let bitmap = try XCTUnwrap(NSBitmapImageRep(data: tiff))
        let png = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
        try png.write(to: directory.appendingPathComponent("\(name).png"))
    }
}
