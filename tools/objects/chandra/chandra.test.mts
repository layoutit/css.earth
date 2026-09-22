import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addProductEvidence, evidenceFor, productRecordPath, readProductRecord, runDigest, writeProductRecord } from '../product-record.mts';
import { observationMode, obsidDirectory, parseChandraProgram, PROGRAMS, refuseObservation, REFUSED_MODES } from './archive.mts';
import { isObjectPointing, LEDGER, ledgerGuide, GUIDE, modeKey, objectBox, OBJECT_RADIUS_DEGREES, MOVING_TARGETS, pinnedState } from './archive-ledger.mts';
import { archiveAgreement, compareBinnedImage, eventKeys, matchEvents, reprocessedWith } from './compare.mts';
import { column, eventTable, requireEventColumn, scalar } from './events.mts';
import { reprocessParameters, reprocessRun, writeReprocessRecord } from './reprocess.mts';
import { discRegistration, freezeRun } from './solar-system.mts';

const BLOCK = 2880, CARD = 80;
const card = (key: string, value: string) => `${key.padEnd(8)}= ${value}`.padEnd(CARD).slice(0, CARD);
const pad = (bytes: Buffer) => Buffer.concat([bytes, Buffer.alloc((BLOCK - bytes.length % BLOCK) % BLOCK)]);
const headerBlock = (cards: readonly string[]) => {
  const text = [...cards, 'END'.padEnd(CARD)].join('');
  return Buffer.from(text.padEnd(Math.ceil(text.length / BLOCK) * BLOCK, ' '), 'latin1');
};

/** A small ACIS-shaped event list: the columns a comparison keys on and reads, including the 32-bit status column the shared
 * table reader does not cover. */
interface SyntheticEvent { time: number; ccd_id: number; expno: number; chipx: number; chipy: number; x: number; y: number; energy: number; pi: number; status: number }
function eventFile(rows: readonly SyntheticEvent[], extra: readonly string[] = []) {
  const columns: [string, string, number][] = [['time', '1D', 8], ['ccd_id', '1I', 2], ['expno', '1J', 4], ['chipx', '1I', 2], ['chipy', '1I', 2],
    ['x', '1E', 4], ['y', '1E', 4], ['energy', '1E', 4], ['pi', '1J', 4], ['status', '32X', 4]];
  const rowBytes = columns.reduce((total, [, , bytes]) => total + bytes, 0);
  const primary = headerBlock([card('SIMPLE', 'T'), card('BITPIX', '8'), card('NAXIS', '0'), card('EXTEND', 'T')]);
  const cards = [card('XTENSION', "'BINTABLE'"), card('BITPIX', '8'), card('NAXIS', '2'), card('NAXIS1', String(rowBytes)),
    card('NAXIS2', String(rows.length)), card('PCOUNT', '0'), card('GCOUNT', '1'), card('TFIELDS', String(columns.length)),
    card('EXTNAME', "'EVENTS  '"), ...extra];
  columns.forEach(([name, form], index) => { cards.push(card(`TTYPE${index + 1}`, `'${name.padEnd(8)}'`), card(`TFORM${index + 1}`, `'${form.padEnd(8)}'`)); });
  const data = Buffer.alloc(rows.length * rowBytes);
  rows.forEach((row, index) => {
    let at = index * rowBytes;
    data.writeDoubleBE(row.time, at); at += 8;
    data.writeInt16BE(row.ccd_id, at); at += 2;
    data.writeInt32BE(row.expno, at); at += 4;
    data.writeInt16BE(row.chipx, at); at += 2;
    data.writeInt16BE(row.chipy, at); at += 2;
    data.writeFloatBE(row.x, at); at += 4;
    data.writeFloatBE(row.y, at); at += 4;
    data.writeFloatBE(row.energy, at); at += 4;
    data.writeInt32BE(row.pi, at); at += 4;
    data.writeUInt32BE(row.status, at);
  });
  return Buffer.concat([primary, headerBlock(cards), pad(data)]);
}
const event = (overrides: Partial<SyntheticEvent> = {}): SyntheticEvent =>
  ({ time: 135198945.4, ccd_id: 3, expno: 1, chipx: 100, chipy: 200, x: 4000, y: 4100, energy: 1000, pi: 70, status: 0, ...overrides });

