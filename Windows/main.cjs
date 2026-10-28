'use strict';
const { app, BrowserWindow, Menu, protocol, ipcMain, session, clipboard, nativeImage, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { LocalStore, requireValid } = require('./store.cjs');
const { LANMatch } = require('./lan.cjs');
const { resolveResource } = require('./resources.cjs');
const root = path.join(__dirname, '..');
const webRoot = path.join(root, 'Web');
// Read one version source at build time; package version is checked against AppInfo.plist.
const version = require('../package.json').version;
protocol.registerSchemesAsPrivileged([{ scheme: 'spherail', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setAppUserModelId('au.edu.sydney.spherail.windows');
const testData = process.argv.find(value => value.startsWith('--spherail-test-data='))?.slice('--spherail-test-data='.length);
if (testData) app.setPath('userData', path.resolve(testData));
let window, store, matches;
const noDiscovery = process.argv.includes('--spherail-no-discovery');
if (!testData && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    const catalogue = JSON.parse(fs.readFileSync(path.join(webRoot, 'official-achievements.json'), 'utf8'));
    store = new LocalStore(path.join(app.getPath('userData'), 'InkBall'), catalogue, value => {
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value)) return false;
      const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
      if (bytes.length > 16384 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
      const image = nativeImage.createFromBuffer(bytes), size = image.getSize();
      return !image.isEmpty() && size.width === 96 && size.height === 96;
    });
    matches = new LANMatch(() => store.profile());
    matches.on('event', (event, data) => { if (window && !window.isDestroyed()) window.webContents.send('spherail:event', { event, data }); });
    protocol.handle('spherail', request => {
      try {
        const { file, mime } = resolveResource(webRoot, request.url);
        return new Response(fs.readFileSync(file), { headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" } });
      } catch { return new Response('Resource not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);
      callback({ cancel: !((url.protocol === 'spherail:' && url.hostname === 'app') || ['data:', 'blob:', 'devtools:'].includes(url.protocol)) });
    });
    ipcMain.handle('spherail:call', async (event, action, payload = {}) => {
      requireValid(event.sender === window?.webContents && event.senderFrame === window.webContents.mainFrame
        && event.senderFrame.url === 'spherail://app/index.html', 'Invalid app command origin.');
      requireValid(typeof action === 'string' && payload && typeof payload === 'object' && !Array.isArray(payload)
        && Buffer.byteLength(JSON.stringify(payload)) <= 300000, 'Invalid app command.');
      switch (action) {
        case 'bootstrap':
          if (!noDiscovery) await matches.start().catch(error => matches.notify('matchError', { message: error.message }));
          return { appInfo: { version, build: '5', platform: 'windows', capabilities: { wifi: true, bluetooth: false } }, profile: store.profile(),
            maps: store.maps(), records: store.records(), achievements: store.achievements(), match: matches.state() };
        case 'profile': return store.profile();
        case 'updateLanguage': return store.updateLanguage(payload.language);
        case 'updateProfile': { const profile = store.updateProfile(payload); matches.updateProfile(); return profile; }
        case 'maps': return { maps: store.maps() };
        case 'map': return store.map(payload.id);
        case 'saveMap': return store.saveMap(payload.map);
        case 'deleteMap': return store.deleteMap(payload.id);
        case 'exportMap': return { code: store.exportMap(payload) };
        case 'importMap': return store.importMap(payload.code);
        case 'exportDifficultyCode': return { code: store.exportDifficulty(payload.level, payload.author) };
        case 'importDifficultyCode': return { level: store.importDifficulty(payload.code) };
        case 'recordResult': return store.recordResult(payload);
        case 'copyText': requireValid(typeof payload.text === 'string', 'Invalid clipboard text.'); clipboard.writeText(payload.text); return { ok: true };
        case 'matchState': return matches.state();
        case 'matchInvite': return matches.invite(payload.id, payload.map, payload.difficulty);
        case 'matchAccept': return matches.accept();
        case 'matchDecline': return matches.decline();
        case 'matchSend': if (matches.phase === 'playing' && !matches.peerLeft) matches.send('snapshot', payload.snapshot, false); return { ok: true };
        case 'matchFinish': return matches.finish(payload);
        case 'matchLeave': return matches.leave();
        case 'openBluetoothSettings': return { ok: true, supported: false };
        default: throw new Error('Unknown app command.');
      }
    });
    window = new BrowserWindow({ width: 1100, height: 820, minWidth: 720, minHeight: 620, title: 'Spherail',
      backgroundColor: '#173d40', show: !process.argv.includes('--spherail-hidden'),
      icon: path.join(root, 'Assets', 'Windows', 'Spherail.ico'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: !testData } });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Spherail', submenu: [{ role: 'quit', label: '退出 / Quit' }] },
      { label: '编辑 / Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '视图 / View', submenu: [{ role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    ]));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (url !== 'spherail://app/index.html') event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    await window.loadURL('spherail://app/index.html');
  }).catch(error => { console.error(error); if (!testData) dialog.showErrorBox('Spherail', error.message); app.exit(1); });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { matches?.close().catch(() => {}); });
