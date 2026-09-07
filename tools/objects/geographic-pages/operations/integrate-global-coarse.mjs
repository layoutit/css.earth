import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { commandContext } from './context.mjs';
import { prepareCoarseReleasePin } from './coarse-integration.mjs';
import { verifySourceManifest } from '../../../../src/platform/source-manifest.mjs';

const context = commandContext();
assert.equal(context.args.length, 1, 'Usage: integrate-global-coarse.mjs --object=<id> <prepared-release-directory>');
const directory = resolve(context.args[0]);
const manifest = await context.readSource('manifest.json');
await verifySourceManifest({ sourceRoot: context.sourceRoot, manifest, planetName: context.objectId });
const fine = await context.readPrepared('pages');
const bytes = await readFile(resolve(directory, 'manifest.json'));
const publication = JSON.parse(await readFile(resolve(directory, 'publication.json')));
const pin = prepareCoarseReleasePin(fine, bytes, publication);
const recipePath = 'preparation/paged-ellipsoid.json', pinPath = 'city/coarse-release.json';
const config = await context.readSource(recipePath);
config.geographic.pages.coarseReleasePath = pinPath;
const descriptorPath = resolve(context.objectRoot, 'object.json');
const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
const reference = descriptor.properties.recipe.sources.find(entry => entry.path === `source/${recipePath}`);
assert.ok(reference, 'Paged recipe source is not declared.');
const updates = new Map([
  [pinPath, { bytes: JSON.stringify(pin) + '\n', purpose: 'Verified global coarse imagery binding, source release identity and exact fine geometry compatibility.' }],
  [recipePath, { bytes: JSON.stringify(config, null, 2) + '\n' }],
]);
for (const [path, update] of updates) {
  const sha256 = createHash('sha256').update(update.bytes).digest('hex');
  const existing = manifest.documents.find(entry => entry.path === path);
  if (existing) Object.assign(existing, { expectedBytes: Buffer.byteLength(update.bytes), expectedSha256: sha256 });
  else {
    assert.ok(update.purpose, 'New source documents need a provenance purpose.');
    manifest.documents.push({ path, expectedBytes: Buffer.byteLength(update.bytes), expectedSha256: sha256, purpose: update.purpose });
  }
  if (path === recipePath) reference.sha256 = sha256;
}
// Integration authors source pins. The normal object preparer owns all derived
// JSON and publication; no runtime module or alternate scene owner is emitted.
for (const [path, update] of updates) await writeFile(context.sourcePath(path), update.bytes);
await writeFile(context.sourcePath('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(descriptorPath, JSON.stringify(descriptor, null, 2) + '\n');
console.log(JSON.stringify({ version: pin.version, fineGeometryVersion: fine.geometryVersion,
  roots: pin.backing.roots.length, pages: pin.pages, bytes: pin.imageBytes + pin.indexBytes, status: 'source-pinned; prepare object to publish runtime' }));
