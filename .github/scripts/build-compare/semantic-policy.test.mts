import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedHunk, outputMatches, semanticPolicy, sourceSeedMatches } from './semantic-policy.mts';
test('output declarations validate globs, reasons and layout', () => {
  assert.deepEqual(semanticPolicy({}), { outputs: [], layout: 'none' });
  assert.deepEqual(semanticPolicy({ layout: 'changes', outputs: [{ glob: 'objects/**/object.json', reason: 'Transport changes' }] }).layout, 'changes');
  for (const raw of [{ layout: 'yes' }, { outputs: [{ glob: '/page', reason: 'x' }] }, { outputs: [{ glob: '../page', reason: 'x' }] }, { outputs: [{ glob: 'page', reason: ' ' }] }, { outputs: [{ glob: 'page', reason: 'x', surprise: true }] }]) assert.throws(() => semanticPolicy(raw));
});
test('relative output glob matching observes separators', () => {
  assert.equal(outputMatches('index.html', '**/*.html'), true);
  assert.equal(outputMatches('a/b/index.html', '**/*.html'), true);
  assert.equal(outputMatches('objects/earth/object.json', 'objects/*/object.json'), true);
  assert.equal(outputMatches('objects/earth/deep/object.json', 'objects/*/object.json'), false);
  assert.equal(outputMatches('ab/index.html', 'a?/index.html'), true);
  assert.equal(outputMatches('catalogXjson', 'catalog.json'), false);
});
test('source mapping is package-granular only for bundled shared owners', () => {
  assert.equal(sourceSeedMatches('client:packages/core/dist/chunk.js', 'packages/core/src/value.ts'), true);
  assert.equal(sourceSeedMatches('client:packages/engine/dist/index.js', 'packages/core/src/value.ts'), false);
  assert.equal(sourceSeedMatches('client:packages/bake/dist/index.js', 'packages/bake/src/value.ts'), false);
  assert.equal(sourceSeedMatches('prerender:\0virtual:astro:page:site/pages/index@_@astro', 'site/pages/index.astro'), true);
});
test('changed span handles additions, removals and replacements', () => {
  assert.deepEqual(changedHunk('abc', 'abXc'), { base: '', head: 'X' });
  assert.deepEqual(changedHunk('abXc', 'abc'), { base: 'X', head: '' });
  assert.deepEqual(changedHunk('abXc', 'abYc'), { base: 'X', head: 'Y' });
});
