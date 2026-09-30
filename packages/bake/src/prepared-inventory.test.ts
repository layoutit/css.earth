import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after as afterAll, before as beforeAll, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepareStarsObject } from './stars/index.ts';
import { prepareSurfaceShellObject } from './shell/index.ts';
import { prepareDensityVolumeObject } from './density/index.ts';

// A bake into an object's own `prepared/` directory publishes it, so it must record the published closure through the host's
// inventory; the package never imports the platform's. The guard runs before anything is read or written.
const bakes = { stars: prepareStarsObject, shell: prepareSurfaceShellObject, density: prepareDensityVolumeObject };
const guard = /needs the host inventory/u;
let object = '';
beforeAll(async () => { object = await mkdtemp(join(tmpdir(), 'bake-inventory-')); });
afterAll(async () => { await rm(object, { recursive: true, force: true }); });

for (const [name, bake] of Object.entries(bakes)) {
  it(`${name}: a bake into the object's prepared directory without the host inventory is refused before it reads anything`, async () => {
    await assert.rejects(bake({ objectDirectory: object }), guard);
    await assert.rejects(bake({ objectDirectory: object, outputDirectory: join(object, 'prepared') }), guard);
  });
  it(`${name}: with the inventory, or into a scratch directory, the bake proceeds past the guard`, async () => {
    const inventory = async () => { throw new Error('the inventory runs only after a complete bake'); };
    await assert.rejects(bake({ objectDirectory: object, inventory }), /ENOENT/u);
    await assert.rejects(bake({ objectDirectory: object, outputDirectory: join(object, 'scratch') }), /ENOENT/u);
  });
}
