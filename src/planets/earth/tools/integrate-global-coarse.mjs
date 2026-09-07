import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PREPARED_EARTH_CITY_PAGES as fine } from '../runtime/preparedCityPages.mjs';
import { attachCoarseBacking } from './city/coarse-integration.mjs';

assert.ok(process.argv[2], 'Usage: node integrate-global-coarse.mjs <prepared-release-directory>');
const directory = resolve(process.argv[2]), bytes = await readFile(resolve(directory, 'manifest.json'));
const release = JSON.parse(bytes), publication = JSON.parse(await readFile(resolve(directory, 'publication.json')));
assert.equal(publication.releaseVersion, release.version);
assert.equal(publication.manifestSha256, createHash('sha256').update(bytes).digest('hex'));
assert.ok(['publish-and-verify', 'verify-only'].includes(publication.mode), 'Verify public asset delivery before integrating the release');
assert.equal(publication.objects, release.files);
assert.equal(publication.bytes, release.imageBytes + release.indexBytes);
assert.equal(publication.verification, 'full-sha256', 'Verify complete public file hashes before integration');
assert.equal(publication.verifiedObjects, release.files);
const plan = attachCoarseBacking(fine, release);
const pin = { schema: 'cssearth-global-coarse-pin@1', version: release.version, planVersion: release.planVersion,
  manifestSha256: publication.manifestSha256, inputManifestSha256: release.identity.inputsSha256,
  fineGeometryVersion: release.fineGeometryVersion, fineRootsSha256: release.fineRootsSha256,
  sourcePage: fine.sourcePage, credit: fine.credit, license: 'CC-BY-4.0',
  pages: release.pages, files: release.files, imageBytes: release.imageBytes, indexBytes: release.indexBytes,
  sourceImages: release.sourceImages, sourceBytes: release.sourceBytes, rootDecodedBytes: release.backing.rootDecodedBytes,
  qualification: 'Complete prepared global coarse pyramid with verified public delivery. Full built-app journey qualification is recorded separately.' };
await writeFile(new URL('../runtime/preparedCityPages.mjs', import.meta.url), `// Generated from pinned fine geometry and prepared coarse imagery releases.\nexport const PREPARED_EARTH_CITY_PAGES=Object.freeze(${JSON.stringify(plan)});\n`);
await writeFile(new URL('../source/city/coarse-release.json', import.meta.url), JSON.stringify(pin) + '\n');
// A fresh process imports the newly written fine/backing plan. Building the
// application then uses this presentation without another manual prepare step.
const prepared = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-presentation.mjs', import.meta.url))], { stdio: 'inherit' });
if (prepared.error) throw prepared.error;
assert.equal(prepared.status, 0, 'Refresh the Earth presentation after coarse integration');
console.log(JSON.stringify({ version: release.version, fineGeometryVersion: fine.geometryVersion,
  roots: release.backing.roots.length, pages: release.pages, bytes: release.imageBytes + release.indexBytes }));
