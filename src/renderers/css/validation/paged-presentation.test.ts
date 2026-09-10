import { preparedPagingFixture as original } from '../paging/__fixtures__/prepared-page.mts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parsePreparedObjectRuntime } from './index.js';
import { parsePreparedPagePlan } from '../paging/capabilities.js';
import { record, array } from './guards.js';

const copy = () => record(structuredClone(original), 'test document');
const layers = (input: Record<string, unknown>) => array(input.pageLayers, 'test page layers');
const layer = (input: Record<string, unknown>, index = 0) => record(layers(input)[index], 'test page layer');
const plan = (input: Record<string, unknown>, index = 0) => record(layer(input, index).plan, 'test page plan');

test('the external runtime boundary preserves both source-backed page plans and metadata stubs', () => {
  const parsed = parsePreparedObjectRuntime(original);
  assert.equal(parsed, original);
  assert.equal(parsed.pageLayers?.length, 2);
  for (const page of parsed.pageLayers ?? []) {
    assert.equal(parsePreparedPagePlan(page.plan, { lensIds: page.lensIds }), page.plan);
  }
  assert.ok(parsed.pageLayers?.some(page => {
    const roots = array(record(page.plan, 'page').roots, 'roots');
    return roots.some(root => record(root, 'root').stub === true && record(root, 'root').children === undefined);
  }));
});

test('malformed page budgets, roots and matrices fail at the external runtime boundary', () => {
  const mutations: Array<(page: Record<string, unknown>) => void> = [
    page => { page.poolSize = 0; },
    page => { page.poolSize = 513; },
    page => { page.maximumDecodedBytes = 1; },
    page => { page.maximumConcurrentLoads = 0; },
    page => { page.rasterScale = 0; },
    page => { page.rasterScale = Infinity; },
    page => { record(page.index, 'index').maximumDirectories = 0; },
    page => { record(array(page.roots, 'roots')[0], 'root').corners = []; },
    ...['frameMatrix', 'textureMatrix'].flatMap(field => ['', '1,2,3', Array(16).fill('NaN').join(','),
      Array(16).fill('1e999').join(','), Array(16).fill('0x10').join(','), Array(16).fill(' ').join(',')]
      .map(value => (page: Record<string, unknown>) => { record(page.initialLayer, 'initial layer')[field] = value; })),
  ];
  for (const mutate of mutations) {
    const input = copy(); mutate(plan(input));
    assert.throws(() => parsePreparedObjectRuntime(input), TypeError);
  }
});

test('internal page lens overrides cannot silently disagree with the validated binding', () => {
  for (const lensIds of [[], ['not-a-lens'], ['normal'], ['normal', 'normal'], ['normal', 'buenos-aires-noise', 'elevation']]) {
    const input = copy(); plan(input).lensIds = lensIds;
    assert.throws(() => parsePreparedObjectRuntime(input), /page lenses/);
  }
  const duplicate = copy(); layer(duplicate).lensIds = ['normal', 'normal'];
  assert.throws(() => parsePreparedObjectRuntime(duplicate), /page binding lenses/);
  const reordered = copy(); plan(reordered).lensIds = [...array(layer(reordered).lensIds, 'lenses')].reverse();
  assert.equal(parsePreparedObjectRuntime(reordered), reordered, 'lens identity is set-based, not array-order dependent');
});
