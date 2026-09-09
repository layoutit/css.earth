import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareTerrestrialRings, validateTerrestrialRings } from './rings.mjs';

const band = (id, innerRadiusKm, outerRadiusKm, displayOpacity) => ({
  id, innerRadiusKm, outerRadiusKm, displayOpacity, displayValue: 160, segments: 64,
  qualification: 'Measured dimensions; opacity is a schematic display value.',
});
const profile = { textureSize: 256, bands: [band('inner', 20, 24, 1), band('outer', 28, 30, .25)] };

test('two annuli retain the source radii, central aperture, gap, and separate opacity', async () => {
  const publicDirectory = await mkdtemp(resolve(tmpdir(), 'cssearth-annuli-'));
  try {
    const config = { namespace: 'fixture', publicBase: '/scenes/fixture/', geometry: { radius: 100, radiusKm: 10 }, rings: profile };
    const result = await prepareTerrestrialRings({ config, publicDirectory });
    assert.equal(result.coverage.sourceFaceCount, 128);
    for (const [index, { innerRadiusKm, outerRadiusKm }] of profile.bands.entries()) {
      const radii = result.coverage.sourceFaces.slice(index * 64, (index + 1) * 64).flatMap(face => face.vertices.map(v => Math.hypot(v[0], v[1]) / (BASE_TILE * 100 / 10)));
      // PolyCSS's native subpixel edge expansion remains far below source precision.
      assert.ok(Math.abs(Math.min(...radii) - innerRadiusKm) < .003);
      assert.ok(Math.abs(Math.max(...radii) - outerRadiusKm) < .003);
    }
    const { data, info } = await sharp(resolve(publicDirectory, 'fixture-rings.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = fraction => data[(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2 + fraction * 128)) * 4 + 3];
    assert.equal(alpha(0), 0, 'body aperture stays transparent');
    assert.equal(alpha(22 / 30), 255, 'inner ring retains authored opacity');
    assert.equal(alpha(26 / 30), 0, 'gap stays transparent');
    assert.ok(alpha(29 / 30) >= 60 && alpha(29 / 30) <= 65, 'outer ring retains independent opacity');
    assert.ok(result.leaves.length <= 4, 'one bounded coplanar raster supplies retained tiles');
    assert.equal(result.resource.pool, 'mounted');
  } finally { await rm(publicDirectory, { recursive: true, force: true }); }
});

test('ring-free profiles preserve the existing preparation path', async () => {
  assert.equal(await prepareTerrestrialRings({ config: {} }), null);
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
