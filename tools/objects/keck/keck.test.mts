import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDigest } from '../product-record.mts';
import { csvCells, instrumentTable, INSTRUMENT_TABLES, lev0Url, lev1Url } from './koa.mts';
import { CALIBRATION_TYPES, KOAID, nightsAround, parseKeckProgram, PROGRAMS } from './archive.mts';
import { matchShippedObject, nameCandidates, normalise, pinnedEvidence, REDUCTION_STATE } from './archive-ledger.mts';
import { assertNoPlotServer, configureWithoutPlots, pinnedInput, PLOT_SERVER_LINES, PLOTS_OFF, REDUCIBLE, reductionRun, stagedName } from './reduce.mts';
import { archiveAgreement, assertRunIsFor, pairExtensions, productStems, runProduct, selectRunProduct, stageOf } from './compare.mts';

const KOA = 'https://koa.ipac.caltech.edu';
const path = '/KCWI/2023/20231209/lev0/KB.20231209.37031.94.fits';
const digest = 'a'.repeat(64);
const file = (overrides: Record<string, unknown> = {}) => ({ koaid: 'KB.20231209.37031.94.fits', name: 'KB.20231209.37031.94.fits',
  observatoryName: 'kb231209_00085.fits', filehand: path, url: `${KOA}/cgi-bin/getKOA/nph-getKOA?filehand=${path}`,
  bytes: 10166400, sha256: digest, imageType: 'object', ...overrides });
const calibration = (overrides: Record<string, unknown> = {}) => {
  const bias = '/KCWI/2023/20231209/lev0/KB.20231209.20185.51.fits';
  return file({ koaid: 'KB.20231209.20185.51.fits', name: 'KB.20231209.20185.51.fits', observatoryName: 'kb231209_00017.fits',
    filehand: bias, url: `${KOA}/cgi-bin/getKOA/nph-getKOA?filehand=${bias}`, imageType: 'bias', ...overrides });
};
const observation = (overrides: Record<string, unknown> = {}) => ({ koaid: 'KB.20231209.37031.94.fits', targetName: 'm42',
  dateObs: '2023-12-09 00:00:00', ut: '10:17:11.94', elapsedSeconds: 5, proprietaryMonths: 18,
  configuration: { camera: 'BLUE', bgratnam: 'BL', ifunam: 'Medium', binning: '2,2' }, science: file(),
  association: { frames: 89, pinned: 1, nights: 0, detector: 0 }, calibrations: [calibration()], archiveProducts: [], ...overrides });
const program = (overrides: Record<string, unknown> = {}) => ({ schema: 'cssearth-keck-program@1', id: 'test', instrument: 'KCWI',
  table: 'koa_kcwi', target: 'm42', programme: 'U124', semester: '2023B_U124', principalInvestigator: 'Jones',
  title: 'KCWI', observations: [observation()], ...overrides });
const refuses = (value: unknown, because: string) => assert.throws(() => parseKeckProgram(value), TypeError, because);

test('KOA serves one table per instrument, and a URL is built only for one it serves', () => {
  assert.equal(instrumentTable('KCWI'), 'koa_kcwi');
  assert.equal(instrumentTable('osiris'), 'koa_osiris');
  assert.throws(() => instrumentTable('NIRCAM'), TypeError, 'KOA serves no NIRCAM');
  assert.ok(INSTRUMENT_TABLES.includes('koa_nirspec') && INSTRUMENT_TABLES.includes('koa_hires'));
  assert.equal(lev0Url(path), `${KOA}/cgi-bin/getKOA/nph-getKOA?filehand=${path}`);
  assert.match(lev1Url('OSIRIS', 'OS.20110918.33029.fits', '/x/y.fits'), /nph-dnloadL1data\?instrument=osiris&koaid=OS\./u);
});

test('a KOA id is the instrument, the night and the second within it', () => {
  for (const id of ['KB.20231209.37031.94.fits', 'OS.20110918.33029.fits', 'N2.20240206.12345.fits']) assert.match(id, KOAID);
  for (const id of ['kb231209_00085.fits', 'KB.20231209.fits', 'OS.2011.33029.fits']) assert.doesNotMatch(id, KOAID);
});

