import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manualDeliveryPins, manualImaging, manualRestoreRun, manualRestoreScript, manualTcleanArguments, recordArchiveComparison } from './alma-restore-manual.mts';
import { evidenceFor, productRecordPath, readProductRecord, runDigest, writeProductRecord } from '../product-record.mts';
import { loggedSpectralWindowMap, parseManualCalibration, resolveNamedMaps } from './alma-manual-calibration.mts';

const here = fileURLToPath(new URL('.', import.meta.url));
const read = (name: string) => readFile(resolve(here, 'fixtures', name), 'utf8');

const imagingScript = await read('alma-manual-scriptForImaging-excerpt.py');
const preparationScript = await read('alma-manual-scriptForImagingPrep-excerpt.py');
const calibrationScript = await read('alma-manual-scriptForCalibration-excerpt.py');
const log = await read('alma-manual-applycal-log-excerpt.txt');

test('the delivery’s imaging scripts are read through the variables they set', () => {
  const imaging = manualImaging(imagingScript, preparationScript);
  assert.equal(imaging.finalVisibilities, 'calibrated_final.ms');
  assert.equal(imaging.continuumVisibilities, 'calibrated_final_cont.ms');
  assert.equal(imaging.imageName, 'calibrated_final_cont');
  // clean was handed the names, not the values; reading the call alone would have read nothing.
  assert.equal(imaging.cell, '6.25mas');
  assert.deepEqual(imaging.imageSize, [2048, 2048]);
  assert.equal(imaging.weighting, 'briggs');
  assert.equal(imaging.robust, 0.5);
  assert.equal(imaging.iterations, 1000);
  assert.equal(imaging.threshold, '0.0mJy');
  assert.deepEqual(imaging.scales, [0, 5, 15, 30, 60, 120]);
  assert.equal(imaging.mode, 'mfs');
  assert.equal(imaging.pointSpreadMode, 'clark');
  assert.equal(imaging.field, '3');
  // Eight channels of each of the four windows are averaged into one continuum channel.
  assert.equal(imaging.continuumWindows, '0,1,2,3');
  assert.deepEqual(imaging.channelWidths, [8, 8, 8, 8]);
  assert.equal(imaging.initialisesWeights, true);
  assert.equal(imaging.interactive, true);
  assert.equal(imaging.targetIntent, '*TARGET*');
  assert.deepEqual(imaging.preparationFlags, [{ mode: 'manual', uvrange: '>10km', action: 'apply' }]);
});

test('CASA 4 clean becomes CASA 6 tclean with every substitution named', () => {
  const imaging = manualImaging(imagingScript, preparationScript);
  const arguments_ = manualTcleanArguments(imaging);
  assert.equal(arguments_.get('specmode'), 'mfs');
  // multiscale was a clean argument and is tclean's deconvolver; the scales themselves are the delivery's.
  assert.equal(arguments_.get('deconvolver'), 'multiscale');
  assert.deepEqual(arguments_.get('scales'), [0, 5, 15, 30, 60, 120]);
  // imagermode='csclean' is tclean's default gridder.
  assert.equal(arguments_.get('gridder'), 'standard');
  assert.equal(arguments_.get('robust'), 0.5);
  assert.equal(arguments_.get('niter'), 1000);
  // A headless replay never cleans interactively; the mask the reducer drew is passed instead.
  assert.equal(arguments_.get('interactive'), false);
  assert.throws(() => manualTcleanArguments({ ...imaging, mode: 'cube' }), /continuum imaging/u);
  assert.throws(() => manualTcleanArguments({ ...imaging, weighting: 'natural' }), /Briggs weighting/u);
});

const script = () => manualRestoreScript({
  asdm: '/work/uid___A002_Xad2439_Xee6.asdm.sdm',
  calibration: parseManualCalibration(calibrationScript),
  maps: resolveNamedMaps(parseManualCalibration(calibrationScript), log),
  imaging: manualImaging(imagingScript, preparationScript),
  target: 'Europa', tableDirectory: '/work/calibration', mask: '/work/products/calibrated_final_cont.mask',
  scratch: '/scratch', imageBase: '/work/Europa.restored',
});

test('the restore replays the script’s own steps, in its own order', () => {
  const source = script();
  const order = ['importasdm(', "mode='manual', spw='5~12,17~24'", "intent='*POINTING*,*ATMOSPHERE*'", "flagcmd(", '.ms.tsys',
    "spw='17,19,21,23', keepflags=True", "mode='shadow'", 'setjy(', '.split.bandpass', "antenna='DA*,DV*,PM*&'",
    "uvrange='>10km'", "intent='*TARGET*'", 'initweights(', 'width=[8, 8, 8, 8]', 'tclean(', 'exportfits('];
  let at = -1;
  for (const marker of order) {
    const found = source.indexOf(marker, at + 1);
    assert.ok(found > at, `${marker} is missing or out of order in the generated script`);
    at = found;
  }
});

