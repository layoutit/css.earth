/** Replay the accepted compact pre-slice fields, skies and measured catalogue rows. */
import {createReadStream,createWriteStream,existsSync,mkdirSync,readFileSync,writeFileSync,statSync,copyFileSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
import {sourceCacheUrl,fetchWithRetry,RUNTIME_ASSET_ORIGIN} from '@cssearth/bake/objects/sources';
import {publishSourceBytes} from '@cssearth/bake/delivery';
import {parseDensityVolumeFrame,parsePreparedGalaxyStations,parseGalaxyStationSky,parseCatalogueProximity,parseDensityVolumeObjectDescriptor,parsePreparedDensityVolumeText} from '@cssearth/objects';
import {inventoryPreparedAssets} from '@cssearth/objects/node';
import {preparePathSkies} from './path-skies.mts';
import {main as installSlices,parseGalaxySliceControls} from './slice-galaxy.mts';
import {record} from './galaxy-slices.mts';
import {GALAXY_SLICES} from './galaxy-slice-source.mts';
import {runGalaxyPython} from './galaxy-python.mts';

const objectId='milky-way-volume';
function child(script:string,args:string[]) {
 const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit'});
 if(result.status!==0)throw new Error(`${script} failed: ${result.error?.message??result.status}`);
}
function relative(value:unknown):string {
 if(typeof value!=='string'||!value||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'))throw new TypeError('Invalid source path');return value;
}
export async function prepareGalaxyLayers(args:readonly string[]=[]) {
 for(const arg of args)if(!['--pilot','--skies-only','--slabs-only','--restore-only'].includes(arg))throw new TypeError('Unknown galaxy preparation argument: '+arg);
 const objectDirectory=resolve('src/objects/'+objectId),recipeDirectory=resolve(objectDirectory,'source/preparation/b30');
 const recipe=record(JSON.parse(readFileSync(recipeDirectory+'/recipe.json','utf8')));
 if(recipe.schema!=='cssearth-milky-way-layers@1'||!Array.isArray(recipe.inputs))throw new TypeError('Invalid accepted galaxy recipe');
 const decoded=resolve(objectDirectory,'.local/b30-inputs');mkdirSync(decoded,{recursive:true});
 for(const value of recipe.inputs) {
  const input=record(value),destination=resolve(decoded,relative(input.destination));
  if(!Array.isArray(input.files)||!input.files.length)throw new TypeError('Missing compressed input chunks');
  for(const value of input.files) {
   const file=relative(value);
   if(!file.startsWith('src/objects/'+objectId+'/source/b30-inputs/'))throw new TypeError('Input escaped the galaxy source package');
   if(!existsSync(file))await publishSourceBytes({destination:resolve(file),bytes:await fetchWithRetry(fetch,sourceCacheUrl(RUNTIME_ASSET_ORIGIN,objectId,file))});
  }
  if(!existsSync(destination)) {
   mkdirSync(dirname(destination),{recursive:true});const staging=destination+'.tmp';writeFileSync(staging,'');
   try{for(const file of input.files)await pipeline(createReadStream(relative(file)),createGunzip(),createWriteStream(staging,{flags:'a'}));renameSync(staging,destination);}
   catch(error){unlinkSync(staging);throw error;}
   console.log('RESTORED GALAXY INPUT',input.destination,statSync(destination).size);
  }
 }
 for(const [name,metaName]of [['field','field.json'],['extension','extension.json']]) {
  const meta=record(JSON.parse(readFileSync(resolve(recipeDirectory,metaName!),'utf8')));
  if(!Array.isArray(meta.dims)||meta.dims.length!==3||!meta.dims.every(n=>Number.isSafeInteger(n)&&n>1))throw new TypeError('Invalid field dimensions');
  const nodes=meta.dims.reduce((a:number,b:number)=>a*b,1);
  for(const [file,channels]of [['emission',3],['dust',1],['scatter',3]] as const)if(statSync(resolve(decoded,name!,file+'.f32')).size!==nodes*channels*4)throw new TypeError('Incomplete field input: '+name+'/'+file);
  copyFileSync(resolve(recipeDirectory,metaName!),resolve(decoded,name!,'meta.json'));
 }
 if(args.includes('--restore-only')){console.log('GALAXY SOURCE RESTORE VERIFIED');return;}
 const pilot=args.includes('--pilot'),prepared=resolve(objectDirectory,'prepared');mkdirSync(prepared,{recursive:true});
 const frameInput=record(JSON.parse(readFileSync(resolve(recipeDirectory,'frame.json'),'utf8')));
 const frame=parseDensityVolumeFrame({...frameInput,metersPerUnit:Number(frameInput.metersPerUnit)*1000,boundsUnits:{min:[-7.723,-16,-3.2],max:[24.277,16,3.2]}});
 const tuner=parsePreparedGalaxyStations(recipe.tuner);
 if(!args.includes('--skies-only')) {
  // Twice the X/Y sheets of the step-19 bank: X/Y pitch 0.615 kpc against a measured light thickness of 1.33 kpc lets
  // a side stack carry views to 65 degrees from edge-on (was 50). The Z set and the recipe are unchanged.
  const counts='52,52,26',controls=parseGalaxySliceControls({counts,'in-plane-field':resolve(decoded,'extension')});
  const field=resolve(decoded,'field'),fit=resolve(recipeDirectory,'fit.json');
  if(pilot) {
   const out=resolve('output/milky-way-pr/pilot-bank');mkdirSync(out,{recursive:true});
   runGalaxyPython('slices.py',[field,out,fit,JSON.stringify({...controls,axes:[2]})],{}, {'slices.py':GALAXY_SLICES});
  } else {
   // Keep the independent NASA runtime binding while replacing the far bank.
   await installSlices([objectDirectory,'--field='+field,'--fit='+fit,'--frame='+resolve(recipeDirectory,'physical-frame.json'),'--counts='+counts,'--in-plane-field='+resolve(decoded,'extension')]);
  }
 }
 if(!args.includes('--slabs-only'))await preparePathSkies({objectDirectory,inputDirectory:decoded,plan:recipe.skies,tuner,frame,pilot});
 if(!pilot) {
  const descriptor=record(JSON.parse(readFileSync(resolve(objectDirectory,'object.json'),'utf8')));
  descriptor.properties={...record(descriptor.properties),galaxyStations:'galaxy-stations/tuner.json'};
  writeFileSync(resolve(objectDirectory,'object.json'),JSON.stringify(descriptor,null,2)+'\n');
  child('packages/bake/cli/stack-catalogue-points.mts',[objectDirectory,'dots','--split-proximity']);
  const volumeDescriptor=parseDensityVolumeObjectDescriptor(JSON.parse(readFileSync(resolve(objectDirectory,'object.json'),'utf8')));
  const volume=parsePreparedDensityVolumeText(readFileSync(resolve(prepared,'volume.json'),'utf8'),volumeDescriptor);
  const proximity=parseCatalogueProximity(JSON.parse(readFileSync(resolve(prepared,'catalogue-proximity.json'),'utf8')));
  const filenames=['volume.json','dots.bin','catalogue-proximity.json',...proximity.levels.map(v=>v.file),...volume.resources.map(v=>v.path),'galaxy-stations/tuner.json'];
  for(const station of tuner.stations) {
    const path='galaxy-stations/'+station.sky,sky=parseGalaxyStationSky(JSON.parse(readFileSync(resolve(prepared,path),'utf8')));
    filenames.push(path,'galaxy-stations/'+station.clouds,'galaxy-stations/'+station.id+'/empty.webp',...sky.resources.map(r=>'galaxy-stations/'+station.id+'/'+r.path));
  }
  await inventoryPreparedAssets({objectId,objectDirectory,filenames});
 }
 console.log('MILKY WAY SETTLED BAKE VERIFIED',pilot?'PILOT':'130 SLABS + 14 SKIES + 6 DOT LEVELS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await prepareGalaxyLayers(process.argv.slice(2));
