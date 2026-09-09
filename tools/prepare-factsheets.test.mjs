import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { OBJECTS } from '../site/objects.mjs';
import { prepareFactsheet } from './prepare-factsheets.mjs';

test('every registered factsheet reproduces its pinned authored facts and evidence', async () => {
  for (const object of OBJECTS) {
    await prepareFactsheet(resolve(import.meta.dirname, '../src/planets', object.id), { check: true });
  }
});

test('fact-only preparation preserves other content and rejects source drift before writing', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-facts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'source')); await mkdir(resolve(root, 'prepared'));
  const source = JSON.stringify({ panel: { introduction: 'Body description', facts: [{ id: 'radius', label: 'Mean radius', value: '10 km' }] }, lenses: { controls: [{ id: 'normal', label: 'Observed', description: 'Measured area with explicit gaps', summary: 'Measured terrain with gaps.', title: 'Instrument mosaic' }] } });
  const digest = createHash('sha256').update(source).digest('hex');
  const put = (path, value) => writeFile(resolve(root, path), JSON.stringify(value));
  await put('object.json', { id: 'body', properties: { recipe: { sources: [{ id: 'content', path: 'source/content.json', sha256: digest }] } } });
  await writeFile(resolve(root, 'source/content.json'), source);
  await put('source/manifest.json', { inputs: [{ path: 'content.json', expectedBytes: Buffer.byteLength(source), expectedSha256: digest }], documents: [], generatedIntermediates: [] });
  const untouched = { objectId: 'body', introduction: 'Body description', title: { label: 'Body' }, charts: [{ id: 'accepted-chart' }], resources: [{ href: 'https://example.org/accepted' }] };
  await put('prepared/content.json', { ...untouched, facts: [] });
  const geometrySource = { id: 'geometry', path: 'source/shape.json', sha256: 'unchanged' };
  await put('prepared/world-navigation.json', { frame: { bodyRadiusM: 10000 }, sources: [geometrySource, { id: 'content', sha256: 'old' }] });
  await assert.rejects(prepareFactsheet(root, { check: true }), /stale/);
  await prepareFactsheet(root);
  const published = await readFile(resolve(root, 'prepared/content.json'), 'utf8');
  const { facts, moreFacts, ...rest } = JSON.parse(published);
  assert.deepEqual(rest, untouched); assert.equal(facts[0].value, '10 km'); assert.deepEqual(moreFacts, []);
  const navigation = JSON.parse(await readFile(resolve(root, 'prepared/world-navigation.json'), 'utf8'));
  assert.deepEqual(navigation.frame, { bodyRadiusM: 10000 });
  assert.deepEqual(navigation.sources[0], geometrySource);
  assert.equal(navigation.sources[1].sha256, digest);
  const lens = { id: 'normal', label: 'Old label', description: 'Shorthand', title: 'Old title', surfaceUrl: '/accepted.webp', legend: { labels: ['0', '10'] } };
  await put('prepared/controls.json', { lenses: { controls: [lens] }, settings: { accepted: true } });
  await put('prepared/lenses.json', { controls: [lens], defaultLens: 'normal' });
  await put('prepared/runtime.json', { controls: { lenses: { controls: [lens] }, settings: { accepted: true } }, tree: { accepted: true }, assets: ['accepted'] });
  await prepareFactsheet(root, { editorial: true });
  const updated = JSON.parse(await readFile(resolve(root, 'prepared/lenses.json'), 'utf8'));
  assert.equal(updated.controls[0].description, 'Measured area with explicit gaps');
  assert.equal(updated.controls[0].summary, 'Measured terrain with gaps.');
  assert.equal(updated.controls[0].surfaceUrl, '/accepted.webp');
  assert.deepEqual(updated.controls[0].legend, lens.legend);
  assert.deepEqual(JSON.parse(await readFile(resolve(root, 'prepared/controls.json'), 'utf8')).settings, { accepted: true });
  const runtime = JSON.parse(await readFile(resolve(root, 'prepared/runtime.json'), 'utf8'));
  assert.equal(runtime.controls.lenses.controls[0].description, updated.controls[0].description);
  assert.equal(runtime.controls.lenses.controls[0].summary, updated.controls[0].summary);
  assert.deepEqual(runtime.tree, { accepted: true });
  assert.deepEqual(runtime.assets, ['accepted']);
  await writeFile(resolve(root, 'source/content.json'), source.replace('10 km', '20 km'));
  await assert.rejects(prepareFactsheet(root), /source pin differs/);
  assert.equal(await readFile(resolve(root, 'prepared/content.json'), 'utf8'), published);
});
