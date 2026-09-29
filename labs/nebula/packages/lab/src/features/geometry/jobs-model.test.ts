import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDetectionRequest, readDetectionResult } from './jobs-model.ts';

test('detector requests and proposal receipts require bounded settings and a named structure run', () => {
  const request = { action: 'apply', cataloguePath: '.local/nebula-lab/source/catalogue.json', imageId: 'test', settings: {} };
  const parsed = readDetectionRequest(request);
  assert.equal(parsed.settings.sensitivity, 1);
  assert.equal(parsed.quality, 'detailed');
  assert.equal(readDetectionRequest({ ...request, quality: 'draft' }).quality, 'draft');
  for (const changed of [{ quality: 'fast' }, { action: 'detect' }, { cataloguePath: '../other.json' }, { mapDirectory: 'x' }, { settings: { sensitivity: Infinity } }, { mystery: 1 }])
    assert.throws(() => readDetectionRequest({ ...request, ...changed }));
  const id = '01234567-89ab-4cde-8f01-23456789abcd';
  const result = { ...parsed, schema: 'cssearth-geometry-detection-result@1', id, width: 768, height: 534,
    mapDirectory: '.local/nebula-lab/source/test/analysis-20260929T000000Z', geometry: { file: `geometry-${id}.json` } };
  assert.equal(readDetectionResult(result).geometry.file, result.geometry.file);
  for (const changed of [{ quality: 'fast' }, { width: 10000 }, { mapDirectory: '../changed' }, { geometry: { ...result.geometry, file: '../geometry.json' } },
    { geometry: { ...result.geometry, bytes: 1 } }, { id: 'e'.repeat(12) }]) assert.throws(() => readDetectionResult({ ...result, ...changed }));
});
