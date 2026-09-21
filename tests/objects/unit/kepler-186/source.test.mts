/** The Kepler-186 system's packages verify against their source pins. The planet's radius and orbit are the astronomy records'
 * (packages/astronomy/data/bodies), which packages/astronomy/src/hostedOrbits.test.ts checks against the transit geometry. */
import { test } from 'node:test';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');

test('the Kepler-186 packages verify against their source pins', async () => {
  for (const [id, name] of [['kepler-186', 'Kepler-186'], ['kepler-186f', 'Kepler-186 f']] as const) {
    const source = await createSourceManifest({ planetId: id, planetName: name, sourceRoot: resolve(objects, id, 'source') });
    await source.verify();
  }
});
