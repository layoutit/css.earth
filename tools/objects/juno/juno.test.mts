import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { kernelBankRoot } from '../../spice/kernel-bank.mts';
import { evidenceFor, productRecordPath, readProductRecord, writeProductRecord } from '../product-record.mts';
import { FILTER_COMBINATIONS, INDEX_COLUMNS, PROGRAM_SCHEMA, PROGRAMS, colourImages, indexNumber, parseIndex, parseIndexLine, parseProductId, parseProgram, pinProgram } from './archive.mts';
import { GUIDE, LEDGER, SCHEMA, castingObjects, holdings, ledgerGuide, matchShippedObject, measuredPrograms, objectStates, shippedObjects, type Ledger } from './archive-ledger.mts';
import { POLICY, RECEIPT_SCHEMA, addRegistrationEvidence, ellipsoidMesh, registrationRun, registrationSoftware } from './measure.mts';

// Two lines of JNOJNC_0024/INDEX/INDEX.TAB as the PDS serves them, and a methane image made from the second.
const EUROPA = '"JNOJNC_0024","JUNOCAM-RDR","JUNO-J-JUNOCAM-3-RDR-L1A-V1.0","JNCR_2022272_45C00001_V01",2022-09-29T09:38:05.691,2022-09-29T09:38:16.079,"3                  ","Europa                                                                                                         ",7.4133e+08 <km> ,1515.1 <km>          ,11.7571                  ,0.3597                    ,"EUROPA     ","DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01.LBL",2023-02-02T20:23:40,"5a1c0c3d0e0f4a8a9b0c1d2e3f405162"';
const RAW = EUROPA.replace('JUNOCAM-RDR', 'JUNOCAM-EDR').replace('-3-RDR-L1A-', '-2-EDR-L0-').replaceAll('JNCR_', 'JNCE_').replace('/RDR/', '/EDR/');
const METHANE = EUROPA.replaceAll('45C00001', '45M00007').replace('1515.1 <km>', '9000.0 <km>');
const rows = parseIndex([EUROPA, RAW, METHANE, ''].join('\r\n'));

test('an index line keeps its sixteen fields, a quoted comma and its units', () => {
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0]!.PRODUCT_ID, rows[0]!.TARGET_NAME, rows[0]!.START_TIME, rows[0]!.FILE_SPECIFICATION_NAME], ['JNCR_2022272_45C00001_V01', 'EUROPA', '2022-09-29T09:38:05.691', 'DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01.LBL']);
  assert.equal(indexNumber(rows[0]!.SPACECRAFT_ALTITUDE), 1515.1); assert.equal(indexNumber('N/A'), null);
  assert.equal(parseIndexLine(EUROPA.replace('"Europa ', '"Europa, leaving ')).RATIONALE_DESC.startsWith('Europa, leaving'), true);
  assert.throws(() => parseIndexLine(EUROPA.split(',').slice(0, 12).join(',')), new RegExp(`not ${INDEX_COLUMNS.length}`, 'u'));
});

test('a product id states its type, orbit and filter combination, and only calibrated colour images are pinned', () => {
  assert.deepEqual(parseProductId('JNCR_2022272_45C00001_V01'), { type: 'RDR', year: 2022, dayOfYear: 272, orbit: 45, filterCombination: 'C', index: 1, version: 1 });
  assert.equal(parseProductId('JNCE_2013282_00A00002_V01').type, 'EDR'); assert.deepEqual(FILTER_COMBINATIONS.A, ['RED', 'GREEN', 'BLUE', 'METHANE']);
  assert.throws(() => parseProductId('JNCR_2022272_45C0001_V01'), /Not a JunoCam product id/u);
  assert.deepEqual(colourImages(rows, 'europa').map(row => row.PRODUCT_ID), ['JNCR_2022272_45C00001_V01'], 'the raw product and the methane image are left out');
  assert.deepEqual(colourImages(rows, 'EUROPA', 44), []);
});

