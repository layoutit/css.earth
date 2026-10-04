import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runOperations } from './object-operations.ts';

test('a caller-supplied root wins: the operation reads the checkout it is given, never the one holding this module', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'operations-root-'));
  try {
    await assert.rejects(runOperations('verify', 'nosuch-body', [], root),
      (error: unknown) => error instanceof Error && 'path' in error && typeof error.path === 'string' && error.path.startsWith(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});