test('the Tsys map the script computes is written out as the delivery’s log recorded it', () => {
  const source = script();
  const map = loggedSpectralWindowMap(log, 'uid___A002_Xad2439_Xee6.ms.tsys');
  assert.ok(source.includes(`spwmap=[[${map.join(', ')}], [], []]`), 'the Tsys map is not the one the log records');
  // Nothing in the generated script calls the function that is not in casatasks.
  assert.ok(!source.includes('tsysspwmap'), 'the script still calls tsysspwmap');
  assert.ok(!source.includes('almahelpers'), 'the script still imports the ALMA analysis recipes');
});

test('the imaging follows the moving body, uses the mask the reducer drew, and opens nothing', () => {
  const source = script();
  assert.ok(source.includes("phasecenter='TRACKFIELD'"), 'the imaging does not follow the ephemeris');
  assert.ok(source.includes('carries no ephemeris'), 'a field without an ephemeris is not refused');
  assert.ok(source.includes("mask='/work/products/calibrated_final_cont.mask'"), 'the delivered mask is not used');
  assert.ok(source.includes('interactive=False'), 'the clean is not headless');
  for (const forbidden of ['plotms', 'viewer(', 'imview', 'es.', 'aU.']) {
    assert.ok(!source.includes(forbidden), `the generated script calls ${forbidden}`);
  }
});

test('a run without the mask says so and leaves everything else alone', () => {
  const withMask = script();
  const without = manualRestoreScript({
    asdm: '/work/uid___A002_Xad2439_Xee6.asdm.sdm', calibration: parseManualCalibration(calibrationScript),
    maps: resolveNamedMaps(parseManualCalibration(calibrationScript), log),
    imaging: manualImaging(imagingScript, preparationScript), target: 'Europa', tableDirectory: '/work/calibration',
    mask: null, scratch: '/scratch', imageBase: '/work/Europa.restored',
  });
  assert.ok(!without.includes('mask='), 'a maskless run still passes a mask');
  assert.ok(without.includes('no mask'), 'a maskless run does not record that it had none');
  assert.equal(withMask.split('\n').length, without.split('\n').length);
});

const maskless = () => manualRestoreScript({
  asdm: '/work/uid___A002_Xad2439_Xee6.asdm.sdm', calibration: parseManualCalibration(calibrationScript),
  maps: resolveNamedMaps(parseManualCalibration(calibrationScript), log), imaging: manualImaging(imagingScript, preparationScript),
  target: 'Europa', tableDirectory: '/work/calibration', mask: null, scratch: '/scratch', imageBase: '/work/Europa.restored',
});
const XML: Record<string, string> = { 'ASDM.xml': '<ASDM/>', 'ExecBlock.xml': '<ExecBlock/>', 'Main.xml': '<Main/>', 'Antenna.xml': '<Antenna antennas="41"/>' };
const delivery = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alma-restore-')), asdm = join(directory, 'uid___A002_Xad2439_Xee6.asdm.sdm');
  await mkdir(asdm, { recursive: true });
  for (const [name, text] of Object.entries(XML)) await writeFile(join(asdm, name), text);
  const files = { asdm, calibrationScript: join(directory, 'uid___A002_Xad2439_Xee6.ms.scriptForCalibration.py'), imagingScript: join(directory, 'scriptForImaging.py'),
    preparationScript: join(directory, 'scriptForImagingPrep.py'), log: join(directory, 'casapy.log'), tables: join(directory, 'uid___A002_Xad2439_Xee6.calibration.tgz'),
    mask: join(directory, 'calibrated_final_cont.mask.tgz') };
  for (const [role, path] of Object.entries(files)) if (role !== 'asdm') await writeFile(path, `the delivery’s ${role}`);
  return { directory, files };
};
const casa = [{ name: 'casatasks', version: '6.7.0' }];

