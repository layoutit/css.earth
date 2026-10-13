import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { resolveInstalledToolchain } from './resolver.js';
import { writeInstalledMarker, type ToolchainPins } from './marker.js';

const pins = (id: string): ToolchainPins => ({ id, file: 'pins.json', descriptor: '{}', lock: null, entry: {} });
test('every toolchain reads validated checkout installs; stale pins and missing interpreters are refused', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'legacy-toolchains-')), userRoot = resolve(temporary, 'user'), workspace = resolve(temporary, 'checkout');
  try {
    for (const id of ['astroquery', 'pds', 'starry', 'spiderman', 'picaso', 'hst', 'eureka', 'jwst', 'pynrc', 'keck', 'gemini', 'chandra', 'spitzer', 'naco', 'tess', 'mearth', 'zdi', 'squeeze', 'rotir', 'pionier', 'amber', 'gravity', 'matisse']) {
      const root = resolve(userRoot, 'output/toolchains', id), legacy = resolve(workspace, 'output/toolchains', id), pin = pins(id);
      await mkdir(resolve(legacy, 'env/bin'), { recursive: true });
      await writeFile(resolve(legacy, 'env/bin/python'), ''); writeInstalledMarker(legacy, pin);
      const options = { userRoot, workspaces: [workspace], home: temporary, env: {} };
      assert.equal(resolveInstalledToolchain(root, pin, [], options, 'env/bin/python'), legacy, id);
      assert.equal(resolveInstalledToolchain(root, { ...pin, descriptor: 'changed' }, [], options), null, id);
      await rm(resolve(legacy, 'env/bin/python'));
      assert.equal(resolveInstalledToolchain(root, pin, [], options, 'env/bin/python'), null, id);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
test('astronomy honours the old cache override and default, while a provisioned test home remains readable', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'legacy-astroquery-')), userRoot = resolve(temporary, 'user'), root = resolve(userRoot, 'output/toolchains/astroquery'), pin = pins('astroquery');
  try {
    for (const parent of [resolve(temporary, '.cache/css-earth/astroquery'), resolve(temporary, 'override'), resolve(temporary, 'provisioned/astroquery')]) {
      const legacy = resolve(parent, 'packages-test'); await mkdir(legacy, { recursive: true }); writeInstalledMarker(legacy, pin);
      const env = parent.endsWith('override') ? { CSS_EARTH_ASTROQUERY_CACHE: parent } : parent.includes('provisioned') ? { CSSEARTH_TELESCOPE_TOOLCHAIN_HOME: resolve(temporary, 'provisioned'), CSS_EARTH_ASTROQUERY_CACHE: resolve(temporary, 'absent') } : {};
      assert.equal(resolveInstalledToolchain(root, pin, [], { userRoot, home: temporary, env, workspaces: [] }), legacy);
      await rm(parent, { recursive: true, force: true });
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
