/** Application preparation entrypoint. Scientific regeneration remains an explicit research command. */
import { readdir, access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareNebulaObject } from './objects.ts';
import { prepareCompactDensityObject } from './density-object.ts';
import { inventoryPreparedAssets } from '../../../src/platform/runtime-asset-closure.mts';
import { applicationDeliveryKind } from './delivery-identity.ts';
const args = process.argv.slice(2);
if (args.some(arg=>arg !== '--if-missing' && arg !== '--allow-missing' && !/^--object=[a-z][a-z0-9-]*$/.test(arg)) || args.filter(arg=>arg.startsWith('--object=')).length > 1)
  throw new TypeError('Usage: tools/nebula/prepare.mts [--if-missing] [--allow-missing] [--object=<id>]. Research: node --experimental-strip-types labs/nebula/run.mts bake-nebula --research.');
const selected = args.find(arg=>arg.startsWith('--object='))?.slice(9);
// Deploy builds only: a package missing from R2 (setup:assets/setup:prepared skipped a 404) reports unavailable
// instead of triggering a from-scratch bake here, which needs a source acquisition service this build never runs.
const allowMissing = args.includes('--allow-missing') || process.env.CSSEARTH_ALLOW_MISSING_ASSETS === '1';
const root = process.cwd(), objects = resolve(root,'src/objects'), results = [];
async function exists(path: string) {
  try { await access(path); return true; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
for (const entry of (await readdir(objects,{withFileTypes:true})).filter(entry=>entry.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
  if (selected && entry.name !== selected) continue;
  const directory = resolve(objects,entry.name);
  const compactPath = resolve(directory,'source/compact-delivery.json'), deliveryPath = resolve(directory,'source/delivery.json');
  let result;
  if (await exists(compactPath)) {
    applicationDeliveryKind('compact-delivery.json',JSON.parse((await readFile(compactPath)).toString()));
    result = await prepareCompactDensityObject(root,directory,args.includes('--if-missing'),allowMissing);
  } else if (await exists(deliveryPath)) {
    const kind = applicationDeliveryKind('delivery.json',JSON.parse((await readFile(deliveryPath)).toString()));
    if (kind !== 'nebula') continue;
    result = await prepareNebulaObject(root,directory,args.includes('--if-missing'),undefined,allowMissing);
  } else continue;
  results.push(result);
  // An unavailable object's `prepared/` output is incomplete by definition: no manifest to write, and the
  // shared context-availability check (astro.config.mts) is what reports it, not this inventory.
  if (result.status === 'unavailable') continue;
  // Its whole `prepared/` bake (this loop's only output) is the R2
  // inventory — a full nested closure, no exclusions needed since `object.json` and the `.prepared-<pid>`
  // staging directory both live outside `prepared/`.
  await inventoryPreparedAssets({ objectId: entry.name, objectDirectory: directory });
}
if (selected && !results.length) throw new TypeError(`No nebula delivery is registered for ${selected}.`);
console.log(`NEBULA_OBJECTS_COMPLETE ${JSON.stringify(results)}`);
