import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('integration Venus descriptor stays pinned to the authored descriptor', async () => {
  const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as unknown;
  assert.deepEqual(await read('../../../../integration/prepared-object-mount/venus-object.json'),
    await read('../../../../src/objects/venus/object.json'));
});
