import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { displayLimbExponents, exponentAt, readSaturnAlbedo } from './display-limb.mts';

const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);

test('an exponent is interpolated between two filters and held outside them', () => {
  const filters = [{ wavelengthNm: 600, coefficient: 0.8 }, { wavelengthNm: 400, coefficient: 0.4 }];
  assert.equal(exponentAt(filters, 380), 0.4);
  assert.ok(Math.abs(exponentAt(filters, 450) - 0.5) < 1e-12);
  assert.equal(exponentAt(filters, 700), 0.8);
  assert.throws(() => exponentAt([], 500), /at least one filter/);
});

test('one filter gives every display channel its exponent', () => {
  const result = displayLimbExponents({ filters: [{ wavelengthNm: 550, coefficient: 0.7 }], light: () => 1, colorMatching, maximumEmissionDegrees: 86.3 });
  assert.deepEqual(result.map(channel => channel.coefficient), [0.7, 0.7, 0.7]);
  for (const channel of result) { assert.ok(channel.departure < 1e-9); assert.ok(Math.abs(channel.discMean - 2 / 2.4) < 1e-12); }
});

test('a channel takes the exponents of the wavelengths it shows', () => {
  const filters = [{ wavelengthNm: 450, coefficient: 0.6 }, { wavelengthNm: 650, coefficient: 0.9 }];
  const [red, green, blue] = displayLimbExponents({ filters, light: () => 1, colorMatching, maximumEmissionDegrees: 86.3 });
  // An sRGB primary weighs some wavelengths negatively, so a channel's exponent may lie outside the filters' range.
  assert.ok(blue!.coefficient < green!.coefficient && green!.coefficient < red!.coefficient);
  // The light's spectrum is part of the weight: another spectrum gives other exponents.
  const reddened = displayLimbExponents({ filters, light: wavelength => wavelength ** 4, colorMatching, maximumEmissionDegrees: 86.3 });
  assert.notDeepEqual(reddened.map(channel => channel.coefficient), [red!.coefficient, green!.coefficient, blue!.coefficient]);
});

test('the albedo table is read by column, past 1,000 nm too', () => {
  const rows = [' 300.4  300.31   .0000 .2128 .2532 .5306 .6933 .0431', ' 600.0  599.83   .0010 .5000 .5000 .5000 .5000 .5000', '1049.2 1048.89   .2688 .3974 .5348 .0704 .0444 .1821'];
  const albedo = readSaturnAlbedo(rows.join('\r\n') + '\r\n');
  assert.ok(Math.abs(albedo(599.83) - 0.5) < 1e-12);
  assert.ok(albedo(450) > 0.2532 && albedo(450) < 0.5);
  assert.throws(() => readSaturnAlbedo(rows.slice(0, 2).join('\n')), /380-780 nm/);
  assert.throws(() => readSaturnAlbedo('1 2 3\n4 5 6'), /1995LOW/);
});
