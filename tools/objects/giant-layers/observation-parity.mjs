import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareObservedSurfaces } from './observations.mjs';
const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));
export async function assertObservationPreparationParity(id) {
  if(!/^[a-z][a-z0-9-]*$/u.test(id))throw new TypeError('Unsafe object identity.');
  const directory=resolve(projectRoot,'src/planets',id);
  const config=JSON.parse(await readFile(resolve(directory,'source/preparation/observations.json'),'utf8'));
  const manifest=JSON.parse(await readFile(resolve(directory,'runtime-assets.json'),'utf8'));
  const result=await prepareObservedSurfaces({sourceDirectory:resolve(directory,'source'),config,write:false});
  for(const {filename,bytes,sha256,data} of result.assets){
    const expected=manifest.assets.find(asset=>asset.filename===filename);assert.ok(expected,`Unaccepted observation asset ${filename}`);
    assert.deepEqual({filename,bytes,sha256},expected,`${filename}: exact prepared identity`);
    assert.ok(data.equals(await readFile(resolve(projectRoot,'public/scenes',id,filename))),`${filename}: complete accepted encoded payload`);
  }
  return result;
}
