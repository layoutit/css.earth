import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import { bindPreparedSurfaceHit } from '../navigation/prepared-surface-hit.js';
import { prepareConnectedActivation } from './prepared-activation.js';

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
  const activate = prepareConnectedActivation(batches, fn => cleanup.push(fn));
  document.body.append(root);
  return { root, leaves, activate, callbacks, dispose() { cleanup.forEach(fn => fn()); },
    paint() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); } };
}

test('mount connects one prepared batch per frame with original nodes, styles and sibling order', async () => {
  const f = fixture(2), identities = [...f.leaves], styles = f.leaves.map(node => node.getAttribute('style'));
  expect(f.root.children).toHaveLength(0);
  expect(f.leaves.every(node => !node.isConnected)).toBe(true);
  const ready = f.activate(); expect(f.activate()).toBe(ready);
  for (const count of [2, 4, 5]) {
    f.paint();
    expect([...f.root.children]).toEqual(identities.slice(0, count));
    expect(f.leaves.map(node => node.getAttribute('style'))).toEqual(styles);
  }
  let settled = false; ready.then(() => { settled = true; });
  await Promise.resolve(); expect(settled).toBe(false);
  f.paint(); await ready;
  expect(f.callbacks.size).toBe(0);
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
  expect(a.querySelectorAll('u')).toHaveLength(0); expect(b.querySelectorAll('u')).toHaveLength(0);
  const ready = activate();
  while (callbacks.length) callbacks.shift()!(0);
  await ready;
  expect([...a.childNodes]).toEqual(originalA); expect([...b.childNodes]).toEqual(originalB);
});

test('retiring a partly connected scene cancels the remaining batches', async () => {
  const f = fixture(), ready = f.activate();
  f.paint(); f.dispose(); f.paint(); await ready;
  expect([...f.root.children]).toEqual([f.leaves[0]]);
  expect(f.leaves.slice(1).every(node => !node.isConnected)).toBe(true);
  expect(f.callbacks.size).toBe(0);
});

test('retiring before activation never connects a leaf', async () => {
  const f = fixture(); f.dispose(); await f.activate(); f.paint();
  expect(f.root.children).toHaveLength(0); expect(f.callbacks.size).toBe(0);
});


test('real prepared surface anchors and flat overlays remain resident while surface leaves connect', async () => {
  let overlayCount = 0;
  for (const id of ['lutetia', 'bennu', 'ceres', 'earth']) {
    const definition = JSON.parse(readFileSync(new URL(`../../../../src/objects/${id}/prepared/runtime.json`, import.meta.url), 'utf8'));
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
    if (definition.surfaceHit) expect(() => bindPreparedSurfaceHit(definition.surfaceHit, nodes[definition.surfaceHit.target], nodes[definition.tree.scene], nodes[definition.tree.camera])).not.toThrow();
    expect(resident.every(node => node.isConnected)).toBe(true);
    overlayCount += overlays.length;
    expect(overlays.every((node: HTMLElement) => node.isConnected)).toBe(true);
    const ready = activate();
    while (callbacks.length) callbacks.shift()!(0);
    await ready;
    for (let i = 0; i < nodes.length; i++) expect([...nodes[i].childNodes]).toEqual(original[i]);
  }
  expect(overlayCount).toBeGreaterThan(0);
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
  const activate = prepareConnectedActivation([[...b.querySelectorAll('u')], leaves.slice(0, 2), leaves.slice(2), [...c.querySelectorAll('u')]], () => {});
  document.body.append(root);
  expect([...root.childNodes]).toEqual([original[1]]);
  expect([a, b, c].every(node => !node.isConnected)).toBe(true);
  const ready = activate();
  paint(); expect([...root.childNodes]).toEqual([original[1], b]);
  paint(); expect([...root.childNodes]).toEqual([a, original[1], b]);
  expect(a.childNodes).toHaveLength(2);
  paint(); expect(a.childNodes).toHaveLength(3);
  paint(); expect([...root.childNodes]).toEqual(original);
  expect(connectedWith).toEqual([1, 2, 1]);
  paint(); await ready;
});
