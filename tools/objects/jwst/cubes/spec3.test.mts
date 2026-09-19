import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseImagingProgram } from '../imaging/archive.mts';
import { imagingProductRun, pipelineSoftware, recordProductEvidence } from '../imaging/image3.mts';
import { evidenceFor, productRecordPath, runDigest, writeProductRecord } from '../../product-record.mts';
import { archivePlaneOffset, requestedSpectralGrid } from './spec3.mts';
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
  assert.deepEqual(run.inputs.map(input => [input.role, input.identity, input.sha256]),
    [['level-2 exposure', 'mast:JWST/product/jw01250002001_03105_00001_nrs1_cal.fits', 'a'.repeat(64)],
      ['level-2 exposure', 'mast:JWST/product/jw01250002001_03105_00001_nrs2_cal.fits', 'b'.repeat(64)]]);
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
    await writeFile(cube, 'cube'); await writeFile(finer, 'finer cube');
    // The comparison is refused until the stage that built the cube has said what built it.
    await assert.rejects(recordProductEvidence(cube, 'archive-agreement', receipt, agreement), /no product record at/u);
    await writeProductRecord(productRecordPath(cube), cubeRun(), [{ path: basename(cube), file: cube, units: 'MJy/sr',
      conventions: { axes: 'RA---TAN, DEC--TAN, WAVE' } }]);
    const record = await recordProductEvidence(cube, 'archive-agreement', receipt, agreement);
    assert.equal(evidenceFor(record, basename(cube), 'archive-agreement').length, 1);
    assert.equal(evidenceFor(record, basename(finer), 'archive-agreement').length, 0, 'the finer cube has no MAST twin and no evidence');
    assert.equal(record.outputs[0]!.units, 'MJy/sr');
    await assert.rejects(recordProductEvidence(finer, 'archive-agreement', receipt, agreement), /no product record at/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
