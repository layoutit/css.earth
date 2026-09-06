import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { colorForValue, terrainBrightness, sampleColorBand, composeObservedColor } from './scientific-raster.mjs';
import { lambertAttenuationAtlas } from './solid-raster.mjs';
import { parseTerrestrialProfile } from './index.mjs';

const relief = { referenceRadiusMeters: 470000, lightDirection: [-0.5, 0.5, Math.SQRT1_2], ambient: 0.25 };
test('relief preserves height units, latitude spacing, wrapping and coverage boundaries', () => {
  assert.equal(terrainBrightness({ sample: () => 123 }, 180, 0, 0.1, relief), 1);
  const metersPerDegree = relief.referenceRadiusMeters * Math.PI / 180;
  const planeAt = latitude => ({ sample: longitude => metersPerDegree * longitude * Math.cos(latitude * Math.PI / 180) });
  assert.ok(terrainBrightness(planeAt(0), 180, 0, 0.1, relief) > 1);
  assert.ok(Math.abs(terrainBrightness(planeAt(0), 180, 0, 0.1, relief) - terrainBrightness(planeAt(50), 180, 50, 0.1, relief)) < 1e-10);
  const opposite = { ...relief, lightDirection: [0.5, -0.5, Math.SQRT1_2] };
  assert.ok(terrainBrightness(planeAt(0), 180, 0, 0.1, opposite) < 1);
  const globe = { sample: longitude => 1000 * Math.sin(longitude * Math.PI / 180) };
  assert.equal(terrainBrightness(globe, 0, 0, 0.1, relief), terrainBrightness(globe, 360, 0, 0.1, relief));
  assert.equal(terrainBrightness({ sample: longitude => longitude < 180 ? null : 123 }, 180, 0, 0.1, relief), 1);
  // The same physical gradient on a differently sized source sphere is lit equally.
  const larger = { ...relief, referenceRadiusMeters: relief.referenceRadiusMeters * 2 };
  assert.equal(terrainBrightness({ sample: longitude => 2 * metersPerDegree * longitude }, 180, 0, 0.1, larger),
    terrainBrightness(planeAt(0), 180, 0, 0.1, relief));
});

test('numeric color scale clamps endpoints and interpolates authored colors', () => {
  const scale = { minimum: -100, maximum: 100, colors: ['#000000', '#ffffff'] };
  assert.deepEqual(colorForValue(-200, scale), [0, 0, 0]);
  assert.deepEqual(colorForValue(0, scale), [128, 128, 128]);
  assert.deepEqual(colorForValue(200, scale), [255, 255, 255]);
});

test('observed color retains dark valid pixels and rejects incomplete footprints', () => {
  const band = { width: 2, height: 2, origin: [0, 2], resolution: [1, -1],
    data: new Float32Array([0.001, 0.001, 0.001, 0.001]), noData: 0, specialValueMagnitude: 1e30 };
  assert.ok(sampleColorBand(band, 1, 1) > 0);
  band.data[3] = 0; assert.equal(sampleColorBand(band, 1, 1), null);
  band.data[3] = -3.4028234663852886e38; assert.equal(sampleColorBand(band, 1, 1), null);
  assert.equal(sampleColorBand(band, 0, 0), null);
});

test('channel composition uses all three bands from one observation and source density precedence', () => {
  const profile = { filters: ['red', 'green', 'blue'], gamma: 1, referenceRadiusMeters: 1, centerLongitude: 180 };
  const band = (filter, value, resolution) => ({ filter, width: 2, height: 2, origin: [-resolution, resolution], resolution: [resolution, -resolution],
    data: new Float32Array(4).fill(value), noData: 0, specialValueMagnitude: 1e30 });
  const groups = new Map([
    ['coarse', profile.filters.map(filter => band(filter, 0.5, 2))],
    ['fine', profile.filters.map((filter, index) => band(filter, (index + 1) / 4, 1))],
  ]);
  const result = composeObservedColor({ groups, profile, width: 1, height: 1 });
  assert.deepEqual([...result.rgb], [64, 128, 191]); assert.deepEqual([...result.missing], [0]);
  groups.get('fine')[1].data.fill(0);
  assert.deepEqual([...composeObservedColor({ groups, profile, width: 1, height: 1 }).rgb], [128, 128, 128]);
  groups.get('fine').pop();
  assert.throws(() => composeObservedColor({ groups, profile, width: 1, height: 1 }), /Incomplete color observation/);
});

test('Lambert atlas is transparent outside the body and carries distinct full-phase shading', () => {
  const profile = { frameSize: 8, columns: 2, frameCount: 4, terminatorWidth: 0.1,
    directionalAmbient: 0.05, fullPhaseAmbient: 0.35, fullPhaseDiffuse: 0.65, maximumOpacity: 0.95 };
  const { pixels, width, height } = lambertAttenuationAtlas(profile);
  assert.equal(width, 16); assert.equal(height, 16); assert.equal(pixels[3], 0);
  assert.equal(pixels[(3 * width + 3) * 4 + 3], 242);
  assert.ok(pixels[((8 + 3) * width + 8 + 3) * 4 + 3] < 10);
});

test('capability selection and validity policy are independent of body names', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/planets/ceres/source/preparation/terrestrial.json', import.meta.url)));
  const variant = structuredClone(config); variant.namespace = 'test-body'; variant.publicBase = '/scenes/test-body/';
  assert.equal(parseTerrestrialProfile(variant).namespace, 'test-body');
  variant.geometry.radius = 231; assert.throws(() => parseTerrestrialProfile(variant), /Invalid terrestrial/);
});
