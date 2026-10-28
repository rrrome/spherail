'use strict';
const net = require('node:net');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { randomUUID, createHash } = require('node:crypto');
const { Bonjour } = require('bonjour-service');
const { stableJSON, validateMap, requireValid } = require('./store.cjs');
const maximumBodySize = 131072;
// Foundation JSONSerialization escapes forward slashes unless explicitly disabled.
const mapDigest = map => createHash('sha256').update(stableJSON(map).replaceAll('/', '\\/')).digest('hex');

class FrameDecoder {
  constructor() { this.pending = Buffer.alloc(0); }
  append(chunk) {
    this.pending = Buffer.concat([this.pending, chunk]);
    const messages = [];
    while (this.pending.length >= 4) {
      const length = this.pending.readUInt32BE(0);
      requireValid(length > 0 && length <= maximumBodySize, 'Invalid LAN frame length.');
      if (this.pending.length < length + 4) break;
      messages.push(this.pending.subarray(4, 4 + length));
      this.pending = this.pending.subarray(4 + length);
    }
    return messages;
  }
}
function encodeFrame(packet) {
  const body = Buffer.from(JSON.stringify(packet));
  requireValid(body.length > 0 && body.length <= maximumBodySize, 'LAN message is too large.');
  const frame = Buffer.alloc(4 + body.length); frame.writeUInt32BE(body.length); body.copy(frame, 4); return frame;
}
function outcome(local, remote) {
  const order = Boolean(local.cleared) !== Boolean(remote.cleared) ? (local.cleared ? 1 : -1)
    : local.score !== remote.score ? Math.sign(local.score - remote.score)
      : Math.sign((remote.duration ?? Infinity) - (local.duration ?? Infinity)) || 0;
  return order > 0 ? 'won' : order < 0 ? 'lost' : 'draw';
}

