// Reuse the existing solid-scene owner for camera-only changes. No raster bake.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {refreshSolidSceneEpoch} from '../../tools/objects/terrestrial-layers/solid-scene.mjs';
import {prepareObjectJson} from '../../tools/prepare-object-json.mjs';
const ids=['ivar','cerberus'];
const json=async path=>JSON.parse(await readFile(path));
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const results=[];
for(const id of ids){
 const root=`src/planets/${id}`,out=`${root}/prepared`;
 const before={terrain:await hash(`${out}/terrain.json`),assets:await hash(`${out}/runtime-assets.json`)};
 const config=await json(`${root}/source/preparation/terrestrial.json`);
 const scene=await json(`${out}/scene.json`),definition=await json(`${out}/runtime.json`);
 const next=await refreshSolidSceneEpoch({config,scene,definition});
 assert.deepEqual(next.scene.bodyLeaves,scene.bodyLeaves);
 for(const [name,value] of Object.entries({scene:next.scene,runtime:next.definition,sky:next.scene.sky,sun:next.scene.sun}))
  await writeFile(`${out}/${name}.json`,JSON.stringify(value)+'\n');
 const after={terrain:await hash(`${out}/terrain.json`),assets:await hash(`${out}/runtime-assets.json`)};
 assert.deepEqual(after,before);
 results.push({id,framingScale:config.geometry.camera.framingScale,unchanged:after});
}
await prepareObjectJson(ids);
await writeFile('docs/near-earth-population/framing-refresh.json',JSON.stringify(results,null,2)+'\n');
console.log('Camera framing refreshed; source geometry and asset inventories unchanged.');
