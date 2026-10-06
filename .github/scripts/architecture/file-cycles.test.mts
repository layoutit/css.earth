import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFileCycles, fileCycles } from './file-cycles.mts';
import type { ImportGraph } from './import-graph/graph.mts';
import { gateVerdict } from './report.mts';

function graph(...pairs: readonly (readonly [string, string] | readonly [string, string, 'type'])[]): ImportGraph {
  const files = new Map<string, { test: boolean; script: boolean; entryHint: boolean; loc: number }>();
  for (const [from, to] of pairs) for (const path of [from, to]) files.set(path, { test: false, script: false, entryHint: false, loc: 1 });
  return { files, edges: pairs.map(([from, to, kind]) => ({ from, to, test: false, symbols: [], typeOnly: kind === 'type' })) };
}

test('an import chain without a loop has no cycle', () => {
  assert.deepEqual(checkFileCycles(graph(['packages/a/src/a.ts', 'packages/a/src/b.ts'], ['packages/a/src/b.ts', 'packages/b/src/c.ts'])), []);
});

test('a loop closed by a type-only import is a cycle, named by a path through it', () => {
  const tangled = graph(['packages/a/src/a.ts', 'packages/a/src/b.ts'], ['packages/a/src/b.ts', 'packages/a/src/c.ts'],
    ['packages/a/src/c.ts', 'packages/a/src/a.ts', 'type'], ['packages/a/src/c.ts', 'packages/a/src/d.ts']);
  assert.deepEqual(fileCycles(tangled), [['packages/a/src/a.ts', 'packages/a/src/b.ts', 'packages/a/src/c.ts']]);
  assert.deepEqual(checkFileCycles(tangled), ['3 files: packages/a/src/a.ts -> packages/a/src/b.ts -> packages/a/src/c.ts -> packages/a/src/a.ts']);
});

test('a loop across packages, a file importing itself and a test import all count', () => {
  const found = fileCycles(graph(['packages/a/src/a.ts', 'packages/b/src/b.ts'], ['packages/b/src/b.ts', 'packages/a/src/a.ts'],
    ['packages/c/src/self.ts', 'packages/c/src/self.ts'], ['packages/d/src/d.test.ts', 'packages/d/src/d.ts'], ['packages/d/src/d.ts', 'packages/d/src/d.test.ts']));
  assert.deepEqual(found, [['packages/a/src/a.ts', 'packages/b/src/b.ts'], ['packages/d/src/d.test.ts', 'packages/d/src/d.ts'], ['packages/c/src/self.ts']]);
});

test('only packages/ is held to it', () => {
  assert.deepEqual(fileCycles(graph(['site/a.mts', 'site/b.mts'], ['site/b.mts', 'site/a.mts'], ['labs/a.mts', 'labs/b.mts'], ['labs/b.mts', 'labs/a.mts'])), []);
});

test('the architecture gate fails on a file cycle with nothing else wrong', () => {
  const loop = graph(['packages/a/src/a.ts', 'packages/a/src/b.ts', 'type'], ['packages/a/src/b.ts', 'packages/a/src/a.ts']);
  assert.deepEqual(gateVerdict(loop, undefined, false), { cycles: ['2 files: packages/a/src/a.ts -> packages/a/src/b.ts -> packages/a/src/a.ts'], worse: true });
  assert.deepEqual(gateVerdict(graph(['packages/a/src/a.ts', 'packages/a/src/b.ts']), undefined, false), { cycles: [], worse: false });
});
