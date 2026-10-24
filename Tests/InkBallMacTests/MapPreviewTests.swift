import AppKit
import WebKit
import XCTest

extension WebSmokeTests {
    func testCompleteMapPreviewsAndDifficultySwitching() async throws {
        _ = NSApplication.shared
        let config = WKWebViewConfiguration()
        configureAppResources(config)
        // Exercise priority independently of JSON key order and absent difficulties.
        config.userContentController.addUserScript(WKUserScript(source: """
            Object.defineProperty(window, 'INKBALL_OFFICIAL', {
              configurable: true,
              set(value) {
                const maps = value.maps;
                const first = maps[0].difficulties;
                maps[0].difficulties = {master:first.master, hard:first.hard, easy:first.easy};
                delete maps[1].difficulties.easy;
                delete maps[2].difficulties.easy;
                delete maps[2].difficulties.hard;
                Object.defineProperty(window, 'INKBALL_OFFICIAL', {value, configurable:true});
              }
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let bridge = MockBridge()
        config.userContentController.add(bridge, name: "inkball")
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 780), configuration: config)
        bridge.webView = webView
        let loaded = expectation(description: "Preview test page loads")
        let nav = Navigation(loaded)
        webView.navigationDelegate = nav
        loadApp(webView)
        await fulfillment(of: [loaded], timeout: 10)
        try await awaitTrue(webView, "document.querySelectorAll('#official-map-list .is-preview-ready').length===30")
        let priority = try await evaluate(webView, """
            (() => {
              const previews = JSON.parse(document.querySelector('#inkball-maps').textContent);
              return ['easy','hard','master'].every((d,i) =>
                previews[i].layout.layout_content === INKBALL_OFFICIAL.maps[i].difficulties[d].layout_content);
            })()
            """) as? Bool
        XCTAssertEqual(priority, true)
        let completeElements = try await evaluate(webView, """
            (() => {
              const cells = ['B2','K3','U1','D2','L3','R4','C1','T9','u ','d ','l ','r ',
                'Y2','V3','G4','H1','S ','X ','1 ','2 ','3 ','4 ','Au'];
              const grid = Array.from({length:18}, () => Array(18).fill('  '));
              const positions = cells.map((cell,i) => {
                const x = 2 + (i%5)*3, y = 2 + Math.floor(i/5)*3;
                grid[y][x] = cell;
                return {x,y,cell};
              });
              const level = {layout_content:grid.map(row=>row.join('')).join('\\n'), balls:['grey','blue']};
              const floor = document.createElement('canvas'), board = document.createElement('canvas');
              InkballMapPreview.drawLayersSync(floor, board, level);
              const ctx = board.getContext('2d');
              const visible = positions.every(({x,y}) => {
                const data = ctx.getImageData(x*32,y*32,32,32).data;
                return data.some((value,i) => i%4===3 && value>0);
              });
              const composite = document.createElement('canvas');
              InkballMapPreview.drawSync(composite, level);
              const before = composite.toDataURL();
              InkballMapPreview.drawSync(composite, {...level,balls:[]});
              // The preview excludes the queue while keeping all placed elements.
              return visible && before===composite.toDataURL();
            })()
            """)
        XCTAssertEqual(completeElements as? Bool, true)
        let differencesOnly = try await evaluate(webView, """
            (() => {
              const grid=Array.from({length:18},()=>Array(18).fill('  '));
              grid[1][1]='S '; grid[3][3]='K1'; grid[4][6]='C1'; grid[7][7]='B2';
              grid[9][11]='H2'; grid[12][3]='T9'; grid[14][6]='R1';
              const before={layout_content:grid.map(row=>row.join('')).join('\\n'),balls:['grey']};
              grid[4][6]='C2'; grid[9][11]='H3'; grid[12][3]='T8'; grid[14][6]='  '; grid[14][10]='r ';
              const after={layout_content:grid.map(row=>row.join('')).join('\\n'),balls:['blue']};
              const canvases=Array.from({length:4},()=>document.createElement('canvas'));
              const [floor,stable,outgoing,incoming]=canvases;
              canvases.forEach(c=>document.querySelector('#detail-hero').append(c));
              const changed=InkballMapPreview.drawDifferenceLayersSync(floor,stable,outgoing,incoming,before,after);
              const visible=(canvas,x,y)=>canvas.getContext('2d').getImageData(x*32,y*32,32,32).data.some((v,i)=>i%4===3 && v>0);
              const unchanged=[[1,1],[3,3],[7,7],[0,0]].every(([x,y])=>
                visible(stable,x,y) && !visible(outgoing,x,y) && !visible(incoming,x,y));
              const replaced=[[6,4],[11,9],[3,12]].every(([x,y])=>
                !visible(stable,x,y) && visible(outgoing,x,y) && visible(incoming,x,y));
              const removed=visible(outgoing,6,14) && !visible(incoming,6,14) && !visible(stable,6,14);
              const added=visible(incoming,10,14) && !visible(outgoing,10,14) && !visible(stable,10,14);
              const same=!InkballMapPreview.drawDifferenceLayersSync(floor,stable,outgoing,incoming,after,{...after,balls:[]});
              canvases.forEach(c=>c.remove());
              return changed && unchanged && replaced && removed && added && same;
            })()
            """) as? Bool
        XCTAssertEqual(differencesOnly, true)
        _ = try await evaluate(webView, """
            // Layer compositing can round colour channels by one byte.
            window.previewPixelsMatch=(a,b)=>{
              const aa=a.getContext('2d').getImageData(0,0,576,576).data;
              const bb=b.getContext('2d').getImageData(0,0,576,576).data;
              return aa.every((v,i)=>Math.abs(v-bb[i])<=1);
            }; true;
            """)
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click()")
        let profileControls = try await evaluate(webView, """
            (() => {
              const slider=document.querySelector('#profile-detail-transparency');
              const avatar=document.querySelector('#profile-avatar-preview').getBoundingClientRect();
              const edit=document.querySelector('#profile-avatar-choose'), box=edit.getBoundingClientRect();
              return slider.value==='20' && !!edit.querySelector('svg') &&
                box.left>avatar.left+avatar.width/2 && box.top>avatar.top+avatar.height/2 &&
                document.querySelector('#profile-transparency-preview').getBoundingClientRect().top>slider.getBoundingClientRect().bottom;
            })()
            """) as? Bool
        XCTAssertEqual(profileControls, true)
        for value in [0, 35, 100] {
            _ = try await evaluate(webView, "(() => { const slider=document.querySelector('#profile-detail-transparency'); slider.value='\(value)'; slider.dispatchEvent(new Event('input')); return true; })()")
            let opacity = try await evaluate(webView, "getComputedStyle(document.querySelector('.map-detail__ui')).opacity") as? String
            XCTAssertEqual(Double(opacity ?? "") ?? -1, 1 - Double(value)/100, accuracy: 0.001)
            let previewOpacity = try await evaluate(webView, "getComputedStyle(document.querySelector('.profile-transparency-preview__ui')).opacity") as? String
            XCTAssertEqual(previewOpacity, opacity)
        }
        _ = try await evaluate(webView, "document.querySelector('[data-close=profile-dialog]').click()")
        try await awaitTrue(webView, "getComputedStyle(document.querySelector('.map-detail__ui')).opacity==='0.8'")
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click(); document.querySelector('#profile-detail-transparency').value='35'; document.querySelector('#profile-detail-transparency').dispatchEvent(new Event('input')); document.querySelector('#profile-save').click()")
        try await awaitTrue(webView, "!document.querySelector('#profile-dialog').open")
        XCTAssertEqual(bridge.detailTransparency, 35)
        _ = try await evaluate(webView, "document.querySelector('#profile-open').click()")
        let restored = try await evaluate(webView, "document.querySelector('#profile-detail-transparency').value==='35' && document.querySelector('#profile-detail-transparency-value').textContent==='35'") as? Bool
        XCTAssertEqual(restored, true)
        _ = try await evaluate(webView, "document.querySelector('[data-close=profile-dialog]').click()")
        for (index, difficulty) in ["easy", "hard", "master"].enumerated() {
            _ = try await evaluate(webView, "document.querySelector('#official-map-list .map-card[data-map-index=\"\(index)\"]').click()")
            try await awaitTrue(webView, "document.querySelector('#detail-board').dataset.renderedDifficulty==='\(difficulty)' && !document.querySelector('#detail-view').classList.contains('is-map-entering')")
            let correct = try await evaluate(webView, """
                (() => {
                  const floor=document.querySelector('#detail-floor'), board=document.querySelector('#detail-board');
                  const actual=document.createElement('canvas'); actual.width=actual.height=576;
                  actual.getContext('2d').drawImage(floor,0,0); actual.getContext('2d').drawImage(board,0,0);
                  // Use the same DOM font context for timer labels.
                  const expected=document.createElement('canvas'); document.querySelector('#detail-hero').append(expected);
                  InkballMapPreview.drawSync(expected,INKBALL_OFFICIAL.maps[\(index)].difficulties.\(difficulty));
                  expected.remove();
                  return previewPixelsMatch(actual,expected) &&
                    document.querySelector('#detail-difficulties .active').dataset.detailDifficulty==='\(difficulty)';
                })()
                """) as? Bool
            XCTAssertEqual(correct, true)
            if index == 0 {
                _ = try await evaluate(webView, "window.previewFloorBefore=document.querySelector('#detail-floor').toDataURL(); document.querySelector('[data-detail-difficulty=master]').click()")
                let fades = try await evaluate(webView, "matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('#detail-board').dataset.transitioning==='true'") as? Bool
                XCTAssertEqual(fades, true)
                _ = try await evaluate(webView, "document.querySelector('[data-detail-difficulty=hard]').click(); document.querySelector('[data-detail-difficulty=easy]').click(); document.querySelector('[data-detail-difficulty=master]').click()")
                try await awaitTrue(webView, "document.querySelector('#detail-board').dataset.renderedDifficulty==='master' && document.querySelector('#detail-board').dataset.transitioning!=='true'")
                let latest = try await evaluate(webView, """
                    (() => {
                      const expected=document.createElement('canvas'), floor=document.createElement('canvas');
                      document.querySelector('#detail-hero').append(expected);
                      InkballMapPreview.drawLayersSync(floor,expected,INKBALL_OFFICIAL.maps[0].difficulties.master);
                      expected.remove();
                      return expected.toDataURL()===document.querySelector('#detail-board').toDataURL() &&
                        window.previewFloorBefore===document.querySelector('#detail-floor').toDataURL();
                    })()
                    """) as? Bool
                XCTAssertEqual(latest, true)
            }
            _ = try await evaluate(webView, "document.querySelector('[data-route=maps]').click()")
        }
        _ = try await evaluate(webView, "document.querySelector('[data-route=personal]').click(); document.querySelector('#personal-create').click()")
        try await awaitTrue(webView, "!document.querySelector('#editor-view').hidden")
        let spawnLast = try await evaluate(webView, "document.querySelector('.community-palette__group:first-child .community-palette__item:last-child').dataset.token==='S'") as? Bool
        XCTAssertEqual(spawnLast, true)
        _ = try await evaluate(webView, "(() => { const source=document.querySelectorAll('#editor-serve-source button'); for(let i=0;i<40;i++)source[i%5].click(); return true; })()")
        let scrollWindow = try await evaluate(webView, """
            (() => {
              const queue=document.querySelector('#editor-serve-list'), items=[...queue.querySelectorAll('button')];
              return items.length===40 && queue.scrollWidth>queue.clientWidth && queue.clientHeight<80 &&
                items.every(item=>Math.abs(item.getBoundingClientRect().top-items[0].getBoundingClientRect().top)<1) &&
                queue.querySelector('.community-serve__number').textContent==='1' &&
                items.at(-1).querySelector('.community-serve__number').textContent==='40';
            })()
            """) as? Bool
        XCTAssertEqual(scrollWindow, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-serve-list').scrollLeft=0")
        try await awaitTrue(webView, "document.querySelector('#editor-serve-prev').disabled && !document.querySelector('#editor-serve-next').disabled")
        _ = try await evaluate(webView, "document.querySelector('#editor-serve-next').click()")
        try await awaitTrue(webView, "document.querySelector('#editor-serve-list').scrollLeft>0")
        _ = try await evaluate(webView, "(() => { const list=document.querySelector('#editor-serve-list'); list.scrollLeft=0; list.dispatchEvent(new WheelEvent('wheel',{deltaY:60,bubbles:true,cancelable:true})); return true; })()")
        let wheelScrolls = try await evaluate(webView, "document.querySelector('#editor-serve-list').scrollLeft>0") as? Bool
        XCTAssertEqual(wheelScrolls, true)
        _ = try await evaluate(webView, "(() => { const items=document.querySelectorAll('#editor-serve-list button'), transfer=new DataTransfer(); transfer.setData('application/x-inkball-ball-index','0'); items[1].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer})); return true; })()")
        let reordered = try await evaluate(webView, "document.querySelector('#editor-serve-list button img').alt==='orange' && document.querySelector('#editor-serve-list button:nth-child(2) img').alt==='grey'") as? Bool
        XCTAssertEqual(reordered, true)
        _ = try await evaluate(webView, "document.querySelector('#editor-serve-list button').click()")
        let removed = try await evaluate(webView, "document.querySelectorAll('#editor-serve-list button').length===39 && document.querySelector('#editor-serve-list button img').alt==='grey'") as? Bool
        XCTAssertEqual(removed, true)
    }

}
