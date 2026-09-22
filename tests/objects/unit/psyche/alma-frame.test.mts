import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('psyche');
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { spinOrientation } from '../../../../tools/objects/terrestrial-layers/observer-camera.mts';
import { loadSpinFrameTransfer, readNpy } from '../../../../tools/objects/terrestrial-layers/npy-lonlat-grid.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

/**
 * The ALMA thermal maps are published in the Shepard et al. (2021) body frame; the lenses ride the ADAM mesh. Two
 * independent routes must agree on where a map longitude lands: the published spin states (checked against the ALMA
 * paper's own sub-observer longitudes) and the shape alone (the release's altitude map against the ADAM mesh).
 */
const root = resolve(import.meta.dirname, '../../../../src/objects/psyche/source');
const json = async (path: string) => requireRecord(JSON.parse(await readFile(resolve(root, path), 'utf8')));
const frame = await json('thermal/alma-body-frame.json');
const gridSpin = requireRecord(requireRecord(frame.grid).spin);
const spin = {
  longitudeDegrees: requireFiniteNumber(gridSpin.longitudeDegrees), latitudeDegrees: requireFiniteNumber(gridSpin.latitudeDegrees),
  periodHours: requireFiniteNumber(gridSpin.periodHours), epochJd: requireFiniteNumber(gridSpin.epochJd), phaseDegrees: requireFiniteNumber(gridSpin.phaseDegrees),
};
const tdbMinusUtcDays = requireFiniteNumber(requireRecord(frame.timeScales).tdbMinusUtcSeconds) / 86400;
const DEGREE = Math.PI / 180, wrap180 = (x: number) => ((x % 360) + 540) % 360 - 180;
const direction = (lon: number, lat: number) => [Math.cos(lat * DEGREE) * Math.cos(lon * DEGREE), Math.cos(lat * DEGREE) * Math.sin(lon * DEGREE), Math.sin(lat * DEGREE)];

test('the grid spin state reproduces every ALMA sub-observer longitude in de Kleer et al. (2021) Table 1, in TDB', async t => {
  const table = await json('reference/de-kleer-2021-table1.json');
  const horizons = await readFile(resolve(root, 'reference/horizons-alma-2019-06-19.txt'), 'utf8');
  const vectors = horizons.slice(horizons.indexOf('$$SOE') + 5, horizons.indexOf('$$EOE')).trim().split('\n')
    .map(line => line.split(',').map(cell => cell.trim())).map(cells => ({ jd: Number(cells[0]), position: [2, 3, 4].map(i => Number(cells[i])) }));
  const rows = requireArray(table.rows).map(value => requireRecord(value));
  assert.equal(rows.length, 22); assert.equal(vectors.length, 22);
  const residuals = (offsetDays: number) => rows.map((row, i) => {
    const jd = ['startUtc', 'endUtc'].map(key => requireString(row[key]).split(':').map(Number))
      .map(([h, m, s]) => 2458653.5 + (h + m / 60 + s / 3600) / 24).reduce((a, b) => a + b) / 2;
    const { position } = vectors[i];
    assert.ok(Math.abs(vectors[i].jd - jd) < 1e-5, `Horizons row ${i + 1} is at the image midpoint`);
    const range = Math.hypot(...position), lightDays = range / 299792.458 / 86400;
    const m = spinOrientation(spin).rotation(jd + offsetDays - lightDays), toBody = position.map(v => -v / range);
    const body = m.map(r => r[0] * toBody[0] + r[1] * toBody[1] + r[2] * toBody[2]);
    return { longitude: wrap180(Math.atan2(body[1], body[0]) / DEGREE - requireFiniteNumber(row.subObserverLongitudeDegrees)), latitude: Math.asin(body[2]) / DEGREE };
  });
  const tdb = residuals(tdbMinusUtcDays), utc = residuals(0), mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // Table 1 rounds to whole degrees, so each row may differ by up to half a degree plus the midpoint approximation.
  assert.ok(tdb.every(r => Math.abs(r.longitude) < 0.75), tdb.map(r => r.longitude.toFixed(2)).join(' '));
  assert.ok(Math.abs(mean(tdb.map(r => r.longitude))) < 0.2);
  assert.ok(tdb.every(r => Math.abs(r.latitude - requireFiniteNumber(table.subObserverLatitudeDegrees)) < 0.5));
  // Reading the same state in UTC turns the body 69 s, 1.6 degrees: the stated time scale is the one that fits.
  assert.ok(mean(utc.map(r => r.longitude)) > 1.2);
  const spread = Math.sqrt(mean(tdb.map(r => (r.longitude - mean(tdb.map(x => x.longitude))) ** 2)));
  t.diagnostic(`TDB mean ${mean(tdb.map(r => r.longitude)).toFixed(2)} deg, scatter ${spread.toFixed(2)}, max ${Math.max(...tdb.map(r => Math.abs(r.longitude))).toFixed(2)}; UTC mean ${mean(utc.map(r => r.longitude)).toFixed(2)}; latitude ${tdb[0].latitude.toFixed(2)}`);
});

