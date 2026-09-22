import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { calibratorDatabase, planAmberNight } from './calibrate-amber.mts';
import { coOvertoneLines, measureCoShift } from './co-wavelength.mts';
import { parseRawTable } from './eso-pipeline.mts';
import { binaryTable, numbers, readFitsHdus, tableColumn, text } from './fits-table.mts';

const repository = resolve(import.meta.dirname, '../../..');
const fixture = resolve(import.meta.dirname, 'fixtures/amber-2013-12-07-raw-frames.csv');

test('an AMBER night plan finds the P2VM set, each block\'s dark and sky, and the nearest calibrator', async () => {
  const rows = parseRawTable(await readFile(fixture, 'utf8'));
  assert.equal(rows.find(row => row.dp_id === 'AMBER.2013-12-06T23:43:06.093')!.dp_type, 'WAVE,3TEL');
  const plan = planAmberNight(rows, 'RDOR', { from: '2013-12-07T00:10:00', to: '2013-12-07T00:47:00' });
  assert.deepEqual([plan.p2vm.wave.length, plan.p2vm.p2v.length], [4, 10]);
  assert.deepEqual(plan.blocks.map(block => [block.target, block.role, block.objects.length, block.dark, block.sky]), [
    ['CANOPUS', 'calibrator', 5, 'AMBER.2013-12-07T00:15:40.257', 'AMBER.2013-12-07T00:29:15.251'],
    ['RDOR', 'science', 5, 'AMBER.2013-12-07T00:32:33.965', 'AMBER.2013-12-07T00:45:44.597'],
  ]);
  assert.deepEqual(plan.pairs, [{ science: 1, calibrator: 0 }]);
  // With the later Canopus block in the window too, the nearer first exposure wins: 16 min 29 s before R Dor's against 16 min 31 s after.
  const wider = planAmberNight(rows, 'RDOR', { from: '2013-12-07T00:10:00', to: '2013-12-07T01:03:00' });
  assert.equal(wider.blocks.length, 3);
  assert.equal(wider.blocks[wider.pairs[0]!.calibrator]!.start, '2013-12-07T00:15:21');
  assert.throws(() => planAmberNight(rows, 'RDOR', { from: '2013-12-07T00:30:00', to: '2013-12-07T00:47:00' }), /no calibrator/u);
});

test('the calibrator database holds one star with its stated diameter in the kit\'s layout', () => {
  const bytes = calibratorDatabase('CANOPUS', 95.98805388, -52.69559, 6.93, 0.15), table = binaryTable(readFitsHdus(bytes)[1]!);
  assert.equal(text(bytes, table, 0, tableColumn(table, 'Name')), 'CANOPUS');
  assert.deepEqual([numbers(bytes, table, 0, tableColumn(table, 'diameter'))[0], numbers(bytes, table, 0, tableColumn(table, 'diameterErr'))[0], numbers(bytes, table, 0, tableColumn(table, 'signDEC'))[0], numbers(bytes, table, 0, tableColumn(table, 'hourRA'))[0], numbers(bytes, table, 0, tableColumn(table, 'degreeDEC'))[0]], [6.93, 0.15, -1, 6, 52]);
});

test('CO line positions reproduce the laboratory band head, and a shifted synthetic spectrum is recovered', () => {
  const lines = coOvertoneLines(), head = Math.min(...lines.filter(line => line > 2.28));
  assert.ok(Math.abs(head - 2.29353) < 2e-5, `band head ${head}`);
  const wavelengths = Array.from({ length: 324 }, (_, i) => 2.28 + i * 0.0000928);
  const flux = wavelengths.map(wavelength => 1 - lines.reduce((sum, line) => sum + 0.3 * Math.exp(-(((wavelength - 0.0021 - line) / 0.00012) ** 2)), 0));
  const shift = measureCoShift(wavelengths, flux);
  assert.ok(Math.abs(shift.shiftNm - 2.1) < 0.05 && shift.correlation > 0.9, JSON.stringify(shift));
});

