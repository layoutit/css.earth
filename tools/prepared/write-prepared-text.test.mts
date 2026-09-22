import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePreparedText } from './write-prepared-text.mts';

test('unchanged prepared publication preserves mtime and only changed bytes are written', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-write-'));
  const file = join(directory, 'object.json');
  try {
    assert.equal(await writePreparedText(file, '{"ready":true}'), true);
    await utimes(file, 1, 1);
    assert.equal(await writePreparedText(file, '{"ready":true}'), false);
    assert.equal((await stat(file)).mtimeMs, 1000);
    assert.equal(await writePreparedText(file, '{"ready":false}'), true);
    assert.equal(await readFile(file, 'utf8'), '{"ready":false}');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
