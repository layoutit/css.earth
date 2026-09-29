import { required } from '@cssearth/objects/node/contract';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareRingLeaves } from '@cssearth/bake/objects/layers/shape-model';
import { prepareTerrestrialRings, validateTerrestrialRings } from '@cssearth/bake/objects/layers/terrestrial';

const band = (id: string, innerRadiusKm: number, outerRadiusKm: number, displayOpacity: number) => ({
  id, innerRadiusKm, outerRadiusKm, displayOpacity, displayValue: 160, segments: 64,
  qualification: 'Measured dimensions; opacity is a schematic display value.',
});
const profile = { textureSize: 256, bands: [band('inner', 20, 24, 1), band('outer', 28, 30, .25)] };

test('extracted Haumea helper preserves its existing annular geometry and image mapping', () => {
  const leaves = prepareRingLeaves(
    { displayRadius: 230, ring: { innerRadiusKm: 2252, outerRadiusKm: 2322, segments: 128 } },
    { url: '/scenes/haumea/haumea-ring.webp', width: 2048, height: 64 },
    1161,
  );
  // Leaves captured from the original helper: the first, the one opposite it and the last, with their transforms,
  // texture projection and style. Every leaf steps one 16 px atlas column along the ring image, in order.
  assert.equal(leaves.length, 128);
  const leaf = (transform: string, position: number) => ({ tag: 's', className: 'shape-model-ring-quad',
    style: `transform:matrix3d(${transform});backface-visibility:visible;--polycss-atlas-width:16px;--polycss-atlas-height:64px;` +
      `background-image:url("/scenes/haumea/haumea-ring.webp");background-position:${position}px 0px;background-size:2048px 64px;background-repeat:no-repeat` });
  assert.deepEqual(leaves[0], leaf('68.481568,-1.681128,0,0,0.000283,0.01152,0,-0.000471,0,0,-1,0,-0.6,22306.046762,0,1', 0));
  assert.deepEqual(leaves[64], leaf('-68.481568,1.681128,0,0,-0.000283,-0.01152,0,-0.000471,0,0,-1,0,0.6,-22306.046762,0,1', -1024));
  assert.deepEqual(leaves[127], leaf('68.481568,1.681128,0,0,-0.000283,0.01152,0,-0.000471,0,0,-1,0,-1095.105115,22279.148711,0,1', -2032));
  leaves.forEach((value, index) => assert.match(JSON.stringify(value), new RegExp(`background-position:${index ? `-${index * 16}` : 0}px 0px;`)));
});

test('two annuli retain the source radii, central aperture, gap, and separate opacity', async () => {
  const publicDirectory = await mkdtemp(resolve(tmpdir(), 'cssearth-annuli-'));
  try {
    const config = { namespace: 'fixture', publicBase: '/scenes/fixture/', geometry: { radius: 100, radiusKm: 10 }, rings: profile };
    const result = await prepareTerrestrialRings({ config, publicDirectory });
    assert.equal(required(result).coverage.sourceFaceCount, 128);
    for (const [index, { innerRadiusKm, outerRadiusKm }] of profile.bands.entries()) {
      const radii = required(result).coverage.sourceFaces.slice(index * 64, (index + 1) * 64).flatMap(face => face.vertices.map(v => Math.hypot(v[0], v[1]) / (BASE_TILE * 100 / 10)));
      // PolyCSS's native subpixel edge expansion remains far below source precision.
      assert.ok(Math.abs(Math.min(...radii) - innerRadiusKm) < .003);
      assert.ok(Math.abs(Math.max(...radii) - outerRadiusKm) < .003);
    }
    const { data, info } = await sharp(resolve(publicDirectory, 'fixture-rings.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (fraction: number) => data[(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2 + fraction * 128)) * 4 + 3];
    assert.equal(alpha(0), 0, 'body aperture stays transparent');
    assert.equal(alpha(22 / 30), 255, 'inner ring retains authored opacity');
    assert.equal(alpha(26 / 30), 0, 'gap stays transparent');
    assert.ok(alpha(29 / 30) >= 60 && alpha(29 / 30) <= 65, 'outer ring retains independent opacity');
    assert.ok(required(result).leaves.length <= 4, 'one bounded coplanar raster supplies retained tiles');
    assert.match(required(result).leaves[0].style, /position:absolute;display:block;width:[\d.]+px;height:[\d.]+px/);
    // Each tile shows the published image at two texels per CSS pixel.
    for (const leaf of required(result).leaves) {
      assert.equal(info.width / Number.parseFloat(required(leaf.style.match(/background-size:([^;]+)/))[1]), 2);
    }
    assert.match(required(result).leaves[0].style, /transform-origin:0 0/);
    assert.equal(required(result).resource.pool, 'mounted');
  } finally { await rm(publicDirectory, { recursive: true, force: true }); }
});

test('ring-free profiles preserve the existing preparation path', async () => {
  assert.equal(await prepareTerrestrialRings({ config: { namespace: 'fixture', publicBase: '/scenes/fixture/', geometry: { radius: 100, radiusKm: 10 } }, publicDirectory: tmpdir() }), null);
  assert.doesNotThrow(() => validateTerrestrialRings(undefined, 10));
});

test('invalid radial ordering, missing interpretation, duplicate identity and oversized raster are rejected', () => {
  for (const malformed of [
    { ...profile, textureSize: 4096 },
    { ...profile, bands: [band('inner', 10, 24, 1)] },
    { ...profile, bands: [band('inner', 24, 20, 1)] },
    { ...profile, bands: [{ ...profile.bands[0], qualification: '' }] },
    { ...profile, bands: [profile.bands[0], profile.bands[0]] },
  ]) assert.throws(() => validateTerrestrialRings(malformed, 10));
});