const stationNames = (bytes: Buffer) => {
  const table = binaryTable(readFitsHdus(bytes).find(hdu => hdu.extname === 'OI_ARRAY')!), names = new Map<number, string>();
  for (let row = 0; row < table.rows; row++) names.set(numbers(bytes, table, row, tableColumn(table, 'STA_INDEX'))[0]!, text(bytes, table, row, tableColumn(table, 'STA_NAME')));
  return names;
};
/** Rows of an observable table keyed by sorted station names, with values, errors, flags and the file's wavelengths. */
function observable(bytes: Buffer, extname: string, value: string, error: string) {
  const hdus = readFitsHdus(bytes), names = stationNames(bytes), waveTable = binaryTable(hdus.find(hdu => hdu.extname === 'OI_WAVELENGTH')!);
  const wavelengths = Array.from({ length: waveTable.rows }, (_, row) => numbers(bytes, waveTable, row, tableColumn(waveTable, 'EFF_WAVE'))[0]!);
  const table = binaryTable(hdus.find(hdu => hdu.extname === extname)!);
  return Array.from({ length: table.rows }, (_, row) => ({ key: numbers(bytes, table, row, tableColumn(table, 'STA_INDEX')).map(index => names.get(index)).sort().join('-'),
    values: numbers(bytes, table, row, tableColumn(table, value)), errors: numbers(bytes, table, row, tableColumn(table, error)), flags: numbers(bytes, table, row, tableColumn(table, 'FLAG')), wavelengths }));
}
/** Our channels smoothed over three (the author binned to R 8000 from about 12 000) and interpolated onto the author's. */
function resampled(ours: ReturnType<typeof observable>[number], wavelengths: readonly number[], lag = 0) {
  const order = ours.wavelengths.map((_, i) => i).sort((a, b) => ours.wavelengths[a]! - ours.wavelengths[b]!);
  const smooth = order.map((i, k) => { const around = [order[k - 1], i, order[k + 1]].filter((j): j is number => j !== undefined && !ours.flags[j] && Number.isFinite(ours.values[j]!)); return around.length ? around.reduce((sum, j) => sum + ours.values[j]!, 0) / around.length : Number.NaN; });
  const x = order.map(i => ours.wavelengths[i]!);
  return wavelengths.map(wavelength => { const w = wavelength + lag * 0.0928e-9, k = x.findIndex(value => value >= w); if (k <= 0) return Number.NaN; const f = (w - x[k - 1]!) / (x[k]! - x[k - 1]!); return smooth[k - 1]! * (1 - f) + smooth[k]! * f; });
}
const median = (values: number[]) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted[sorted.length >> 1]!; };

test('the R Dor AMBER unit calibrated from raw frames reproduces the author\'s file (Ohnaka et al. 2019, DATASET34)', async context => {
  const oursPath = resolve(repository, 'output/calibration/rdor-2013-12-07/calibrated-1.fits'), authorPath = resolve(repository, 'output/calibration/oracles/AAS18051_RDOR_AMBER_DATASET34_FLAGSET.oifits');
  if (!await access(oursPath).then(() => true, () => false) || !await access(authorPath).then(() => true, () => false)) {
    context.skip('run calibrate-amber.mts on the fixture window and restore the OiDB file AAS18051_RDOR_AMBER_DATASET34_FLAGSET.oifits to cover this'); return;
  }
  const [ours, author] = await Promise.all([readFile(oursPath), readFile(authorPath)]);
  const ourVis2 = observable(ours, 'OI_VIS2', 'VIS2DATA', 'VIS2ERR'), authorVis2 = observable(author, 'OI_VIS2', 'VIS2DATA', 'VIS2ERR');
  assert.equal(authorVis2.length, 3);
  // After the CO calibration no channel lag is left: the best whole-channel alignment with the author's spectra is within one channel.
  const score = (lag: number) => authorVis2.reduce((sum, row) => {
    const mine = resampled(ourVis2.find(candidate => candidate.key === row.key)!, row.wavelengths, lag), pairs = row.values.map((v, i) => [v, mine[i]!] as const).filter(([v, m], i) => !row.flags[i] && Number.isFinite(m) && Number.isFinite(v));
    const ma = pairs.reduce((s, [v]) => s + v, 0) / pairs.length, mb = pairs.reduce((s, [, m]) => s + m, 0) / pairs.length;
    return sum + pairs.reduce((s, [v, m]) => s + (v - ma) * (m - mb), 0) / Math.sqrt(pairs.reduce((s, [v]) => s + (v - ma) ** 2, 0) * pairs.reduce((s, [, m]) => s + (m - mb) ** 2, 0));
  }, 0);
  const best = [-4, -3, -2, -1, 0, 1, 2, 3, 4].reduce((a, b) => score(b) > score(a) ? b : a, 0);
  context.diagnostic(`residual lag ${best} channels`);
  assert.ok(Math.abs(best) <= 1, `residual lag ${best} channels`);
  for (const row of authorVis2) {
    const mine = resampled(ourVis2.find(candidate => candidate.key === row.key)!, row.wavelengths);
    const ratios = row.values.map((value, i) => row.flags[i] ? Number.NaN : mine[i]! / value);
    context.diagnostic(`${row.key}: median ratio ${median(ratios).toFixed(3)}`);
    assert.ok(Math.abs(median(ratios) - 1) < 0.2, `${row.key}: median ratio ${median(ratios).toFixed(3)}`);
  }
  const ourT3 = observable(ours, 'OI_T3', 'T3PHI', 'T3PHIERR')[0]!, authorT3 = observable(author, 'OI_T3', 'T3PHI', 'T3PHIERR')[0]!;
  const phases = resampled(ourT3, authorT3.wavelengths), differences = authorT3.values.map((value, i) => authorT3.flags[i] ? Number.NaN : ((phases[i]! - value + 540) % 360) - 180);
  context.diagnostic(`closure phase median difference ${median(differences).toFixed(2)} degrees`);
  assert.ok(Math.abs(median(differences)) < 5, `closure phase median difference ${median(differences).toFixed(2)} degrees`);
});
