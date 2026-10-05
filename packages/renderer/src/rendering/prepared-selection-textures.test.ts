import { type PreparedPresentationDefinition } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mountPreparedPresentation } from './prepared-presentation.js';

import type { PreparedResources } from './prepared-residency.js';
import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';

function fixture() {
  const nodes = [0, 1, 2, 3].map(() => ({ style: { backgroundImage: 'none' }, parentNode: null }));
  const stage = { ownerDocument: {}, appendChild(node: typeof nodes[number]) { node.parentNode = this as never; } };
  const definition = { tree: { nodes: [], camera: 0, scene: 1, stageClasses: [] }, materials: [], animations: [], viewBindings: [],
    variants: [
      { when: { datasetId: 'a' }, writes: [{ kind: 'texture', target: 2, name: 'backgroundImage', resource: 'a', quoted: true }] },
      { when: { datasetId: 'b' }, writes: [{ kind: 'texture', target: 3, name: 'backgroundImage', resource: 'b', quoted: true }] },
      { when: { datasetId: 'fixed' }, writes: [{ kind: 'style', target: 2, name: 'backgroundImage', value: 'url("/fixed.webp")' }] },
    ] } as unknown as PreparedPresentationDefinition;
  const ready = new Set(['a', 'b']);
  const resources = { url(key: string) { return ready.has(key) ? `/${key}.webp` : null; } } as PreparedResources;
  const presentation = mountPreparedPresentation(stage as unknown as HTMLElement,
    { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes: nodes as unknown as HTMLElement[], roots: [nodes[0]] as unknown as HTMLElement[] }), destroy() {} });
  return { nodes, ready, select: (datasetId: string) => presentation.commitSelection({ selection: { datasetId }, resources }) };
}

test('dataset replacement retires only its former texture references without replacing nodes', () => {
  const f = fixture(), identities = [...f.nodes];
  f.select('a');
  assert.equal(f.nodes[2].style.backgroundImage, 'url("/a.webp")');
  f.select('b');
  assert.equal(f.nodes[2].style.backgroundImage, 'none');
  assert.equal(f.nodes[3].style.backgroundImage, 'url("/b.webp")');
  f.select('a');
  assert.equal(f.nodes[2].style.backgroundImage, 'url("/a.webp")');
  assert.equal(f.nodes[3].style.backgroundImage, 'none');
  assert.deepEqual(f.nodes, identities);
});

test('an undecoded replacement leaves the entire previous dataset published', () => {
  const f = fixture(); f.select('a'); f.ready.delete('b');
  assert.throws(() => f.select('b'), /not ready/);
  assert.equal(f.nodes[2].style.backgroundImage, 'url("/a.webp")');
  assert.equal(f.nodes[3].style.backgroundImage, 'none');
});

test('a successor style takes ownership of the same texture property', () => {
  const f = fixture(); f.select('a'); f.select('fixed');
  assert.equal(f.nodes[2].style.backgroundImage, 'url("/fixed.webp")');
  f.select('b');
  assert.equal(f.nodes[2].style.backgroundImage, 'url("/fixed.webp")');
});

/** A body whose node 2 holds two alternative meshes: `a` is leaves 3 and 4, `b` the `large` leaves after them (one by
 * default). Node 2 draws their shared atlas. */
async function meshes(large = 1) {
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML('<html><body><main></main></body></html>');
  const stage = document.querySelector('main') as unknown as HTMLElement;
  const record = (parent: number, tag = 'div') => ({ parent, tag, className: null, style: '', properties: [], attributes: {} });
  const records = [record(-1), record(0), record(1), record(2, 'u'), record(2, 'u'), ...Array.from({ length: large }, () => record(2, 'u'))];
  const nodes = records.map(entry => document.createElement(entry.tag)) as unknown as HTMLElement[];
  records.forEach((entry, index) => { if (entry.parent !== -1) nodes[entry.parent]!.appendChild(nodes[index]!); });
  const shows = (mesh: string) => ({ when: { datasetId: mesh }, mesh, writes: [{ kind: 'texture', target: 2, name: 'backgroundImage', resource: mesh, quoted: true }] });
  const definition = { tree: { nodes: records, properties: [], camera: 0, scene: 1, stageClasses: [],
      meshes: [{ name: 'a', leaves: [[3, 2]] }, { name: 'b', leaves: [[5, large]] }] }, materials: [], animations: [], viewBindings: [],
    variants: [shows('a'), shows('b')] } as unknown as PreparedPresentationDefinition;
  const presentation = mountPreparedPresentation(stage, { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes, roots: [nodes[0]!] }), destroy() {} });
  const resources = { has: () => true, read: () => null, url: (key: string) => `/${key}.webp`, readyKeys: () => ['a', 'b'] } as PreparedResources;
  return { nodes, select: (datasetId: string) => presentation.commitSelection({ selection: { datasetId }, resources }) };
}

