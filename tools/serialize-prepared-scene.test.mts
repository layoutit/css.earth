import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPreparedCssObject } from '../src/renderers/css/dist/index.js';
import { readPreparedObjectBytes, readSharedBankBytes } from '../site/object-page-data.mts';
import { serializePreparedScene } from './serialize-prepared-scene.mts';

const { descriptor, bytes } = await readPreparedObjectBytes('saturn');
const definition = await loadPreparedCssObject(descriptor, {
  async read() { return Uint8Array.from(bytes).buffer; },
  async readShared(reference) {
    const shared = await readSharedBankBytes(reference);
    assert.ok(shared);
    return Uint8Array.from(shared).buffer;
  },
});

test('serialization publishes the authenticated topology without changing its prepared records', () => {
  const before = JSON.stringify(definition);
  const scene = serializePreparedScene(definition);
  assert.equal(scene.nodes, definition.tree.nodes.length);
  assert.equal([...scene.html.matchAll(/data-prepared-node="\d+"/g)].length, definition.tree.nodes.length);
  assert.equal([...scene.html.matchAll(/class="polycss-scene"/g)].length, 1);
  assert.equal(JSON.stringify(definition), before);
});

test('HTML escaping and ordered CSS writes preserve quoted semicolons and the initial selection', () => {
  const scene = serializePreparedScene({ ...definition, controls: { lenses: null, settings: null },
    materials: [], motion: [], animations: [], textureLevels: undefined,
    tree: { camera: 0, scene: 1, stageClasses: ['prepared'], properties: [{ name: 'color', value: 'green', custom: false }], nodes: [
      { tag: 'div', parent: -1, className: 'polycss-camera', style: '', properties: [], attributes: {} },
      { tag: 'div', parent: 0, className: 'polycss-scene', style: 'color:red;--label:"a;b";background-image:url("/a;b.png")', properties: [0], attributes: { title: '<a & "b">' } },
    ] },
    variants: [{ when: { lensId: null }, required: [], materials: [], writes: [
      { target: 1, kind: 'style', name: 'color', value: 'blue' },
      { target: -1, kind: 'attribute', name: 'data-lens', value: 'initial' },
    ] }],
  });
  assert.match(scene.html, /title="&lt;a &amp; &quot;b&quot;&gt;"/);
  assert.match(scene.html, /color:blue;--label:&quot;a;b&quot;;background-image:url\(&quot;\/a;b.png&quot;\)/);
  assert.deepEqual(scene.attributes, { 'data-lens': 'initial' });
  assert.deepEqual(scene.classes, ['prepared']);
});
