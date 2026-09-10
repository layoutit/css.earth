import {requireObjectRuntimeDefinition} from '../../../tools/object-runtime-contract.mts';
import {parseBandReplayScene,parseSolidReplayScene,parseReplayMaterial,parseReplayControls,parseReplayLenses,parseReplayMinimaps,parseReplaySurfaces,parseReplayTerrain} from '../../../tools/prepared-replay-source.mts';
import {readJsonSource,requireRecord,requireArray,requireString,hasErrorCode} from '../../../tools/source-values.mts';
import {parseRuntimeManifest} from '../../../tools/objects/dist/operations.js';
import {parseSurfaceRaster,parseSurfaceGeometry,parseSurfaceContent,parseBandLenses} from '../../../tools/objects/static-surface/source-contract.mts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
// B8 incremental replay: use existing preparers for selected lenses, retaining
// the verified baseline scene/celestial data and unchanged lens assets.
import {readFile,writeFile,mkdir,cp,copyFile,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {prepareSolidRasters,prepareSolidSurfacePoles} from '../../../tools/objects/terrestrial-layers/solid-raster.mts';
import {parseTerrestrialProfile} from '../../../tools/objects/terrestrial-layers/index.mts';
import {prepareRadialMaterials} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireBodyFixedSunDirection} from '../../../src/platform/solar-geometry.mts';
import {prepareSolidPresentation} from '../../../tools/objects/terrestrial-layers/solid-scene.mts';
import {prepareObjectContentAssets} from '../../../tools/objects/dist/content/prepare.js';
import {prepareRuntimeManifest} from '../../../tools/objects/dist/operations.js';
import {prepareSurfaceMinimaps} from '../../../tools/prepare-surface-minimaps.mts';
import {prepareObjectProvenance} from '../../../tools/objects/provenance.mts';

const read=readJsonSource;
const write=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v)+'\n');
const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const selections=Object.fromEntries(Object.entries(requireRecord(await read(new URL('./selected-views.json',import.meta.url)))).map(([id,value])=>[id,requireArray(value).map(value=>requireString(value))]));
const id=Object.keys(selections).find(id=>id===process.argv[2]);if(!id)throw new Error('Specify one B8 body.');
const selected=new Set(selections[id]),objectDirectory=resolve('src/planets',id),sourceDirectory=resolve(objectDirectory,'source');
const baseline=parseRuntimeManifest(await read(resolve(objectDirectory,'runtime-assets.json')),id);
const source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:sourceDirectory});await source.verify();console.log('source-verified');
await mkdir('output/b8-preparation',{recursive:true});
const stage=await mkdtemp(resolve('output/b8-preparation',`${id}-`)),publicDirectory=resolve(stage,'public'),outputDirectory=resolve(stage,'prepared');
await mkdir(publicDirectory,{recursive:true});await cp(resolve(objectDirectory,'prepared'),outputDirectory,{recursive:true});
for(const asset of baseline.assets){const file=resolve('public/scenes',id,asset.filename),bytes=await readFile(file);if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw new Error(`Baseline asset drift: ${asset.filename}`);await mkdir(resolve(publicDirectory,asset.filename,'..'),{recursive:true});await copyFile(file,resolve(publicDirectory,asset.filename));}
const scene=parseSolidReplayScene(await read(resolve(outputDirectory,'scene.json')));let definition;

 const config=parseTerrestrialProfile(await read(resolve(sourceDirectory,'preparation/terrestrial.json')));
 if(config.kind!=='solid-observation-body'||!config.raster.scientific)throw new TypeError('Selected replay requires a solid scientific surface.');
 const filtered={...config,raster:{...config.raster,observations:config.raster.observations.filter(x=>selected.has(x.id)),scientific:config.raster.scientific.filter(x=>selected.has(x.id)),observedColors:[],mosaics:[],shapeViews:[]}};
 // Validate selected original entries through the real manifest owner; the
 // filtered surface group makes this explicit incremental invocation complete.
 const subset={...source,validateGroup:async (consumer:string)=>{const entries=source.inputsFor(consumer).filter(e=>consumer!=='surfaces'||selected.has(requireString(requireRecord(e).lensId)));for(const e of entries)await source.validatePath(e.path);return entries;}};
 console.log('rasters-start');
const newSurfaces=await prepareSolidRasters({sourceDirectory,publicDirectory,outputDirectory,config:filtered,source:subset});
 console.log('material-start');
