import { expect, test } from 'vitest';
import { requireTextureBindings } from './texture-bindings.js';
const node = (parent: number) => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} });
const nodes = [node(-1), node(0), node(1), node(0), node(3)];
test('prepared texture binding cannot cross branches, share a leaf or target a parent', () => {
  expect(() => requireTextureBindings([{ target: 1, name: '--image', leaves: [2] }], nodes)).not.toThrow();
  for (const leaves of [[4], [1], [2, 2], [99]])
    expect(() => requireTextureBindings([{ target: 1, name: '--image', leaves }], nodes)).toThrow();
  expect(() => requireTextureBindings([
    { target: 1, name: '--image', leaves: [2] }, { target: 0, name: '--other', leaves: [2] },
  ], nodes)).toThrow();
});
