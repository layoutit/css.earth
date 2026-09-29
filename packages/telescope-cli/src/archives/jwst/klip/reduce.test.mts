import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { jwstToolchain } from '../toolchain.mts';

test('the spaceKLIP toolchain reads its descriptor and lock beside this code before it looks for an installed environment', async () => {
  // Installed or not, the pins are read first: a missing descriptor or lock fails with ENOENT, anything else is about the install.
  await jwstToolchain('klip', 'jwst_1256.pmap').catch((error: unknown) => assert.doesNotMatch(String(error), /ENOENT/u));
});
