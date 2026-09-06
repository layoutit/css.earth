import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function attachCoarseBacking(fine, release) {
  assert.equal(release.schema, 'cssearth-global-coarse-release@1');
  assert.equal(release.complete, true, 'Incomplete coarse preparation');
  assert.equal(release.dataset, fine.dataset);
  assert.equal(release.fineGeometryVersion, fine.geometryVersion, 'Coarse backing belongs to another fine release');
  assert.equal(release.fineRootsSha256, createHash('sha256').update(JSON.stringify(fine.roots)).digest('hex'), 'Fine root closure changed');
  const { backing } = release;
  assert.ok(backing.roots.length > 0 && backing.roots.length <= fine.poolSize);
  assert.equal(backing.rootDecodedBytes, Buffer.byteLength(JSON.stringify(backing.roots)));
  assert.ok(backing.rootDecodedBytes < fine.index.maximumBytes);
  assert.ok(Number.isFinite(backing.minimumZoom) && backing.minimumZoom >= 0 && backing.minimumZoom <= fine.minimumZoom);
  assert.equal(new Set([...fine.roots, ...backing.roots].map(node => node.key)).size, fine.roots.length + backing.roots.length);
  assert.ok(Number.isSafeInteger(release.decodedPageBytes) && release.decodedPageBytes >= fine.decodedPageBytes && release.decodedPageBytes <= fine.maximumDecodedBytes);
  return { ...fine, decodedPageBytes: release.decodedPageBytes, backing };
}

// Regenerating the unchanged fine delivery plan must not silently remove its
// prepared backing. A different fine geometry release needs new certificates.
export function preserveCoarseBacking(existing, next) {
  if (!existing.backing) return next;
  assert.equal(next.dataset, existing.dataset, 'Reprepare coarse backing for the new dataset');
  assert.equal(next.geometryVersion, existing.geometryVersion, 'Reprepare coarse backing for the new fine release');
  assert.deepEqual(next.roots, existing.roots, 'Reprepare coarse backing for changed fine roots');
  return { ...next, decodedPageBytes: Math.max(next.decodedPageBytes, existing.decodedPageBytes), backing: existing.backing };
}
