// Exercise real multicast discovery and TCP, using two isolated player profiles.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { LANMatch } = require('../Windows/lan.cjs');
const { sample } = require('../Tests/Windows/fixtures.cjs');
const alice = { id: randomUUID().toUpperCase(), name: 'Spherail LAN Test A', avatar: 'default' };
const bob = { id: randomUUID().toUpperCase(), name: 'Spherail LAN Test B', avatar: 'default' };
const host = new LANMatch(() => alice), guest = new LANMatch(() => bob);
const waitEvent = (peer, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { peer.removeListener('event', listener); reject(new Error(`Timed out: ${name}`)); }, 10000);
  const listener = (type, value) => { if (type === name) { clearTimeout(timer); peer.removeListener('event', listener); resolve(value); } };
  peer.on('event', listener);
});
(async () => {
  try {
    await host.start(); await guest.start();
    const deadline = Date.now() + 20000;
    while ((!host.nearby.has(bob.id) || !guest.nearby.has(alice.id)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(host.nearby.has(bob.id), 'Host must discover the guest over mDNS');
    assert.ok(guest.nearby.has(alice.id), 'Guest must discover the host over mDNS');
    console.log('PASS: real Bonjour multicast discovers both Windows player identities');
    const invited = waitEvent(guest, 'matchInvitation'); host.invite(`wifi:${bob.id}`, sample(), 'easy'); await invited;
    const started = Promise.all([waitEvent(host, 'matchStart'), waitEvent(guest, 'matchStart')]); guest.accept(); await started;
    const received = waitEvent(guest, 'opponentSnapshot'); host.send('snapshot', { sequence: 1, balls: [] }, false); assert.equal((await received).sequence, 1);
    const results = Promise.all([waitEvent(host, 'matchResult'), waitEvent(guest, 'matchResult')]);
    host.finish({ cleared: true, score: 100, duration: 10, accuracy: 100 }); guest.finish({ cleared: true, score: 90, duration: 10, accuracy: 100 });
    const [own, peer] = await results; assert.equal(own.outcome, 'won'); assert.equal(peer.outcome, 'lost');
    console.log('PASS: discovered peers complete an invitation, countdown, snapshot exchange and full result');
  } finally { await host.close(); await guest.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
