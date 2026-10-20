import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBED_BRIDGE_PROTOCOL } from '@cssearth/renderer/embed/embed-bridge.ts';
import { connectSiteBridge } from './site-bridge.ts';
import { siteSceneUrl } from './site-scene-url.ts';
import { readLabLayers, withLabLayers } from './lab-layers.ts';
import { siteSubjectFor } from './site-subjects.ts';

const SITE = 'http://127.0.0.1:4215';
function lab() {
  let listener: (event: unknown) => void = () => {};
  const sent: { message: Record<string, unknown>; origin: string }[] = [];
  const frame = { postMessage(message: Record<string, unknown>, origin: string) { sent.push({ message, origin }); } };
  const windowTarget = { addEventListener(_: string, value: (event: unknown) => void) { listener = value; }, removeEventListener() {},
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms), clearTimeout: (id: number) => clearTimeout(id) };
  const bridge = connectSiteBridge({ windowTarget: windowTarget as unknown as Window, frame: () => frame as unknown as Window, siteOrigin: SITE, timeoutMs: 50 });
  const receive = (data: Record<string, unknown>, origin = SITE, source: unknown = frame) => listener({ origin, source, data: { protocol: EMBED_BRIDGE_PROTOCOL, ...data } });
  return { bridge, sent, receive };
}
const camera = { world: { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 800, principalOffsetPixels: [0, 0] } };

test('the lab hears only the site origin from its own frame, and only messages that parse', () => {
  const { bridge, receive } = lab();
  receive({ type: 'camera', camera, moving: false }, 'http://evil.test');
  receive({ type: 'camera', camera, moving: false }, SITE, {});
  receive({ type: 'camera', camera: { ...camera, viewport: { focalPixels: -1, principalOffsetPixels: [0, 0] } }, moving: false });
  assert.equal(bridge.camera, null);
  receive({ type: 'camera', camera, moving: true });
  assert.deepEqual(bridge.camera, camera); assert.equal(bridge.moving, true);
});

test('a command posts to the site origin only and settles with the page’s reply to it', async () => {
  const { bridge, sent, receive } = lab();
  const turned = bridge.send({ type: 'turn', degrees: 60 }), refused = bridge.send({ type: 'select-dataset', id: 'nothing' });
  assert.deepEqual(sent.map(({ origin }) => origin), [SITE, SITE]);
  const [first, second] = sent.map(({ message }) => message.requestId as number);
  receive({ type: 'reply', requestId: second, ok: false, error: 'No such dataset.' });
  receive({ type: 'reply', requestId: first, ok: true }, 'http://evil.test');
  receive({ type: 'reply', requestId: first, ok: true });
  assert.deepEqual(await turned, {});
  await assert.rejects(refused, /No such dataset/);
  await assert.rejects(bridge.send({ type: 'reset' }), /did not answer reset/);
});

test('the lab’s link opens the page embedded with its bridge, layers and saved view; it keeps the layers it hides', () => {
  const url = siteSceneUrl(SITE, 'http://127.0.0.1:4335/reconstruction', { object: 'm1', dataset: 'hubble-optical', view: 'Ab_9-x' }, ['labels', 'stars']);
  assert.equal(url.origin + url.pathname, `${SITE}/m1/`);
  assert.deepEqual(Object.fromEntries(url.searchParams), { dataset: 'hubble-optical', v: 'Ab_9-x', embed: '', bridge: 'http://127.0.0.1:4335', hide: 'stars,labels' });
  assert.throws(() => siteSceneUrl(SITE, 'http://127.0.0.1:4335', { object: '../etc' }), TypeError);
  assert.throws(() => siteSceneUrl(SITE, 'javascript:alert(1)', { object: 'm1' }), TypeError);
  assert.deepEqual(readLabLayers(new URL('http://lab.test/reconstruction')), ['labels']);
  assert.deepEqual(readLabLayers(withLabLayers(new URL('http://lab.test/reconstruction'), [])), []);
  assert.deepEqual(readLabLayers(withLabLayers(new URL('http://lab.test/reconstruction'), ['nebulae', 'sky'])), ['sky', 'nebulae']);
});

test('the shown bank picks its lab subject; a page bank no subject owns keeps the picker’s', () => {
  const helix = { id: 'helix', plates: { object: 'src/objects/helix-layers' }, app: { object: 'helix' } };
  const wfi = { id: 'helix-wfi', plates: { object: 'src/objects/helix-wfi-layers' }, app: { object: 'helix' } };
  const m1 = { id: 'm1', siteVolume: { object: 'src/objects/m1-volume' }, app: { object: 'm1' } };
  assert.equal(siteSubjectFor([helix, wfi, m1], 'helix', 'helix-wfi-layers', helix), wfi);
  assert.equal(siteSubjectFor([helix, wfi, m1], 'helix', 'helix-layers', wfi), helix);
  assert.equal(siteSubjectFor([helix, wfi, m1], 'm1', 'm1-layers', m1), m1);
});
