import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';
import { initialFocusCatalog, readInitialFocus } from '../focus-catalog.mts';

const catalogue = parsePreparedGalaxyCatalog(JSON.parse(await readFile(
  new URL('../../src/objects/local-group/prepared/catalogue.json', import.meta.url), 'utf8')));
const smc = catalogue.objects.find(object => object.id === 'smc')!;

test('an initial galaxy focus retains its transitive positioned and unpositioned physical hosts', () => {
  const fragment = initialFocusCatalog(catalogue, smc);
  assert.equal(fragment.schema, 'cssearth-galaxy-catalog@1');
  assert.deepEqual(fragment.objects.map(object => object.id), ['lmc', 'smc']);
  assert.deepEqual(fragment.unpositionedHosts?.map(object => object.id), ['mw']);
  const document = parseHTML(`<script type="application/json" data-initial-focus="smc">${JSON.stringify(fragment)}</script>`).document;
  assert.equal(readInitialFocus(document)?.id, 'smc', 'the explicit identity selects SMC rather than its first positioned host');
});

test('initial focus host closure fails on a missing host and a cycle', () => {
  const missing = { ...catalogue, objects: catalogue.objects.map(object => object.id === 'smc' ? { ...object, hostId: 'missing-host' } : object) };
  assert.throws(() => initialFocusCatalog(missing, missing.objects.find(object => object.id === 'smc')!), /Unknown physical host: missing-host/);
  const cyclic = { ...catalogue, objects: catalogue.objects.map(object => object.id === 'lmc' ? { ...object, hostId: 'smc' } : object) };
  assert.throws(() => initialFocusCatalog(cyclic, cyclic.objects.find(object => object.id === 'smc')!), /Cyclic physical host: smc/);
});

test('initial focus requires an explicit selected identity present in the parsed fragment', () => {
  const fragment = initialFocusCatalog(catalogue, smc);
  for (const id of ['', 'not-present']) {
    const document = parseHTML(`<script type="application/json" data-initial-focus="${id}">${JSON.stringify(fragment)}</script>`).document;
    assert.throws(() => readInitialFocus(document), /Initial focus identity/);
  }
});
