/** The K2-18 system's packages verify against their source pins. The planet's radius and orbit are the astronomy records'
 * (packages/astronomy/data/bodies), which packages/astronomy/src/hostedOrbits.test.ts checks against the transit geometry. */
import { test } from 'node:test';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');

test('the K2-18 packages verify against their source pins', async () => {
  for (const [id, name] of [['k2-18', 'K2-18'], ['k2-18b', 'K2-18 b']] as const) {
    const source = await createSourceManifest({ planetId: id, planetName: name, sourceRoot: resolve(objects, id, 'source') });
    await source.verify();
  }
});
