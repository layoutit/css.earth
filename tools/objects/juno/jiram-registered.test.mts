import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { planetographicPoint, registerFrame, WIDTH, HEIGHT, type RegisteredPlanes } from './jiram-registered.mts';
import { observationTimes, parseRegisteredRecipe } from './jiram-registered-mosaic.mts';

test('planetographic west-positive coordinates recover the triaxial surface', () => {
  const radii = [1829.4, 1819.4, 1815.7];
  assert.deepEqual(planetographicPoint(0, 0, radii), [1829.4, 0, 0]);
  const west = planetographicPoint(0, 90, radii);
  assert.ok(Math.abs(west[0]) < 1e-10 && Math.abs(west[1] + 1819.4) < 1e-10);
  // recpgr latitude is the normal to an oblate a/c spheroid. On its x/z
  // meridian the inverse has an analytic geocentric latitude.
  const point = planetographicPoint(45, 0, radii);
  assert.ok(Math.abs(Math.atan2(point[2], point[0]) - Math.atan((radii[2] / radii[0]) ** 2)) < 1e-12);
  for (const lat of [-80, -35, 10, 65]) for (const lon of [23, 150, 290]) {
    const p = planetographicPoint(lat, lon, radii);
    assert.ok(Math.abs(p.reduce((s, v, k) => s + (v / radii[k]) ** 2, 0) - 1) < 1e-12);
  }
});

test('archived geometry transfers to a camera while saturation and night masks survive', () => {
  // Independent ray/oblate-spheroid intersections for a known pinhole camera.
  const radii = [400, 400, 300], distance = 1200, focal = 432, cells = WIDTH * HEIGHT;
  const planes: RegisteredPlanes = { radiance: new Float64Array(cells), latitude: new Float64Array(cells).fill(-1024),
    longitude: new Float64Array(cells).fill(-1024), emission: new Float64Array(cells).fill(-1024),
    range: new Float64Array(cells).fill(-1024), saturation: new Float64Array(cells) };
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x, d = [(x - 216) / focal, (y - 64) / focal, -1];
    planes.radiance[i] = .02 + x * .0001;
    const A = (d[0] ** 2 + d[1] ** 2) / 400 ** 2 + 1 / 300 ** 2, B = -2 * distance / 300 ** 2, C = distance ** 2 / 300 ** 2 - 1;
    if (B * B - 4 * A * C < 0) continue;
    const t = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A), p = [t * d[0], t * d[1], distance - t];
    const n = p.map((v, k) => v / radii[k] ** 2), v = [-p[0], -p[1], distance - p[2]];
    planes.latitude[i] = Math.atan2(p[2] / 300 ** 2, Math.hypot(p[0], p[1]) / 400 ** 2) * 180 / Math.PI;
    planes.longitude[i] = (360 - Math.atan2(p[1], p[0]) * 180 / Math.PI) % 360;
    planes.emission[i] = Math.acos(n.reduce((s, a, k) => s + a * v[k], 0) / Math.hypot(...n) / Math.hypot(...v)) * 180 / Math.PI;
    planes.range[i] = Math.hypot(...v);
  }
  const hot = 64 * WIDTH + 216, saturated = hot + 1;
  planes.radiance[hot] += .1; planes.radiance[saturated] = 5; planes.saturation[saturated] = 255;
  const policy = { maximumEmissionDegrees: 75, terminatorFootprints: 2, minimumBackgroundSamples: 32, maximumResidualPixels: .25, maximumRangeFraction: .01 };
  const result = registerFrame(planes, radii, [0, 0, -1], policy);
  assert.ok(result.camera && result.values, result.rejected ?? 'expected a registered camera');
  assert.ok(Math.abs(result.camera.positionKm[2] - distance) < 1e-6);
  assert.ok(Math.abs(result.values[hot] - .1) < 1e-7);
  assert.ok(Number.isNaN(result.values[saturated]));
  assert.ok(registerFrame(planes, radii, [0, 0, 1], policy).rejected, 'daylight must not set a background');
  const wrongRange = { ...planes, range: planes.range.map(v => v > 0 ? v * 2 : v) };
  assert.equal(registerFrame(wrongRange, radii, [0, 0, -1], policy).rejected, 'camera disagrees with archived geometry');
});

test('PDS times use exact exposures, including day-of-year rollover', () => {
  const id = 'JIR_IMG_RDR_2020001T000002_V01';
  const header = 'header';
  const row = `"RDR","IMAGE","JNO-J-JIRAM-3-RDR-V1.0","${id}",2019-365T23:59:59.999,2020-001T00:00:00.009,"DATA/${id}.LBL","date","digest"`;
  assert.deepEqual(observationTimes(`${header}\n${row}`).get(id), { utc: '2019-12-31T23:59:59.999Z', exposureSeconds: .01 });
  assert.throws(() => observationTimes(`${header}\n${row}\n${row}`), /duplicate/u);
  assert.throws(() => observationTimes(`${header}\n${row.replace('JNO-J-JIRAM-3', 'OTHER')}`), /Unexpected/u);
});

test('registered recipes reject relaxed frame counts and unsupported grid sizes', async () => {
  const raw = JSON.parse(await readFile(new URL('../../../src/objects/io/source/science/jiram/perry-recipe.json', import.meta.url), 'utf8'));
  assert.equal(parseRegisteredRecipe(raw).output.pixelsPerDegree, 4);
  assert.throws(() => parseRegisteredRecipe({ ...raw, policy: { ...raw.policy, minimumFramesPerVisit: 1 } }), /policy/u);
  assert.throws(() => parseRegisteredRecipe({ ...raw, output: { ...raw.output, pixelsPerDegree: 90 } }), /policy/u);
});
