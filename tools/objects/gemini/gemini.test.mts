/** Tests for the Gemini route. No network and no DRAGONS: every fixture is built here, in bytes or in a literal, so these
 * run anywhere and say what they check rather than what happened to be on disk when they were written.
 *
 * The one measured value asserted here is the registration of the two 3I/ATLAS half-stacks. It is checked against the same
 * number astropy's own WCS gives for the same two headers, so the projection in compare.mts is tested against an independent
 * implementation rather than against itself. */
import { strict as assert } from 'node:assert';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { combinedNames, declaredBias, mjdToIso, parseGeminiProgram, scienceSequences, requireProgramId,
  configurationComplete, sameConfiguration, type GeminiProgram } from './archive.mts';
import { ditherHalf, ourCalibrations, stagePlan, stageRequires, stageRun, PRODUCT_SUFFIX, STAGES } from './reduce.mts';
import { archiveMasterPin, binning, checkAgainstArchive, compareOnDetector, overlapAt, parseSection, scienceExtensions,
  skyToPixel, statistics, storedOrigin,
  wcsShift, type Wcs } from './compare.mts';
import { checkReceipt, galileanNote, hasScience, ledgerMarkdown, matchShippedObject, observationsOf, parseTargetName,
  RECEIPT_SCHEMA, type Ledger, type MoonRow } from './archive-ledger.mts';
import { PRODUCT_RECORD_SCHEMA } from '../product-record.mts';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { sha256File } from '@cssearth/core/node';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const CARD = 80, RECORD = 2880;

/** A FITS header block from a list of cards, padded to whole 2880-byte records as the format requires. */
function headerBlock(cards: readonly string[]): Buffer {
  const text = [...cards, 'END'].map(card => card.padEnd(CARD, ' ')).join('');
  return Buffer.from(text.padEnd(Math.ceil(text.length / RECORD) * RECORD, ' '), 'latin1');
}
const card = (key: string, value: string) => `${key.padEnd(8, ' ')}= ${value}`;

/** A master calibration's first two header blocks: an empty primary and the extension carrying the IMCMB cards. */
function masterHeader(inputs: readonly string[]): Buffer {
  const primary = headerBlock([card('SIMPLE', 'T'), card('BITPIX', '16'), card('NAXIS', '0'), card('EXTEND', 'T'),
    card('INSTRUME', "'GMOS-S'"), card('DETECTOR', "'GMOS + Ham-2'")]);
  const extension = headerBlock([card('XTENSION', "'IMAGE'"), card('BITPIX', '-32'), card('NAXIS', '2'),
    card('NAXIS1', '4'), card('NAXIS2', '4'), card('PCOUNT', '0'), card('GCOUNT', '1'), card('EXTNAME', "'SCI'"),
    ...inputs.map((value, index) => card(`IMCMB${String(index + 1).padStart(3, '0')}`, `'${value}'`))]);
  return Buffer.concat([primary, extension]);
}

test('an archive master names its inputs from its first extension, with or without a .fits suffix', () => {
  // A real GMOS flat master names its first input without the extension and the rest with it. Requiring `.fits` drops one.
  const bytes = masterHeader(['rgS20250917S0126[SCI,1]', 'rgS20250917S0127.fits[SCI,1]',
    'tmpfile22026_447S20250917S0128.fits[SCI,1]']);
  assert.deepEqual(combinedNames(bytes), ['S20250917S0126.fits', 'S20250917S0127.fits', 'S20250917S0128.fits']);
});

test('a file that carries primary data is not a master', () => {
  const primary = headerBlock([card('SIMPLE', 'T'), card('BITPIX', '16'), card('NAXIS', '2'), card('NAXIS1', '2'), card('NAXIS2', '2')]);
  assert.throws(() => combinedNames(Buffer.concat([primary, Buffer.alloc(RECORD)])), /no primary data/u);
});

test('an IMCMB card that names no raw frame stops the read rather than being skipped', () => {
  assert.throws(() => combinedNames(masterHeader(['something_else[SCI,1]'])), /does not name a raw Gemini frame/u);
});

test('the bias a master declares is read from BIASIM, and a master that declares none is not a fault', () => {
  assert.equal(declaredBias({ BIASIM: 'gS20250917S0156_bias' }), 'gS20250917S0156_bias.fits');
  assert.equal(declaredBias({ BIASIM: 'gS20250917S0156_bias.fits' }), 'gS20250917S0156_bias.fits');
  assert.equal(declaredBias({}), null);
  assert.throws(() => declaredBias({ BIASIM: 'S20250917S0156' }), /does not name a Gemini bias master/u);
});

