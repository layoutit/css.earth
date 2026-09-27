// Entry script: node packages/bake/cli/prune-runtime-assets.mts --dry-run. Report only; there is no delete path. How to give it a
// read-only R2 listing token is described in @cssearth/bake/asset-publication (`prune-runtime-assets.ts`).
import { resolve } from 'node:path';
import { computePruneCandidates, credentialsFromEnv, currentlyInventoriedKeys, listRuntimeAssetKeys } from '@cssearth/bake/asset-publication';

if (!process.argv.includes('--dry-run')) throw new Error('Usage: prune-runtime-assets.mts --dry-run (there is no delete path).');
const root = resolve(import.meta.dirname, '../../..');
const inventoried = await currentlyInventoriedKeys(root);
const credentials = credentialsFromEnv(process.env);
if (!credentials) {
  console.error('Cannot list R2 objects: wrangler has no read-only list command, and R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/' +
    'R2_SECRET_ACCESS_KEY are not set. See the comment at the top of this file for how to create a read-only R2 API ' +
    `token. (${inventoried.size} key(s) are currently inventoried locally, for reference.)`);
  process.exitCode = 1;
} else {
  const live = await listRuntimeAssetKeys(credentials);
  const { candidates, bytes } = computePruneCandidates(live, inventoried);
  console.log(`${live.length} live runtime-assets/ key(s); ${inventoried.size} currently inventoried.`);
  console.log(`Would prune ${candidates.length} key(s), ${(bytes / 1e6).toFixed(1)} MB — dry run only, nothing deleted.`);
  for (const { key, bytes: size } of candidates) console.log(`  ${key} (${size} bytes)`);
}
