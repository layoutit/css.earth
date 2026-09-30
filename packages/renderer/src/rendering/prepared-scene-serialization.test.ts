import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test as vitestTest } from 'vitest';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from '../loader.js';
import { serializePreparedScene } from './prepared-scene-serialization.js';

const root = new URL('../../../../', import.meta.url);
// Saturn's prepared runtime is restored, not tracked; an unrestored checkout skips the file as the site test did through sourceTest().
const restored = existsSync(new URL('src/objects/saturn/prepared/object.json', root));
const test = vitestTest.skipIf(!restored);
async function fixture(id = 'saturn') {
  const descriptor = parseObjectDescriptor(await readFile(new URL(`src/objects/${id}/object.json`, root), 'utf8'));
  if (!descriptor.prepared) throw new Error('Fixture requires its prepared reference.');
  const bytes = new Uint8Array(await readFile(new URL(`src/objects/${id}/${descriptor.prepared.url}`, root))).buffer;
  return { descriptor, bytes };
}
const { descriptor, bytes } = restored ? await fixture() : ({} as Awaited<ReturnType<typeof fixture>>);
const definition = restored ? await loadPreparedCssObject(descriptor, { async read() { return bytes; } }) : (undefined as never);

test('serialization publishes the authenticated topology without changing its prepared records', () => {
  const before = JSON.stringify(definition);
  const scene = serializePreparedScene(definition);
  expect(scene.nodes).toBe(definition.tree.nodes.length);
  expect([...scene.html.matchAll(/data-prepared-node="\d+"/g)].length).toBe(definition.tree.nodes.length);
  expect([...scene.html.matchAll(/class="polycss-scene"/g)].length).toBe(1);
  expect(JSON.stringify(definition)).toBe(before);
});

test('every Saturn dataset keeps the same topology and applies its prepared presentation', () => {
  const before = JSON.stringify(definition);
  const normal = serializePreparedScene(definition);
  for (const dataset of definition.controls.datasets!.controls) {
    const scene = serializePreparedScene(definition, dataset.id);
    expect(scene.nodes).toBe(normal.nodes);
    expect([...scene.html.matchAll(/data-prepared-node="\d+"/g)].map(match => match[0]))
      .toEqual([...normal.html.matchAll(/data-prepared-node="\d+"/g)].map(match => match[0]));
    if (dataset.id === 'normal') expect(scene).toEqual(normal);
    else expect(scene.html).not.toBe(normal.html);
    if (dataset.id === 'cross-section') expect(scene.attributes['data-view']).toBe('interior');
    if (dataset.id === 'ultraviolet') expect(scene.attributes['data-dataset']).toBe('ultraviolet');
  }
  expect(() => serializePreparedScene(definition, 'unknown')).toThrow(/Unknown object dataset/);
  expect(JSON.stringify(definition)).toBe(before);
});

test('HTML escaping and ordered CSS writes preserve quoted semicolons and the initial selection', () => {
  const scene = serializePreparedScene({ ...definition, controls: { datasets: null, settings: null },
    materials: [], motion: [], animations: [], textureLevels: undefined,
    tree: { camera: 0, scene: 1, stageClasses: ['prepared'], properties: [{ name: 'color', value: 'green', custom: false }], nodes: [
      { tag: 'div', parent: -1, className: 'polycss-camera', style: '', properties: [], attributes: {} },
      { tag: 'div', parent: 0, className: 'polycss-scene', style: 'color:red;--label:"a;b";background-image:url("/a;b.png")', properties: [0], attributes: { title: '<a & "b">' } },
    ] },
    variants: [{ when: { datasetId: null }, required: [], materials: [], writes: [
      { target: 1, kind: 'style', name: 'color', value: 'blue' },
      { target: -1, kind: 'attribute', name: 'data-dataset', value: 'initial' },
    ] }],
  });
  expect(scene.html).toMatch(/title="&lt;a &amp; &quot;b&quot;&gt;"/);
  expect(scene.html).toMatch(/color:blue;--label:&quot;a;b&quot;;background-image:url\(&quot;\/a;b.png&quot;\)/);
  expect(scene.attributes).toEqual({ 'data-dataset': 'initial' });
  expect(scene.classes).toEqual(['prepared']);
});

test('a view resolves only the textures it writes, and reports them', () => {
  const resolved: string[] = [];
  const scene = serializePreparedScene(definition, undefined, undefined, (key, address) => { resolved.push(key); return `https://earth-assets.example${address}`; });
  expect(resolved).toEqual(scene.textures.map(texture => texture.key));
  expect(scene.textures.length > 0 && scene.textures.length < definition.assets.entries.length).toBe(true);
  for (const { address } of scene.textures) expect(scene.html.includes(`https://earth-assets.example${address}`.replaceAll('"', '&quot;'))).toBe(true);
});
