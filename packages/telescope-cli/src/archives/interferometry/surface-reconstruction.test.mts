import assert from 'node:assert/strict';
import { sourceTest } from '../../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSurfaceSummary, surfaceArguments } from './surface-reconstruction.mts';
import { toolchainDescriptor, toolchainEnvironment } from './toolchain.mts';

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

/** The digest each toolchains.json entry had before the folder moved beside the telescope code. An installed toolchain records it,
 * so an edit to an entry's text, including the ROTIR environment path, makes every install of it refuse to run. */
const PINNED_DIGESTS: Readonly<Record<string, string>> = {
  squeeze: 'ccad41f0e38983f8e2cc68b3a07a7f9746c0e62d1f5ce2748929fc9def87f71c',
  rotir: '5cd999b3f1af70221fd21e846ae58832891340cb5a0da23195404b38f497a694',
  pionier: '4e6b220de3d1a5730f7b70ae6f32461f86e572e86caa14426a951bbe5ff7773d',
  amber: '9d166b20c8074b3c0d2c763ae516f9ce10ffb779a9a3814c0adf004fb768e8de',
  gravity: 'aa64ebd2144eb80a309b57e9cd2a1917619790fe8af6b922b3c0dbcfa8d38cd8',
  matisse: '7079c86077e1d19b719893a7b50c6b0e37e4769c30dd2888b35d7d2172fc54d5',
  casa: '0cb2860aa858381d78987c9126ece0c45b529a7a41dc0e1ec9f1b9f883e288f8',
};

test('the toolchain pins keep their digests, and the ROTIR environment they recorded is found beside this code', async () => {
  for (const [id, digest] of Object.entries(PINNED_DIGESTS)) assert.equal((await toolchainDescriptor(id)).digest, digest, id);
  const { entry } = await toolchainDescriptor('rotir');
  assert.equal(entry.environment, 'tools/objects/interferometry/rotir', 'the recorded path is kept, since the digest covers it');
  const environment = toolchainEnvironment(entry);
  assert.equal(environment, resolve(import.meta.dirname, 'rotir'));
  for (const file of ['Project.toml', 'Manifest.toml']) await access(resolve(environment, file));
});
