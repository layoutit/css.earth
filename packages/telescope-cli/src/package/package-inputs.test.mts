import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { requireWorkspace } from '@cssearth/telescope-core/node';
import { prepareSpherePackage } from '../sphere/sphere-package.mts';

test('pack-data preparation names the missing solar input and its preparation command', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-unprepared-'));
  try {
    await assert.rejects(prepareSpherePackage(root, resolve(root, 'data')),
      error => error instanceof Error && error.message.includes('src/platform/solar-geometry.mts') && error.message.includes('pnpm prepare:inputs'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('pack-data preparation names a missing restored sphere runtime', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-unrestored-'));
  try {
    await mkdir(resolve(root, 'src/platform'), { recursive: true });
    await writeFile(resolve(root, 'src/platform/solar-geometry.mts'), `
      export const SOLAR_GEOMETRY_EPOCH_LABEL = 'fixture', SOLAR_GEOMETRY_EPOCH_JD_TT = 1, ASTRONOMICAL_UNIT_KILOMETERS = 1;
      export const requireBodyFixedSunDirection = () => [1, 0, 0], requireBodyFixedEclipticNorth = () => [0, 0, 1];
      export const requireBodyFixedToIcrf = () => [1, 0, 0, 0, 1, 0, 0, 0, 1], bodyFixedStarDirection = () => null;
      export const requireBodyOrbit = () => ({ heliocentricDistanceAu: 1 });
    `);
    const recipe = resolve(root, 'src/objects/fixture/source/preparation');
    await mkdir(recipe, { recursive: true });
    for (const name of ['raster.json', 'geometry.json']) await writeFile(resolve(recipe, name), '{}');
    await assert.rejects(prepareSpherePackage(root, resolve(root, 'data')),
      error => error instanceof Error && error.message.includes('fixture/prepared/runtime.json') && error.message.includes('pnpm setup:prepared'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('tracked bin runs source before build and a compiled installed command without TypeScript sources', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-launcher-'));
  try {
    const packageRoot = resolve(root, 'node_modules/@cssearth/telescope');
    await mkdir(resolve(packageRoot, 'dist'), { recursive: true });
    await copyFile(resolve(requireWorkspace(), 'packages/telescope-cli/run-typed-module.mjs'), resolve(packageRoot, 'run-typed-module.mjs'));
    const launch = (...args: string[]) => spawnSync(process.execPath, [resolve(packageRoot, 'run-typed-module.mjs'), ...args], { cwd: root, encoding: 'utf8' });
    await writeFile(resolve(packageRoot, 'dist/telescope.mjs'), "console.log('COMPILED', JSON.stringify(process.argv.slice(2))); process.exitCode = 7;\n");
    const installed = launch('--version');
    assert.equal(installed.status, 7, installed.stderr);
    assert.match(installed.stdout, /COMPILED \["--version"\]/u);
    const unknown = launch('unknown.mts');
    assert.equal(unknown.status, 7, unknown.stderr);
    assert.match(unknown.stdout, /COMPILED \["unknown.mts"\]/u);
    // Source checkout outside node_modules, where Node permits TypeScript stripping.
    const checkout = resolve(root, 'checkout');
    await mkdir(resolve(checkout, 'src'), { recursive: true });
    await copyFile(resolve(packageRoot, 'run-typed-module.mjs'), resolve(checkout, 'run-typed-module.mjs'));
    await writeFile(resolve(checkout, 'src/bin.mts'), "const args: string[] = process.argv.slice(2); console.log('SOURCE', JSON.stringify(args)); process.exitCode = 2;\n");
    const source = spawnSync(process.execPath, [resolve(checkout, 'run-typed-module.mjs'), 'unknown-command', '--json'], { cwd: root, encoding: 'utf8' });
    assert.equal(source.status, 2, source.stderr);
    assert.match(source.stdout, /SOURCE \["unknown-command","--json"\]/u);
    const explicit = spawnSync(process.execPath, [resolve(checkout, 'run-typed-module.mjs'), resolve(checkout, 'src/bin.mts'), '--help'], { cwd: root, encoding: 'utf8' });
    assert.equal(explicit.status, 2, explicit.stderr);
    assert.match(explicit.stdout, /SOURCE \["--help"\]/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
