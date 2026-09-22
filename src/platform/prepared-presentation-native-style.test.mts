import { parsePreparedObjectRuntime } from "../renderers/css/dist/index.js";
import {loadObjectTestDefinition} from '../../tools/contract/object-test-data.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENE_OBJECTS as OBJECTS } from '../../site/objects.mts';
import { retainedPresentationFixture } from './test/object-runtime-package.mts';
import { mountPreparedPresentation } from '../renderers/css/dist/testing.js';
import { requireObjectRuntimeDefinition } from '../../tools/contract/object-runtime-contract.mts';

for (const object of OBJECTS) {
  const runtimeDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition(object.id));
  test(`${object.id}: an empty prepared declaration does not write native cssText`, () => {
    const fixture = retainedPresentationFixture(runtimeDefinition);
    const writes: unknown[] = [];
    const nativeCreate = fixture.document.createElement.bind(fixture.document);
    fixture.document.createElement = tag => {
      const element = nativeCreate(tag);
      element.style = new Proxy(element.style, { set(target, name, value: unknown) {
        if (name === 'cssText') writes.push(value);
        return Reflect.set(target, name, value);
      } });
      return element;
    };
    try {
      mountPreparedPresentation(fixture.stage, fixture.context, runtimeDefinition);
      assert.deepEqual(writes, runtimeDefinition.tree.nodes.map(node => node.style).filter(Boolean));
      assert.equal(fixture.stage.querySelectorAll('*').length, runtimeDefinition.tree.nodes.length);
    } finally { fixture.restore(); }
  });
}

test('explicit prepared empty style attributes are preserved', async () => {
  const runtimeDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
  const definition = structuredClone(runtimeDefinition);
  const node = definition.tree.nodes.at(-1);
  assert.ok(node);
  node.style = ''; node.properties = []; Reflect.set(node.attributes, 'style', '');
  requireObjectRuntimeDefinition(definition);
  const fixture = retainedPresentationFixture(definition);
  try {
    mountPreparedPresentation(fixture.stage, fixture.context, definition);
    const last = fixture.stage.querySelectorAll('*').at(-1);
    assert.ok(last);
    assert.equal(last.getAttribute('style'), '');
  } finally { fixture.restore(); }
});

test('empty attribute preservation cannot bypass prepared CSS validation', async () => {
  const runtimeDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
  for (const style of ['filter:blur(1px)', 'background:red', ' ']) {
    const definition = structuredClone(runtimeDefinition);
    const node = definition.tree.nodes.at(-1);
    assert.ok(node);
    node.style = ''; node.properties = []; Reflect.set(node.attributes, 'style', style);
    assert.throws(() => requireObjectRuntimeDefinition(definition), /unsupported attribute style/);
  }
  const definition = structuredClone(runtimeDefinition);
  const node = definition.tree.nodes.find(node => node.properties.length > 0);
  assert.ok(node);
  Reflect.set(node.attributes, 'style', '');
  assert.throws(() => requireObjectRuntimeDefinition(definition), /unsupported attribute style/);
});