test('a valid program parses, and keeps the archive’s own account of the observation', () => {
  const parsed = parseKeckProgram(program());
  assert.equal(parsed.instrument, 'KCWI');
  assert.equal(parsed.observations[0]!.configuration.bgratnam, 'BL');
  assert.equal(parsed.observations[0]!.proprietaryMonths, 18);
  assert.equal(parsed.observations[0]!.association.frames, 89);
  assert.equal(parsed.observations[0]!.association.detector, 0);
  assert.equal(parsed.observations[0]!.science.observatoryName, 'kb231209_00085.fits');
});

test('a program is refused unless every file is one KOA serves, by digest', () => {
  refuses(program({ schema: 'cssearth-keck-program@2' }), 'another schema');
  refuses(program({ table: 'koa_jwst' }), 'a table KOA has not');
  refuses(program({ observations: [] }), 'no observation');
  refuses(program({ observations: [observation(), observation()] }), 'the same observation twice');
  refuses(program({ observations: [observation({ science: file({ sha256: 'short' }) })] }), 'a digest that is not a sha256');
  refuses(program({ observations: [observation({ science: file({ bytes: 0 }) })] }), 'no byte count');
  refuses(program({ observations: [observation({ science: file({ url: 'https://example.com/file.fits' }) })] }), 'a URL that is not KOA');
  refuses(program({ observations: [observation({ science: file({ name: 'other.fits' }) })] }), 'a name the path does not end in');
  refuses(program({ observations: [observation({ science: file({ imageType: 'bias' }) })] }), 'a calibration pinned as science');
  refuses(program({ observations: [observation({ calibrations: [calibration({ imageType: 'object' })] })] }), 'a science frame pinned as a calibration');
  refuses(program({ observations: [observation({ calibrations: [calibration({ koaid: 'KB.20231209.37031.94.fits' })] })] }), 'the frame as its own calibration');
  refuses(program({ observations: [observation({ calibrations: [calibration(), calibration()] })] }), 'a file twice');
  refuses(program({ observations: [observation({ association: { frames: 89, pinned: 2, nights: 0, detector: 0 } })] }), 'a count that is not what it pins');
  refuses(program({ observations: [observation({ association: { frames: 0, pinned: 1, nights: 0, detector: 0 } })] }), 'more pins than the archive associated');
  refuses(program({ observations: [observation({ association: { frames: 89, pinned: 0, nights: 0, detector: 1 } })] }), 'a detector count no calibration claims');
  refuses(program({ observations: [observation({ archiveProducts: [file({ koaid: 'KB.20231209.20185.51.fits', imageType: undefined })] })] }), 'a product of another frame');
  refuses(program({ observations: [observation({ proprietaryMonths: -1 })] }), 'a negative proprietary period');
});

test('every calibration kind a program may pin is one KOA names', () => {
  for (const kind of ['bias', 'arclamp', 'contbars', 'flatlamp', 'domeflat', 'twiflat']) assert.ok((CALIBRATION_TYPES as readonly string[]).includes(kind), kind);
  assert.ok(!(CALIBRATION_TYPES as readonly string[]).includes('object'), 'a science frame is never a calibration');
});

test('only the instruments whose pipeline is installed here can be re-run', () => {
  assert.deepEqual(Object.keys(REDUCIBLE), ["KCWI"]);
  assert.deepEqual(REDUCIBLE.KCWI!.args("KB"), ["-g", "-b"]);
  assert.deepEqual(REDUCIBLE.KCWI!.args("KR"), ["-g", "-r"]);
  assert.equal(REDUCIBLE.KCWI!.channel("KB.20231209.37031.94.fits"), "KB");
  assert.ok(!REDUCIBLE.OSIRIS, 'the OSIRIS DRP is IDL and is not installed');
  // The KCWI DRP reads a night by the observatory's own naming, so that is the name a frame is staged under.
  assert.equal(stagedName(parseKeckProgram(program()).observations[0]!.science), 'kb231209_00085.fits');
  assert.equal(stagedName({ koaid: 'x', name: 'OS.20110918.33029.lev1.fits.gz', filehand: '', url: '', bytes: 1, sha256: digest }), 'OS.20110918.33029.lev1.fits.gz');
});

test('a product is matched to the archive’s by the stage it ends in, not by its file name', () => {
  assert.equal(stageOf('KB.20231209.37031.94_icubed.fits'), 'icubed');
  assert.equal(stageOf('/a/b/kb231209_00085_intf.fits'), 'intf');
  assert.equal(stageOf('OS.20110918.33029.lev1.fits.gz'), '');
});

