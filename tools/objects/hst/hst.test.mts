import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { binaryTable, binaryTableHdu, primaryHdu, readFitsHdus } from '../interferometry/fits-table.mts';
import { parseHstProgram, PROGRAMS, suffixOf } from './archive.mts';
import { GUIDE, HST_CONFIGURATIONS, isNotAnObject, LEDGER, ledgerGuide, matchTarget, parseLedger, repositoryState, type ShippedObject } from './archive-ledger.mts';
import { calibrationRun, PIPELINES, productUnits, type PinnedFile } from './calibrate.mts';
import { archiveSky, drizzleRun, drizzleSettings } from './drizzle.mts';
import { addArchiveAgreement, compareImage, compareTable, pairExtensions } from './compare.mts';
import { evidenceFor, productRecordPath, readProductRecord, writeProductRecord } from '../product-record.mts';
import { readHstFileHdus } from './product-file.mts';

const REPOSITORY = join(import.meta.dirname, '../../..');
const file = (name: string, bytes = 1000) => ({ name, uri: `mast:HST/product/${name}`, bytes });
const program = (overrides: Record<string, unknown> = {}) => ({
  schema: 'cssearth-hst-program@1', id: 'test', programme: '14650', target: 'EUROPA-45', crdsContext: 'hst_1358.pmap',
  observations: [{ observation: 'od9l12010', instrument: 'STIS', detector: 'CCD', opticalElement: 'G430L', aperture: '52X0.1',
    exposureStartMjd: 57933.34662054, exposureEndMjd: 57933.34673628, targetName: 'EUROPA-45',
    calibrationSwitches: { DQICORR: 'PERFORM', CRCORR: 'OMIT' },
    inputs: [file('od9l12010_raw.fits'), file('od9l12010_wav.fits')], products: [file('od9l12010_flt.fits')] }],
  ...overrides,
});
const observation = (overrides: Record<string, unknown> = {}) => program({ observations: [{ ...program().observations[0], ...overrides }] });
const receipt = async (name: string) => JSON.parse(await readFile(join(PROGRAMS, `${name}.reproduction.json`), 'utf8')) as {
  differentGrid: string[]; differentSettings: Record<string, unknown>; repeatedCards: string[];
  local: { CAL_VER: string }; mast: { CAL_VER: string };
  extensions: { extname: string; kind: string; shape?: number[]; identicalShare: number;
    aboveMedian: { correlation: number; relativeDifference: { median: number; p99: number; largest: number } };
    columns?: { column: string; identicalShare: number; aboveMedian: { correlation: number; relativeDifference: { p99: number } } }[] }[];
};

test('the pinned Europa programs parse, and name their instrument, exposures and association', async () => {
  const expected = [
    ['europa-14650', 'od9l12010', 'STIS/CCD', 'G430L', ['GO-WAVECAL', 'SCIENCE']],
    ['europa-13040', 'obzp01010', 'STIS/FUV-MAMA', 'G140L', ['AUTO-WAVECAL', 'SCIENCE', 'AUTO-WAVECAL']],
    ['europa-15419', 'idr203wtq', 'WFC3/UVIS', 'F631N', null],
    ['europa-15419', 'odr2a1010', 'STIS/CCD', 'G750M', ['AUTO-WAVECAL', 'CRSPLIT', 'CRSPLIT', 'AUTO-WAVECAL']],
    ['europa-11085', 'j9xe05010', 'ACS/SBC', 'PR130L', ['EXP-RPT', 'EXP-RPT']],
  ] as const;
  for (const [id, name, configuration, element, members] of expected) {
    const pinned = parseHstProgram(JSON.parse(await readFile(join(PROGRAMS, `${id}.json`), 'utf8')));
    const entry = pinned.observations.find(other => other.observation === name);
    assert.ok(entry, `${id} pins ${name}`);
    assert.equal(`${entry.instrument}/${entry.detector}`, configuration);
    assert.equal(entry.opticalElement, element);
    assert.deepEqual(entry.association?.members.map(member => member.type) ?? null, members);
    assert.ok(entry.inputs.some(input => suffixOf(input.name) === 'RAW'), 'a raw exposure is pinned');
    assert.ok(entry.exposureEndMjd > entry.exposureStartMjd);
  }
});

