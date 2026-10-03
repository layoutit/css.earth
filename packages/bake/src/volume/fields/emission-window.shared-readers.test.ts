import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('convex edge admission delegates to core', () => {
  const caller = source('./emission-window.ts');
  assert.match(caller, /convexWindowEdges\(/u);
  assert.doesNotMatch(caller, /function edges|Math\.hypot/u);
});