test('a program is pinned from the index with each file size, and refuses anything but calibrated PDS products', async () => {
  const served: Record<string, string | number> = { 'https://planetarydata.jpl.nasa.gov/img/data/juno/JNOJNC_0024/INDEX/INDEX.TAB': [EUROPA, RAW, METHANE].join('\r\n') };
  const base = 'https://planetarydata.jpl.nasa.gov/img/data/juno/JNOJNC_0024/DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01';
  served[`${base}.IMG`] = 35438592; served[`${base}.LBL`] = 2500;
  const fetcher = (async (url: string, init?: RequestInit) => { const hit = served[String(url)]; if (hit === undefined) return new Response('', { status: 404 });
    return init?.method === 'HEAD' ? new Response(null, { headers: { 'content-length': String(hit) } }) : new Response(String(hit)); }) as typeof fetch;
  const program = await pinProgram('test-program', 'JNOJNC_0024', { name: 'EUROPA', naifId: 502, bodyFrame: 'IAU_EUROPA' }, ['lsk/naif0012.tls', 'pck/pck00011.tpc'], 45, fetcher);
  assert.deepEqual(program.images, [{ productId: 'JNCR_2022272_45C00001_V01', startTime: '2022-09-29T09:38:05.691Z', altitudeKm: 1515.1, url: `${base}.IMG`, bytes: 35438592, labelUrl: `${base}.LBL`, labelBytes: 2500 }]);
  await assert.rejects(pinProgram('test-program', 'JNOJNC_0024', { name: 'IO', naifId: 501, bodyFrame: 'IAU_IO' }, [], undefined, fetcher), /lists no calibrated colour image of IO/u);
  await assert.rejects(pinProgram('test-program', 'JNOJNC_24', { name: 'EUROPA', naifId: 502, bodyFrame: 'IAU_EUROPA' }, [], undefined, fetcher), /JNOJNC_nnnn/u);
  assert.throws(() => parseProgram({ ...program, images: [{ ...program.images[0], productId: 'JNCE_2022272_45C00001_V01' }] }), /calibrated products/u);
  assert.throws(() => parseProgram({ ...program, images: [{ ...program.images[0], url: 'https://example.org/JNCR_2022272_45C00001_V01.IMG' }] }), /calibrated products/u);
});

test('holdings count calibrated images by target, and an object\'s state follows its programs, receipts and lenses', () => {
  const held = holdings(rows, new Set(['europa', 'io']), 675.4);
  assert.deepEqual(held.byFilterCombination, { C: 1, M: 1 }); assert.equal(held.calibratedImages, 2);
  assert.deepEqual(held.targets, [{ target: 'EUROPA', images: 2, colourImages: 1, orbits: [45], lowestAltitudeKm: 1515.1, finestNadirPixelKm: 1.023299, objectId: 'europa' }]);
  assert.equal(matchShippedObject('J RINGS', new Set(['jupiter'])), null); assert.equal(matchShippedObject('Io ', new Set(['io'])), 'io');
  const measured = [{ program: 'europa-pj45', target: 'EUROPA', images: 4 }];
  assert.equal(objectStates(held.targets, measured, ['europa'])[0]!.state, 'cast');
  assert.deepEqual(objectStates(held.targets, measured, []).map(o => [o.state, o.measuredImages, o.programs]), [['measured', 4, ['europa-pj45']]]);
  assert.match(objectStates(held.targets, [], [])[0]!.why, /No program of this target is pinned/u);
});

test('the reference ellipsoid has the stated semi-axes at its equator and poles', () => {
  const mesh = ellipsoidMesh([1562.6, 1560.3, 1559.5]), radius = (lon: number, lat: number) => mesh.sample(lon, lat);
  assert.ok(Math.abs(radius(0, 0)! - 1562600) < 1 && Math.abs(radius(90, 0)! - 1560300) < 1 && Math.abs(radius(0, 90)! - 1559500) < 1, `${radius(0, 0)} ${radius(90, 0)} ${radius(0, 90)}`);
  assert.throws(() => ellipsoidMesh([1560]), /no triaxial radii/u);
});

