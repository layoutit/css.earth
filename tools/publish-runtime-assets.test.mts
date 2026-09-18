import assert from 'node:assert/strict';
import test from 'node:test';
import { contentType } from './publish-runtime-assets.mts';

test('JSON keys publish as application/json; every other key stays application/octet-stream', () => {
  assert.equal(contentType('runtime-assets/abc123/scene.json'), 'application/json');
  assert.equal(contentType('runtime-assets/abc123/prepared-assets.json'), 'application/json');
  assert.equal(contentType('runtime-assets/abc123/atlas.webp'), 'application/octet-stream');
  assert.equal(contentType('runtime-assets/abc123/model.jsonl'), 'application/octet-stream');
});
