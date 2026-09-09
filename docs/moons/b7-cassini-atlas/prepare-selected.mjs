// B7 incremental replay: use existing preparers for selected lenses, retaining
// the verified baseline scene/celestial data and unchanged lens assets.
import {readFile,writeFile,mkdir,cp,copyFile,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createSourceManifest} from '../../../src/platform/source-manifest.mjs';
import {prepareSolidRasters,prepareSolidSurfacePoles} from '../../../tools/objects/terrestrial-layers/solid-raster.mjs';
import {parseTerrestrialProfile} from '../../../tools/objects/terrestrial-layers/index.mjs';
import {prepareRadialMaterials} from '../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import {requireBodyFixedSunDirection} from '../../../src/platform/solar-geometry.mjs';
import {prepareSolidPresentation} from '../../../tools/objects/terrestrial-layers/solid-scene.mjs';
import {prepareObjectContentAssets} from '../../../tools/objects/dist/content/prepare.js';
import {prepareRuntimeManifest} from '../../../tools/objects/dist/operations.js';
import {prepareSurfaceMinimaps} from '../../../tools/prepare-surface-minimaps.mjs';
import {prepareObjectProvenance} from '../../../tools/objects/provenance.mjs';

const read=async p=>JSON.parse(await readFile(p));
const write=async(p,v)=>writeFile(p,JSON.stringify(v)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const selections={titan:['geology'],dione:['infrared','ice-absorption'],rhea:['infrared','ice-absorption']};
const id=process.argv[2];if(!selections[id])throw new Error('Specify one B7 body.');
const selected=new Set(selections[id]),objectDirectory=resolve('src/planets',id),sourceDirectory=resolve(objectDirectory,'source');
const baseline=await read(resolve(objectDirectory,'runtime-assets.json'));
const source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:sourceDirectory});await source.verify();console.log('source-verified');
await mkdir('output/b7-preparation',{recursive:true});
const stage=await mkdtemp(resolve('output/b7-preparation',`${id}-`)),publicDirectory=resolve(stage,'public'),outputDirectory=resolve(stage,'prepared');
await mkdir(publicDirectory,{recursive:true});await cp(resolve(objectDirectory,'prepared'),outputDirectory,{recursive:true});
for(const asset of baseline.assets){const file=resolve('public/scenes',id,asset.filename),bytes=await readFile(file);if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw new Error(`Baseline asset drift: ${asset.filename}`);await mkdir(resolve(publicDirectory,asset.filename,'..'),{recursive:true});await copyFile(file,resolve(publicDirectory,asset.filename));}
const scene=await read(resolve(outputDirectory,'scene.json'));let definition;

 const config=parseTerrestrialProfile(await read(resolve(sourceDirectory,'preparation/terrestrial.json')));
 const filtered={...config,raster:{...config.raster,observations:config.raster.observations.filter(x=>selected.has(x.id)),scientific:config.raster.scientific.filter(x=>selected.has(x.id)),observedColors:[],mosaics:[],shapeViews:[]}};
 // Validate selected original entries through the real manifest owner; the
 // filtered surface group makes this explicit incremental invocation complete.
 const subset={...source,validateGroup:async consumer=>{const entries=source.inputsFor(consumer).filter(e=>consumer!=='surfaces'||selected.has(e.lensId));for(const e of entries)await source.validatePath(e.path);return entries;}};
 console.log('rasters-start');
const newSurfaces=await prepareSolidRasters({sourceDirectory,publicDirectory,outputDirectory,config:filtered,source:subset});
 console.log('material-start');
// The standard material preparation also computes the surface mean color here.
// Radial preparation subsequently replaces the pole URL with the face atlas.
await prepareSolidSurfacePoles({surfaces:newSurfaces,publicDirectory,config});
if(config.geometry.radialTerrain){
  const terrain=await read(resolve(objectDirectory,'prepared/terrain.json'));
  const tileSize=terrain.source.tileSize,columns=terrain.source.atlasColumns;
  if(scene.bodyLeaves.length!==terrain.faces.length)throw new Error('Saved mesh/leaf mismatch');
  const plans=terrain.faces.map((face,i)=>{
    const leaf=scene.bodyLeaves[i],declarations=Object.fromEntries(leaf.style.split(';').map(s=>{const at=s.indexOf(':');return [s.slice(0,at),s.slice(at+1)];}));
    const rect={x:i%columns*tileSize,y:Math.floor(i/columns)*tileSize};
    if(leaf.tag!=='u'||declarations['background-size']!==`${terrain.width}px ${terrain.height}px`||
      declarations['background-position']!==`${-rect.x}px ${-rect.y}px`)throw new Error('Saved atlas layout differs from its scene');
    const matrix=declarations.transform.slice(9,-1).split(',').map(Number);
    return {face,rect,matrix,geometry:{leafWidth:tileSize,leafHeight:tileSize}};
  });
  const radial={...terrain,plans,tileSize};
  await prepareRadialMaterials({radial,surfaces:newSurfaces,config,source,publicDirectory,outputDirectory,
    sunDirection:requireBodyFixedSunDirection(id),snapshotEntries:[]});
  // Material replay must not rewrite even the serialization of the saved mesh.
  await copyFile(resolve(objectDirectory,'prepared/terrain.json'),resolve(outputDirectory,'terrain.json'));
}
 const material=await read(resolve(objectDirectory,'prepared/material.json'));
 material.surfaces=[...material.surfaces.filter(x=>!selected.has(x.id)),...newSurfaces];
 // Match the normal raster preparer's order, including observations inserted
 // before existing scientific views. This also stabilizes resource serialization.
 const surfaceOrder=['observations','shapeViews','mosaics','surfaceObservations','scientific','observedColors']
   .flatMap(group=>(config.raster[group]??[]).map(surface=>surface.id));
 const order=new Map(surfaceOrder.map((id,index)=>[id,index]));
 if(material.surfaces.some(surface=>!order.has(surface.id)))throw new Error('Surface missing from full preparation order');
 material.surfaces.sort((a,b)=>order.get(a.id)-order.get(b.id));
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

 const surfaces=await read(resolve(outputDirectory,'surfaces.json'));surfaces.surfaces=surfaces.surfaces.filter(x=>selected.has(x.id));
 await write(resolve(previewOutput,'surfaces.json'),surfaces);
try {await mkdir(resolve(previewObject,'source/presentation'),{recursive:true});await copyFile(resolve(sourceDirectory,'presentation/minimap.json'),resolve(previewObject,'source/presentation/minimap.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const newMinimaps=await prepareSurfaceMinimaps({objectDirectory:previewObject,publicDirectory,outputDirectory:previewOutput});
await cp(resolve(previewOutput,'minimaps'),resolve(outputDirectory,'minimaps'),{recursive:true});
const minimaps=[...previousMinimaps.images.filter(x=>!selected.has(x.id)),...newMinimaps];
minimaps.sort((a,b)=>order.get(a.id)-order.get(b.id));
await write(resolve(outputDirectory,'minimaps.json'),{images:minimaps});
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
console.log('Asset stage complete; finalize transport in a fresh process: node docs/moons/b7-cassini-atlas/finalize-one.mjs '+id);
await write(resolve(stage,'receipt.json'),{id,selected:[...selected],baselineAssetCount:baseline.assets.length,runtimeAssetCount:updated.assets.length,sceneSha256:hash(await readFile(resolve(outputDirectory,'scene.json'))),stage});
console.log(JSON.stringify({id,stage,selected:[...selected]}));
