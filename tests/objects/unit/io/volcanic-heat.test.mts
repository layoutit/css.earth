import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { required } from "../../../../tools/test-values.mts";
import { parseInterpreterRecipe } from "../../../../tools/objects/observation/interpret.mts";
import { loadPointTable } from "../../../../tools/objects/terrestrial-layers/mrt-point-table.mts";

const sourceRoot = resolve(import.meta.dirname, "../../../../src/objects/io/source");
const recipe = parseInterpreterRecipe(JSON.parse(await readFile(resolve(sourceRoot, "preparation/raster.json"), "utf8")));
const science = required(recipe.surfaces.find(surface => surface.id === "volcanic-heat")?.science);

test("Davies et al. (2024) Table A1: 343 sources in the Figure 1 power classes", async () => {
  const table = await loadPointTable(sourceRoot, science);
  assert.equal(table.rows.length, 343);
  // Lower bounds are inclusive: Figure 1 shows 7 blue dots, and Michabo Patera at exactly 1.0 GW is green.
  assert.deepEqual(table.report.counts, { "under-1-gw": 7, "1-to-10-gw": 76, "10-to-100-gw": 150, "100-to-1000-gw": 101, "1000-to-10000-gw": 9 });
});

test("west table longitudes land on the IAU Gazetteer's east longitudes for named volcanoes", async () => {
  const table = await loadPointTable(sourceRoot, science);
  // IAU/USGS Gazetteer centres in the package's features/IO_nomenclature_center_pts.zip (east longitude, planetocentric).
  const gazetteer = [["Loki P.", 51.2136, 13.0083], ["Pele", 104.72, -18.71], ["Janus P.", 320.9793, -4.5589], ["Pillan", 116.7104, -12.2995]] as const;
  const text = await readFile(resolve(sourceRoot, "science/davies-2024/psjad4346t10_mrt.txt"), "utf8");
  for (const [name, longitude, latitude] of gazetteer) {
    const line = required(text.split("\n").find(row => row.slice(13, 36).trim() === name), name);
    const row = required(table.rows.find(entry => entry.rank === Number(line.slice(0, 3))));
    assert.ok(Math.abs(row.longitudeEast - longitude) < 2 && Math.abs(row.latitude - latitude) < 2, `${name}: ${row.longitudeEast}°E ${row.latitude}°N`);
    assert.notEqual(table.sample(row.longitudeEast, row.latitude), null, `${name} is drawn at its east longitude`);
  }
  // Loki Patera, the strongest source (9600 GW), is drawn in the top class at 51.6°E and nothing lies at the mirrored 308.4°E.
  assert.equal(table.sample(51.6, 12.8), 4);
  assert.equal(table.sample(308.4, 12.8), null);
});
