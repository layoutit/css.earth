import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBED_BRIDGE_PROTOCOL, embedBridgeOrigin, formatHiddenWorldLayers, parseEmbedHostCommand, parseEmbedPageMessage, readHiddenWorldLayers } from './embed-bridge.ts';

const protocol = EMBED_BRIDGE_PROTOCOL;
const camera = {
  world: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [1, 2, 3], orientationXyzw: [0, 0, 0, 1], focusOffset: { originM: [1, 2, 0], offsetM: [0, 0, 3] } } },
  viewport: { focalPixels: 900, principalOffsetPixels: [12, -4], widthPixels: 1200, heightPixels: 700 },
};

test('a page message parses only when every field is the protocol\'s', () => {
  assert.deepEqual(parseEmbedPageMessage({ protocol, type: 'camera', camera, moving: false })?.type, 'camera');
  assert.equal(parseEmbedPageMessage({ protocol: 'other@1', type: 'camera', camera, moving: false }), null);
  // A camera is a unit turn and finite numbers; the viewport has a lens and a principal point.
  assert.equal(parseEmbedPageMessage({ protocol, type: 'camera', camera: { ...camera, world: { ...camera.world, pose: { ...camera.world.pose, orientationXyzw: [0, 0, 0, 2] } } }, moving: false }), null);
  assert.equal(parseEmbedPageMessage({ protocol, type: 'camera', camera: { ...camera, viewport: { ...camera.viewport, focalPixels: 0 } }, moving: false }), null);
  assert.equal(parseEmbedPageMessage({ protocol, type: 'camera', camera: { ...camera, viewport: { focalPixels: 900, principalOffsetPixels: [Number.NaN, 0] } }, moving: false }), null);
  const state = { protocol, type: 'state', objectId: 'm1', ready: true, dataset: 'hubble-optical', datasets: ['hubble-optical'], volume: { objectId: 'm1-volume', datasetId: 'hubble-optical' }, hidden: ['labels'] };
  assert.equal(parseEmbedPageMessage(state)?.type, 'state');
  for (const bad of [{ objectId: '../m1' }, { dataset: 'Hubble' }, { hidden: ['labels', 'labels'] }, { hidden: ['clouds'] }, { volume: { objectId: 'm1-volume' } }])
    assert.equal(parseEmbedPageMessage({ ...state, ...bad }), null, JSON.stringify(bad));
  assert.equal(parseEmbedPageMessage({ protocol, type: 'click', x: 10, y: 20, shiftKey: true })?.type, 'click');
  assert.equal(parseEmbedPageMessage({ protocol, type: 'click', x: '10', y: 20, shiftKey: true }), null);
  assert.equal(parseEmbedPageMessage({ protocol, type: 'reply', requestId: 3, ok: true, view: 'A_b-9' })?.type, 'reply');
  assert.equal(parseEmbedPageMessage({ protocol, type: 'reply', requestId: 3, ok: true, view: 'not a token' }), null);
  assert.equal(parseEmbedPageMessage({ protocol, type: 'navigate', url: 'https://example.test' }), null);
});

test('a host command parses only when it is one the page obeys', () => {
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'select-dataset', id: 'webb-infrared' })?.type, 'select-dataset');
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'select-dataset', id: 'javascript:alert(1)' }), null);
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'turn', degrees: 60 })?.type, 'turn');
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'turn', degrees: 1e9 }), null);
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'set-layers', hidden: ['stars', 'labels'] })?.type, 'set-layers');
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'set-layers', hidden: ['everything'] }), null);
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1.5, type: 'reset' }), null);
  assert.equal(parseEmbedHostCommand({ protocol, requestId: 1, type: 'navigate', id: 'hat-p-34-system' }), null);
  for (const type of ['sync', 'reset', 'earth-view', 'fit', 'capture-view']) assert.equal(parseEmbedHostCommand({ protocol, requestId: 2, type })?.type, type);
});

test('only an embedded link that names an http(s) origin, and nothing more, opens the bridge', () => {
  assert.equal(embedBridgeOrigin(new URL('http://site.test/m1/?embed&bridge=http%3A%2F%2F127.0.0.1%3A4335')), 'http://127.0.0.1:4335');
  assert.equal(embedBridgeOrigin(new URL('http://site.test/m1/?bridge=http%3A%2F%2F127.0.0.1%3A4335')), null);
  assert.equal(embedBridgeOrigin(new URL('http://site.test/m1/?embed&bridge=http%3A%2F%2F127.0.0.1%3A4335%2Fpath')), null);
  assert.equal(embedBridgeOrigin(new URL('http://site.test/m1/?embed&bridge=javascript%3Aalert(1)')), null);
  assert.deepEqual(readHiddenWorldLayers('labels,stars'), ['labels', 'stars']);
  assert.deepEqual(readHiddenWorldLayers(''), []);
  assert.throws(() => readHiddenWorldLayers('labels,ghosts'), TypeError);
  assert.equal(formatHiddenWorldLayers(['labels', 'stars', 'sky']), 'sky,stars,labels');
});

test('parsers build fresh projections and detach nested data from raw messages', () => {
  const raw = { protocol, type: 'state', objectId: 'm1', ready: true, dataset: 'optical', datasets: ['optical'],
    volume: { objectId: 'm1-volume', datasetId: 'optical', extra: true }, hidden: ['labels'], extra: true };
  const state = parseEmbedPageMessage(raw);
  assert.ok(state?.type === 'state'); assert.notEqual(state, raw);
  assert.equal('extra' in state, false); assert.equal('extra' in state.volume!, false);
  raw.datasets.push('infrared'); raw.hidden.length = 0; raw.volume.objectId = 'other';
  assert.deepEqual([state.datasets, state.hidden, state.volume?.objectId], [['optical'], ['labels'], 'm1-volume']);
  for (const type of ['sync', 'reset', 'earth-view', 'fit', 'capture-view', 'turn', 'restore-view', 'select-dataset', 'set-layers']) {
    const input = { protocol, requestId: 1, type, degrees: 60, view: 'Ab_9', id: 'optical', hidden: ['stars'], extra: true };
    const parsed = parseEmbedHostCommand(input)!;
    assert.ok(parsed); assert.notEqual(parsed, input); assert.equal('extra' in parsed, false);
    input.hidden.length = 0;
    if (parsed.type === 'set-layers') assert.deepEqual(parsed.hidden, ['stars']);
  }
  const reply = { protocol, type: 'reply', requestId: 1, ok: false, error: 'failed', extra: true };
  assert.deepEqual(parseEmbedPageMessage(reply), { protocol, type: 'reply', requestId: 1, ok: false, error: 'failed' });
  const input = structuredClone(camera), parsed = parseEmbedPageMessage({ protocol, type: 'camera', camera: input, moving: false });
  assert.ok(parsed?.type === 'camera');
  input.world.pose.positionM[0] = 50; input.world.pose.focusOffset.offsetM[2] = 60; input.viewport.principalOffsetPixels[0] = 100;
  assert.deepEqual(parsed.camera, camera);
});