/** A measured program: every image, label and kernel it read pinned as the run that read them left them. */
const PRODUCT = 'https://planetarydata.jpl.nasa.gov/img/data/juno/JNOJNC_0024/DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01';
const MEASURED = parseProgram({ schema: PROGRAM_SCHEMA, id: 'test-program', volume: 'JNOJNC_0024', target: { name: 'EUROPA', naifId: 502, bodyFrame: 'IAU_EUROPA' },
  kernelSet: 'juno', kernels: ['lsk/naif0012.tls', 'pck/pck00011.tpc'],
  images: [{ productId: 'JNCR_2022272_45C00001_V01', startTime: '2022-09-29T09:38:05.691Z', altitudeKm: 1515.1, url: `${PRODUCT}.IMG`, bytes: 35438592,
    sha256: 'a'.repeat(64), labelUrl: `${PRODUCT}.LBL`, labelBytes: 2500, labelSha256: 'b'.repeat(64) }] });
const KERNELS = [{ path: 'lsk/naif0012.tls', bytes: 5023, sha256: 'c'.repeat(64) }, { path: 'pck/pck00011.tpc', bytes: 129000, sha256: 'd'.repeat(64) }];

test('a registration record pins every image, label and kernel the run read, and the policy it held them to', async () => {
  const made = registrationRun(MEASURED, KERNELS, await registrationSoftware());
  assert.equal(made.telescope, 'Juno');
  assert.equal(made.stage, 'junocam-registration');
  assert.deepEqual(made.inputs.map(input => [input.role, input.identity, input.bytes, input.sha256]), [
    ['image JNCR_2022272_45C00001_V01', `${PRODUCT}.IMG`, 35438592, 'a'.repeat(64)],
    ['label JNCR_2022272_45C00001_V01', `${PRODUCT}.LBL`, 2500, 'b'.repeat(64)],
    ['kernel', 'juno/lsk/naif0012.tls', 5023, 'c'.repeat(64)],
    ['kernel', 'juno/pck/pck00011.tpc', 129000, 'd'.repeat(64)]]);
  assert.deepEqual(made.parameters.policy, POLICY);
  assert.deepEqual([made.parameters.observer, made.parameters.aberration], [-61, 'LT+S']);
  // Nothing external runs, so there is no toolchain to pin: the version is the digest of the modules that did the work.
  assert.equal(made.toolchainDigest, undefined);
  assert.match(made.software[0]!.version, /^[0-9a-f]{64}$/u);
  const image = { ...MEASURED.images[0]! };
  delete image.sha256;
  assert.throws(() => registrationRun({ ...MEASURED, images: [image] }, KERNELS, []), /carries no digest/u);
});

