import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { binaryTable, binaryTableHdu, headerBlock, numbers, padBlock, primaryHdu, readFitsHdus, tableColumn, writeComplexCell } from './fits-table.mts';
import { differentialPhaseChi2, type ImagePlane } from './image-fit.mts';
import { readChannelRows } from './oifits-rows.mts';
import { simulateSpotlessDisc } from './spotless-disc.mts';

test('a complex column reads as real and imaginary pairs and is rewritten in place', () => {
  const data = Buffer.alloc(2 + 2 * 8);
  data.writeInt16BE(7, 0); data.writeFloatBE(1.5, 2); data.writeFloatBE(-2, 6); data.writeFloatBE(0.25, 10); data.writeFloatBE(4, 14);
  const header = headerBlock([['XTENSION', 'BINTABLE'], ['BITPIX', 8], ['NAXIS', 2], ['NAXIS1', data.length], ['NAXIS2', 1], ['PCOUNT', 0], ['GCOUNT', 1], ['TFIELDS', 2],
    ['TTYPE1', 'TARGET_ID'], ['TFORM1', 'I'], ['TTYPE2', 'VISDATA'], ['TFORM2', '2C'], ['EXTNAME', 'OI_VIS']]);
  const bytes = Buffer.concat([primaryHdu(), header, padBlock(data)]);
  const table = binaryTable(readFitsHdus(bytes)[1]!), column = tableColumn(table, 'VISDATA');
  assert.equal(table.rowBytes, 18);
  assert.deepEqual(numbers(bytes, table, 0, column), [1.5, -2, 0.25, 4]);
  writeComplexCell(bytes, table, 0, column, 1, -0.5, 0.75);
  assert.deepEqual(numbers(bytes, table, 0, column), [1.5, -2, -0.5, 0.75]);
  assert.equal(numbers(bytes, table, 0, tableColumn(table, 'TARGET_ID'))[0], 7);
});

const spot = (dx: number): ImagePlane => {
  const size = 48, values = new Float64Array(size * size);
  for (let i = 0; i < values.length; i++) { const x = i % size - 23.5 - dx, y = Math.floor(i / size) - 23.5; if (Math.hypot(x, y) < 12) values[i] = 1 + 0.6 * Math.exp(-((x - 5) ** 2 + (y - 3) ** 2) / 10); }
  return { width: size, height: size, values, pixelMas: 1, eastLeft: true };
};

test('an order-1 differential phase carries nothing about a grey image: a shift leaves the statistic unchanged', () => {
  const wavelengths = Array.from({ length: 21 }, (_, k) => 2.28e-6 + k * 1e-9);
  // Measured phases generated from the image itself, so any change comes only from what the nuisance terms fail to absorb.
  const truth = spot(0);
  const rows = [[30, 10], [-12, 55], [48, -20]].map(([u, v]) => ({ u: u!, v: v!, phaseOrder: 1, channels: wavelengths.map(wavelengthMetres => {
    const [re, im] = [0, 0].map((_, index) => { let r = 0, s = 0; const cx = 23.5; for (let i = 0; i < truth.values.length; i++) { const value = Number(truth.values[i]); if (!value) continue; const alpha = (cx - i % 48) * Math.PI / 180 / 3.6e6, delta = (Math.floor(i / 48) - cx) * Math.PI / 180 / 3.6e6, phase = -2 * Math.PI * (u! * alpha + v! * delta) / wavelengthMetres; r += value * Math.cos(phase); s += value * Math.sin(phase); } return index ? s : r; });
    return { wavelengthMetres, phaseDegrees: Math.atan2(im!, re!) * 180 / Math.PI, phaseErrorDegrees: 1 };
  }) }));
  const same = differentialPhaseChi2(truth, rows), shifted = differentialPhaseChi2(spot(3), rows);
  assert.ok(same.chi2 < 1e-6, `the generating image fits exactly: ${same.chi2}`);
  assert.ok(shifted.chi2 < 1e-3, `a 3 mas shift of a grey image is absorbed by the offset and slope: ${shifted.chi2}`);
  assert.equal(same.freedom, 3 * (21 - 2));
});