test('MJD becomes an instant', () => {
  assert.equal(mjdToIso(40587), '1970-01-01T00:00:00Z');
  assert.equal(mjdToIso(60923.97755671296), '2025-09-05T23:27:40Z');
});

test('science frames are grouped into the runs the telescope was commanded to take, not by the date in their names', () => {
  // The real 3I/ATLAS r frames of GS-2025B-DD-102: four in one sequence, one the next night, three two nights after that.
  const frames = [
    ['S20250906S0037.fits', 60923.97755], ['S20250906S0042.fits', 60923.98170], ['S20250906S0047.fits', 60923.98584],
    ['S20250906S0052.fits', 60923.98998], ['S20250907S0008.fits', 60924.97950],
    ['S20250909S0029.fits', 60926.97517], ['S20250909S0034.fits', 60926.97932], ['S20250909S0039.fits', 60926.98345],
  ].map(([name, startMjd]) => ({ name: name as string, startMjd: startMjd as number }));
  const runs = scienceSequences(frames);
  assert.deepEqual(runs.map(run => run.length), [4, 1, 3]);
  assert.deepEqual(runs[0]!.map(entry => entry.name),
    ['S20250906S0037.fits', 'S20250906S0042.fits', 'S20250906S0047.fits', 'S20250906S0052.fits']);
  // Why the grouping cannot use the name: every frame of this sequence is named for 2025-09-06, and every one of them was
  // exposed on 2025-09-05. Gemini files a night under one date and names the frames under another.
  assert.ok(runs[0]!.every(entry => entry.name.startsWith('S20250906')));
  assert.ok(runs[0]!.every(entry => mjdToIso(entry.startMjd).startsWith('2025-09-05')));
});

test('a program id is the same pattern when it is written and when it is read', () => {
  assert.equal(requireProgramId('comet-3i-gs2025bdd102'), 'comet-3i-gs2025bdd102');
  assert.throws(() => requireProgramId('comet-3I-GS2025BDD102'), /is not a program id/u);
});

test('a configuration is only complete when every keyword is stated', () => {
  const full = { DETECTOR: 'GMOS + Ham-2', NAMPS: '4', AMPINTEG: '11880', DETRO1XS: '3072', DETRO1YS: '2112' };
  assert.equal(configurationComplete(full), true);
  assert.equal(configurationComplete({ ...full, NAMPS: '' }), false);
  assert.equal(sameConfiguration(full, full), true);
  // Two empty values must never compare equal, or an unstated configuration would match everything.
  assert.equal(sameConfiguration({ ...full, NAMPS: '' }, { ...full, NAMPS: '' }), false);
  assert.equal(sameConfiguration(full, { ...full, DETRO1YS: '1056' }), false);
});

/** A pinned frame of the fixture program, digested as a downloaded one would be: `inputPin` refuses a frame with no sha256,
 * because a stage that ran on an unchecked input would be recording a guess. The digest is of the name, so each frame has its
 * own and two fixtures that name different frames describe different runs. */
const frame = (name: string, extra: Record<string, unknown> = {}) => ({
  name, uri: `gemini:GEMINI/${name}`, bytes: 14849280, md5: 'a'.repeat(32), observation: 'GS-2025B-DD-102-45-003',
  sha256: createHash('sha256').update(name).digest('hex'),
  type: 'OBJECT', intent: 'science', filter: 'r', exposureSeconds: 25, startMjd: 60923.9, dataRelease: '2025-09-05', ...extra,
});
const calibration = (name: string, type: string) => frame(name, { type, intent: 'calibration', filter: type === 'BIAS' ? '' : 'r', exposureSeconds: 0 });

