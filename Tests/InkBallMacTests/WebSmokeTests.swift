import AppKit
import WebKit
import XCTest
@testable import InkBallMac

@MainActor
final class WebSmokeTests: XCTestCase {
    func testMainMenuProvidesPasteShortcut() {
        let menu = InkBallMenus.mainMenu()
        XCTAssertEqual(menu.items.first?.title, "Spherail")
        XCTAssertEqual(menu.items.first?.submenu?.items.first?.title, "Quit Spherail")
        let editMenu = menu.items.first { $0.title == "Edit" }?.submenu
        let paste = editMenu?.items.first { $0.title == "Paste" }
        XCTAssertEqual(paste?.action, #selector(NSText.paste(_:)))
        XCTAssertEqual(paste?.keyEquivalent, "v")
        XCTAssertEqual(paste?.keyEquivalentModifierMask, [.command])
        XCTAssertNil(paste?.target)
    }

    final class MockBridge: NSObject, WKScriptMessageHandler {
        weak var webView: WKWebView?
        var savedMap: [String: Any]?
        var copiedText: String?
        var deletedMapIDs: [String] = []
        var invitedPeerID: String?
        var invitedDifficulty: String?
        var invitedMapID: String?
        var playerLanguage = "zh"
        var detailTransparency = 20
        var playerAvatarData = ""
        var resolveAfterPeerLeave = false

        private func sampleMap(_ id: String, _ name: String, _ updatedAt: String) -> [String: Any] {
            let border = String(repeating: "X ", count: 18)
            let middle = "X " + String(repeating: "  ", count: 16) + "X "
            let source = "X S " + String(repeating: "  ", count: 15) + "X "
            let layout = ([border, source] + Array(repeating: middle, count: 15) + [border]).joined(separator: "\n")
            let level: [String: Any] = ["layout_content": layout, "time": 100, "spawn_interval": 4, "balls": ["grey"]]
            return ["id": id, "name": name, "official": false, "updatedAt": updatedAt,
                    "difficulties": ["easy": level, "hard": level, "master": level]]
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let id = body["id"] as? Int,
                  let action = body["action"] as? String else { return }
            let payload = body["payload"] as? [String: Any] ?? [:]
            let result: [String: Any]
            switch action {
            case "bootstrap":
                result = [
                    "profile": ["id": "test", "name": "player123456", "avatar": playerAvatarData.isEmpty ? "default" : "custom",
                                "avatarData": playerAvatarData, "language": playerLanguage, "detailTransparency": detailTransparency],
                    "maps": [sampleMap("alpha", "Alpha Map", "2026-01-01T00:00:00Z"),
                             sampleMap("beta", "Beta Map", "2026-02-01T00:00:00Z")], "records": [:],
                    "achievements": [:],
                    "match": ["mode": "idle", "phase": "idle", "connected": false],
                ]
            case "saveMap":
                var map = payload["map"] as? [String: Any] ?? [:]
                savedMap = map
                map["id"] = "test-map"
                map["official"] = false
                map["updatedAt"] = "2026-03-01T00:00:00.123Z"
                result = map
            case "exportMap":
                if let map = payload["map"] as? [String: Any],
                   let encoded = try? JSONSerialization.data(withJSONObject: ["format": "INKBALL-MAP", "version": 1, "map": map]),
                   let body = String(data: encoded, encoding: .utf8) {
                    result = ["code": "INKBALL-MAP/1\n" + body]
                } else {
                    result = ["code": "INKBALL-MAP/1\n\(payload["id"] as? String ?? "")"]
                }
            case "exportDifficultyCode":
                let level = payload["level"] as? [String: Any] ?? [:]
                let body: [String: Any] = ["format": "inkball-map", "version": 2,
                    "layout": level["layout_content"] ?? "", "balls": level["balls"] ?? [],
                    "serve_interval": level["spawn_interval"] ?? 0, "total_time": level["time"] ?? 0,
                    "author_history": [payload["author"] as? String ?? ""]]
                let encoded = try? JSONSerialization.data(withJSONObject: body)
                result = ["code": "INKBALL-LEVEL/1\n" + String(decoding: encoded ?? Data(), as: UTF8.self)]
            case "importDifficultyCode":
                let code = payload["code"] as? String ?? ""
                let body = code.dropFirst("INKBALL-LEVEL/1\n".count)
                let decoded = (try? JSONSerialization.jsonObject(with: Data(body.utf8))) as? [String: Any] ?? [:]
                result = ["level": ["layout_content": decoded["layout"] ?? "", "balls": decoded["balls"] ?? [],
                    "spawn_interval": decoded["serve_interval"] ?? 0, "time": decoded["total_time"] ?? 0,
                    "author_history": decoded["author_history"] ?? []]]
            case "importMap":
                result = sampleMap("alpha", "Alpha Map", "2026-01-01T00:00:00Z")
            case "copyText":
                copiedText = payload["text"] as? String
                result = ["ok": true]
            case "updateLanguage":
                playerLanguage = payload["language"] as? String ?? "zh"
                result = ["id": "test", "name": "player123456", "avatar": playerAvatarData.isEmpty ? "default" : "custom",
                          "avatarData": playerAvatarData, "language": playerLanguage, "detailTransparency": detailTransparency]
            case "updateProfile":
                detailTransparency = payload["detailTransparency"] as? Int ?? detailTransparency
                playerAvatarData = payload["avatarData"] as? String ?? ""
                result = ["id": "test", "name": payload["name"] as? String ?? "player123456",
                          "avatar": playerAvatarData.isEmpty ? "default" : "custom",
                          "avatarData": playerAvatarData, "language": playerLanguage, "detailTransparency": detailTransparency]
            case "deleteMap":
                deletedMapIDs.append(payload["id"] as? String ?? "")
                result = ["ok": true]
            case "recordResult":
                let cleared = payload["cleared"] as? Bool ?? false
                let code = payload["mapID"] as? String == "showcase" && payload["difficulty"] as? String == "easy" && cleared
                    ? ["showcase-easy-clear"] : []
                let correct = payload["correct"] as? Int ?? 0
                let wrong = payload["wrong"] as? Int ?? 0
                let accuracy = correct + wrong == 0 ? 0 : Int((Double(correct) / Double(correct + wrong) * 100).rounded())
                result = ["bestScore": payload["score"] ?? 0, "bestTime": payload["duration"] ?? 0,
                          "bestAccuracy": accuracy, "clears": cleared ? 1 : 0,
                          "lastScore": payload["score"] ?? 0, "lastDuration": payload["duration"] ?? 0,
                          "lastCleared": cleared, "newRecord": true, "newlyUnlocked": code]
            case "matchState", "matchLeave", "matchDecline":
                result = ["mode": "idle", "phase": "idle", "connected": false, "peers": []]
            case "matchInvite":
                invitedPeerID = payload["id"] as? String
                invitedDifficulty = payload["difficulty"] as? String
                invitedMapID = (payload["map"] as? [String: Any])?["id"] as? String
                result = ["mode": "host", "phase": "connecting", "connected": true,
                          "peer": ["name": "Nearby Mac"], "peers": [["id": "peer-1", "name": "Nearby Mac", "rssi": -57]]]
            case "matchAccept":
                result = ["mode": "guest", "phase": "accepted", "connected": true,
                          "peer": ["name": "Inviter"]]
            case "matchFinish":
                result = ["ok": true]
                if resolveAfterPeerLeave {
                    let outcome: [String: Any] = ["event": "matchResult", "data": [
                        "outcome": "won", "reason": "opponent_left", "local": payload]]
                    if let data = try? JSONSerialization.data(withJSONObject: outcome),
                       let json = String(data: data, encoding: .utf8) {
                        webView?.evaluateJavaScript("InkBallNative.emit(\(json));")
                    }
                }
            default: result = ["ok": true]
            }
            guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "result": result]),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("InkBallNative.receive(\(json));")
        }
    }

    final class Navigation: NSObject, WKNavigationDelegate {
        let complete: XCTestExpectation
        init(_ complete: XCTestExpectation) { self.complete = complete }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { complete.fulfill() }
    }

    func evaluate(_ webView: WKWebView, _ script: String) async throws -> Any? {
        return try await withCheckedThrowingContinuation { continuation in
            webView.evaluateJavaScript(script) { result, error in
                if let error {
                    continuation.resume(throwing: NSError(domain: "InkBallWebSmoke", code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "\(script.prefix(120)): \(error.localizedDescription)"]))
                }
                else { continuation.resume(returning: result) }
            }
        }
    }

    func awaitTrue(_ webView: WKWebView, _ script: String) async throws {
        for _ in 0..<100 {
            if (try await evaluate(webView, script) as? Bool) == true { return }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTFail("Timed out waiting for JavaScript: \(script)")
    }

    func testOfflineMapsEditorAndGameBoot() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        let bridge = MockBridge()
        config.userContentController.add(bridge, name: "inkball")
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        let loaded = expectation(description: "Offline page loads")
        let nav = Navigation(loaded)
        webView.navigationDelegate = nav
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let web = root.appendingPathComponent("Web", isDirectory: true)
        webView.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.title==='绘轨' && document.querySelector('.brand strong').textContent==='绘轨'")
        let officialCount = try await evaluate(webView, "INKBALL_OFFICIAL.maps.length===10 && document.querySelector('[data-carousel-total]').textContent==='/ 10' && INKBALL_OFFICIAL.maps.slice(5).every(map=>['easy','hard','master'].every((d,i)=>map.difficulties[d].achievements.length===i+1))") as? Bool
        XCTAssertEqual(officialCount, true)
        let fixedWhenNoScroll = try await evaluate(webView, "(() => { const body=document.body; return getComputedStyle(document.documentElement).overflowY==='hidden' && getComputedStyle(body).overscrollBehaviorY==='none' && body.scrollHeight<=body.clientHeight+1; })()") as? Bool
        XCTAssertEqual(fixedWhenNoScroll, true)
        _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click()")
        try await awaitTrue(webView, "!document.querySelector('#personal-view').hidden && document.querySelectorAll('#personal-map-list .workshop-card').length===3")
        try await awaitTrue(webView, "document.querySelector('#personal-view').getAnimations({subtree:true}).every(a=>a.playState==='finished')")
        let workshopShell = try await evaluate(webView, "(() => { const view=document.querySelector('#personal-view'), ambient=view.querySelector('[data-map-ambient=community]'), form=view.querySelector('#personal-search-form'), vr=view.getBoundingClientRect(), fr=form.getBoundingClientRect(); return !view.querySelector('#personal-back') && !view.querySelector('.workshop-heading') && ambient?.dataset.communityTab==='custom' && ambient.dataset.ambientBrickSrc==='img/inkball/ambient_diy.png' && Math.abs((fr.left+fr.right)/2-(vr.left+vr.right)/2)<1; })()") as? Bool
        XCTAssertEqual(workshopShell, true)
        try await awaitTrue(webView, "(() => { const canvas=document.querySelector('.workshop-view__ambient'); return typeof InkballAmbient.setCommunityTab==='function' && canvas.width>=window.innerWidth && canvas.height>=window.innerHeight; })()")
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click(); document.querySelector('#profile-language').value='en'; document.querySelector('#profile-language').dispatchEvent(new Event('change'))")
        try await awaitTrue(webView, "document.documentElement.lang==='en' && document.title==='Spherail' && document.querySelector('.brand strong').textContent==='SPHERAIL' && document.querySelector('#personal-query').placeholder==='Search map names'")
        let englishProfile = try await evaluate(webView, "(() => { const dialog=document.querySelector('#profile-dialog'); return dialog.open && !dialog.querySelector('#avatar-grid,.avatar-credit') && dialog.querySelector('#profile-avatar-choose').getAttribute('aria-label')==='Edit avatar' && dialog.querySelector('#profile-avatar-preview').src.endsWith('/avatar-default.svg') && !!dialog.querySelector('.profile-card__identity'); })()") as? Bool
        XCTAssertEqual(englishProfile, true)
        let closedCropWidth = try await evaluate(webView, "document.querySelector('#profile-dialog').getBoundingClientRect().width") as? Double
        let englishShell = try await evaluate(webView, "document.querySelector('[data-route=personal]').textContent==='Workshop' && document.querySelector('#personal-create .workshop-card__create-label').textContent==='Create map' && document.querySelector('#profile-dialog h2').textContent==='Player profile'") as? Bool
        XCTAssertEqual(englishShell, true)
        let untranslated = try await evaluate(webView, "(() => { const found=new Set(), walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); while(walk.nextNode()){const n=walk.currentNode;if(!n.parentElement?.closest('script,style') && /[\\u3400-\\u9fff]/.test(n.nodeValue))found.add(n.nodeValue.trim())} for(const e of document.querySelectorAll('[aria-label],[title],[placeholder]'))for(const a of ['aria-label','title','placeholder']){const v=e.getAttribute(a);if(v && /[\\u3400-\\u9fff]/.test(v))found.add(v)} return [...found].sort().join(' | '); })()") as? String
        XCTAssertEqual(untranslated, "")
        _ = try await evaluate(webView, "document.querySelector('#profile-language').value='zh'; document.querySelector('#profile-language').dispatchEvent(new Event('change'))")
        try await awaitTrue(webView, "document.documentElement.lang==='zh-CN' && document.title==='绘轨' && document.querySelector('.brand strong').textContent==='绘轨' && document.querySelector('#personal-query').placeholder==='搜索地图名称'")
        let chineseProfile = try await evaluate(webView, "document.querySelector('#profile-avatar-choose').getAttribute('aria-label')==='编辑头像' && document.querySelector('#profile-avatar-reset').textContent==='恢复默认头像'") as? Bool
        XCTAssertEqual(chineseProfile, true)
        let samplePNG = "iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAIAAABdtOgoAAAAsklEQVR4nO3RQQ2AQBDAwIUnSpCADJwiDBPImFzoKGjS7b3PWdl1PLOyXQf8XQOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGvAWB/anQLUl1GL5gAAAABJRU5ErkJggg=="
        _ = try await evaluate(webView, "(() => { const bytes=Uint8Array.from(atob('\(samplePNG)'),c=>c.charCodeAt(0)), file=new File([bytes],'avatar.png',{type:'image/png'}), transfer=new DataTransfer(), input=document.querySelector('#profile-avatar-file'); transfer.items.add(file); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()")
        try await awaitTrue(webView, "!document.querySelector('#profile-crop-tools').hidden && document.querySelector('#profile-avatar-preview').src.startsWith('data:image/jpeg;base64,')")
        let initialCrop = try await evaluate(webView, "document.querySelector('#profile-avatar-preview').src") as? String
        _ = try await evaluate(webView, "document.querySelector('#profile-crop-zoom').value='2'; document.querySelector('#profile-crop-zoom').dispatchEvent(new Event('input'))")
        let zoomedCrop = try await evaluate(webView, "document.querySelector('#profile-avatar-preview').src") as? String
        XCTAssertNotEqual(initialCrop, zoomedCrop)
        let expandedCropWidth = try await evaluate(webView, "document.querySelector('#profile-dialog').getBoundingClientRect().width") as? Double
        XCTAssertEqual(expandedCropWidth ?? 0, closedCropWidth ?? 0, accuracy: 0.5)
        _ = try await evaluate(webView, "document.querySelector('#profile-save').click()")
        try await awaitTrue(webView, "!document.querySelector('#profile-dialog').open && document.querySelector('#header-avatar').src.startsWith('data:image/jpeg;base64,')")
        XCTAssertTrue(bridge.playerAvatarData.hasPrefix("data:image/jpeg;base64,"))
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click(); document.querySelector('#profile-avatar-reset').click(); document.querySelector('#profile-save').click()")
        try await awaitTrue(webView, "!document.querySelector('#profile-dialog').open && document.querySelector('#header-avatar').src.endsWith('/avatar-default.svg')")
        XCTAssertEqual(bridge.playerAvatarData, "")
        let searchControlsMatchWeb = try await evaluate(webView, "(() => { const form=document.querySelector('#personal-search-form'); const sort=form.querySelector('#personal-sort'); const input=form.querySelector('#personal-query'); return !document.querySelector('#import-open') && !!document.querySelector('#editor-import') && getComputedStyle(form).display==='grid' && getComputedStyle(sort).appearance==='none' && getComputedStyle(input).backgroundImage.includes('search.svg') && form.querySelectorAll('button').length===1; })()") as? Bool
        XCTAssertEqual(searchControlsMatchWeb, true)
        let defaultOrder = try await evaluate(webView, "[...document.querySelectorAll('#personal-map-list .workshop-card')].map(card => card.id || card.dataset.mapID).join(',')") as? String
        XCTAssertEqual(defaultOrder, "personal-create,beta,alpha")
        let createMatchesCards = try await evaluate(webView, "(() => { const cards=document.querySelectorAll('#personal-map-list .workshop-card'); return Math.abs(cards[0].getBoundingClientRect().height-cards[1].getBoundingClientRect().height)<1 && Math.abs(cards[0].getBoundingClientRect().width-cards[1].getBoundingClientRect().width)<1; })()") as? Bool
        XCTAssertEqual(createMatchesCards, true)
        let actions = try await evaluate(webView, "[...document.querySelector('#personal-map-list').children[1].querySelector('.workshop-card__actions').children].map(button => button.textContent).join(',')") as? String
        XCTAssertEqual(actions, "编辑地图,")
        _ = try await evaluate(webView, "document.querySelector('#personal-query').value='Alpha'; document.querySelector('#personal-query').dispatchEvent(new Event('input'))")
        try await awaitTrue(webView, "document.querySelectorAll('#personal-map-list .workshop-card').length===2 && document.querySelector('#personal-map-list').firstElementChild.id==='personal-create'")
        _ = try await evaluate(webView, "document.querySelector('#personal-query').value=''; document.querySelector('#personal-query').dispatchEvent(new Event('input')); document.querySelector('#personal-sort').value='oldest'; document.querySelector('#personal-sort').dispatchEvent(new Event('change'))")
        let oldestOrder = try await evaluate(webView, "[...document.querySelectorAll('#personal-map-list .workshop-card')].map(card => card.id || card.dataset.mapID).join(',')") as? String
        XCTAssertEqual(oldestOrder, "personal-create,alpha,beta")
        _ = try await evaluate(webView, "document.querySelector('#personal-map-list .workshop-card:nth-child(3) .workshop-card__actions button:last-child').click()")
        let deleteAwaitsConfirmation = try await evaluate(webView, "document.querySelector('#delete-map-dialog').open && document.querySelector('#delete-map-name').textContent==='Beta Map' && document.querySelectorAll('#personal-map-list .workshop-card').length===3") as? Bool
        XCTAssertEqual(deleteAwaitsConfirmation, true)
        XCTAssertTrue(bridge.deletedMapIDs.isEmpty)
        _ = try await evaluate(webView, "document.querySelector('#delete-map-cancel').click()")
        try await awaitTrue(webView, "!document.querySelector('#delete-map-dialog').open")
        XCTAssertTrue(bridge.deletedMapIDs.isEmpty)
        _ = try await evaluate(webView, "document.querySelector('#personal-map-list .workshop-card:nth-child(3) .workshop-card__actions button:last-child').click(); document.querySelector('#delete-map-confirm').click()")
        try await awaitTrue(webView, "!document.querySelector('#delete-map-dialog').open && document.querySelectorAll('#personal-map-list .workshop-card').length===2")
        XCTAssertEqual(bridge.deletedMapIDs, ["beta"])
        _ = try await evaluate(webView, "document.querySelector('#personal-map-list').children[1].querySelector('.workshop-card__preview').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden && document.querySelector('#detail-name').textContent==='Alpha Map'")
        let customDetailActions = try await evaluate(webView, "!document.querySelector('#detail-export-tools').hidden && !document.querySelector('#detail-edit') && !document.querySelector('#detail-own-actions')") as? Bool
        XCTAssertEqual(customDetailActions, true)
        _ = try await evaluate(webView, "document.querySelector('#detail-export').click()")
        try await awaitTrue(webView, "document.querySelector('#detail-export-status').textContent.includes('已复制到剪切板')")
        XCTAssertTrue(bridge.copiedText?.hasPrefix("INKBALL-LEVEL/1\n") == true)
        _ = try await evaluate(webView, "document.querySelector('#detail-difficulties [data-detail-difficulty=master]').click(); document.querySelector('#detail-duel').click()")
        try await awaitTrue(webView, "!document.querySelector('#match-view').hidden && document.querySelector('#match-entry-label').textContent.includes('Alpha Map · 大师 · 自制地图')")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchState',data:{mode:'idle',phase:'idle',bluetoothState:'ready',wifiState:'ready',peers:[{id:'wifi:peer-1',name:'Nearby player',deviceName:'Nearby Mac',avatar:'genshin-001',transport:'Wi-Fi + 蓝牙',rssi:-57}]}})")
        try await awaitTrue(webView, "document.querySelectorAll('#match-peers .match-peer').length===1 && document.querySelector('#match-peers .match-peer')?.textContent.includes('Nearby Mac') && document.querySelector('#match-peers .match-peer')?.textContent.includes('Wi-Fi + 蓝牙') && !!document.querySelector('#match-peers .match-peer__avatar')")
        _ = try await evaluate(webView, "document.querySelector('#match-peers .match-peer button').click()")
        try await awaitTrue(webView, "!document.querySelector('#match-pending').hidden")
        XCTAssertEqual(bridge.invitedPeerID, "wifi:peer-1")
        XCTAssertEqual(bridge.invitedDifficulty, "master")
        XCTAssertEqual(bridge.invitedMapID, "alpha")
        _ = try await evaluate(webView, "document.querySelector('#match-leave').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('#detail-back').click()")
        _ = try await evaluate(webView, "document.querySelector('[data-route=maps]').click()")
        try await awaitTrue(webView, "document.querySelectorAll('#official-map-list .map-card').length === 30 && document.querySelector('#official-map-list').dataset.looped === '1'")
        try await awaitTrue(webView, "document.querySelectorAll('#official-map-list .map-card__preview-frame.is-preview-ready').length === 30")
        let previewUncovered = try await evaluate(webView, "getComputedStyle(document.querySelector('.map-card__preview-frame'),'::after').zIndex==='0' && getComputedStyle(document.querySelector('.map-card__preview')).zIndex==='1'") as? Bool
        XCTAssertEqual(previewUncovered, true)
        try await awaitTrue(webView, "document.querySelector('[data-map-ambient]').width >= 576")
        _ = try await evaluate(webView, "document.querySelector('[data-map-next]').click()")
        try await awaitTrue(webView, "document.querySelector('[data-carousel-position]').textContent === '02'")
        let wheelMovesTrack = try await evaluate(webView, "(() => { const track=document.querySelector('[data-map-track]'); const before=track.style.transform; document.querySelector('[data-map-viewport]').dispatchEvent(new WheelEvent('wheel',{deltaY:240,bubbles:true,cancelable:true})); return track.style.transform!==before; })()") as? Bool
        XCTAssertEqual(wheelMovesTrack, true)
        _ = try await evaluate(webView, "window.detailEntryWasMasked=null; window.addEventListener('inkball:routechange',()=>{ if(!document.querySelector('#detail-view').hidden) window.detailEntryWasMasked=document.querySelector('#detail-view').classList.contains('is-map-entering'); },{once:true})")
        _ = try await evaluate(webView, "document.querySelector('#official-map-list .map-card[data-map-index=\\\"1\\\"]').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
        let noDetailFlash = try await evaluate(webView, "matchMedia('(prefers-reduced-motion: reduce)').matches || window.detailEntryWasMasked===true") as? Bool
        XCTAssertEqual(noDetailFlash, true)
        try await awaitTrue(webView, "document.querySelector('#detail-view [data-map-ambient=still]').width>=576")
        let detailFloor = try await evaluate(webView, "(() => { const canvas=document.querySelector('#detail-view [data-map-ambient=still]'); return getComputedStyle(canvas).position==='fixed' && canvas.getContext('2d')!==null; })()") as? Bool
        XCTAssertEqual(detailFloor, true)
        let emptyBestRecord = try await evaluate(webView, "document.querySelector('#detail-best-score').textContent==='—' && document.querySelector('#detail-best-time').textContent==='—' && document.querySelector('#detail-best-accuracy').textContent==='—' && document.querySelector('#detail-clear-count').textContent==='—' && document.querySelector('.map-detail__best-record').children.length===4 && document.querySelector('.map-detail__best-record').closest('.map-panel').querySelector('h2').textContent==='最佳记录'") as? Bool
        XCTAssertEqual(emptyBestRecord, true)
        let entersFromCard = try await evaluate(webView, "matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('#detail-view').classList.contains('is-map-entering')") as? Bool
        XCTAssertEqual(entersFromCard, true)
        try await awaitTrue(webView, "!document.querySelector('#detail-view').classList.contains('is-map-entering')")
        let matchesBriefing = try await evaluate(webView, "document.querySelector('#detail-difficulties [role=tab] .map-detail__ball-count') && [...document.querySelectorAll('#detail-view .map-panel')].filter(panel=>!panel.hidden).length===3") as? Bool
        XCTAssertEqual(matchesBriefing, true)
        let officialAchievements = try await evaluate(webView, "!document.querySelector('#detail-achievements-panel').hidden && document.querySelectorAll('#detail-achievements .map-achievement').length===1 && document.querySelector('#detail-achievements .map-achievement__title').textContent==='第一粒沙'") as? Bool
        XCTAssertEqual(officialAchievements, true)
        let lockedTrophy = try await evaluate(webView, "(() => { const icon=document.querySelector('#detail-achievements .map-achievement__trophy'); return icon?.namespaceURI==='http://www.w3.org/2000/svg' && icon.querySelector('.trophy-cup')?.getTotalLength()>0 && getComputedStyle(icon).fill==='rgb(135, 152, 155)' && getComputedStyle(icon).filter==='none'; })()") as? Bool
        XCTAssertEqual(lockedTrophy, true)
        let easyPanelHeights = try await evaluate(webView, "[...document.querySelectorAll('#detail-view .map-detail__grid > .map-panel')].filter(panel=>!panel.hidden).map(panel=>panel.getBoundingClientRect().height).join(',')") as? String
        _ = try await evaluate(webView, "document.querySelector('#detail-difficulties [data-detail-difficulty=master]').click()")
        let masterAchievements = try await evaluate(webView, "document.querySelectorAll('#detail-achievements .map-achievement').length===3 && document.querySelector('#detail-achievements .map-achievement__condition').textContent.includes('1200')") as? Bool
        XCTAssertEqual(masterAchievements, true)
        let achievementsDoNotScroll = try await evaluate(webView, "(() => { const box=document.querySelector('.map-achievements'), list=document.querySelector('#detail-achievements'); return getComputedStyle(box).overflowY==='visible' && box.scrollHeight<=box.clientHeight+1 && list.getBoundingClientRect().bottom<=box.getBoundingClientRect().bottom+1; })()") as? Bool
        XCTAssertEqual(achievementsDoNotScroll, true)
        let masterPanelHeights = try await evaluate(webView, "[...document.querySelectorAll('#detail-view .map-detail__grid > .map-panel')].filter(panel=>!panel.hidden).map(panel=>panel.getBoundingClientRect().height).join(',')") as? String
        XCTAssertEqual(masterPanelHeights, easyPanelHeights)
        XCTAssertEqual(masterPanelHeights?.split(separator: ",").count, 3)
        let officialExportVisible = try await evaluate(webView, "!document.querySelector('#detail-export-tools').hidden") as? Bool
        XCTAssertEqual(officialExportVisible, true)
        _ = try await evaluate(webView, "document.querySelector('#detail-export').click()")
        try await awaitTrue(webView, "document.querySelector('#detail-export-status').textContent.includes('已复制到剪切板')")
        let officialCode = try XCTUnwrap(bridge.copiedText)
        XCTAssertTrue(officialCode.hasPrefix("INKBALL-LEVEL/1\n"))
        let officialEnvelope = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(officialCode.dropFirst("INKBALL-LEVEL/1\n".count).utf8)) as? [String: Any])
        XCTAssertEqual(officialEnvelope["format"] as? String, "inkball-map")
        XCTAssertNil(officialEnvelope["difficulties"])
        XCTAssertNil(officialEnvelope["difficulty"])
        let expectedOfficialLayout = try await evaluate(webView, "window.INKBALL_OFFICIAL.maps[1].difficulties.master.layout_content") as? String
        XCTAssertEqual(officialEnvelope["layout"] as? String, expectedOfficialLayout)
        _ = try await evaluate(webView, "document.querySelector('#detail-difficulties [data-detail-difficulty=easy]').click()")
        _ = try await evaluate(webView, "document.querySelector('#detail-start').click()")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel")
        let colouredBallSprites = try await evaluate(webView, "(() => { const game=window.inkballApp, orange={colorIndex:2}, yellow={colorIndex:2}; new Inkball.WallTile(1,1,1).onBallHit(orange); new Inkball.WallTile(1,1,4).onBallHit(yellow); return orange.colorIndex===1 && yellow.colorIndex===4 && game.ballImages.length===5 && game.ballImages.every(img=>img && img.complete && img.naturalWidth>0); })()") as? Bool
        XCTAssertEqual(colouredBallSprites, true)
        let windowedBoardUsesSpace = try await evaluate(webView, "(() => { const board=document.querySelector('#game').getBoundingClientRect(); return board.width>=550 && board.left>=0 && board.right<=innerWidth && board.top>=0 && board.bottom<=innerHeight; })()") as? Bool
        XCTAssertEqual(windowedBoardUsesSpace, true)
        try await awaitTrue(webView, "document.querySelector('#play-view [data-map-ambient=still]').width>=576")
        let playFloor = try await evaluate(webView, "(() => { const canvas=document.querySelector('#play-view [data-map-ambient=still]'); return getComputedStyle(canvas).position==='fixed' && canvas.getContext('2d')!==null; })()") as? Bool
        XCTAssertEqual(playFloor, true)
        let gameTools = try await evaluate(webView, "(() => { const bar=document.querySelector('[data-game-tools]'), buttons=[...bar.querySelectorAll('button')], box=bar.getBoundingClientRect(); return getComputedStyle(bar).position==='fixed' && box.left<30 && innerHeight-box.bottom<25 && buttons.length===2 && buttons[0].querySelector('img').getAttribute('src')==='img/ui/mouse-pointer.svg' && buttons[1].querySelector('img').getAttribute('src')==='img/ui/eraser.svg'; })()") as? Bool
        XCTAssertEqual(gameTools, true)
        let gameToolSwitch = try await evaluate(webView, "(() => { const draw=document.querySelector('[data-game-tool=draw]'), erase=document.querySelector('[data-game-tool=erase]'); erase.click(); const erased=erase.getAttribute('aria-pressed')==='true' && draw.getAttribute('aria-pressed')==='false' && document.querySelector('#game').classList.contains('is-erasing'); draw.click(); return erased && draw.getAttribute('aria-pressed')==='true' && erase.getAttribute('aria-pressed')==='false'; })()") as? Bool
        XCTAssertEqual(gameToolSwitch, true)
        let minimalPlayChrome = try await evaluate(webView, "(() => { const header=document.querySelector('.app-header'), guide=document.querySelector('#play-guide'), pause=document.querySelector('#play-view [data-pause-open]'); return getComputedStyle(header).display==='none' && !document.querySelector('#play-view .play-heading') && guide.textContent==='?' && getComputedStyle(guide).position==='fixed' && getComputedStyle(pause).position==='fixed'; })()") as? Bool
        XCTAssertEqual(minimalPlayChrome, true)
        _ = try await evaluate(webView, "document.querySelector('#play-guide').click()")
        let playGuideOpened = try await evaluate(webView, "!document.querySelector('#play-guide-panel').hidden && document.querySelectorAll('#play-guide-panel .tile-guide__item').length===10 && document.querySelector('#play-guide').getAttribute('aria-expanded')==='true'") as? Bool
        XCTAssertEqual(playGuideOpened, true)
        let guideHasIcons = try await evaluate(webView, "document.querySelectorAll('#play-guide-panel .tile-guide__icon').length > 10") as? Bool
        XCTAssertEqual(guideHasIcons, true)
        _ = try await evaluate(webView, "document.querySelector('#play-guide').click()")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click()")
        try await awaitTrue(webView, "document.querySelector('[data-pause-overlay]').open && document.querySelectorAll('.pause-action').length===3")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-resume]').click()")
        try await awaitTrue(webView, "!document.querySelector('[data-pause-overlay]').open")
        let fetchesLayout = try await evaluate(webView, "window.inkballApp.levelSource.fetchLayout") as? Bool
        XCTAssertEqual(fetchesLayout, false)
        _ = try await evaluate(webView, "window.resultBoardAnimations=0; const originalAnimate=Element.prototype.animate; Element.prototype.animate=function(...args){ if(this.id==='result-board') window.resultBoardAnimations++; return originalAnimate.apply(this,args); }; window.inkballApp._finishAttempt(false)")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-outcome').textContent === '时间到'")
        try await awaitTrue(webView, "window.InkballAmbient?.resultState?.().ready && window.InkballAmbient.resultState().count>=8")
        let timeoutAmbient = try await evaluate(webView, "(() => { const canvas=document.querySelector('#result-ambient'), state=InkballAmbient.resultState(); return canvas.dataset.mapAmbient==='rows' && canvas.dataset.ambientBurst==='0' && !state.burst && canvas.width>=576; })()") as? Bool
        XCTAssertEqual(timeoutAmbient, true)
        let resultAnimated = try await evaluate(webView, "matchMedia('(prefers-reduced-motion: reduce)').matches || window.resultBoardAnimations>0") as? Bool
        XCTAssertEqual(resultAnimated, true)
        let boardSnapshotVisible = try await evaluate(webView, "!document.querySelector('#result-handoff').hidden && !!document.querySelector('#result-handoff canvas, #result-handoff img[src]')") as? Bool
        XCTAssertEqual(boardSnapshotVisible, true)
        let resultTicket = try await evaluate(webView, "document.querySelector('#result-board').classList.contains('brick-frame') && document.querySelector('#result-type').textContent==='官方地图' && document.querySelector('#result-map').textContent==='沙漏' && document.querySelector('#result-difficulty').textContent==='萌新' && document.querySelector('#result-accuracy').textContent==='0%' && !document.querySelector('#result-again').hidden") as? Bool
        XCTAssertEqual(resultTicket, true)
        let webResultButtons = try await evaluate(webView, "(() => { const restart=document.querySelector('#result-again'), next=document.querySelector('#result-continue'), a=getComputedStyle(restart), b=getComputedStyle(next); return a.backgroundImage.includes('linear-gradient') && !a.backgroundImage.includes('tile.png') && b.backgroundImage.includes('linear-gradient') && a.borderRadius==='9px' && b.borderRadius==='9px' && getComputedStyle(restart,'::before').display==='none'; })()") as? Bool
        XCTAssertEqual(webResultButtons, true)
        _ = try await evaluate(webView, "document.querySelector('#result-continue').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click(); document.querySelector('#personal-create').click()")
        try await awaitTrue(webView, "!document.querySelector('#editor-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('#editor-back').click()")
        let untouchedEditorLeaves = try await evaluate(webView, "document.querySelector('#editor-view').hidden && !document.querySelector('#editor-leave-dialog').open") as? Bool
        XCTAssertEqual(untouchedEditorLeaves, true)
        _ = try await evaluate(webView, "document.querySelector('#personal-create').click(); document.querySelector('#editor-name').value='Unfinished Map'; document.querySelector('#editor-back').click()")
        let dirtyEditorAsks = try await evaluate(webView, "!document.querySelector('#editor-view').hidden && document.querySelector('#editor-leave-dialog').open") as? Bool
        XCTAssertEqual(dirtyEditorAsks, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-leave-cancel').click()")
        let canceledExitKeepsDraft = try await evaluate(webView, "!document.querySelector('#editor-view').hidden && document.querySelector('#editor-name').value==='Unfinished Map'") as? Bool
        XCTAssertEqual(canceledExitKeepsDraft, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-back').click(); document.querySelector('#editor-leave-confirm').click()")
        let discardedExitState = try await evaluate(webView, "JSON.stringify({hidden:document.querySelector('#editor-view').hidden,open:document.querySelector('#editor-leave-dialog').open,count:document.querySelector('#personal-count').textContent})") as? String
        XCTAssertEqual(discardedExitState, "{\"hidden\":true,\"open\":false,\"count\":\"1\"}")
        _ = try await evaluate(webView, "document.querySelector('#personal-create').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-view [data-map-ambient=still]').width>=576")
        let editorFloor = try await evaluate(webView, "(() => { const canvas=document.querySelector('#editor-view [data-map-ambient=still]'); return getComputedStyle(canvas).position==='fixed' && canvas.getContext('2d')!==null && getComputedStyle(document.querySelector('#editor-view .community-body')).zIndex==='1'; })()") as? Bool
        XCTAssertEqual(editorFloor, true)
        try await awaitTrue(webView, "document.querySelectorAll('.community-palette__item').length > 50")
        try await awaitTrue(webView, "[...document.querySelectorAll('.community-palette__item img')].every(img => img.complete && img.naturalWidth > 0)")
        let timedWallLast = try await evaluate(webView, "(() => { const group=[...document.querySelectorAll('.community-palette__group')].find(group=>group.querySelector('h2').textContent==='墙与机关'); return group?.querySelector('.community-palette__item:last-child')?.dataset.token==='T'; })()") as? Bool
        XCTAssertEqual(timedWallLast, true)
        let namedPalette = try await evaluate(webView, "(() => { const item=(token,attr)=>document.querySelector('.community-palette__item[data-token=\"'+token+'\"][data-attr=\"'+attr+'\"]'); return item('U','4').title==='单向墙 · 向上 · 黄色' && item('B','2').title==='小球 · 蓝色' && item('r',' ').title==='加速砖 · 向右' && item('U','4').getAttribute('aria-label')===item('U','4').title; })()") as? Bool
        XCTAssertEqual(namedPalette, true)
        let emptyEditor = try await evaluate(webView, "!document.querySelector('#editor-view').hidden && document.querySelector('#editor-guide-panel').hidden && document.querySelector('#editor-undo').disabled") as? Bool
        XCTAssertEqual(emptyEditor, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-export').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-export-status').textContent.includes('已复制到剪切板')")
        XCTAssertNil(bridge.savedMap)
        XCTAssertTrue(bridge.copiedText?.hasPrefix("INKBALL-LEVEL/1\n") == true)
        _ = try await evaluate(webView, "document.querySelector('#editor-guide').click()")
        let guideOpen = try await evaluate(webView, "!document.querySelector('#editor-guide-panel').hidden && document.querySelectorAll('#editor-guide-panel .tile-guide__item').length===10 && document.querySelector('#editor-guide').getAttribute('aria-expanded')==='true'") as? Bool
        XCTAssertEqual(guideOpen, true)
        let guideOnTop = try await evaluate(webView, "(() => { const panel=document.querySelector('#editor-guide-panel'), box=panel.querySelector('.tile-guide__row').getBoundingClientRect(); return panel.contains(document.elementFromPoint(box.left+18,box.top+18)); })()") as? Bool
        XCTAssertEqual(guideOnTop, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-guide-panel .tile-guide__arrow').click()")
        let guideExpanded = try await evaluate(webView, "document.querySelectorAll('#editor-guide-panel .tile-guide__item.is-open').length===1 && document.querySelectorAll('#editor-guide-panel .tile-guide__item.is-open .tile-guide__swatch').length===5") as? Bool
        XCTAssertEqual(guideExpanded, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-guide-panel .tile-guide__item:nth-child(2) .tile-guide__arrow').click(); document.querySelector('#editor-guide').click()")
        let guideClosed = try await evaluate(webView, "document.querySelector('#editor-guide-panel').hidden && document.querySelectorAll('#editor-guide-panel .tile-guide__item.is-open').length===1") as? Bool
        XCTAssertEqual(guideClosed, true)
        let usesBakedTiles = try await evaluate(webView, "document.querySelector('.community-palette__item[data-token=C] img').getAttribute('src').startsWith('img/editor/')") as? Bool
        XCTAssertEqual(usesBakedTiles, true)
        _ = try await evaluate(webView, "window.editorCellEvent=(type,x,y,button=0)=>{ const board=document.querySelector('#editor-board'), box=board.getBoundingClientRect(); const options={clientX:box.left+box.width*(x+.5)/18,clientY:box.top+box.height*(y+.5)/18,bubbles:true,button,pointerId:4}; board.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type,options) : new MouseEvent(type,options)); }; true")
        let blankLayout = try await evaluate(webView, "(() => { const rows=window.InkballCommunityEditorState.blankLayout().split('\\n'); return rows[1].slice(2,4)==='  ' && rows.length===18; })()") as? Bool
        XCTAssertEqual(blankLayout, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-name').value='Empty Map'; document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.includes('至少添加一个球')")
        XCTAssertNil(bridge.savedMap)
        _ = try await evaluate(webView, "document.querySelectorAll('.community-palette__item[data-token=H]')[2].click()")
        let chosenHole = try await evaluate(webView, "document.querySelector('#editor-tool').value==='H' && document.querySelectorAll('.community-palette__item[data-token=H]')[2].classList.contains('is-selected')") as? Bool
        XCTAssertEqual(chosenHole, true)
        let hoverPreview = try await evaluate(webView, "(() => { const proto=CanvasRenderingContext2D.prototype, original=proto.drawImage; let count=0; proto.drawImage=function(...args){if(this.globalAlpha===0.45) count++; return original.apply(this,args)}; window.editorCellEvent('pointermove',4,4); const preview=count; count=0; window.editorCellEvent('pointerleave',4,4); proto.drawImage=original; return preview>0 && count===0; })()") as? Bool
        XCTAssertEqual(hoverPreview, true)
        _ = try await evaluate(webView, "window.editorCellEvent('click',4,4)")
        let holePlaced = try await evaluate(webView, "document.querySelector('#editor-board') && document.querySelector('#editor-undo').disabled === false") as? Bool
        XCTAssertEqual(holePlaced, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.includes('至少添加一个球')")
        _ = try await evaluate(webView, "document.querySelector('.community-palette__item[data-token=S]').click(); window.editorCellEvent('click',5,4)")
        let blockedOverlap = try await evaluate(webView, "document.querySelector('#editor-status').textContent.includes('占用') && document.querySelector('#editor-undo').disabled===false") as? Bool
        XCTAssertEqual(blockedOverlap, true)
        _ = try await evaluate(webView, "document.querySelectorAll('.community-palette__item[data-token=H]')[3].click(); window.editorCellEvent('click',5,5)")
        let blockedHole = try await evaluate(webView, "document.querySelector('#editor-status').textContent.includes('占用')") as? Bool
        XCTAssertEqual(blockedHole, true)
        _ = try await evaluate(webView, "window.editorCellEvent('contextmenu',5,5); document.querySelector('.community-palette__item[data-token=S]').click(); window.editorCellEvent('click',1,1)")
        _ = try await evaluate(webView, "document.querySelector('[data-difficulty=hard]').click()")
        let independentHistory = try await evaluate(webView, "document.querySelector('#editor-undo').disabled") as? Bool
        XCTAssertEqual(independentHistory, true)
        _ = try await evaluate(webView, "document.querySelector('.community-palette__item[data-token=X]').click(); window.editorCellEvent('click',3,3); document.querySelector('#editor-undo').click(); document.querySelector('[data-difficulty=easy]').click()")
        let easyHistory = try await evaluate(webView, "!document.querySelector('#editor-undo').disabled") as? Bool
        XCTAssertEqual(easyHistory, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-undo').click(); document.querySelector('#editor-redo').click()")
        _ = try await evaluate(webView, "document.querySelector('.community-palette__item[data-token=T]').click(); window.editorCellEvent('click',7,7); window.editorCellEvent('click',7,7)")
        let timedEditor = try await evaluate(webView, "document.querySelector('#editor-timed-dialog').open && document.querySelector('#editor-timed-value').value==='39'") as? Bool
        XCTAssertEqual(timedEditor, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-timed-value').value='25'; document.querySelector('#editor-timed-form').requestSubmit()")
        try await awaitTrue(webView, "!document.querySelector('#editor-timed-dialog').open")
        _ = try await evaluate(webView, "document.querySelector('#editor-serve-source button').click()")
        try await awaitTrue(webView, "document.querySelectorAll('#editor-serve-list button').length === 1")
        _ = try await evaluate(webView, "document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.includes('至少放置一个球洞')")
        _ = try await evaluate(webView, "document.querySelector('.community-palette__item[data-token=H]').click(); window.editorCellEvent('click',4,4)")
        _ = try await evaluate(webView, "document.querySelector('#editor-name').value='Smoke Map'; document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.includes('已保存在本机')")
        _ = try await evaluate(webView, "document.querySelector('#editor-export').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-export-status').textContent.includes('已复制到剪切板')")
        let sharedDifficulty = try XCTUnwrap(bridge.copiedText)
        XCTAssertTrue(sharedDifficulty.hasPrefix("INKBALL-LEVEL/1\n"))
        let sharedEnvelope = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(sharedDifficulty.dropFirst("INKBALL-LEVEL/1\n".count).utf8)) as? [String: Any])
        XCTAssertNil(sharedEnvelope["difficulties"])
        XCTAssertEqual(sharedEnvelope["layout"] as? String, (bridge.savedMap?["difficulties"] as? [String: [String: Any]])?["easy"]?["layout_content"] as? String)
        _ = try await evaluate(webView, "document.querySelector('#editor-difficulties [data-difficulty=hard]').click(); document.querySelector('#editor-import').click()")
        try await awaitTrue(webView, "document.querySelector('#code-dialog').open")
        let escapedCode = String(decoding: try JSONEncoder().encode(sharedDifficulty), as: UTF8.self)
        _ = try await evaluate(webView, "document.querySelector('#map-code').value=\(escapedCode); document.querySelector('#code-action').click()")
        try await awaitTrue(webView, "!document.querySelector('#code-dialog').open && document.querySelector('#editor-status').textContent.includes('已导入到进阶')")
        let onlyTargetDifficultyChanged = try await evaluate(webView, "document.querySelector('#editor-difficulty-status').textContent.includes('进阶') && document.querySelectorAll('#editor-serve-list button').length===1 && document.querySelector('#editor-undo').disabled===false") as? Bool
        XCTAssertEqual(onlyTargetDifficultyChanged, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-undo').click()")
        let undoRestoresTarget = try await evaluate(webView, "document.querySelectorAll('#editor-serve-list button').length===0") as? Bool
        XCTAssertEqual(undoRestoresTarget, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-redo').click()")
        let redoRestoresImport = try await evaluate(webView, "document.querySelectorAll('#editor-serve-list button').length===1") as? Bool
        XCTAssertEqual(redoRestoresImport, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.includes('已保存在本机')")
        let copiedLevels = bridge.savedMap?["difficulties"] as? [String: [String: Any]]
        XCTAssertEqual(copiedLevels?["hard"]?["layout_content"] as? String, copiedLevels?["easy"]?["layout_content"] as? String)
        _ = try await evaluate(webView, "document.querySelector('#editor-difficulties [data-difficulty=easy]').click()")
        let sourceDifficultyUnchanged = try await evaluate(webView, "document.querySelectorAll('#editor-serve-list button').length===1") as? Bool
        XCTAssertEqual(sourceDifficultyUnchanged, true)
        let levels = bridge.savedMap?["difficulties"] as? [String: [String: Any]]
        let layout = (levels?["easy"]?["layout_content"] as? String)?.components(separatedBy: "\n")
        XCTAssertEqual(layout?[4].dropFirst(8).prefix(2), "H0")
        XCTAssertEqual(layout?[1].dropFirst(2).prefix(2), "S ")
        let timedCode = try await evaluate(webView, "Inkball.encodeTimedSeconds(25)") as? String
        XCTAssertEqual(layout?[7].dropFirst(14).prefix(2), "T\(timedCode ?? "")")
        _ = try await evaluate(webView, "document.querySelector('#editor-playtest').click()")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && window.inkballApp.boot.fromEditor")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click()")
        try await awaitTrue(webView, "document.querySelector('[data-pause-overlay]').open")
        _ = try await evaluate(webView, "document.querySelector('[data-route=maps]').click()")
        try await awaitTrue(webView, "!document.querySelector('[data-pause-overlay]').open && document.querySelector('[data-pause-overlay]').hidden")
        _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click(); document.querySelector('#personal-map-list .workshop-card:nth-child(2) .workshop-card__actions button:first-child').click()")
        try await awaitTrue(webView, "!document.querySelector('#editor-view').hidden")
        _ = try await evaluate(webView, "window.dispatchEvent(new Event('resize')); document.querySelector('#editor-back').click(); document.querySelector('[data-route=maps]').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        let homeRecenters = try await evaluate(webView, "(() => { const viewport=document.querySelector('[data-map-viewport]').getBoundingClientRect(), cards=[...document.querySelectorAll('#official-map-list .map-card')], center=cards.find(card=>card.classList.contains('is-center')); if (!center) return false; const rect=center.getBoundingClientRect(); return Math.abs((rect.left+rect.right)/2-(viewport.left+viewport.right)/2)<2; })()") as? Bool
        XCTAssertEqual(homeRecenters, true)
        let homePreviewHeight = try await evaluate(webView, "(() => { const home=document.querySelector('#maps-view'), card=home.querySelector('.map-card.is-center'); if (!card) return false; const view=home.getBoundingClientRect(), preview=card.getBoundingClientRect(); return !home.querySelector('.map-home__title,.map-home__subtitle') && Math.abs((preview.top+preview.bottom-view.top-view.bottom)/2)<25; })()") as? Bool
        XCTAssertEqual(homePreviewHeight, true)
        let sideMap = try await evaluate(webView, "!document.querySelector('#official-map-list .map-card[data-map-index=\"0\"]').classList.contains('is-center')") as? Bool
        XCTAssertEqual(sideMap, true)
        _ = try await evaluate(webView, "document.querySelector('#official-map-list .map-card[data-map-index=\"0\"]').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('#detail-back').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden && document.querySelector('[data-carousel-position]').textContent==='01' && document.querySelector('#official-map-list .map-card[data-map-index=\"0\"].is-center')!==null")
        let expansionLanguages = try await evaluate(webView, "INKBALL_OFFICIAL.maps.slice(5).every(map=>INKBALL_I18N.zh['map.name.'+map.id]===map.name && INKBALL_I18N.en['map.name.'+map.id]===map.name_en && Object.values(map.difficulties).every(level=>level.achievements.every(a=>InkballDesktopI18n.translate(a.name_zh)===a.name))) && InkballDesktopI18n.translate('导出地图')==='Export map'") as? Bool
        XCTAssertEqual(expansionLanguages, true)
        for mapIndex in 0..<10 {
            for difficultyIndex in 0..<3 {
                _ = try await evaluate(webView,
                    "document.querySelector('#official-map-list .map-card[data-map-index=\\\"\(mapIndex)\\\"]').click()")
                try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
                _ = try await evaluate(webView, "document.querySelectorAll('#detail-difficulties button')[\(difficultyIndex)].click(); document.querySelector('#detail-start').click()")
                try await awaitTrue(webView,
                    "!!window.inkballApp?.currentLevel && window.inkballApp.boot.map === window.INKBALL_OFFICIAL.maps[\(mapIndex)].id && window.inkballApp.boot.difficulty === ['easy','hard','master'][\(difficultyIndex)]")
                _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click(); document.querySelector('[data-pause-home]').click()")
                try await awaitTrue(webView, "document.querySelector('#play-view').hidden && !document.querySelector('#detail-view').hidden")
                _ = try await evaluate(webView, "document.querySelector('#detail-back').click()")
            }
        }
        try await awaitTrue(webView, "document.querySelector('.map-home-return-fly') === null")
        _ = try await evaluate(webView, "document.querySelector('#official-map-list .map-card[data-map-index=\"0\"]').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
        let lockedBeforeClear = try await evaluate(webView, "document.querySelector('#detail-achievements .map-achievement[data-achievement-code=\"showcase-easy-clear\"]').classList.contains('is-locked')") as? Bool
        XCTAssertEqual(lockedBeforeClear, true)
        _ = try await evaluate(webView, "document.querySelector('#detail-start').click()")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel")
        _ = try await evaluate(webView, "window.inkballApp.score=120; window.inkballApp.correctCaptures=1; window.inkballApp._finishAttempt(true)")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-outcome').textContent==='通关'")
        let clearAmbient = try await evaluate(webView, "(() => { const state=InkballAmbient.resultState(), canvas=document.querySelector('#result-ambient'); return canvas.dataset.ambientBurst==='1' && state.burst && state.count>=2 && state.balls[0].vy<0 && state.balls[1].vy<0; })()") as? Bool
        XCTAssertEqual(clearAmbient, true)
        let successTicket = try await evaluate(webView, "!document.querySelector('#result-new-record').hidden && document.querySelector('#result-accuracy').textContent==='100%' && document.querySelector('#result-emblem').getAttribute('src').includes('arcade-medal')") as? Bool
        XCTAssertEqual(successTicket, true)
        _ = try await evaluate(webView, "document.querySelector('#result-again').click()")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click(); document.querySelector('[data-pause-home]').click()")
        try await awaitTrue(webView, "!document.querySelector('#detail-view').hidden")
        let unlockedAfterClear = try await evaluate(webView, "document.querySelector('#detail-achievements .map-achievement[data-achievement-code=\"showcase-easy-clear\"]').classList.contains('is-unlocked')") as? Bool
        XCTAssertEqual(unlockedAfterClear, true)
        let goldTrophy = try await evaluate(webView, "(() => { const icon=document.querySelector('#detail-achievements .map-achievement.is-unlocked .map-achievement__trophy'); return !!icon && getComputedStyle(icon).fill==='rgb(230, 172, 40)' && getComputedStyle(icon).filter!=='none' && getComputedStyle(icon.querySelector('.trophy-shine')).stroke==='rgb(255, 248, 212)'; })()") as? Bool
        XCTAssertEqual(goldTrophy, true)
        let bestRecordAfterClear = try await evaluate(webView, "document.querySelector('#detail-best-score').textContent==='120' && /^\\d+:\\d\\d$/.test(document.querySelector('#detail-best-time').textContent) && document.querySelector('#detail-best-accuracy').textContent==='100%' && document.querySelector('#detail-clear-count').textContent==='1'") as? Bool
        XCTAssertEqual(bestRecordAfterClear, true)
        _ = try await evaluate(webView, "document.querySelector('#detail-back').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchInvitation',data:{mode:'guest',phase:'invited',map:INKBALL_OFFICIAL.maps[0],difficulty:'hard',peer:{name:'Inviter',avatar:'genshin-001'}}})")
        try await awaitTrue(webView, "document.querySelector('#match-invite-dialog').open && document.querySelector('#match-invite-map').textContent.includes('进阶') && !document.querySelector('#match-invite-avatar').hidden")
        _ = try await evaluate(webView, "document.querySelector('#match-accept').click()")
        try await awaitTrue(webView, "!document.querySelector('#match-invite-dialog').open")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchCountdown',data:{seconds:3,match:{mode:'guest',phase:'countdown',peer:{name:'Inviter'}}}})")
        try await awaitTrue(webView, "!document.querySelector('#match-countdown').hidden && document.querySelector('#match-countdown-number').textContent==='3'")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchStart',data:{map:INKBALL_OFFICIAL.maps[0],difficulty:'easy',session:'smoke',phase:'playing',mode:'host',connected:true,peer:{name:'Peer'}}})")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        let equalBoards = try await evaluate(webView, "(() => { const a=document.querySelector('#game').getBoundingClientRect(), b=document.querySelector('#opponent-game').getBoundingClientRect(); return document.querySelector('#match-countdown').hidden && Math.abs(a.width-b.width)<1 && !document.querySelector('#match-connection-metrics').hidden; })()") as? Bool
        XCTAssertEqual(equalBoards, true)
        let ownBoardMarked = try await evaluate(webView, "document.querySelector('#play-view').classList.contains('in-match') && document.querySelector('#self-board-label').textContent==='我的棋盘' && document.querySelector('.play-board--self').contains(document.querySelector('#game'))") as? Bool
        XCTAssertEqual(ownBoardMarked, true)
        let backgroundClock = try await evaluate(webView, "(() => { const app=window.inkballApp, level=app.currentLevel; app.advanceWallClock(); const before=level.levelTimer; app._desktopClockAt=Date.now()-5000; app.advanceWallClock(); const after=level.levelTimer; app.update(0.05); const afterFrame=level.levelTimer; app.isPaused=true; app._desktopClockAt=Date.now()-5000; app.advanceWallClock(); const paused=level.levelTimer; app.isPaused=false; app._desktopClockAt=Date.now(); return before-after>=4.9 && before-after<5.2 && Math.abs(afterFrame-after)<0.1 && Math.abs(paused-afterFrame)<0.1; })()") as? Bool
        XCTAssertEqual(backgroundClock, true)
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchDisconnected',data:{seconds:20}})")
        let reconnectKeepsClock = try await evaluate(webView, "(() => { const app=window.inkballApp, before=app.currentLevel.levelTimer; app._desktopClockAt=Date.now()-2000; app.advanceWallClock(); return !app.isPaused && before-app.currentLevel.levelTimer>=1.9 && !document.querySelector('#status').hidden; })()") as? Bool
        XCTAssertEqual(reconnectKeepsClock, true)
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchReconnected',data:{}})")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchMetrics',data:{latencyMs:42,signalDBm:-61}})")
        let matchMetrics = try await evaluate(webView, "document.querySelector('[data-match-sync-latency]').textContent==='42 ms' && document.querySelector('#match-signal').textContent==='-61 dBm'") as? Bool
        XCTAssertEqual(matchMetrics, true)
        let noFalseReconnect = try await evaluate(webView, "(() => { const sync=window.inkballApp.matchSync; sync.lastSnapshotReceivedAt=Date.now()-1200; sync.updateSignalOverlay(Date.now()); const shortGapHidden=sync.waitingNode.hidden; sync.lastSnapshotReceivedAt=Date.now()-5000; sync.updateSignalOverlay(Date.now()); const longGapLabel=sync.connectionNode.textContent; sync.lastSnapshotReceivedAt=Date.now(); sync.updateSignalOverlay(Date.now()); return shortGapHidden && longGapLabel==='正在同步对手画面…' && sync.waitingNode.hidden; })()") as? Bool
        XCTAssertEqual(noFalseReconnect, true)
        _ = try await evaluate(webView, "InkBallNative.emit({event:'opponentLeft',data:{peer:{name:'Peer'}}})")
        let peerExitKeepsPlaying = try await evaluate(webView, "(() => { const app=window.inkballApp, before=app.currentLevel.levelTimer; app._desktopClockAt=Date.now()-2000; app.advanceWallClock(); return JSON.stringify({playing:!document.querySelector('#play-view').hidden,resultHidden:document.querySelector('#result-view').hidden,unpaused:!app.isPaused,elapsed:before-app.currentLevel.levelTimer,status:document.querySelector('#status').textContent,opponent:app.matchSync.opponentStatus}); })()") as? String
        XCTAssertTrue(peerExitKeepsPlaying?.contains("\"playing\":true") == true &&
            peerExitKeepsPlaying?.contains("\"resultHidden\":true") == true &&
            peerExitKeepsPlaying?.contains("\"unpaused\":true") == true &&
            peerExitKeepsPlaying?.contains("\"elapsed\":2") == true &&
            peerExitKeepsPlaying?.contains("\"status\":\"对手已退出，你可以继续完成本局。\"") == true &&
            peerExitKeepsPlaying?.contains("\"opponent\":\"forfeited\"") == true,
            peerExitKeepsPlaying ?? "missing")
        let matchHasMenu = try await evaluate(webView, "!document.querySelector('[data-pause-open]').hidden && document.querySelector('[data-pause-restart]').hidden") as? Bool
        XCTAssertEqual(matchHasMenu, true)
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click()")
        try await awaitTrue(webView, "document.querySelector('[data-pause-overlay]').open")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-home]').click()")
        try await awaitTrue(webView, "document.querySelector('#match-exit-dialog').open")
        _ = try await evaluate(webView, "document.querySelector('#match-exit-cancel').click()")
        try await awaitTrue(webView, "!document.querySelector('#match-exit-dialog').open && !document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('[data-pause-open]').click(); document.querySelector('[data-pause-home]').click(); document.querySelector('#match-exit-confirm').click()")
        try await awaitTrue(webView, "document.querySelector('#play-view').hidden && !document.querySelector('#personal-view').hidden")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchStart',data:{map:INKBALL_OFFICIAL.maps[0],difficulty:'easy',session:'smoke-2',phase:'playing',mode:'host',connected:true,peer:{name:'Peer'}}})")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "(() => { const app=window.inkballApp; app.advanceWallClock(); app._desktopClockAt=Date.now()-(app.currentLevel.levelTimer+1)*1000; app.advanceWallClock(); })()")
        try await awaitTrue(webView, "!document.querySelector('#match-finish-choice').hidden && !document.querySelector('#play-view').hidden && document.querySelector('#result-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('#match-watch').click()")
        let watchChoice = try await evaluate(webView, "document.querySelector('#match-finish-choice').hidden && !document.querySelector('#match-watch-leave').hidden && !document.querySelector('#opponent-panel').hidden") as? Bool
        XCTAssertEqual(watchChoice, true)
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchResult',data:{outcome:'won',local:{score:300,accuracy:100,duration:20},remote:{score:250,accuracy:80,duration:25}}})")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-outcome').textContent==='胜利'")
        let matchTicket = try await evaluate(webView, "document.querySelector('#result-board').classList.contains('result-card--match') && !document.querySelector('#result-match-stats').hidden && document.querySelector('#result-peer-score').textContent==='250' && !document.querySelector('#result-continue').hidden") as? Bool
        XCTAssertEqual(matchTicket, true)
        _ = try await evaluate(webView, "document.querySelector('#result-continue').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        bridge.resolveAfterPeerLeave = true
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchStart',data:{map:INKBALL_OFFICIAL.maps[0],difficulty:'easy',session:'smoke-3',phase:'playing',mode:'guest',connected:true,peer:{name:'Peer'}}})")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'opponentLeft',data:{peer:{name:'Peer'}}})")
        _ = try await evaluate(webView, "(() => { const app=window.inkballApp; app.advanceWallClock(); app._desktopClockAt=Date.now()-(app.currentLevel.levelTimer+1)*1000; app.advanceWallClock(); })()")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-outcome').textContent==='胜利' && document.querySelector('#result-peer-name').textContent==='对手已离开'")
        _ = try await evaluate(webView, "document.querySelector('#result-continue').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchStart',data:{map:INKBALL_OFFICIAL.maps[0],difficulty:'easy',session:'smoke-finished-peer',phase:'playing',mode:'guest',connected:true,peer:{name:'Peer'}}})")
        try await awaitTrue(webView, "!!window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden")
        _ = try await evaluate(webView, "InkBallNative.emit({event:'opponentFinished',data:{score:320,duration:8,cleared:true}}); InkBallNative.emit({event:'opponentLeft',data:{peer:{name:'Peer'},finished:true,cleared:true}})")
        let finishedPeerStaysFinished = try await evaluate(webView, "window.inkballApp.matchSync.opponentStatus==='completed' && document.querySelector('#status').textContent==='对手已完成并离开，你可以继续完成本局。' && !document.querySelector('#play-view').hidden") as? Bool
        XCTAssertEqual(finishedPeerStaysFinished, true)
        _ = try await evaluate(webView, "InkBallNative.emit({event:'matchResult',data:{outcome:'lost',local:{score:280,accuracy:100,duration:12},remote:{score:320,accuracy:100,duration:8}}})")
        try await awaitTrue(webView, "!document.querySelector('#result-view').hidden && document.querySelector('#result-outcome').textContent==='落败' && document.querySelector('#result-peer-score').textContent==='320'")
        _ = try await evaluate(webView, "document.querySelector('#result-continue').click()")
        try await awaitTrue(webView, "!document.querySelector('#maps-view').hidden")
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click(); document.querySelector('#profile-language').value='en'; document.querySelector('#profile-language').dispatchEvent(new Event('change'))")
        try await awaitTrue(webView, "document.documentElement.lang==='en'")
        try await awaitTrue(webView, "document.querySelector('.community-palette__item[data-token=\"U\"][data-attr=\"4\"]').title==='One-way wall · up · Yellow' && document.querySelector('.community-palette__item[data-token=\"r\"]').title==='Accelerator · right'")
        let untranslatedAfterPlay = try await evaluate(webView, "(() => { const found=new Set(), walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); while(walk.nextNode()){const n=walk.currentNode;if(!n.parentElement?.closest('script,style') && /[\\u3400-\\u9fff]/.test(n.nodeValue))found.add(n.nodeValue.trim())} for(const e of document.querySelectorAll('[aria-label],[title],[placeholder]'))for(const a of ['aria-label','title','placeholder']){const v=e.getAttribute(a);if(v && /[\\u3400-\\u9fff]/.test(v))found.add(v)} return [...found].sort().join(' | '); })()") as? String
        XCTAssertEqual(untranslatedAfterPlay, "")
        _ = try await evaluate(webView, "document.querySelector('#profile-dialog [data-close]').click(); document.querySelector('[data-route=personal]').click(); document.querySelector('#personal-create').click(); document.querySelector('#editor-name').value='English Map'; document.querySelector('#editor-save').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-status').textContent.length>0")
        let englishEditorError = try await evaluate(webView, "document.querySelector('#editor-status').textContent==='Add at least one ball and one hole.'") as? Bool
        XCTAssertEqual(englishEditorError, true)
    }
}
