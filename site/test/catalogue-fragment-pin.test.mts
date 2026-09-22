import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseCatalogueFragmentPin, parseCatalogueIndexPin, readCatalogueFragmentPin, readCatalogueIndexPin } from '../catalogue-fragment-pin.mts';

const sha = 'a'.repeat(64);
const valid = { url: `/catalogue/${sha}.html`, sha256: sha, bytes: 1234 };
const validIndex = { url: `/catalogue/${sha}.json`, sha256: sha, bytes: 5678 };

test('parseCatalogueFragmentPin accepts a well-formed pin and rejects everything else', () => {
  assert.deepEqual(parseCatalogueFragmentPin(valid), valid);
  for (const bad of [
    null, undefined, 'nope', {},
    { ...valid, url: '/wrong/path.html' },
    { ...valid, url: `/catalogue/${sha}.json` },
    { ...valid, sha256: 'not-hex' },
    { ...valid, sha256: 'a'.repeat(63) },
    { ...valid, bytes: 0 },
    { ...valid, bytes: -1 },
    { ...valid, bytes: 1.5 },
    { ...valid, bytes: '1234' },
    { url: `/catalogue/${'b'.repeat(64)}.html`, sha256: sha, bytes: 1234 },
  ]) {
    assert.throws(() => parseCatalogueFragmentPin(bad), TypeError, JSON.stringify(bad));
  }
});

test('parseCatalogueIndexPin accepts only a content-addressed JSON index', () => {
  assert.deepEqual(parseCatalogueIndexPin(validIndex), validIndex);
  for (const bad of [
    null, {}, { ...validIndex, url: `/catalogue/${sha}.html` }, { ...validIndex, bytes: 0 },
    { ...validIndex, sha256: 'nope' },
    { url: `/catalogue/${'b'.repeat(64)}.json`, sha256: sha, bytes: 5678 },
  ]) assert.throws(() => parseCatalogueIndexPin(bad), TypeError, JSON.stringify(bad));
});

test('readCatalogueFragmentPin reads a dataset host and never throws', () => {
  assert.deepEqual(readCatalogueFragmentPin({ dataset: { catalogueSrc: valid.url, catalogueSha256: sha, catalogueBytes: '1234' } }), valid);
  assert.equal(readCatalogueFragmentPin({ dataset: {} }), null);
  assert.equal(readCatalogueFragmentPin(null), null);
  assert.equal(readCatalogueFragmentPin(undefined), null);
  // Build-time placeholder tokens (never substituted) fail validation instead of silently loading.
  assert.equal(readCatalogueFragmentPin({ dataset: { catalogueSrc: '/catalogue/__CATALOGUE_FRAGMENT_SHA__.html',
    catalogueSha256: '__CATALOGUE_FRAGMENT_SHA__', catalogueBytes: '__CATALOGUE_FRAGMENT_BYTES__' } }), null);
});

test('readCatalogueIndexPin reads the runtime index pin and rejects build placeholders', () => {
  assert.deepEqual(readCatalogueIndexPin({ dataset: { catalogueIndexSrc: validIndex.url,
    catalogueIndexSha256: sha, catalogueIndexBytes: '5678' } }), validIndex);
  assert.equal(readCatalogueIndexPin({ dataset: {} }), null);
  assert.equal(readCatalogueIndexPin({ dataset: { catalogueIndexSrc: '/catalogue/__CATALOGUE_INDEX_SHA__.json',
    catalogueIndexSha256: '__CATALOGUE_INDEX_SHA__', catalogueIndexBytes: '__CATALOGUE_INDEX_BYTES__' } }), null);
});