const PROGRAM: GeminiProgram = parseGeminiProgram({
  schema: 'cssearth-gemini-program@1', id: 'fixture', programme: 'GS-2025B-DD-102', principalInvestigator: 'Bryce Bolin',
  target: '3I', instrument: 'GMOS-S', filter: 'r', sequenceStart: '2025-09-05T23:27:40Z', archive: 'CADC/GEMINI',
  configuration: { DETECTOR: 'GMOS + Ham-2', NAMPS: '4', AMPINTEG: '11880', DETRO1XS: '3072', DETRO1YS: '2112' },
  science: ['S20250906S0037.fits', 'S20250906S0042.fits', 'S20250906S0047.fits', 'S20250906S0052.fits'].map(name => frame(name)),
  calibrations: [
    { id: 'bias', kind: 'BIAS', product: frame('gS20250906S0254_bias.fits', { type: 'BIAS', intent: 'calibration', filter: '' }),
      association: 'the IMCMB cards', daysFromScience: 0.47,
      frames: ['S20250906S0254.fits', 'S20250906S0256.fits'].map(name => calibration(name, 'BIAS')) },
    { id: 'flat-bias', kind: 'BIAS', product: frame('gS20250917S0156_bias.fits', { type: 'BIAS', intent: 'calibration', filter: '' }),
      association: 'the IMCMB cards', daysFromScience: 11.47,
      frames: ['S20250917S0156.fits', 'S20250917S0157.fits'].map(name => calibration(name, 'BIAS')) },
    { id: 'flat', kind: 'FLAT', product: frame('gS20250917S0126_flat.fits', { type: 'OBJECT', intent: 'calibration' }),
      association: 'the IMCMB cards', daysFromScience: 11.45, requiresBias: 'flat-bias',
      frames: ['S20250917S0126.fits', 'S20250917S0127.fits'].map(name => calibration(name, 'OBJECT')) },
  ],
} as unknown);

test('a twilight flat set may hold OBJECT frames, because that is what the archive calls them', () => {
  assert.equal(PROGRAM.calibrations.find(set => set.id === 'flat')!.frames[0]!.type, 'OBJECT');
  // A bias set may not: a raw bias is filed as BIAS and nothing else.
  assert.throws(() => parseGeminiProgram({ ...PROGRAM, calibrations: [{ ...PROGRAM.calibrations[0]!,
    frames: [calibration('S20250906S0254.fits', 'OBJECT')] }] } as unknown), /not a raw BIAS frame/u);
});

test('a proprietary frame is never pinned', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  assert.throws(() => parseGeminiProgram({ ...PROGRAM,
    science: [frame('S20250906S0037.fits', { dataRelease: future })] } as unknown), /is proprietary until/u);
});

test('a calibration set that names a bias must have that bias pinned, and it must be a bias', () => {
  const without = PROGRAM.calibrations.filter(set => set.id !== 'flat-bias');
  assert.throws(() => parseGeminiProgram({ ...PROGRAM, calibrations: without } as unknown), /needs the flat-bias set, which is not pinned/u);
  const wrongKind = PROGRAM.calibrations.map(set => set.id === 'flat' ? { ...set, requiresBias: 'flat' } : set);
  assert.throws(() => parseGeminiProgram({ ...PROGRAM, calibrations: wrongKind } as unknown), /but that set is a FLAT/u);
});