class LANMatch extends EventEmitter {
  constructor(profile, { countdownMs = 3000, reconnectMs = 20000 } = {}) {
    super(); this.profile = profile; this.countdownMs = countdownMs; this.reconnectMs = reconnectMs;
    this.nearby = new Map(); this.timers = new Map(); this.reset();
  }
  reset() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    const socket = this.socket; this.socket = null; socket?.destroy();
    Object.assign(this, { mode: 'idle', phase: 'idle', session: '', peer: {}, map: null, difficulty: 'easy',
      localFinish: null, remoteFinish: null, peerLeft: false, latencyMs: null, target: null, lastInbound: Date.now() });
  }
  timer(name, delay, callback) { clearTimeout(this.timers.get(name)); this.timers.set(name, setTimeout(callback, delay)); }
  cancel(name) { clearTimeout(this.timers.get(name)); this.timers.delete(name); }
  state() {
    return { mode: this.mode, phase: this.phase, session: this.session, bluetoothState: 'unsupported',
      wifiState: this.server?.listening ? 'ready' : 'unavailable', transport: this.mode === 'idle' ? 'none' : 'wifi',
      connected: !!this.socket && !this.socket.destroyed && !this.socket.connecting, code: '', peer: this.peer,
      map: this.map, difficulty: this.difficulty, localReady: ['countdown', 'playing'].includes(this.phase),
      remoteReady: ['countdown', 'playing'].includes(this.phase), signalDBm: null, latencyMs: this.latencyMs,
      peers: [...this.nearby.values()].map(({ host, port, source, ...peer }) => peer).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  notify(event, data = {}) { this.emit('event', event, data); if (event !== 'matchState') this.emit('event', 'matchState', this.state()); }
  async start({ discovery = true } = {}) {
    if (this.server) return;
    this.server = net.createServer(socket => {
      if (this.socket || !(this.mode === 'idle' || (this.mode === 'guest' && this.phase === 'reconnecting'))) return socket.destroy();
      this.attach(socket);
      this.timer('incoming', 10000, () => { if (this.mode === 'idle') { this.reset(); this.notify('matchState', this.state()); } });
    });
    this.server.on('error', error => this.notify('matchError', { message: `LAN: ${error.message}` }));
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '0.0.0.0', () => { this.server.removeListener('error', reject); resolve(); }); });
    if (discovery) {
      // Windows can select an inactive virtual adapter for 224.0.0.251 when
      // multicastInterface is 0.0.0.0. Advertise/query on each usable IPv4 NIC.
      const interfaces = [...new Set(Object.values(os.networkInterfaces()).flat()
        .filter(item => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'))
        .map(item => item.address))];
      this.discovery = (interfaces.length ? interfaces : ['127.0.0.1']).map(address => {
        const bonjour = new Bonjour({ interface: address, bind: '0.0.0.0' }, error => this.notify('matchError', { message: `Local discovery: ${error.message}` }));
        bonjour.server.mdns.on('error', error => this.notify('matchError', { message: `Local discovery: ${error.message}` }));
        const browser = bonjour.find({ type: 'inkball', protocol: 'tcp' });
        const update = service => this.discovered(service);
        browser.on('up', update); browser.on('txt-update', update); browser.on('srv-update', update);
        browser.on('down', service => {
          const peer = this.nearby.get(String(service.txt?.id));
          if (peer && peer.source === service.fqdn) this.nearby.delete(String(service.txt.id));
          this.notify('matchState', this.state());
        });
        return { address, bonjour, browser };
      });
      this.advertise();
      this.discoveryTimer = setInterval(() => { for (const item of this.discovery ?? []) { item.browser.expire(); item.browser.update(); } }, 5000);
    }
    this.notify('matchState', this.state());
  }
  advertise() {
    if (!this.discovery) return;
    const profile = this.profile();
    for (const [index, item] of this.discovery.entries()) {
      item.service?.stop();
      item.service = item.bonjour.publish({ name: `Spherail-${profile.id.slice(0, 8)}-${index}`, type: 'inkball', protocol: 'tcp',
        port: this.server.address().port, txt: { id: profile.id, name: profile.name, avatar: profile.avatar, device: os.hostname(), version: '1' } });
      item.service.on('error', error => this.notify('matchError', { message: error.message }));
    }
  }
  discovered(service) {
    const fields = service.txt ?? {}, id = String(fields.id ?? '');
    if (String(fields.version) !== '1' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id) || id === this.profile().id) return;
    const addresses = service.addresses ?? [];
    const host = net.isIP(service.referer?.address ?? '') === 4 ? service.referer.address
      : addresses.find(address => net.isIP(address) === 4 && !address.startsWith('127.')) ?? addresses.find(address => net.isIP(address) === 4);
    if (!host || !Number.isInteger(service.port) || service.port < 1 || service.port > 65535) return;
    this.nearby.set(id, { id: `wifi:${id}`, playerID: id, name: String(fields.name ?? 'Spherail player').slice(0, 50),
      avatar: String(fields.avatar ?? ''), deviceName: String(fields.device ?? 'Computer').slice(0, 50),
      transport: 'Wi-Fi', hasWiFi: true, hasBluetooth: false, rssi: null, host, port: service.port, source: service.fqdn });
    this.notify('matchState', this.state());
  }
  attach(socket) {
    this.socket = socket; socket.setNoDelay(true); socket.setKeepAlive(true, 3000);
    const decoder = new FrameDecoder(); this.controlFrames = []; this.snapshotFrame = null; this.writing = false;
    socket.on('error', () => {});
    socket.on('data', chunk => {
      if (this.socket !== socket) return;
      try { for (const message of decoder.append(chunk)) this.receive(JSON.parse(message.toString('utf8'))); }
      catch { socket.destroy(); }
    });
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.phase === 'playing' && !this.peerLeft) this.reconnect();
      else if (!['idle', 'finished', 'reconnecting'].includes(this.phase)) { this.reset(); this.notify('matchError', { message: 'The LAN connection was interrupted.' }); }
    });
  }
  send(type, payload, priority = true) {
    if (!this.socket || this.socket.destroyed || this.socket.connecting) return;
    const frame = encodeFrame({ version: 1, type, session: this.session, payload });
    if (priority) {
      if (this.controlFrames.length > 128) { this.socket.destroy(); return; }
      this.controlFrames.push(frame);
    } else this.snapshotFrame = frame;
    this.pump();
  }
  pump() {
    if (this.writing || !this.socket || this.socket.destroyed) return;
    const frame = this.controlFrames.shift() ?? this.snapshotFrame;
    if (!frame) return;
    if (!this.controlFrames.length && frame === this.snapshotFrame) this.snapshotFrame = null;
    this.writing = true; const socket = this.socket;
    socket.write(frame, () => { if (this.socket === socket) { this.writing = false; this.pump(); } });
  }
  invite(identifier, map, difficulty) {
    requireValid(this.mode === 'idle', 'A match is already in progress.');
    const target = this.nearby.get(identifier.replace(/^wifi:/, ''));
    requireValid(target && map?.difficulties?.[difficulty], 'This Spherail player or difficulty is no longer available.');
    validateMap(map, !!map.official);
    this.mode = 'host'; this.phase = 'connecting'; this.session = randomUUID().toUpperCase(); this.target = target;
    this.map = { ...map, difficulties: { [difficulty]: map.difficulties[difficulty] } };
    this.difficulty = difficulty; this.peer = target;
    this.connect();
    this.timer('invitation', 30000, () => { this.reset(); this.notify('matchError', { message: 'Invitation timed out. Try again.' }); });
    return this.state();
  }
  connect() {
    if (this.socket || !this.target) return;
    const socket = net.createConnection({ host: this.target.host, port: this.target.port }); this.attach(socket);
    socket.once('connect', () => {
      if (this.phase === 'connecting') this.send('invite', { map: this.map, difficulty: this.difficulty, digest: mapDigest(this.map), profile: this.profile(), transport: 2 });
      else if (this.phase === 'reconnecting') this.send('hello', { profile: this.profile() });
    });
    this.timer('connect', 5000, () => { if (socket.connecting) socket.destroy(); });
  }
  accept() { requireValid(this.mode === 'guest' && this.phase === 'invited', 'No incoming invitation.'); this.phase = 'accepted'; this.send('accepted', { profile: this.profile(), transport: 2 }); return this.state(); }
  decline() { if (this.phase === 'invited') { this.send('declined', {}); this.phase = 'finished'; this.timer('leave', 750, () => this.reset()); this.notify('matchDeclined'); } return this.state(); }
  countdown() {
    this.cancel('invitation'); this.phase = 'countdown';
    this.notify('matchCountdown', { seconds: this.countdownMs / 1000, match: this.state() });
    this.timer('countdown', this.countdownMs, () => {
      if (this.phase !== 'countdown' || !this.socket) return;
      this.phase = 'playing'; this.metrics(); this.notify('matchStart', this.state());
    });
  }
  receive(packet) {
    if (packet?.version !== 1 || !packet.payload || typeof packet.payload !== 'object' || Array.isArray(packet.payload)) return;
    const { type, payload, session } = packet;
    if (type !== 'invite' && (!this.session || session !== this.session)) return;
    this.lastInbound = Date.now();
    switch (type) {
      case 'invite':
        if (this.mode !== 'idle' || typeof session !== 'string' || !/^[\da-f-]{36}$/i.test(session) || !payload.map?.difficulties?.[payload.difficulty] || payload.digest !== mapDigest(payload.map)) return;
        validateMap(payload.map, !!payload.map.official);
        this.cancel('incoming'); this.mode = 'guest'; this.phase = 'invited'; this.session = session;
        this.map = payload.map; this.difficulty = payload.difficulty; this.peer = payload.profile ?? {};
        this.timer('invitation', 30000, () => this.decline()); this.notify('matchInvitation', this.state()); break;
      case 'accepted':
        if (this.mode !== 'host' || this.peerLeft) break;
        this.peer = payload.profile ?? {};
        if (payload.resumed && this.phase === 'reconnecting') this.resumed();
        else if (this.phase === 'connecting') { this.send('start', { seconds: 3 }); this.countdown(); } break;
      case 'start': if (this.mode === 'guest' && this.phase === 'accepted') this.countdown(); break;
      case 'declined': this.reset(); this.notify('matchDeclined'); break;
      case 'snapshot': if (this.phase === 'playing' && !this.peerLeft) this.emit('event', 'opponentSnapshot', payload); break;
      case 'finish': if (['playing', 'reconnecting'].includes(this.phase)) { this.remoteFinish = this.validResult(payload); this.notify('opponentFinished', this.remoteFinish); this.resolveResult(); } break;
      case 'result':
        if (this.mode !== 'guest' || this.peerLeft || !['playing', 'reconnecting'].includes(this.phase) || !['won', 'lost', 'draw'].includes(payload.outcome)) break;
        this.validResult(payload.local); this.validResult(payload.remote); this.phase = 'finished'; this.map = null; this.cancel('metrics'); this.notify('matchResult', payload); break;
      case 'leave': if (payload.finish && !this.remoteFinish) this.remoteFinish = this.validResult(payload.finish); this.peerLeave(); break;
      case 'hello': if (this.mode === 'guest' && this.phase === 'reconnecting' && !this.peerLeft) { this.send('accepted', { profile: this.profile(), resumed: true, transport: 2 }); this.resumed(); } break;
      case 'ping': if (this.mode === 'guest') this.send('pong', { token: payload.token }); break;
      case 'pong':
        if (this.mode === 'host' && payload.token === this.pingToken) {
          this.latencyMs = Math.max(0, Date.now() - this.pingToken * 1000); this.pingToken = null;
          this.send('metrics', { latencyMs: this.latencyMs, signalDBm: null }); this.emit('event', 'matchMetrics', { latencyMs: this.latencyMs });
        } break;
      case 'metrics': if (this.mode === 'guest' && Number.isFinite(payload.latencyMs)) { this.latencyMs = payload.latencyMs; this.emit('event', 'matchMetrics', { latencyMs: this.latencyMs }); } break;
      case 'profile': this.peer = payload.profile ?? {}; this.notify('matchProfile', this.state()); break;
    }
  }
  validResult(value) {
    requireValid(value && typeof value.cleared === 'boolean' && ['score', 'duration', 'accuracy'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0), 'Invalid match result.');
    return { score: value.score, duration: value.duration, accuracy: value.accuracy, cleared: value.cleared };
  }
  finish(result) {
    if (['playing', 'reconnecting'].includes(this.phase) && !this.localFinish) { this.localFinish = this.validResult(result); this.send('finish', this.localFinish); this.resolveResult(); }
    return this.state();
  }
  resolveResult() {
    if (!this.localFinish || !['playing', 'reconnecting'].includes(this.phase)) return;
    if (this.peerLeft) {
      this.phase = 'finished'; this.map = null;
      this.notify('matchResult', { outcome: this.remoteFinish ? outcome(this.localFinish, this.remoteFinish) : 'won', reason: this.peerExitReason,
        local: this.localFinish, ...(this.remoteFinish ? { remote: this.remoteFinish } : {}) });
    } else if (this.mode === 'host' && this.remoteFinish && this.phase === 'playing') {
      this.send('result', { outcome: outcome(this.remoteFinish, this.localFinish), local: this.remoteFinish, remote: this.localFinish });
      this.phase = 'finished'; this.map = null; this.cancel('metrics');
      this.notify('matchResult', { outcome: outcome(this.localFinish, this.remoteFinish), local: this.localFinish, remote: this.remoteFinish });
    }
  }
  peerLeave(reason = 'opponent_left') {
    if (this.phase === 'finished' || this.peerLeft) return;
    if (!['playing', 'reconnecting'].includes(this.phase)) { this.reset(); this.notify('matchDeclined'); return; }
    this.peerLeft = true; this.peerExitReason = reason; this.phase = 'playing';
    for (const name of ['reconnect', 'retry', 'metrics']) this.cancel(name);
    this.notify('opponentLeft', { peer: this.peer, reason, finished: !!this.remoteFinish, cleared: !!this.remoteFinish?.cleared }); this.resolveResult();
  }
  leave() {
    if (this.phase === 'finished' || !this.socket) { this.reset(); this.notify('matchLeft'); }
    else { this.send('leave', this.localFinish ? { finish: this.localFinish } : {}); this.phase = 'finished'; this.map = null;
      this.timer('leave', 750, () => { this.reset(); this.notify('matchLeft'); }); }
    return this.state();
  }
  reconnect() {
    this.phase = 'reconnecting'; this.cancel('metrics'); this.notify('matchDisconnected', { seconds: this.reconnectMs / 1000 });
    this.timer('reconnect', this.reconnectMs, () => this.peerLeave('disconnect_timeout'));
    const retry = () => { if (this.phase !== 'reconnecting') return; if (this.mode === 'host') this.connect(); this.timer('retry', 1000, retry); };
    retry();
  }
  resumed() { this.cancel('reconnect'); this.cancel('retry'); this.phase = 'playing'; if (this.localFinish) this.send('finish', this.localFinish); this.metrics(); this.notify('matchReconnected'); this.resolveResult(); }
  metrics() {
    this.lastInbound = Date.now();
    const tick = () => {
      if (this.phase !== 'playing' || this.peerLeft) return;
      if (Date.now() - this.lastInbound > 20000) { this.socket?.destroy(); return; }
      if (this.mode === 'host') { this.pingToken = Date.now() / 1000; this.send('ping', { token: this.pingToken }); }
      this.timer('metrics', 2000, tick);
    }; tick();
  }
  updateProfile() { this.advertise(); this.send('profile', { profile: this.profile() }); }
  async close() {
    clearInterval(this.discoveryTimer);
    this.reset();
    for (const item of this.discovery ?? []) { item.browser.stop(); item.service?.stop(); item.bonjour.destroy(); }
    this.discovery = null;
    if (this.server?.listening) await new Promise(resolve => this.server.close(resolve)); this.server = null;
  }
}
module.exports = { LANMatch, FrameDecoder, encodeFrame, outcome, mapDigest };
