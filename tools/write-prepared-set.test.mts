import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePreparedSet } from './write-prepared-set.mts';

test('a staging failure leaves every previous prepared file intact and removes temporary files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-prepared-set-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'catalogue.json'); await writeFile(file, 'previous');
  await assert.rejects(writePreparedSet([{ path: file, text: 'replacement' }, { path: join(file, 'provenance.json'), text: 'new' }]));
  assert.equal(await readFile(file, 'utf8'), 'previous');
  assert.deepEqual(await readdir(directory), ['catalogue.json']);
  await writePreparedSet([{ path: file, text: 'replacement' }, { path: join(directory, 'provenance.json'), text: 'new' }]);
  assert.equal(await readFile(file, 'utf8'), 'replacement');
  assert.equal(await readFile(join(directory, 'provenance.json'), 'utf8'), 'new');
});

test('binary previews and JSON metadata publish together into missing parents and unchanged bytes are retained', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-prepared-binary-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const image = { path: join(directory, 'datasets/preview.webp'), text: Uint8Array.of(0, 255, 128, 254, 0) };
  const metadata = { path: join(directory, 'prepared/presentation.json'), text: '{"preview":"datasets/preview.webp"}\n' };
  await writePreparedSet([image, metadata]);
  assert.deepEqual(await readFile(image.path), Buffer.from(image.text));
  assert.equal(await readFile(metadata.path, 'utf8'), metadata.text);
  const before = await Promise.all([image, metadata].map(output => stat(output.path)));
  await writePreparedSet([image, metadata]);
  const after = await Promise.all([image, metadata].map(output => stat(output.path)));
  assert.deepEqual(after.map(entry => entry.mtimeMs), before.map(entry => entry.mtimeMs));
  await assert.rejects(writePreparedSet([{ ...image, text: Uint8Array.of(10, 20) },
    { path: join(metadata.path, 'invalid.json'), text: '{}' }]));
  assert.deepEqual(await readFile(image.path), Buffer.from(image.text));
  assert.equal(await readFile(metadata.path, 'utf8'), metadata.text);
});
