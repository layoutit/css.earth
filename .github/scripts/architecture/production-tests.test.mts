/** Production must never depend on test consumers, including lazy and type-only edges. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateRules, LAYER_RULES } from './rules.mts';
import type { ImportGraph } from './import-graph/graph.mts';

test('production test boundary rejects fixtures/helpers; test consumers may import production', () => {
  const edges = ['site/a.test.mts', 'site/world/fixtures/object.mts', 'site/world/object.test-support.mts'].map(to =>
    ({ from: 'site/world/object.mts', to, symbols: [], test: false, typeOnly: true }));
  const graph: ImportGraph = { files: new Map(), edges: [...edges,
    { from: 'site/a.test.mts', to: 'site/world/object.mts', symbols: [], test: true, typeOnly: false }] };
  assert.equal(evaluateRules(graph).get('production-imports-no-tests')?.length, 3);
  // Deleting this rule must lose the three findings: its absence cannot silently pass this test.
  assert.equal(evaluateRules(graph, LAYER_RULES.filter(rule => rule.id !== 'production-imports-no-tests')).get('production-imports-no-tests'), undefined);
});
