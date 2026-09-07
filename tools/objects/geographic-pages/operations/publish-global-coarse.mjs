import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { publishPreparedCityAssets } from './r2-publish.mjs';
import { verifyPublishedAssets } from '../../../../tools/runtime-asset-publication.mjs';

import {commandContext} from './context.mjs';
const context=commandContext();
assert.ok(context.args[0], 'Usage: node publish-global-coarse.mjs <prepared-release-directory> [--dry-run|--verify-only] [--concurrency=1..8]');
const concurrency = Number(context.args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] ?? 2);
const directory = resolve(context.args[0]), bytes = await readFile(resolve(directory, 'manifest.json'));
const release = JSON.parse(bytes);
assert.equal(release.schema, 'cssearth-global-coarse-release@1'); assert.equal(release.complete, true);
const source = await context.readSource('city/manifest.json');
const cors = await context.readSource('city/r2-cors.json');
assert.equal(source.delivery.keyPrefix,context.assetPath.slice(1,-1),'Object delivery prefix differs');
const result = await publishPreparedCityAssets({ source: { ...source, dataset: release.dataset }, cors,
  assetUrls: release.assets.map(asset => asset.url), staging: resolve(directory, 'assets'), root: context.projectRoot,
  dryRun: context.args.includes('--dry-run'), verifyOnly: context.args.includes('--verify-only'), concurrency });
assert.equal(result.objects, release.files); assert.equal(result.bytes, release.imageBytes + release.indexBytes);
const report = { ...result, releaseVersion: release.version, manifestSha256: createHash('sha256').update(bytes).digest('hex') };
if (result.mode !== 'dry-run') {
  // Reuse the dataset publisher's bounded streaming verification. A delivery
  // receipt binds the actual public bytes, including any previously uploaded files.
  const verified = await verifyPublishedAssets(release.assets, { concurrency });
  assert.equal(verified.length, release.files);
  report.verifiedObjects = verified.length;
  report.verification = 'full-sha256';
  await writeFile(resolve(directory, 'publication.json'), JSON.stringify(report) + '\n');
}
console.log(JSON.stringify(report));
