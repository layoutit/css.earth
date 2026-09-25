/** The archive-final pin: what a program has to say, what the three sides of an identity have to agree on, how a waivered
 * product's units are read, and what the measured summaries measure. Nothing here asks MAST anything: the FITS units are
 * written by hand into a scratch directory, and the qualified programs are read from this repository. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { EVIDENCE_KINDS, evidenceFor, parseProductRecord } from '@cssearth/telescope';
import { runDigest } from '@cssearth/telescope/node';
import {
  ARCHIVE_FINAL_SCHEMA, ARCHIVE_FINAL_STAGE, archiveCalibration, archiveFinalPath, archiveFinalQualificationRun,
  archiveFinalQualifiedRun, archiveFinalRecordPath, archiveFinalSelection, findDisc, identityDisagreements,
  parseArchiveFinalProgram, qualitySummary, readUnit, rectangle, summariseImage, summariseSpectrum,
  type ArchiveFinalIdentity, type CatalogueEntry,
} from './archive-final.mts';
import { readHstFileHdus } from './product-file.mts';

const QUALIFIED = ['europa-wfpc2-11085', 'europa-fos-5837', 'europa-ghrs-5376'] as const;
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;

// ---- a FITS unit written by hand, so the reader is given the layout these products really have --------------------------

const card = (text: string) => text.padEnd(80, ' ').slice(0, 80);
const block = (cards: readonly string[]) => {
  const body = [...cards, 'END'].map(card).join('');
  return Buffer.from(body.padEnd(Math.ceil((body.length || 1) / 2880) * 2880, ' '), 'latin1');
};
const padded = (data: Buffer) => Buffer.concat([data, Buffer.alloc((2880 - data.length % 2880) % 2880)]);
const floats = (values: readonly number[]) => { const bytes = Buffer.alloc(values.length * 4); values.forEach((value, index) => bytes.writeFloatBE(value, index * 4)); return bytes; };

/** A waivered product: the samples in the PRIMARY unit with the GEIS groups as its second axis, and the group parameters in the
 * table extension that follows, which is the layout WFPC2, FOS and GHRS are distributed in. */
function waivered(samples: number, groups: number, values: readonly number[], cards: readonly string[] = []) {
  const primary = block(['SIMPLE  =                    T', 'BITPIX  =                  -32', `NAXIS   =                    ${groups > 1 ? 2 : 1}`,
    `NAXIS1  =                 ${String(samples).padStart(4)}`, ...(groups > 1 ? [`NAXIS2  =                 ${String(groups).padStart(4)}`] : []), 'EXTEND  =                    T', ...cards]);
  const table = block(['XTENSION= \'TABLE   \'', 'BITPIX  =                    8', 'NAXIS   =                    2', 'NAXIS1  =                   16',
    `NAXIS2  =                 ${String(groups).padStart(4)}`, 'PCOUNT  =                    0', 'GCOUNT  =                    1', 'TFIELDS =                    0']);
  return Buffer.concat([primary, padded(floats(values)), table, padded(Buffer.alloc(16 * groups))]);
}

const scratch = () => mkdtemp(resolve(tmpdir(), 'hst-archive-final-'));

// ---- the program -------------------------------------------------------------------------------------------------------

const programFixture = () => ({
  schema: ARCHIVE_FINAL_SCHEMA, id: 'x-1', configuration: 'FOS/BL', observation: 'y2p60503t', target: 'europa', kind: 'spectrum',
  handbook: 'https://example.invalid/handbook',
  identity: { instrument: 'FOS', detector: 'BLUE', opticalElement: 'G270H', headerOpticalElement: 'H27', aperture: 'B-3',
    targetName: 'EUROPA-EAST', proposal: '5837', exposureStartMjd: 49890.82698155, exposureEndMjd: 49890.82851627 },
  components: [
    { role: 'science', supplied: true, file: 'y2p60503t_c1f.fits', hdu: 0, units: 'ERGS/CM**2/S/A' },
    { role: 'coordinates', supplied: true, file: 'y2p60503t_c0f.fits', hdu: 0, units: 'ANGSTROMS' },
    { role: 'uncertainty', supplied: false, reason: 'nothing of the kind is distributed for this mode' },
    { role: 'quality', supplied: true, file: 'y2p60503t_cqf.fits', hdu: 0 },
  ],
  files: ['c0f', 'c1f', 'cqf'].map(suffix => ({ name: `y2p60503t_${suffix}.fits`, uri: `mast:HST/product/y2p60503t_${suffix}.fits`, bytes: 43200 })),
});

