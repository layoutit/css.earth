import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mock } from 'node:test';
let bytes: Uint8Array;
const tree = { nodes: [
  { tag: 'div', parent: null, className: 'shown', style: 'color:red', properties: [2] },
  { tag: 'span', parent: 0, className: 'omitted', style: 'opacity:0', properties: [2, 0, 2] },
  { tag: 'span', parent: 0, className: 'also-omitted', style: 'color:blue', properties: [0, 1] },
] };
let variants: { when: Record<string, string> }[] = [{ when: { dataset: 'normal' } }];
mock.module('@cssearth/renderer', { namedExports: {
  initialObjectSelection: () => ({ dataset: 'normal' }),
  loadPreparedCssObject: async () => ({ controls: {}, tree, variants }),
  omittedPreparedNodes: () => new Set([1, 2]),
} });
mock.module(new URL('./object-page-data.mts', import.meta.url).href, { namedExports: { readPreparedObjectBytes: async () => ({ descriptor: {}, bytes }) } });
const { firstViewTransport } = await import('./first-view-transport.mts');
const encode = (value: unknown) => { bytes = new TextEncoder().encode(JSON.stringify(value)); };
test('first view removes resident styles and remaps omitted properties once in first-use order', async () => {
  encode({ schema: 'transport', data: { extra: 'kept', tree: { extra: 42, nodes: tree.nodes, properties: ['a', 'b', 'c'] } } });
  const result: unknown = JSON.parse(await firstViewTransport('fixture'));
  assert.deepEqual(result, { schema: 'transport', data: { extra: 'kept', tree: { extra: 42, properties: ['c', 'a', 'b'], nodes: [
    { ...tree.nodes[0], style: '', properties: [] }, { ...tree.nodes[1], properties: [0, 1, 0] }, { ...tree.nodes[2], properties: [1, 2] },
  ] } } });
});
test('initial variant and mismatched tree transport failures keep their messages', async () => {
  variants = [];
  await assert.rejects(firstViewTransport('fixture'), /fixture: initial presentation is missing/);
   variants = [{ when: { dataset: 'normal' } }];
  for (const input of [{ data: { tree: { nodes: [...tree.nodes, tree.nodes[0]], properties: [] } } }, null, {}, { data: {} }, { data: { tree: { nodes: [], properties: [] } } }, { data: { tree: { nodes: tree.nodes, properties: null } } }, { data: { tree: { nodes: null, properties: [] } } }]) {
    encode(input);
  await assert.rejects(firstViewTransport('fixture'), /fixture: prepared tree transport differs from its definition/);
  }
});

test('initial presentation requires every selection key to match', async () => {
  variants = [{ when: { dataset: 'normal', lighting: 'night' } }];
  await assert.rejects(firstViewTransport('fixture'), /fixture: initial presentation is missing/);
  variants = [{ when: { dataset: 'normal' } }];
});