test('an association’s exposures and the product it builds are pinned with it', async () => {
  const acs = parseHstProgram(JSON.parse(await readFile(join(PROGRAMS, 'europa-11085.json'), 'utf8'))).observations[0]!;
  assert.equal(acs.association?.product, 'j9xe05011');
  assert.deepEqual(acs.association?.members.map(member => member.rootname), ['j9xe05e0q', 'j9xe05e1q']);
  // Each repeat exposure is pinned with its own raw file; the summed product carries the association's own rootname.
  assert.equal(acs.inputs.filter(input => suffixOf(input.name) === 'RAW').length, 2);
  assert.ok(acs.products.some(product => product.name === 'j9xe05011_sfl.fits'));
  assert.ok(acs.products.some(product => product.name === 'j9xe05e0q_flt.fits'));
  // A CR-SPLIT association keeps its exposures as imsets of one raw file, so MAST lists one.
  const stis = parseHstProgram(JSON.parse(await readFile(join(PROGRAMS, 'europa-15419.json'), 'utf8'))).observations.find(entry => entry.observation === 'odr2a1010')!;
  assert.equal(stis.association?.product, 'odr2a1010');
  assert.equal(stis.inputs.filter(input => suffixOf(input.name) === 'RAW').length, 1);
  assert.deepEqual(stis.products.map(product => suffixOf(product.name)).sort(), ['CRJ', 'FLT', 'SX1', 'SX2']);
});

test('the re-run STIS/CCD flat field is bit-identical to the archive’s, and the rest agrees to single precision', async () => {
  const found = await receipt('europa-14650.od9l12010_flt');
  assert.deepEqual(found.differentGrid, [], 'the archive’s own grid');
  // The re-run is on a later calstis than the archive's product, which is what the receipt is for.
  assert.notEqual(found.local.CAL_VER, found.mast.CAL_VER);
  // IMPHTTAB is the one reference file CRDS now selects differently; calstis writes no photometry keywords from it.
  assert.deepEqual(Object.keys(found.differentSettings), ['IMPHTTAB']);
  assert.equal(found.extensions.find(entry => entry.extname === 'SCI')?.identicalShare, 1);
  for (const entry of found.extensions) assert.ok(entry.aboveMedian.relativeDifference.p99 < 2 ** -22, `${entry.extname}: ${entry.aboveMedian.relativeDifference.p99}`);
});

test('the re-run STIS/FUV-MAMA products agree with the archive’s to single precision', async () => {
  for (const product of ['obzp01010_flt', 'obzp01010_x2d']) {
    const found = await receipt(`europa-13040.${product}`);
    assert.deepEqual(found.differentGrid, []);
    for (const entry of found.extensions) {
      assert.ok(entry.aboveMedian.correlation > 0.999999999, `${product} ${entry.extname}: ${entry.aboveMedian.correlation}`);
      assert.ok(entry.aboveMedian.relativeDifference.p99 < 2 ** -20, `${product} ${entry.extname}: ${entry.aboveMedian.relativeDifference.p99}`);
    }
  }
});

test('calwf3 reproduces the archive’s WFC3/UVIS flat field and its CTE-corrected form bit for bit', async () => {
  for (const product of ['idr203wtq_flt', 'idr203wtq_flc']) {
    const found = await receipt(`europa-15419.${product}`);
    assert.deepEqual(found.differentGrid, []);
    assert.equal(found.extensions.find(entry => entry.extname === 'SCI')?.identicalShare, 1, `${product} science array`);
    assert.equal(found.extensions.find(entry => entry.extname === 'DQ')?.identicalShare, 1, `${product} data quality`);
  }
  // Both carry the FITS distortion records, which repeat four keywords; the drizzled product, which is on one grid, carries none.
  for (const product of ['idr203wtq_flt', 'idr203wtq_flc'])
    assert.deepEqual((await receipt(`europa-15419.${product}`)).repeatedCards, ['D2IM1', 'D2IM2', 'DP1', 'DP2'], product);
  assert.deepEqual((await receipt('europa-15419.idr203wtq_drz')).repeatedCards, []);
});

test('calstis combines a CR-SPLIT association into the archive’s own combined, rectified and extracted products', async () => {
  for (const product of ['odr2a1010_crj', 'odr2a1010_sx2', 'odr2a1010_sx1']) {
    const found = await receipt(`europa-15419.${product}`);
    assert.deepEqual(found.differentGrid, [], product);
    // A column of one constant value has no correlation to report; every measured one agrees.
    for (const entry of found.extensions) for (const measure of entry.columns ?? [entry])
      assert.ok(measure.aboveMedian.correlation === null || measure.aboveMedian.correlation > 0.9999999, `${product} ${entry.extname}: ${measure.aboveMedian.correlation}`);
  }
});

