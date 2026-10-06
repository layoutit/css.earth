import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preparedObjectText } from '@cssearth/objects/node';
import { readFile } from 'node:fs/promises';
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../../loader.js';
import { serializePreparedScene } from './prepared-scene-serialization.js';
import { omittedPreparedNodes } from '../dom/prepared-omitted-nodes.js';
import { selectedPreparedVariant } from './prepared-presentation.js';
import { initialObjectSelection } from '../../runtime/object-contract.js';
import { leafBoxBindings, leafBoxExact, leafBoxStyles } from '../culling/prepared-leaf-box-direct.js';
import { preparedTextureSizes } from '../textures/prepared-texture-levels.js';

const root = new URL('../../../../../', import.meta.url);
// Saturn's prepared runtime is restored, not tracked; an unrestored checkout skips the file as the site test did through sourceTest().
const restored = existsSync(new URL('src/objects/saturn/prepared/runtime.json', root));
const test = (name: string, body: () => void | Promise<void>) => nodeTest(name, { skip: !restored }, body);
async function fixture(id = 'saturn') {
  const descriptor = parseObjectDescriptor(await readFile(new URL(`src/objects/${id}/object.json`, root), 'utf8'));
  if (!descriptor.prepared) throw new Error('Fixture requires its prepared reference.');
  const bytes = new TextEncoder().encode(await preparedObjectText(fileURLToPath(new URL(`src/objects/${id}/`, root)), descriptor)).buffer;
  return { descriptor, bytes };
}
const { descriptor, bytes } = restored ? await fixture() : ({} as Awaited<ReturnType<typeof fixture>>);
const definition = restored ? await loadPreparedCssObject(descriptor, { async read() { return bytes; } }) : (undefined as never);

test('serialization publishes the authenticated topology without changing its prepared records', () => {
  const before = JSON.stringify(definition);
  const scene = serializePreparedScene(definition);
  assert.equal(scene.nodes, definition.tree.nodes.length);
  // What the initial selection hides stays out of the markup (prepared-omitted-nodes.ts).
  const variant = selectedPreparedVariant(definition, initialObjectSelection(definition.controls));
  assert.equal([...scene.html.matchAll(/data-prepared-node="\d+"/g)].length, definition.tree.nodes.length - omittedPreparedNodes(definition.tree, variant).size);
  assert.equal([...scene.html.matchAll(/class="polycss-scene"/g)].length, 1);
  assert.equal(JSON.stringify(definition), before);
});

test('every Saturn dataset publishes the nodes it shows and applies its prepared presentation', () => {
  const before = JSON.stringify(definition);
  const normal = serializePreparedScene(definition);
  for (const dataset of definition.controls.datasets!.controls) {
    const scene = serializePreparedScene(definition, dataset.id);
    assert.equal(scene.nodes, normal.nodes);
    // Each dataset's markup is the whole tree less what its selection hides.
    const omitted = omittedPreparedNodes(definition.tree, selectedPreparedVariant(definition, initialObjectSelection(definition.controls, dataset.id)));
    assert.deepEqual([...scene.html.matchAll(/data-prepared-node="(\d+)"/g)].map(match => Number(match[1])).sort((a, b) => a - b), definition.tree.nodes.map((_, index) => index).filter(index => !omitted.has(index)));
    if (dataset.id === 'normal') assert.deepEqual(scene, normal);
    else assert.notEqual(scene.html, normal.html);
    if (dataset.id === 'ultraviolet') assert.equal(scene.attributes['data-dataset'], 'ultraviolet');
  }
  assert.throws(() => serializePreparedScene(definition, 'unknown'), /Unknown object dataset/);
  assert.equal(JSON.stringify(definition), before);
});

