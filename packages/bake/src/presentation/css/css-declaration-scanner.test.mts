import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanCssDeclarations } from './css-declaration-scanner.ts';
import { cleanPreparedTree } from './clean-leaves.ts';
import { withLeafBoxRecords } from '../records/leaf-box-records.ts';
import { textureTileVariables, withTextureTileRecords } from '../records/texture-tile-records.ts';

test('declaration fragments preserve quotes, URLs, nesting and malformed input', () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ['', []], [' ; ; ', []], [' color : red ; opacity:1', ['color : red', 'opacity:1']],
    ['content:"a;b:c";width:1px', ['content:"a;b:c"', 'width:1px']],
    ["content:'a;b';height:2px", ["content:'a;b'", 'height:2px']],
    ['background:url(data:image/png;a:b);width:calc(1px * (2 + 3))', ['background:url(data:image/png;a:b)', 'width:calc(1px * (2 + 3))']],
    [String.raw`content:"a\";b";opacity:1`, [String.raw`content:"a\";b"`, 'opacity:1']],
    ['broken;:empty;WIDTH:2px;--Case:yes', ['broken', ':empty', 'WIDTH:2px', '--Case:yes']],
    ['color:red;content:"unfinished;opacity:1', ['color:red']],
    ['color:red;width:calc(1px;opacity:1', ['color:red']],
    ['color:red;)oops;opacity:1', ['color:red']],
    ['color:red;)oops(;opacity:1', ['color:red', ')oops(', 'opacity:1']],
  ];
  for (const [style, expected] of cases) assert.deepEqual([...scanCssDeclarations(style)], expected, style);
});

test('the existing backslash parity defect remains pinned', () => {
  // #1152: two backslashes should permit the closing quote. Its later fix flips this assertion.
  assert.deepEqual([...scanCssDeclarations(String.raw`content:"tail\\";opacity:1`)], []);
});

test('clean leaves rejects malformed fragments while leaf-box removal retains them', () => {
  const node = { parent: -1, tag: 'div', className: null, attributes: {}, style: 'broken;:empty;width:2px', properties: [] };
  assert.throws(() => cleanPreparedTree({ nodes: [node], properties: [] }), {
    name: 'TypeError', message: 'Prepared CSS declaration is invalid: broken',
  });
  const recorded = withLeafBoxRecords({ id: 'fixture', viewBindings: [], tree: { nodes: [{ ...node, properties: [0] }], properties: [{ name: '--polycss-atlas-width', value: '4px', custom: true }] } });
  assert.equal(recorded.tree.nodes[0]!.style, 'broken;:empty;width:4px;');
});

test('each adapter keeps its own name policy over the shared fragments', () => {
  const clean = (style: string) => cleanPreparedTree({ nodes: [{ parent: -1, tag: 'div', className: null, attributes: {}, style, properties: [] }], properties: [] }).nodes[0]!.style;
  // Clean leaves: native names fold to lower case, custom names keep their case, and a fragment whose colon starts it is invalid.
  assert.equal(clean('WIDTH:1px;width:2px;--Case:1;--case:2'), 'width:2px;--Case:1;--case:2;');
  assert.throws(() => clean(':empty'), { message: 'Prepared CSS declaration is invalid: :empty' });
  // Leaf boxes: names match case-sensitively and colonless fragments stay.
  const node = { parent: -1, tag: 'div', className: null, attributes: {}, style: 'broken;WIDTH:2px;width:2px', properties: [0] };
  const boxed = withLeafBoxRecords({ id: 'fixture', viewBindings: [], tree: { nodes: [node], properties: [{ name: '--polycss-atlas-width', value: '4px', custom: true }] } });
  assert.equal(boxed.tree.nodes[0]!.style, 'broken;WIDTH:2px;width:4px;');
  // Texture tiles: names keep their case and colonless fragments stay, so only the exact tile names leave the style.
  const properties = [{ name: '--page-0', value: 'url("/sheet.webp")', custom: true },
    ...textureTileVariables('--page-0', { x: 168, y: 0, scale: 7 }).map(([name, value]) => ({ name, value, custom: true }))];
  const tiled = withTextureTileRecords({ id: 'fixture',
    variants: [{ writes: [{ kind: 'texture' as const, target: 0, name: '--page-0', resource: 'page:normal:0', quoted: true }] }],
    textureLevels: { hysteresis: 0.2, levels: [{ minimumDiameter: 0, resources: { 'page:normal:0': 'sheet' }, tiles: { 'page:normal:0': { x: 168, y: 0, scale: 7 } } }, { minimumDiameter: 230, resources: { 'page:normal:0': 'page' } }] },
    tree: { nodes: [{ parent: -1, style: '', properties: [0, 1, 2, 3] },
      { parent: 0, style: 'Background-Size:9px;broken;background-sizeX;:empty;background-position:calc(-1px * var(--page-0-x, 0) - 1px) calc(-1px * var(--page-0-y, 0) - 2px);background-size:calc(168px * var(--page-0-scale, 1)) auto', properties: [] }],
    properties, textureBindings: [{ target: 0, name: '--page-0', leaves: [1] }] } });
  assert.equal(tiled.tree.nodes[1]!.style, 'Background-Size:9px;broken;:empty;');
});
