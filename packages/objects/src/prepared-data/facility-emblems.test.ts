import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { FACILITY_EMBLEMS_SCHEMA, parseFacilityEmblemLibrary, parseFacilityEmblemImage } from './facility-emblems.js';
import { explorationRecord } from '../provenance/exploration-catalog.js';

test('real emblem records retain entry ordering and artwork projection', async () => {
  const raw: unknown = JSON.parse(await readFile(new URL('../../../../site/source/facilities/emblem-library.json', import.meta.url), 'utf8'));
  const library = parseFacilityEmblemLibrary(raw);
  assert.equal(library.schema, FACILITY_EMBLEMS_SCHEMA);
  assert.equal(library.entries.length, 24);
  for (const entry of library.entries) {
    const image = parseFacilityEmblemImage(entry, explorationRecord(entry.source));
    assert.equal(image.id, entry.id);
    assert.equal(image.kind, 'emblem');
    assert.equal(image.bytes, entry.bytes);
  }
});

test('emblem structural stages retain exact errors without resolving sources early', () => {
  assert.throws(() => parseFacilityEmblemLibrary({schema: 'unsupported', entries: []}), {message: 'Unsupported artwork library.'});
  assert.throws(() => parseFacilityEmblemLibrary({schema: FACILITY_EMBLEMS_SCHEMA, entries: [null]}), {message: 'Expected an exploration record.'});
  const entry = {id: 'fixture', src: '/shell/facility-emblems/fixture.png', width: 128, height: 128, bytes: 5, sourceBinding: null};
  const library = parseFacilityEmblemLibrary({schema: FACILITY_EMBLEMS_SCHEMA, entries: [entry]});
  assert.equal(library.entries[0], entry, 'source resolution belongs to the caller');
  assert.throws(() => parseFacilityEmblemImage({...entry, width: 0}, {credit: 'Credit', sourceUrl: 'https://example.org/source'}), {message: 'Invalid artwork dimensions/bytes.'});
});

test('serialized identifiers stay byte-identical', () => {
  assert.equal(FACILITY_EMBLEMS_SCHEMA, 'cssearth-facility-emblems@3');
});
