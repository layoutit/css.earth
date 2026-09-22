import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandCall, isName, loggedSpectralWindowMap, manualTables, parseManualCalibration, parseScriptCalls, readValue, resolveNamedMaps } from './alma-manual-calibration.mts';

const here = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT = resolve(here, 'fixtures/alma-manual-scriptForCalibration-excerpt.py');
const LOG = resolve(here, 'fixtures/alma-manual-applycal-log-excerpt.txt');

const script = await readFile(SCRIPT, 'utf8');
const log = await readFile(LOG, 'utf8');

test('a manual reduction script is read as the calibration it applies', () => {
  const calibration = parseManualCalibration(script);
  assert.equal(calibration.casaVersion, '4.5.0');
  assert.equal(calibration.measurementSet, 'uid___A002_Xad2439_Xee6.ms');
  assert.equal(calibration.referenceAntenna, 'DV19');
  assert.deepEqual(calibration.intents.get('OBSERVE_TARGET'), ['Europa']);
  assert.deepEqual(calibration.intents.get('CALIBRATE_PHASE'), ['J1108+0811']);
  assert.equal(calibration.steps.size, 20);
  assert.equal(calibration.steps.get(0), 'Import of the ASDM');
  // Every step the replay does not run solves a table the delivery ships, or saves flags, or plots.
  assert.deepEqual(calibration.solvedSteps, [1, 2, 4, 5, 6, 9, 12, 13, 14, 15, 16, 19]);
});

test('the a-priori flagging is the two selections and the online flag table, not the plot', () => {
  const { aprioriFlags } = parseManualCalibration(script);
  assert.equal(aprioriFlags.length, 3);
  assert.equal(aprioriFlags[0]!.selections.spw, '5~12,17~24');
  assert.equal(aprioriFlags[0]!.autocorrelations, true);
  assert.equal(aprioriFlags[1]!.selections.intent, '*POINTING*,*ATMOSPHERE*');
  // flagcmd is kept once: the call that applies the observatory's own flag table, never the one that draws its picture.
  assert.deepEqual(aprioriFlags.map(entry => entry.task), ['flagdata', 'flagdata', 'flagcmd']);
});

test('the observatory calibration is one application per field, with the Tsys map left named', () => {
  const { observatoryApplications } = parseManualCalibration(script);
  assert.deepEqual(observatoryApplications.map(entry => entry.field), ['0', '1', '2', '3']);
  const target = observatoryApplications[3]!;
  assert.equal(target.spw, '17,19,21,23');
  assert.equal(target.interpolation, 'linear,linear');
  assert.equal(target.calibrateWeights, true);
  assert.deepEqual(target.tables.map(table => table.gaintable), [
    'uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos']);
  // The Tsys table is applied on the field its own Tsys was measured on; field 2 borrows field 3's, as the script's note says.
  assert.deepEqual(observatoryApplications[2]!.tables.map(table => table.gainfield), ['3', '', '']);
  assert.deepEqual(target.tables[0]!.spwmap, { named: 'tsysmap' });
  assert.deepEqual(target.tables[1]!.spwmap, []);
});

test('the flux-density scale the reducer set is read out, because the published re-reduction corrected it', () => {
  const { fluxScale } = parseManualCalibration(script);
  assert.equal(fluxScale.field, 'J1058+0133');
  assert.equal(fluxScale.standard, 'manual');
  assert.equal(fluxScale.fluxDensityJy, 3.32983224433);
  assert.equal(fluxScale.spectralIndex, -0.49298049649);
  assert.equal(fluxScale.referenceFrequency, '233.0GHz');
});

test('an applycal inside a one-value loop is expanded to the value the loop binds', () => {
  const { calibratorApplications } = parseManualCalibration(script);
  assert.deepEqual(calibratorApplications.map(entry => entry.field), ['0', '1,2~3']);
  // field = str(i) and gainfield = ['', i, i] both resolve from `for i in ['0']`.
  assert.deepEqual(calibratorApplications[0]!.tables.map(table => table.gainfield), ['', '0', '0']);
  assert.deepEqual(calibratorApplications[1]!.tables.map(table => table.gaintable), [
    'uid___A002_Xad2439_Xee6.ms.split.bandpass', 'uid___A002_Xad2439_Xee6.ms.split.phase_inf', 'uid___A002_Xad2439_Xee6.ms.split.flux_inf']);
});

