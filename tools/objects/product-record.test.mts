import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { addProductEvidence, assertInputPins, evidenceFor, parseProductRecord, pinFile, productRecordPath, readProductRecord, runDigest, sameRun, writeProductRecord, type ProductRun } from './product-record.mts';

const scratch = () => mkdtemp(join(tmpdir(), 'product-record-'));
const run = (overrides: Partial<ProductRun> = {}): ProductRun => ({ telescope: 'ALMA', stage: 'disc-selfcal/final', inputs: [{ role: 'visibilities', identity: 'uid://A002/X/1', bytes: 3, sha256: 'a'.repeat(64) }],
  parameters: { fluxScale: 0.907, robust: 0 }, software: [{ name: 'casatasks', version: '6.7.0' }], toolchainDigest: 'b'.repeat(64), ...overrides });

test('a run digest ignores key and input order and changes with any value', () => {
  const base = runDigest(run());
  assert.equal(runDigest(run({ parameters: { robust: 0, fluxScale: 0.907 } })), base);
  assert.notEqual(runDigest(run({ parameters: { fluxScale: 1.015, robust: 0 } })), base);
  assert.notEqual(runDigest(run({ software: [{ name: 'casatasks', version: '6.6.0' }] })), base);
  assert.notEqual(runDigest(run({ toolchainDigest: 'c'.repeat(64) })), base);
  assert.notEqual(runDigest(run({ inputs: [{ role: 'visibilities', identity: 'uid://A002/X/1', bytes: 3, sha256: 'd'.repeat(64) }] })), base);
});

test('an output is reused only when the same run made it and it is still that file', async () => {
  const directory = await scratch(), image = join(directory, 'final.fits'), recordPath = join(directory, 'final.product.json'), locate = (path: string) => join(directory, path);
  await writeFile(image, 'first image');
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), false, 'an output with no record is not reused');
  await writeProductRecord(recordPath, run(), [{ path: 'final.fits', file: image, units: 'Jy/beam' }]);
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), true);
  assert.equal(await sameRun(await readProductRecord(recordPath), run({ parameters: { fluxScale: 1.015, robust: 0 } }), locate), false, 'a changed parameter runs the stage again');
  await writeFile(image, 'another image');
  assert.equal(await sameRun(await readProductRecord(recordPath), run(), locate), false, 'a changed output is not the recorded product');
});

test('inputs that are not the pinned ones are refused before use', async () => {
  const directory = await scratch(), frame = join(directory, 'frame.fits');
  await writeFile(frame, 'raw frame');
  const pin = { role: 'raw', identity: 'NACO.2012-01-01T00:00:00.000', ...(await pinFile(frame)) };
  await assertInputPins([pin], new Map([[pin.identity, frame]]));
  await writeFile(frame, 'raw frame, altered but still valid');
  await assert.rejects(assertInputPins([pin], new Map([[pin.identity, frame]])), /is not the pinned/u);
  await assert.rejects(assertInputPins([pin], new Map()), /No file was given/u);
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
      establishes: "These bytes are the archive's own final product, by digest. Nothing here was re-run and nothing was compared." }]);
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
test('comparison receipts are immutable, pinned snapshots beside their exact product', async () => {
  const directory = await scratch(), product = join(directory, 'cube.fits'), receipt = join(directory, 'latest.json');
  await writeFile(product, 'cube'); await writeFile(receipt, '{"slice":[2.2,2.4]}');
  const path = productRecordPath(product), locate = (name: string) => join(directory, name);
  await writeProductRecord(path, run(), [{ path: 'cube.fits', file: product }]);
  const record = await addProductEvidence(path, [{ kind: 'archive-agreement', receipt, product: 'cube.fits', establishes: 'First slice.' }], locate);
  const snapshot = record.evidence[0]!;
  await writeFile(receipt, '{"slice":[2.6,2.8]}');
  assert.match(await readFile(locate(snapshot.receipt), 'utf8'), /2.2/);
  assert.equal(await sameRun(record, run(), locate), true);
  await writeFile(locate(snapshot.receipt), 'altered evidence');
  assert.equal(await sameRun(record, run(), locate), false);
});
