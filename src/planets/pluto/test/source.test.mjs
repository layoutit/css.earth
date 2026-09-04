import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readPlutoFacts, parsePlutoFacts } from "../tools/physical-source.mjs";
import { decodeElevationGrid, elevationColor, elevationRaster } from "../tools/elevation-raster.mjs";
import { requireObject } from "../../../../site/objects.mjs";
import { PREPARED_PLUTO_SCENE } from "../runtime/preparedScene.mjs";

test("binds Pluto facts and registry classification to owned source snapshots", async () => {
  const facts = await readPlutoFacts();
  assert.equal(requireObject("pluto").classification, "dwarf-planet");
  assert.equal(requireObject("pluto").distanceAu, facts.meanHeliocentricDistanceAu);
  assert.equal(PREPARED_PLUTO_SCENE.body.meanRadiusKm, facts.meanRadiusKm);
  assert.equal(PREPARED_PLUTO_SCENE.body.orbitalPeriodYears, facts.orbitalPeriodYears);
  const nasa = JSON.parse(await readFile(new URL("../source/editorial/nasa-pluto.json", import.meta.url)));
  const jpl = await readFile(new URL("../source/orbit/jpl-physical.html", import.meta.url), "utf8");
  assert.throws(() => parsePlutoFacts(jpl.replaceAll("1188.3", "1000.0"), nasa));
  assert.throws(() => parsePlutoFacts(jpl, { ...nasa, id: 1 }));
  const styles = await readFile(new URL("../runtime/styles.css", import.meta.url), "utf8");
  assert.match(styles, /from \{ transform: rotateZ\(180deg\); \}/u);
  assert.match(styles, /to \{ transform: rotateZ\(540deg\); \}/u);
});

test("decodes signed USGS elevation and preserves missing observations", async () => {
  const bytes = await readFile(new URL("../source/lenses/pluto-dem.tif", import.meta.url));
  const grid = decodeElevationGrid(bytes);
  assert.equal(grid.width, 24888); assert.equal(grid.height, 12444);
  assert.deepEqual(elevationColor(-32768), [0, 0, 0]);
  assert.notDeepEqual(elevationColor(-1000), elevationColor(1000));
  assert.deepEqual(elevationColor(0), [214, 208, 178]);
  let low = Infinity, high = -Infinity, missing = 0;
  for (let y = 0; y < grid.height; y += 101) for (let x = 0; x < grid.width; x += 101) {
    const v = grid.sample(x, y);
    if (v === -32768) missing++; else { low = Math.min(low, v); high = Math.max(high, v); }
  }
  assert.ok(low < -1000 && high > 4000 && missing > 1000, JSON.stringify({ low, high, missing }));
  assert.deepEqual([...elevationRaster({ width: 1, height: 1, sample: () => -32768 }, 2, 2).data], Array(12).fill(0));
  const label = await readFile(new URL("../source/lenses/pluto-dem.lbl", import.meta.url), "utf8");
  assert.match(label, /Type\s*= SignedWord/u);
  assert.match(label, /Multiplier = 1.0/u);
  assert.match(label, /EquatorialRadius\s*= 1188300.0 <meters>/u);
  assert.match(label, /ProjectionName\s*= Equirectangular/u);
  assert.throws(() => decodeElevationGrid(Buffer.from("wrong TIFF")), /header/);
});
