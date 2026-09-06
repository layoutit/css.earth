import assert from 'node:assert/strict';
import test from 'node:test';
import { OBJECTS } from '../../site/objects.mjs';
import { retainedPresentationFixture } from './test/object-runtime-package.mjs';
import { mountPreparedPresentation } from './prepared-presentation.mjs';
import { requireObjectRuntimeDefinition } from '../../tools/object-runtime-contract.mjs';

for (const object of OBJECTS) {
  const { runtimeDefinition } = await import(new URL(`../planets/${object.id}/runtime/definition.mjs`, import.meta.url));
  test(`${object.id}: an empty prepared declaration does not write native cssText`, () => {
    const fixture = retainedPresentationFixture(runtimeDefinition);
    const writes = [], nativeCreate = fixture.document.createElement.bind(fixture.document);
    fixture.document.createElement = tag => {
      const element = nativeCreate(tag);
      element.style = new Proxy(element.style, { set(target, name, value) {
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
  const { runtimeDefinition } = await import(new URL('../planets/moon/runtime/definition.mjs', import.meta.url));
  const definition = structuredClone(runtimeDefinition);
  const node = definition.tree.nodes.at(-1);
  node.style = ''; node.properties = []; node.attributes.style = '';
  requireObjectRuntimeDefinition(definition);
  const fixture = retainedPresentationFixture(definition);
  try {
    mountPreparedPresentation(fixture.stage, fixture.context, definition);
    assert.equal(fixture.stage.querySelectorAll('*').at(-1).getAttribute('style'), '');
  } finally { fixture.restore(); }
});

test('empty attribute preservation cannot bypass prepared CSS validation', async () => {
  const { runtimeDefinition } = await import(new URL('../planets/moon/runtime/definition.mjs', import.meta.url));
  for (const style of ['filter:blur(1px)', 'background:red', ' ']) {
    const definition = structuredClone(runtimeDefinition);
    const node = definition.tree.nodes.at(-1);
    node.style = ''; node.properties = []; node.attributes.style = style;
    assert.throws(() => requireObjectRuntimeDefinition(definition), /unsupported attribute style/);
  }
  const definition = structuredClone(runtimeDefinition);
  const node = definition.tree.nodes.find(node => node.properties.length > 0);
  node.attributes.style = '';
  assert.throws(() => requireObjectRuntimeDefinition(definition), /unsupported attribute style/);
});
