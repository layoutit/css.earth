import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { isRecord, requireRecord, requireArray, MissingSourceInputError } from '@cssearth/core';
import { assertPinnedInputs, readOracleInput } from '@cssearth/core/oracle';
import { bakeOracleInputResolvers, setupBakeOracleInputs } from './oracle-inputs.mts';
import { setupBakeOracleInputs as setupPublishedBakeOracleInputs } from '@cssearth/bake/objects/cameras';

await setupBakeOracleInputs();
test('source and published owner setups share the core registry', async () => {
  await setupPublishedBakeOracleInputs();
  await setupBakeOracleInputs();
});
test('the body owner refuses an undeclared source before attempting to read it', async () => {
  const resolver = bakeOracleInputResolvers().find(entry => entry.id === 'body-sources')!;
  await assert.rejects(resolver.verify({ path: 'src/objects/earth/source/not-declared.fit' }), /not a manifest input or document/u);
});
test('the kernel owner requires the verifier and reports absent restored kernels without acquisition', async () => {
  const path = 'src/spice/example-bank/not-restored.bsp';
  await assert.rejects(assertPinnedInputs([{ path }]), /require the caller bank verifier/u);
  let acquired = false;
  await assert.rejects(readOracleInput({ path }, async () => { acquired = true; }), MissingSourceInputError);
  assert.equal(acquired, false);
});

test('the published camera entry still loads through CommonJS', () => {
  const entry: unknown = createRequire(import.meta.url)('@cssearth/bake/objects/cameras');
  assert.ok(entry !== null && typeof entry === 'object' && 'setupBakeOracleInputs' in entry);
  assert.equal(typeof entry.setupBakeOracleInputs, 'function');
});

// Kernel fixture consumers must explicitly opt into their bank verifier: core has no bake dependency.
test('every saved kernel oracle comparison supplies the owner bank verifier', async () => {
  async function visit(directory: URL): Promise<URL[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      return entry.isDirectory() ? visit(path) : Promise.resolve(entry.name.endsWith('.json') ? [path] : []);
    }))).flat();
  }
  let comparisons = 0;
  for (const path of await visit(new URL('../../', import.meta.url))) {
    const record: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isRecord(record) || record.schema !== 'cssearth-oracle-fixture@1') continue;
    if (!requireArray(record.inputs).some(input => {
      const value = requireRecord(input).path;
      return typeof value === 'string' && value.startsWith('src/spice/');
    })) continue;
    const consumer = new URL(path.href.replace(/\.json$/u, '.oracle.test.mts'));
    const code = await readFile(consumer, 'utf8');
    assert.match(code, /assertPinnedInputs\(fixture\.inputs,\s*kernelBankPaths\)/u, consumer.href);
    comparisons++;
  }
  assert.ok(comparisons > 0, 'must inspect at least one kernel-reading comparison');
});
