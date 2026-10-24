import AppKit
import WebKit
import XCTest
@testable import InkBallMac

extension WebSmokeTests {
    func testProfileVersionAndOfflineThreeDPlay() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let web = root.appendingPathComponent("Web", isDirectory: true)
        config.setURLSchemeHandler(AppResourceHandler(root: web), forURLScheme: AppResourceHandler.scheme)
        let bridge = MockBridge()
        config.userContentController.add(bridge, name: "inkball")
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        let window = NSWindow(contentRect: webView.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = webView
        NSApplication.shared.setActivationPolicy(.regular)
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        defer { window.orderOut(nil); webView.loadHTMLString("", baseURL: nil) }
        let loaded = expectation(description: "3D host loads")
        let nav = Navigation(loaded)
        webView.navigationDelegate = nav
        webView.load(URLRequest(url: AppResourceHandler.home))
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.querySelectorAll('#official-map-list .map-card').length===30")
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click()")
        let shownVersion = try await evaluate(webView, "document.querySelector('#profile-version').textContent") as? String
        XCTAssertEqual(shownVersion, "v9.8.7")
        let versionAtLeft = try await evaluate(webView, "document.querySelector('#profile-version').getBoundingClientRect().left < document.querySelector('#profile-save').getBoundingClientRect().left") as? Bool
        XCTAssertEqual(versionAtLeft, true)
        _ = try await evaluate(webView, "document.querySelector('[data-close=profile-dialog]').click(); document.querySelector('#official-map-list .map-card[data-map-slug=showcase]').click(); document.querySelector('#detail-3d-toggle').click();")
        for _ in 0..<200 {
            if (try await evaluate(webView, "document.querySelector('#detail-view').classList.contains('is-3d-frame-ready')") as? Bool) == true { break }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        let health = try await evaluate(webView, "(() => { const f=document.querySelector('#detail-3d-frame'),w=f.contentWindow,r=w.document.querySelector('[data-prototype-3d]'); return JSON.stringify({root:document.querySelector('#detail-view').className,status:document.querySelector('#detail-3d-status').textContent,stage:r?.dataset.rendererStage,error:r?.dataset.renderError,runtime:!!w.Inkball3D,triangles:w.Inkball3D?.renderer.info.render.triangles,scripts:Array.from(w.document.scripts).map(s=>s.src)}); })()") as? String
        guard (try await evaluate(webView, "document.querySelector('#detail-view').classList.contains('is-3d-render')") as? Bool) == true else {
            XCTFail("3D preview did not become ready: \(health ?? "nil")")
            return
        }
        let duelDisabled = try await evaluate(webView, "document.querySelector('#detail-duel').disabled") as? Bool
        XCTAssertEqual(duelDisabled, true)
        _ = try await evaluate(webView, "window.threeFrame=document.querySelector('#detail-3d-frame').contentWindow; true")
        try await awaitTrue(webView, "!!threeFrame.Inkball3D?.renderer && threeFrame.Inkball3D.renderer.info.render.triangles>0 && threeFrame.Inkball3D.texturesLoaded()")
        for difficulty in ["hard", "master", "easy"] {
            _ = try await evaluate(webView, "document.querySelector('[data-detail-difficulty=\(difficulty)]').click()")
            try await awaitTrue(webView, "JSON.parse(threeFrame.document.querySelector('#inkball-3d-map').textContent).selected.map==='showcase' && threeFrame.Inkball3D.level.levelConfig.time===INKBALL_OFFICIAL.maps[0].difficulties.\(difficulty).time")
        }
        _ = try await evaluate(webView, "document.querySelector('#detail-start').click()")
        try await awaitTrue(webView, "threeFrame.Inkball3D.started && document.body.classList.contains('is-3d-playing')")
        _ = try await evaluate(webView, "threeFrame.document.querySelector('[data-prototype-camera-lock]').click(); threeFrame.document.querySelector('[data-prototype-tool=erase]').click(); threeFrame.document.querySelector('[data-prototype-pause-open]').click()")
        try await awaitTrue(webView, "threeFrame.Inkball3D.cameraLocked && threeFrame.Inkball3D.drawTool==='erase' && threeFrame.Inkball3D.paused && threeFrame.document.querySelector('[data-prototype-pause-overlay]').open")
        _ = try await evaluate(webView, "threeFrame.document.querySelector('[data-prototype-pause-resume]').click()")
        try await awaitTrue(webView, "!threeFrame.Inkball3D.paused")
        _ = try await evaluate(webView, "window.beforeClock=threeFrame.Inkball3D.level.levelTimer")
        try await awaitTrue(webView, "threeFrame.Inkball3D.level.levelTimer < beforeClock")
        let drawing = try await evaluate(webView, """
            (() => {
              const w=threeFrame, game=w.Inkball3D, canvas=w.document.querySelector('[data-prototype-canvas]');
              game.setTool('draw'); game.renderFrame();
              const programs=new Set(game.renderer.info.programs);
              const capture=canvas.setPointerCapture; canvas.setPointerCapture=()=>{};
              const rect=canvas.getBoundingClientRect();
              function point(x,y) {
                const v=game.camera.position.clone().set(x/32-9,.2,(y-64)/32-9).project(game.camera);
                return {clientX:rect.left+(v.x+1)/2*rect.width,clientY:rect.top+(1-v.y)/2*rect.height};
              }
              function send(type,position) { canvas.dispatchEvent(new w.PointerEvent(type,{...position,pointerId:73,pointerType:'mouse',button:0,bubbles:true})); }
              send('pointerdown',point(256,320)); send('pointermove',point(288,352)); game.renderFrame();
              send('pointermove',point(304,352)); game.renderFrame(); send('pointerup',point(304,352));
              const newPrograms=game.renderer.info.programs.filter(program=>!programs.has(program)).length;
              const drawn=game.level.lines.length===1 && game.app.linesDrawn===1;
              game.setTool('erase'); send('pointerdown',point(272,336)); send('pointerup',point(272,336));
              const erased=game.level.lines.length===0;
              canvas.setPointerCapture=capture;
              return {drawn,erased,newPrograms};
            })()
            """) as? [String: Any]
        XCTAssertEqual(drawing?["drawn"] as? Bool, true, "Drawing must raycast into the 3D board")
        XCTAssertEqual(drawing?["erased"] as? Bool, true, "Erasing must raycast into the 3D board")
        XCTAssertEqual(drawing?["newPrograms"] as? Int, 0, "The first straight and curved stroke must reuse precompiled GPU programs")
        _ = try await evaluate(webView, "threeFrame.Inkball3D.app.score=321; threeFrame.Inkball3D.app.correctCaptures=2; threeFrame.Inkball3D.app.wrongCaptures=1; threeFrame.Inkball3D.app.linesDrawn=7; threeFrame.Inkball3D.level.timeUp=false; threeFrame.Inkball3D.app.isLevelEnded=true")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-score').textContent==='321'")
        XCTAssertEqual(bridge.recordedResults.last?["mapID"] as? String, "showcase")
        XCTAssertEqual(bridge.recordedResults.last?["lines"] as? Int, 7)
        _ = try await evaluate(webView, "document.querySelector('#result-again').click()")
        for _ in 0..<400 {
            if (try await evaluate(webView, "document.querySelector('#detail-3d-frame').contentWindow.Inkball3D?.started===true") as? Bool) == true { break }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        try await awaitTrue(webView, "document.body.classList.contains('is-3d-playing')")
        _ = try await evaluate(webView, "document.querySelector('#detail-3d-frame').contentWindow.document.querySelector('[data-prototype-pause-home]').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden && !document.body.classList.contains('is-3d-playing')")
        for mapID in ["spectrum-gates", "shifting-hours", "cascade-junction"] {
            _ = try await evaluate(webView, "document.querySelector('#official-map-list .map-card[data-map-slug=\(mapID)]').click(); document.querySelector('[data-detail-difficulty=master]').click(); document.querySelector('#detail-3d-toggle').click()")
            var mapReady = false
            for _ in 0..<400 {
                if (try await evaluate(webView, "document.querySelector('#detail-view').classList.contains('is-3d-render') && document.querySelector('#detail-3d-frame').contentWindow.Inkball3D?.selection.difficulty==='master'") as? Bool) == true { mapReady = true; break }
                if (try await evaluate(webView, "!!document.querySelector('#detail-3d-status').dataset.error") as? Bool) == true { break }
                try await Task.sleep(nanoseconds: 50_000_000)
            }
            let mapHealth = try await evaluate(webView, "JSON.stringify({map:'\(mapID)',status:document.querySelector('#detail-3d-status').dataset.error,src:document.querySelector('#detail-3d-frame').src,frameState:document.querySelector('#detail-3d-frame').contentDocument?.readyState,mode:document.querySelector('#detail-3d-toggle').textContent,stage:document.querySelector('#detail-3d-frame').contentDocument?.querySelector('[data-prototype-3d]')?.dataset.rendererStage,selected:document.querySelector('#detail-3d-frame').contentWindow.Inkball3D?.selection})") as? String
            XCTAssertTrue(mapReady, mapHealth ?? mapID)
            _ = try await evaluate(webView, "document.querySelector('#detail-back').click()")
            try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        }
        _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click(); document.querySelector('#personal-map-list article .workshop-card__preview').click(); document.querySelector('#detail-3d-toggle').click()")
        try await awaitTrue(webView, "document.querySelector('#detail-view').classList.contains('is-3d-render')")
        _ = try await evaluate(webView, "window.customFrame=document.querySelector('#detail-3d-frame').contentWindow; true")
        let personal = try await evaluate(webView, "JSON.parse(customFrame.document.querySelector('#inkball-3d-map').textContent).selected.personalMap") as? Bool
        XCTAssertEqual(personal, true)
        _ = try await evaluate(webView, "document.querySelector('[data-detail-difficulty=hard]').click(); document.querySelector('[data-detail-difficulty=master]').click()")
        try await awaitTrue(webView, "customFrame.Inkball3D.selection.difficulty==='master'")
        _ = try await evaluate(webView, "document.querySelector('#detail-3d-toggle').click()")
        let twoD = try await evaluate(webView, "!document.querySelector('#detail-view').classList.contains('is-3d-render') && !document.querySelector('#detail-duel').disabled && document.querySelector('#detail-3d-toggle').textContent==='3D'") as? Bool
        XCTAssertEqual(twoD, true)
        _ = try await evaluate(webView, "document.querySelector('#detail-3d-toggle').click(); document.querySelector('#detail-start').click()")
        try await awaitTrue(webView, "customFrame.Inkball3D.started")
        _ = try await evaluate(webView, "customFrame.Inkball3D.app.score=222; customFrame.Inkball3D.level.timeUp=true; customFrame.Inkball3D.app.isLevelEnded=true")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-score').textContent==='222'")
        XCTAssertEqual(bridge.recordedResults.last?["mapID"] as? String, "beta")
        XCTAssertEqual(bridge.recordedResults.last?["difficulty"] as? String, "master")
    }
}