test('two products are compared only where they are on one grid', () => {
  const hdu = (dimensions: number[], extname?: string) => ({ header: { ...(extname ? { EXTNAME: extname } : {}) }, dimensions,
    bitpix: -32, dataStart: 0, dataBytes: 0, headerStart: 0, repeatedCards: [] }) as unknown as Parameters<typeof pairExtensions>[0][number];
  const ours = [hdu([]), hdu([10, 20, 3], 'PRIMARY'), hdu([5, 5], 'UNCERT'), hdu([4], 'ODD'), hdu([7, 7], 'ONLYOURS')];
  const theirs = [hdu([]), hdu([10, 20, 3], 'PRIMARY'), hdu([6, 5], 'UNCERT'), hdu([4], 'ODD')];
  const { pairs, differentGrid } = pairExtensions(ours, theirs);
  assert.deepEqual(pairs.map(pair => pair.name), ['PRIMARY']);
  assert.deepEqual(differentGrid, ["UNCERT: 5x5 against the archive's 6x5", 'ODD: 1 axes, which this comparison does not read',
    "ONLYOURS: the archive's product has no such extension"]);
  // A KCWI cube carries its samples in the primary header and nothing else, and the archive's file is the same shape: the
  // empty header of a file that keeps its data in a named extension is never paired with that extension.
  assert.deepEqual(pairExtensions([hdu([]), hdu([4, 4], 'SCI')], [hdu([]), hdu([4, 4], 'SCI')]).pairs.map(pair => pair.name), ['SCI']);
});

test('the shipped M42 program pins the frames the archive associates, and KOA’s own cube to check against', async () => {
  const pinned = parseKeckProgram(JSON.parse(await readFile(join(PROGRAMS, 'm42-kcwi-2023b-u124.json'), 'utf8')));
  assert.equal(pinned.instrument, 'KCWI');
  assert.equal(pinned.target, 'm42');
  assert.equal(pinned.programme, 'U124');
  const entry = pinned.observations[0]!;
  assert.equal(entry.koaid, 'KB.20231209.37031.94.fits');
  assert.equal(entry.configuration.bgratnam, 'BL');
  assert.equal(entry.configuration.ifunam, 'Medium');
  assert.ok(entry.calibrations.length >= 20, `a night's calibrations are pinned, not a few (${entry.calibrations.length})`);
  for (const kind of ['bias', 'contbars', 'arclamp', 'flatlamp']) assert.ok(entry.calibrations.some(file => file.imageType === kind), `${kind} is pinned`);
  assert.ok(entry.archiveProducts.some(product => stageOf(product.name) === 'icubed'), 'KOA’s own cube is pinned to compare against');
  for (const file of [entry.science, ...entry.calibrations, ...entry.archiveProducts]) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/u, `${file.name} is pinned by digest`);
    assert.ok(file.bytes > 0 && file.url.startsWith(KOA), `${file.name} is pinned by URL and size`);
  }
});

test('a KOA row keeps a comma that is inside a quoted cell', () => {
  // KCWI states its binning as "2,2" and its readout mode in the next column. Splitting on every comma made the binning "2,
  // the amp mode 2" and shifted every column after them, which is how the shipped program once recorded its configuration.
  assert.deepEqual(csvCells('"KB.20231209.37031.94.fits","m42","2,2","TUP",5'), ['KB.20231209.37031.94.fits', 'm42', '2,2', 'TUP', '5']);
  assert.deepEqual(csvCells('a,,b'), ['a', '', 'b']);
  assert.deepEqual(csvCells('"he said ""hi""",2'), ['he said "hi"', '2']);
});

test('the nights a pin may reach are the frame’s own and the days either side of it', () => {
  assert.deepEqual(nightsAround('KB.20231209.37031.94.fits', 0), ['20231209']);
  assert.deepEqual(nightsAround('KB.20231209.37031.94.fits', 1), ['20231208', '20231209', '20231210']);
  // A month boundary is a date, not a number.
  assert.deepEqual(nightsAround('N2.20240301.12345.fits', 1), ['20240229', '20240301', '20240302']);
  assert.throws(() => nightsAround('kb231209_00085.fits', 0), TypeError, 'an observatory name carries no night');
});

