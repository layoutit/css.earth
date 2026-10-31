import {copyFile,mkdir,readFile,writeFile,rm,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {requireArray,requireRecord} from '@cssearth/core';
import {readCloudPoints,validatePreparedVolumeDatasets} from '@cssearth/objects';
import {inventoryPreparedAssets,readVolumeDatasetBank,writeVolumeDatasetBank,unpackPreparedBank} from '@cssearth/objects/node';
import {installPreparedBank} from './install-transaction.mts';
import {json} from './field/grid.mts';
const pilot=process.argv.includes('--pilot'),out=`.local/pleiades-dust/${pilot?'pilot':'bake'}`,id='milky-way-pleiades-dust';
const directory=resolve('src/objects',id),live=resolve(directory,'prepared'),stage=resolve(directory,'prepared-current-stage');
const record=await json(`${out}/record.json`),cloud=readCloudPoints(unpackPreparedBank(await readFile(`${out}/foreground-cloud.bin`)));
if(record.executionComplete!==true||record.pilot!==pilot||cloud.count!==record.count||cloud.occluder.length)throw Error('Completed fixed-image cloud required');
const part=await json(`${out}/wide-part.json`),old=await readVolumeDatasetBank(live),label='Pleiades dust model';
const description='Infrared-constrained foreground dust lit by cluster stars, with faint Galactic cirrus. Cloud depth is inferred.';
if(old.datasets.length!==1||old.defaultDataset!=='smooth-dust')throw Error('Exactly one current dust dataset required');
const bank=validatePreparedVolumeDatasets({...old,datasets:old.datasets.map(dataset=>({...dataset,label,title:label,description,volume:{...dataset.volume,resources:requireArray(part.resources),stacks:dataset.volume.stacks.map(stack=>({...stack,leaves:stack.axis==='z'?requireArray(part.quads):[]})),provenance:{generator:'packages/bake/authoring/m45/dust/install.mts'},approximation:{method:'Fixed foreground cloud elements and fixed Galactic cirrus panorama; depth and Earth-reference illumination are modeled'}}}))});
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
for(const file of ['foreground-cloud.bin','foreground-cloud-atlas.webp','point-transmission.bin'])await copyFile(resolve(out,file),resolve(stage,file));
await copyFile(resolve(live,'stars.bin'),resolve(stage,'stars.bin'));
for(const resource of bank.datasets[0]!.volume.resources){await mkdir(resolve(stage,resource.path,'..'),{recursive:true});await copyFile(resolve(out,resource.path),resolve(stage,resource.path));}
await writeVolumeDatasetBank(stage,bank);
const presentation=await json(resolve(live,'presentation.json'));if(requireArray(presentation.controls).length!==1)throw Error('Exactly one presentation control required');presentation.controls=requireArray(presentation.controls).map(value=>({...requireRecord(value),label,title:label,summary:description,description,thumbnailUrl:`/scenes/${id}/dust-preview.png`,texture:{url:`/scenes/${id}/dust-preview.png`,width:256,height:256}}));
await writeFile(resolve(stage,'presentation.json'),JSON.stringify(presentation,null,2)+'\n');
if(pilot){const destination=resolve('.local/pleiades-dust/install-pilot');await rm(destination,{recursive:true,force:true});await rename(stage,destination);}else{
 const object=await json(resolve(directory,'object.json'));const properties=requireRecord(object.properties);properties.preparation={source:'source/model.json'};properties.overlays={'smooth-dust':['foreground-cloud']};
 const records=resolve('.local/pleiades-dust/install-records');await mkdir(records,{recursive:true});
 await writeFile(resolve(records,'object.json'),JSON.stringify(object,null,2)+'\n');await copyFile(resolve(directory,'inventory.json'),resolve(records,'inventory.json'));
 await inventoryPreparedAssets({objectId:id,objectDirectory:records,preparedRoot:stage,filenames:['datasets.json','presentation.json','stars.bin','smooth-dust/volume.json','point-transmission.bin','foreground-cloud.bin','foreground-cloud-atlas.webp',...bank.datasets[0]!.volume.resources.map(r=>r.path)]});
 await installPreparedBank({live,stage,backup:resolve('.local/pleiades-dust/prepared-before-install'),object:resolve(directory,'object.json'),inventory:resolve(directory,'inventory.json'),stagedObject:resolve(records,'object.json'),stagedInventory:resolve(records,'inventory.json')});
}
console.log('PLEIADES_DUST_INSTALLED',JSON.stringify({pilot,count:cloud.count,faces:bank.datasets[0]!.volume.resources.length}));
