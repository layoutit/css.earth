import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, dirname, resolve } from 'node:path';
import { parseImagingProgram } from '../imaging/archive.mts';
import { imagingProductRun, pipelineSoftware, recordProductEvidence } from '../imaging/image3.mts';
import { sameRun, evidenceFor, productRecordPath, runDigest, writeProductRecord } from '../../product-record.mts';
import { compareSamples, cubeComparisonScope, archivePlaneOffset, requestedSpectralGrid } from './spec3.mts';
import type { SpectralCube } from './spectral-cube.mts';

const file = (name: string, sha256: string) => ({ name, uri: `mast:JWST/product/${name}`, bytes: 4096, sha256 });
const program = parseImagingProgram({
  schema: 'cssearth-jwst-imaging-program@1', id: 'europa-1250', programme: '1250', target: 'EUROPA', crdsContext: 'jwst_1535.pmap',
  bands: [{ band: 'NIRSPEC-G395H-F290LP', observation: 'jw01250-o002_t001_nirspec_g395h-f290lp', stage: 'spec3',
    level3: file('jw01250-o002_t001_nirspec_g395h-f290lp_s3d.fits', 'c'.repeat(64)),
    association: file('jw01250-o002_20260720t083746_spec3_00001_asn.json', 'd'.repeat(64)),
    members: [file('jw01250002001_03105_00001_nrs1_cal.fits', 'a'.repeat(64)), file('jw01250002001_03105_00001_nrs2_cal.fits', 'b'.repeat(64))] }],
});
const toolchain = { toolchainDigest: 'e'.repeat(64), software: pipelineSoftware('jwst==2.0.1\nstcal==1.20.0\n') };
const cubeRun = (parameters: Record<string, unknown> = {}) =>
  imagingProductRun(program, program.bands[0]!, 'spec3', { extract1d: 'skipped', ...parameters }, toolchain);

const spectralGrid = (planes: number, first: number, step: number): SpectralCube => ({ width: 59, height: 55, planes,
  wavelength: plane => first + plane * step, science: { CRPIX1: 30, CRPIX2: 28, CRVAL1: 1, CRVAL2: 2, CDELT1: -1, CDELT2: 1, CDELT3: step },
  primary: {}, sci: {} as SpectralCube['sci'], err: {} as SpectralCube['err'], path: '', arcsecPerPixel: 0.1 });

test('a requested wavelength interval becomes an exact subset of the archive planes', () => {
  const archive = spectralGrid(3_610, 2.8703325, 0.000665);
  const slice = requestedSpectralGrid(archive, [3.4, 3.6]);
  assert.ok(archive.wavelength(slice.firstPlane) <= 3.4 && archive.wavelength(slice.lastPlane) >= 3.6);
  const local = spectralGrid(slice.planes, archive.wavelength(slice.firstPlane), 0.000665);
  assert.equal(archivePlaneOffset(local, archive), slice.firstPlane);
  assert.throws(() => archivePlaneOffset(spectralGrid(slice.planes, archive.wavelength(slice.firstPlane) + 0.0001, 0.000665), archive), /not an aligned subset/u);
});

test('a spec3 run pins both detectors of every dither, and a finer sky grid is another run', () => {
  const run = cubeRun();
  assert.equal(run.stage, 'spec3');
  assert.deepEqual(run.inputs.map(input => [input.role, input.identity]),
    [['level-2 exposure', 'mast:JWST/product/jw01250002001_03105_00001_nrs1_cal.fits'],
      ['level-2 exposure', 'mast:JWST/product/jw01250002001_03105_00001_nrs2_cal.fits']]);
  assert.equal(run.parameters.crdsContext, 'jwst_1535.pmap');
  assert.equal(run.parameters.observation, 'jw01250-o002_t001_nirspec_g395h-f290lp');
  assert.deepEqual(run.software, [{ name: 'jwst', version: '2.0.1' }, { name: 'stcal', version: '1.20.0' }]);
  assert.equal(run.toolchainDigest, 'e'.repeat(64));
  // A cube drizzled onto a finer grid than the pipeline's 0.1 arcsecond is a different product, so it is built rather than reused.
  assert.notEqual(runDigest(cubeRun({ arcsecPerPixel: 0.05 })), runDigest(run));
});

