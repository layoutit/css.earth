/** Every authored photograph lens validates against its format's recipe schema, and a lens refuses what its format does not declare. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { fixtureRecord } from '../../test-values.mts';
import { parseTerrestrialProfile } from '../terrestrial-layers/index.mts';

const planets = new URL('../../../src/planets/', import.meta.url);
const authored: { id: string; profile: { raster: { surfaceObservations: unknown[] } } }[] = [];
for (const id of (await readdir(planets)).sort()) {
  const profile = await readFile(new URL(`${id}/source/preparation/terrestrial.json`, planets), 'utf8').then(JSON.parse, () => null);
  if (profile?.raster?.surfaceObservations?.length) authored.push({ id, profile });
}

test('every authored photograph lens validates against its format schema', () => {
  assert.ok(authored.length > 0);
  for (const { id, profile } of authored) assert.doesNotThrow(() => parseTerrestrialProfile(profile), id);
});

test('a lens refuses keys its format does not declare and a second display', () => {
  const changes: [string, (lens: unknown) => void][] = [
    ['lens key', lens => { fixtureRecord(lens)['displayPercentiles'] = [1, 99]; }],
    ['frame key', lens => { fixtureRecord(lens, 'frames', 0)['exposure'] = 1; }],
    // A lens without transfer limits refuses a transfer block; a lens with them refuses an undeclared limit.
    ['transfer key', lens => { const record = fixtureRecord(lens); if (record.transfer === undefined) record.transfer = { maximumSeparationMeters: 1 }; else fixtureRecord(lens, 'transfer')['maximumSeparation'] = 1; }],
    ['second display', lens => { const display = fixtureRecord(lens, 'display'); display[display.percentiles ? 'displayRange' : 'percentiles'] = [1, 99]; }],
  ];
  for (const { id, profile } of authored) profile.raster.surfaceObservations.forEach((_, index) => {
    for (const [name, change] of changes) {
      const changed = structuredClone(profile); change(changed.raster.surfaceObservations[index]);
      assert.throws(() => parseTerrestrialProfile(changed), /source-bound|source-registered/, `${id} lens ${index} accepted a ${name}`);
    }
  });
});
