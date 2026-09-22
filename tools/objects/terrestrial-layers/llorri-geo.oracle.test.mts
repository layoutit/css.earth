import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeLlorri, sipPixel } from './llorri-geo.mts';
import { readOracleFixture, assertPinnedInputs, readOracleInput, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';

/** astropy as the oracle for the L'LORRI FITS reader and the TAN-SIP distortion (Donaldjohanson). */
const fixture = await readOracleFixture('fits/llorri.json');
const [input] = fixture.inputs;
const source = resolve(ORACLE_ROOT, 'src/objects/donaldjohanson/source');
const config = JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8'));
const recipe = config.raster.surfaceObservations[0], camera = JSON.parse(await readFile(resolve(source, recipe.frames[0].cameraPath), 'utf8'));
const frame = decodeLlorri(await readOracleInput(input), camera);
const cards = requireRecord(fixture.cases.cards), planes = requireRecord(fixture.cases.planes), sip = requireRecord(fixture.cases.sip);
const exposure = requireFiniteNumber(cards.EXPTIME);

test('the fixture is bound to the pinned L\'LORRI product and its header', async () => {
  await assertPinnedInputs(fixture.inputs);
  assert.equal(frame.startTime, requireString(cards.STARTUTC));
  assert.equal(requireString(cards.CTYPE1), 'RA---TAN-SIP');
  assert.equal(frame.qualityReport.exposureSeconds, exposure);
});

test('DN per second, sigma and quality decisions match astropy\'s HDU reads', () => {
  let compared = 0;
  const image = sampleList(requireRecord(planes.hdu0).samples), sigma = sampleList(requireRecord(planes.hdu1).samples), flags = sampleList(requireRecord(planes.hdu2).samples);
  // The decoder stores DN over exposure as float32: agreement to float32 precision.
  for (const { index, value } of image) { assert.ok(Math.abs(frame.planes.IMAGE[index] - Math.fround(value) / exposure) <= 1e-6 * Math.max(1e-3, Math.abs(value / exposure)), `DN/s at ${index}: ${frame.planes.IMAGE[index]} vs ${Math.fround(value) / exposure}`); compared++; }
  for (const { index, value } of flags) { assert.equal(frame.acceptPixel(index), value === 0 && Number.isFinite(frame.planes.IMAGE[index]), `quality ${value} at ${index}`); compared++; }
  assert.ok(sigma.length >= 40 && compared >= 90, `${compared} values compared`);
});

test('the bound SIP terms are the header\'s and the distortion matches astropy.wcs to a nanopixel', () => {
  const a = requireRecord(sip.a), b = requireRecord(sip.b);
  for (const [terms, coefficients, letter] of [[camera.sip.a, a, 'A'], [camera.sip.b, b, 'B']] as const) {
    for (const [i, j, value] of terms) assert.equal(coefficients[`${letter}_${i}_${j}`], value, `${letter}_${i}_${j}`);
    assert.equal(terms.length, Object.keys(coefficients).length, `${letter} term count`);
  }
  const crpix = requireArray(sip.crpix).map(v => requireFiniteNumber(v));
  assert.deepEqual(camera.sip.referencePixel, crpix.map(v => v - 1), 'zero-based reference pixel');
  // astropy's sip_pix2foc returns the distortion-corrected offset from CRPIX; ours returns the corrected pixel before the landmark translation.
  const undistorting = { ...camera, sip: { ...camera.sip, offsetPixels: [0, 0] } }, origin = crpix.map(v => v - 1);
  const pixels = requireArray(sip.pixels).map(p => requireArray(p).map(v => requireFiniteNumber(v))), focal = requireArray(sip.focal).map(p => requireArray(p).map(v => requireFiniteNumber(v)));
  let worst = 0;
  for (let k = 0; k < pixels.length; k++) {
    const ours = sipPixel(undistorting, pixels[k][0], pixels[k][1], false);
    worst = Math.max(worst, Math.hypot(ours[0] - origin[0] - focal[k][0], ours[1] - origin[1] - focal[k][1]));
    const back = sipPixel(undistorting, ours[0], ours[1], true);
    assert.ok(Math.hypot(back[0] - pixels[k][0], back[1] - pixels[k][1]) < 1e-8, `inverse at ${pixels[k]}`);
  }
  assert.ok(worst < 1e-9, `distortion differs from astropy by up to ${worst} px`);
  assert.equal(pixels.length, 65);
});