test('the measurement adds geometric registration to its own record, and refuses a receipt that has none', async () => {
  const work = await mkdtemp(join(tmpdir(), 'juno-record-'));
  try {
    const name = 'test-program.registration.json', path = join(work, name);
    await writeFile(path, `${JSON.stringify({ schema: RECEIPT_SCHEMA, program: 'test-program' }, null, 2)}\n`);
    await writeProductRecord(productRecordPath(path), registrationRun(MEASURED, KERNELS, await registrationSoftware()),
      [{ path: name, file: path, units: 'pixels for the residuals, seconds for the offsets' }]);
    const record = await addRegistrationEvidence(path, work);
    const registration = evidenceFor(record, name, 'geometric-registration');
    assert.equal(registration.length, 1);
    assert.ok(registration[0]!.receiptPin);
    assert.match(registration[0]!.establishes, /limb was fitted to the target's IAU ellipsoid/u);
    assert.match(registration[0]!.establishes, /not agreement with any archive product/u);
    assert.equal(evidenceFor(record, name, 'archive-agreement').length, 0, 'fitting our own geometry is not agreement with an archive');
    assert.deepEqual((await readProductRecord(productRecordPath(path)))!.evidence, [...record.evidence], 'the record on disk is the one returned');
    // A receipt no run recorded is refused: nothing says which images and kernels the measurement it claims was made from.
    const other = join(work, 'other.registration.json');
    await writeFile(other, '{}\n');
    await assert.rejects(addRegistrationEvidence(other, work), /no product record/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('every pinned program has a receipt for exactly its images, from its kernels, within the budget', async () => {
  const programs = (await readdir(PROGRAMS)).filter(name => name.endsWith('.json') && !name.endsWith('.registration.json'));
  assert.ok(programs.length >= 1);
  for (const file of programs) {
    const program = parseProgram(JSON.parse(await readFile(resolve(PROGRAMS, file), 'utf8'))), receipt = JSON.parse(await readFile(resolve(PROGRAMS, `${program.id}.registration.json`), 'utf8'));
    assert.equal(receipt.schema, RECEIPT_SCHEMA); assert.deepEqual(receipt.policy, POLICY);
    assert.deepEqual(receipt.images.map((image: { productId: string }) => image.productId), program.images.map(image => image.productId));
    assert.deepEqual(receipt.kernels.map((kernel: { path: string }) => kernel.path), program.kernels);
    // The kernels the receipt names are the bank's inputs.
    const bank = JSON.parse(await readFile(resolve(kernelBankRoot(program.kernelSet), 'manifest.json'), 'utf8')) as { inputs: { path: string }[] };
    for (const kernel of receipt.kernels) assert.ok(bank.inputs.some(input => input.path === kernel.path), kernel.path);
    for (const image of receipt.images) {
      assert.ok(Math.abs(image.offsets.pointingSeconds) <= POLICY.maximumPointingSeconds && Math.abs(image.offsets.ephemerisSeconds) <= POLICY.maximumEphemerisSeconds, image.productId);
      assert.ok(image.holdoutResidualPixels.after <= POLICY.maximumResidualPixels && image.holdoutResidualPixels.after < image.holdoutResidualPixels.before && image.holdoutResidualPixels.points >= POLICY.minimumControls, image.productId);
    }
    if (receipt.horizons) assert.ok(receipt.horizons.differencesMeters.every((metres: number) => metres < 10), 'the trajectory reader agrees with Horizons to ten metres');
  }
});

test('the ledger page is the ledger, and its states are what the programs, receipts and packages give', async () => {
  const ledger = JSON.parse(await readFile(LEDGER, 'utf8')) as Ledger;
  assert.equal(ledger.schema, SCHEMA);
  assert.equal(await readFile(GUIDE, 'utf8'), ledgerGuide(ledger), 'docs/junocam-ledger.md is generated; run node tools/objects/juno/archive-ledger.mts');
  assert.deepEqual(ledger.objects, objectStates(ledger.targets, await measuredPrograms(), await castingObjects(await shippedObjects())));
  assert.equal(ledger.calibratedImages, Object.values(ledger.byFilterCombination).reduce((sum, n) => sum + n, 0));
  assert.equal(ledger.targets.reduce((sum, entry) => sum + entry.images, 0), ledger.calibratedImages);
});

test('the guide prints the receipt\'s numbers', async () => {
  const guide = await readFile(resolve(import.meta.dirname, '../../../docs/junocam.md'), 'utf8'), receipt = JSON.parse(await readFile(resolve(PROGRAMS, 'europa-pj45.registration.json'), 'utf8'));
  for (const image of receipt.images) {
    const row = guide.split('\n').find(line => line.startsWith(`| \`${image.productId}\``));
    assert.ok(row, `${image.productId} is in the guide's table`);
    const milliseconds = image.offsets.pointingSeconds * 1000, cells = row!.split('|').map(cell => cell.trim());
    assert.equal(cells[4], `${milliseconds < 0 ? '−' : '+'}${Math.abs(milliseconds).toFixed(1)} ms`); assert.equal(cells[5], `+${image.offsets.ephemerisSeconds.toFixed(3)} s`);
    assert.equal(cells[6], `${image.holdoutResidualPixels.before.toFixed(1)} px`); assert.equal(cells[7], `${image.holdoutResidualPixels.after.toFixed(2)} px`);
  }
});
