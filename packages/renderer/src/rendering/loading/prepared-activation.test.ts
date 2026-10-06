import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import { bindPreparedSurfaceHit } from '../../navigation/prepared-surface-hit.js';
import { prepareConnectedActivation } from './prepared-activation.js';
import { createFramePacer, SETTLE_PACING } from './settle-pacer.js';

// One batch a frame: a pacer whose budget never exceeds one unit, so each frame admits exactly one whole batch.
const oneBatch = (window: { requestAnimationFrame(callback: FrameRequestCallback): unknown }) =>
  createFramePacer(callback => window.requestAnimationFrame(now => callback(now)), { ...SETTLE_PACING, startUnits: 1, maximumUnits: 1 });

function fixture(batchSize = 1) {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>(), cleanup: (() => void)[] = [];
  const { document, window } = parseHTML('<html><body></body></html>');
  window.requestAnimationFrame = (fn: FrameRequestCallback) => { callbacks.set(++nextId, fn); return nextId; };
  window.cancelAnimationFrame = (id: number) => { callbacks.delete(id); };
  const root = document.createElement('div');
  const leaves = Array.from({ length: 5 }, (_, i) => {
    const node = document.createElement('u'); node.id = String(i);
    node.style.transform = `translateX(${i}px)`; root.append(node); return node;
  });
  const batches = Array.from({ length: Math.ceil(leaves.length / batchSize) }, (_, i) => leaves.slice(i * batchSize, (i + 1) * batchSize));
  const activate = prepareConnectedActivation(batches, fn => cleanup.push(fn), [], undefined, oneBatch(window));
  document.body.append(root);
  return { root, leaves, activate, callbacks, dispose() { cleanup.forEach(fn => fn()); },
    paint() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); } };
}

test('mount connects one prepared batch per frame with original nodes, styles and sibling order', async () => {
  const f = fixture(2), identities = [...f.leaves], styles = f.leaves.map(node => node.getAttribute('style'));
  assert.equal(f.root.children.length, 0);
  assert.equal(f.leaves.every(node => !node.isConnected), true);
  const ready = f.activate(); assert.equal(f.activate(), ready);
  for (const count of [2, 4, 5]) {
    f.paint();
    assert.deepEqual(([...f.root.children]), identities.slice(0, count));
    assert.deepEqual(f.leaves.map(node => node.getAttribute('style')), styles);
  }
  let settled = false; ready.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  f.paint(); await ready;
  assert.equal(f.callbacks.size, 0);
});

test('batch attachment preserves static siblings and independent prepared parents', async () => {
  const { document, window } = parseHTML('<html><body><main><div id="a"><u></u><span></span><u></u><u></u><b></b></div><div id="b"><u></u><i></i><u></u></div></main></body></html>');
  const callbacks: FrameRequestCallback[] = [];
  window.requestAnimationFrame = fn => callbacks.push(fn);
  window.cancelAnimationFrame = () => {};
  const a = document.getElementById('a')!, b = document.getElementById('b')!;
  const originalA = [...a.childNodes], originalB = [...b.childNodes];
  const leavesA = [...a.querySelectorAll('u')], leavesB = [...b.querySelectorAll('u')];
  const activate = prepareConnectedActivation([[leavesA[0]], leavesA.slice(1), leavesB], () => {});
  assert.equal(a.querySelectorAll('u').length, 0); assert.equal(b.querySelectorAll('u').length, 0);
  const ready = activate();
  while (callbacks.length) callbacks.shift()!(0);
  await ready;
  assert.deepEqual(([...a.childNodes]), originalA); assert.deepEqual(([...b.childNodes]), originalB);
});

test('retiring a partly connected scene cancels the remaining batches', async () => {
  const f = fixture(), ready = f.activate();
  f.paint(); f.dispose(); f.paint(); await ready;
  assert.deepEqual(([...f.root.children]), [f.leaves[0]]);
  assert.equal(f.leaves.slice(1).every(node => !node.isConnected), true);
  assert.equal(f.callbacks.size, 0);
});

test('retiring before activation never connects a leaf', async () => {
  const f = fixture(); f.dispose(); await f.activate(); f.paint();
  assert.equal(f.root.children.length, 0); assert.equal(f.callbacks.size, 0);
});


