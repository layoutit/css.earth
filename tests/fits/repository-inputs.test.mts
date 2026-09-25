import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import * as fits from '@cssearth/fits';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { PINS, ROOT, readPins, summarize, trackedFitsFiles } from './repository-inputs.mts';

const pins = await readPins();

test('every tracked FITS file is pinned, and every pin names a tracked file', () => {
  assert.deepEqual(Object.keys(pins).sort(), trackedFitsFiles(), `${PINS} lists a different set of files; see tests/fits/repository-inputs.mts`);
});

// A sparse checkout (CI's code-and-text tree leaves out body FITS) skips the files it does not hold.
for (const [path, expected] of Object.entries(pins)) test(`@cssearth/fits reads ${path} as the pre-package readers did`,
  { skip: !existsSync(resolve(ROOT, path)) && `${path} is not checked out` }, async () => {
  assert.deepEqual(await summarize({ ...fits, readFitsFileHdus }, path), expected);
});
