import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('stellar limb evaluation delegates to core', () => {
  const caller = source('./limb-laws.ts');
  assert.match(caller, /export \{ limbIntensity \} from '@cssearth\/core'/u);
  assert.doesNotMatch(caller, /function limbIntensity/u);
});
