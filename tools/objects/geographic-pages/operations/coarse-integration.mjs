import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Pin the runtime binding only after the exact release has a complete delivery receipt. */
export function prepareCoarseReleasePin(fine, manifestBytes, publication) {
  const release = JSON.parse(manifestBytes);
  assert.equal(publication.releaseVersion, release.version);
  assert.equal(publication.manifestSha256, createHash('sha256').update(manifestBytes).digest('hex'));
  assert.ok(['publish-and-verify', 'verify-only'].includes(publication.mode), 'Verify public delivery before integration');
  assert.equal(publication.objects, release.files);
  assert.equal(publication.bytes, release.imageBytes + release.indexBytes);
  assert.equal(publication.verification, 'full-sha256', 'Verify all public file hashes before integration');
  assert.equal(publication.verifiedObjects, release.files);
  attachCoarseBacking(fine, release);
  return {
    schema: 'cssearth-global-coarse-pin@1', version: release.version, planVersion: release.planVersion,
    dataset: release.dataset, manifestSha256: publication.manifestSha256,
    inputManifestSha256: release.identity.inputsSha256, fineGeometryVersion: release.fineGeometryVersion,
    fineRootsSha256: release.fineRootsSha256, sourcePage: fine.sourcePage, credit: fine.credit,
    license: 'CC-BY-4.0', pages: release.pages, files: release.files,
    imageBytes: release.imageBytes, indexBytes: release.indexBytes,
    sourceImages: release.sourceImages, sourceBytes: release.sourceBytes,
    decodedPageBytes: release.decodedPageBytes, rootDecodedBytes: release.backing.rootDecodedBytes,
    backing: release.backing,
    qualification: 'Prepared global coarse pyramid with complete hash-verified public delivery. Browser journey qualification is recorded separately.',
  };
}

/** Source-manifest verification owns the pin bytes; the fine closure owns compatibility. */
export function bindPinnedCoarseBacking(fine, pin) {
  assert.equal(pin.schema, 'cssearth-global-coarse-pin@1');
  return attachCoarseBacking(fine, { ...pin, schema: 'cssearth-global-coarse-release@1', complete: true });
}

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
