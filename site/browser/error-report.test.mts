import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorReportBootstrap } from '../startup/error-report.mts';

function run(hostname: string) {
  const listeners = new Map<string, (event: unknown) => void>(), beacons: { url: string; body: Record<string, unknown> }[] = [];
  const window = { location: { hostname, pathname: '/earth/' }, addEventListener: (type: string, listener: (event: unknown) => void) => { listeners.set(type, listener); } };
  const navigator = { sendBeacon: (url: string, body: string) => { beacons.push({ url, body: JSON.parse(body) as Record<string, unknown> }); return true; } };
  const document = { documentElement: { dataset: { ready: 'error' } }, querySelector: () => ({ textContent: 'v0.1' }) };
  new Function('window', 'navigator', 'document', errorReportBootstrap)(window, navigator, document);
  return { listeners, beacons };
}

test('a production page reports its failures in at most three beacons, and other hosts report nothing', () => {
  const { listeners, beacons } = run('css.earth');
  listeners.get('error')!({ message: 'undefined is not an object', error: { stack: 'module code@scene-router.js:1:1' } });
  listeners.get('unhandledrejection')!({ reason: new Error('offline') });
  for (let extra = 0; extra < 5; extra++) listeners.get('error')!({ message: 'again' });
  assert.equal(beacons.length, 3);
  assert.equal(beacons[0]!.url, '/.netlify/functions/report');
  assert.deepEqual(beacons[0]!.body, { kind: 'error', message: 'undefined is not an object', stack: 'module code@scene-router.js:1:1', page: '/earth/', ready: 'error', version: 'v0.1' });
  assert.equal(beacons[1]!.body.kind, 'rejection');
  assert.equal(beacons[1]!.body.message, 'offline');
  assert.equal(run('127.0.0.1').listeners.size, 0, 'a local build reports nothing');
});