const adamPath = resolve(root, 'shape/16_Psyche_adam.obj');
const adamAvailable = await access(adamPath).then(() => true, () => false);

test('the release altitude map registers against the ADAM mesh by shape alone where the spin states place it', { skip: !adamAvailable && 'ADAM mesh not acquired' }, async t => {
  const transfer = await loadSpinFrameTransfer(root, 'thermal/alma-body-frame.json', 'reference/16_Psyche_param.txt');
  const config = await json('preparation/terrestrial.json');
  const adam = requireArray(requireRecord(config.geometry).radialTerrainAlternatives).map(v => requireRecord(v)).find(v => v.lensId === 'zimpol')!;
  const mesh = await loadObjShape(adamPath, adam.grid);
  const longitudes = readNpy(await readFile(resolve(root, 'thermal/LongitudeArray.npy'))).values;
  const latitudes = readNpy(await readFile(resolve(root, 'thermal/LatitudeArray.npy'))).values;
  const altitude = readNpy(await readFile(resolve(root, 'thermal/AltitudeMap.npy'))).values;
  // A centred ellipsoid of free orientation fitted to the mesh vertices, x'Qx = 1, as the release fits one to its own shape.
  const normal = Array.from({ length: 6 }, () => new Array(7).fill(0));
  for (const [x, y, z] of mesh.positions) {
    const row = [x * x, y * y, z * z, 2 * x * y, 2 * x * z, 2 * y * z];
    for (let i = 0; i < 6; i++) { for (let j = 0; j < 6; j++) normal[i][j] += row[i] * row[j]; normal[i][6] += row[i]; }
  }
  for (let i = 0; i < 6; i++) for (let k = i + 1; k < 6; k++) { const f = normal[k][i] / normal[i][i]; for (let j = i; j < 7; j++) normal[k][j] -= f * normal[i][j]; }
  const q = new Array(6).fill(0);
  for (let i = 5; i >= 0; i--) q[i] = (normal[i][6] - normal[i].slice(i + 1, 6).reduce((s, v, j) => s + v * q[i + 1 + j], 0)) / normal[i][i];
  const meshAltitude = (d: number[]) => {
    const hit = mesh.intersect([0, 0, 0], d);
    const quadratic = q[0] * d[0] ** 2 + q[1] * d[1] ** 2 + q[2] * d[2] ** 2 + 2 * (q[3] * d[0] * d[1] + q[4] * d[0] * d[2] + q[5] * d[1] * d[2]);
    return hit ? (hit.radius - 1 / Math.sqrt(quadratic)) / 1000 : NaN;
  };
  const toMesh = transfer.meshToGrid; // grid = M mesh, so mesh = Mᵀ grid
  // Correlate at longitude offsets applied in the grid frame; a mirrored or latitude-flipped reading must lose.
  const correlate = (shift: number, mirror: boolean, flip: boolean) => {
    const a: number[] = [], b: number[] = [];
    latitudes.forEach((lat, row) => {
      if (Math.abs(lat) > 60) return;
      longitudes.forEach((lon, column) => {
        const published = altitude[row * longitudes.length + column];
        if (!Number.isFinite(published) || column === longitudes.length - 1) return;
        const g = direction((mirror ? -lon : lon) + shift, flip ? -lat : lat);
        const d = [0, 1, 2].map(i => toMesh[0][i] * g[0] + toMesh[1][i] * g[1] + toMesh[2][i] * g[2]);
        const value = meshAltitude(d);
        if (Number.isFinite(value)) { a.push(published); b.push(value); }
      });
    });
    const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb);
  };
  const sweep = (mirror: boolean, flip: boolean) => {
    let best = { shift: 0, r: -Infinity };
    for (let shift = -180; shift < 180; shift++) { const r = correlate(shift, mirror, flip); if (r > best.r) best = { shift, r }; }
    return best;
  };
  const stated = sweep(false, false);
  t.diagnostic(`spin-state placement: shape peak at ${stated.shift} deg, r ${stated.r.toFixed(3)} (r at 0: ${correlate(0, false, false).toFixed(3)}); transfer ${JSON.stringify(transfer.report)}`);
  assert.ok(Math.abs(stated.shift) <= 2, `shape peaks ${stated.shift} degrees from the spin-state placement`);
  assert.ok(stated.r > 0.8, `peak correlation ${stated.r.toFixed(3)}`);
  for (const [mirror, flip] of [[true, false], [false, true], [true, true]] as const) {
    const other = sweep(mirror, flip);
    t.diagnostic(`mirror=${mirror} flip=${flip}: peak r ${other.r.toFixed(3)} at ${other.shift} deg`);
    assert.ok(other.r < stated.r - 0.2, `mirror=${mirror} flip=${flip} reaches ${other.r.toFixed(3)}`);
  }
});