test('calacs adds an ACS/SBC repeat association into the archive’s summed product', async () => {
  const summed = await receipt('europa-11085.j9xe05011_sfl');
  assert.deepEqual(summed.differentGrid, []);
  assert.ok(summed.extensions.find(entry => entry.extname === 'SCI')!.aboveMedian.correlation > 0.9999999);
  for (const member of ['j9xe05e0q_flt', 'j9xe05e1q_flt']) {
    const found = await receipt(`europa-11085.${member}`);
    assert.deepEqual(found.differentGrid, []);
    assert.ok(found.extensions.find(entry => entry.extname === 'SCI')!.aboveMedian.correlation > 0.9999999, member);
  }
});

test('programs refuse foreign files, a product as an input, an exposure that ends first and a file of another observation', () => {
  assert.equal(parseHstProgram(program()).observations.length, 1);
  assert.throws(() => parseHstProgram(observation({ inputs: [{ ...file('od9l12010_raw.fits'), uri: 'mast:JWST/product/od9l12010_raw.fits' }] })), /Invalid MAST file/u);
  assert.throws(() => parseHstProgram(observation({ inputs: [file('od9l12010_raw.fits'), file('od9l12010_flt.fits')] })), /not a pipeline input/u);
  assert.throws(() => parseHstProgram(observation({ inputs: [file('od9l12010_wav.fits')] })), /at least one raw exposure/u);
  assert.throws(() => parseHstProgram(observation({ products: [file('od9l12010_spt.fits')] })), /calibrated products/u);
  assert.throws(() => parseHstProgram(observation({ products: [] })), /calibrated products/u);
  assert.throws(() => parseHstProgram(observation({ inputs: [file('od9l12010_x9z.fits')] })), /Invalid MAST file/u);
  assert.throws(() => parseHstProgram(observation({ exposureEndMjd: 0 })), /ends before it starts/u);
  assert.throws(() => parseHstProgram(observation({ calibrationSwitches: { DQICORR: 'PERFORM', BIASFILE: 'oref$x.fits' } })), /not a calibration switch/u);
  assert.throws(() => parseHstProgram(observation({ observation: 'od9l12010_raw' })), /not an HST observation id/u);
  assert.throws(() => parseHstProgram(program({ schema: 'cssearth-hst-program@2' })), /Unsupported HST program/u);
  assert.throws(() => parseHstProgram(program({ observations: [program().observations[0], program().observations[0]] })), /appears twice in the program/u);
  // Without an association, only the observation's own files belong to it.
  assert.throws(() => parseHstProgram(observation({ inputs: [file('od9l12010_raw.fits'), file('j9xe05e0q_raw.fits')] })), /belongs to no exposure/u);
});

const withAssociation = (overrides: Record<string, unknown> = {}) => observation({
  association: { product: 'j9xe05011', members: [{ rootname: 'j9xe05e0q', type: 'EXP-RPT' }, { rootname: 'j9xe05e1q', type: 'EXP-RPT' }], ...overrides },
  inputs: [file('od9l12010_raw.fits'), file('j9xe05e0q_raw.fits'), file('j9xe05e1q_raw.fits')],
  products: [file('j9xe05011_sfl.fits'), file('j9xe05e0q_flt.fits')],
});

test('an association admits its members’ files and refuses an unknown member type, a repeat and a wavecal-only table', () => {
  const parsed = parseHstProgram(withAssociation()).observations[0]!;
  assert.equal(parsed.association?.members.length, 2);
  assert.throws(() => parseHstProgram(withAssociation({ members: [{ rootname: 'j9xe05e0q', type: 'EXP-FOO' }] })), /not an association member type/u);
  assert.throws(() => parseHstProgram(withAssociation({ members: [{ rootname: 'j9xe05e0q', type: 'EXP-RPT' }, { rootname: 'j9xe05e0q', type: 'EXP-RPT' }] })), /appears twice/u);
  assert.throws(() => parseHstProgram(withAssociation({ members: [{ rootname: 'odr2a1j7q', type: 'AUTO-WAVECAL' }] })), /at least one exposure that is not a wavecal/u);
  assert.throws(() => parseHstProgram(withAssociation({ product: 'x' })), /not an HST rootname/u);
});

test('each instrument’s pipeline names its own wrapper and reference-path variable', () => {
  assert.deepEqual(Object.entries(PIPELINES).map(([instrument, entry]) => [instrument, entry.pipeline, entry.referenceVariable]),
    [['STIS', 'calstis', 'oref'], ['WFC3', 'calwf3', 'iref'], ['ACS', 'calacs', 'jref']]);
});

