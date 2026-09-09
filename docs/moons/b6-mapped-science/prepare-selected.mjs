// B6 incremental replay: use existing preparers for selected lenses, retaining
// the verified baseline scene/celestial data and unchanged lens assets.
import {readFile,writeFile,mkdir,cp,copyFile,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createSourceManifest} from '../../../src/platform/source-manifest.mjs';
import {prepareObservationLenses} from '../../../tools/objects/static-surface/raster.mjs';
import {prepareBandSurfacePresentation} from '../../../tools/objects/static-surface/presentation.mjs';
import {prepareSolidRasters,prepareSolidSurfacePoles} from '../../../tools/objects/terrestrial-layers/solid-raster.mjs';
import {parseTerrestrialProfile} from '../../../tools/objects/terrestrial-layers/index.mjs';
import {prepareSolidPresentation} from '../../../tools/objects/terrestrial-layers/solid-scene.mjs';
import {prepareObjectContentAssets} from '../../../tools/objects/dist/content/prepare.js';
import {prepareRuntimeManifest} from '../../../tools/objects/dist/operations.js';
import {prepareSurfaceMinimaps} from '../../../tools/prepare-surface-minimaps.mjs';
import {prepareObjectProvenance} from '../../../tools/objects/provenance.mjs';

const read=async p=>JSON.parse(await readFile(p));
const write=async(p,v)=>writeFile(p,JSON.stringify(v)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const selections={moon:['silicate-signature','geology'],europa:['geology','infrared'],callisto:['infrared'],charon:['albedo']};
const id=process.argv[2];if(!selections[id])throw new Error('Specify one B6 body.');
const selected=new Set(selections[id]),objectDirectory=resolve('src/planets',id),sourceDirectory=resolve(objectDirectory,'source');
const baseline=await read(resolve(objectDirectory,'runtime-assets.json'));
const source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:sourceDirectory});await source.verify();console.log('source-verified');
await mkdir('output/b6-preparation',{recursive:true});
const stage=await mkdtemp(resolve('output/b6-preparation',`${id}-`)),publicDirectory=resolve(stage,'public'),outputDirectory=resolve(stage,'prepared');
await mkdir(publicDirectory,{recursive:true});await cp(resolve(objectDirectory,'prepared'),outputDirectory,{recursive:true});
for(const asset of baseline.assets){const file=resolve('public/scenes',id,asset.filename),bytes=await readFile(file);if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw new Error(`Baseline asset drift: ${asset.filename}`);await mkdir(resolve(publicDirectory,asset.filename,'..'),{recursive:true});await copyFile(file,resolve(publicDirectory,asset.filename));}
const scene=await read(resolve(outputDirectory,'scene.json'));let definition;
if(id==='moon'){
 const raster=await read(resolve(sourceDirectory,'preparation/raster.json')),geometry=await read(resolve(sourceDirectory,'preparation/geometry.json')),content=await read(resolve(sourceDirectory,'content/static.json'));
 await prepareObservationLenses({sourceDirectory,publicDirectory,config:{...raster,lenses:raster.lenses.filter(x=>selected.has(x.id))},geometry});
 const sky=await read(resolve(outputDirectory,'sky.json')),sun=await read(resolve(outputDirectory,'sun.json'));
 definition={...await prepareBandSurfacePresentation({namespace:id,plan:scene,lenses:content.lenses,sky,sun}),schema:'cssearth-object-runtime@4',id,controls:content.controls};
 for(const name of ['controls','lenses','panel'])await write(resolve(outputDirectory,`${name}.json`),content[name]);
 const preparedContent=await read(resolve(outputDirectory,'content.json'));preparedContent.provenance=content.provenance;await write(resolve(outputDirectory,'content.json'),preparedContent);
}else{
 const config=parseTerrestrialProfile(await read(resolve(sourceDirectory,'preparation/terrestrial.json')));
 const filtered={...config,raster:{...config.raster,observations:config.raster.observations.filter(x=>selected.has(x.id)),scientific:config.raster.scientific.filter(x=>selected.has(x.id)),observedColors:[],mosaics:[],shapeViews:[]}};
 // Validate selected original entries through the real manifest owner; the
 // filtered surface group makes this explicit incremental invocation complete.
 const subset={...source,validateGroup:async consumer=>{const entries=source.inputsFor(consumer).filter(e=>consumer!=='surfaces'||selected.has(e.lensId));for(const e of entries)await source.validatePath(e.path);return entries;}};
 console.log('rasters-start');
const newSurfaces=await prepareSolidRasters({sourceDirectory,publicDirectory,outputDirectory,config:filtered,source:subset});
 console.log('material-start');
await prepareSolidSurfacePoles({surfaces:newSurfaces,publicDirectory,config});
 const material=await read(resolve(objectDirectory,'prepared/material.json'));
 material.surfaces=[...material.surfaces.filter(x=>!selected.has(x.id)),...newSurfaces];
 const order=[...config.raster.observations,...config.raster.scientific,...(config.raster.observedColors??[])].map(x=>x.id);material.surfaces.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
 await write(resolve(outputDirectory,'surfaces.json'),{objectId:id,surfaces:material.surfaces});await write(resolve(outputDirectory,'material.json'),material);
 await write(resolve(outputDirectory,'assets.json'),{surfaces:Object.fromEntries(material.surfaces.map(s=>[s.id,{url:s.surface.url,url2x:s.surface.url,polesUrl:s.polesUrl,polesUrl2x:s.polesUrl}]))});
 console.log('content-start');
// Color statistics for unchanged 8K/12K atlases are already in the verified
// baseline. Expose only new textures to the content preparer's optional color
// probe, then retain the old values for byte-identical baseline assets.
const contentPublic=resolve(stage,'content-public');await mkdir(contentPublic,{recursive:true});
for(const surface of newSurfaces)await copyFile(resolve(publicDirectory,surface.surface.url.split('/').at(-1)),resolve(contentPublic,surface.surface.url.split('/').at(-1)));
const content=await prepareObjectContentAssets({sourceDirectory,publicDirectory:contentPublic,outputDirectory,config:{contentPath:'content/object.json'}});
const oldLenses=await read(resolve(objectDirectory,'prepared/lenses.json')),lenses=await read(resolve(outputDirectory,'lenses.json'));
for(const lens of lenses.controls){if(selected.has(lens.id))continue;const previous=oldLenses.controls.find(x=>x.id===lens.id);if(previous?.billboardColor)lens.billboardColor=previous.billboardColor;}
await write(resolve(outputDirectory,'lenses.json'),lenses);
await cp(contentPublic,publicDirectory,{recursive:true});
 console.log('presentation-start');
definition=await prepareSolidPresentation({config,scene,material,controls:content.controls,source,sourceDirectory,publicDirectory,outputDirectory});
}
await write(resolve(outputDirectory,'runtime.json'),definition);
console.log('minimaps-start');
// Regenerate only changed previews through the existing minimap preparer.
// The untouched, tracked minimaps were copied from the baseline above.
const previewObject=resolve(stage,'preview-object'),previewOutput=resolve(stage,'preview-prepared');
await mkdir(resolve(previewObject,'source/preparation'),{recursive:true});await mkdir(previewOutput,{recursive:true});
const previousMinimaps=await read(resolve(outputDirectory,'minimaps.json'));
const previewControls=await read(resolve(outputDirectory,'controls.json'));
previewControls.lenses.controls=previewControls.lenses.controls.filter(x=>selected.has(x.id));
await write(resolve(previewOutput,'controls.json'),previewControls);
if(id==='moon'){
 const recipe=await read(resolve(sourceDirectory,'preparation/raster.json'));recipe.lenses=recipe.lenses.filter(x=>selected.has(x.id));
 await write(resolve(previewObject,'source/preparation/raster.json'),recipe);
}else{
 const surfaces=await read(resolve(outputDirectory,'surfaces.json'));surfaces.surfaces=surfaces.surfaces.filter(x=>selected.has(x.id));
 await write(resolve(previewOutput,'surfaces.json'),surfaces);
}
try {await mkdir(resolve(previewObject,'source/presentation'),{recursive:true});await copyFile(resolve(sourceDirectory,'presentation/minimap.json'),resolve(previewObject,'source/presentation/minimap.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const newMinimaps=await prepareSurfaceMinimaps({objectDirectory:previewObject,publicDirectory,outputDirectory:previewOutput});
await cp(resolve(previewOutput,'minimaps'),resolve(outputDirectory,'minimaps'),{recursive:true});
await write(resolve(outputDirectory,'minimaps.json'),{images:[...previousMinimaps.images.filter(x=>!selected.has(x.id)),...newMinimaps]});
const values=[];for(const name of ['runtime','controls','content','lenses','scene','sky','sun'])values.push(await read(resolve(outputDirectory,`${name}.json`)));
await prepareRuntimeManifest({id,publicRoot:publicDirectory,manifestPath:resolve(outputDirectory,'runtime-assets.json'),values,allowPreparationArtifacts:true});
console.log('provenance-start');
await prepareObjectProvenance({objectDirectory,publicDirectory,outputDirectory,basis:'prepared'});
// Exact old texture bytes must survive this content-only replay.
const updated=await read(resolve(outputDirectory,'runtime-assets.json'));
for(const old of baseline.assets){if(!updated.assets.some(x=>x.filename===old.filename))continue;
 if([...selected].some(lens=>{const prefix=`${id}-${lens}`;return old.filename===`${prefix}.webp`||old.filename===`${prefix}@2x.webp`||old.filename.startsWith(`${prefix}-`);}))continue;
 if(hash(await readFile(resolve(publicDirectory,old.filename)))!==old.sha256)throw new Error(`Unchanged asset differs: ${old.filename}`);}
for(const asset of updated.assets)await copyFile(resolve(publicDirectory,asset.filename),resolve('public/scenes',id,asset.filename));
await cp(outputDirectory,resolve(objectDirectory,'prepared'),{recursive:true});
await copyFile(resolve(outputDirectory,'runtime-assets.json'),resolve(objectDirectory,'runtime-assets.json'));
console.log('Asset stage complete; finalize transport in a fresh process: node docs/moons/b6-mapped-science/finalize-one.mjs '+id);
await write(resolve(stage,'receipt.json'),{id,selected:[...selected],baselineAssetCount:baseline.assets.length,runtimeAssetCount:updated.assets.length,sceneSha256:hash(await readFile(resolve(outputDirectory,'scene.json'))),stage});
console.log(JSON.stringify({id,stage,selected:[...selected]}));
