import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateRules, LAYER_RULES } from './rules.mts';
import type { ImportGraph } from './graph.mts';

function graph(...pairs: readonly (readonly [string, string] | readonly [string, string, 'type'])[]): ImportGraph {
  return { files: new Map(), edges: pairs.map(([from, to, kind]) => ({ from, to, test: from.includes('.test.'), symbols: [], typeOnly: kind === 'type' })) };
}

test('objects imports core only, including tests and type-only imports', () => {
  const rule = LAYER_RULES.filter(rule => rule.id === 'objects-imports-core-only');
  assert.equal(rule.length, 1);
  assert.equal(rule[0].noBaseline, true);
  const findings = evaluateRules(graph(
    ['packages/objects/src/a.ts', 'packages/engine/src/index.ts'],
    ['packages/objects/src/a.test.ts', 'packages/engine/src/index.ts', 'type'],
    ['packages/objects/src/a.ts', 'packages/core/src/index.ts'],
    ['packages/objects/src/a.ts', 'packages/objects/src/b.ts'],
  ), rule).get('objects-imports-core-only');
  assert.equal(findings?.length, 2);
});

test('engine never imports objects, including tests and type-only imports', () => {
  const rule = LAYER_RULES.filter(rule => rule.id === 'engine-imports-no-objects');
  assert.equal(rule.length, 1);
  assert.equal(rule[0].noBaseline, true);
  const findings = evaluateRules(graph(
    ['packages/engine/src/a.ts', 'packages/objects/src/index.ts'],
    ['packages/engine/src/a.test.ts', 'packages/objects/src/index.ts', 'type'],
    ['packages/engine/src/a.ts', 'packages/core/src/index.ts'],
  ), rule).get('engine-imports-no-objects');
  assert.equal(findings?.length, 2);
});