test('OI_VIS rows keep their declared types and flags, and a spotless simulation rewrites them with the disc', () => {
  const wavelengths = [2.28e-6, 2.285e-6, 2.29e-6, 2.295e-6, 2.3e-6];
  const vis = (amplitudeType: string) => binaryTableHdu('OI_VIS', [
    { name: 'TARGET_ID', form: 'I' }, { name: 'VISAMP', form: '5D' }, { name: 'VISAMPERR', form: '5D' }, { name: 'VISPHI', form: '5D' }, { name: 'VISPHIERR', form: '5D' },
    { name: 'UCOORD', form: 'D' }, { name: 'VCOORD', form: 'D' }, { name: 'STA_INDEX', form: '2I' }, { name: 'FLAG', form: '5L' },
  ], [[1, [0.5, 0.5, 0.5, 0.5, 0.5], [0.01, 0.01, 0.01, 0.01, 0.01], [3, -2, 1, 0, 4], [0.5, 0.5, 0.5, 0.5, 0.5], 20, 5, [1, 2], [false, false, true, false, false]]],
  [['INSNAME', 'TEST'], ['ARRNAME', 'TEST'], ['AMPTYP', amplitudeType], ['PHITYP', 'differential'], ['PHIORDER', 1]]);
  const file = (amplitudeType: string) => Buffer.concat([primaryHdu(), binaryTableHdu('OI_WAVELENGTH', [{ name: 'EFF_WAVE', form: 'E' }, { name: 'EFF_BAND', form: 'E' }], wavelengths.map(wavelength => [wavelength, 5e-9]), [['INSNAME', 'TEST']]), vis(amplitudeType)]);
  const rows = readChannelRows(file('absolute'));
  assert.equal(rows.vis.length, 1);
  assert.deepEqual([rows.vis[0]!.amplitudeType, rows.vis[0]!.phaseType, rows.vis[0]!.phaseOrder], ['absolute', 'differential', 1]);
  assert.deepEqual(rows.vis[0]!.channels.map(channel => Math.round(channel.wavelengthMetres * 1e9)), [2280, 2285, 2295, 2300], 'the flagged channel is dropped');
  for (const amplitudeType of ['absolute', 'differential']) {
    const simulated = readChannelRows(simulateSpotlessDisc(file(amplitudeType), { diameterMas: 10, seed: 5 }).bytes).vis[0]!;
    assert.equal(simulated.channels.length, 4);
    // Baseline 20.6 m at 2.29 um against a 10 mas disc: x = 1.4, inside the first lobe, so the disc phase is 0.
    for (const channel of simulated.channels) assert.ok(Math.abs(channel.phaseDegrees) < 5 * channel.phaseErrorDegrees, `phase ${channel.phaseDegrees}`);
    const mean = simulated.channels.reduce((sum, channel) => sum + channel.amplitude, 0) / simulated.channels.length;
    if (amplitudeType === 'absolute') assert.ok(mean > 0.6 && mean < 0.95, `an absolute amplitude is the disc's |V|: ${mean}`);
    else assert.ok(Math.abs(mean - 1) < 0.05, `a differential amplitude is normalised to its row: ${mean}`);
  }
});

test('selection flags channels outside the windows in every observable table and scales wavelengths without touching data', async () => {
  const { selectOifits } = await import('./oifits-select.mts');
  const wavelengths = [2.28e-6, 2.29e-6, 2.3e-6];
  const table = (extname: string, data: string) => binaryTableHdu(extname, [{ name: data, form: '3D' }, { name: 'UCOORD', form: 'D' }, { name: 'VCOORD', form: 'D' }, { name: 'FLAG', form: '3L' }],
    [[[0.4, 0.5, 0.6], 10, 0, [false, false, true]]], [['INSNAME', 'TEST']]);
  const input = Buffer.concat([primaryHdu(), binaryTableHdu('OI_WAVELENGTH', [{ name: 'EFF_WAVE', form: 'D' }, { name: 'EFF_BAND', form: 'D' }], wavelengths.map(w => [w, 1e-8]), [['INSNAME', 'TEST']]), table('OI_VIS2', 'VIS2DATA')]);
  const { bytes, keptVis2, newlyFlaggedVis2 } = selectOifits(input, { windowsMetres: [[2.285e-6, 2.31e-6]], wavelengthScale: 1.0054 });
  assert.equal(keptVis2, 1); assert.equal(newlyFlaggedVis2, 1);
  const hdus = readFitsHdus(bytes), vis2 = binaryTable(hdus.find(hdu => hdu.extname === 'OI_VIS2')!), wave = binaryTable(hdus.find(hdu => hdu.extname === 'OI_WAVELENGTH')!);
  assert.deepEqual(numbers(bytes, vis2, 0, tableColumn(vis2, 'FLAG')), [1, 0, 1], 'outside flagged, inside kept, flagged stays flagged');
  assert.deepEqual(numbers(bytes, vis2, 0, tableColumn(vis2, 'VIS2DATA')), [0.4, 0.5, 0.6], 'measurements untouched');
  assert.ok(Math.abs(numbers(bytes, wave, 1, tableColumn(wave, 'EFF_WAVE'))[0]! - 2.29e-6 / 1.0054) < 1e-15);
  assert.throws(() => selectOifits(input, { wavelengthScale: 2 }), /spectrograph/u);
  const timed = (mjd: number) => binaryTableHdu('OI_VIS2', [{ name: 'VIS2DATA', form: '3D' }, { name: 'MJD', form: 'D' }, { name: 'FLAG', form: '3L' }], [[[0.4, 0.5, 0.6], mjd, [false, false, false]]], [['INSNAME', 'TEST']]);
  const nights = Buffer.concat([primaryHdu(), binaryTableHdu('OI_WAVELENGTH', [{ name: 'EFF_WAVE', form: 'D' }, { name: 'EFF_BAND', form: 'D' }], wavelengths.map(w => [w, 1e-8]), [['INSNAME', 'TEST']]), timed(56925.1), timed(56929.2)]);
  const first = selectOifits(nights, { mjdRange: [56925, 56926] });
  assert.equal(first.keptVis2, 3); assert.equal(first.newlyFlaggedVis2, 3, 'the other night is flagged whole');
  const even = selectOifits(nights, { half: 'even' }), odd = selectOifits(nights, { half: 'odd' });
  assert.deepEqual([even.keptVis2, odd.keptVis2], [3, 3], 'the two exposure times fall in different halves');
});
