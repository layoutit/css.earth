import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { SCIENCE_LENSES } from "../science-lenses.mjs";
import { colorForValue, loadScienceSurface } from "../tools/science-surfaces.mjs";

const root = resolve(import.meta.dirname, "../../../.."), sourceRoot = resolve(root, "src/planets/ceres/source");
const anchors = {
  elevation: [[90, 30, 1552], [180, 0, 16202], [270, -30, 3813], [10, 80, null], [350, -80, null]],

};

for (const lens of SCIENCE_LENSES) test(`${lens.id}: source coordinates, gaps, and delivered map retain the scientific values`, async () => {
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
      const expected = colorForValue(value, lens);
      assert.ok(actual.every((channel, c) => Math.abs(channel - expected[c]) <= 1), `${lon},${lat}: source value uses the published color scale`);
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