test('the pipeline runs with its own configuration and plotting off, or it does not run', () => {
  const shipped = ['[KCWI]', 'enable_bokeh = True', '# Plot level: 0 - no plots', 'plot_level = 1', 'TAPERFRAC = 0.2'].join('\n');
  const { text, changed } = configureWithoutPlots(shipped);
  assert.deepEqual(changed, { enable_bokeh: { shipped: 'True', used: 'False' }, plot_level: { shipped: '1', used: '0' } });
  assert.match(text, /^enable_bokeh = False$/mu);
  assert.match(text, /^plot_level = 0$/mu);
  assert.match(text, /^TAPERFRAC = 0\.2$/mu, 'every science parameter is the pipeline’s own');
  assert.equal(text.split('\n').length, shipped.split('\n').length, 'no line is added or dropped');
  // Only these two settings are touched, and only these two: a configuration this rule cannot find them in is refused rather
  // than run with a plot server.
  assert.deepEqual(Object.keys(PLOTS_OFF), ['enable_bokeh', 'plot_level']);
  assert.throws(() => configureWithoutPlots('[KCWI]\nplot_level = 1'), /states no enable_bokeh/u);
});

test('a run that started a plot server is a failed run, and the log is what says so', async () => {
  const log = join(await mkdtemp(join(tmpdir(), 'keck-')), 'reduce.log');
  await writeFile(log, '2026-09-19 01:17:04:KCWI:INFO: Framework initialized\n2026-09-19 01:17:04:KCWI:INFO: Ingesting file kb231209_00042.fits\n');
  assert.deepEqual(await assertNoPlotServer(log), { startedByThisRun: false, lines: 0 });
  await writeFile(log, '2026-09-19 01:17:04:KCWI:INFO: Enabling BOKEH plots\n');
  await assert.rejects(assertNoPlotServer(log), /started a plot server/u);
  for (const line of ['Starting bokeh server ...', 'Config requests bokeh server, checking if already running']) assert.match(line, PLOT_SERVER_LINES);
});

test('a target name is matched to a shipped object by its number, never by its bare name', () => {
  const shipped = new Set(['europa', 'europa-52', 'titan', 'psyche', 'm42']);
  assert.equal(matchShippedObject('Europa', shipped), 'europa');
  assert.equal(matchShippedObject('Europa___ 05-47', shipped), 'europa', 'a time stamp the observer glued on is dropped');
  assert.equal(matchShippedObject('Europa 21 13', shipped), 'europa', 'and so is a second one');
  assert.equal(matchShippedObject('titan_3H40', shipped), 'titan');
  assert.equal(matchShippedObject('M 42', shipped), 'm42', 'a name that is its own number is matched before anything is dropped');
  for (const typed of ['Europa 06:30UT', 'Europa UT 11-05', 'europa 04 15:00', 'Europa 270900', 'Europa UT'])
    assert.equal(matchShippedObject(typed, shipped), 'europa', typed);
  assert.deepEqual(nameCandidates('Europa 21 13'), ['EUROPA2113', 'EUROPA21', 'EUROPA'], 'longest first');
  assert.deepEqual(nameCandidates('2024'), ['2024'], 'nothing is dropped when only digits would be left');
  // An id that ends in a digit is matched whole before a digit is ever taken off it.
  assert.equal(matchShippedObject('WASP-43', new Set(['wasp-43', 'wasp'])), 'wasp-43');
  assert.equal(matchShippedObject('52 Europa', shipped), 'europa-52', '52 Europa is the asteroid, not the moon');
  assert.equal(matchShippedObject('195 Eurykleia', shipped), null, 'a numbered name matches no bare id');
  assert.equal(matchShippedObject('', shipped), null);
  assert.equal(normalise('M 42'), 'M42');
});

test('a mode counts as reduced only where a receipt names an observation a program pins', async () => {
  const { programs, receipts } = await pinnedEvidence();
  assert.ok(programs.some(entry => entry.instrument === 'KCWI' && entry.koaids.includes('KB.20231209.37031.94.fits')), 'the M42 program is pinned');
  for (const receipt of receipts) assert.ok(programs.some(entry => entry.instrument === receipt.instrument && entry.koaids.includes(receipt.koaid)),
    `${receipt.file} names an observation a program pins`);
});

