import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hash } from './io.ts';
import { verifyArtifacts } from './verify.ts';

test('verification fails for missing or changed outputs and never repairs them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-verify-'));
  try {
    const bytes = Buffer.from('accepted image'), path = join(root, 'image.webp');
    const manifest = { 'image.webp': { sha256: hash(bytes), bytes: bytes.length } };
    await assert.rejects(verifyArtifacts(root, '.', manifest), /ENOENT/);
    await writeFile(path, bytes);
    await verifyArtifacts(root, '.', manifest);
    await writeFile(path, 'changed image');
    await assert.rejects(verifyArtifacts(root, '.', manifest), /Artifact size differs/);
    assert.equal(await readFile(path, 'utf8'), 'changed image');
    await writeFile(path, bytes);
    await assert.rejects(verifyArtifacts(root, '.', {'image.webp': {...manifest['image.webp'], bytes: 1}}), /Artifact size differs/);
    await assert.rejects(verifyArtifacts(root, '.', {}), /manifest is empty/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
