import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { readOracleSetupManifest } from './manifest.mts';

test('owner setup manifests register generators and refuse escaped paths or duplicate names', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'oracle-manifests-'));
  const owner = resolve(root, 'packages/owner');
  const metadata = resolve(owner, 'package.json'), manifest = resolve(owner, 'oracle.json');
  try {
    await mkdir(owner, { recursive: true });
    await writeFile(metadata, JSON.stringify({ oracleManifest: 'oracle.json' }));
    await writeFile(manifest, JSON.stringify({ oracles: { example: 'packages/owner/generator.py' }, setup: { install: 'packages/owner/setup.mts' } }));
    assert.deepEqual(readOracleSetupManifest(root), { oracles: { example: 'packages/owner/generator.py' }, setup: { install: 'packages/owner/setup.mts' } });
    await writeFile(metadata, JSON.stringify({ oracleManifest: '../../outside.json' }));
    await writeFile(resolve(root, 'outside.json'), '{}');
    assert.throws(() => readOracleSetupManifest(root), /manifest must belong/u);
    await writeFile(metadata, JSON.stringify({ oracleManifest: 'oracle.json' }));
    await writeFile(manifest, JSON.stringify({ oracles: { escape: 'outside.py' } }));
    assert.throws(() => readOracleSetupManifest(root), /generator must belong/u);
    await writeFile(manifest, JSON.stringify({ oracles: { example: 'packages/owner/generator.py' } }));
    const second = resolve(root, 'packages/second');
    await mkdir(second);
    await writeFile(resolve(second, 'package.json'), JSON.stringify({ oracleManifest: 'oracle.json' }));
    await writeFile(resolve(second, 'oracle.json'), JSON.stringify({ oracles: { example: 'packages/second/generator.py' } }));
    assert.throws(() => readOracleSetupManifest(root), /Duplicate oracle/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