test('every instrument KOA serves has a stated reduction state, and only the installed one can be re-run', () => {
  for (const table of INSTRUMENT_TABLES) {
    const rule = REDUCTION_STATE[table];
    assert.ok(rule && rule.reason.length > 40, `${table} says why it is where it is`);
    assert.equal(typeof rule.open, 'boolean');
  }
  assert.equal(REDUCTION_STATE.koa_osiris.open, false, 'the OSIRIS DRP is IDL');
  assert.equal(REDUCTION_STATE.koa_hires.open, false, 'PypeIt does not support keck_hires');
  assert.deepEqual(Object.keys(REDUCIBLE), ['KCWI']);
});

test('the reduction record names the frames it read, the channel, and the two settings it changed', () => {
  const parsed = parseKeckProgram(program());
  const inputs = [parsed.observations[0]!.science].map(pinnedInput);
  const made = reductionRun(parsed, parsed.observations[0]!, inputs,
    { channel: 'KB', command: ['kcwiReduce', '-g', '-b'], configuration: { source: 'kcwidrp/configs/kcwi.cfg', sha256: 'b'.repeat(64), changed: { enable_bokeh: { shipped: 'True', used: 'False' } } } },
    [{ name: 'kcwidrp', version: '1.3.1' }], 'c'.repeat(64));
  assert.equal(made.telescope, 'Keck');
  assert.equal(made.stage, 'kcwi-drp-group');
  assert.deepEqual(made.inputs.map(input => input.role), ['object']);
  assert.equal(made.toolchainDigest, 'c'.repeat(64));
  assert.equal((made.parameters as { channel: string }).channel, 'KB');
  // The same run is the same digest whatever order the inputs came in; a changed setting is a different run.
  const other = reductionRun(parsed, parsed.observations[0]!, [...inputs].reverse(),
    { channel: 'KB', command: ['kcwiReduce', '-g', '-b'], configuration: { source: 'kcwidrp/configs/kcwi.cfg', sha256: 'b'.repeat(64), changed: { enable_bokeh: { shipped: 'True', used: 'False' } } } },
    [{ name: 'kcwidrp', version: '1.3.1' }], 'c'.repeat(64));
  assert.equal(runDigest(made), runDigest(other));
  assert.notEqual(runDigest(made), runDigest({ ...made, parameters: { ...made.parameters, channel: 'KR' } }));
});

