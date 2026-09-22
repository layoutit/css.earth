/** Every authored photograph lens validates against its format's recipe schema, and a lens refuses what its format does not declare. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { fixtureRecord } from '../../contract/test-values.mts';
import { parseTerrestrialProfile } from '../terrestrial-layers/index.mts';

const planets = new URL('../../../src/objects/', import.meta.url);
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
    // A frame keeps its archive product id in lower case; anything else is refused.
    ['frame id', lens => { fixtureRecord(lens, 'frames', 0)['id'] = 'N1506184171_1'; }],
    // A lens without transfer limits refuses a transfer block; a lens with them refuses an undeclared limit.
    ['transfer key', lens => { const record = fixtureRecord(lens); if (record.transfer === undefined) record.transfer = { maximumSeparationMeters: 1 }; else fixtureRecord(lens, 'transfer')['maximumSeparation'] = 1; }],
    ['second display', lens => { const display = fixtureRecord(lens, 'display'); display[display.percentiles ? 'displayRange' : 'percentiles'] = [1, 99]; }],
    // A palette needs two hex colours, and only a monochrome camera lens may carry one.
    ['one-colour palette', lens => { fixtureRecord(lens, 'display')['palette'] = ['#ffffff']; }],
    ['named-colour palette', lens => { fixtureRecord(lens, 'display')['palette'] = ['black', 'white']; }],
  ];
  for (const { id, profile } of authored) profile.raster.surfaceObservations.forEach((_, index) => {
    for (const [name, change] of changes) {
      const changed = structuredClone(profile); change(changed.raster.surfaceObservations[index]);
      assert.throws(() => parseTerrestrialProfile(changed), /source-bound|source-registered/, `${id} lens ${index} accepted a ${name}`);
    }
  });
});

test('NEAR MSI requires raw detector companions and bounded camera refinement without configurable compression or photometric correction', () => {
  const mathilde = authored.find(body => body.id === 'mathilde');
  assert.ok(mathilde);
  const index = mathilde.profile.raster.surfaceObservations.findIndex(lens => fixtureRecord(lens).format === 'near-msi-camera');
  assert.ok(index >= 0);
  for (const alter of [
    (lens: unknown) => { delete fixtureRecord(lens, 'frames', 0).originalPath; },
    (lens: unknown) => { delete fixtureRecord(lens, 'frames', 0).cameraPath; },
    (lens: unknown) => { delete fixtureRecord(lens).limbRefinement; },
    (lens: unknown) => { fixtureRecord(lens).allowLossy = true; },
    (lens: unknown) => { fixtureRecord(lens, 'photometry').model = 'lommel-seeliger'; },
  ]) {
    const changed = structuredClone(mathilde.profile);
    alter(changed.raster.surfaceObservations[index]);
    assert.throws(() => parseTerrestrialProfile(changed), /source-bound/);
  }
});

test('a controlled camera names a published model or a disk function, never a mix, and filter colour refuses a single-filter model', () => {
  const ida = authored.find(body => body.id === 'ida'), proteus = authored.find(body => body.id === 'proteus');
  assert.ok(ida && proteus);
  const calibrated = ida.profile.raster.surfaceObservations.findIndex(lens => fixtureRecord(lens).id === 'calibrated');
  const color = proteus.profile.raster.surfaceObservations.findIndex(lens => fixtureRecord(lens).id === 'filter-color');
  assert.ok(calibrated >= 0 && color >= 0);
  const published = structuredClone(fixtureRecord(ida.profile.raster.surfaceObservations[calibrated], 'photometry'));
  const refused: [string, typeof ida, number, (lens: unknown) => void][] = [
    ['mixed photometry block', ida, calibrated, lens => { fixtureRecord(lens, 'photometry')['weight'] = 0.5; }],
    ['published emission limit beyond the transfer limit', ida, calibrated, lens => { fixtureRecord(lens, 'photometry', 'limits')['maximumEmissionDegrees'] = 89; }],
    ['single-filter model on filter colour', proteus, color, lens => { fixtureRecord(lens)['photometry'] = structuredClone(published); }],
  ];
  for (const [name, body, index, change] of refused) {
    const changed = structuredClone(body.profile); change(changed.raster.surfaceObservations[index]);
    assert.throws(() => parseTerrestrialProfile(changed), /source-bound/, `${body.id} accepted a ${name}`);
  }
});

test('the retired raster.mosaics group refuses any lens, so photograph lenses stay on the surface-observation contract', () => {
  const body = authored.find(candidate => candidate.id === 'pallene');
  assert.ok(body);
  const changed = structuredClone(body.profile);
  fixtureRecord(changed, 'raster')['mosaics'] = [structuredClone(changed.raster.surfaceObservations[0])];
  assert.throws(() => parseTerrestrialProfile(changed), /raster\.mosaics is retired/);
  fixtureRecord(changed, 'raster')['mosaics'] = [];
  assert.doesNotThrow(() => parseTerrestrialProfile(changed), 'an empty retired group is still accepted');
});
