import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareVolumeProvenance, volumeProvenanceCompilerClosure } from './prepare-volume-provenance.mts';
import { prepareContextProvenance, contextProvenanceCompilerClosure } from './prepare-context-provenance.mts';
import { prepareFacilities } from './prepare-facilities.mts';

test('deploy catalogues reuse published volume and context receipts without native images or a baked field', async t => {
  const root = await mkdtemp(join(tmpdir(), 'deploy-catalogues-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [...volumeProvenanceCompilerClosure, ...contextProvenanceCompilerClosure,
    ...['m45', 'betelgeuse-shell'].flatMap(id => ['source/presentation.json', 'source/delivery.json',
      'prepared/provenance.json', 'prepared/presentation.json', 'runtime-assets.json', 'object.json'].map(path => `src/objects/${id}/${path}`)),
    'src/objects/betelgeuse/source/content/object.json',
    'src/objects/nearby-universe/source/preparation/field.json',
    ...['source/presentation.json', 'source/manifest.json', 'prepared/provenance.json', 'prepared/presentation.json', 'runtime-assets.json']
      .map(path => `src/objects/nearby-universe/${path}`)];
  for (const path of new Set(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await copyFile(path, join(root, path));
  }
  const volumes = await prepareVolumeProvenance({ root, preparedOnly: true });
  assert.deepEqual(volumes.map(volume => volume.id), ['betelgeuse-shell', 'm45']);
  assert.ok(volumes.every(volume => volume.outputs.length === 0));
  const m45 = volumes.find(volume => volume.id === 'm45')!;
  assert.equal(m45.route, '/sun/?focus=m45');
  assert.equal(m45.controls.length, 5);
  const attached = volumes.find(volume => volume.id === 'betelgeuse-shell')!;
  assert.equal(attached.hostedBy?.objectId, 'betelgeuse');
  assert.equal(attached.route, '/betelgeuse/');
  const contexts = await prepareContextProvenance({ root, preparedOnly: true });
  assert.deepEqual(contexts.map(context => context.id), ['nearby-universe']);
  assert.equal(contexts[0]!.outputs.length, 0);
  assert.ok(contexts[0]!.provenance.products.length > 0);
  const contextPath = join(root, 'src/objects/nearby-universe/source/presentation.json');
  const contextSource = await readFile(contextPath, 'utf8');
  await writeFile(contextPath, contextSource.replace('"label": "Nearby galaxy distribution"', '"label": "Changed product"'));
  assert.notEqual(await readFile(contextPath, 'utf8'), contextSource);
  await assert.rejects(prepareContextProvenance({ root, preparedOnly: true }), /Stale prepared context products/);
  const presentationPath = join(root, 'src/objects/m45/source/presentation.json');
  const original = await readFile(presentationPath, 'utf8');
  await writeFile(presentationPath, original.replace('"name": "Pleiades"', '"name": "Changed presentation"'));
  assert.notEqual(await readFile(presentationPath, 'utf8'), original);
  await assert.rejects(prepareVolumeProvenance({ root, preparedOnly: true }), /Stale prepared volume presentation/);
});

test('deploy source compilation emits only the two ignored shared catalogues', async () => {
  const result = await prepareFacilities({ preparedOnly: true, publish: false });
  assert.deepEqual(result.outputs.map(output => output.path).sort(),
    ['site/prepared-facilities.json', 'site/prepared-sources.json'].map(path => resolve(path)));
  assert.ok(result.preparedSources.usage.datasets.some(dataset => dataset.objectId === 'm45'));
  assert.ok(result.preparedSources.usage.datasets.some(dataset => dataset.objectId === 'betelgeuse'));
  assert.equal(result.prepared.sourceCatalogSha256, result.preparedSources.catalogSha256);
});
