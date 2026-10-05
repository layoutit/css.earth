import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { verifyIdentical, identityReports } from './verify-identical.mts';
test('identity requires every report and markdown byte, and the same PR inputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lane-identity-'));
  const cached = join(root, 'cached'), fresh = join(root, 'fresh');
  try {
    for (const directory of [cached, fresh]) {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'cache.json'), JSON.stringify({ cachedBase: directory === cached, notice: directory === cached ? 'hit' : 'forced fresh: no-base-cache' }));
      await writeFile(join(directory, 'inputs.json'), JSON.stringify({ base: 'base', head: 'head', mode: 'report', tools: 'head' }));
      for (const path of identityReports) { await mkdir(dirname(join(directory, path)), { recursive: true }); await writeFile(join(directory, path), '{"exitCode":0}\n'); }
    }
    await verifyIdentical(cached, fresh);
    await writeFile(join(cached, 'cache.json'), JSON.stringify({ cachedBase: false, notice: 'miss' }));
    await assert.rejects(verifyIdentical(cached, fresh), /verified cache hit/u);
    await writeFile(join(cached, 'cache.json'), JSON.stringify({ cachedBase: true, notice: 'hit' }));
    for (const path of identityReports) {
      const before = await readFile(join(fresh, path)); await writeFile(join(fresh, path), '{"exitCode":1}\n');
      await assert.rejects(verifyIdentical(cached, fresh), /Report differs/u); await writeFile(join(fresh, path), before);
    }
    await writeFile(join(fresh, 'inputs.json'), JSON.stringify({ base: 'base', head: 'another', mode: 'report', tools: 'head' }));
    await assert.rejects(verifyIdentical(cached, fresh), /Different PR inputs/u);
    await writeFile(join(fresh, 'inputs.json'), await readFile(join(cached, 'inputs.json')));
    await rm(join(fresh, 'report.json')); await assert.rejects(verifyIdentical(cached, fresh));
  } finally { await rm(root, { recursive: true, force: true }); }
});
