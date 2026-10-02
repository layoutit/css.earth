import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanCssDeclarations } from './css-declaration-scanner.ts';
import { cleanPreparedTree } from './clean-leaves.ts';
import { withLeafBoxRecords } from './leaf-box-records.ts';

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