test('an event list reads its scalar columns, including the 32-bit status column', () => {
  const bytes = eventFile([event(), event({ expno: 2, chipx: 101, status: 0x80000001, pi: 71, x: 4001.5 })]);
  const table = eventTable(bytes);
  assert.equal(table.rows, 2);
  assert.equal(table.rowBytes, 38);
  assert.equal(requireEventColumn(table, 'status').repeat, 32);
  assert.equal(requireEventColumn(table, 'status').bytes, 4);
  assert.deepEqual([...column(bytes, table, 'status')], [0, 0x80000001]);
  assert.deepEqual([...column(bytes, table, 'ccd_id')], [3, 3]);
  assert.deepEqual([...column(bytes, table, 'pi')], [70, 71]);
  assert.equal(scalar(bytes, table, 1, requireEventColumn(table, 'x')), 4001.5);
  assert.throws(() => requireEventColumn(table, 'chip_id'), /no chip_id column/u);
});

test('an event list that states a TSCAL is refused, because an event list carries none', () => {
  assert.throws(() => eventTable(eventFile([event()], [card('TSCAL9', '2.0')])), /TSCAL or TZERO/u);
});

test('the same event keys the same in both lists, whatever range each list happens to span', () => {
  // The re-run's list holds an event on ccd 1 that the archive's does not, so the two lists span different values. A key packed
  // from each list's own bounds would then key the shared events differently, and half of them would not match.
  const shared = [event({ ccd_id: 3, expno: 5, chipx: 100, chipy: 200 }), event({ ccd_id: 3, expno: 9, chipx: 301, chipy: 402 })];
  const ours = { bytes: eventFile([...shared, event({ ccd_id: 1, expno: 2, chipx: 7, chipy: 9 })]), table: undefined as unknown as ReturnType<typeof eventTable> };
  const theirs = { bytes: eventFile(shared), table: undefined as unknown as ReturnType<typeof eventTable> };
  ours.table = eventTable(ours.bytes);
  theirs.table = eventTable(theirs.bytes);
  const [ourKeys, theirKeys] = eventKeys([ours, theirs], ['ccd_id', 'expno', 'chipx', 'chipy']) as [Float64Array, Float64Array];
  assert.equal(ourKeys[0], theirKeys[0]);
  assert.equal(ourKeys[1], theirKeys[1]);
  const match = matchEvents(ourKeys, theirKeys, ['ccd_id', 'expno', 'chipx', 'chipy']);
  assert.equal(match.ourRows.length, 2);
  assert.equal(match.onlyOurs, 1);
  assert.equal(match.onlyArchive, 0);
});

