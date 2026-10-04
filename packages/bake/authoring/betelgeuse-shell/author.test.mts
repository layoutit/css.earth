import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DOWNLOADS_BASE, PRODUCTS } from './author.mts';
test('check declares absent download requirements instead of reporting a comparison', async t => {
  const root = resolve(import.meta.dirname, '../../../..');
  const present = await access(resolve(root, DOWNLOADS_BASE, PRODUCTS.intensity.path)).then(() => true, () => false);
  if (present) return t.skip('This case requires an unrestored ESO input.');
  const { stdout } = await promisify(execFile)(process.execPath, [resolve(import.meta.dirname, 'author.mts'), '--check']);
  assert.match(stdout, /SKIP betelgeuse-shell --check: requires sources/u);
  assert.match(stdout, /reduce-alma-sio\.mts/u);
  assert.match(stdout, /No outputs compared/u);
  assert.doesNotMatch(stdout, /CHECKED betelgeuse-shell/u);
});