test('a manual restore is identified by the delivery it replays, the script it generated and the pinned CASA', async () => {
  const { directory, files } = await delivery();
  try {
    const pins = await manualDeliveryPins(files);
    assert.deepEqual(pins.map(pin => pin.identity), ['uid___A002_Xad2439_Xee6.asdm.sdm', 'uid___A002_Xad2439_Xee6.ms.scriptForCalibration.py',
      'scriptForImaging.py', 'scriptForImagingPrep.py', 'casapy.log', 'uid___A002_Xad2439_Xee6.calibration.tgz', 'calibrated_final_cont.mask.tgz']);
    // The ASDM is identified by the tables that say what was observed, not by the tens of gigabytes of visibilities beside them.
    assert.equal(pins[0]!.bytes, Object.values(XML).join('').length);
    assert.ok(pins.every(pin => /^[0-9a-f]{64}$/u.test(pin.sha256)), 'every input is pinned by digest');
    const run = manualRestoreRun(pins, { target: 'Europa', script: script(), mask: files.mask }, casa, 'f'.repeat(64));
    assert.equal(run.telescope, 'ALMA');
    assert.equal(run.stage, 'restore-manual');
    assert.equal(run.parameters.target, 'Europa');
    assert.equal(run.parameters.mask, 'calibrated_final_cont.mask.tgz');
    assert.deepEqual(run.software, casa);
    assert.equal(run.toolchainDigest, 'f'.repeat(64));
    const base = runDigest(run);
    // Cleaning without the mask the reducer drew, another CASA, and any changed delivery file are each another run.
    assert.notEqual(runDigest(manualRestoreRun(pins, { target: 'Europa', script: maskless(), mask: null }, casa, 'f'.repeat(64))), base);
    assert.notEqual(runDigest(manualRestoreRun(pins, { target: 'Europa', script: script(), mask: files.mask }, casa, 'a'.repeat(64))), base);
    await writeFile(files.imagingScript, 'a delivery that imaged something else');
    assert.notEqual(runDigest(manualRestoreRun(await manualDeliveryPins(files), { target: 'Europa', script: script(), mask: files.mask }, casa, 'f'.repeat(64))), base);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const measurement = (peak: number) => ({ peak, noise: 1.2e-4, signalToNoise: peak / 1.2e-4, centreX: 1024.3, centreY: 1023.8, halfPowerDiameterMas: 771.2, beamAreas: 94.1 });

test('the archive comparison is written beside the restored image and added to its record, and refused without one', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alma-restore-record-'));
  try {
    const image = join(directory, 'Europa.restored.fits'), archive = join(directory, 'archive_delivered.fits');
    await writeFile(image, 'the restored image'); await writeFile(archive, 'the delivered image');
    const comparison = { measurement: measurement(0.312), archive: measurement(0.303),
      difference: { peakRatio: 1.03, diameterDifferenceMas: 1.2, correlation: 0.9981, beamRatio: 1.004, samples: 12_064 } };
    // The restore writes the record; the comparison only adds what it established, so an image no run recorded is refused.
    await assert.rejects(recordArchiveComparison(image, archive, comparison), /no product record at/u);
    const run = manualRestoreRun([{ role: 'raw ASDM (ASDM, ExecBlock, Main and Antenna tables)', identity: 'uid___A002_Xad2439_Xee6.asdm.sdm', bytes: 36, sha256: 'b'.repeat(64) }],
      { target: 'Europa', script: script(), mask: null }, casa, 'f'.repeat(64));
    await writeProductRecord(productRecordPath(image), run, [{ path: basename(image), file: image, units: 'Jy/beam' }]);
    const receipt = await recordArchiveComparison(image, archive, comparison);
    assert.equal(basename(receipt), 'Europa.restored.archive-comparison.json');
    const written = JSON.parse(await readFile(receipt, 'utf8')) as { archiveImage: string; archive: { peak: number }; difference: { correlation: number } };
    assert.equal(written.archiveImage, 'archive_delivered.fits');
    assert.equal(written.archive.peak, 0.303);
    assert.equal(written.difference.correlation, 0.9981);
    const record = (await readProductRecord(productRecordPath(image)))!;
    assert.equal(record.outputs[0]!.units, 'Jy/beam');
    assert.deepEqual(record.inputs, run.inputs, 'the comparison leaves the run facts the restore recorded');
    const evidence = evidenceFor(record, basename(image), 'archive-agreement');
    assert.equal(evidence.length, 1);
    assert.ok(evidence[0]!.receiptPin);
    assert.match(evidence[0]!.establishes, /reproduces the reduction that was delivered/u);
    // Agreement with the archive places nothing and publishes nothing.
    assert.equal(evidenceFor(record, basename(image), 'geometric-registration').length, 0);
    // The same comparison run twice replaces its own entry, so the record keeps the same bytes.
    const before = await readFile(productRecordPath(image), 'utf8');
    await recordArchiveComparison(image, archive, comparison);
    assert.equal(await readFile(productRecordPath(image), 'utf8'), before);
    await writeFile(image, 'another image');
    await assert.rejects(recordArchiveComparison(image, archive, comparison), /not the files on disk/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the import is the script’s, except for the one argument that only changes what the disk holds', () => {
  const source = script();
  assert.ok(source.includes('lazy=True'), 'the import is not lazy');
  assert.ok(source.includes("asis='Antenna Station Receiver Source CalAtmosphere CalWVR CorrelatorMode SBSummary'"),
    'the import does not keep the tables the script keeps');
  assert.ok(source.includes('bdfflags=True') && source.includes('process_caldevice=False'), 'the import drops an argument the script sets');
  // The route refuses to start rather than filling the disk and failing in the middle.
  assert.ok(/free < 4\.5 \* need/u.test(source), 'the run does not check the disk before it starts');
});
