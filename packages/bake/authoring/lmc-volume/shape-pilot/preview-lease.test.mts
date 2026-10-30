import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPreviewLease } from './preview-lease.mts';
test('a bank activation or restoration cannot overlap an active preview', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lmc-preview-')), path = dir + '/lease'; let called = false;
  try {
    await withPreviewLease(path, async () => { await assert.rejects(withPreviewLease(path, async () => { called = true; }), /still running/); });
    assert.equal(called, false); await withPreviewLease(path, async () => { called = true; }); assert.equal(called, true);
    await writeFile(path, '2147483647'); await withPreviewLease(path, async () => {});
  } finally { await rm(dir, { recursive: true, force: true }); }
});
