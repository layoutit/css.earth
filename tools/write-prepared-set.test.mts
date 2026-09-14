import assert from 'node:assert/strict';
import test from 'node:test';
import fs, { mkdtemp, readFile, writeFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
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

test('file sources republish unchanged bytes for the trace and reject duplicate or symlink targets', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-prepared-source-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, 'source.webp'), target = join(directory, 'target.webp');
  await writeFile(source, Uint8Array.of(0, 255, 128));
  await writePreparedSet([{ path: target, source }]);
  const rename = fs.rename, spy = t.mock.method(fs, 'rename', rename);
  syncBuiltinESMExports();
  try {
    await writePreparedSet([{ path: target, source }]);
    assert.equal(spy.mock.callCount(), 1);
  } finally { spy.mock.restore(); syncBuiltinESMExports(); }
  await assert.rejects(writePreparedSet([{ path: target, source }, { path: target, remove: true }]), /Duplicate/);
  await rm(target); await symlink(source, target);
  await assert.rejects(writePreparedSet([{ path: target, text: 'changed' }]), /not a regular file/);
  assert.deepEqual(await readFile(source), Buffer.from([0, 255, 128]));
});

test('a second failure during rollback retains the previous bytes for recovery', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-prepared-rollback-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const first = join(directory, 'first.json'), second = join(directory, 'second.json');
  await writeFile(first, 'old first'); await writeFile(second, 'old second');
  const rename = fs.rename; let call = 0;
  const mock = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (++call > 1) throw new Error('disk failure');
    return rename(...args);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(writePreparedSet([{ path: first, text: 'new first' }, { path: second, text: 'new second' }]), /rollback failed/);
    const backup = (await readdir(directory)).find(name => name.startsWith('first.json.') && name.endsWith('.backup'));
    assert.ok(backup); assert.equal(await readFile(join(directory, backup), 'utf8'), 'old first');
    assert.equal(await readFile(second, 'utf8'), 'old second');
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
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