test('a program states every part of the product, and a part it does not have says why', () => {
  const program = programFixture();
  assert.equal(parseArchiveFinalProgram(program).components.length, 4);
  assert.throws(() => parseArchiveFinalProgram({ ...program, schema: 'cssearth-hst-nothing@1' }), /is not an archive-final program/u);
  assert.throws(() => parseArchiveFinalProgram({ ...program, components: program.components.slice(0, 3) }), /nothing is said about quality/u);
  assert.throws(() => parseArchiveFinalProgram({ ...program, components: program.components.map(entry => entry.role === 'uncertainty' ? { role: 'uncertainty', supplied: false } : entry) }),
    /uncertainty is missing and says no reason/u, 'a missing part may be stated as missing, never left silent');
  assert.throws(() => parseArchiveFinalProgram({ ...program, components: program.components.map(entry => entry.role === 'quality' ? { ...entry, file: 'y2p60503t_c7f.fits' } : entry) }),
    /which this program does not pin/u);
  assert.throws(() => parseArchiveFinalProgram({ ...program, components: program.components.map(entry => entry.role === 'science' ? { role: 'science', supplied: true, carriedBy: 'y2p60503t_c1f.fits' } : entry) }),
    /pins the science values as a file of their own/u);
  assert.throws(() => parseArchiveFinalProgram({ ...program, files: [{ name: 'odr2a1010_x1d.fits', uri: 'mast:HST/product/odr2a1010_x1d.fits', bytes: 1 }] }),
    /belongs to no exposure of y2p60503t/u);
});

// ---- the identity ------------------------------------------------------------------------------------------------------

const catalogue: CatalogueEntry = { observation: 'y2p60503t', configuration: 'FOS/BL', filters: 'G270H', targetName: 'EUROPA-EAST',
  proposal: '5837', startMjd: 49890.826981481485, endMjd: 49890.82851620371 };
const headers: ArchiveFinalIdentity = { instrument: 'FOS', detector: 'BLUE', opticalElement: 'H27', aperture: 'B-3',
  targetName: 'EUROPA-EAST', proposal: '5837', exposureStartMjd: 49890.82698155, exposureEndMjd: 49890.82851627 };

test('the catalogue, the program and the headers must agree, and each disagreement is named', () => {
  const program = parseArchiveFinalProgram(programFixture());
  assert.deepEqual(identityDisagreements(catalogue, program, headers), []);
  // The instrument's own card spells the grating H27 and the catalogue spells it G270H; both spellings are pinned, so neither
  // side is translated and a change on either side is still caught.
  assert.match(identityDisagreements(catalogue, program, { ...headers, opticalElement: 'H19' }).join(), /optical element: the headers says H19/u);
  assert.match(identityDisagreements({ ...catalogue, filters: 'G190H' }, program, headers).join(), /optical element: the catalogue says G190H/u);
  assert.match(identityDisagreements({ ...catalogue, targetName: 'GANYMEDE' }, program, headers).join(), /target: the catalogue says GANYMEDE/u);
  assert.match(identityDisagreements({ ...catalogue, proposal: '5660' }, program, headers).join(), /proposal: the catalogue says 5660/u);
  assert.match(identityDisagreements({ ...catalogue, configuration: 'FOS/RD' }, program, headers).join(), /configuration: the catalogue says FOS\/RD/u);
  assert.match(identityDisagreements(catalogue, program, { ...headers, detector: 'AMBER' }).join(), /detector: the headers says AMBER/u);
  assert.deepEqual(identityDisagreements({ ...catalogue, startMjd: catalogue.startMjd + 0.4 / 86_400 }, program, headers), [], 'a fraction of a second apart is the same epoch');
  assert.match(identityDisagreements({ ...catalogue, startMjd: catalogue.startMjd + 5 / 86_400 }, program, headers).join(), /exposure start: the catalogue says MJD/u);
});

// ---- the units ---------------------------------------------------------------------------------------------------------

