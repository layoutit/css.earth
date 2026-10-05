/** Ensure pure-move detection removes reference operands rather than executable edits. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importSkeleton } from './source-diff.mts';
test('specifier-only imports and style references preserve skeleton', () => {
  for (const [before, after] of [["import './a.mts';", "import './world/a.mts';"], ["@import './a.css';", "@import './world/a.css';"], ["const u = new URL('./a.json', import.meta.url);", "const u = new URL('../a.json', import.meta.url);"]]) assert.equal(importSkeleton(before!), importSkeleton(after!));
});
test('constants and arbitrary path strings remain executable differences', () => {
  assert.notEqual(importSkeleton('export const x=2;'), importSkeleton('export const x=3;'));
  assert.notEqual(importSkeleton("readFileSync('site/a.mts');"), importSkeleton("readFileSync('site/world/a.mts');"));
});
