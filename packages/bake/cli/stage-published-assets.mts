// Entry script: node packages/bake/cli/stage-published-assets.mts <artifact-root> <PR-checkout> <object-id>, run by publish-assets.yml
// from the trusted checkout. The validation is in @cssearth/bake/asset-publication.
import { resolve } from 'node:path';
import { stagePublishedAssets } from '@cssearth/bake/asset-publication';

const [artifactRoot, sourceRoot, objectId, ...extra] = process.argv.slice(2);
if (!artifactRoot || !sourceRoot || !objectId || extra.length) throw new Error('Usage: stage-published-assets.mts <artifact-root> <PR-checkout> <object-id>');
const count = await stagePublishedAssets({ artifactRoot, sourceRoot, objectId, root: resolve(import.meta.dirname, '../../..') });
console.log(`Verified and staged ${count} committed asset(s) for ${objectId}.`);
