import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { loadPreparedCssObject } from '../../src/renderers/css/dist/index.js';
import { firstViewTransport } from '../first-view-transport.mts';
import { readPreparedObjectBytes } from '../object-page-data.mts';
import { loadPreparedSceneMarkup } from '../../tools/prepared/load-prepared-scene.mts';

test('the first-view transport drops exactly the styles its page markup carries and keeps whole what the runtime builds', async () => {
  const { descriptor, bytes } = await readPreparedObjectBytes('earth');
  const read = (value: Uint8Array) => loadPreparedCssObject(descriptor, { async read() { return Uint8Array.from(value).buffer; } });
  const [full, first, markup] = await Promise.all([read(bytes), read(new TextEncoder().encode(await firstViewTransport('earth'))), loadPreparedSceneMarkup('earth')]);
  const rendered = new Set([...markup.html.matchAll(/data-prepared-node="(\d+)"/g)].map(match => Number(match[1])));
  assert.ok(rendered.size > 0 && rendered.size < full.tree.nodes.length, 'Earth markup leaves its hidden cutaway out');
  const resolved = (tree: typeof full.tree, index: number) => ({ style: tree.nodes[index].style, properties: tree.nodes[index].properties.map(id => tree.properties[id]) });
  for (const [index, node] of first.tree.nodes.entries()) {
    const { style, properties, ...shape } = full.tree.nodes[index];
    assert.deepEqual({ ...node, style: undefined, properties: undefined }, { ...shape, style: undefined, properties: undefined });
    if (rendered.has(index)) assert.deepEqual([node.style, node.properties], ['', []], `node ${index} is carried by the markup`);
    else assert.deepEqual(resolved(first.tree, index), resolved(full.tree, index), `node ${index} is built from its record`);
  }
  assert.deepEqual(first.variants, full.variants);
});