test('the cube comparison adds its agreement to the record beside that cube, and only that cube', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jwst-spec3-record-'));
  try {
    const cube = join(directory, 'jw01250-o002_t001_nirspec_g395h_s3d.fits'), finer = join(directory, 'jw01250-o002_t001_nirspec_g395h-fine_s3d.fits');
    const receipt = join(directory, 'europa-1250.NIRSPEC-G395H-F290LP.reproduction.json'), agreement = 'The re-run reproduces MAST’s own cube sample by sample.';
    await writeFile(receipt, '{}'); await writeFile(cube, 'cube'); await writeFile(finer, 'finer cube');
    // The comparison is refused until the stage that built the cube has said what built it.
    await assert.rejects(recordProductEvidence(cube, 'archive-agreement', receipt, agreement), /no product record at/u);
    await writeProductRecord(productRecordPath(cube), cubeRun(), [{ path: basename(cube), file: cube, units: 'MJy/sr',
      conventions: { axes: 'RA---TAN, DEC--TAN, WAVE' } }]);
    const record = await recordProductEvidence(cube, 'archive-agreement', receipt, agreement);
    assert.equal(evidenceFor(record, basename(cube), 'archive-agreement').length, 1);
    assert.equal(evidenceFor(record, basename(finer), 'archive-agreement').length, 0, 'the finer cube has no MAST twin and no evidence');
    assert.equal(record.outputs[0]!.units, 'MJy/sr');
    assert.equal(await sameRun(record, cubeRun(), name => resolve(dirname(cube), name)), true);
    await assert.rejects(recordProductEvidence(finer, 'archive-agreement', receipt, agreement), /no product record at/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('archive agreement requires an explicit numerical acceptance policy and exact coverage', async () => {
  const { sampleAgreement } = await import('../sample-agreement.mts');
  const samples = { both: 100, onlyOurs: 0, onlyMast: 0, maximumNormalizedDifference: 1e-6 };
  assert.equal(sampleAgreement(samples).accepted, true);
  for (const changed of [{ maximumNormalizedDifference: 1 }, { onlyMast: 1 }, { both: 0 }, { maximumNormalizedDifference: NaN }])
    assert.equal(sampleAgreement({ ...samples, ...changed }).accepted, false);
  const { parseReproductionReceipt } = await import('../archive-ledger.mts');
  const receipt = { schema: 'cssearth-jwst-spec3-reproduction@3', program: 'test', band: 'NIRSPEC-G395H-F290LP', observation: 'obs', mast: { name: 'archive.fits', bytes: 100, sha256: 'a'.repeat(64) }, local: { name: 'local.fits', bytes: 100, sha256: 'b'.repeat(64) }, samples, acceptance: sampleAgreement(samples) };
  assert.equal(parseReproductionReceipt(receipt, 'test').accepted, true);
  assert.equal(parseReproductionReceipt({ ...receipt, acceptance: { ...receipt.acceptance, policy: 'jwst-cube-samples@1' } }, 'old-zero-policy').accepted, false);
  assert.equal(parseReproductionReceipt({ ...receipt, samples: { ...samples, maximumNormalizedDifference: 1000, correlation: -1, identicalShare: 0 } }, 'test').accepted, false);
  assert.equal(parseReproductionReceipt({ ...receipt, schema: 'cssearth-jwst-spec3-reproduction@2' }, 'historical').accepted, false);
  const image = { ...receipt, schema: 'cssearth-jwst-image3-reproduction@2', differentWcs: [], pixels: { comparedOn: 'pixels' }, acceptance: sampleAgreement(samples, 'image') };
  assert.equal(parseReproductionReceipt(image, 'image').accepted, true);
  assert.equal(parseReproductionReceipt({ ...image, pixels: { comparedOn: 'sky positions' } }, 'interpolated').accepted, false);
});

test('comparison scope comes from geometry and validates any claimed requested interval', () => {
  const archive = spectralGrid(100, 1, .1), slice = spectralGrid(3, 2, .1);
  assert.equal(cubeComparisonScope(slice, archive).kind, 'aligned-spectral-subset');
  assert.deepEqual(cubeComparisonScope(slice, archive).archivePlanes, [10, 12]);
  assert.equal(cubeComparisonScope(archive, archive).kind, 'complete-cube');
  assert.equal(cubeComparisonScope(slice, archive, [2, 2.2]).kind, 'requested-wavelength-slice');
  assert.throws(() => cubeComparisonScope(slice, archive, [1, 2.2]), /not covered/);
});
test('valid zeros participate in cube coverage and all-zero comparisons have defined normalization', async () => {
  const { sampleAgreement } = await import('../sample-agreement.mts');
  const dir = await mkdtemp(join(tmpdir(), 'cube-zero-'));
  try {
    for (const [local, archive, accepted, lost] of [
      [[0], [0], true, 0], [[1, 2, NaN], [1, 2, 0], false, 1], [[1e-7], [0], false, 0], [[0, 0, 0], [0, 0, 0], true, 0],
    ] as const) {
      const cubes = await Promise.all([local, archive].map(async (values, i) => {
        const bytes = Buffer.alloc(values.length * 4); values.forEach((value, index) => bytes.writeFloatBE(value, index * 4));
        const path = join(dir, `${i}.bin`); await writeFile(path, bytes);
        return { ...spectralGrid(1, 1, .1), width: values.length, height: 1, path, sci: { dataStart: 0 } as SpectralCube['sci'] };
      }));
      const result = await compareSamples(cubes[0]!, cubes[1]!);
      assert.equal(result.onlyMast, lost); assert.equal(sampleAgreement(result).accepted, accepted);
      assert.ok(Number.isFinite(result.maximumNormalizedDifference));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
