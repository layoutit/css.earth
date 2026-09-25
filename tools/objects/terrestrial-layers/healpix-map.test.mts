/** The HEALPix map reader: astropy-healpix places every point in its pixel, RING and NESTED alike, and Luhman 16 B's deposited maps
 * are read as Ureshino et al. (2026) drew them. */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { astroqueryToolchain } from '@cssearth/telescope/node';
import { loadHealpixNpyMap } from './healpix-map.mts';

const test = sourceTest();
test.before(async () => { await astroqueryToolchain(); });

/** A float64 .npy vector. */
function npy(values: readonly number[]) {
  let header = `{'descr': '<f8', 'fortran_order': False, 'shape': (${values.length},), }`;
  while ((10 + header.length + 1) % 64) header += ' ';
  header += '\n';
  const head = Buffer.alloc(10); head.write('\x93NUMPY', 0, 'latin1'); head[6] = 1; head[7] = 0; head.writeUInt16LE(header.length, 8);
  const data = Buffer.alloc(values.length * 8); values.forEach((v, i) => data.writeDoubleLE(v, i * 8));
  return Buffer.concat([head, Buffer.from(header, 'latin1'), data]);
}

test('each point takes the value of the HEALPix pixel that contains it, in RING and NESTED order', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'healpix-map-'));
  try {
    // NSIDE 1: every pixel's value is its own index. Pixel centres (Gorski et al. 2005): RING 0-3 at latitude 41.81 and longitude
    // 45, 135, 225, 315; 4-7 on the equator at 0, 90, 180, 270; 8-11 at -41.81. NESTED numbers the same base pixels 0, 1, 2, 3 north,
    // 4, 5, 6, 7 equator, 8-11 south, but starts its equatorial row at longitude 0 too, so at NSIDE 1 the two orders coincide.
    await writeFile(resolve(work, 'index.npy'), npy(Array.from({ length: 12 }, (_, i) => i)));
    for (const ordering of ['ring', 'nested']) {
      const map = await loadHealpixNpyMap(work, { path: 'index.npy', ordering, transform: 'value', interpolation: 'pixel' });
      const north = 41.8103148958, centres = [[45, north], [135, north], [225, north], [315, north], [0, 0], [90, 0], [180, 0], [270, 0], [45, -north], [135, -north], [225, -north], [315, -north]];
      centres.forEach(([lon, lat], i) => assert.equal(map.sample(lon! > 180 ? lon! - 360 : lon!, lat!), i, `${ordering} pixel ${i}`));
    }
    // NSIDE 2 tells the orders apart: the pixel centred at longitude 45, latitude 66.44 is RING 0 (the first of the polar cap) and NESTED 3
    // (the northern corner of base pixel 0).
    await writeFile(resolve(work, 'index2.npy'), npy(Array.from({ length: 48 }, (_, i) => i)));
    assert.equal((await loadHealpixNpyMap(work, { path: 'index2.npy', ordering: 'ring', transform: 'value', interpolation: 'pixel' })).sample(45, 66.4421870779), 0);
    assert.equal((await loadHealpixNpyMap(work, { path: 'index2.npy', ordering: 'nested', transform: 'value', interpolation: 'pixel' })).sample(45, 66.4421870779), 3);
    // Bilinear interpolation keeps each pixel centre at its value and never leaves the range of the four pixels around a point.
    const smooth = await loadHealpixNpyMap(work, { path: 'index2.npy', ordering: 'ring', transform: 'value', interpolation: 'bilinear' });
    // RING pixel 20 is the first of the equatorial ring at NSIDE 2, centred at longitude 22.5, latitude 0: a node of the lookup grid.
    assert.ok(Math.abs(smooth.sample(22.5, 0)! - 20) < 1e-9, `a pixel centre keeps its value: ${smooth.sample(22.5, 0)}`);
    for (let lon = -180; lon < 180; lon += 7) for (let lat = -85; lat <= 85; lat += 5) { const v = smooth.sample(lon, lat)!; assert.ok(v >= 0 && v <= 47, `${lon},${lat}: ${v}`); }
    await assert.rejects(loadHealpixNpyMap(work, { path: 'index2.npy', ordering: 'ring', transform: 'value', interpolation: 'blur' }), /pixel or bilinear/u);
    // A variance is drawn as its standard deviation; a negative variance is refused.
    await writeFile(resolve(work, 'variance.npy'), npy(Array.from({ length: 12 }, () => 4)));
    assert.equal((await loadHealpixNpyMap(work, { path: 'variance.npy', ordering: 'ring', transform: 'sqrt', interpolation: 'pixel' })).sample(0, 0), 2);
    await writeFile(resolve(work, 'negative.npy'), npy([-1, ...Array.from({ length: 11 }, () => 1)]));
    await assert.rejects(loadHealpixNpyMap(work, { path: 'negative.npy', ordering: 'ring', transform: 'sqrt', interpolation: 'pixel' }), /no square root/u);
    await writeFile(resolve(work, 'short.npy'), npy([1, 2, 3]));
    await assert.rejects(loadHealpixNpyMap(work, { path: 'short.npy', ordering: 'ring', transform: 'value', interpolation: 'pixel' }), /12 NSIDE/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

const luhman = sourceTest('luhman-16b');
luhman('Luhman 16 B: the deposited map has its dark patch just east of noon on the equator and its brightest pixels near the north pole', async () => {
  const root = new URL('../../../src/objects/luhman-16b/source/', import.meta.url).pathname;
  const mean = await loadHealpixNpyMap(root, { path: 'science/ureshino-2026/posterior_mean_chip1.npy', ordering: 'ring', transform: 'value', interpolation: 'pixel' });
  const report = mean.report as { nside: number; minimum: number; maximum: number };
  // As drawn (bilinear between pixel centres) the map keeps the deposited range: no point is darker or brighter than a pixel.
  const drawn = await loadHealpixNpyMap(root, { path: 'science/ureshino-2026/posterior_mean_chip1.npy', ordering: 'ring', transform: 'value', interpolation: 'bilinear' });
  for (let lat = -89.5; lat < 90; lat += 2) for (let lon = -179.5; lon < 180; lon += 2) {
    const v = drawn.sample(lon, lat)!; assert.ok(v >= report.minimum - 1e-12 && v <= report.maximum + 1e-12, `${lon},${lat}`);
  }
  assert.equal(report.nside, 8);
  let darkest = { value: Infinity, lon: 0, lat: 0 }, brightest = { value: -Infinity, lon: 0, lat: 0 };
  for (let lat = -89.5; lat < 90; lat++) for (let lon = -179.5; lon < 180; lon++) {
    const v = mean.sample(lon, lat)!;
    if (v < darkest.value) darkest = { value: v, lon, lat };
    if (v > brightest.value) brightest = { value: v, lon, lat };
  }
  // Measured 2026-09-23: the darkest pixel is at 27.5 E, 3.5 S, and the dark region (below 0.0067) reaches from 14 S to 48 N, the
  // abstract's large dark region; the brightest pixel is at 48.5 N. The paper's Figure (Mollweide, east to the right) shows both there.
  assert.ok(darkest.lon > 0 && darkest.lon < 30 && Math.abs(darkest.lat) < 25, JSON.stringify(darkest));
  assert.ok(brightest.lat > 40, JSON.stringify(brightest));
  assert.equal(darkest.value, report.minimum);
  const sigma = await loadHealpixNpyMap(root, { path: 'science/ureshino-2026/posterior_var_chip1.npy', ordering: 'ring', transform: 'sqrt', interpolation: 'pixel' });
  const spread = sigma.report as { minimum: number; maximum: number };
  // One standard deviation is 0.0012 to 0.0016, about half of the whole brightness range, 0.0026: features are one to two sigma deep.
  assert.ok(spread.minimum > 0.0012 && spread.maximum < 0.00162, JSON.stringify(spread));
  assert.ok((report.maximum - report.minimum) / spread.maximum < 2, 'the full contrast is under two standard deviations');
});
