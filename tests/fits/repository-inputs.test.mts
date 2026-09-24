import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fits from '@cssearth/fits';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { PINS, readPins, summarize, trackedFitsFiles } from './repository-inputs.mts';

const pins = await readPins();

test('every tracked FITS file is pinned, and every pin names a tracked file', () => {
  assert.deepEqual(Object.keys(pins).sort(), trackedFitsFiles(), `${PINS} lists a different set of files; see tests/fits/repository-inputs.mts`);
});

for (const [path, expected] of Object.entries(pins)) test(`@cssearth/fits reads ${path} as the pre-package readers did`, async () => {
  assert.deepEqual(await summarize({ ...fits, readFitsFileHdus }, path), expected);
});
