const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { LANMatch, FrameDecoder, encodeFrame, outcome } = require('../../Windows/lan.cjs');
const { sample } = require('./fixtures.cjs');
const result = (score, duration = 10) => ({ score, duration, cleared: true, accuracy: 100 });
function event(match, name, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { match.removeListener('event', listener); reject(new Error(`Timed out waiting for ${name}: ${match.phase}`)); }, timeout);
    function listener(type, data) { if (type === name) { clearTimeout(timer); match.removeListener('event', listener); resolve(data); } }
    match.on('event', listener);
  });
}
async function pair(t) {
  const alice = { id: randomUUID(), name: 'Alice', avatar: 'default' }, bob = { id: randomUUID(), name: 'Bob', avatar: 'default' };
  const host = new LANMatch(() => alice, { countdownMs: 30 }), guest = new LANMatch(() => bob, { countdownMs: 30 });
  t.after(async () => { await host.close(); await guest.close(); });
  await host.start({ discovery: false }); await guest.start({ discovery: false });
  host.nearby.set(bob.id, { id: `wifi:${bob.id}`, name: bob.name, host: '127.0.0.1', port: guest.server.address().port });
  const invited = event(guest, 'matchInvitation'); host.invite(`wifi:${bob.id}`, sample(), 'easy'); await invited;
  const started = Promise.all([event(host, 'matchStart'), event(guest, 'matchStart')]); guest.accept(); await started;
  return { host, guest };
}
test('LAN framing handles split/coalesced packets and rejects oversized frames', () => {
  const packet = { version: 1, type: 'ping', payload: { token: 7 } }, first = encodeFrame(packet), decoder = new FrameDecoder();
  assert.deepEqual(decoder.append(first.subarray(0, 2)), []);
  const messages = decoder.append(Buffer.concat([first.subarray(2), first])); assert.equal(messages.length, 2);
  assert.deepEqual(JSON.parse(messages[0]), packet); const invalid = Buffer.alloc(4); invalid.writeUInt32BE(131073);
  assert.throws(() => new FrameDecoder().append(invalid));
});
test('two TCP peers exchange invitations, snapshots and mirrored results', async t => {
  const { host, guest } = await pair(t);
  assert.equal(guest.peer.name, 'Alice'); assert.equal(host.peer.name, 'Bob');
  assert.deepEqual(Object.keys(guest.map.difficulties), ['easy']);
  const snapshot = event(guest, 'opponentSnapshot'); host.send('snapshot', { sequence: 1, balls: [{ x: 42 }] }, false);
  assert.deepEqual(await snapshot, { sequence: 1, balls: [{ x: 42 }] });
  const finished = Promise.all([event(host, 'matchResult'), event(guest, 'matchResult')]); host.finish(result(100)); guest.finish(result(90));
  const [own, peer] = await finished; assert.equal(own.outcome, 'won'); assert.equal(peer.outcome, 'lost');
  assert.equal(host.map, null); assert.equal(guest.map, null);
});
test('completed peer may leave while the other player continues and receives final scoring', async t => {
  const { host, guest } = await pair(t), finishSeen = event(host, 'opponentFinished');
  guest.finish(result(90)); await finishSeen;
  const left = event(host, 'opponentLeft'); guest.leave(); assert.equal((await left).finished, true);
  assert.equal(host.phase, 'playing'); const resolved = event(host, 'matchResult'); host.finish(result(100));
  const final = await resolved; assert.equal(final.outcome, 'won'); assert.equal(final.remote.score, 90);
});
test('TCP interruption reconnects the same session and preserves finished results', async t => {
  const { host, guest } = await pair(t), session = host.session;
  const restored = Promise.all([event(host, 'matchReconnected'), event(guest, 'matchReconnected')]);
  guest.socket.destroy(); await restored;
  assert.equal(host.session, session); assert.equal(guest.session, session); assert.equal(host.phase, 'playing');
  const finished = Promise.all([event(host, 'matchResult'), event(guest, 'matchResult')]);
  host.finish(result(100, 8)); guest.finish(result(100, 12)); const outcomes = await finished;
  assert.equal(outcomes[0].outcome, 'won'); assert.equal(outcomes[1].outcome, 'lost');
});
test('outcome prioritizes clearing, then score, then elapsed time', () => {
  assert.equal(outcome(result(100), { ...result(999), cleared: false }), 'won');
  assert.equal(outcome(result(100, 12), result(100, 10)), 'lost'); assert.equal(outcome(result(100), result(100)), 'draw');
});
