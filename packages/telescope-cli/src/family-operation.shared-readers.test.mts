import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('public photometry uses the shared disc reader', () => {
  const caller = source('./family-operation.mts');
  assert.doesNotMatch(caller, /function parseDiscColor/u);
  assert.match(caller, /parseDiscColorPhotometry\(JSON.parse/u);
});