test('what the comparison establishes is tied to the exact product it checked', () => {
  const evidence = archiveAgreement('kb231209_00085_icubed.fits', 'tools/objects/keck/programs/m42.lev1-icubed.reproduction.json', '/KCWI/2023/20231209/lev1/redux/x_icubed.fits',
    { extensions: [{ extname: 'PRIMARY', identicalShare: 0.04095, correlation: 0.9597 }, { extname: 'MASK', identicalShare: 1, correlation: Number.NaN }],
      samePipelineVersion: false, versions: "ours 1.3.1, the archive's 1.0.2" });
  assert.equal(evidence.kind, 'archive-agreement');
  assert.equal(evidence.product, 'kb231209_00085_icubed.fits');
  // The kind says what was compared against; the text has to say what was found, or a reader takes the kind for a verdict.
  assert.match(evidence.establishes, /PRIMARY 4\.09% identical, correlation 0\.9597/u);
  assert.match(evidence.establishes, /MASK 100\.00% identical, correlation not defined/u);
  assert.match(evidence.establishes, /NOT written by the same version of the pipeline \(ours 1\.3\.1, the archive's 1\.0\.2\)/u);
  assert.match(evidence.establishes, /the difference is what this establishes, not agreement/u);
  assert.match(evidence.establishes, /nothing about either run's calibration being right/u);
});

test('a product is the stage of the requested observation, never the first file that ends the same way', async () => {
  // The reviewer's case: one run directory holding two nights' cubes. Both end in `_icubed.fits`, so a match on the stage
  // alone took whichever came first, and the December 9 cube was compared against a December 10 one without a word.
  const pinned = parseKeckProgram(program()).observations[0]!;
  const night10 = 'kb231210_00042_icubed.fits', night09 = 'kb231209_00085_icubed.fits';
  assert.equal(selectRunProduct([night10, night09], 'icubed', pinned), night09);
  assert.equal(selectRunProduct([night09, night10], 'icubed', pinned), night09, 'order in the listing decides nothing');
  assert.equal(selectRunProduct([night10], 'icubed', pinned), null, 'another night is not this observation’s product'.replace('’', "'"));
  assert.equal(selectRunProduct([night09, night10], '', pinned), null);
  // KOA's own id is accepted too, because which of the two names a pipeline writes under is the pipeline's choice.
  assert.equal(selectRunProduct(['KB.20231209.37031.94_icubed.fits'], 'icubed', pinned), 'KB.20231209.37031.94_icubed.fits');
  assert.deepEqual(productStems(pinned), ['kb231209_00085', 'KB.20231209.37031.94']);
  // Two files claiming to be the same stage of the same frame means the directory holds two runs, and that is refused.
  assert.throws(() => selectRunProduct([night09, `sub/${night09}`], 'icubed', pinned), /2 files that are its icubed stage/u);
});

test('a run directory of another program or observation is refused, not compared', async () => {
  const run = await mkdtemp(join(tmpdir(), 'keck-run-'));
  const write = async (value: unknown) => writeFile(join(run, 'run.json'), JSON.stringify(value));
  await assert.rejects(assertRunIsFor(run, 'm42-kcwi-2023b-u124', 'KB.20231209.37031.94.fits'), /holds no run.json/u);
  await write({ program: 'm42-kcwi-2023b-u124', koaid: 'KB.20231210.04100.00.fits', products: ['kb231210_00042_icubed.fits'] });
  await assert.rejects(assertRunIsFor(run, 'm42-kcwi-2023b-u124', 'KB.20231209.37031.94.fits'), /is the run of m42-kcwi-2023b-u124 KB\.20231210\.04100\.00\.fits/u);
  await write({ program: 'another-program', koaid: 'KB.20231209.37031.94.fits', products: [] });
  await assert.rejects(assertRunIsFor(run, 'm42-kcwi-2023b-u124', 'KB.20231209.37031.94.fits'), /is the run of another-program/u);
  await write({ program: 'm42-kcwi-2023b-u124', koaid: 'KB.20231209.37031.94.fits', products: ['kb231209_00085_icubed.fits'] });
  assert.deepEqual(await assertRunIsFor(run, 'm42-kcwi-2023b-u124', 'KB.20231209.37031.94.fits'), ['kb231209_00085_icubed.fits']);
});

test('a product with no record, or a record of another observation, is refused rather than compared', async () => {
  const pinned = parseKeckProgram(program()).observations[0]!;
  const redux = await mkdtemp(join(tmpdir(), 'keck-redux-'));
  const name = 'kb231209_00085_icubed.fits', cube = join(redux, name);
  const archiveProduct = { ...pinned.science, name: 'KB.20231209.37031.94_icubed.fits',
    filehand: '/KCWI/2023/20231209/lev1/redux/KB.20231209.37031.94_icubed.fits', level: 'lev1' } as Parameters<typeof runProduct>[1];
  await writeFile(cube, 'not really a cube');
  assert.equal(await runProduct(redux, archiveProduct, ['kb231210_00042_icubed.fits'], pinned), null, 'another night is simply absent');
  await assert.rejects(runProduct(redux, archiveProduct, [name], pinned), /has no product record beside it/u);
  const record = (overrides: Record<string, unknown> = {}) => ({ schema: 'cssearth-telescope-product@1', telescope: 'Keck', stage: 'kcwi-drp-group',
    inputs: [{ role: 'object', identity: pinned.science.name, bytes: pinned.science.bytes, sha256: pinned.science.sha256 }],
    parameters: { koaid: pinned.koaid }, software: [{ name: 'kcwidrp', version: '1.3.1' }],
    outputs: [{ path: name, bytes: 17, sha256: 'b'.repeat(64) }], evidence: [], ...overrides });
  const put = async (value: unknown) => writeFile(`${cube}.product.json`, JSON.stringify(value));
  await put(record({ parameters: { koaid: 'KB.20231210.04100.00.fits' } }));
  await assert.rejects(runProduct(redux, archiveProduct, [name], pinned), /was made from KB\.20231210\.04100\.00\.fits, not from KB\.20231209\.37031\.94\.fits/u);
  await put(record({ inputs: [{ role: 'bias', identity: 'KB.20231209.20185.51.fits', bytes: 10166400, sha256: 'a'.repeat(64) }] }));
  await assert.rejects(runProduct(redux, archiveProduct, [name], pinned), /was not made from the pinned raw frame/u);
  await put(record());
  assert.equal(await runProduct(redux, archiveProduct, [name], pinned), cube);
});