test("a set's product is the archive's master, never one of its own raw frames", () => {
  assert.throws(() => parseGeminiProgram({ ...PROGRAM, calibrations: [{ ...PROGRAM.calibrations[0]!,
    product: calibration('S20250906S0254.fits', 'BIAS') }] } as unknown), /is a raw frame, not the archive's master/u);
});

test('an acquisition frame is never a science frame', () => {
  assert.throws(() => parseGeminiProgram({ ...PROGRAM,
    science: [frame('S20250906S0037.fits', { type: 'ACQUISITION', intent: 'calibration' })] } as unknown),
    /an acquisition frame is not one/u);
});

test('the dither halves are interleaved, disjoint, and refused when there are too few frames', () => {
  const names = (half: 'a' | 'b') => ditherHalf(PROGRAM.science, half).map(entry => entry.name);
  assert.deepEqual(names('a'), ['S20250906S0037.fits', 'S20250906S0047.fits']);
  assert.deepEqual(names('b'), ['S20250906S0042.fits', 'S20250906S0052.fits']);
  assert.equal(names('a').filter(name => names('b').includes(name)).length, 0);
  assert.throws(() => ditherHalf(PROGRAM.science.slice(0, 3), 'a'), /does not split into two stacks/u);
});

test('each stage runs on the set it is named for, and the science stage on the science frames', () => {
  assert.deepEqual(stagePlan(PROGRAM, 'bias').frames.map(entry => entry.name), ['S20250906S0254.fits', 'S20250906S0256.fits']);
  assert.deepEqual(stagePlan(PROGRAM, 'flat-bias').frames.map(entry => entry.name), ['S20250917S0156.fits', 'S20250917S0157.fits']);
  assert.equal(stagePlan(PROGRAM, 'flat').archiveProduct!.name, 'gS20250917S0126_flat.fits');
  assert.equal(stagePlan(PROGRAM, 'science').frames.length, 4);
  // The science stack has no archive product; saying so is the reason the check for it is internal.
  assert.equal(stagePlan(PROGRAM, 'science').archiveProduct, null);
  assert.equal(stagePlan(PROGRAM, 'science', 'a').frames.length, 2);
});

test('a stage says what must run before it', () => {
  assert.deepEqual(stageRequires(PROGRAM, 'bias'), []);
  assert.deepEqual(stageRequires(PROGRAM, 'flat'), ['flat-bias']);
  assert.deepEqual(stageRequires(PROGRAM, 'science'), ['bias', 'flat']);
});

test('every stage knows what DRAGONS names its product', () => {
  for (const stage of STAGES) assert.match(PRODUCT_SUFFIX[stage], /^_[a-z]+\.fits$/u);
  // The GMOS science recipe writes `_image`, not `_stack`; looking for the wrong one finds no product at all.
  assert.equal(PRODUCT_SUFFIX.science, '_image.fits');
});

test('a FITS section is read as one-based inclusive bounds', () => {
  assert.deepEqual(parseSection('[1:512,49:4224]', 'DETSEC'), { x1: 1, x2: 512, y1: 49, y2: 4224 });
  assert.throws(() => parseSection('[1:512]', 'DETSEC'), /is not a FITS section/u);
  assert.throws(() => parseSection('[512:1,1:2]', 'DETSEC'), /is empty/u);
});

test('binning is read from CCDSUM', () => {
  assert.deepEqual(binning({ header: { CCDSUM: '2 2' } } as never), { x: 2, y: 2 });
  assert.throws(() => binning({ header: {} } as never), /states no CCDSUM/u);
});

/** The two 3I/ATLAS half-stacks' own world coordinates, copied from the products DRAGONS wrote. */
const HALF_A: Wcs = { crpix1: 1567.428125378431, crpix2: 1108.30660444437, crval1: 229.465560571769, crval2: -13.8971065168751,
  cd11: -4.445065860194e-5, cd12: -5.795530719496e-8, cd21: 5.13207712775046e-8, cd22: -4.4426008242136e-5 };
const HALF_B: Wcs = { crpix1: 1567.428109591639, crpix2: 1069.30661042053, crval1: 229.464168163591, crval2: -13.8945751770435,
  cd11: -4.4451057494521e-5, cd12: -5.7704102989661e-8, cd21: 5.14529232661013e-8, cd22: -4.4426083208904e-5 };

test('a reference point maps back to its own reference pixel', () => {
  const there = skyToPixel(HALF_A, HALF_A.crval1, HALF_A.crval2);
  assert.ok(Math.abs(there.x - HALF_A.crpix1) < 1e-6 && Math.abs(there.y - HALF_A.crpix2) < 1e-6);
});

test('the shift between the two half-stacks is the one astropy gives for the same headers', () => {
  // astropy 7.x, all_pix2world then all_world2pix on the same two headers: [-30.48154779, 17.94347772].
  const shift = wcsShift(HALF_A, HALF_B);
  assert.ok(Math.abs(shift.exactX - -30.48154779) < 1e-6, `exactX was ${shift.exactX}`);
  assert.ok(Math.abs(shift.exactY - 17.94347772) < 1e-6, `exactY was ${shift.exactY}`);
  assert.deepEqual([shift.dx, shift.dy], [-30, 18]);
  // The rounding is nearly half a pixel out in x, which is why the comparison reports a floor rather than a best figure.
  assert.ok(Math.abs(shift.residualX) > 0.45);
});

test('a sky position behind the observer is refused rather than projected to nonsense', () => {
  assert.throws(() => skyToPixel(HALF_A, HALF_A.crval1 + 180, -HALF_A.crval2), /not on the same side of the sky/u);
});

test('the overlap puts sample p of the first image on sample p + shift of the second', () => {
  // A positive shift means the second image holds the same sky further along, so the first is walked from its own origin.
  assert.deepEqual(overlapAt([10, 10], [10, 10], 3, 0), { x0: 0, y0: 0, width: 7, height: 10 });
  assert.deepEqual(overlapAt([10, 10], [10, 10], -3, 0), { x0: 3, y0: 0, width: 7, height: 10 });
  assert.deepEqual(overlapAt([10, 10], [10, 10], 0, 0), { x0: 0, y0: 0, width: 10, height: 10 });
  const none = overlapAt([10, 10], [10, 10], 20, 0);
  assert.ok(none.width < 1);
});

test('statistics count what both products hold and leave the rest alone', async () => {
  const first = [1, 2, 3, 4, Number.NaN, 6], second = [1, 2, 4, 4, 5, Number.NaN];
  const stats = await statistics(visit => { for (let i = 0; i < first.length; i++) visit(first[i]!, second[i]!); }, first.length);
  assert.equal(stats.both, 4);
  assert.equal(stats.identical, 3);
  assert.equal(stats.identicalShare, 0.75);
  assert.equal(stats.medianAbsoluteDifference, 0);
  assert.equal(stats.absoluteDifference!.largest, 1);
});

test('two products that share no finite sample are refused, not reported as agreeing', async () => {
  await assert.rejects(statistics(visit => { visit(Number.NaN, 1); }, 1), /share no finite sample/u);
});

test('a target name is matched to a shipped body only when its number agrees', () => {
  const shipped = new Set(['europa', 'europa-52', 'comet-3i']);
  assert.equal(matchShippedObject('Europa', shipped), 'europa');
  assert.equal(matchShippedObject('Europa.eph', shipped), 'europa');
  assert.equal(matchShippedObject('52 Europa', shipped), 'europa-52');
  // A numbered target is never the bare body, even when the bare id exists.
  assert.equal(matchShippedObject('195 Eurykleia', shipped), null);
  assert.deepEqual(parseTargetName('52_EUROPA'), { number: 52, name: 'EUROPA' });
  assert.deepEqual(parseTargetName('Europa.eph'), { number: null, name: 'EUROPA' });
});

test('an acquisition frame is counted apart from an observation', () => {
  const rows = [
    { target_name: 'Europa', instrument_name: 'NIRI', type: 'ACQUISITION', intent: 'calibration', proposal_id: 'GN-2017A-Q-60', n: '14' },
    { target_name: 'Europa', instrument_name: 'GNIRS', type: 'OBJECT', intent: 'science', proposal_id: 'GN-2017A-Q-63', n: '220' },
  ];
  const [entry] = observationsOf(rows, new Set(['europa']));
  assert.equal(entry!.science, 220);
  assert.equal(entry!.acquisition, 14);
  assert.deepEqual(entry!.instruments, ['GNIRS', 'NIRI']);
});

const RECORD_FOR = (product: string, kind: string) => ({
  schema: PRODUCT_RECORD_SCHEMA, telescope: 'gemini', stage: 'gemini/bias', inputs: [], parameters: {}, software: [],
  outputs: [{ path: product, bytes: 10, sha256: 'b'.repeat(64) }],
  evidence: [{ kind, receipt: 'r', product, establishes: 'something' }],
});
const RECEIPT = { schema: RECEIPT_SCHEMA, program: 'fixture', programme: 'GS-2025B-DD-102', evidence: 'archive-agreement',
  ours: { product: 'S20250906S0254_bias.fits' } };

test('a receipt is accepted only when a product record carries the same evidence for the same product', () => {
  const records = new Map<string, unknown>([['S20250906S0254_bias.fits', RECORD_FOR('S20250906S0254_bias.fits', 'archive-agreement')]]);
  assert.deepEqual(checkReceipt(RECEIPT, 'fixture.x.reproduction.json', PROGRAM, records),
    { product: 'S20250906S0254_bias.fits', kind: 'archive-agreement', instrument: 'GMOS-S' });
  // A receipt whose product has no record proves nothing.
  assert.throws(() => checkReceipt(RECEIPT, 'fixture.x.reproduction.json', PROGRAM, new Map()), /has no product record/u);
  // Nor does one whose record carries a different kind of evidence: the kinds establish different things.
  const other = new Map<string, unknown>([['S20250906S0254_bias.fits', RECORD_FOR('S20250906S0254_bias.fits', 'internal-consistency')]]);
  assert.throws(() => checkReceipt(RECEIPT, 'fixture.x.reproduction.json', PROGRAM, other), /carries no archive-agreement evidence/u);
});

test('a receipt of another programme, or of another schema, is refused', () => {
  const records = new Map<string, unknown>([['S20250906S0254_bias.fits', RECORD_FOR('S20250906S0254_bias.fits', 'archive-agreement')]]);
  assert.throws(() => checkReceipt({ ...RECEIPT, programme: 'GN-2017A-Q-63' }, 'f.json', PROGRAM, records), /it names the programme/u);
  assert.throws(() => checkReceipt({ ...RECEIPT, schema: 'something-else@1' }, 'f.json', PROGRAM, records), /is not a Gemini receipt/u);
  assert.throws(() => checkReceipt({ ...RECEIPT, evidence: 'looks-fine' }, 'f.json', PROGRAM, records), /is not a kind of evidence/u);
});

const moon = (moon: string, type: string, intent: string, frames = 1): MoonRow =>
  ({ moon, instrument: 'NIRI', type, intent, filter: 'H', frames, programmes: ['GN-2017A-Q-60'] });

test('a moon has science only when a frame of its own says so, and an acquisition never does', () => {
  const rows = [moon('europa', 'ACQUISITION', 'calibration'), moon('io', 'OBJECT', 'science')];
  assert.equal(hasScience(rows, 'europa'), false);
  assert.equal(hasScience(rows, 'io'), true);
  // A frame of science intent that is still a calibration type is not an observation either.
  assert.equal(hasScience([moon('callisto', 'FLAT', 'science')], 'callisto'), false);
});

test('the Galilean note is read from the rows and from what this run proved, never declared', () => {
  const rows = [moon('europa', 'ACQUISITION', 'calibration'), moon('io', 'OBJECT', 'science'),
    moon('ganymede', 'ACQUISITION', 'calibration')];
  const capabilities = [{ instrument: 'NIRI', science: 1, support: 'supported', state: 'reduced',
    programs: [], evidence: [], reason: 'proven' }] as unknown as Parameters<typeof galileanNote>[1];
  const note = galileanNote(rows, capabilities);
  assert.match(note, /Of the four Galilean moons, 1 have public Gemini science frames \(io\), and 1 \(io\) were taken/u);
  assert.match(note, /io: NIRI 1 \(reduced\)\. Reducible here through NIRI\./u);
  // Frames alone are not the answer: a moon with only pointing exposures says so, and one with none says something else.
  assert.match(note, /europa: pointing exposures only, and no science frame of any kind\./u);
  assert.match(note, /callisto: nothing public at all\./u);
  // With nothing proven, the same rows must not claim anything is reducible.
  const unproven = galileanNote(rows, []);
  assert.match(unproven, /and none were taken on an instrument this toolkit has proven/u);
  assert.match(unproven, /io: NIRI 1 \(unsupported\)\. No instrument that observed it has been proven/u);
});

test('the ledger says plainly when an object has no science frames of its own', () => {
  const ledger = {
    schema: 'cssearth-gemini-ledger@1', collection: 'GEMINI', archive: 'CADC', measured: '2026-09-19',
    publicOnly: 'public only', instruments: [{ instrument: 'NIRI', frames: 10, science: 4 }],
    objects: [{ id: 'europa', targets: ['Europa'], science: 0, acquisition: 14, instruments: ['NIRI'], programmes: 1 }],
    galileanMoons: { note: 'Not one Gemini frame of Europa is a science frame.', rows: [moon('europa', 'ACQUISITION', 'calibration', 14)] },
    capabilities: [{ instrument: 'NIRI', science: 4, support: 'supported', state: 'unproven', programs: [], evidence: [], reason: 'nothing yet' }],
    receiptProblems: [],
  } as unknown as Ledger;
  const text = ledgerMarkdown(ledger);
  assert.match(text, /Not one Gemini frame of Europa is a science frame/u);
  assert.match(text, /\| NIRI \| 4 \| supported \| unproven \|/u);
  assert.match(text, /None\. Every receipt beside a pinned program/u);
});

test('the repository FITS reader locates the extensions of a master this route writes', async () => {
  // A guard on the one assumption compareOnDetector rests on: SCI extensions are found by name and matched on DETSEC.
  const hdus = await readFitsFileHdus(new URL('./fixtures/master.fits', import.meta.url).pathname).catch(() => null);
  if (!hdus) return; // The fixture is optional; the rest of this suite needs no file at all.
  const found = scienceExtensions(hdus);
  assert.ok(found.size >= 1);
});

// -- The two defects a reviewer found, each with the case that exposed it. ----------------------------------------------

/** A minimal multi-extension FITS image on disk: an empty primary and one SCI extension of float32 samples, big-endian as
 * the format requires. Enough to exercise how two products are lined up, and nothing more. */
async function writeImage(path: string, options: { width: number; height: number; detsec: string; datasec: string;
  values: (x: number, y: number) => number }) {
  const { width, height } = options;
  const primary = headerBlock([card('SIMPLE', 'T'), card('BITPIX', '16'), card('NAXIS', '0'), card('EXTEND', 'T')]);
  const extension = headerBlock([card('XTENSION', "'IMAGE'"), card('BITPIX', '-32'), card('NAXIS', '2'),
    card('NAXIS1', String(width)), card('NAXIS2', String(height)), card('PCOUNT', '0'), card('GCOUNT', '1'),
    card('EXTNAME', "'SCI'"), card('EXTVER', '1'), card('CCDSUM', "'1 1'"),
    card('DETSEC', `'${options.detsec}'`), card('DATASEC', `'${options.datasec}'`)]);
  const data = Buffer.alloc(Math.ceil(width * height * 4 / RECORD) * RECORD);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.writeFloatBE(options.values(x, y), (y * width + x) * 4);
  await writeFile(path, Buffer.concat([primary, extension, data]));
}

test('a product that keeps its overscan is lined up by DATASEC as well as DETSEC', async () => {
  // The reviewer's case. Both products hold the same four detector columns with the same science values; one of them also
  // carries four columns of overscan in front. Lining them up on DETSEC alone compares science against overscan.
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-datasec-'));
  try {
    const science = (x: number, y: number) => 100 + x + 10 * y;
    // Trimmed: the science region starts at stored column 1.
    await writeImage(resolve(directory, 'trimmed.fits'),
      { width: 4, height: 4, detsec: '[1:4,1:4]', datasec: '[1:4,1:4]', values: science });
    // With overscan: the same science region starts at stored column 5, behind four columns of something else entirely.
    await writeImage(resolve(directory, 'overscan.fits'),
      { width: 8, height: 4, detsec: '[1:4,1:4]', datasec: '[5:8,1:4]',
        values: (x, y) => x < 4 ? -999 : science(x - 4, y) });
    const { total, extensions } = await compareOnDetector(resolve(directory, 'overscan.fits'), resolve(directory, 'trimmed.fits'));
    assert.equal(total.both, 16);
    assert.equal(total.identical, 16, 'the same science values must compare identical whichever product keeps its overscan');
    assert.equal(total.identicalShare, 1);
    assert.equal(extensions[0]!.samples, 16);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the stored origin is the detector offset plus the science region own start', () => {
  // A trimmed extension: detector column 1 is stored sample 0.
  assert.equal(storedOrigin(1, 1, 1, 1), 0);
  // The same extension with four columns of overscan in front: detector column 1 is stored sample 4.
  assert.equal(storedOrigin(1, 5, 1, 1), 4);
  // Binned, and starting part way in: detector row 49 at 2 per sample, science region from stored row 1.
  assert.equal(storedOrigin(1, 1, 49, 2), 24);
  assert.throws(() => storedOrigin(1, 1, 50, 2), /does not start on a whole sample/u);
});

/** A work directory holding one master and the record that claims to have made it. */
async function workWithMaster(directory: string, stage: 'bias', record: Record<string, unknown>) {
  const stageDir = resolve(directory, stage);
  await mkdir(stageDir, { recursive: true });
  const product = 'S20250906S0254_bias.fits';
  await writeFile(resolve(stageDir, product), 'a master, as far as this test is concerned');
  const { bytes, sha256 } = await sha256File(resolve(stageDir, product));
  await writeFile(resolve(stageDir, `${product}.product.json`),
    `${JSON.stringify({ ...record, outputs: [{ path: product, bytes, sha256 }] }, null, 2)}\n`);
  return product;
}

const CONTEXT = (program: GeminiProgram, work: string) =>
  ({ program, work, software: [{ name: 'dragons', version: '4.2.2' }], toolchainDigest: 'd'.repeat(64) });

test('a master is reused only when its record describes this program current plan', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-reuse-'));
  try {
    const context = CONTEXT(PROGRAM, directory);
    // What the bias stage of this program would record. Written by the same function the stage uses, so the test cannot
    // drift from it.
    const { run } = await stageRun(context, 'bias');
    await workWithMaster(directory, 'bias', { schema: PRODUCT_RECORD_SCHEMA, ...run, evidence: [] });
    const [found] = await ourCalibrations(context, ['bias']);
    assert.equal(found!.role, 'processed_bias');
    assert.equal(found!.input.identity, 'S20250906S0254_bias.fits');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a master left by another program is refused, not reused', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-other-'));
  try {
    const other = parseGeminiProgram({ ...PROGRAM, id: 'other', programme: 'GN-2017A-Q-63' } as unknown);
    const { run } = await stageRun(CONTEXT(other, directory), 'bias');
    await workWithMaster(directory, 'bias', { schema: PRODUCT_RECORD_SCHEMA, ...run, evidence: [] });
    // The work directory now holds a perfectly valid master of a different programme. It must not be picked up.
    await assert.rejects(ourCalibrations(CONTEXT(PROGRAM, directory), ['bias']),
      /was not made by this program's current bias plan/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a master made from a different bias set is refused, not reused', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-set-'));
  try {
    // The same programme, but its bias set names one different raw frame: a pin that changed since the master was made.
    const changed = parseGeminiProgram({ ...PROGRAM, calibrations: PROGRAM.calibrations.map(set => set.id !== 'bias' ? set
      : { ...set, frames: [set.frames[0], calibration('S20250906S0299.fits', 'BIAS')] }) } as unknown);
    const { run } = await stageRun(CONTEXT(changed, directory), 'bias');
    await workWithMaster(directory, 'bias', { schema: PRODUCT_RECORD_SCHEMA, ...run, evidence: [] });
    await assert.rejects(ourCalibrations(CONTEXT(PROGRAM, directory), ['bias']),
      /was not made by this program's current bias plan/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a master whose file changed under its record is refused', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-changed-'));
  try {
    const context = CONTEXT(PROGRAM, directory);
    const { run } = await stageRun(context, 'bias');
    const product = await workWithMaster(directory, 'bias', { schema: PRODUCT_RECORD_SCHEMA, ...run, evidence: [] });
    await writeFile(resolve(directory, 'bias', product), 'something else entirely');
    await assert.rejects(ourCalibrations(context, ['bias']), /no longer the file its record pins/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a comparison refuses a master that is not this program current plan, and attaches no evidence', async () => {
  // The reviewer's case. A work directory holds a perfectly readable master recorded under an unrelated programme, built
  // from a raw frame this program's bias set never names. Comparing it against this program's archive master would produce
  // ordinary-looking numbers and a receipt asserting the two were made from the same raw frames, which is false.
  const directory = await mkdtemp(resolve(tmpdir(), 'gemini-archive-'));
  try {
    const stranger = parseGeminiProgram({ ...PROGRAM, id: 'stranger', programme: 'GN-2017A-Q-63',
      calibrations: PROGRAM.calibrations.map(set => set.id !== 'bias' ? set
        : { ...set, frames: [calibration('S20170111S0202.fits', 'BIAS'), calibration('S20170111S0203.fits', 'BIAS')] }) } as unknown);
    const { run } = await stageRun(CONTEXT(stranger, directory), 'bias');
    await workWithMaster(directory, 'bias', { schema: PRODUCT_RECORD_SCHEMA, ...run, evidence: [] });
    await assert.rejects(checkAgainstArchive(PROGRAM, directory, 'bias', [], CONTEXT(PROGRAM, directory)),
      /was not made by fixture's current bias plan/u);
    // Nothing was written: no receipt, and no evidence on the stranger's record.
    const record = JSON.parse(await readFile(resolve(directory, 'bias', 'S20250906S0254_bias.fits.product.json'), 'utf8')) as { evidence: unknown[] };
    assert.deepEqual(record.evidence, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an archive master with no digest of its own is refused rather than compared against', () => {
  const master = PROGRAM.calibrations.find(set => set.id === 'bias')!.product;
  assert.equal(archiveMasterPin(master).identity, 'gS20250906S0254_bias.fits');
  const { sha256, ...withoutDigest } = master;
  assert.ok(sha256);
  assert.throws(() => archiveMasterPin(withoutDigest as typeof master), /carries no sha256 yet/u);
});