// The standard material preparation also computes the surface mean color here.
// Radial preparation subsequently replaces the pole URL with the face atlas.
await prepareSolidSurfacePoles({surfaces:newSurfaces,publicDirectory,config});
if(config.geometry.radialTerrain){
  const terrain=parseReplayTerrain(await read(resolve(objectDirectory,'prepared/terrain.json')));
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
  await prepareRadialMaterials({radial,surfaces:newSurfaces,config:{...config,geometry:{...config.geometry,radialTerrain:{...requireRecord(config.geometry.radialTerrain),sourceLighting:requireRecord(config.geometry.radialTerrain).sourceLighting,thumbnail:requireRecord(config.geometry.radialTerrain).thumbnail}}},source,publicDirectory,outputDirectory,
    sunDirection:requireBodyFixedSunDirection(id),snapshotEntries:[]});
  // Material replay must not rewrite even the serialization of the saved mesh.
  await copyFile(resolve(objectDirectory,'prepared/terrain.json'),resolve(outputDirectory,'terrain.json'));
}
 const material=parseReplayMaterial(await read(resolve(objectDirectory,'prepared/material.json')));
 material.surfaces=[...material.surfaces.filter(x=>!selected.has(x.id)),...newSurfaces];
 // Match the normal raster preparer's order, including observations inserted
 // before existing scientific views. This also stabilizes resource serialization.
 const surfaceOrder=(['observations','shapeViews','mosaics','surfaceObservations','scientific','observedColors'] as const)
   .flatMap(group=>(config.raster[group]??[]).map(surface=>surface.id));
 const order=new Map(surfaceOrder.map((id,index)=>[id,index]));
 const requireOrder=(id:string)=>{const index=order.get(id);if(index===undefined)throw new TypeError(`Missing surface order: ${id}`);return index;};
 if(material.surfaces.some(surface=>!order.has(surface.id)))throw new Error('Surface missing from full preparation order');
 material.surfaces.sort((a,b)=>requireOrder(a.id)-requireOrder(b.id));
 await write(resolve(outputDirectory,'surfaces.json'),{objectId:id,surfaces:material.surfaces});await write(resolve(outputDirectory,'material.json'),material);
 await write(resolve(outputDirectory,'assets.json'),{surfaces:Object.fromEntries(material.surfaces.map(s=>[s.id,{url:s.surface.url,url2x:s.surface.url,polesUrl:s.polesUrl,polesUrl2x:s.polesUrl}]))});
 console.log('content-start');
// Color statistics for unchanged 8K/12K atlases are already in the verified
// baseline. Expose only new textures to the content preparer's optional color
// probe, then retain the old values for byte-identical baseline assets.
const contentPublic=resolve(stage,'content-public');await mkdir(contentPublic,{recursive:true});
for(const surface of newSurfaces)await copyFile(resolve(publicDirectory,requireString(surface.surface.url.split('/').at(-1))),resolve(contentPublic,requireString(surface.surface.url.split('/').at(-1))));
const content=await prepareObjectContentAssets({sourceDirectory,publicDirectory:contentPublic,outputDirectory,config:{contentPath:'content/object.json'}});
const oldLenses=parseReplayLenses(await read(resolve(objectDirectory,'prepared/lenses.json'))),lenses=parseReplayLenses(await read(resolve(outputDirectory,'lenses.json')));
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
const previousMinimaps=parseReplayMinimaps(await read(resolve(outputDirectory,'minimaps.json')));
const previewControls=parseReplayControls(await read(resolve(outputDirectory,'controls.json')));
previewControls.lenses.controls=previewControls.lenses.controls.filter(x=>selected.has(x.id));
await write(resolve(previewOutput,'controls.json'),previewControls);

 const surfaces=parseReplaySurfaces(await read(resolve(outputDirectory,'surfaces.json')));surfaces.surfaces=surfaces.surfaces.filter(x=>selected.has(x.id));
 await write(resolve(previewOutput,'surfaces.json'),surfaces);
try {await mkdir(resolve(previewObject,'source/presentation'),{recursive:true});await copyFile(resolve(sourceDirectory,'presentation/minimap.json'),resolve(previewObject,'source/presentation/minimap.json'));}catch(error){if(!hasErrorCode(error,'ENOENT'))throw error;}
const newMinimaps=await prepareSurfaceMinimaps({objectDirectory:previewObject,publicDirectory,outputDirectory:previewOutput});
await cp(resolve(previewOutput,'minimaps'),resolve(outputDirectory,'minimaps'),{recursive:true});
const minimaps=[...previousMinimaps.images.filter(x=>!selected.has(x.id)),...newMinimaps];
minimaps.sort((a,b)=>requireOrder(a.id)-requireOrder(b.id));
await write(resolve(outputDirectory,'minimaps.json'),{images:minimaps});
const values=[];for(const name of ['runtime','controls','content','lenses','scene','sky','sun'])values.push(await read(resolve(outputDirectory,`${name}.json`)));
await prepareRuntimeManifest({id,publicRoot:publicDirectory,manifestPath:resolve(outputDirectory,'runtime-assets.json'),values,allowPreparationArtifacts:true});
console.log('provenance-start');
await prepareObjectProvenance({objectDirectory,publicDirectory,outputDirectory,basis:'prepared'});
// Exact old texture bytes must survive this content-only replay.
const updated=parseRuntimeManifest(await read(resolve(outputDirectory,'runtime-assets.json')),id);
for(const old of baseline.assets){if(!updated.assets.some(x=>x.filename===old.filename))continue;
 if([...selected].some(lens=>{const prefix=`${id}-${lens}`;return old.filename===`${prefix}.webp`||old.filename===`${prefix}@2x.webp`||old.filename.startsWith(`${prefix}-`);}))continue;
 if(hash(await readFile(resolve(publicDirectory,old.filename)))!==old.sha256)throw new Error(`Unchanged asset differs: ${old.filename}`);}
for(const asset of updated.assets)await copyFile(resolve(publicDirectory,asset.filename),resolve('public/scenes',id,asset.filename));
await cp(outputDirectory,resolve(objectDirectory,'prepared'),{recursive:true});
await copyFile(resolve(outputDirectory,'runtime-assets.json'),resolve(objectDirectory,'runtime-assets.json'));
console.log('Asset stage complete; finalize transport in a fresh process: node docs/moons/b8-surface-chemistry/finalize-one.mts '+id);
await write(resolve(stage,'receipt.json'),{id,selected:[...selected],baselineAssetCount:baseline.assets.length,runtimeAssetCount:updated.assets.length,sceneSha256:hash(await readFile(resolve(outputDirectory,'scene.json'))),stage});
console.log(JSON.stringify({id,stage,selected:[...selected]}));