test('the splits are read with the selections that decide what reaches the image', () => {
  const { scienceSplit, finalSplit } = parseManualCalibration(script);
  assert.equal(scienceSplit.outputVisibilities, 'uid___A002_Xad2439_Xee6.ms.split');
  assert.equal(scienceSplit.spw, '17,19,21,23');
  assert.equal(scienceSplit.dataColumn, 'corrected');
  assert.equal(scienceSplit.keepFlags, true);
  // The final split drops the 7-metre antennas by name; imaging the mixed array would widen the beam.
  assert.equal(finalSplit.antenna, 'DA*,DV*,PM*&');
  assert.equal(finalSplit.outputVisibilities, 'uid___A002_Xad2439_Xee6.ms.split.cal');
});

test('the initial flagging keeps shadowing and the edge channels of every window', () => {
  const { initialFlags } = parseManualCalibration(script);
  assert.deepEqual(initialFlags.map(entry => entry.mode), ['shadow', 'manual']);
  assert.equal(initialFlags[1]!.selections.spw, '0:0~7;120~127,1:0~7;120~127,2:0~7;120~127,3:0~7;120~127');
});

test('the tables the script applies are listed once each, in first use order', () => {
  assert.deepEqual(manualTables(parseManualCalibration(script)), [
    'uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos',
    'uid___A002_Xad2439_Xee6.ms.split.bandpass', 'uid___A002_Xad2439_Xee6.ms.split.phase_int',
    'uid___A002_Xad2439_Xee6.ms.split.flux_inf', 'uid___A002_Xad2439_Xee6.ms.split.phase_inf']);
});

test('the Tsys spectral-window map is read from the delivery log, never computed', () => {
  const map = loggedSpectralWindowMap(log, 'uid___A002_Xad2439_Xee6.ms.tsys');
  assert.equal(map.length, 25);
  // Windows 13 to 16 have no Tsys of their own and take the four science windows'; 18, 20, 22 and 24 take their neighbours'.
  assert.deepEqual(map.slice(13), [17, 19, 21, 23, 17, 17, 19, 19, 21, 21, 23, 23]);
  assert.deepEqual(map.slice(0, 13), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(loggedSpectralWindowMap(log, 'uid___A002_Xad2439_Xee6.ms.wvr'), []);
  assert.deepEqual(loggedSpectralWindowMap(log, 'uid___A002_Xad2439_Xee6.ms.antpos'), [0]);
  // Only the tables the script names but does not state are resolved, and each exactly once.
  const resolved = resolveNamedMaps(parseManualCalibration(script), log);
  assert.deepEqual([...resolved.keys()], ['uid___A002_Xad2439_Xee6.ms.tsys']);
});

test('a table the log says nothing about stops the read rather than being guessed', () => {
  assert.throws(() => loggedSpectralWindowMap(log, 'uid___A002_Xad2439_Xee6.ms.split.bandpass'), /records no spectral-window map/u);
});

test('a replayed step that calls something this route does not replay stops the read', () => {
  const changed = script.replace("  flagdata(vis = 'uid___A002_Xad2439_Xee6.ms.split',\n    mode = 'shadow',", "  hanningsmooth(vis = 'uid___A002_Xad2439_Xee6.ms.split',\n    mode = 'shadow',");
  assert.notEqual(changed, script);
  assert.throws(() => parseManualCalibration(changed), /calls hanningsmooth/u);
});

test('CASA 4 booleans, lists and calls are read as what they are', () => {
  assert.equal(readValue('T', 0).value, true);
  assert.equal(readValue('F', 0).value, false);
  assert.equal(readValue('-0.49298049649', 0).value, -0.49298049649);
  assert.deepEqual(readValue("[3.32983224433, 0, 0, 0]", 0).value, [3.32983224433, 0, 0, 0]);
  const named = readValue('tsysmap', 0).value;
  assert.ok(isName(named) && named.name === 'tsysmap');
});

test('a call under two loops is expanded once per pair of values', () => {
  const calls = parseScriptCalls("for i in ['0', '1']:\n  for j in ['a']:\n    applycal(field = i, spw = j)\n");
  assert.equal(calls.length, 1);
  const expanded = expandCall(calls[0]!);
  assert.deepEqual(expanded.map(entry => [entry.keywords.get('field'), entry.keywords.get('spw')]), [['0', 'a'], ['1', 'a']]);
});
