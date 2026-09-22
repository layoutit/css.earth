import { sourceTest } from '../../source-test.mts';
const test = sourceTest('itokawa');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeAmicaGeo } from '../../../../tools/objects/terrestrial-layers/amica-geo.mts';
import { fitBackplaneCamera, fitBackplaneSun } from '../../../../tools/objects/surface-observations/cameras.mts';
const root = resolve('src/objects/itokawa/source'), read = (name: string) => readFile(resolve(root, name));
const [cube,label,original,flat] = await Promise.all([
  read('observations/st_2417589964_v_ddr.img.gz'), read('observations/st_2417589964_v_ddr.lbl'),
  read('observations/st_2417589964_v.fit'), read('observations/flat_v.fit')]);
const decode = (originalBytes = original, flatBytes = flat, labelBytes = label) => decodeAmicaGeo(cube, labelBytes.toString(), originalBytes, flatBytes);
const frame = decode();

test('AMICA matches the original detector orientation and independent Astropy calibration anchors', () => {
  const index = 498 * 1024 + 563;
  assert.equal(frame.qualityReport.matchedOriginalPixels, 1048576);
  assert.deepEqual(frame.xyz(index), [0.04539721831679344, 0.10373543202877045, 0.010868753306567669]);
  assert.ok(Math.abs(frame.planes.IMAGE[index] - 1572.937123636729) < .0001);
  assert.ok(frame.valid(index) && frame.acceptPixel(index));
  const camera = fitBackplaneCamera(frame);
  assert.equal(camera.fitPixels, 843); assert.equal(camera.holdoutPixels, 149714);
  assert.ok(camera.maximumResidualPixels < .000021);
});

test('AMICA rejects mismatched original observations and unqualified onboard processing', () => {
  const changed = Buffer.from(original), headerEnd = changed.indexOf('END'.padEnd(80));
  const offset = Math.ceil((headerEnd + 80) / 2880) * 2880;
  changed[offset + (1023 - 498) * 1024 + 563]++;
  assert.throws(() => decode(changed), /differs from its original FITS/);
  assert.throws(() => decode(Buffer.from(original.toString('latin1').replace("'DIFF    '", "'SUM     '"), 'latin1')), /paired-exposure/);
  assert.throws(() => decode(original, flat, Buffer.from(label.toString().replace('IEEE_REAL','PC_REAL'))), /DDR layout/);
});

test('AMICA withholds defective flat-field samples without altering geometry', () => {
  const changed = Buffer.from(flat), headerEnd = changed.indexOf('END'.padEnd(80));
  const offset = Math.ceil((headerEnd + 80) / 2880) * 2880;
  changed.writeFloatBE(0, offset + ((1023 - 498) * 1024 + 563) * 4);
  const rejected = decode(original, changed);
  assert.ok(rejected.valid(498 * 1024 + 563));
  assert.equal(rejected.acceptPixel(498 * 1024 + 563), false);
});

test('the Sun fitted from the phase plane is the Sun the Gaskell SUM file states', async () => {
  // The SUM file's SZ line is the Sun direction in the body frame; the fit uses only the archive's phase plane and surface points.
  const [cube2, label2, original2, sum] = await Promise.all([read('observations/st_2402987304_v_ddr.img.gz'), read('observations/st_2402987304_v_ddr.lbl'), read('observations/st_2402987304_v.fit'), read('observations/N2402987304.SUM')]);
  const decoded = decodeAmicaGeo(cube2, label2.toString(), original2, flat);
  const stated = sum.toString().split('\n').find(line => /\bSZ\b/.test(line))!.trim().split(/\s+/).slice(0, 3).map(n => Number(n.replace(/[dD]/, 'e')));
  const fit = fitBackplaneSun(decoded, fitBackplaneCamera(decoded).positionKm);
  assert.ok(fit, 'the AMICA backplanes carry a phase plane');
  const angle = Math.acos(Math.min(1, fit.sunDirection.reduce((total, n, k) => total + n * stated[k], 0))) * 180 / Math.PI;
  assert.ok(angle < 0.1, `fitted Sun is ${angle.toFixed(3)}° from the SUM file's SZ (holdout RMS ${fit.fit.rmsDegrees.toFixed(4)}°)`);
});