test('events are matched on what the instrument telemetered, and a repeated key is refused', () => {
  const ours = Float64Array.from([10, 20, 30, 40]), theirs = Float64Array.from([20, 30, 50]);
  const match = matchEvents(ours, theirs, ['ccd_id', 'expno', 'chipx', 'chipy']);
  assert.deepEqual(match.ourRows, [1, 2]);
  assert.deepEqual(match.theirRows, [0, 1]);
  assert.equal(match.onlyOurs, 2);
  assert.equal(match.onlyArchive, 1);
  assert.throws(() => matchEvents(Float64Array.from([10, 10]), Float64Array.from([10]), ['chipx']), /the re-run's list repeats one/u);
  assert.throws(() => matchEvents(Float64Array.from([10]), Float64Array.from([10, 10]), ['chipx']), /the archive's list repeats one/u);
});

test('two identical event lists bin to the same counts image', () => {
  const xs = Float64Array.from([4000, 4000, 4008, 5000]), ys = Float64Array.from([4100, 4100, 4108, 5000]);
  const same = compareBinnedImage(xs, ys, xs, ys);
  assert.equal(same.counts.ours, 4);
  assert.equal(same.counts.archive, 4);
  assert.equal(same.identicalShare, 1);
  assert.equal(same.largestBinDifference, 0);
  assert.equal(same.totalAbsoluteBinDifference, 0);
  // One event moved a long way lands in another bin: the bin it left and the bin it reached each differ by one count.
  const moved = compareBinnedImage(Float64Array.from([4000, 4000, 4008, 4000]), Float64Array.from([4100, 4100, 4108, 5000]), xs, ys);
  assert.equal(moved.counts.ours, 4);
  assert.equal(moved.largestBinDifference, 1);
  assert.equal(moved.totalAbsoluteBinDifference, 2);
});

const file = (path: string, bytes = 1000) => ({ path, url: `${obsidDirectory(2798)}/${path}`, bytes });
const program = (overrides: Record<string, unknown> = {}) => ({
  schema: 'cssearth-chandra-program@1', id: 'test', target: 'CRAB NEBULA HALO',
  observations: [{ obsid: 2798, instrument: 'ACIS', detector: 'ACIS-0123', grating: 'NONE', readMode: 'TIMED', dataMode: 'FAINT',
    targetName: 'CRAB NEBULA HALO', proposalNumber: '03500419', sequenceNumber: '500248', startDate: '2002-04-14T18:59:35',
    startMet: 135198038.89914, stopMet: 135220053.33754, livetimeSeconds: 19980.293821463, catalogueExposureSeconds: 19980.293821463, datasetDoi: '10.25574/02798', ascdsVersion: '10.9.4',
    processing: { CTI_CORR: 'T', RAND_PI: '1.0' },
    inputs: [file('secondary/acisf02798_002N004_evt1.fits.gz'), file('primary/acisf02798_002N004_bpix1.fits.gz')],
    products: [file('primary/acisf02798N004_evt2.fits.gz')] }],
  ...overrides,
});
const observation = (overrides: Record<string, unknown> = {}) => program({ observations: [{ ...program().observations[0], ...overrides }] });

test('a program pins level-1 inputs and the archive’s level-2 products, and refuses anything else', () => {
  const parsed = parseChandraProgram(program());
  assert.equal(parsed.observations[0]?.obsid, 2798);
  assert.equal(parsed.observations[0]?.inputs.length, 2);
  assert.throws(() => parseChandraProgram(observation({ inputs: [file('primary/acisf02798_002N004_bpix1.fits.gz')] })), /pins the level-1 event list/u);
  assert.throws(() => parseChandraProgram(observation({ products: [] })), /pins the archive's level-2 event list/u);
  assert.throws(() => parseChandraProgram(observation({ inputs: [...observation().observations[0]!.inputs, file('primary/acisf02798N004_evt2.fits.gz')] })),
    /level-2 product is pinned as an input/u);
  assert.throws(() => parseChandraProgram(observation({ products: [file('primary/acisf02798N004_evt2.fits.gz'), file('secondary/acisf02798_002N004_flt1.fits.gz')] })),
    /products are the archive's level-2 products/u);
  // A file the archive does not keep under the obsid, and a file pinned twice.
  assert.throws(() => parseChandraProgram(observation({ inputs: [{ path: 'elsewhere/evt1.fits.gz', url: 'https://example.invalid/evt1.fits.gz', bytes: 1 }] })), /Invalid archive file/u);
  assert.throws(() => parseChandraProgram(observation({ inputs: [file('secondary/acisf02798_002N004_evt1.fits.gz'), file('secondary/acisf02798_002N004_evt1.fits.gz')] })), /appears twice/u);
  assert.throws(() => parseChandraProgram(observation({ livetimeSeconds: 1e6 })), /livetime does not fit/u);
  assert.throws(() => parseChandraProgram({ ...program(), schema: 'cssearth-chandra-program@2' }), /Unsupported Chandra program/u);
});



test('the Crab halo program pins obsid 2798 with every file digested', async () => {
  const pinned = parseChandraProgram(JSON.parse(await readFile(join(PROGRAMS, 'm1-crab-halo.json'), 'utf8')));
  const [entry] = pinned.observations;
  assert.equal(entry?.obsid, 2798);
  assert.equal(entry?.instrument, 'ACIS');
  assert.equal(entry?.detector, 'ACIS-0123');
  assert.equal(entry?.dataMode, 'FAINT');
  assert.equal(entry?.grating, 'NONE');
  assert.equal(entry?.datasetDoi, '10.25574/02798');
  assert.ok(entry!.inputs.some(input => /_evt1\.fits\.gz$/u.test(input.path)), 'the level-1 event list is pinned');
  assert.ok([...entry!.inputs, ...entry!.products].every(input => /^[0-9a-f]{64}$/u.test(input.sha256 ?? '')), 'every file is pinned by digest');
});

test('the Crab halo re-run keeps every archive event and places it within half a sky pixel', async () => {
  const receipt = JSON.parse(await readFile(join(PROGRAMS, 'm1-crab-halo.acisf02798N004_evt2.reproduction.json'), 'utf8')) as {
    events: { archive: number; matched: number; onlyArchive: number; onlyOurs: number };
    sky: { identicalShare: number; skyPixels: { p99: number; largest: number } };
    binnedImage: { identicalShare: number; largestBinDifference: number };
    columns: { column: string; identicalShare: number; absoluteDifference: { largest: number } }[];
    columnsOnOneSide: string[]; differentCards: Record<string, unknown>; reprocessedWith: { caldb: string } };
  assert.equal(receipt.events.matched, receipt.events.archive, 'every archive event is matched');
  assert.equal(receipt.events.onlyArchive, 0, 'the re-run drops no event the archive kept');
  assert.ok(receipt.events.onlyOurs < receipt.events.archive / 1000, `the re-run adds ${receipt.events.onlyOurs} events`);
  assert.deepEqual(receipt.columnsOnOneSide, [], 'both lists hold the same columns');
  // What the instrument telemetered, and the status bits, come through untouched.
  for (const name of ['time', 'node_id', 'tdetx', 'tdety', 'pha_ro', 'status'])
    assert.equal(receipt.columns.find(entry => entry.column === name)?.identicalShare, 1, name);
  assert.ok(receipt.sky.skyPixels.largest < 0.5, `sky positions move at most ${receipt.sky.skyPixels.largest} pixels`);
  assert.ok(receipt.binnedImage.largestBinDifference <= 1, 'no binned sky block differs by more than one count');
  assert.ok(receipt.binnedImage.identicalShare > 0.999, `${receipt.binnedImage.identicalShare} of the binned blocks agree`);
  // The re-run is on a later CIAO and CALDB than the archive's product, which is what the receipt is for, and it makes its own
  // bad-pixel list and good-time filter; nothing else in the two headers differs.
  assert.equal(receipt.reprocessedWith.caldb, '4.12.4');
  assert.deepEqual(Object.keys(receipt.differentCards).sort(), ['ASCDSVER', 'BPIXFILE', 'FLTFILE']);
});

/** The pinned observation with every input digested, as reprocess.mts has it once the files are on disk. */
const digested = () => {
  const entry = parseChandraProgram(program()).observations[0]!;
  return { ...entry, inputs: entry.inputs.map((input, index) => ({ ...input, sha256: String(index).repeat(64) })) };
};
/** A reprocessing run's own account of itself, written as that run writes it: the products it made, and no evidence. Nothing
 * here runs CIAO; what is under test is which environment the record carries, not what chandra_repro does. */
const reprocessed = async (versions: { ciao: string; caldb: string }) => {
  const directory = await mkdtemp(join(tmpdir(), 'chandra-reprocess-')), level2 = 'acisf02798_repro_evt2.fits';
  await writeFile(join(directory, level2), eventFile([event()]));
  const { parameters } = reprocessParameters('NONE', 2 * 2 ** 30);
  const run = reprocessRun(digested(), { parameters, versions, toolchainDigest: 'c'.repeat(64) });
  return { directory, level2, record: await writeReprocessRecord(directory, level2, [level2], run) };
};

test('the record beside a re-run event list carries the CIAO and CALDB of the run, not of the machine comparing it', async () => {
  const ran = { ciao: 'CIAO 4.18.0 Monday, December 08, 2025', caldb: '4.12.4' };
  const { directory, level2, record } = await reprocessed(ran);
  assert.equal(record, join(directory, productRecordPath(level2)));
  const stored = (await readProductRecord(record))!;
  assert.equal(stored.telescope, 'Chandra');
  assert.equal(stored.stage, 'reprocess/2798-ACIS');
  assert.deepEqual(stored.software, [{ name: 'ciao', version: ran.ciao }, { name: 'caldb', version: ran.caldb }]);
  assert.equal(stored.inputs.find(input => input.role === 'level-1 event list')?.identity, `${obsidDirectory(2798)}/secondary/acisf02798_002N004_evt1.fits.gz`);
  assert.equal(stored.parameters.check_vf_pha, 'no', 'what chandra_repro was told is what the record states');
  assert.equal(stored.parameters.tg_zo_position, undefined, 'an imaging observation is given no zero-order option');
  assert.deepEqual(stored.evidence, [], 'the run that makes a product claims no evidence about it');
  assert.equal(stored.outputs[0]?.conventions?.time, 'mission elapsed seconds, the scale the header TSTART and TSTOP are on');
  // The comparison runs years later, on another machine, with another CIAO and CALDB installed. It reports the run's.
  const installedHere = { ciao: 'CIAO 4.21.0 Tuesday, June 02, 2029', caldb: '4.14.1' };
  const made = reprocessedWith(stored, level2, record);
  assert.deepEqual({ ciao: made.ciao, caldb: made.caldb }, ran);
  assert.notDeepEqual({ ciao: made.ciao, caldb: made.caldb }, installedHere);
  assert.deepEqual(reprocessParameters('HETG', 1).chandraRepro.tg_zo_position, 'detect', 'a dispersed observation finds its own zero order');
});

test('a comparison with no product record beside the event list refuses instead of guessing the environment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chandra-compare-')), level2 = 'acisf02798_repro_evt2.fits';
  await writeFile(join(directory, level2), eventFile([event()]));
  const record = productRecordPath(join(directory, level2));
  assert.equal(await readProductRecord(record), null, 'an event list from a run that wrote no record');
  assert.throws(() => reprocessedWith(null, level2, record), /has no product record/u);
  // A record that states one of the two is refused the same way: half an environment is not the run's environment.
  const written = await reprocessed({ ciao: 'CIAO 4.18.0', caldb: '4.12.4' });
  const stored = (await readProductRecord(written.record))!;
  assert.throws(() => reprocessedWith({ ...stored, software: stored.software.filter(entry => entry.name !== 'caldb') }, level2, record), /states no caldb version/u);
});

test('the comparison leaves archive-agreement evidence naming the exact product it checked', async () => {
  const { directory, level2, record } = await reprocessed({ ciao: 'CIAO 4.18.0', caldb: '4.12.4' });
  const receipt = 'tools/objects/chandra/programs/m1-crab-halo.acisf02798N004_evt2.reproduction.json';
  const locate = (name: string) => join(directory, name);
  const updated = await addProductEvidence(record, [archiveAgreement(level2, receipt, 'primary/acisf02798N004_evt2.fits.gz')], locate);
  const [agreement] = evidenceFor(updated, level2, 'archive-agreement');
  assert.equal(agreement?.product, level2);
  assert.equal(agreement?.receipt, receipt);
  assert.match(agreement?.establishes ?? '', /matched event for event against the archive's own level-2 event list \(primary\/acisf02798N004_evt2\.fits\.gz\)/u);
  assert.match(agreement?.establishes ?? '', /nothing about either run's calibration being right/u);
  assert.equal(evidenceFor(updated, level2, 'internal-consistency').length, 0, 'agreement with the archive is not consistency with ourselves');
  await assert.rejects(addProductEvidence(record, [archiveAgreement('acisf02798_repro_evt1.fits', receipt, 'primary/acisf02798N004_evt2.fits.gz')], locate),
    /did not produce/u, 'evidence about a file this run did not write is refused');
});

test('a grating observation is refused at the pin, and an imaging one is not', () => {
  assert.match(refuseObservation({ grating: 'HETG' }) ?? '', /zero-order position/u);
  assert.match(refuseObservation({ grating: 'LETG' }) ?? '', /No sources detected/u);
  assert.equal(refuseObservation({ grating: 'NONE' }), null);
  assert.equal(Object.keys(REFUSED_MODES).length, 1);
});

test('a background, blank-sky or calibration pointing is never an observation of an object', () => {
  for (const name of ['COLDECSBLANKSKY', 'ACIS BACKGROUND', 'M31 OFFSET', 'HRC-I DARK', 'CALIBRATION FIELD'])
    assert.equal(isObjectPointing(name), false, name);
  for (const name of ['CRABNEBULAHALO', 'M31', 'JUPITER', 'Polaris', 'PSRB0531+21'])
    assert.equal(isObjectPointing(name), true, name);
});

test('a search box is that many degrees on the sky, not that many degrees of right ascension', () => {
  const equator = objectBox({ id: 'a', raDeg: 100, decDeg: 0, source: 't' });
  assert.ok(Math.abs(equator.raHigh - equator.raLow - 2 * OBJECT_RADIUS_DEGREES) < 1e-9);
  const polar = objectBox({ id: 'b', raDeg: 100, decDeg: 60, source: 't' });
  assert.ok(polar.raHigh - polar.raLow > 1.9 * (equator.raHigh - equator.raLow), 'the box widens towards the pole');
  assert.equal(polar.decHigh - polar.decLow, 2 * OBJECT_RADIUS_DEGREES);
  assert.throws(() => objectBox({ id: 'jupiter', source: 't' }), /right ascension/u);
});

test('the checked-in ledger agrees with the pinned programs and the receipts beside them', async () => {
  const ledger = JSON.parse(await readFile(LEDGER, 'utf8')) as { schema: string; archive: { archivedObservations: number; byInstrument: Record<string, number> };
    shippedObjects: Record<string, { matchedBy: string; observations: number }>; modes: Record<string, { state: string; program?: string; obsid?: number; why?: string }> };
  assert.equal(ledger.schema, 'cssearth-chandra-ledger@1');
  assert.equal(ledger.archive.archivedObservations, Object.values(ledger.archive.byInstrument).reduce((total, value) => total + value, 0));
  const files = new Set(await (await import('node:fs/promises')).readdir(PROGRAMS));
  for (const [key, entry] of Object.entries(ledger.modes)) {
    if (entry.state === 'refused') { assert.ok(Object.values(REFUSED_MODES).includes(entry.why ?? ''), `${key} states a reason archive.mts does not`); continue; }
    assert.ok(files.has(`${entry.program}.json`), `${key} names a program that is not pinned: ${entry.program}`);
    const program = parseChandraProgram(JSON.parse(await readFile(join(PROGRAMS, `${entry.program}.json`), 'utf8')));
    assert.ok(program.observations.some(other => other.obsid === entry.obsid), `${key} names an obsid ${entry.program} does not pin`);
    if (entry.state === 'reproduced') assert.ok([...files].some(name => name.startsWith(`${entry.program}.`) && name.endsWith('.reproduction.json')), `${key} is reproduced with no receipt`);
  }
  // Every mode a program pins is in the ledger, so a new program cannot be added without the ledger being rebuilt.
  for (const file of [...files].filter(name => name.endsWith('.json') && name.split('.').length === 2)) {
    const program = parseChandraProgram(JSON.parse(await readFile(join(PROGRAMS, file), 'utf8')));
    for (const entry of program.observations)
      assert.ok(Object.values(ledger.modes).some(mode => mode.obsid === entry.obsid), `obsid ${entry.obsid} is pinned but absent from the ledger`);
  }
  // Moving targets are matched by name, everything else by position.
  for (const [id, entry] of Object.entries(ledger.shippedObjects))
    assert.equal(entry.matchedBy, MOVING_TARGETS[id] ? 'target name' : 'sky position', id);
});

test('the checked-in guide is the one the ledger generates', async () => {
  const ledger = JSON.parse(await readFile(LEDGER, 'utf8')) as Parameters<typeof ledgerGuide>[0];
  assert.equal(await readFile(GUIDE, 'utf8'), ledgerGuide(ledger), 'run node tools/objects/chandra/archive-ledger.mts');
});

test('Jupiter reproduces event for event on HRC-I, and its disc lands in the object-centred frame', async () => {
  const receipt = JSON.parse(await readFile(join(PROGRAMS, 'jupiter-hrci.hrcf18676N003_evt2.reproduction.json'), 'utf8')) as {
    events: { ours: number; archive: number; matched: number; onlyOurs: number; onlyArchive: number }; columns: { column: string; identicalShare: number }[] };
  assert.equal(receipt.events.matched, receipt.events.archive);
  assert.equal(receipt.events.onlyArchive, 0);
  assert.equal(receipt.events.onlyOurs, 0, 'the HRC re-run keeps exactly the archive’s events');
  for (const name of ['chip_id', 'pha', 'pi', 'status', 'x', 'tdetx', 'tdety'])
    assert.equal(receipt.columns.find(entry => entry.column === name)?.identicalShare, 1, name);

  const frozen = JSON.parse(await readFile(join(PROGRAMS, 'jupiter-hrci.18676.solar-system.json'), 'utf8')) as {
    horizons: { observer: string; centreBody: string; angularDiameterArcseconds: number; motionArcseconds: number };
    objectCentred: { enclosed: Record<string, { excess: number }> }; fixedSky: { enclosed: Record<string, { excess: number }> } };
  assert.equal(frozen.horizons.observer, '500@-151');
  assert.match(frozen.horizons.centreBody, /Chandra/u);
  // Jupiter drifts further than its own diameter during the exposure, so the fixed-sky list is smeared and the frozen one is not.
  assert.ok(frozen.horizons.motionArcseconds > frozen.horizons.angularDiameterArcseconds, 'the body moves further than its diameter');
  assert.ok(frozen.objectCentred.enclosed.r1!.excess > 4 * frozen.fixedSky.enclosed.r1!.excess,
    `the object-centred frame concentrates the source: ${frozen.objectCentred.enclosed.r1!.excess} against ${frozen.fixedSky.enclosed.r1!.excess}`);
});

test('a mode with no read mode is the plain mode, and a receipt written before that is still the one it names', async () => {
  const hrc = { instrument: 'HRC', detector: 'HRC-I', grating: 'NONE', dataMode: 'OBSERVING' };
  assert.equal(observationMode(hrc), 'OBSERVING', 'a detector that states no read mode names no read mode');
  assert.equal(observationMode({ ...hrc, readMode: 'TIMED' }), 'TIMED/OBSERVING');
  assert.equal(modeKey(hrc), 'HRC-I no grating OBSERVING');
  // The committed HRC receipt says undefined/OBSERVING, from the template this replaced. It is left as it was written, so the
  // ledger accepts both spellings and Jupiter stays reproduced; any other mode is still refused.
  const committed = JSON.parse(await readFile(join(PROGRAMS, 'jupiter-hrci.hrcf18676N003_evt2.reproduction.json'), 'utf8')) as { dataMode: string };
  assert.equal(committed.dataMode, 'undefined/OBSERVING');
  const state = await pinnedState();
  assert.deepEqual(state.problems, [], 'every committed receipt is accepted');
  assert.ok(state.reproduced.has('jupiter-hrci|18676'), 'the HRC observation is proved by its own receipt');
});

test('the object-centred list records the environment that froze it, and its receipt refuses a list that has none', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chandra-freeze-')), frozen = '18676_frozen_evt2.fits';
  const entry = digested(), ran = { ciao: 'CIAO 4.18.0 Monday, December 08, 2025', caldb: '4.12.4' };
  const files = { archive: entry.products[0]!, orbit: { ...file('primary/orbitf441_eph1.fits'), sha256: 'a'.repeat(64) },
    body: { ...file('primary/jupiterf441_eph1.fits'), sha256: 'b'.repeat(64) }, aspect: { ...file('primary/pcadf441_asol1.fits'), sha256: 'c'.repeat(64) } };
  const run = freezeRun(entry, { ...files, archive: { ...files.archive, sha256: 'd'.repeat(64) } }, { versions: ran, toolchainDigest: 'e'.repeat(64) });
  assert.equal(run.stage, 'sso-freeze/2798-ACIS');
  assert.deepEqual(run.inputs.map(input => input.role), ['archive level-2 event list', 'spacecraft orbit ephemeris', 'body ephemeris', 'aspect solution']);
  assert.deepEqual(run.software, [{ name: 'ciao', version: ran.ciao }, { name: 'caldb', version: ran.caldb }]);
  // An undigested input is not a pin, and another ephemeris is another frame, so it is another run.
  assert.throws(() => freezeRun(entry, files, { versions: ran, toolchainDigest: 'e'.repeat(64) }), /without a digest/u);
  assert.notEqual(runDigest(freezeRun(entry, { ...files, archive: { ...files.archive, sha256: 'd'.repeat(64) }, body: { ...files.body, sha256: 'f'.repeat(64) } },
    { versions: ran, toolchainDigest: 'e'.repeat(64) })), runDigest(run));

  await writeFile(join(directory, frozen), eventFile([event()]));
  const record = productRecordPath(join(directory, frozen));
  assert.throws(() => reprocessedWith(null, frozen, record), /has no product record/u, 'a frozen list with no record is not measured');
  await writeProductRecord(record, run, [{ path: frozen, file: join(directory, frozen) }]);
  const froze = reprocessedWith(await readProductRecord(record), frozen, record);
  assert.deepEqual({ ciao: froze.ciao, caldb: froze.caldb }, ran, 'the receipt states the run that froze the list, not this machine');
  const updated = await addProductEvidence(record, [discRegistration(frozen, 'tools/objects/chandra/programs/jupiter-hrci.18676.solar-system.json', 38.42)], name => join(directory, name));
  const [landed] = evidenceFor(updated, frozen, 'geometric-registration');
  assert.match(landed?.establishes ?? '', /38\.42 arcsecond disc JPL Horizons gives/u);
  assert.match(landed?.establishes ?? '', /nothing about the events being calibrated/u);
  assert.equal(evidenceFor(updated, frozen, 'archive-agreement').length, 0, 'landing where Horizons says is not agreement with the archive');
});

test('a frozen-frame receipt proves only the observation it names, and one that cannot be read is reported', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chandra-frozen-')), receipt = (overrides: Record<string, unknown> = {}) => ({
    schema: 'cssearth-chandra-solar-system@2', program: 'test', obsid: 2798, target: 'CRAB NEBULA HALO',
    horizons: { angularDiameterArcseconds: 38.42 }, objectCentred: { file: 'acisf02798_repro_evt2.fits' }, ...overrides });
  await writeFile(join(directory, 'test.json'), `${JSON.stringify(program())}\n`);
  const state = async () => pinnedState(directory);
  await writeFile(join(directory, 'test.2798.solar-system.json'), `${JSON.stringify(receipt())}\n`);
  assert.deepEqual((await state()).problems, []);
  assert.ok((await state()).frozen.has('test|2798'));
  // The receipt committed before the schema gained its second version still proves its own observation.
  await writeFile(join(directory, 'test.2798.solar-system.json'), `${JSON.stringify(receipt({ schema: 'cssearth-chandra-solar-system@1' }))}\n`);
  assert.ok((await state()).frozen.has('test|2798'));
  for (const [what, broken] of [['another target', receipt({ target: 'JUPITER' })], ['another schema', receipt({ schema: 'cssearth-chandra-frozen@1' })],
    ['no measurement', receipt({ objectCentred: undefined })], ['no disc', receipt({ horizons: { angularDiameterArcseconds: 0 } })]] as const) {
    await writeFile(join(directory, 'test.2798.solar-system.json'), `${JSON.stringify(broken)}\n`);
    const held = await state();
    assert.equal(held.frozen.size, 0, `${what} proves no frozen frame`);
    assert.equal(held.problems.length, 1, what);
  }
  await writeFile(join(directory, 'test.2798.solar-system.json'), 'not json at all\n');
  const unreadable = await state();
  assert.equal(unreadable.frozen.size, 0, 'a receipt that does not parse is not a check');
  assert.match(unreadable.problems[0] ?? '', /test\.2798\.solar-system\.json/u);
});
