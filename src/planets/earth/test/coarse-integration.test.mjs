import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { attachCoarseBacking, preserveCoarseBacking } from '../tools/city/coarse-integration.mjs';

function fixture() {
  const fine = { dataset: 'fixture', geometryVersion: 'fine-v1', roots: [{ key: 'wmts-tile-5-10-12' }], poolSize: 512,
    minimumZoom: 8, decodedPageBytes: 262144, maximumDecodedBytes: 128 * 1024 * 1024, index: { maximumBytes: 12 * 1024 * 1024 } };
  const roots = [{ key: '0-9-10' }];
  const release = { schema: 'cssearth-global-coarse-release@1', complete: true, dataset: fine.dataset, fineGeometryVersion: fine.geometryVersion,
    fineRootsSha256: createHash('sha256').update(JSON.stringify(fine.roots)).digest('hex'), decodedPageBytes: 270400,
    backing: { roots, minimumZoom: 4, rootDecodedBytes: Buffer.byteLength(JSON.stringify(roots)) } };
  return { fine, release };
}

test('coarse integration retains the fine closure and existing resource limits', () => {
  const { fine, release } = fixture(), result = attachCoarseBacking(fine, release);
  assert.equal(result.roots, fine.roots); assert.equal(result.index, fine.index);
  assert.equal(result.maximumDecodedBytes, fine.maximumDecodedBytes); assert.equal(result.poolSize, fine.poolSize);
  assert.equal(result.backing, release.backing);
  assert.deepEqual(preserveCoarseBacking(result, fine), result);
});

test('incomplete, stale and falsely accounted backing cannot be integrated or silently carried forward', () => {
  const { fine, release } = fixture();
  assert.throws(() => attachCoarseBacking(fine, { ...release, complete: false }), /Incomplete/);
  assert.throws(() => attachCoarseBacking(fine, { ...release, fineGeometryVersion: 'fine-v2' }), /another fine release/);
  assert.throws(() => attachCoarseBacking({ ...fine, roots: [{ key: 'different' }] }, release), /root closure changed/);
  assert.throws(() => attachCoarseBacking(fine, { ...release, backing: { ...release.backing, rootDecodedBytes: 1 } }));
  const attached = attachCoarseBacking(fine, release);
  assert.throws(() => preserveCoarseBacking(attached, { ...fine, geometryVersion: 'fine-v2' }), /Reprepare/);
  assert.throws(() => preserveCoarseBacking(attached, { ...fine, roots: [{ key: 'different' }] }), /changed fine roots/);
});
