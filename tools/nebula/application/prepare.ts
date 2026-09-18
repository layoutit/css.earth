/** Application preparation entrypoint. Scientific regeneration remains an explicit research command. */
import { readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareNebulaObject } from './objects.ts';
import { prepareCompactDensityObject } from './density-object.ts';
import { preparePreparedAssetManifest } from '../../../src/platform/runtime-asset-closure.mts';
const args = process.argv.slice(2);
if (args.some(arg=>arg !== '--if-missing' && !/^--object=[a-z][a-z0-9-]*$/.test(arg)) || args.filter(arg=>arg.startsWith('--object=')).length > 1)
  throw new TypeError('Usage: tools/nebula/prepare.mts [--if-missing] [--object=<id>]. Research: pnpm lab:nebula:bake --research.');
const selected = args.find(arg=>arg.startsWith('--object='))?.slice(9);
const root = process.cwd(), objects = resolve(root,'src/objects'), results = [];
async function exists(path: string) {
  try { await access(path); return true; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
for (const entry of (await readdir(objects,{withFileTypes:true})).filter(entry=>entry.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
  if (selected && entry.name !== selected) continue;
  const directory = resolve(objects,entry.name);
  let result;
  if (await exists(resolve(directory,'source/compact-delivery.json'))) result = await prepareCompactDensityObject(root,directory,args.includes('--if-missing'));
  else if (await exists(resolve(directory,'source/delivery.json'))) result = await prepareNebulaObject(root,directory,args.includes('--if-missing'));
  else continue;
  results.push(result);
  // This object has no runtime-assets.json, so its whole `prepared/` bake (this loop's only output) is the R2
  // inventory — a full nested closure, no exclusions needed since `object.json` and the `.prepared-<pid>`
  // staging directory both live outside `prepared/`.
  await preparePreparedAssetManifest({ planetId: entry.name, preparedRoot: resolve(directory,'prepared'),
    manifestPath: resolve(directory,'prepared-assets.json') });
}
if (selected && !results.length) throw new TypeError(`No nebula delivery is registered for ${selected}.`);
console.log(`NEBULA_OBJECTS_COMPLETE ${JSON.stringify(results)}`);
