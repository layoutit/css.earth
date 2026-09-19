import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { parseAssociationTree } from '../interferometry/eso-associations.mts';
import { parseRawTable } from '../interferometry/eso-pipeline.mts';
import { CALIBRATION_TAGS, DP_ID, calibrationFor, modeOf, SCHEMA, scienceTag, templatesOf, treeFiles } from './archive.mts';
import { requireRunnableRecipe, templateFrames } from './reduce.mts';
import { overlapOf, repositoryPath, statistics } from './compare.mts';
import { cksum, nacoToolchainDescriptor, nacoRecipes } from './toolchain.mts';
import { bucketOf, ledgerGuide, matchShippedObject, observationsOf, parseCsv, parseTargetName, SCHEMA as LEDGER_SCHEMA } from './archive-ledger.mts';
import { midpointUtc, resolutionOf, slitGeometry } from './spectroscopy-receipt.mts';
import { median, supportOf, traceDirection, widthOf } from './spectrum.mts';

/** Archive responses kept exactly as the services returned them on 19 September 2026. */
const FIXTURES = resolve(import.meta.dirname, 'fixtures');

test('the toolchain pins one ESO kit with both digests ESO can be held to', async () => {
  const { entry } = await nacoToolchainDescriptor();
  assert.equal(entry.schema, 'cssearth-naco-toolchain@1');
  assert.equal(entry.instrument, 'NAOS+CONICA');
  const downloads = requireArray(entry.downloads, 'downloads');
  assert.equal(downloads.length, 1);
  const kit = requireRecord(downloads[0], 'kit');
  assert.match(requireString(kit.url), /^https:\/\/ftp\.eso\.org\/pub\/dfs\/pipelines\/instruments\/naco\//u);
  assert.match(requireString(kit.sha256), /^[0-9a-f]{64}$/u);
  // ESO states a cksum beside every kit, and it names the file: the pin repeats it verbatim so a swapped file is caught.
  assert.equal(requireString(kit.cksum).split(' ').at(-1), requireString(kit.path));
  assert.equal(Number(requireString(kit.cksum).split(' ')[1]), kit.bytes);
});

test('cksum reproduces the BSD CRC ESO publishes', () => {
  // The values POSIX states for cksum: the empty input, and a short known string.
  assert.deepEqual(cksum(new Uint8Array()), { crc: 4294967295, bytes: 0 });
  assert.deepEqual(cksum(new TextEncoder().encode('a')), { crc: 1220704766, bytes: 1 });
});

test('the recipes the descriptor names are the ones this route runs', async () => {
  assert.deepEqual([...await nacoRecipes()].sort(), ['naco_img_dark', 'naco_img_jitter', 'naco_img_lampflat', 'naco_img_twflat']);
});

test('a NACO frame id is the archive form and nothing else', () => {
  assert.ok(DP_ID.test('NACO.2007-11-11T02:39:14.592'));
  assert.ok(!DP_ID.test('NACO.2007-11-11T02:39:14'));
  assert.ok(!DP_ID.test('SPHER.2007-11-11T02:39:14.592'));
  assert.ok(!DP_ID.test('M.NACO.2007-11-11T02:39:14.592'));
});

test('a template is read as imaging, spectroscopy, or refused by name', () => {
  const row = (tech: string) => ({ dp_id: 'NACO.2011-10-04T07:12:57.666', dp_type: 'OBJECT', dp_tech: tech });
  assert.equal(modeOf(row('IMAGE,JITTER')), 'imaging');
  assert.equal(modeOf(row('POLARIMETRY,WOLLASTON,JITTER')), 'imaging');
  assert.equal(modeOf(row('SPECTRUM,NODDING')), 'spectroscopy');

  // A technique word that changes what the frame means is refused even when IMAGE,JITTER is also present: naco_img_jitter
  // would happily combine a masking or coronagraphic sequence and the product would look right and mean nothing.
  for (const [tech, reason] of [['CORONOGRAPHY,JITTER', /target occulted/u], ['SDI4,CUBE,PT', /four channels/u],
    ['IMAGE,JITTER,SAM,CUBE,PT', /interference pattern/u], ['IMAGE,JITTER,SAMPOL,CUBE,PT', /interference pattern/u],
    ['IMAGE,JITTER,APP,PT', /shaped point-spread/u], ['IMAGE,DIFFERENTIAL,JITTER', /must be differenced/u],
    ['IMAGE,FABRY-PEROT,JITTER', /one narrow wavelength/u], ['IMAGE,CHOPPING', /differenced in the detector/u],
    // Cube mode is refused for the other reason: nothing measured here backs the recipe's cube path.
    ['IMAGE,JITTER,CUBE', /never run the recipe cube path/u], ['SPECTRUM,NODDING,CUBE', /never run the recipe cube path/u]] as const) {
    assert.throws(() => modeOf(row(tech)), reason, tech);
  }
  // A mode that is simply not reduced here is refused too, with a different message.
  for (const tech of ['SPECTRUM,JITTER', 'IMAGE', 'IMAGE,PRE']) assert.throws(() => modeOf(row(tech)), /refuses every other NACO mode/u, tech);
  // Guiding words never change the mode.
  assert.equal(modeOf(row('IMAGE,JITTER,NOAO,PT')), 'imaging');
});

test('science frames are tagged by dp_type, with the pipeline own tag strings', () => {
  const row = (type: string, tech = 'IMAGE,JITTER') => ({ dp_id: 'NACO.2007-11-11T02:39:14.592', dp_type: type, dp_tech: tech });
  // naco/naco_dfs.h: NACO_IMG_JITTER_OBJ is the string "IM_JITTER_OBJ", not the C identifier.
  assert.equal(scienceTag(row('OBJECT')), 'IM_JITTER_OBJ');
  assert.equal(scienceTag(row('SKY')), 'IM_JITTER_SKY');
  assert.equal(scienceTag(row('OBJECT', 'POLARIMETRY,WOLLASTON,JITTER')), 'POL_JITTER_OBJ');
  assert.equal(scienceTag(row('OBJECT', 'SPECTRUM,NODDING')), 'SPEC_NODDING');
  assert.throws(() => scienceTag(row('OBJECT', 'IMAGE,CHOPPING')), /differenced in the detector/u);
});

test('the archive files a calibration frame under the very tag the recipes read it as', () => {
  for (const [category, tag] of Object.entries(CALIBRATION_TAGS)) assert.equal(category, tag);
});

test('the raw table is read by column name, as the archive returns it', async () => {
  const rows = parseRawTable(await readFile(resolve(FIXTURES, 'ceres-080.C-0881.csv'), 'utf8'));
  assert.equal(rows.length, 50);
  const science = rows.filter(row => row.dp_cat === 'SCIENCE');
  assert.equal(science.length, 49);
  assert.equal(science.filter(row => row.dp_type === 'OBJECT').length, 40);
  assert.equal(science.filter(row => row.dp_type === 'SKY').length, 9);
  assert.equal(science[0]!.instrument, 'NAOS+CONICA');
  assert.equal(science[0]!.filter_path, 'KS');

  // The night is three templates, not one: two of twenty object frames and one of nine sky frames. A reduction that treated
  // the night as a single jitter sequence would combine two separately commanded sequences into one product.
  const { objectTemplates, skyTemplates } = templatesOf(science);
  assert.deepEqual(objectTemplates, ['2007-11-11T02:38:47', '2007-11-11T02:45:32']);
  assert.deepEqual(skyTemplates, ['2007-11-11T02:53:07']);
  for (const template of objectTemplates) assert.equal(science.filter(row => row.tpl_start === template).length, 20);
  assert.equal(science.filter(row => row.tpl_start === skyTemplates[0]).length, 9);
});

test('the jitter calibration is the science association own darks and flats, not the whole tree', async () => {
  const tree = parseAssociationTree(await readFile(resolve(FIXTURES, 'ceres-associations.xml'), 'utf8'));
  assert.equal(tree.category, 'IMGJITOBJ_SW');
  // The whole tree names 128 distinct dark and flat frames, because seven photometric-standard subtrees hang under the
  // science association with calibration of their own. Those belong to naco_img_zpoint, which this route does not run.
  const whole = [...treeFiles(tree).files].filter(([, category]) => category in CALIBRATION_TAGS);
  assert.equal(whole.length, 128);

  const { files, associations, arcs, standard } = calibrationFor(tree, 'imaging');
  assert.equal(arcs, false);
  assert.deepEqual(standard, []);
  assert.deepEqual([...associations].sort(), ['DARK', 'TIMGFLAT']);
  const byCategory = new Map<string, number>();
  for (const [name, category] of files) {
    assert.ok(DP_ID.test(name), `${name} is a NACO frame id`);
    assert.ok(category in CALIBRATION_TAGS, `${category} is a category this route reduces`);
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(byCategory), { CAL_DARK: 6, CAL_FLAT_TW: 31 });
  assert.equal(files.size, 37);
});

test('a tree with no dark or no flat is refused rather than reduced without one', () => {
  const bare = { category: 'IMGJITOBJ_SW', files: [], children: [], messages: [] };
  assert.throws(() => calibrationFor(bare, 'imaging'), /names no DARK child/u);
  assert.throws(() => calibrationFor({ ...bare, children: [{ category: 'DARK', files: [], children: [], messages: [] }] }, 'imaging'), /names no TIMGFLAT or LIMGFLAT child/u);
  assert.throws(() => calibrationFor({ ...bare, children: [{ category: 'DARK', files: [], children: [], messages: [] }] }, 'spectroscopy'), /names no LSPECFLAT child/u);
});

const scienceFrame = (dpId: string, type: string, template: string) => ({ dpId, category: 'SCIENCE',
  tag: type === 'SKY' ? 'IM_JITTER_SKY' : 'IM_JITTER_OBJ', type, technique: 'IMAGE,JITTER', filter: 'KS',
  dit: 2, ndit: 5, exposure: 10, start: dpId, template, bytes: 1 });
const night = [
  ...Array.from({ length: 4 }, (_, index) => scienceFrame(`NACO.2007-11-11T02:4${index}:00.000`, 'OBJECT', 'A')),
  ...Array.from({ length: 4 }, (_, index) => scienceFrame(`NACO.2007-11-11T02:5${index}:00.000`, 'OBJECT', 'B')),
  ...Array.from({ length: 3 }, (_, index) => scienceFrame(`NACO.2007-11-11T03:0${index}:00.000`, 'SKY', 'C')),
];

test('a template reduction takes its own object frames and every sky frame of the night', () => {
  for (const template of ['A', 'B']) {
    const chosen = templateFrames(night, template);
    assert.equal(chosen.filter(item => item.type === 'OBJECT').length, 4);
    assert.equal(chosen.filter(item => item.type === 'SKY').length, 3);
    assert.ok(chosen.filter(item => item.type === 'OBJECT').every(item => item.template === template));
  }
  // The two sequences share no exposure: that is what makes them independent, and it is not a split of one sequence.
  const first = new Set(templateFrames(night, 'A').filter(item => item.type === 'OBJECT').map(item => item.dpId));
  assert.ok(templateFrames(night, 'B').filter(item => item.type === 'OBJECT').every(item => !first.has(item.dpId)));
  assert.equal(templateFrames(night).length, night.length);
});

test('an unknown template is refused, and a night with no sky is reduced without one', () => {
  assert.throws(() => templateFrames(night, 'Z'), /No object frames in template Z; the night has A B/u);
  // The Betelgeuse cube nights took no sky frame at all; naco_img_jitter finds a sky inside the cube.
  const noSky = night.filter(item => item.type !== 'SKY');
  assert.equal(templateFrames(noSky, 'A').length, 4);
  assert.equal(templateFrames(noSky, 'A').filter(item => item.type === 'SKY').length, 0);
});

test('identical samples compare as identical, and a known offset as that offset', async () => {
  const same = await statistics(visit => { for (let index = 0; index < 100; index++) visit(index + 1, index + 1); }, 100);
  assert.equal(same.identical, 100);
  assert.equal(same.identicalShare, 1);
  assert.equal(same.aboveMedian.relativeDifference?.largest, 0);
  assert.equal(same.aboveMedian.correlation, 1);

  const scaled = await statistics(visit => { for (let index = 0; index < 100; index++) visit((index + 1) * 1.01, index + 1); }, 100);
  assert.equal(scaled.identical, 0);
  assert.ok(Math.abs(scaled.aboveMedian.relativeDifference!.median - 0.01) < 1e-9);
  assert.ok(Math.abs(scaled.aboveMedian.correlation! - 1) < 1e-12);
});

test('a sample only one side holds is counted, never paired', async () => {
  const stats = await statistics(visit => { visit(1, 1); visit(Number.NaN, 2); visit(3, Number.NaN); }, 3);
  assert.equal(stats.both, 1);
  assert.equal(stats.onlyFirst, 1);
  assert.equal(stats.onlySecond, 1);
});

test('two mosaics are compared over the rectangle both hold', () => {
  // naco_img_jitter sizes its mosaic from the offsets the sequence used: the Ceres night gave 1553x1550 and 1515x1550 from
  // one 1024x1024 detector, so a comparison that demanded one shape would refuse a pair that is perfectly comparable.
  assert.deepEqual(overlapOf([1553, 1550], [1515, 1550]), { width: 1515, height: 1550 });
  assert.deepEqual(overlapOf([1515, 1550], [1553, 1550]), { width: 1515, height: 1550 });
  assert.deepEqual(overlapOf([1024, 1024], [1024, 1024]), { width: 1024, height: 1024 });
});

test('a receipt records a path the repository can read, never a local absolute one', () => {
  const inside = resolve(import.meta.dirname, '../../../.local/naco/x/jitter/naco_img_jitter.fits');
  assert.equal(repositoryPath(inside), '.local/naco/x/jitter/naco_img_jitter.fits');
  assert.equal(repositoryPath('/somewhere/else/naco_img_jitter.fits'), '/somewhere/else/naco_img_jitter.fits');
});

test('a pinned program states the schema this route reads', async () => {
  assert.equal(SCHEMA, 'cssearth-naco-program@1');
});


test('a recipe this route has never run is refused by name, with the reason', () => {
  for (const recipe of ['naco_img_lampflat', 'naco_img_zpoint', 'naco_img_detlin', 'naco_img_strehl', 'naco_spc_wavecal']) {
    assert.throws(() => requireRunnableRecipe(recipe), /is installed but this route has never run it/u, recipe);
  }
  // The two that have been run pass through unchanged.
  assert.equal(requireRunnableRecipe('naco_img_twflat'), 'naco_img_twflat');
  assert.equal(requireRunnableRecipe('naco_spc_combine'), 'naco_spc_combine');
});

// --- the ledger -------------------------------------------------------------------------------------------------------

const SHIPPED = new Set(['europa', 'europa-52', 'eurykleia', 'ceres', 'io', 'io-85', 'titan', 'metis', 'metis-9']);

test('a NACO target name is split into its minor-planet number, its name and its ephemeris stamp', () => {
  assert.deepEqual(parseTargetName('EUROPA'), { number: null, name: 'EUROPA' });
  assert.deepEqual(parseTargetName('52_EUROPA'), { number: 52, name: 'EUROPA' });
  assert.deepEqual(parseTargetName('52EUROPA-26T0340'), { number: 52, name: 'EUROPA' });
  assert.deepEqual(parseTargetName('195EURYKLEIA-26T0400'), { number: 195, name: 'EURYKLEIA' });
  assert.deepEqual(parseTargetName('JUPITER-3H40'), { number: null, name: 'JUPITER' });
});

test('a numbered target never matches the body that shares its name', () => {
  // The clash that matters: Jupiter's moon and the main-belt asteroid are two bodies with one name.
  assert.equal(matchShippedObject('EUROPA', SHIPPED), 'europa');
  assert.equal(matchShippedObject('52_EUROPA', SHIPPED), 'europa-52');
  assert.equal(matchShippedObject('52EUROPA-26T0340', SHIPPED), 'europa-52');
  assert.equal(matchShippedObject('IO', SHIPPED), 'io');
  assert.equal(matchShippedObject('85_IO', SHIPPED), 'io-85');
  assert.equal(matchShippedObject('9_METIS', SHIPPED), 'metis-9');
  assert.equal(matchShippedObject('METIS', SHIPPED), 'metis');
  // A numbered target with no numbered id is not the bare body, and is not matched at all.
  assert.equal(matchShippedObject('195EURYKLEIA-26T0400', SHIPPED), null);
  assert.equal(matchShippedObject('5012EURYMEDO-25', SHIPPED), null);
  assert.equal(matchShippedObject('OBJECT NAME NOT SET', SHIPPED), null);
  assert.equal(matchShippedObject('', SHIPPED), null);
});

test('a technique falls in exactly one ledger bucket, and the refused ones keep their own', () => {
  assert.equal(bucketOf('IMAGE,JITTER'), 'imaging');
  assert.equal(bucketOf('SPECTRUM,NODDING'), 'spectroscopy');
  assert.equal(bucketOf('IMAGE,JITTER,SAM,CUBE,PT'), 'sam');
  assert.equal(bucketOf('CORONOGRAPHY,JITTER'), 'coronography');
  assert.equal(bucketOf('SDI4,CUBE'), 'sdi4');
  assert.equal(bucketOf('SPECTRUM,JITTER'), 'other');
});

test('the archive CSV of an aggregate query is read by column name, quoted techniques included', () => {
  const rows = parseCsv('object,prog_id,dp_tech,n\nEUROPA,088.C-0833(B),"SPECTRUM,NODDING",98\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.dp_tech, 'SPECTRUM,NODDING');
  assert.equal(rows[0]!.n, '98');
});

test('observations group by shipped object and keep both spellings of a name', () => {
  const rows = [
    { object: 'EUROPA', prog_id: '088.C-0833(B)', dp_tech: 'SPECTRUM,NODDING', n: '98' },
    { object: '52_EUROPA', prog_id: '178.C-0867(B)', dp_tech: 'IMAGE,JITTER', n: '20' },
    { object: '52EUROPA-26T0340', prog_id: '178.C-0867(B)', dp_tech: 'IMAGE,JITTER', n: '4' },
    { object: 'OBJECT NAME NOT SET', prog_id: 'x', dp_tech: 'IMAGE,JITTER', n: '9' },
  ];
  const observations = observationsOf(rows, SHIPPED);
  assert.deepEqual(observations.map(item => item.id), ['europa', 'europa-52']);
  const asteroid = observations.find(item => item.id === 'europa-52')!;
  assert.equal(asteroid.frames, 24);
  assert.deepEqual(asteroid.targets, ['52EUROPA-26T0340', '52_EUROPA']);
  assert.deepEqual(asteroid.programmes, ['178.C-0867(B)']);
});

test('the ledger on disk is the one the guide states, and its states come from the programs beside it', async () => {
  const ledger = requireRecord(JSON.parse(await readFile(resolve(import.meta.dirname, '../../../data/naco/ledger.json'), 'utf8')) as unknown, 'ledger.json');
  assert.equal(ledger.schema, LEDGER_SCHEMA);
  assert.equal(ledger.instrument, 'NAOS+CONICA');
  const modes = requireArray(ledger.modes, 'modes').map(item => requireRecord(item, 'mode'));
  const programs = await readdir(resolve(import.meta.dirname, 'programs'));
  for (const mode of modes) {
    const pinned = requireArray(mode.programs, 'programs').map(value => requireString(value));
    const receipts = requireArray(mode.receipts, 'receipts').map(value => requireString(value));
    // A state is derived: it may not claim a program or a receipt that is not on disk.
    for (const program of pinned) assert.ok(programs.includes(`${program}.json`), `${program}.json exists`);
    for (const receipt of receipts) assert.ok(programs.includes(receipt), `${receipt} exists`);
    if (receipts.length) assert.equal(mode.state, 'reduced');
    else if (pinned.length) assert.equal(mode.state, 'pinned');
  }
  // The guide is generated from the ledger, so regenerating it from the same ledger must reproduce the file on disk.
  const guide = await readFile(resolve(import.meta.dirname, '../../../docs/naco-ledger.md'), 'utf8');
  assert.equal(ledgerGuide(ledger as never), guide);
});

// --- the spectroscopy receipt ------------------------------------------------------------------------------------------

test('a profile width is measured at half maximum above the profile own background', () => {
  // A triangle of half-width 4 above a background of 10: its FWHM is 4 samples.
  const profile = Array.from({ length: 21 }, (_, index) => 10 + Math.max(0, 4 - Math.abs(index - 10)));
  const width = widthOf(profile);
  assert.equal(width.peak, 10);
  assert.equal(width.background, 10);
  assert.ok(Math.abs(width.fwhm - 4) < 1e-9, `fwhm ${width.fwhm}`);
  assert.ok(Math.abs(width.centroid - 10) < 1e-9);
  assert.equal(median([1, 2, 3]), 2);
  // A profile that never falls back is refused rather than reported as the array edge.
  assert.throws(() => widthOf([1, 2, 3, 4, 5]), /does not fall back to half maximum/u);
});

test('support counts samples above a tenth of the peak, which is what tells a slit from a spectrum', () => {
  const trace = Array.from({ length: 50 }, (_, index) => Math.max(0, 10 - Math.abs(index - 25)));
  assert.equal(supportOf(trace), 19);
  assert.throws(() => supportOf([0, 0, 0]), /no sample above its own background/u);
});

test('the slit axis is the one across the trace run, not along it', () => {
  // A frame whose only signal is a horizontal line: the run along x is long, so x is the dispersion and y is the slit.
  const width = 40, height = 20, values = new Float64Array(width * height);
  for (let x = 5; x < 35; x++) values[10 * width + x] = 100;
  const direction = traceDirection({ width, height, values });
  assert.equal(direction.axis, 'y');
  assert.ok(direction.runAlongX > direction.runAlongY, `${direction.runAlongX} > ${direction.runAlongY}`);
});

test('resolved along the slit is the target width against the standard star width, and nothing without one', () => {
  const trace = (fwhm: number) => ({ axis: 'x' as const, dispersionCentre: 0, dispersionBand: 100, centroid: 0,
    fwhmPixels: fwhm, fwhmArcsec: fwhm * 0.0549, peakLevel: 1, background: 0 });
  const wider = resolutionOf(trace(13.8), trace(3.1));
  assert.equal(wider.resolvedAlongSlit, true);
  assert.ok(Math.abs(wider.ratio! - 13.8 / 3.1) < 1e-9);
  const narrower = resolutionOf(trace(2.69), trace(3.09));
  assert.equal(narrower.resolvedAlongSlit, false);
  // With no standard nothing is claimed either way.
  assert.equal(resolutionOf(trace(13.8), null).resolvedAlongSlit, null);
  assert.equal(resolutionOf(trace(13.8), null).ratio, null);
});

test('an exposure midpoint is its start plus half its integration time', () => {
  assert.equal(midpointUtc('2012-01-03T00:38:18.537Z', 35), '2012-01-03T00:38:36.037Z');
  assert.equal(midpointUtc('2012-01-03T00:38:18.537', 0), '2012-01-03T00:38:18.537Z');
  assert.throws(() => midpointUtc('not a time', 1), /is not a time/u);
});

test('the slit geometry is read from the frames own headers, and a missing card is null not a guess', () => {
  const header = { 'ESO INS PIXSCALE': 0.0549, 'ESO INS OPTI7 ID': 'L54', 'ESO INS OPTI1 ID': 'Slit_172mas',
    'ESO INS OPTI4 ID': 'Grism2', 'ESO INS OPTI6 ID': 'SL', 'ESO ADA POSANG': 90, AIRMASS: 1.2545 };
  const geometry = slitGeometry([{ start: '2012-01-03T00:38:18.537Z', exposure: 35, header }]);
  assert.equal(geometry.pixelScaleArcsec, 0.0549);
  assert.equal(geometry.slit, 'Slit_172mas');
  assert.equal(geometry.positionAngleDeg, 90);
  assert.equal(geometry.rotatorStartDeg, null);
  assert.equal(geometry.raDeg, null);
  assert.deepEqual(geometry.exposureMidpointsUtc, ['2012-01-03T00:38:36.037Z']);
});

test('the Europa receipt states what was measured, including that it is not resolved along the slit', async () => {
  const receipt = requireRecord(JSON.parse(await readFile(resolve(import.meta.dirname, 'programs/europa-088C0833.spectrum.reproduction.json'), 'utf8')) as unknown, 'receipt');
  assert.equal(receipt.schema, 'cssearth-naco-spectrum@1');
  assert.equal(receipt.object, 'EUROPA');
  assert.equal(receipt.arcs, false, 'the night associates no arc frames, so no wavelength calibration was run');
  const resolution = requireRecord(receipt.resolution, 'resolution');
  assert.equal(resolution.resolvedAlongSlit, false);
  const halves = requireArray(receipt.halves, 'halves');
  assert.equal(halves.length, 2);
  // The two halves share no exposure, so each holds half the night's twelve nods.
  for (const half of halves) assert.equal(requireRecord(half, 'half').frames, 6);
});
