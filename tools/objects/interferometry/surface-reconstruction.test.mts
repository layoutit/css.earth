import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseSurfaceSummary, surfaceArguments } from './surface-reconstruction.mts';

test('a surface run is described by fixed arguments: the star with no measured axis has its pole North in the sky plane', () => {
  const args = surfaceArguments('data.fits', '/work', { diameterMas: 3.16, limbDarkening: 0.12 });
  const values = Object.fromEntries(args.map(arg => arg.split('=') as [string, string]));
  assert.equal(Number(values.radius_mas), 1.58);
  assert.deepEqual([values.inclination, values.position_angle, values.ld_law, values.ld1, values.regularizer, values.weight, values.level, values.maxiter], ['90', '0', '1', '0.12', 'tv', '0.05', '4', '500']);
  assert.equal(values.map, '/work/surface-map.fits');
  assert.ok(Math.abs(Number(values.sky_pixel_mas) * 64 - 3.16) < 1e-12, 'the sky render samples the diameter with 64 pixels');
  assert.throws(() => surfaceArguments('data.fits', '/work', { diameterMas: 3, level: 9 }), /HEALPix level/u);
});

test('the summary surface.jl writes is read back, and a truncated one is refused', () => {
  // The Polaris April 2021 run (tv 0.05, level 4), as surface.jl wrote it.
  const text = 'tiles=3072\nvisible_tiles=1520\nvis2=3194\nt3phi=1928\nstart_chi2r_vis2=1.694400\nstart_chi2r_t3phi=19.163753\nchi2r_vis2=1.447476\nchi2r_t3phi=5.584556\ncontrast=0.070804\n';
  const summary = parseSurfaceSummary(text);
  assert.equal(summary.visible_tiles, 1520); assert.equal(summary.chi2r_t3phi, 5.584556);
  assert.throws(() => parseSurfaceSummary('tiles=3072\n'), /lacks visible_tiles/u);
  assert.throws(() => parseSurfaceSummary('tiles=many\n'), /Unreadable/u);
});