/** A minimal FITS file: an empty primary and one float32 image extension of the given name, version and shape. */
function imageFile(extname: string, extver: number, width: number, height: number, planes: number, at: (x: number, y: number, plane: number) => number, axes = planes > 1 ? 3 : 2, bunit?: string) {
  const card = (key: string, value: string | number | boolean) => (`${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'`.padEnd(20)
    : String(typeof value === 'boolean' ? value ? 'T' : 'F' : value).padStart(20)}`).padEnd(80);
  const block = (cards: readonly string[]) => Buffer.from(`${[...cards, 'END'.padEnd(80)].join('')}`.padEnd(Math.ceil((cards.length + 1) * 80 / 2880) * 2880), 'latin1');
  const lengths = [width, height, planes, 1].slice(0, axes).map((length, index) => card(`NAXIS${index + 1}`, length));
  const primary = block([card('SIMPLE', true), card('BITPIX', 8), card('NAXIS', 0), card('EXTEND', true), card('CAL_VER', '3.5.0')]);
  const header = block([card('XTENSION', 'IMAGE'), card('BITPIX', -32), card('NAXIS', axes), ...lengths, card('PCOUNT', 0), card('GCOUNT', 1),
    card('EXTNAME', extname), card('EXTVER', extver), ...(bunit ? [card('BUNIT', bunit)] : [])]);
  const samples = width * height * planes, data = Buffer.alloc(Math.ceil(samples * 4 / 2880) * 2880);
  for (let p = 0; p < planes; p++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    data.writeFloatBE(Math.fround(at(x, y, p)), ((p * height + y) * width + x) * 4);
  return Buffer.concat([primary, header, data]);
}

test('two identical images agree sample for sample, and one changed pixel is counted', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-compare-'));
  try {
    const level = (x: number, y: number) => 100 + x + 3 * y;
    const ours = join(work, 'ours.fits'), theirs = join(work, 'theirs.fits');
    await writeFile(theirs, imageFile('SCI', 1, 16, 8, 1, level));
    await writeFile(ours, imageFile('SCI', 1, 16, 8, 1, level));
    const hdusOf = async (path: string) => (await readHstFileHdus(path))[1]!;
    const same = await compareImage('SCI,1', { path: ours, hdu: await hdusOf(ours) }, { path: theirs, hdu: await hdusOf(theirs) });
    assert.deepEqual(same.shape, [16, 8]);
    assert.equal(same.identicalShare, 1);
    assert.equal(same.aboveMedian.relativeDifference?.largest, 0);
    assert.equal(same.onlyLocal + same.onlyMast, 0);

    await writeFile(ours, imageFile('SCI', 1, 16, 8, 1, (x, y) => x === 15 && y === 7 ? level(x, y) * 1.01 : level(x, y)));
    const drifted = await compareImage('SCI,1', { path: ours, hdu: await hdusOf(ours) }, { path: theirs, hdu: await hdusOf(theirs) });
    assert.equal(drifted.identical, 127);
    assert.equal(drifted.identicalShare, 127 / 128);
    assert.ok(Math.abs(drifted.aboveMedian.relativeDifference!.largest - 0.01) < 1e-6);
    assert.equal(drifted.aboveMedian.relativeDifference?.median, 0, 'one changed pixel does not move the median');
    assert.ok(drifted.aboveMedian.correlation! > 0.99);

    // A hole in one file and a value in the other are counted apart, never differenced.
    await writeFile(ours, imageFile('SCI', 1, 16, 8, 1, (x, y) => x === 0 && y === 0 ? Number.NaN : level(x, y)));
    const holed = await compareImage('SCI,1', { path: ours, hdu: await hdusOf(ours) }, { path: theirs, hdu: await hdusOf(theirs) });
    assert.equal(holed.both, 127);
    assert.equal(holed.onlyMast, 1);
    assert.equal(holed.onlyLocal, 0);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('a three-axis extension is compared plane by plane, each plane at its own offset', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-cube-'));
  try {
    // Each plane holds its own level, so a comparison that read the wrong plane would not agree.
    const level = (x: number, y: number, plane: number) => 10 * (plane + 1) + x + 2 * y;
    const ours = join(work, 'ours.fits'), theirs = join(work, 'theirs.fits');
    await writeFile(theirs, imageFile('SCI', 1, 9, 7, 5, level));
    await writeFile(ours, imageFile('SCI', 1, 9, 7, 5, level));
    const hdusOf = async (path: string) => (await readHstFileHdus(path))[1]!;
    const same = await compareImage('SCI,1', { path: ours, hdu: await hdusOf(ours) }, { path: theirs, hdu: await hdusOf(theirs) });
    assert.deepEqual(same.shape, [9, 7, 5]);
    assert.equal(same.samples, 315);
    assert.equal(same.both, 315);
    assert.equal(same.identicalShare, 1);

    // One sample of the last plane: it is found, and it is the only one that differs.
    await writeFile(ours, imageFile('SCI', 1, 9, 7, 5, (x, y, plane) => plane === 4 && x === 8 && y === 6 ? level(x, y, plane) * 1.02 : level(x, y, plane)));
    const drifted = await compareImage('SCI,1', { path: ours, hdu: await hdusOf(ours) }, { path: theirs, hdu: await hdusOf(theirs) });
    assert.equal(drifted.identical, 314);
    assert.ok(Math.abs(drifted.aboveMedian.relativeDifference!.largest - 0.02) < 1e-6);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('an extension MAST does not hold, one of another shape and one of four axes are refused, not reconciled', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-grid-'));
  try {
    const level = (x: number, y: number) => 1 + x + y;
    const write = async (name: string, bytes: Buffer) => { await writeFile(join(work, name), bytes); return readHstFileHdus(join(work, name)); };
    const theirs = await write('theirs.fits', imageFile('SCI', 1, 16, 8, 1, level));
    assert.deepEqual(pairExtensions(await write('a.fits', imageFile('SCI', 1, 16, 8, 1, level)), theirs).pairs.map(pair => pair.name), ['SCI,1']);
    assert.deepEqual(pairExtensions(await write('b.fits', imageFile('ERR', 1, 16, 8, 1, level)), theirs).differentGrid, ["ERR,1: MAST's product has no such extension", 'SCI,1: the re-run product has no such extension']);
    assert.deepEqual(pairExtensions(await write('c.fits', imageFile('SCI', 2, 16, 8, 1, level)), theirs).differentGrid, ["SCI,2: MAST's product has no such extension", 'SCI,1: the re-run product has no such extension']);
    assert.deepEqual(pairExtensions(await write('d.fits', imageFile('SCI', 1, 16, 9, 1, level)), theirs).differentGrid, ["SCI,1: 16x9 against MAST's 16x8"]);
    const errors = await write('f.fits', imageFile('ERR', 1, 16, 8, 1, level)), whole = [...theirs, errors[1]!];
    const partial = pairExtensions(theirs, whole);
    assert.deepEqual(partial.pairs.map(pair => pair.name), ['SCI,1']);
    assert.deepEqual(partial.differentGrid, ['ERR,1: the re-run product has no such extension'], 'an extension only MAST holds is reported, not skipped');
    const cube = await write('e.fits', imageFile('SCI', 1, 16, 8, 3, level));
    assert.deepEqual(pairExtensions(cube, cube).pairs.map(pair => pair.name), ['SCI,1'], 'three axes are read');
    const stack = await write('f.fits', imageFile('SCI', 1, 16, 8, 3, level, 4));
    assert.deepEqual(pairExtensions(stack, stack).differentGrid, ['SCI,1: 4 axes, which this comparison does not read']);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('a repeated keyword is kept once and reported, so a distortion-record header still reads', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-repeat-'));
  try {
    const path = join(work, 'repeated.fits');
    const patched = imageFile('SCI', 1, 4, 4, 1, () => 1);
    // Two cards of the same keyword, as the FITS distortion records are written, and a rule drawn across a HISTORY card, as a
    // drizzled product writes one. They replace the extension header's END card, which moves after them; nothing else moves.
    const write = (text: string, card: number) => patched.write(text.padEnd(80), 2880 + card * 80, 'latin1');
    write("DP1     = 'EXTVER: 1'", 9);
    write("DP1     = 'NAXES: 2'", 10);
    write('HISTORY ============================================================', 11);
    write('END', 12);
    await writeFile(path, patched);
    const hdus = await readHstFileHdus(path);
    assert.deepEqual(hdus[1]!.repeatedCards, ['DP1']);
    assert.equal(hdus[1]!.header.DP1, 'EXTVER: 1');
    assert.deepEqual(hdus[1]!.dimensions, [4, 4]);
    assert.deepEqual(hdus[0]!.repeatedCards, []);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('a spectrum table is compared column by column, and a different row count is refused', async () => {
  const rows = (flux: readonly number[]) => [[1, flux.length, [1150, 1151, 1152], flux]];
  const table = (flux: readonly number[]) => {
    const bytes = Buffer.concat([primaryHdu(), binaryTableHdu('SCI', [{ name: 'SPORDER', form: '1I' }, { name: 'NELEM', form: '1J' },
      { name: 'WAVELENGTH', form: '3D' }, { name: 'FLUX', form: '3E' }], rows(flux), [])]);
    return { bytes, table: binaryTable(readFitsHdus(bytes)[1]!) };
  };
  const theirs = table([2, 4, 6]);
  const same = (await compareTable('SCI,1', table([2, 4, 6]), theirs)).columns;
  assert.deepEqual(same.map(entry => [entry.column, entry.identicalShare]), [['SPORDER', 1], ['NELEM', 1], ['WAVELENGTH', 1], ['FLUX', 1]]);
  const drifted = (await compareTable('SCI,1', table([2, 4, 6.06]), theirs)).columns.find(entry => entry.column === 'FLUX')!;
  assert.equal(drifted.identical, 2);
  assert.ok(Math.abs(drifted.aboveMedian.relativeDifference!.largest - 0.01) < 1e-6);
  const shorter = { ...theirs, table: { ...theirs.table, rows: 2 } };
  await assert.rejects(compareTable('SCI,1', theirs, shorter), /rows against MAST/u);
});

const objects: readonly ShippedObject[] = [
  { id: 'europa', names: ['europa', 'Europa'] }, { id: 'io', names: ['io', 'Io'] },
  { id: 'dione', names: ['dione', 'Dione'] }, { id: 'dione-106', names: ['dione-106', '106 Dione'] },
  { id: 'chiron-2060', names: ['chiron-2060', '2060 Chiron'] }, { id: 'betelgeuse', names: ['betelgeuse', 'Betelgeuse'] },
];

test('a moving target names an object by its whole name, its first word or its number, and a pointing at nothing names none', () => {
  assert.equal(matchTarget('EUROPA', objects), 'europa');
  assert.equal(matchTarget('EUROPA-45', objects), 'europa');
  assert.equal(matchTarget('EUROPA-EAST-A', objects), 'europa');
  assert.equal(matchTarget('EUROPA-ECLIPSE', objects), 'europa');
  assert.equal(matchTarget('Io', objects), 'io');
  // A shared name goes to the body whose id is the plain name, not to the asteroid that shares it.
  assert.equal(matchTarget('DIONE', objects), 'dione');
  assert.equal(matchTarget('106 DIONE', objects), 'dione-106');
  assert.equal(matchTarget('(2060) Chiron', objects), 'chiron-2060');
  assert.equal(matchTarget('2060 CHIRON', objects), 'chiron-2060');
  for (const nothing of ['IO-ACQ', 'EUROPA-BKG', 'EUROPA BACKGROUND', 'OFFSET-FIELD', 'CCDFLAT', 'WAVE', 'NONE', '']) assert.equal(matchTarget(nothing, objects), null, nothing);
  assert.equal(matchTarget('TITAN', objects), null, 'a body this repository does not ship');
  assert.ok(isNotAnObject('IO-ACQ') && !isNotAnObject('EUROPA-ECLIPSE'));
});

test('the checked-in ledger counts what the pinned programs hold, and the guide says what the ledger says', async () => {
  const ledger = parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')));
  assert.deepEqual(ledger.configurations.map(entry => entry.configuration), HST_CONFIGURATIONS.map(entry => entry.configuration));
  // Nothing is declared: each configuration's programs come from the files beside them.
  const held = await repositoryState(REPOSITORY);
  for (const entry of ledger.configurations) {
    assert.deepEqual(entry.programs, [...held.get(entry.configuration)?.programs ?? []].sort(), entry.configuration);
    assert.deepEqual(entry.checked, [...held.get(entry.configuration)?.checked ?? []].sort(), entry.configuration);
  }
  assert.ok(ledger.configurations.some(entry => entry.checked.length), 'something has been re-calibrated');
  // The counts are the archive's own and must not exceed the collection they came from.
  assert.equal(ledger.observations.other, ledger.observations.collection - ledger.observations.counted);
  assert.ok(ledger.observations.other >= 0 && ledger.observations.other < ledger.observations.collection * 0.05, `${ledger.observations.other} unaccounted`);
  assert.ok(ledger.movingTargets.some(entry => entry.object === 'europa'));
  // A cone search MAST would not answer is recorded, not dropped: no object is in both lists.
  for (const object of ledger.unansweredTargets) assert.ok(!ledger.fixedTargets.some(entry => entry.object === object), object);
  assert.equal(await readFile(GUIDE, 'utf8'), ledgerGuide(ledger), 'docs/hubble-ledger.md is the ledger’s own guide');
});

const DRIZZLED = { NDRIZIM: 1, D001GEOM: 'wcs', D001KERN: 'square  ', D001PIXF: 1, D001SCAL: 0.03962000086903572, D001FVAL: 'INDEF   ', D001OUUN: 'cps     ' };

test('a drizzled product states how it was drizzled, and only a single-image drizzle with no sky is attempted', () => {
  assert.deepEqual(drizzleSettings(DRIZZLED, 'idr203wtq_drz'),
    { output: 'idr203wtq_drz', kernel: 'square', pixfrac: 1, scale: 0.03962000086903572, fillval: 'INDEF', units: 'cps' });
  assert.throws(() => drizzleSettings({ ...DRIZZLED, NDRIZIM: 6 }, 'x'), /only a single-image drizzle/u);
  assert.throws(() => drizzleSettings({ ...DRIZZLED, D001GEOM: 'header' }, 'x'), /geometry, which this run does not set/u);
  assert.throws(() => drizzleSettings({ ...DRIZZLED, D001KERN: undefined }, 'x'), /D001KERN/u);
  assert.equal(archiveSky({ MDRIZSKY: 0 }), 0);
  assert.throws(() => archiveSky({ MDRIZSKY: -3971.0583 }), /subtracted a sky of -3971.0583/u);
  assert.throws(() => archiveSky({}), /does not record the sky/u);
});

/** The observation a record is written for, its inputs pinned as a run that read them would have them. */
const CALIBRATED = parseHstProgram(observation({ inputs: [file('od9l12010_raw.fits', 2000), file('od9l12010_wav.fits', 1000)], products: [file('od9l12010_flt.fits')] }));
const PINS: PinnedFile[] = [{ ...file('od9l12010_raw.fits', 2000), sha256: 'a'.repeat(64) }, { ...file('od9l12010_wav.fits', 1000), sha256: 'b'.repeat(64) }];
const calibration = () => calibrationRun(CALIBRATED, CALIBRATED.observations[0]!, PINS,
  { given: 'od9l12010_raw.fits', wavecal: 'od9l12010_wav.fits', references: { 'od9l12010_raw.fits': { DARKFILE: 'oref$n7p1032ao_drk.fits' } } },
  [{ name: 'stistools', version: '1.4.5' }, { name: 'crds', version: '14.0.0' }, { name: 'cs0.e', version: '3.2.0' }], 'c'.repeat(64));
/** A calibrated product on disk with the record of the run that made it beside it. */
async function calibratedProduct(work: string, name = 'od9l12010_flt.fits', level = (x: number, y: number) => x + y) {
  const product = join(work, name);
  await writeFile(product, imageFile('SCI', 1, 4, 3, 1, level, 2, 'COUNTS/S'));
  await writeProductRecord(productRecordPath(product), calibration(), [{ path: name, file: product, ...await productUnits(product) }]);
  return product;
}

test('a calibration record pins the observation’s own files, the context that chose its references and what ran', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-record-'));
  try {
    const product = await calibratedProduct(work);
    const record = (await readProductRecord(productRecordPath(product)))!;
    assert.equal(record.telescope, 'HST');
    assert.equal(record.stage, 'calibrate');
    // Every input the run read, at the size it read, named by the archive product it is.
    assert.deepEqual(record.inputs.map(input => [input.role, input.identity, input.bytes]),
      [['raw', 'mast:HST/product/od9l12010_raw.fits', 2000], ['wav', 'mast:HST/product/od9l12010_wav.fits', 1000]]);
    assert.equal(record.parameters.crdsContext, 'hst_1358.pmap');
    assert.equal(record.parameters.pipeline, 'calstis');
    assert.deepEqual(record.parameters.references, { 'od9l12010_raw.fits': { DARKFILE: 'oref$n7p1032ao_drk.fits' } });
    assert.deepEqual(record.software.map(entry => entry.name), ['stistools', 'crds', 'cs0.e']);
    assert.equal(record.toolchainDigest, 'c'.repeat(64), 'the pins the software was installed from');
    // The product is pinned as the run wrote it, and states its own units.
    assert.equal(record.outputs[0]!.path, 'od9l12010_flt.fits');
    assert.equal(record.outputs[0]!.units, 'COUNTS/S');
    assert.equal(record.outputs[0]!.conventions?.extensions, 'SCI,1');
    assert.deepEqual(record.evidence, [], 'the run that made a product has checked nothing about it');
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('the comparison adds its receipt to the record of the exact product it compared, and refuses a product with none', async () => {
  const work = await mkdtemp(join(tmpdir(), 'hst-evidence-'));
  try {
    const product = await calibratedProduct(work), name = 'od9l12010_flt.fits';
    const receiptPath = join(work, 'comparison.json'); await writeFile(receiptPath, '{}');
    const record = await addArchiveAgreement(work, name, receiptPath);
    const agreement = evidenceFor(record, name, 'archive-agreement');
    assert.equal(agreement.length, 1);
    assert.ok(agreement[0]!.receipt.endsWith('.evidence.json'));
    assert.match(agreement[0]!.establishes, /reproduces what MAST distributes/u);
    assert.equal(evidenceFor(record, name, 'internal-consistency').length, 0, 'agreement with the archive is not consistency of our own');
    // The same comparison run again says the same thing once, rather than twice.
    assert.equal(evidenceFor(await addArchiveAgreement(work, name, receiptPath), name, 'archive-agreement').length, 1);
    // A product no stage recorded is refused: nothing says which run made the file that was compared.
    await writeFile(join(work, 'od9l12010_crj.fits'), 'not a recorded product');
    await assert.rejects(addArchiveAgreement(work, 'od9l12010_crj.fits', receiptPath), /no product record/u);
    // A product that is not the one its record pins is refused too.
    await writeFile(product, imageFile('SCI', 1, 4, 3, 1, (x, y) => x + y + 1, 2, 'COUNTS/S'));
    await assert.rejects(addArchiveAgreement(work, name, receiptPath), /not the files on disk/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('a drizzle record states what went in and the settings the archive’s own product gave', () => {
  const inputs = [{ role: 'calibrated exposure, this run\'s own product', identity: 'idr203wtq_flt.fits', bytes: 11, sha256: 'a'.repeat(64) },
    { role: 'archive drizzled product, read for the settings of the run that made it', identity: 'mast:HST/product/idr203wtq_drz.fits', bytes: 22, sha256: 'b'.repeat(64) },
    { role: 'archive calibrated exposure, read for the sky its drizzle subtracted', identity: 'mast:HST/product/idr203wtq_flt.fits', bytes: 33, sha256: 'c'.repeat(64) }];
  const settings = drizzleSettings(DRIZZLED, 'idr203wtq_drz');
  const made = drizzleRun(CALIBRATED, CALIBRATED.observations[0]!, inputs, settings, archiveSky({ MDRIZSKY: 0 }), [{ name: 'drizzlepac', version: '3.11.0' }], 'd'.repeat(64));
  assert.equal(made.stage, 'drizzle');
  assert.deepEqual(made.inputs, inputs, 'the exposure drizzled and the archive files the settings and the sky were read from');
  assert.deepEqual([made.parameters.kernel, made.parameters.pixfrac, made.parameters.scale, made.parameters.fillval, made.parameters.units],
    ['square', 1, 0.03962000086903572, 'INDEF', 'cps']);
  assert.deepEqual([made.parameters.skySubtraction, made.parameters.archiveSky, made.parameters.images], ['off', 0, 1]);
  assert.equal(made.toolchainDigest, 'd'.repeat(64));
});

test('AstroDrizzle reproduces the archive’s grid exactly; what it does not reproduce is the archive’s unrecorded DQ mask', async () => {
  for (const product of ['idr203wtq_drz', 'idr203wtq_drc']) {
    const found = await receipt(`europa-15419.${product}`);
    // The science extension is on the archive's own grid; only the header table, which carries file paths, differs in width.
    assert.deepEqual(found.differentGrid.filter(entry => !entry.startsWith('HDRTAB')), [], product);
    const science = found.extensions.find(entry => entry.extname === 'SCI')!;
    assert.ok(science.identicalShare > 0.5, `${product}: ${science.identicalShare} bit-identical`);
    assert.ok(science.aboveMedian.relativeDifference.median < 2 ** -22, `${product}: ${science.aboveMedian.relativeDifference.median}`);
    // The archive kept pixels this run drops, so its weight image is not reproduced; nothing here is tuned to close that.
    const weight = found.extensions.find(entry => entry.extname === 'WHT')!;
    assert.ok(weight.identicalShare < 1, `${product}: the weight image differs`);
  }
});
