import {parse} from '../material-composition/data-schema.mts';
import {runtimeAssetManifest} from './radial-contract.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareGiantLayers } from './index.mts';
const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));

/** Asset manifest identities predate the generic operators and remain unchanged. */
export async function assertRadialPreparationParity(id: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Unsafe object identity.');
  const objectDirectory=resolve(projectRoot,'src/objects',id);
  const config: unknown=JSON.parse(await readFile(resolve(objectDirectory,'source/preparation/rings.json'),'utf8'));
  const manifest=parse({assets:(JSON.parse(await readFile(resolve(objectDirectory,'inventory.json'),'utf8')) as {assets:{location:string}[]}).assets.filter(asset=>asset.location==='public')}, runtimeAssetManifest, 'runtime asset manifest');
  const result=await prepareGiantLayers({sourceDirectory:resolve(objectDirectory,'source'),config,write:false});
  const acceptedNames=new Set(manifest.assets.map(asset=>asset.filename));
  let verified=0;
  for (const {filename,bytes,sha256,data} of result.assets) {
    // Preparation also emits lower-density intermediates. Only declared public
    // consumers belong to the deployed closure; Saturn mounts its 2x bank only.
    if(!acceptedNames.has(filename))continue;
    const expected=manifest.assets.find(asset=>asset.filename===filename);
    assert.deepEqual({filename,bytes,sha256},expected,`${filename}: exact prepared bytes`);
    const accepted=await readFile(resolve(projectRoot,'public/scenes',id,filename));
    assert.ok(accepted.equals(data),`${filename}: accepted encoded payload`);
    verified++;
  }
  assert.ok(verified>0,'The radial recipe must reproduce active runtime assets');
  return verified;
}
