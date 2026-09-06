import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import profile from "../../../../src/planets/ceres/source/preparation/terrestrial.json" with {type:"json"};
const SCIENCE_LENSES = profile.raster.scientific;
import { colorForValue, loadScienceSurface, terrainBrightness as shadeTerrain } from "../../../../tools/objects/terrestrial-layers/scientific-raster.mjs";
const terrainBrightness = (...args) => shadeTerrain(...args, SCIENCE_LENSES[0].relief);

const root = resolve(import.meta.dirname, "../../../.."), sourceRoot = resolve(root, "src/planets/ceres/source");
const anchors = {
  elevation: [[90, 30, 1552], [180, 0, 16202], [270, -30, 3813], [10, 80, null], [350, -80, null]],

};

test("terrain shading respects slope direction, latitude spacing, the longitude seam, and missing neighbors", () => {
  const metersPerDegree = 470000 * Math.PI / 180;
  assert.equal(terrainBrightness({ sample: () => 123 }, 180, 0, 0.1), 1);
  const slope = sign => ({ sample: (lon, lat) => sign * metersPerDegree * lon * Math.cos(lat * Math.PI / 180) });
  assert.ok(terrainBrightness(slope(1), 180, 0, 0.1) > 1, "west-facing slope catches northwest light");
  assert.ok(terrainBrightness(slope(-1), 180, 0, 0.1) < 1, "east-facing slope faces away");
  const planeAt = lat => ({ sample: lon => metersPerDegree * lon * Math.cos(lat * Math.PI / 180) });
  assert.ok(Math.abs(terrainBrightness(planeAt(0), 180, 0, 0.1)
    - terrainBrightness(planeAt(50), 180, 50, 0.1)) < 1e-10, "equal physical slopes have equal shade at different latitudes");
  const globe = { sample: lon => 1000 * Math.sin(lon * Math.PI / 180) };
  assert.ok(Math.abs(terrainBrightness(globe, 0, 0, 0.1) - terrainBrightness(globe, 360, 0, 0.1)) < 1e-10);
  assert.equal(terrainBrightness({ sample: lon => lon < 180 ? null : 123 }, 180, 0, 0.1), 1);
});

for (const lens of SCIENCE_LENSES) test(`${lens.id}: source coordinates, gaps, shaded colors, and numeric legend agree`, async () => {
  const source = await loadScienceSurface(sourceRoot, lens);
  for (const [lon, lat, value] of anchors[lens.id]) assert.equal(source.sample(lon, lat), value, `${lon}E, ${lat}N`);
  const { data, info } = await sharp(resolve(root, `public/scenes/ceres/ceres-${lens.id}-map.webp`))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [lon, lat] of anchors[lens.id]) {
    const x = Math.floor(lon / 360 * info.width), y = Math.floor((90 - lat) / 180 * info.height);
    const value = source.sample((x + 0.5) * 360 / info.width, 90 - (y + 0.5) * 180 / info.height);
    const actual = [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    if (value === null) {
      assert.ok(Math.max(...actual) - Math.min(...actual) <= 4, "gap remains neutral gray");
    } else {
      const brightness = terrainBrightness(source, (x + 0.5) * 360 / info.width, 90 - (y + 0.5) * 180 / info.height, 360 / info.width);
      const expected = colorForValue(value, lens).map(channel => Math.min(255, Math.round(channel * brightness)));
      assert.ok(actual.every((channel, c) => Math.abs(channel - expected[c]) <= 2), `${lon},${lat}: shaded source value uses the published color scale`);
    }
  }
  const legend = await sharp(resolve(root, `public/scenes/ceres/ceres-${lens.id}-legend.webp`))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const x of [0, 64, 128, 255]) {
    const expected = colorForValue(lens.minimum + x / 255 * (lens.maximum - lens.minimum), lens);
    for (const y of [0, 15]) {
      const i = (y * legend.info.width + x) * 3;
      assert.ok([...legend.data.subarray(i, i + 3)].every((channel, c) => Math.abs(channel - expected[c]) <= 1),
        "legend keeps the full source value range within resize rounding");
    }
  }
});
