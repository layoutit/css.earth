/** The Tecplot longitude-latitude map reader, and ι Horologii's deposited ZDI maps read against the paper's own numbers. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { loadTecplotLonLatMap, parseTecplotLonLat } from './tecplot-lonlat-map.mts';

const test = sourceTest();

/** A Tecplot POINT table on a 5 x 3 grid (longitude 0-360 by 90, latitude -90-90 by 90) whose value is longitude + latitude. */
function table(values = (lon: number, lat: number) => lon + lat, header = '"Longitude [Deg]" "Latitude [Deg]" "B [G]"') {
  const rows = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) rows.push(`${i * 90} ${-90 + j * 90} ${values(i * 90, -90 + j * 90)}`);
  return `TITLE = "test"\nVARIABLES = ${header}\nZONE I=5, J=3, K=1, ZONETYPE=Ordered\nDATAPACKING=POINT\nDT=(SINGLE SINGLE SINGLE)\n${rows.join('\n')}\n`;
}

test('a Tecplot map is bilinear between its nodes, keeps every node value, and draws the limits the paper draws', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'tecplot-'));
  try {
    await writeFile(resolve(work, 'map.dat'), table());
    const map = await loadTecplotLonLatMap(work, { path: 'map.dat', variable: 'B [G]', outlineLatitudes: [-60] });
    assert.equal(map.sample(90, 0), 90);
    assert.equal(map.sample(45, 45), 90, 'halfway between nodes');
    assert.equal(map.sample(-90, 0), 270, 'longitude -90 is 270 east');
    assert.equal(map.outline!(10, -60, 0.5), true);
    assert.equal(map.outline!(10, -59, 0.5), false);
    await assert.rejects(loadTecplotLonLatMap(work, { path: 'map.dat', variable: 'B_R' }), /no map variable "B_R"/u);
    await writeFile(resolve(work, 'swapped.dat'), table(undefined, '"Latitude [Deg]" "Longitude [Deg]" "B [G]"'));
    await assert.rejects(loadTecplotLonLatMap(work, { path: 'swapped.dat', variable: 'B [G]' }), /longitude and latitude/u);
    await writeFile(resolve(work, 'irregular.dat'), table().replace('\n90 -90 ', '\n91 -90 '));
    await assert.rejects(loadTecplotLonLatMap(work, { path: 'irregular.dat', variable: 'B [G]' }), /node 1 is at 91/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

const iota = sourceTest('iota-horologii');
iota('ι Horologii: every deposited epoch reproduces the field energy of the paper\'s Table 3, and its maps span the paper\'s colour scale', async () => {
  const root = new URL('../../../src/objects/iota-horologii/source/science/alvarado-gomez-2025/', import.meta.url).pathname;
  // Alvarado-Gomez et al. (2025, A&A 704, A68), Table 3: <B^2> in G^2 for epochs 1-18, from the spherical-harmonic fits.
  const paper = [61.7, 217.2, 157.0, 38.8, 43.2, 68.3, 39.3, 61.1, 121.5, 39.6, 41.7, 42.9, 72.8, 167.0, 187.6, 91.8, 31.0, 135.4];
  let largest = 0;
  const ratios = [];
  for (let n = 1; n <= 18; n++) {
    const path = `iHor_ZDI-Unconstrained_Epoch_${String(n).padStart(2, '0')}.dat`, grid = parseTecplotLonLat(await readFile(resolve(root, path), 'utf8'), path);
    assert.deepEqual([grid.columns, grid.rows], [89, 45]);
    let sum = 0, weights = 0;
    for (const [lon, lat, br, ba, bm] of grid.values) {
      if (lon! >= 360) continue;
      const w = Math.cos(lat! * Math.PI / 180); sum += w * (br! ** 2 + ba! ** 2 + bm! ** 2); weights += w;
      largest = Math.max(largest, Math.abs(br!), Math.abs(ba!));
    }
    ratios.push(paper[n - 1]! / (sum / weights));
  }
  // Measured 2026-09-23: the table is 2 pi times the maps' area-mean B^2 at every epoch, 0.02 % to 2.9 % above it and never below.
  // The paper does not state its normalisation; one factor across 18 unrelated maps shows these files are the maps it measured.
  for (const [i, ratio] of ratios.entries()) assert.ok(ratio / (2 * Math.PI) - 1 > 0 && ratio / (2 * Math.PI) - 1 < 0.03, `epoch ${i + 1}: ${ratio}`);
  // The strongest radial or azimuthal field in the 18 maps is 16.4 G; the paper's colour bar runs to +/-12 G and saturates beyond.
  assert.ok(largest > 12 && largest < 17, `${largest}`);
});