test('real prepared surface anchors and flat overlays remain resident while surface leaves connect', async () => {
  let overlayCount = 0;
  for (const id of ['lutetia', 'bennu', 'ceres', 'earth', 'ida']) {
    const definition = JSON.parse(readFileSync(new URL(`src/objects/${id}/prepared/runtime.json`, new URL('../../../../../', import.meta.url)), 'utf8'));
    const { document, window } = parseHTML('<html><body></body></html>');
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = fn => callbacks.push(fn); window.cancelAnimationFrame = () => {};
    const nodes: HTMLElement[] = definition.tree.nodes.map((record: { tag: string }) => document.createElement(record.tag));
    definition.tree.nodes.forEach((record: { parent: number }, index: number) => {
      if (record.parent >= 0) nodes[record.parent].append(nodes[index]);
    });
    const original = nodes.map(node => [...node.childNodes]);
    const resident = [definition.surfaceHit?.target, definition.features?.target]
      .flatMap(index => index === undefined ? [] : [nodes[index]]);
    const surfaceScenes = [nodes[definition.tree.scene], ...(definition.depthPartitions?.groups ?? []).map((group: { scene: number }) => nodes[group.scene])];
    const overlays = definition.tree.activationGroups.flat().map((index: number) => nodes[index])
      .filter((node: HTMLElement) => !surfaceScenes.some(scene => scene.contains(node)));
    const activate = prepareConnectedActivation(definition.tree.activationGroups.map((group: number[]) => group.map(index => nodes[index])), () => {}, resident, surfaceScenes);
    definition.tree.nodes.forEach((record: { parent: number }, index: number) => { if (record.parent === -1) document.body.append(nodes[index]); });
    if (definition.surfaceHit) assert.doesNotThrow(() => bindPreparedSurfaceHit(definition.surfaceHit, nodes[definition.surfaceHit.target], nodes[definition.tree.scene], nodes[definition.tree.camera],
      // A body whose datasets use different meshes (Bennu) hit-tests the selected dataset's range, as the stage does.
      definition.surfaceHit.datasetRanges ? () => definition.surfaceHit.datasetRanges[0].datasetId : undefined));
    assert.equal(resident.every(node => node.isConnected), true);
    overlayCount += overlays.length;
    assert.equal(overlays.every((node: HTMLElement) => node.isConnected), true);
    const ready = activate();
    while (callbacks.length) callbacks.shift()!(0);
    await ready;
    for (let i = 0; i < nodes.length; i++) assert.deepEqual(([...nodes[i].childNodes]), original[i]);
  }
  assert.ok(overlayCount > 0);
});


test('mesh parents first connect populated, in prepared order, while later batches remain paced', async () => {
  const { document, window } = parseHTML('<html><body></body></html>');
  const root = document.createElement('main');
  root.innerHTML = '<div id="a"><u></u><u></u><u></u></div><span></span><div id="b"><u></u></div><div id="c"><u></u></div>';
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  window.requestAnimationFrame = fn => { callbacks.set(++nextId, fn); return nextId; };
  window.cancelAnimationFrame = id => { callbacks.delete(id); };
  const paint = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); };
  const original = [...root.childNodes], [a, , b, c] = [...root.children];
  const leaves = [...a.querySelectorAll('u')];
  const connectedWith: number[] = [];
  const insertBefore = root.insertBefore.bind(root);
  root.insertBefore = (node, reference) => { connectedWith.push(node.childNodes.length); return insertBefore(node, reference); };
  const activate = prepareConnectedActivation([[...b.querySelectorAll('u')], leaves.slice(0, 2), leaves.slice(2), [...c.querySelectorAll('u')]], () => {}, [], undefined, oneBatch(window));
  document.body.append(root);
  assert.deepEqual(([...root.childNodes]), [original[1]]);
  assert.equal([a, b, c].every(node => !node.isConnected), true);
  const ready = activate();
  paint(); assert.deepEqual(([...root.childNodes]), [original[1], b]);
  paint(); assert.deepEqual(([...root.childNodes]), [a, original[1], b]);
  assert.equal(a.childNodes.length, 2);
  paint(); assert.equal(a.childNodes.length, 3);
  paint(); assert.deepEqual(([...root.childNodes]), original);
  assert.deepEqual(connectedWith, [1, 2, 1]);
  paint(); await ready;
});
