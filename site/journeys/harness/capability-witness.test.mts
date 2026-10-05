import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCapability, coastWitnesses, workerWitness } from './capability-witness.mts';
import { profiles } from './profiles.mts';
import { loopbackTarget, validateProxyArguments } from './cache-guard.mts';
const state = { events: [], resizes: [{ width: 1280, height: 800 }], dpr: 2, width: 1280, height: 800,
  surface: { width: 1200, height: 700, rendered: { selector: '.object-stage', nodes: 1, width: 1200, height: 700 } }, reduced: false, animations: [{ id: 'cv-mon-light-curve', playState: 'running' }] };
test('DPR requires matching configured/native values and rendered surface', () => {
  assert.doesNotThrow(() => validateCapability('DPR', state, profiles['webkit-desktop-dpr2']));
  assert.throws(() => validateCapability('DPR', { ...state, dpr: 1 }, profiles['webkit-desktop-dpr2']));
  assert.throws(() => validateCapability('DPR', { ...state, surface: null }, profiles['webkit-desktop-dpr2']));
  assert.throws(() => validateCapability('DPR', { ...state, surface: { width: 1200, height: 700 } }, profiles['webkit-desktop-dpr2']));
});
test('responsive requires delivered changed viewport and resident layout', () => {
  assert.throws(() => validateCapability('responsive', state, {}));
  assert.doesNotThrow(() => validateCapability('responsive', { ...state, resizes: [...state.resizes, { width: 390, height: 844 }], width: 390, height: 844 }, {}));
  assert.throws(() => validateCapability('responsive', { ...state, resizes: [{ width: 390, height: 844 }] }, {}));
});
test('media permission and native input witnesses reject missing property mutations', () => {
  assert.doesNotThrow(() => validateCapability('reducedMotion', { ...state, reduced: true, animations: [{ id: 'cv-mon-light-curve', playState: 'paused' }] }, {}, false));
  assert.throws(() => validateCapability('reducedMotion', { ...state, reduced: true }, {}, false));
  assert.throws(() => validateCapability('reducedMotion', state, {}, false));
  for (const kind of ['tabFocus', 'touch', 'penPointer'] as const) assert.throws(() => validateCapability(kind, state, { hasTouch: true }));
  assert.throws(() => validateCapability('touch', { ...state, events: [{ type: 'pointerdown', pointerType: 'touch', trusted: false }] }, { hasTouch: true }));
  assert.throws(() => validateCapability('touch', { ...state, events: [{ type: 'pointerdown', pointerType: 'touch', trusted: true }] }, { hasTouch: false }));
  const focus = { type: 'tabFocus', trusted: true, indicator: { outlineStyle: 'solid', outlineWidth: 1, outlineColor: 'rgb(255, 0, 0)', boxShadow: 'none', textDecorationLine: 'none' } };
  assert.doesNotThrow(() => validateCapability('tabFocus', { ...state, events: [focus] }, {}));
  assert.throws(() => validateCapability('tabFocus', { ...state, events: [{ ...focus, indicator: { ...focus.indicator, outlineWidth: 0 } }] }, {}), /painted/u);
  assert.throws(() => validateCapability('tabFocus', { ...state, events: [{ type: 'tabFocus', trusted: true }] }, {}));
});
test('visibility requires ordered trusted native hidden/visible transitions', () => {
  const witness = { ...state, events: [{ type: 'visibilitychange', state: 'hidden', trusted: true }, { type: 'visibilitychange', state: 'visible', trusted: true }] };
  assert.doesNotThrow(() => validateCapability('visibility', witness, {}));
  assert.throws(() => validateCapability('visibility', { ...witness, events: witness.events.slice(1) }, {}));
  assert.throws(() => validateCapability('visibility', { ...witness, events: witness.events.map(event => ({ ...event, trusted: false })) }, {}));
});
test('coast credits only actual changed matching writes of a completed coast', () => {
  const row = { coasting: true, key: 'path [d]', subject: 'document>div.point-layer>path', before: '', value: 'M1 2h.01' };
  const ids = coastWitnesses([row], true).map(value => value.id);
  assert.ok(ids.includes('capability:labs:performance:coast-writes:coast-allowed-write:5'));
  assert.ok(ids.includes('capability:docs:performance:motion-freezes-membership:coast-exception:batched-star-points:1'));
  assert.deepEqual(coastWitnesses([row], false), []);
  assert.deepEqual(coastWitnesses([{ ...row, coasting: false }], true), []);
  assert.deepEqual(coastWitnesses([{ ...row, before: row.value }], true), []);
  const unrelated = coastWitnesses([{ ...row, subject: 'document>svg>path' }], true).map(value => value.id);
  assert.ok(!unrelated.some(id => id.includes('coast-exception')));
  const keys = ['div.object-input-surface { opacity }', 'polyline [points]', 'polyline { stroke-opacity }', 'g <+polyline>', 'path [d]', 'div.object-input-surface { cursor }'];
  const all = coastWitnesses(keys.map(key => ({ ...row, key })), true).map(value => value.id);
  for (let ordinal = 1; ordinal <= 6; ordinal++) assert.ok(all.includes(`capability:labs:performance:coast-writes:coast-allowed-write:${ordinal}`));
});
test('proxy URL admission is loopback HTTP only and all new DPR/touch profiles exist', () => {
  for (const url of ['http://127.0.0.1:3000/', 'http://localhost:3000/', 'http://[::1]:3000/']) assert.ok(loopbackTarget(url));
  for (const url of ['http://localhost.attacker.invalid/', 'http://127.0.0.1.attacker.invalid/', 'https://127.0.0.1/', 'http://user@localhost/']) assert.equal(loopbackTarget(url), null);
  for (const name of ['chromium-desktop-dpr2', 'webkit-desktop-dpr2', 'webkit-mobile-touch', 'webkit-tablet']) assert.equal(profiles[name]?.deviceScaleFactor, 2);
  assert.equal(profiles['webkit-mobile-touch']?.hasTouch, true);
});

