import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it as test } from 'node:test';
import { addProductEvidence, assertInputs, fileSize, readProductRecord, runKey, sameRun, writeProductRecord } from './node/product-record.js';
import { evidenceFor, parseProductRecord, productRecordPath, type ProductRun } from './product-record.js';

const scratch = () => mkdtemp(join(tmpdir(), 'product-record-'));
const run = (overrides: Partial<ProductRun> = {}): ProductRun => ({ telescope: 'ALMA', stage: 'disc-selfcal/final', inputs: [{ role: 'visibilities', identity: 'uid://A002/X/1', bytes: 3 }],
  parameters: { fluxScale: 0.907, robust: 0 }, software: [{ name: 'casatasks', version: '6.7.0' }], ...overrides });

test('a run key ignores key and input order and changes with any value', () => {
  const base = runKey(run());
  assert.equal(runKey(run({ parameters: { robust: 0, fluxScale: 0.907 } })), base);
  assert.notEqual(runKey(run({ parameters: { fluxScale: 1.015, robust: 0 } })), base);
  assert.notEqual(runKey(run({ software: [{ name: 'casatasks', version: '6.6.0' }] })), base);
  assert.notEqual(runKey(run({ inputs: [{ role: 'visibilities', identity: 'uid://A002/X/1', bytes: 4 }] })), base);
});

test('a record carrying a content digest is refused', () => {
  const record = { schema: 'cssearth-telescope-product@1', ...run(), outputs: [{ path: 'final.fits', bytes: 3 }], evidence: [] };
  assert.doesNotThrow(() => parseProductRecord(record));
});

test('an output is reused only when the same run made it and it is still on disk at the recorded size', async () => {
  const directory = await scratch(), image = join(directory, 'final.fits'), recordPath = join(directory, 'final.product.json'), locate = (path: string) => join(directory, path);
  await writeFile(image, 'first image');
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), false, 'an output with no record is not reused');
  await writeProductRecord(recordPath, run(), [{ path: 'final.fits', file: image, units: 'Jy/beam' }]);
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), true);
  assert.equal(await sameRun(await readProductRecord(recordPath), run({ parameters: { fluxScale: 1.015, robust: 0 } }), locate), false, 'a changed parameter runs the stage again');
  await writeFile(image, 'another image');
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), false, 'a resized output is not the recorded product');
  await rm(image);
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), false, 'a missing output runs the stage again');
});

test('inputs that are missing or not the recorded size are refused before use', async () => {
  const directory = await scratch(), frame = join(directory, 'frame.fits');
  await writeFile(frame, 'raw frame');
  const input = { role: 'raw', identity: 'NACO.2012-01-01T00:00:00.000', ...(await fileSize(frame)) };
  await assertInputs([input], new Map([[input.identity, frame]]));
  await writeFile(frame, 'raw frame, altered but still valid');
  await assert.rejects(assertInputs([input], new Map([[input.identity, frame]])), /is not the recorded NACO.2012-01-01T00:00:00.000 \(raw\): bytes is 34, the record says 9/u);
  await assert.rejects(assertInputs([input], new Map()), /No file was given/u);
  await assert.rejects(assertInputs([input], new Map([[input.identity, join(directory, 'absent.fits')]])), /is not at/u);
});

test('evidence answers only for the product and the kind it names', async () => {
  const directory = await scratch(), image = join(directory, 'a_flt.fits'); await writeFile(image, 'x');
  const record = await writeProductRecord(join(directory, 'a.product.json'), run(), [{ path: 'a_flt.fits', file: image }],
    [{ kind: 'archive-agreement', receipt: 'programs/a.a_flt.reproduction.json', product: 'a_flt.fits', establishes: 'The re-run equals the archive product sample by sample.' }]);
  assert.equal(evidenceFor(record, 'a_flt.fits', 'archive-agreement').length, 1);
  assert.equal(evidenceFor(record, 'a_flt.fits', 'geometric-registration').length, 0);
  assert.equal(evidenceFor(record, 'a_x1d.fits', 'archive-agreement').length, 0);
  assert.throws(() => parseProductRecord({ ...record, evidence: [{ ...record.evidence[0]!, product: 'a_x1d.fits' }] }), /did not produce/u);
  assert.throws(() => parseProductRecord({ ...record, evidence: [{ ...record.evidence[0]!, kind: 'exists' }] }), /no known kind/u);
});

test("archive origin is a kind of its own: it establishes that the bytes are the archive's, never that we reproduced them", async () => {
  const directory = await scratch(), product = join(directory, 'y2p60503t_c1f.fits'); await writeFile(product, "the archive's own bytes");
  const retrieved: ProductRun = { telescope: 'Hubble', stage: 'archive-final', inputs: [], parameters: {}, software: [] };
  const record = await writeProductRecord(join(directory, productRecordPath('y2p60503t_c1f.fits')), retrieved, [{ path: 'y2p60503t_c1f.fits', file: product }],
    [{ kind: 'archive-origin', receipt: 'programs/europa-fos-5837.archive-final.product.json', product: 'y2p60503t_c1f.fits',
      establishes: "These bytes are the archive's own final product. Nothing here was re-run and nothing was compared." }]);
  assert.equal(evidenceFor(record, 'y2p60503t_c1f.fits', 'archive-origin').length, 1);
  assert.deepEqual(evidenceFor(record, 'y2p60503t_c1f.fits', 'archive-agreement'), [],
    'a caller asking whether our re-run matches the archive is never answered with a file we merely downloaded');
  assert.deepEqual(record.software, [], 'no software of ours made it');
});

test('evidence is added to the record of the run that made the product, and only about that product', async () => {
  const directory = await scratch(), image = join(directory, 'final.fits'), recordPath = join(directory, productRecordPath('final.fits')), locate = (path: string) => join(directory, path);
  await writeFile(image, 'final image'); await writeFile(join(directory, 'a.reproduction.json'), '{}');
  const agreement = { kind: 'archive-agreement', receipt: 'a.reproduction.json', product: 'final.fits', establishes: 'The re-run matches the archive product.' } as const;
  await assert.rejects(addProductEvidence(recordPath, [agreement], locate), /no product record/u, 'evidence needs the run that made the product');
  await writeProductRecord(recordPath, run(), [{ path: 'final.fits', file: image }]);
  const added = await addProductEvidence(recordPath, [agreement], locate);
  assert.equal(evidenceFor(added, 'final.fits', 'archive-agreement').length, 1);
  assert.deepEqual((await addProductEvidence(recordPath, [agreement], locate)).evidence, added.evidence, 'the same check twice leaves one entry');
  assert.deepEqual((await readProductRecord(recordPath))!.inputs, run().inputs, 'the run facts are not rewritten');
  await writeFile(image, 'another image');
  await assert.rejects(addProductEvidence(recordPath, [agreement], locate), /not the files on disk/u);
});