test('HTML escaping and ordered CSS writes preserve quoted semicolons and the initial selection', () => {
  const scene = serializePreparedScene({ ...definition, controls: { datasets: null, settings: null },
    materials: [], motion: [], animations: [], textureLevels: undefined, viewBindings: [],
    tree: { camera: 0, scene: 1, stageClasses: ['prepared'], properties: [{ name: 'color', value: 'green', custom: false }], nodes: [
      { tag: 'div', parent: -1, className: 'polycss-camera', style: '', properties: [], attributes: {} },
      { tag: 'div', parent: 0, className: 'polycss-scene', style: 'color:red;--label:"a;b";background-image:url("/a;b.png")', properties: [0], attributes: { title: '<a & "b">' } },
    ] },
    variants: [{ when: { datasetId: null }, required: [], materials: [], writes: [
      { target: 1, kind: 'style', name: 'color', value: 'blue' },
      { target: -1, kind: 'attribute', name: 'data-dataset', value: 'initial' },
    ] }],
  });
  assert.match(scene.html, /title="&lt;a &amp; &quot;b&quot;&gt;"/);
  assert.match(scene.html, /color:blue;--label:&quot;a;b&quot;;background-image:url\(&quot;\/a;b.png&quot;\)/);
  assert.deepEqual(scene.attributes, { 'data-dataset': 'initial' });
  assert.deepEqual(scene.classes, ['prepared']);
});

test('a view resolves only the textures it writes, and reports them', () => {
  const resolved: string[] = [];
  const scene = serializePreparedScene(definition, undefined, undefined, (key, address) => { resolved.push(key); return `https://earth-assets.example${address}`; });
  assert.deepEqual(resolved, scene.textures.map(texture => texture.key));
  assert.equal((scene.textures.length > 0 && scene.textures.length < definition.assets.entries.length), true);
  for (const { address } of scene.textures) assert.equal(scene.html.includes(`https://earth-assets.example${address}`.replaceAll('"', '&quot;')), true);
});

test('the markup writes each image on the elements that draw it, and none through a custom property', () => {
  const scene = serializePreparedScene(definition), variant = selectedPreparedVariant(definition, initialObjectSelection(definition.controls));
  assert.equal(/var\(--/u.test(scene.html), false, 'no element reads a custom property');
  const slots = new Map((definition.tree.textureBindings ?? []).map(slot => [`${slot.target}:${slot.name}`, slot.leaves] as const));
  const style = (node: number) => new RegExp(`data-prepared-node="${node}"[^>]*style="([^"]*)"`, 'u').exec(scene.html)?.[1] ?? '';
  let faces = 0;
  for (const write of variant.writes) if (write.kind === 'texture' && write.resource !== null) {
    for (const node of slots.get(`${write.target}:${write.name}`) ?? [write.target]) { faces++; assert.match(style(node), /background-image:url\(/u, `node ${node} draws ${write.name}`); }
  }
  // Saturn: one ring leaf, four polar caps and 448 faces.
  assert.equal(faces, 453);
});

test('a paged body ships each face in the exact box of the level its markup shows', async () => {
  // The Moon's markup shows its first texture level, 1,040 texels wide across a background of 4,096 px at the full
  // 128 px box: a face ships in the 16.25 px that hold it at two texels a pixel, not in the box of its step alone.
  const moon = await fixture('moon');
  const paged = await loadPreparedCssObject(moon.descriptor, { async read() { return moon.bytes; } });
  const scene = serializePreparedScene(paged), boxes = leafBoxBindings(paged.viewBindings);
  const variant = selectedPreparedVariant(paged, initialObjectSelection(paged.controls));
  const write = variant.writes.find(binding => binding.kind === 'texture' && binding.resource !== null && paged.tree.textureBindings?.some(entry => entry.name === binding.name && entry.leaves.length > 2));
  assert.ok(write?.kind === 'texture' && write.resource !== null);
  const leaf = paged.tree.textureBindings!.find(entry => entry.name === write.name)!.leaves.find(node => boxes.boxes.some(box => box.node === node && box.box))!;
  const record = boxes.boxes.find(box => box.node === leaf)!;
  const exact = leafBoxExact(record, preparedTextureSizes(paged)(paged.textureLevels!.levels[0]!.resources[write.resource]!));
  assert.deepEqual(exact, { factor: 16.25 / 128, tile: [520, 96], kept: true });
  const full = Object.fromEntries(leafBoxStyles(record, boxes.step, boxes.outset)), shipped = Object.fromEntries(leafBoxStyles(record, boxes.step, boxes.outset, false, exact));
  const tag = new RegExp(`<[^>]*data-prepared-node="${leaf}"[^>]*>`).exec(scene.html)?.[0] ?? '';
  assert.ok(parseFloat(shipped.width!) <= 16.25 && tag.includes(`width:${shipped.width}`), `leaf ${leaf} ships ${/width:[^;"]+/.exec(tag)?.[0]}, its image gives ${shipped.width} and its step alone ${full.width}`);
});
