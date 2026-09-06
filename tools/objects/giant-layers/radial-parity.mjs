import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareGiantLayers } from './index.mjs';
const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));

/** Asset manifest identities predate the generic operators and remain unchanged. */
export async function assertRadialPreparationParity(id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Unsafe object identity.');
  const objectDirectory=resolve(projectRoot,'src/planets',id);
  const config=JSON.parse(await readFile(resolve(objectDirectory,'source/preparation/rings.json'),'utf8'));
  const manifest=JSON.parse(await readFile(resolve(objectDirectory,'runtime-assets.json'),'utf8'));
  const result=await prepareGiantLayers({sourceDirectory:resolve(objectDirectory,'source'),config,write:false});
  for (const {filename,bytes,sha256,data} of result.assets) {
    const expected=manifest.assets.find(asset=>asset.filename===filename);
    assert.ok(expected,`Unaccepted ring asset ${filename}`);
    assert.deepEqual({filename,bytes,sha256},expected,`${filename}: exact prepared bytes`);
    const accepted=await readFile(resolve(projectRoot,'public/scenes',id,filename));
    assert.ok(accepted.equals(data),`${filename}: accepted encoded payload`);
  }
  return result.assets.length;
}
