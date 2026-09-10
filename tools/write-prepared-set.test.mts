import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePreparedSet } from './write-prepared-set.mts';

test('a staging failure leaves every previous prepared file intact and removes temporary files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-prepared-set-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'catalogue.json'); await writeFile(file, 'previous');
  await assert.rejects(writePreparedSet([{ path: file, text: 'replacement' }, { path: join(directory, 'missing/provenance.json'), text: 'new' }]));
  assert.equal(await readFile(file, 'utf8'), 'previous');
  assert.deepEqual(await readdir(directory), ['catalogue.json']);
  await writePreparedSet([{ path: file, text: 'replacement' }, { path: join(directory, 'provenance.json'), text: 'new' }]);
  assert.equal(await readFile(file, 'utf8'), 'replacement');
  assert.equal(await readFile(join(directory, 'provenance.json'), 'utf8'), 'new');
});
