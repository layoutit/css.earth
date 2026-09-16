import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDetectionRequest, readDetectionResult } from './jobs-model.ts';

test('detector requests and proposal receipts require bounded settings and exact source pins', () => {
  const request = { action: 'apply', cataloguePath: '.local/nebula-lab/source/catalogue.json', imageId: 'test', sourceSha256: 'a'.repeat(64), mapSha256: 'b'.repeat(64), settings: {} };
  const parsed = readDetectionRequest(request);
  assert.equal(parsed.settings.sensitivity, 1);
  assert.equal(parsed.quality, 'detailed');
  assert.equal(readDetectionRequest({ ...request, quality: 'draft' }).quality, 'draft');
  for (const changed of [{ quality: 'fast' }, { action: 'detect' }, { cataloguePath: '../other.json' }, { sourceSha256: 'changed' }, { settings: { sensitivity: Infinity } }, { mystery: 1 }])
    assert.throws(() => readDetectionRequest({ ...request, ...changed }));
  const result = { ...parsed, schema: 'cssearth-geometry-detection-result@1', id: 'c'.repeat(64), width: 768, height: 534,
    geometry: { file: `geometry-${'c'.repeat(64)}.json`, sha256: 'd'.repeat(64) } };
  assert.equal(readDetectionResult(result).geometry.sha256, result.geometry.sha256);
  for (const changed of [{ quality: 'fast' }, { width: 10000 }, { mapSha256: 'changed' }, { geometry: { ...result.geometry, file: '../geometry.json' } },
    { geometry: { ...result.geometry, sha256: 'changed' } }, { id: 'e'.repeat(64) }]) assert.throws(() => readDetectionResult({ ...result, ...changed }));
});
