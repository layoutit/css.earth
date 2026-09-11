import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeAmicaGeo } from '../../../../tools/objects/terrestrial-layers/amica-geo.mts';
import { calibrateGeoCamera } from '../../../../tools/objects/terrestrial-layers/observed-geo-surface.mts';
const root = resolve('src/planets/itokawa/source'), read = (name: string) => readFile(resolve(root, name));
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
  const camera = calibrateGeoCamera(frame);
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
