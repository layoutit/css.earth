import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { array, number, shape, text } from "../../../../tools/objects/terrestrial-layers/source-records.mts";
import { required } from "../../../../tools/test-values.mts";
import { parseInterpreterRecipe } from "../../../../tools/objects/observation/interpret.mts";
import { colorForValue, loadScienceSurface, paintScienceSurface, terrainBrightness as shadeTerrain } from "../../../../tools/objects/terrestrial-layers/scientific-raster.mts";
import type { SourceScalar } from "../../../../tools/objects/terrestrial-layers/contracts.mts";

const root = resolve(import.meta.dirname, "../../../.."), sourceRoot = resolve(root, "src/planets/ceres/source");
const recipe = parseInterpreterRecipe(JSON.parse(await readFile(resolve(sourceRoot, "preparation/raster.json"), "utf8")));
/** The raster lane's `terrestrial-scientific` science blocks, validated down to the palette and relief facts this test reads. */
const parsePalette = shape({ id: text, minimum: number, maximum: number, colors: array(text), relief: shape({ referenceRadiusMeters: number, lightDirection: array(number), ambient: number }) });
const SCIENCE_LENSES = recipe.surfaces.filter(surface => surface.science?.kind === "terrestrial-scientific")
  .map(surface => ({ science: required(surface.science), palette: parsePalette(surface.science) }));
assert.ok(SCIENCE_LENSES.length > 0, "Ceres declares at least one scientific surface");
const terrainBrightness = (source:SourceScalar,longitude:number,latitude:number,step:number) => shadeTerrain(source,longitude,latitude,step, SCIENCE_LENSES[0].palette.relief);

const anchors:Record<string,readonly (readonly [number,number,number|null])[]> = {
  elevation: [[90, 30, 1552], [180, 0, 16202], [270, -30, 3813], [10, 80, null], [350, -80, null]],

};

test("terrain shading respects slope direction, latitude spacing, the longitude seam, and missing neighbors", () => {
  const metersPerDegree = 470000 * Math.PI / 180;
  assert.equal(terrainBrightness({ sample: () => 123 }, 180, 0, 0.1), 1);
  const slope = (sign: number) => ({ sample: (lon: number, lat: number) => sign * metersPerDegree * lon * Math.cos(lat * Math.PI / 180) });
  assert.ok(terrainBrightness(slope(1), 180, 0, 0.1) > 1, "west-facing slope catches northwest light");
  assert.ok(terrainBrightness(slope(-1), 180, 0, 0.1) < 1, "east-facing slope faces away");
  const planeAt = (lat: number) => ({ sample: (lon: number) => metersPerDegree * lon * Math.cos(lat * Math.PI / 180) });
  assert.ok(Math.abs(terrainBrightness(planeAt(0), 180, 0, 0.1)
    - terrainBrightness(planeAt(50), 180, 50, 0.1)) < 1e-10, "equal physical slopes have equal shade at different latitudes");
  const globe = { sample: (lon: number) => 1000 * Math.sin(lon * Math.PI / 180) };
  assert.ok(Math.abs(terrainBrightness(globe, 0, 0, 0.1) - terrainBrightness(globe, 360, 0, 0.1)) < 1e-10);
  assert.equal(terrainBrightness({ sample: (lon: number) => lon < 180 ? null : 123 }, 180, 0, 0.1), 1);
});

for (const { science, palette: lens } of SCIENCE_LENSES) test(`${lens.id}: source coordinates, gaps and shaded colors agree`, async () => {
  const source = await loadScienceSurface(sourceRoot, science);
  for (const [lon, lat, value] of required(anchors[lens.id], `${lens.id} anchors`)) assert.equal(source.sample(lon, lat), value, `${lon}E, ${lat}N`);
  // The interpreter paints this same science block with `paintScienceSurface`; check its pixels at the anchors.
  const width = 360, height = 180;
  const { rgb, missing } = paintScienceSurface(source, lens, width, height);
  for (const [lon, lat] of required(anchors[lens.id])) {
    const x = Math.floor(lon / 360 * width), y = Math.floor((90 - lat) / 180 * height), i = y * width + x;
    const value = source.sample((x + 0.5) * 360 / width, 90 - (y + 0.5) * 180 / height);
    const actual = [...rgb.subarray(i * 3, i * 3 + 3)];
    if (value === null) {
      assert.equal(missing[i], 1, "withheld or missing source cell is reported missing");
      assert.ok(Math.max(...actual) - Math.min(...actual) <= 4, "gap remains neutral gray");
    } else {
      assert.equal(missing[i], 0);
      const brightness = terrainBrightness(source, (x + 0.5) * 360 / width, 90 - (y + 0.5) * 180 / height, 360 / width);
      const expected = colorForValue(value, lens).map(channel => Math.min(255, Math.round(channel * brightness)));
      assert.ok(actual.every((channel, c) => Math.abs(channel - expected[c]) <= 2), `${lon},${lat}: shaded source value uses the published color scale`);
    }
  }
});
