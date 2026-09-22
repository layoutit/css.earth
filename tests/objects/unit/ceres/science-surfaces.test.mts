import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('ceres');
import { array, number, optional, shape, text } from "../../../../tools/objects/terrestrial-layers/source-records.mts";
import { required } from "../../../../tools/contract/test-values.mts";
import { parseInterpreterRecipe } from "../../../../tools/objects/observation/interpret.mts";
import { colorForValue, loadScienceSurface, paintScienceSurface, terrainBrightness as shadeTerrain } from "../../../../tools/objects/terrestrial-layers/scientific-raster.mts";
import type { SourceScalar } from "../../../../tools/objects/terrestrial-layers/contracts.mts";

const root = resolve(import.meta.dirname, "../../../.."), sourceRoot = resolve(root, "src/objects/ceres/source");
const recipe = parseInterpreterRecipe(JSON.parse(await readFile(resolve(sourceRoot, "preparation/raster.json"), "utf8")));
/** The raster lane's `terrestrial-scientific` science blocks, validated down to the palette and relief facts this test reads. */
const parsePalette = shape({ id: text, minimum: number, maximum: number, colors: array(text), relief: optional(shape({ referenceRadiusMeters: number, lightDirection: array(number), ambient: number })) });
const SCIENCE_LENSES = recipe.surfaces.filter(surface => surface.science?.kind === "terrestrial-scientific")
  .map(surface => ({ science: required(surface.science), palette: parsePalette(surface.science) }));
assert.ok(SCIENCE_LENSES.length > 0, "Ceres declares at least one scientific surface");
const elevationRelief = required(SCIENCE_LENSES.find(lens => lens.palette.id === "elevation")?.palette.relief);
const terrainBrightness = (source:SourceScalar,longitude:number,latitude:number,step:number,relief = elevationRelief) => shadeTerrain(source,longitude,latitude,step,relief);

const anchors:Record<string,readonly (readonly [number,number,number|null])[]> = {
  // DTM anchors sit at 60 ppd pixel centres; an exact pixel corner lets float rounding pick a neighbouring pixel.
  elevation: [[90 + 1 / 120, 30 - 1 / 120, 1552], [180 + 1 / 120, -1 / 120, 16202], [270 + 1 / 120, -30 - 1 / 120, 3813], [10, 80, null], [350, -80, null]],
  // Dawn VIR band depths, read independently from the big-endian archive bytes at the label's pixel centres.
  "clay-band": [[90, 30, 0.24399100244045258], [180, 0, 0.2446340024471283], [300, -45, 0.24745400249958038], [239.3, 19.8, null], [10, 70, null], [0.01, 0, null]],
  // Our VIR reduction (science/vir-reduction), read independently with Python from the gunzipped little-endian bytes.
  "ammonium-band": [[90, 30, 0.11522030085325241], [180, 0, 0.1162446066737175], [300, -45, 0.1443149298429489], [239.3, 19.8, 0.07089750468730927], [10, 70, null], [0.01, 0, 0.11303388327360153]],

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
      const brightness = lens.relief ? terrainBrightness(source, (x + 0.5) * 360 / width, 90 - (y + 0.5) * 180 / height, 360 / width, lens.relief) : 1;
      // The painter looks colors up in a 1024-step table of the scale; compare with that same step.
      const step = Math.round(Math.max(0, Math.min(1, (value - lens.minimum) / (lens.maximum - lens.minimum))) * 1023);
      const expected = colorForValue(lens.minimum + step / 1023 * (lens.maximum - lens.minimum), lens).map(channel => Math.min(255, Math.round(channel * brightness)));
      assert.ok(actual.every((channel, c) => Math.abs(channel - expected[c]) <= 2), `${lon},${lat}: shaded source value uses the published color scale`);
    }
  }
});

test("clay band: east longitudes land Haulani and Cerealia Facula on their low 2.7 µm band depths", async () => {
  const lens = required(SCIENCE_LENSES.find(entry => entry.palette.id === "clay-band"));
  const source = await loadScienceSurface(sourceRoot, lens.science);
  const median = (longitude: number, latitude: number) => {
    const values: number[] = [];
    for (let dy = -3; dy <= 3; dy += 0.05) for (let dx = -3; dx <= 3; dx += 0.05) {
      const value = source.sample(longitude + dx, latitude + dy);
      if (value !== null) values.push(value);
    }
    return values.sort((a, b) => a - b)[values.length >> 1];
  };
  // IAU Gazetteer centres (east longitude): Haulani 10.77°E 5.80°N; Cerealia Facula 239.6°E 19.7°N. Frigeri et al. (2019) note Haulani's low 2.7 µm band depth.
  for (const [longitude, latitude] of [[10.77, 5.8], [239.6, 19.7]]) {
    assert.ok(median(longitude, latitude) < median(360 - longitude, latitude) - 0.015, `${longitude}°E is lower than its mirrored longitude`);
  }
});