test('worker URL and native completion cannot be borrowed from different owners', () => {
  const url = 'http://127.0.0.1/_astro/prepared-data-worker.js';
  const app = { url, nativeReplies: 1, jobs: 0, replies: 0 };
  assert.doesNotThrow(() => workerWitness({ workerEvidence: [app] }, [url]));
  assert.throws(() => workerWitness({ workerEvidence: [{ ...app, nativeReplies: 0 }, { ...app, url: 'http://127.0.0.1/other-worker.js' }] }, [url]));
  assert.throws(() => workerWitness({ workerEvidence: [{ ...app, jobs: 1 }] }, [url]));
  assert.throws(() => workerWitness({ workerEvidence: [{ ...app, replies: 1 }] }, [url]));
  assert.throws(() => workerWitness({ workerEvidence: [app] }, []));
});

test('effective proxy switches reject duplicate servers, wildcard bypass and conflicting overrides', () => {
  const origin = 'http://127.0.0.1:3456';
  const args = ['--proxy-server=' + origin, '--proxy-bypass-list=<-loopback>;<-loopback>', '--disable-quic'];
  assert.doesNotThrow(() => validateProxyArguments(args, origin));
  for (const malformed of [
    [...args, '--proxy-server=http://127.0.0.1:4567'],
    [...args, '--proxy-bypass-list=*'],
    args.map(value => value.startsWith('--proxy-bypass-list=') ? '--proxy-bypass-list=<-loopback>;*' : value),
    args.map(value => value.startsWith('--proxy-bypass-list=') ? '--proxy-bypass-list=<-loopback>;localhost' : value),
    [...args, '--no-proxy-server'],
    [...args, '--proxy-pac-url=http://127.0.0.1:3456/pac'],
  ]) assert.throws(() => validateProxyArguments(malformed, origin));
});
