import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { prepareFactsheet } from './prepare-factsheets.mts';

test('every registered factsheet reproduces its pinned authored facts and evidence', async () => {
  for (const object of SCENE_OBJECTS) {
    await prepareFactsheet(resolve(import.meta.dirname, '../../src/objects', object.id), { check: true });
  }
});

test('fact-only preparation preserves other content, refuses an invalid source and publishes an edited fact', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-facts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'source')); await mkdir(resolve(root, 'prepared'));
  const provenance = { sourceRecord: '../README.md' };
  const source = JSON.stringify({ provenance, panel: { introduction: 'Body description', facts: [{ id: 'radius', label: 'Mean radius', value: '10 km', source: { catalogueId: 'published-model', url: 'http://archive.example/model/1', label: 'Published archive', checked: '2026-09-09' } }] }, lenses: { controls: [{ id: 'normal', label: 'Observed', description: 'Measured area with explicit gaps', summary: 'Measured terrain with gaps.', title: 'Instrument mosaic' }] } });
  const digest = createHash('sha256').update(source).digest('hex');
  const put = (path: string, value: unknown) => writeFile(resolve(root, path), JSON.stringify(value));
  await put('object.json', { id: 'body', properties: { recipe: { sources: [{ id: 'content', path: 'source/content.json' }] } } });
  await writeFile(resolve(root, 'source/content.json'), source);
  // The content is authored here, so the manifest declares it without a pin.
  await put('source/manifest.json', { inputs: [{ path: 'content.json' }], documents: [], generatedIntermediates: [] });
  const untouched = { objectId: 'body', introduction: 'Body description', title: { label: 'Body' }, charts: [{ id: 'accepted-chart' }], resources: [{ href: 'https://example.org/accepted' }] };
  await put('prepared/content.json', { ...untouched, facts: [], provenance: { sourceRecord: '../SOURCE.md' } });
  const geometrySource = { id: 'geometry', path: 'source/shape.json', sha256: 'unchanged' };
  await put('prepared/world-navigation.json', { frame: { bodyRadiusM: 10000 } });
  await put('prepared/authored-preparation.json', { sources: [geometrySource, { id: 'content', sha256: 'old' }] });
  await assert.rejects(prepareFactsheet(root, { check: true }), /stale/);
  await prepareFactsheet(root);
  const published = await readFile(resolve(root, 'prepared/content.json'), 'utf8');
  const { facts, moreFacts, ...rest } = JSON.parse(published);
  assert.deepEqual(rest, { ...untouched, provenance }); assert.equal(facts[0].value, '10 km'); assert.deepEqual(moreFacts, []);
  const navigation = JSON.parse(await readFile(resolve(root, 'prepared/world-navigation.json'), 'utf8'));
  assert.deepEqual(navigation, { frame: { bodyRadiusM: 10000 } }, 'the frame receipt names no source pins to refresh');
  const authored = JSON.parse(await readFile(resolve(root, 'prepared/authored-preparation.json'), 'utf8'));
  assert.deepEqual(authored.sources[0], geometrySource);
  assert.equal(authored.sources[1].sha256, digest);
  const invalid = source.replace('http://archive.example/model/1', 'javascript:alert(1)');
  const invalidDigest = createHash('sha256').update(invalid).digest('hex');
  await writeFile(resolve(root, 'source/content.json'), invalid);
  const descriptorBytes = await readFile(resolve(root, 'object.json'), 'utf8');
  await writeFile(resolve(root, 'object.json'), descriptorBytes.replace(digest, invalidDigest));
  await assert.rejects(prepareFactsheet(root), /Invalid source URL/);
  assert.equal(await readFile(resolve(root, 'prepared/content.json'), 'utf8'), published);
  await writeFile(resolve(root, 'object.json'), descriptorBytes);
  await writeFile(resolve(root, 'source/content.json'), source.replace('10 km', '20 km'));
  await assert.rejects(prepareFactsheet(root, { check: true }), /stale/, 'an edited fact is reported until it is published');
  await prepareFactsheet(root);
  assert.equal(JSON.parse(await readFile(resolve(root, 'prepared/content.json'), 'utf8')).facts[0].value, '20 km');
});
