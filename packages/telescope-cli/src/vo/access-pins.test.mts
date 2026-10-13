import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { canonical, type DiscoverySnapshot, type MetadataResponse } from '@cssearth/objects';
import { USER_ROOT } from '@cssearth/telescope-core/node';
import { loadVoInputs } from './bridge.mts';
import { planAccess } from './access.mts';
import { SERVICES } from './discovery.mts';

test('public VO requests keep valid snapshot pins when one raw response has different service URLs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-access-pins-'));
  const profile = SERVICES[0]!;
  const request = { target: 'fixture-star', kind: 'image' as const };
  const catalogue = [{ id: request.target, name: 'Fixture Star', aliases: [], archiveClass: 'star', classificationSource: 'fixture' }];
  const rawText = '<VOTABLE/>';
  const raw = { path: resolve(root, 'discovery.xml'), bytes: Buffer.byteLength(rawText) };
  await writeFile(raw.path, rawText);
  const response: MetadataResponse = {
    schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw, effectiveUrl: profile.service,
    fetchedAt: '2026-10-13T00:00:00Z', httpStatus: 200, queryStatus: 'OK', fields: [], resources: [],
    coordinateSystems: [], timeSystems: [], issues: [], bindings: [], times: [{}],
    rows: [{ obs_publisher_did: 'ivo://fixture/star', obs_id: 'fixture-image', target_name: 'Fixture Star',
      dataproduct_type: 'image', access_url: '/science.fits', access_format: 'image/fits' }],
  };
  const snapshots: DiscoverySnapshot[] = ['https://example.org/a', 'https://example.org/longer', 'https://example.org/b'].map(effectiveUrl => ({
    schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
    request, query: 'fixture', scope: 'fixture', sampleLimit: 1, completeness: 'bounded-sample',
    response: { ...response, effectiveUrl },
  }));
  const explore = async (snapshot: DiscoverySnapshot) => {
    const inputs = await loadVoInputs(root, request, catalogue, undefined, async () => snapshot,
      {}, undefined, undefined, profile.service);
    assert.equal(inputs.records.length, 1);
    const record = inputs.records[0]!;
    assert.deepEqual(record.issues, []);
    assert.equal(record.products.length, 1);
    const product = record.products[0]!;
    assert.equal(product.metadata.length, 2);
    return product;
  };
  try {
    // Read the first pin only after a later request could have overwritten it.
    const first = await explore(snapshots[0]!);
    const directory = resolve(USER_ROOT, 'output/telescopes/vo/metadata');
    const files = () => readdir(directory);
    const firstFiles = await files(), before = await stat(first.metadata[1]!.path);
    const repeated = await explore(snapshots[0]!);
    assert.equal(repeated.metadata[1]!.path, first.metadata[1]!.path);
    assert.deepEqual(await files(), firstFiles);
    assert.equal((await stat(first.metadata[1]!.path)).mtimeMs, before.mtimeMs);
    const second = await explore(snapshots[1]!);
    assert.equal(await readFile(first.metadata[1]!.path, 'utf8'), canonical(snapshots[0]!));
    // Equal-size URL changes must preserve bytes too; size-only checks cannot detect them.
    assert.equal(Buffer.byteLength(canonical(snapshots[0]!)), Buffer.byteLength(canonical(snapshots[2]!)));
    const concurrent = await Promise.all([explore(snapshots[2]!), explore(snapshots[0]!)]);
    const products = [first, second, ...concurrent];
    const expected = [snapshots[0]!, snapshots[1]!, snapshots[2]!, snapshots[0]!];
    assert.equal(new Set(products.map(product => product.metadata[1]!.path)).size, 3);
    const many = { ...snapshots[0]!, query: 'many observations', response: { ...response, effectiveUrl: 'https://example.org/a',
      rows: Array.from({ length: 5 }, (_, i) => ({ ...response.rows[0]!, obs_id: `image-${i}` })), times: Array.from({ length: 5 }, () => ({})) } };
    const beforeMany = await files();
    const inputs = await loadVoInputs(root, request, catalogue, undefined, async () => many, {}, undefined, undefined, profile.service);
    assert.equal(inputs.records.length, 5);
    assert.ok(inputs.records.every(record => record.products.length === 1));
    assert.equal(new Set(inputs.records.map(record => record.products[0]!.metadata[1]!.path)).size, 1);
    assert.equal((await files()).length, beforeMany.length + 1);
    const afterMany = await files();
    await loadVoInputs(root, request, catalogue, undefined, async () => many, {}, undefined, undefined, profile.service);
    assert.deepEqual(await files(), afterMany);
    // Refusal both before and after URL/decoder selection leaves no discovery evidence.
    const observation = inputs.records[0]!.observation;
    for (const refused of [
      { ...observation, target: { ...observation.target, status: 'unmatched' as const } },
      { ...observation, access: { ...observation.access, mime: 'text/html' } },
    ]) {
      const plan = await planAccess(root, refused, { ...many, query: 'refused snapshot' }, request);
      assert.equal(plan.products.length, 0);
      assert.deepEqual(await files(), afterMany);
    }
    for (const [index, product] of products.entries()) {
      for (const pin of product.metadata) assert.equal((await stat(pin.path)).size, pin.bytes);
      assert.equal(await readFile(product.metadata[0]!.path, 'utf8'), rawText);
      const pin = product.metadata[1]!;
      assert.equal(await readFile(pin.path, 'utf8'), canonical(expected[index]!));
      assert.equal(pin.bytes, Buffer.byteLength(canonical(expected[index]!)));
      assert.equal(resolve(pin.path, '..'), resolve(USER_ROOT, 'output/telescopes/vo/metadata'));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
