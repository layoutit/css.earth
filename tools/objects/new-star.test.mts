import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { skyPlaneOrientation } from '@cssearth/astronomy';
import { TODO, scaffoldStarFiles } from './new-star.mts';

const root = resolve(import.meta.dirname, '../..');
const EPOCH = 2461286.5;
const spec = { id: 'antares', name: 'Antares', system: 'Scorpius', color: '#ff8a5a', description: 'Red supergiant in Scorpius.', paper: 'https://arxiv.org/abs/1304.4800', paperCredit: 'Ohnaka et al. (2013)' };

test('a scaffold derives every number from the astronomy record and writes names unescaped', async () => {
  const record = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/antares.json'), 'utf8')) as { star: { rightAscensionDegrees: number; declinationDegrees: number }; physical: { meanRadiusKm: number } };
  const files = scaffoldStarFiles({ ...spec, name: 'π¹ Test' }, record, EPOCH);
  const json = (path: string) => JSON.parse(files.get(`src/objects/antares/${path}`)!) as Record<string, any>;
  assert.match(files.get('src/objects/antares/source/presentation/solar-system.json')!, /"displayName": "π¹ Test"/u, 'a non-ASCII name is written as itself');
  const rotation = json('source/preparation/rotation.json'), expected = skyPlaneOrientation(record.star, 0);
  assert.deepEqual([rotation.rightAscensionDegrees, rotation.declinationDegrees, rotation.displayMeridianDegrees], [expected.rightAscensionDegrees, expected.declinationDegrees, expected.displayMeridianDegrees]);
  const descriptor = json('object.json'), prepared = JSON.parse(await readFile(resolve(root, 'src/objects/antares/object.json'), 'utf8'));
  const au = (frame: { originM: number[] }) => Math.hypot(...frame.originM) / 149597870700;
  assert.ok(Math.abs(au(descriptor.properties.worldFrame) - au(prepared.properties.worldFrame)) / au(prepared.properties.worldFrame) < 1e-9, 'the first frame is placed where preparation places the star');
  assert.equal(descriptor.properties.catalog.distanceAu, Math.round(au(descriptor.properties.worldFrame) * 10) / 10);
  assert.equal(descriptor.properties.recipe.shape.radiusKm, record.physical.meanRadiusKm);
  assert.equal(json('source/preparation/geometry.json').surface.color, spec.color);
  assert.equal(json('source/content/object.json').provenance.editorial.url, spec.paper);
  // Content provenance paths resolve from the content record's folder, as the shipped stars write them.
  assert.equal(json('source/content/object.json').provenance.physical.path, JSON.parse(await readFile(resolve(root, 'src/objects/antares/source/content/object.json'), 'utf8')).provenance.physical.path);
});

test('prose the scaffold cannot know is marked, and the package it writes matches a shipped shape-only star', async () => {
  const record = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/antares.json'), 'utf8'));
  const files = scaffoldStarFiles(spec, record, EPOCH);
  for (const path of ['text.json', 'README.md', 'NOTICE.md', 'source/measurements.json']) assert.match(files.get(`src/objects/antares/${path}`)!, new RegExp(TODO.replace(/[()]/gu, '\\$&'), 'u'), path);
  // The records a shipped shape-only star keeps structurally as generated.
  for (const path of ['source/preparation/celestial.json', 'source/preparation/presentation.json', 'source/preparation/navigation.json']) {
    assert.equal(files.get(`src/objects/antares/${path}`), await readFile(resolve(root, 'src/objects/antares', path), 'utf8'), path);
  }
  assert.deepEqual(JSON.parse(files.get('src/objects/antares/source/presentation/solar-system.json')!), JSON.parse(await readFile(resolve(root, 'src/objects/antares/source/presentation/solar-system.json'), 'utf8')));
  assert.throws(() => scaffoldStarFiles({ ...spec, color: 'orange' }, record, EPOCH), /colour/u);
  assert.throws(() => scaffoldStarFiles(spec, { ...record, star: { ...record.star, presentationUp: undefined } }, EPOCH), /presentationUp/u);
});
