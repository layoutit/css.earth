/** Extract only the standard sphere's export-time inputs; never mirror the checkout. */
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { splitPreparedRuntimeText, readPreparedRuntimeText, readPreparedRuntimeHead } from '@cssearth/objects/node';
import { loadSolarGeometry } from '@cssearth/bake/objects/scene';
import { inspectMeasurementSphere } from './sphere-inputs.mts';
import { sphereDictionary, SPHERE_ID_TOKEN } from './sphere-bank-codec.mts';
import { clearInactiveImageBindings } from './sphere-assets.mts';
import { requirePackageInput } from '../package/package-inputs.mts';

export async function prepareSpherePackage(root: string, destination: string): Promise<void> {
  await requirePackageInput(resolve(root, 'src/platform/solar-geometry.mts'), 'pnpm prepare:inputs');
  const solar=await loadSolarGeometry(root),bodies:Record<string,unknown>={},profiles:string[]=[],styles:string[]=[];
  const dictionary=sphereDictionary();
  const profileIds=new Map<string,number>(),styleIds=new Map<string,number>();
  const intern=(text:string,values:string[],ids:Map<string,number>)=>{
    let index=ids.get(text);if(index===undefined){index=values.length;values.push(text);ids.set(text,index);}return index;
  };
  for(const entry of await readdir(resolve(root,'src/objects'),{withFileTypes:true})) {
    if(!entry.isDirectory())continue;
    const base=resolve(root,'src/objects',entry.name,'source/preparation');
    if(!existsSync(resolve(base,'raster.json'))||!existsSync(resolve(base,'geometry.json')))continue;
    const prepared = resolve(root, 'src/objects', entry.name, 'prepared');
    await requirePackageInput(resolve(prepared, 'runtime.json'), 'pnpm setup:prepared');
    // Destinations are application scene owners, not standard sphere candidates.
    const {requireRecord,requireArray}=await import('@cssearth/core');
    const head=await readPreparedRuntimeHead(prepared,['controls']);
    const controls=requireRecord(head.controls),datasets=controls.datasets===undefined?undefined:requireRecord(controls.datasets);
    const recipeInput=requireRecord(JSON.parse(await readFile(resolve(base,'raster.json'),'utf8')));
    if(!datasets||!requireArray(recipeInput.surfaces).some(surface=>requireRecord(surface).id===datasets.defaultDataset))continue;
    let runtimeTextInput: string;
    try { runtimeTextInput = await readPreparedRuntimeText(prepared); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT' && 'path' in error && typeof error.path === 'string')
        await requirePackageInput(error.path, 'pnpm setup:prepared');
      throw error;
    }
    if(requireRecord(JSON.parse(runtimeTextInput)).destinations)continue;
    const input=await inspectMeasurementSphere(root,entry.name);
    const {features:_features,textureLevels:_levels,...runtime}=input.original;
    const excluded=runtime.assets.entries.filter(asset=>!input.required.includes(asset.key));
    const tree={...runtime.tree,properties:clearInactiveImageBindings(runtime.tree.properties,excluded).properties};
    const portable={...runtime,tree,controls:{datasets:{defaultDataset:input.datasetId,controls:[{id:input.datasetId,label:'Measurement'}]},settings:null},
      motion:[],animations:[],materials:[],variants:[{...input.variant,when:{datasetId:input.datasetId},materials:[],
        writes:[...input.variant.writes,...runtime.materials.map(track=>({kind:'style',target:track.target,name:'visibility',value:'hidden'}))],required:input.required}],
      assets:{...runtime.assets,entries:runtime.assets.entries.filter(asset=>input.required.includes(asset.key)),startup:input.required}};
    const split=splitPreparedRuntimeText(JSON.stringify(portable));
    const {lighting:_lighting,atmosphere:_atmosphere,interior:_interior,emission:_emission,...recipe}=input.recipe;
    const runtimeText=split?.runtime??JSON.stringify(portable);
    if(runtimeText.includes(SPHERE_ID_TOKEN))throw new TypeError('Sphere identity token collides with prepared input.');
    bodies[entry.name]={runtime:dictionary.add(JSON.parse(runtimeText.replaceAll(entry.name,SPHERE_ID_TOKEN))),...(split?{profile:intern(split.leafBoxes,profiles,profileIds)}:{}),
      recipe:{...recipe,surfaces:[input.surface]},worldFrame:input.worldFrame,
      styles:input.styles.map(css=>intern(css.toString(),styles,styleIds)),
      sun:solar.requireBodyFixedSunDirection(entry.name),north:solar.requireBodyFixedEclipticNorth(entry.name)};
  }
  await mkdir(destination,{recursive:true});
  await writeFile(resolve(destination,'sphere-bank.json.gz'),gzipSync(JSON.stringify({schema:'cssearth-telescope-spheres@2',bodies,profiles,styles,dictionary:dictionary.entries})));
}
