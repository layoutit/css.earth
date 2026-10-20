import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import assert from 'node:assert/strict';
import { EMBED_BRIDGE_PROTOCOL, embedCamera } from '@cssearth/renderer/embed/embed-bridge.ts';
import { isSceneClick } from '@cssearth/renderer/navigation/picking/world-camera-picking.ts';
import { connectEmbedBridge } from './embed-bridge.mts';

const HOST = 'http://127.0.0.1:4335';
const world = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  pose: { positionM: [6.1e19, -2.3e19, 1.1e19] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number],
    focusOffset: { originM: [6.1e19, -2.3e19, 1.1e19 - 1e4] as [number, number, number], offsetM: [0, 0, 1e4] as [number, number, number] } } };
// The optics carry more than a camera: functions and records a message cannot or need not carry.
const optics = { focalPixels: 1091.19, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 1200, heightPixels: 700,
  framingRadiusPixels: 80, visibleRect: null, detailHandoffDiameterPixels: 4, measure: () => 1 };

function page(href = `http://127.0.0.1:4215/m1/?embed&bridge=${encodeURIComponent(HOST)}&hide=labels`) {
  const posted: { message: Record<string, unknown>; origin: string }[] = [], listeners = new Map<string, (event: unknown) => void>();
  const parent = { postMessage(message: Record<string, unknown>, origin: string) { posted.push({ message: structuredClone(message), origin }); } };
  const documentListeners = new Map<string, (event: unknown) => void>();
  const windowTarget = {
    location: { href }, parent,
    addEventListener(type: string, listener: (event: unknown) => void) { listeners.set(type, listener); },
    removeEventListener() {},
    requestAnimationFrame(callback: () => void) { callback(); return 1; }, cancelAnimationFrame() {},
    document: { addEventListener(type: string, listener: (event: unknown) => void) { documentListeners.set(type, listener); }, removeEventListener() {} },
  };
  const navigated: string[] = [], layers: unknown[] = [];
  const mount = {
    navigation: { capture: () => world, optics: () => optics, subscribe: () => () => {}, apply: async () => true,
      turn: async () => ({ completed: true }) },
    datasets: { ids: ['hubble-optical', 'webb-infrared'], defaultId: 'hubble-optical', current: () => 'hubble-optical',
      volumeOf: (id: string) => ({ objectId: 'm1-volume', datasetId: id }), subscribe: () => () => {}, subscribeLoading: () => () => {} },
    sharedView: { capture: () => null, restore: async () => true, subscribe: () => () => {} },
  };
  const bridge = connectEmbedBridge({ windowTarget: windowTarget as unknown as Window, port: {
    objectId: 'm1', settled: () => new Promise(() => {}), mount: () => mount as never, href: () => href,
    async navigate(url) { navigated.push(url); return true; }, async focus() { return true; },
  } })!;
  bridge.sceneMounted(mount as never);
  const send = (data: Record<string, unknown>, origin = HOST, source: unknown = parent) =>
    listeners.get('message')!({ origin, source, data: { protocol: EMBED_BRIDGE_PROTOCOL, requestId: 7, ...data } });
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return { bridge, posted, send, settle, navigated, layers, documentListeners, world: { setLayerVisibility(value: unknown) { layers.push(value); } } };
}

test('the page hears only its host origin from its parent window, and posts only to that origin', async () => {
  const { posted, send, settle } = page();
  const before = posted.length;
  send({ type: 'sync' }, 'http://evil.test'); send({ type: 'sync' }, HOST, {}); await settle();
  assert.equal(posted.length, before, 'a stranger’s command is never answered');
  send({ type: 'sync' }); await settle();
  assert.ok(posted.slice(before).some(({ message }) => message.type === 'reply' && message.ok === true));
  assert.ok(posted.every(({ origin }) => origin === HOST));
});

test('the link’s hidden layers reach the world when it mounts, and a host’s layer switch reaches it again', async () => {
  const { bridge, send, settle, layers, world } = page();
  bridge.worldMounted(world);
  assert.equal((layers.at(-1) as Record<string, boolean>).labels, false);
  assert.equal((layers.at(-1) as Record<string, boolean>).stars, true);
  send({ type: 'set-layers', hidden: ['stars', 'nebulae'] }); await settle();
  const last = layers.at(-1) as Record<string, boolean>;
  assert.deepEqual([last.stars, last.nebulae, last.labels], [false, false, true]);
});

test('a dataset is the page’s own dataset link; the default dataset is the bare link', async () => {
  const { send, settle, navigated } = page();
  send({ type: 'select-dataset', id: 'webb-infrared' }); await settle();
  send({ type: 'select-dataset', id: 'hubble-optical' }); await settle();
  assert.equal(new URL(navigated[0]!).searchParams.get('dataset'), 'webb-infrared');
  assert.equal(new URL(navigated[1]!).searchParams.has('dataset'), false);
  assert.equal(new URL(navigated[1]!).searchParams.get('bridge'), HOST, 'the link keeps the bridge');
});

test('the published camera is the rendered pose and lens as plain data, with the exact offset from the body it is near', () => {
  const { posted } = page();
  const camera = posted.map(({ message }) => message).find(message => message.type === 'camera')?.camera as ReturnType<typeof embedCamera>;
  assert.deepEqual(camera, embedCamera(world, optics));
  assert.deepEqual(camera.world.pose.focusOffset, world.pose.focusOffset);
  assert.deepEqual(Object.keys(camera.viewport).sort(), ['focalPixels', 'heightPixels', 'principalOffsetPixels', 'widthPixels']);
});

test('a press and release in place is a click the host hears; a drag is not', () => {
  const { posted, documentListeners } = page();
  const press = (x: number, y: number) => documentListeners.get('pointerdown')!({ button: 0, clientX: x, clientY: y, pointerId: 1 });
  const release = (x: number, y: number) => documentListeners.get('pointerup')!({ clientX: x, clientY: y, pointerId: 1, shiftKey: false });
  press(100, 100); release(102, 101); press(100, 100); release(160, 100);
  const clicks = posted.map(({ message }) => message).filter(message => message.type === 'click');
  assert.deepEqual(clicks.map(click => [click.x, click.y]), [[102, 101]]);
});

test('bridge click decisions agree with the scene\'s own picking at and around its click slop', () => {
  const { posted, documentListeners } = page();
  for (const dx of [0, 4, 5, 5.01, 6]) {
    const before = posted.filter(({ message }) => message.type === 'click').length;
    documentListeners.get('pointerdown')!({ button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    documentListeners.get('pointerup')!({ clientX: dx, clientY: 0, pointerId: 1, shiftKey: false });
    const clicked = posted.filter(({ message }) => message.type === 'click').length > before;
    assert.equal(clicked, isSceneClick(dx, 0), `scene decision at ${dx}px`);
    assert.equal(clicked, dx <= 5, `the scene's 5 px slop at ${dx}px`);
  }
});

test('the connector rejects invalid origins and unframed pages before installing listeners', () => {
  const port = { objectId: 'm1', settled: async () => {}, mount: () => null, href: () => 'http://site.test/m1/',
    navigate: async () => false, focus: async () => false };
  for (const [query, framed] of [['?embed&bridge=bad', true], ['?embed&bridge=http://lab.test/path', true],
    ['?bridge=http://lab.test', true], ['?embed&bridge=http://lab.test', false]] as const) {
    const target = { location: { href: `http://site.test/m1/${query}` }, parent: {} };
    if (!framed) target.parent = target;
    // No document or event APIs: the rejected connection must return before touching them.
    assert.equal(connectEmbedBridge({ windowTarget: target as unknown as Window, port }), null);
  }
});
