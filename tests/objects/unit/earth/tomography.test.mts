import {parseEarthScene} from './prepared-schema.mts';
import {parsePagedProfile} from '../../../../tools/objects/paged-ellipsoid/profile-source.mts';
import {parseInteriorSource} from '../../../../tools/objects/paged-ellipsoid/source-contract.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('earth');
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readMantleTomography, tomographyColor, tomographyLegend } from '../../../../tools/objects/paged-ellipsoid/tomography.mts';
import { prepareLocationPoint } from '../../../../tools/objects/paged-ellipsoid/geographic/prepare-location.mts';

const source = fileURLToPath(new URL('../../../../src/objects/earth/source/', import.meta.url));
const json = async (path: string|URL):Promise<unknown> => JSON.parse((await readFile(new URL(path, import.meta.url))).toString('utf8'));
const interior = parseInteriorSource(await json('../../../../src/objects/earth/source/interior/earth-interior.json'));
const config = parsePagedProfile(await json('../../../../src/objects/earth/source/preparation/paged-ellipsoid.json'));
const tomography = required(await readMantleTomography(source, interior, config));

// Independently read from the upstream NetCDF with h5py. References use NumPy
// trapezoidal longitude integration and exact spherical latitude-cell areas.
const anchors = [
  [0, 1000, 0, 6.349223852157593, 6.375634706645797, -0.4142466703852099],
  [0, 600, 45, 5.428739547729492, 5.434151889007009, -0.09959863816957348],
  [0, 2500, -40, 7.028437614440918, 7.140326566899821, -1.5670004923525993],
  [1, 1000, 0, 6.404318571090698, 6.375634706645797, 0.44989817900016327],
  [1, 600, 45, 5.40385365486145, 5.434151889007009, -0.5575522135634614],
  [1, 2500, -40, 7.142359495162964, 7.140326566899821, 0.02847108243713148],
];
test('both cut meridians preserve independently decoded source velocity, reference and sign', () => {
  for (const [face, depth, latitude, velocity, reference, percent] of anchors) {
    const actual = required(tomography.sample(face, depth, latitude));
    assert.ok(Math.abs(actual.velocity - velocity) < 5e-7);
    assert.ok(Math.abs(actual.reference - reference) < 5e-7);
    assert.ok(Math.abs(actual.percent - percent) < 2e-5);
  }
});

test('tomography meridians occupy the same longitude frame as the photographed exterior', async () => {
  const scene = parseEarthScene(await json('../../../../src/objects/earth/prepared/scene.json'));
  for (const longitude of tomography.recipe.sectionLongitudesDegrees) {
    const p = prepareLocationPoint(scene, longitude, 0);
    // PolyCSS's prepared CSS frame swaps the source X/Y axes.
    const geometric = Math.atan2(p[0], p[1]) * 180 / Math.PI;
    const mapped = ((geometric - 180 + 180) % 360 + 360) % 360 - 180;
    const difference = ((mapped - longitude + 540) % 360) - 180;
    assert.ok(Math.abs(difference) < 0.05, `${longitude}: ${mapped}`);
  }
});

test('unknown depths and latitudes remain missing rather than extrapolated into the core', () => {
  for (const [depth, latitude] of [[0, 0], [2900, 0], [1000, 91], [NaN, 0]]) {
    assert.equal(tomography.sample(0, depth, latitude), null);
  }
  assert.ok(tomography.sample(0, 10, -90));
  assert.ok(tomography.sample(1, 2890, 90));
  assert.deepEqual(tomography.color(null), [163, 163, 163]);
});

test('the unshaded legend and cut faces use the same saturated signed palette', () => {
  const recipe = tomography.recipe, legend = tomographyLegend(recipe);
  assert.deepEqual(tomographyColor(recipe, -10), [178, 24, 43]);
  assert.deepEqual(tomographyColor(recipe, 0), [247, 247, 247]);
  assert.deepEqual(tomographyColor(recipe, 10), [33, 102, 172]);
  assert.deepEqual([...legend.data.subarray(0, 3)], tomography.color(-3));
  const end = (legend.width - 1) * 3;
  assert.deepEqual([...legend.data.subarray(end, end + 3)], tomography.color(3));
});

test('changed cut geometry rejects a stale source subset', async () => {
  await assert.rejects(() => readMantleTomography(source, interior, {
    ...config, geometry: { ...config.geometry, interiorCutaway: { ...config.geometry.interiorCutaway, centerLongitudeDegrees: 0 } },
  }), /re-extracted/);
});

test('decoded cut-plane texels preserve independent volume samples within the q90 display tolerance', async () => {
  const file = new URL('../../../../public/scenes/earth/earth-tomography-section@2x.webp', import.meta.url);
  const { data, info } = await sharp(fileURLToPath(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Direct full-volume trilinear samples, independently calculated with NumPy.
  // These are interior points away from layer boundaries, on both cut planes.
  const pixels = [
    [720, 400, [171, 206, 226]], [600, 650, [245, 221, 212]], [500, 270, [214, 229, 238]],
    [1744, 400, [245, 218, 207]], [1624, 650, [246, 238, 235]], [1524, 270, [246, 233, 228]],
  ] as const;
  assert.equal(info.width, 2048);
  assert.equal(info.height, 1024);
  for (const [x, y, expected] of pixels) {
    const index: number = (y * info.width + x) * 4;
    assert.equal(data[index + 3], 255);
    for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(data[index + channel] - expected[channel]) <= 8);
  }
  assert.equal(data[(0 * info.width + 1023) * 4 + 3], 0, 'space outside the radial face stays transparent');
});
