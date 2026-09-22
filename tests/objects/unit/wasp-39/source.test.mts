/** The WASP-39 system's packages verify against their source pins. The planet's radius and orbit are the astronomy records'
 * (packages/astronomy/data/bodies), which packages/astronomy/src/hostedOrbits.test.ts checks against the transit geometry. */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-39');
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');

test('the WASP-39 packages verify against their source pins', async () => {
  for (const [id, name] of [['wasp-39', 'WASP-39'], ['wasp-39b', 'WASP-39 b']] as const) {
    const source = await createSourceManifest({ planetId: id, planetName: name, sourceRoot: resolve(objects, id, 'source') });
    await source.verify();
  }
});

test('WASP-39 b transits within 0.3 minutes of every JWST transit this package measured', async () => {
  const { readFile } = await import('node:fs/promises');
  const { hostedOrbit } = await import('@cssearth/astronomy');
  const orbit = hostedOrbit('wasp-39b');
  const [header, ...rows] = (await readFile(resolve(objects, 'wasp-39b/source/science/jwst-transits/transit-times.csv'), 'utf8')).trim().split('\n');
  if (header !== 'mast_product,mid_transit_bmjd_tdb,uncertainty_s,depth,duration_days') throw new Error(`Unexpected header ${header}`);
  if (rows.length !== 6) throw new Error(`Expected six transits, found ${rows.length}`);
  for (const row of rows) {
    const time = Number(row.split(',')[1]), cycles = Math.round((time - orbit.transitTimeBmjdTdb) / orbit.periodDays);
    const minutes = (orbit.transitTimeBmjdTdb + cycles * orbit.periodDays - time) * 1440;
    if (!(Math.abs(minutes) <= 0.3)) throw new Error(`${row.split(',')[0]}: predicted ${minutes.toFixed(2)} min off`);
  }
});
