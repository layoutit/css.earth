import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('density transport uses shared text admission', () => {
  const caller = source('./loader.ts');
  assert.match(caller, /parsePreparedDensityVolumeText\(text, descriptor\)/u);
  assert.doesNotMatch(caller, /JSON\.parse\(new TextDecoder/u);
});
