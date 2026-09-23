import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { skyPlaneOrientation } from '@cssearth/astronomy';
import { TODO, scaffoldStarFiles, solarRadii } from './new-star.mts';
import { temperatureCatalogueColor } from './star-catalogue-color.mts';

const root = resolve(import.meta.dirname, '../..');
const EPOCH = 2461286.5;
const spec = { id: 'antares', name: 'Antares', system: 'Scorpius', temperatureK: 3660, temperatureSource: 'Effective temperature 3660 ± 120 K from Ohnaka et al. 2013 (https://arxiv.org/abs/1304.4800), abstract.', description: 'Red supergiant in Scorpius.', paper: 'https://arxiv.org/abs/1304.4800', paperCredit: 'Ohnaka et al. (2013)' };

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
  const color = temperatureCatalogueColor(spec.temperatureK);
  assert.equal(descriptor.properties.catalog.color, color, 'the catalogue colour is the star field colour at the cited temperature');
  assert.equal(json('source/preparation/geometry.json').surface.color, color);
  assert.equal(json('source/measurements.json').effectiveTemperatureK, spec.temperatureK);
  assert.equal(json('source/measurements.json').effectiveTemperatureSource, spec.temperatureSource);
  assert.equal(json('source/content/object.json').provenance.editorial.url, spec.paper);
  const manifest = json('source/manifest.json');
  assert.equal(manifest.documents.find((document: { path: string }) => document.path === 'content/object.json').sourceBinding.kind, 'local', 'provenance needs the content record bound');
  // Content provenance paths resolve from the content record's folder, as the shipped stars write them.
  assert.equal(json('source/content/object.json').provenance.physical.path, JSON.parse(await readFile(resolve(root, 'src/objects/antares/source/content/object.json'), 'utf8')).provenance.physical.path);
});

test('prose the scaffold cannot know is marked, and the package it writes matches a shipped shape-only star', async () => {
  const record = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies/antares.json'), 'utf8'));
  const files = scaffoldStarFiles(spec, record, EPOCH);
  for (const path of ['text.json', 'README.md', 'NOTICE.md', 'source/measurements.json', 'source/content/object.json']) assert.match(files.get(`src/objects/antares/${path}`)!, new RegExp(TODO.replace(/[()]/gu, '\\$&'), 'u'), path);
  // The records a shipped shape-only star keeps structurally as generated.
  for (const path of ['source/preparation/celestial.json', 'source/preparation/presentation.json', 'source/preparation/navigation.json']) {
    assert.equal(files.get(`src/objects/antares/${path}`), await readFile(resolve(root, 'src/objects/antares', path), 'utf8'), path);
  }
  assert.deepEqual(JSON.parse(files.get('src/objects/antares/source/presentation/solar-system.json')!), JSON.parse(await readFile(resolve(root, 'src/objects/antares/source/presentation/solar-system.json'), 'utf8')));
  assert.throws(() => scaffoldStarFiles({ ...spec, temperatureK: Number.NaN }, record, EPOCH), /effectiveTemperatureK/u);
  assert.throws(() => scaffoldStarFiles({ ...spec, temperatureK: 100 }, record, EPOCH), /1,000 and 40,000 K/u);
  assert.throws(() => scaffoldStarFiles({ ...spec, temperatureSource: 'Ohnaka et al. 2013' }, record, EPOCH), /URL/u);
  assert.throws(() => scaffoldStarFiles(spec, { ...record, star: { ...record.star, presentationUp: undefined } }, EPOCH), /presentationUp/u);
});

test('the panel radius keeps two significant figures below ten solar radii', () => {
  assert.equal(solarRadii(0.6489), '0.65');
  assert.equal(solarRadii(1.0), '1');
  assert.equal(solarRadii(2.345), '2.3');
  assert.equal(solarRadii(764.3), '764');
});
