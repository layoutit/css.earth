import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fitsOracleInputResolvers, fitsArchiveInputs } from '@cssearth/fits/node';
test('FITS owns fixture and archive pins through its Node entry', async () => {
  const resolvers = fitsOracleInputResolvers();
  assert.ok(resolvers[0]!.accepts('packages/fits/src/node/fixtures/fits/float32.fits'));
  assert.ok(!resolvers[0]!.accepts('packages/another/src/fixtures/example.fits'));
  const archive = resolvers[1]!, inputs = await fitsArchiveInputs();
  assert.ok(inputs.length > 0);
  await archive.verify(inputs[0]!);
  await assert.rejects(archive.verify({ path: inputs[0]!.path, bytes: inputs[0]!.bytes + 1 }), /archive record changed/u);
  await assert.rejects(archive.verify({ path: '.local/fits-reference/unknown.fits' }), /archive record changed/u);
});

test('the FITS Node entry loads and reads its owner records through CommonJS', async () => {
  const entry: unknown = createRequire(import.meta.url)('@cssearth/fits/node');
  assert.ok(entry !== null && typeof entry === 'object' && 'fitsArchiveInputs' in entry);
  assert.equal(typeof entry.fitsArchiveInputs, 'function');
  if (typeof entry.fitsArchiveInputs !== 'function') throw new Error('Missing archive reader.');
  assert.deepEqual(await entry.fitsArchiveInputs(), await fitsArchiveInputs());
});
