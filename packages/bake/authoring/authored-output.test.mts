import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { runAuthor, writeOrCheckAuthoredOutputs } from './authored-output.mts';

const ordinary = { readError: 'propagate-read-error', mkdir: 'none' } as const;
const shell = { readError: 'mismatch-on-read-error', mkdir: 'root-before-write-or-check',
  mismatchMessage: (path: string) => `Authored output differs: ${path}` } as const;

test('write/check preserves bytes; mismatch leaves existing output untouched', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'authored-output-'));
  try {
    const outputs = [['file', Buffer.from([0, 255, 13, 10])]] as const;
    await writeOrCheckAuthoredOutputs(root, outputs, { ...ordinary, check: false });
    await writeOrCheckAuthoredOutputs(root, outputs, { ...ordinary, check: true });
    await assert.rejects(writeOrCheckAuthoredOutputs(root, [['file', Buffer.from('different')]], { ...ordinary, check: true }),
      { message: 'file differs from its authored recomputation.' });
    assert.deepEqual(await readFile(resolve(root, 'file')), outputs[0][1]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ordinary callers propagate read errors and create no directories', async () => {
  const parent = await mkdtemp(resolve(tmpdir(), 'authored-output-'));
  const root = resolve(parent, 'missing');
  try {
    for (const check of [true, false]) await assert.rejects(
      writeOrCheckAuthoredOutputs(root, [['file', Buffer.from('a')]], { ...ordinary, check }), { code: 'ENOENT' });
    await assert.rejects(readFile(root), { code: 'ENOENT' });
    await mkdir(root);
    await mkdir(resolve(root, 'file'));
    await assert.rejects(writeOrCheckAuthoredOutputs(root, [['file', Buffer.from('a')]], { ...ordinary, check: true }), { code: 'EISDIR' });
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('shell creates the root even on check/empty outputs and masks all read errors, without creating child directories', async () => {
  const parent = await mkdtemp(resolve(tmpdir(), 'authored-output-'));
  const root = resolve(parent, 'missing');
  try {
    await writeOrCheckAuthoredOutputs(root, [], { ...shell, check: true });
    await mkdir(root).then(() => assert.fail('root should exist'), error => assert.equal(error.code, 'EEXIST'));
    await assert.rejects(writeOrCheckAuthoredOutputs(root, [['file', Buffer.from('a')]], { ...shell, check: true }), { message: 'Authored output differs: file' });
    await mkdir(resolve(root, 'file'));
    await assert.rejects(writeOrCheckAuthoredOutputs(root, [['file', Buffer.from('a')]], { ...shell, check: true }), { message: 'Authored output differs: file' });
    await assert.rejects(writeOrCheckAuthoredOutputs(root, [['child/file', Buffer.from('a')]], { ...shell, check: false }), { code: 'ENOENT' });
    await writeOrCheckAuthoredOutputs(root, [['ok', Buffer.from('a')]], { ...shell, check: false });
    await writeOrCheckAuthoredOutputs(root, [['ok', Buffer.from('a')]], { ...shell, check: true });
  } finally { await rm(parent, { recursive: true, force: true }); }
});


test('runAuthor computes once, forwards check policy, preserves bytes and returns the body result', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'run-author-'));
  try {
    let calls = 0;
    const result = { body: 'test', measurements: [1, 2] };
    const bytes = Buffer.from([0, 255, 13, 10]);
    const compute = async () => { calls++; return { outputs: [['file', bytes]] as const, result }; };
    assert.equal(await runAuthor({ root, compute, ...ordinary, check: false }), result);
    assert.deepEqual(await readFile(resolve(root, 'file')), bytes);
    assert.equal(await runAuthor({ root, compute, ...ordinary, check: true }), result);
    assert.equal(calls, 2);
    await assert.rejects(runAuthor({ root, ...ordinary, check: true,
      compute: async () => ({ outputs: [['file', Buffer.from('changed')]], result }) }),
    { message: 'file differs from its authored recomputation.' });
    assert.deepEqual(await readFile(resolve(root, 'file')), bytes);
    await assert.rejects(runAuthor({ root, ...ordinary, check: true,
      compute: async () => ({ outputs: [['missing', bytes]], result }) }), { code: 'ENOENT' });
    await assert.rejects(runAuthor({ root, ...shell, check: true,
      compute: async () => ({ outputs: [['missing', bytes]], result }) }), { message: 'Authored output differs: missing' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