test('an alternative mesh is unmounted before its shared atlas changes, and the next is mounted after', async () => {
  const f = await meshes();
  f.select('a');
  assert.equal(f.nodes[2]!.style.backgroundImage, 'url("/a.webp")');
  const invalid: string[] = [], body = f.nodes[2]!, outgoing = f.nodes[3]!;
  const remove = outgoing.remove.bind(outgoing), append = body.append.bind(body);
  outgoing.remove = () => { if (body.style.backgroundImage !== 'url("/a.webp")') invalid.push('the old mesh was still mounted under the new atlas'); remove(); };
  body.append = (...added: (Node | string)[]) => { if (body.style.backgroundImage !== 'url("/b.webp")') invalid.push('the new mesh was mounted under the old atlas'); append(...added); };
  f.select('b');
  assert.deepEqual(invalid, []);
  assert.equal(body.style.backgroundImage, 'url("/b.webp")');
  assert.deepEqual([...body.children], [f.nodes[5]]);
});

test('a body with several shape models mounts only the mesh its dataset draws on', async () => {
  const f = await meshes();
  const mounted = () => f.nodes.slice(3).map(node => node.parentNode !== null);
  // Before any selection no mesh shows, so none is mounted.
  assert.deepEqual(mounted(), [false, false, false]);
  f.select('a');
  assert.deepEqual(mounted(), [true, true, false]);
  f.select('b');
  assert.deepEqual(mounted(), [false, false, true]);
  f.select('a');
  assert.deepEqual(mounted(), [true, true, false]);
  assert.deepEqual([...f.nodes[2]!.children], [f.nodes[3], f.nodes[4]]);
});

test('a mesh is attached a slice of leaves a frame, and a switch away drops what is left of it', async () => {
  const frames: ((time: number) => void)[] = [];
  let now = 0;
  const frame = () => { now += 16; frames.shift()!(now); };
  stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => frames.push(callback));
  stubGlobal('cancelAnimationFrame', () => {});
  stubGlobal('performance', { now: () => now });
  try {
    const f = await meshes(200);
    const attached = (from: number, to?: number) => f.nodes.slice(from, to).filter(node => node.parentNode !== null).length;
    f.select('a');
    while (frames.length) frame();
    assert.equal(attached(3, 5), 2);
    // The 200-leaf mesh does not land in the commit: it comes a slice a frame, in the tree's order, the image already on it.
    f.select('b');
    assert.deepEqual([attached(3, 5), attached(5)], [0, 0]);
    assert.equal(f.nodes[2]!.style.backgroundImage, 'url("/b.webp")');
    const shares: number[] = [];
    while (frames.length && attached(5) < 200) { const before = attached(5); frame(); shares.push(attached(5) - before); }
    assert.equal(attached(5), 200);
    // The budget is the document pacer's: 16 to 64 leaves a frame, by how long the frames it causes take.
    assert.ok(shares.length >= 4 && Math.min(...shares.slice(0, -1)) >= 16 && Math.max(...shares) <= 64, `shares ${shares.join(' ')}`);
    assert.deepEqual([...f.nodes[2]!.children], f.nodes.slice(5));
    // Leaving the mesh part-way: what was attached goes, and no later frame attaches the rest.
    f.select('a');
    while (frames.length) frame();
    f.select('b');
    frame();
    assert.ok(attached(5) > 0 && attached(5) < 200, `${attached(5)} attached after one frame`);
    f.select('a');
    while (frames.length) frame();
    assert.deepEqual([attached(3, 5), attached(5)], [2, 0]);
  } finally { unstubAllGlobals(); }
});

test('a hidden subtree such as a cutaway is mounted only while a dataset shows it', async () => {
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML('<html><body><main></main></body></html>');
  const stage = document.querySelector('main') as unknown as HTMLElement;
  const record = (parent: number) => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} });
  const records = [record(-1), record(0), record(1), record(2), record(2)];
  const nodes = records.map(item => document.createElement(item.tag));
  records.forEach((item, index) => { if (item.parent !== -1) nodes[item.parent]!.appendChild(nodes[index]!); });
  const definition = { tree: { nodes: records, properties: [], camera: 0, scene: 1, stageClasses: [] }, materials: [], animations: [], viewBindings: [],
    variants: [{ when: { datasetId: 'surface' }, writes: [], hiddenSubtrees: [2] }, { when: { datasetId: 'cut' }, writes: [] }],
  } as unknown as PreparedPresentationDefinition;
  const presentation = mountPreparedPresentation(stage, { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes: nodes as unknown as HTMLElement[], roots: [nodes[0]] as unknown as HTMLElement[] }), destroy() {} });
  const mounted = () => [nodes[3], nodes[4]].map(node => node!.parentNode !== null);
  assert.deepEqual(mounted(), [false, false]);
  const resources: PreparedResources = { has: () => true, read: () => null, url: () => null, readyKeys: () => [] };
  presentation.commitSelection({ selection: { datasetId: 'cut' }, resources });
  assert.deepEqual(mounted(), [true, true]);
  presentation.commitSelection({ selection: { datasetId: 'surface' }, resources });
  assert.deepEqual(mounted(), [false, false]);
});
