import assert from 'node:assert/strict';
import { sourceTest } from '../../../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareSamples, cubeComparisonScope, archivePlaneOffset, requestedSpectralGrid } from './spec3.mts';
import type { SpectralCube } from '@cssearth/bake/objects/layers/observation';


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
