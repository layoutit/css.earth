import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('io');
import { required } from "../../../../tools/contract/test-values.mts";
import { parseInterpreterRecipe } from "../../../../tools/objects/observation/interpret.mts";
import { loadPdsFloatMap } from "../../../../tools/objects/terrestrial-layers/pds-float-map.mts";

const sourceRoot = resolve(import.meta.dirname, "../../../../src/objects/io/source");
const recipe = parseInterpreterRecipe(JSON.parse(await readFile(resolve(sourceRoot, "preparation/raster.json"), "utf8")));
const science = required(recipe.surfaces.find(surface => surface.id === "volcanic-heat")?.science);
const map = await loadPdsFloatMap(sourceRoot, science);
const RADIUS_M = 1821.49e3, STEP = 0.5, r = Math.PI / 180;

const separation = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const cos = Math.sin(a.latitude * r) * Math.sin(b.latitude * r) + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos((a.longitude - b.longitude) * r);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / r;
};
const cells = function* () { for (let latitude = -89.75; latitude < 90; latitude += STEP) for (let longitude = 0.25; longitude < 360; longitude += STEP) yield { latitude, longitude }; };

/** Local maxima above a radiance, one per 3° neighbourhood, read through the lens's own reader. */
function peaks(minimum: number) {
  const found: { latitude: number; longitude: number; value: number }[] = [];
  for (const { latitude, longitude } of cells()) {
    const value = map.sample(longitude, latitude);
    if (value === null || value < minimum) continue;
    let highest = true;
    for (let dy = -1.5; dy <= 1.5 && highest; dy += STEP) for (let dx = -1.5; dx <= 1.5; dx += STEP) {
      const other = Math.abs(latitude + dy) < 90 ? map.sample((longitude + dx + 360) % 360, latitude + dy) : null;
      if (other !== null && (other > value || (other === value && (dy < 0 || (dy === 0 && dx < 0))))) { highest = false; break; }
    }
    if (highest) found.push({ latitude, longitude, value });
  }
  return found;
}

/** π times radiance above the local background (median of a 3.5–5° ring), integrated within 2.5°: a hot spot's M-band
 * output as Mura et al. (2024) Table 3 states it. Null when any cell within 2.5° is unobserved. */
function outputGW(center: { latitude: number; longitude: number }) {
  const ring: number[] = [], inner: [number, number][] = [];
  for (let dy = -6; dy <= 6; dy += STEP) for (let dx = -12; dx <= 12; dx += STEP) {
    const latitude = center.latitude + dy, longitude = (center.longitude + dx + 360) % 360;
    if (Math.abs(latitude) >= 90) continue;
    const d = separation(center, { latitude, longitude }), value = map.sample(longitude, latitude);
    if (d <= 2.5) { if (value === null) return null; inner.push([value, RADIUS_M ** 2 * Math.cos(latitude * r) * (STEP * r) ** 2]); }
    else if (d >= 3.5 && d <= 5 && value !== null) ring.push(value);
  }
  if (ring.length < 10) return null;
  ring.sort((a, b) => a - b);
  const background = ring[ring.length >> 1]!;
  return Math.PI * inner.reduce((sum, [value, area]) => sum + (value - background) * area, 0) / 1e9;
}

test("the map is night-side band radiance within the paper's range", () => {
  let observed = 0, above = 0;
  for (const { latitude, longitude } of cells()) {
    const value = map.sample(longitude, latitude);
    if (value === null) continue;
    observed++; if (value > 0.15) above++;
  }
  // Measured 2026-09-21: 57,224 of 259,200 cells (22%), from orbits 41, 43, 47 and 49.
  assert.ok(observed > 0.2 * 720 * 360, `${observed} night-side cells`);
  // Mura et al. (2024), Figure 2, tops its scale at 0.15 W sr-1 m-2; only hot-spot cores exceed it.
  assert.ok(above < 0.002 * observed, `${above} cells above 0.15`);
});

test("hot-spot output matches Mura et al. (2024) Table 3", async () => {
  const table = JSON.parse(await readFile(resolve(sourceRoot, "science/mura-2024/table3-m-band.json"), "utf8")) as { rows: { latitude: number; longitudeWest: number; mBandOutputGW: Record<string, number> }[] };
  const ratios: number[] = [];
  for (const row of table.rows) {
    const values = Object.values(row.mBandOutputGW).sort((a, b) => a - b), paper = values[values.length >> 1]!;
    const ours = outputGW({ latitude: row.latitude, longitude: (360 - row.longitudeWest) % 360 });
    if (ours !== null && paper > 0) ratios.push(ours / paper);
  }
  ratios.sort((a, b) => a - b);
  const median = ratios[ratios.length >> 1]!;
  // Measured 2026-09-21: 46 hot spots fully observed, median ratio 0.83 (middle half 0.46 to 1.11) against the median of
  // the paper's orbits. The paper finds single hot spots varying by about 40% between orbits.
  assert.ok(ratios.length >= 40, `${ratios.length} hot spots compared`);
  assert.ok(median > 0.65 && median < 1.25, `median ratio ${median.toFixed(2)}`);
});

test("bright spots are Davies et al. (2024) hot spots, at east longitudes", async () => {
  const text = await readFile(resolve(sourceRoot, "science/davies-2024/psjad4346t10_mrt.txt"), "utf8");
  const sources = text.split("\n").filter(line => /^\s*\d+\s/u.test(line) && line.length >= 72)
    .map(line => ({ latitude: Number(line.slice(37, 42)), longitude: (360 - Number(line.slice(43, 48))) % 360 }));
  assert.equal(sources.length, 343);
  const nearest = (point: { latitude: number; longitude: number }) => Math.min(...sources.map(source => separation(point, source)));
  const bright = peaks(0.03);
  const matched = bright.filter(peak => nearest(peak) <= 3).length;
  const mirrored = bright.filter(peak => nearest({ latitude: peak.latitude, longitude: (360 - peak.longitude) % 360 }) <= 3).length;
  // Measured 2026-09-21: 24 peaks above 0.03 W sr-1 m-2; 22 lie within 3° of a catalogued source, 4 when mirrored.
  assert.ok(bright.length >= 20, `${bright.length} peaks`);
  assert.ok(matched >= 0.85 * bright.length, `${matched} of ${bright.length} peaks within 3° of a catalogued hot spot`);
  assert.ok(mirrored <= 0.3 * bright.length, `${mirrored} of ${bright.length} peaks match when mirrored`);
});
