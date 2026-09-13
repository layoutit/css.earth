import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OBJECTS } from '../objects.mts';
import { objectSources } from '../object-sources.mts';
import { productSourceIds, validateObjectProvenance } from '../../src/platform/object-provenance.mts';

const read = async (id: string) => {
  const document = validateObjectProvenance(JSON.parse(await readFile(new URL(`../../src/objects/${id}/prepared/provenance.json`, import.meta.url), 'utf8')), id);
  return { ...document, sources: document.sources.map(source => ({ ...source })) };
};

test('shared attribution keeps Mercury’s three distinct product links and credits them once', async () => {
  const document = await read('mercury'), before = structuredClone(document);
  const sources = objectSources(document);
  const maps = sources.find(group => group.description === 'USGS · NASA/MESSENGER');
  assert.ok(maps);
  assert.equal(maps.links.length, 3);
  assert.equal(new Set(maps.links.map(link => link.href)).size, 3);
  assert.deepEqual(maps.links.map(link => link.label), [
    'MESSENGER MDIS monochrome mosaic', 'MESSENGER MDIS enhanced-color mosaic', 'MESSENGER global shaded relief',
  ]);
  assert.equal(sources.filter(group => group.description === maps.description).length, 1);
  assert.ok(sources.flatMap(group => group.links).some(link => link.href === 'https://doi.org/10.5281/zenodo.7433033'));
  assert.ok(document.sources.some(source => /CC-BY/u.test(source.license ?? '')));
  assert.ok(sources.every(group => !/CC-BY|\bMIT\b/u.test(group.description)));
  assert.ok(sources.flatMap(group => group.links).every(link => !/object\.json|provenance\//u.test(link.href ?? link.label)));
  assert.deepEqual(document, before);
});

test('every registered body uses the same projection and keeps every consumed source identity', async () => {
  for (const { id } of OBJECTS) {
    const document = validateObjectProvenance(await read(id), id), before = JSON.stringify(document);
    const groups = objectSources(document), links = groups.flatMap(group => group.links);
    const used = new Set(document.products.flatMap(product => productSourceIds(document, product.id)));
    const expected = document.sources.filter(source => source.kind === 'source-input' && used.has(source.id)
      && [source.sourceUrl, source.origin, source.acquisitionOperation?.url,
        ...(source.verificationOperations ?? []).map(operation => operation.url)].some(url => typeof url === 'string' && /^https?:\/\//u.test(url) && !/[\s{}]/u.test(url)));
    assert.deepEqual(new Set(links.map(link => link.id)), new Set(expected.map(source => source.id)), id);
    assert.equal(links.length, expected.length, `${id}: no link collapsed or duplicated`);
    assert.ok(groups.every(group => group.description && group.links.length), id);
    assert.ok(links.every(link => link.label), id);
    assert.equal(JSON.stringify(document), before, `${id}: presentation changed provenance`);
  }
});

test('grouping preserves every link and underlying rights while showing the shared credit once', async () => {
  const document = await read('mercury');
  const inputs = document.sources.filter(source => source.kind === 'source-input');
  for (const source of inputs) {
    source.displayCredit = 'Shared archive'; source.license = 'License A'; delete source.attributionGroup;
    source.sourceUrl = 'https://example.org/shared-product-page';
  }
  inputs[0].license = 'License B';
  const before = structuredClone(document), groups = objectSources(document);
  assert.equal(groups.length, 1);
  assert.equal(groups.flatMap(group => group.links).length, inputs.length);
  assert.deepEqual(groups.map(group => group.description), ['Shared archive']);
  assert.deepEqual(document, before);
});

test('factsheet URLs and arbitrary URL-like strings cannot become source evidence', async () => {
  assert.throws(() => Reflect.apply(objectSources, undefined, [{ facts: [{ source: { url: 'https://example.org' } }] }]), /Invalid object provenance/u);
  const document = await read('mercury');
  for (const source of document.sources) {
    source.sourceUrl = 'https://example.org/{tile}'; source.origin = 'https://example.org/api, request details';
    source.acquisitionOperation = null; source.verificationOperations = [];
  }
  assert.deepEqual(objectSources(document), []);
});
