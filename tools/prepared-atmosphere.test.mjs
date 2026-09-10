import assert from "node:assert/strict";
import test from "node:test";
import { prepareAtmosphereFrame, compositePreparedAtmosphere } from "./prepared-atmosphere.mts";
import { readFile } from "node:fs/promises";
import { MARS_ATMOSPHERE_PROFILE, prepareMarsAtmosphereFrame, prepareMarsMaterialFrame } from "../tests/objects/unit/mars/prepared-fixture.mjs";
import { createAtmospherePreparation } from "./objects/paged-ellipsoid/atmosphere.mts";
import { resolve } from "node:path";

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const earthPreparation = createAtmospherePreparation({
  config: await json('src/planets/earth/source/preparation/paged-ellipsoid.json'),
  sourceDirectory: resolve('src/planets/earth/source'),
  sourceManifest: await json('src/planets/earth/source/manifest.json'),
  sun: (await json('src/planets/earth/prepared/runtime.json')).sun,
});
const earth = earthPreparation.atmosphereProfile(await earthPreparation.readAtmosphereModel());
const view = { width: 96, disc: { centerX: 48, centerY: 48, radiusX: 43, radiusY: 43 } };
function alpha(data, side) {
  let sum = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    if (side === "left" && x >= 48 || side === "right" && x < 48) continue;
    sum += data[(y * 96 + x) * 4 + 3];
  }
  return sum;
}
for (const [name, profile] of [["Mars", MARS_ATMOSPHERE_PROFILE], ["Earth", earth]]) {
  test(`${name} uses the same shell integrator with its own source profile`, () => {
    const right = prepareAtmosphereFrame({ ...view, profile, lightDirection: [1, 0, 0] });
    const left = prepareAtmosphereFrame({ ...view, profile, lightDirection: [-1, 0, 0] });
    assert.ok(alpha(right.data, "right") > alpha(right.data, "left") * 4);
    assert.equal(alpha(right.data, "right"), alpha(left.data, "left"));
    const back = prepareAtmosphereFrame({ ...view, profile, lightDirection: [0, 0, -1] });
    assert.equal(back.data[(48 * 96 + 48) * 4 + 3], 0);
    assert.ok(alpha(back.data) > 0, "backlit gas outside the body remains visible");
    assert.equal(back.data[3], 0, "the outer sky stays transparent");
    const more = prepareAtmosphereFrame({ ...view, profile, lightDirection: [1, 0, 0], integrationSamples: 48 });
    const mean = right.data.reduce((sum, value, index) => sum + Math.abs(value - more.data[index]), 0) / right.data.length;
    assert.ok(mean < 1, `24/48 sample mean channel error ${mean}`);
  });
}
test("atmosphere-free objects have no synthesized fallback", () => {
  const { data } = prepareAtmosphereFrame({ ...view, profile: null, lightDirection: [1, 0, 0] });
  assert.equal(data.some(value => value !== 0), false);
});
test("profile differences affect prepared output without object dispatch", () => {
  const a = prepareAtmosphereFrame({ ...view, profile: earth, lightDirection: [0, 0, 1] });
  const b = prepareAtmosphereFrame({ ...view, profile: MARS_ATMOSPHERE_PROFILE, lightDirection: [0, 0, 1] });
  assert.notDeepEqual(a.data, b.data);
  const dark = prepareAtmosphereFrame({ ...view, profile: { ...earth, transfer: { ...earth.transfer, exposure: 0 } }, lightDirection: [0, 0, 1] });
  assert.equal(alpha(dark.data), 0);
  assert.throws(() => prepareAtmosphereFrame({ ...view, profile: { ...earth, radiusKm: 0 }, lightDirection: [0, 0, 1] }), /profile/);
});
test("Mars composes both ground modes from one atmosphere and preserves curvature", () => {
  const lightDirection = [1, 0, 0];
  const atmosphere = prepareMarsAtmosphereFrame(40, 1, { lightDirection });
  for (const shadows of [false, true]) {
    const ground = prepareMarsMaterialFrame(40, 1, { lightDirection, shadows, atmosphere: false });
    compositePreparedAtmosphere(ground.data, atmosphere.data);
    assert.deepEqual(prepareMarsMaterialFrame(40, 1, { lightDirection, shadows }).data, ground.data);
  }
  assert.deepEqual(prepareMarsMaterialFrame(40, 1, { lightDirection, shadows: false, atmosphere: false }).data,
    prepareMarsMaterialFrame(40, 1, { lightDirection: [0, 0, 1], shadows: true, atmosphere: false }).data);
});