test('a waivered unit is read as its own samples by its own groups, and anything else is refused', async () => {
  const directory = await scratch();
  try {
    const one = resolve(directory, 'one.fits'), four = resolve(directory, 'four.fits');
    await writeFile(one, waivered(4, 1, [1, 2, 3, 4]));
    await writeFile(four, waivered(3, 4, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    const oneHdus = await readHstFileHdus(one), fourHdus = await readHstFileHdus(four);
    assert.deepEqual(rectangle('one', oneHdus[0]!).dimensions, [4, 1], 'a one-axis product is one group');
    assert.deepEqual(rectangle('four', fourHdus[0]!).dimensions, [3, 4]);
    assert.deepEqual([...(await readUnit(four, 'four', fourHdus[0]!)).values], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // The group parameters follow in a table, which holds no samples and is never read as if it did.
    assert.throws(() => rectangle('four', fourHdus[1]!), /is not an image unit/u);
    assert.throws(() => rectangle('cube', { ...fourHdus[0]!, dimensions: [3, 4, 5] }), /3 axes, which this stage does not read/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// ---- what the summaries measure ----------------------------------------------------------------------------------------

test('the body in a picture is found by its own light, not by the brightest pixel', () => {
  const width = 40, height = 40, values = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x - 25) ** 2 + (y - 15) ** 2 <= 25) values[y * width + x] = 100;
  values[3 * width + 3] = 100_000;
  const disc = findDisc(values, width, height);
  assert.ok(Math.abs(disc.x - 25) < 1 && Math.abs(disc.y - 15) < 1, `a cosmic ray of 100000 counts does not move the disc (${disc.x}, ${disc.y})`);
  assert.equal(disc.pixels, 81);
  assert.ok(Math.abs(disc.acrossPixels - 10.2) < 0.2, `${disc.acrossPixels} pixels across`);
});

test('a picture reports its scale, its body and what its data quality flags', () => {
  const width = 40, height = 40, values = new Float64Array(width * height), quality = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x - 20) ** 2 + (y - 20) ** 2 <= 16) values[y * width + x] = 500;
  quality[0] = 2; quality[1] = 8; quality[2] = 8; quality[3] = 258;
  const header = { CD1_1: -1e-5, CD1_2: 0, CD2_1: 0, CD2_2: 1e-5 };
  const measured = summariseImage({ values, samples: width, groups: height }, quality, header, 8);
  assert.ok(Math.abs(measured.arcsecPerPixel! - 0.036) < 1e-9);
  assert.equal(measured.quality!.saturated, 2, 'only the flags carrying the saturation bit count');
  assert.deepEqual(qualitySummary(quality), { samples: 1600, flagged: 4, flaggedShare: 4 / 1600, flags: { '2': 1, '8': 2, '258': 1 } });
  assert.equal(measured.quality!.flagged, 4);
  assert.equal(summariseImage({ values, samples: width, groups: height }, null, {}, 8).arcsecPerPixel, null, 'a header with no transform states no scale');
});

test('a spectrum reports where it reaches, how finely it samples, and how much signal the archive says it carries', () => {
  const samples = 5, groups = 2;
  const wavelength = Float64Array.from([100, 102, 104, 106, 108, 200, 202, 204, 206, 208]);
  const science = Float64Array.from([10, 20, 30, 40, 50, 10, 20, 30, 40, 50]);
  const uncertainty = Float64Array.from([1, 2, 3, 4, 5, 1, 2, 3, 4, 0]);
  const quality = Float64Array.from([0, 0, 16, 0, 0, 0, 0, 0, 0, 800]);
  const measured = summariseSpectrum({ values: science, samples, groups }, wavelength, uncertainty, quality, { science: 'ERGS/CM**2/S/A', wavelength: 'ANGSTROMS' });
  assert.deepEqual(measured.wavelength, { units: 'ANGSTROMS', first: 100, last: 208, medianStep: 2 }, 'the step is measured inside each group, never across the seam between two');
  assert.equal(measured.signalToNoise!.samples, 9, 'a sample the archive gives no error for carries no ratio');
  assert.equal(measured.signalToNoise!.median, 10);
  assert.equal(measured.quality!.flagged, 2);
  assert.throws(() => summariseSpectrum({ values: science, samples, groups }, wavelength.subarray(0, 4), null, null, { science: '', wavelength: '' }), /against the science array/u);
});

test('a quality plane counts every flag it holds', () => {
  assert.deepEqual(qualitySummary(Float64Array.from([0, 0, 8, 258, 258])), { samples: 5, flagged: 3, flaggedShare: 3 / 5, flags: { '8': 1, '258': 2 } });
  assert.equal('flags' in qualitySummary(Float64Array.from([1, 2, 3, 4]), 2), false, 'more distinct flags than are worth naming are counted instead');
});

// ---- the archive's own calibration provenance --------------------------------------------------------------------------

test('the calibration the archive ran is read from whichever header states it, and a version nobody wrote down is said to be missing', () => {
  const found = archiveCalibration([{ FLATCORR: 'COMPLETE', ZP_CORR: 0.0367 }, { CAL_VER: '2.5.3', FLATFILE: 'uref$m3c1004mu.r4h', DATE: '2009-04-30' }]);
  assert.deepEqual(found.version, { CAL_VER: '2.5.3' });
  assert.deepEqual(found.switches, { FLATCORR: 'COMPLETE' }, 'a number whose card ends in CORR is not a step that ran');
  assert.deepEqual(found.dates, { DATE: '2009-04-30' });
  assert.equal(found.referenceFiles.FLATFILE, 'uref$m3c1004mu.r4h');
  const none = archiveCalibration([{ CCS6: 'ytab$l611655oy.cy6', DATE: '23/06/95' }]);
  assert.equal(none.versionStated, false);
  assert.match(String(none.versionMissing), /no calibration-version card/u);
  assert.equal(none.referenceFiles.CCS6, 'ytab$l611655oy.cy6', 'a reference is also recognised by the archive path it is written as');
});

// ---- what is qualified here --------------------------------------------------------------------------------------------

test('archive-origin is a kind of its own and never answers a question about archive agreement', () => {
  assert.ok((EVIDENCE_KINDS as readonly string[]).includes('archive-origin'));
  const record = parseProductRecord({ schema: 'cssearth-telescope-product@1', telescope: 'Hubble', stage: ARCHIVE_FINAL_STAGE, inputs: [], parameters: {}, software: [],
    outputs: [{ path: 'a_c1f.fits', bytes: 1, sha256: 'a'.repeat(64) }],
    evidence: [{ kind: 'archive-origin', receipt: 'programs/a.archive-final.product.json', product: 'a_c1f.fits', establishes: "The bytes are the archive's own." }] });
  assert.equal(evidenceFor(record, 'a_c1f.fits', 'archive-origin').length, 1);
  assert.deepEqual(evidenceFor(record, 'a_c1f.fits', 'archive-agreement'), [], 'retrieval is not a reproduction');
});

test('every qualified program has a record of its own run, over the files it pins', async () => {
  for (const id of QUALIFIED) {
    const program = parseArchiveFinalProgram(await read(archiveFinalPath(id)), id);
    const record = parseProductRecord(await read(archiveFinalRecordPath(id)));
    assert.equal(record.stage, ARCHIVE_FINAL_STAGE, id);
    assert.deepEqual(record.software, [], `${id}: no software of ours made these files`);
    // The record carries the selection it was qualified with, so a later reader can rebuild it from the program and see that
    // nothing has moved: the sizes alone would not notice a component pointed at another chip of the same file.
    assert.deepEqual(record.parameters.selection, archiveFinalSelection(program), id);
    assert.equal(runDigest(archiveFinalQualifiedRun(record)), runDigest(archiveFinalQualificationRun(program)), id);
    const science = program.components.find(component => component.role === 'science')!.file!;
    const origin = evidenceFor(record, science, 'archive-origin');
    assert.equal(origin.length, 1, `${id}: one archive-origin entry, naming the science product`);
    assert.match(origin[0]!.establishes, /not establish that anything here reproduces that calibration/u, id);
    assert.deepEqual(evidenceFor(record, science, 'archive-agreement'), [], `${id}: retrieval is never recorded as agreement`);
    // Every file the program records is an output of the run at the size the run measured, and nothing else is.
    assert.deepEqual(record.outputs.map(output => output.path).sort(), program.files.map(file => file.name).sort(), id);
    for (const file of program.files) {
      const output = record.outputs.find(entry => entry.path === file.name)!;
      assert.equal(output.bytes, file.bytes, `${id}: ${file.name} bytes`);
    }
    // A part the archive does not supply is in the record with its reason, so a reader never has to notice an absence.
    for (const component of program.components) if (!component.supplied) assert.ok(component.reason!.length > 20, `${id}: ${component.role} says why`);
  }
});

test('one Europa dataset is qualified for each retired instrument, and its summary is measured', async () => {
  const measured = await Promise.all(QUALIFIED.map(async id => [id, parseProductRecord(await read(archiveFinalRecordPath(id))).parameters.measured as Record<string, unknown>] as const));
  const byId = Object.fromEntries(measured);
  assert.equal(byId['europa-wfpc2-11085']!.kind, 'image');
  assert.ok((byId['europa-wfpc2-11085']!.target as { acrossPixels: number }).acrossPixels > 5, 'Europa is resolved on the planetary camera');
  for (const id of ['europa-fos-5837', 'europa-ghrs-5376'] as const) {
    const spectrum = byId[id] as { kind: string; wavelength: { first: number; last: number }; signalToNoise: unknown };
    assert.equal(spectrum.kind, 'spectrum', id);
    assert.ok(spectrum.wavelength.last > spectrum.wavelength.first, id);
    assert.notEqual(spectrum.signalToNoise, null, `${id}: the archive supplies an error, so a signal-to-noise is measured`);
  }
});
