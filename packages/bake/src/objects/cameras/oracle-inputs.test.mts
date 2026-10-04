import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { assertPinnedInputs, readOracleInput } from '@cssearth/core/oracle';
import { MissingSourceInputError } from '@cssearth/core';
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
