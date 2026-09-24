import { refreshSourceRecord } from '../../../sources/source-authoring-templates.mts';
import assert from 'node:assert/strict';
import { parseAuthoringSolid, parseAuthoringManifest } from '../../../sources/source-authoring-templates.mts';
import { shape, text, number, array } from '../../terrestrial-layers/source-records.mts';
import { requireRecord } from '../../../sources/source-values.mts';
import { bodies } from './catalog.mts';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRadialTerrain } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { prepareSolidRasters } from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
import { renderRadialSnapshot } from '../../../../tools/objects/terrestrial-layers/radial-snapshot.mts';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
const parseNavigation = (v: unknown) => { const raw=requireRecord(v); return {...raw,source:shape({path:text})(raw.source)}; };
const parseSnapshotRecipe=shape({size:number,longitudeDegrees:number,latitudeDegrees:number,ambient:number,diffuse:number,inputs:array(text)});
const read=async (p: string): Promise<unknown>=>JSON.parse(await readFile(p,'utf8')),write=async(p: string,o: unknown)=>writeFile(p,JSON.stringify(o,null,2)+'\n');
for(const c of bodies){
 const p=resolve('src/objects',c.id),s=resolve(p,'source'),config=parseAuthoringSolid(await read(resolve(s,'preparation/terrestrial.json')));
 assert.equal(c.name,config.displayName);
 const source=await createSourceManifest({objectId:c.id,objectName:c.name,sourceRoot:s});
 const scratch=resolve('output/galileo-lucy/context',c.id);await mkdir(scratch,{recursive:true});
 const ctx={config,sourceDirectory:s,source,publicDirectory:scratch,outputDirectory:scratch};
 const radial=await loadRadialTerrain(ctx);assert(radial);
 const surfaces=await prepareSolidRasters({...ctx,radial});
 // The marker names its context image by path; the manifest record owns the snapshot recipe, pins and attribution.
 const nav=parseNavigation(await read(resolve(s,'preparation/navigation.json'))),manifest=parseAuthoringManifest(await read(resolve(s,'manifest.json')));
 const context=requireRecord(manifest.generatedIntermediates.find(entry=>requireRecord(entry).path===nav.source.path)),recipe=parseSnapshotRecipe(context.recipe);
 const png=await renderRadialSnapshot({...recipe,faces:radial.faces,map:resolve(scratch,surfaces[0].map.url.split('/').at(-1)!)});
 await writeFile(resolve(s,'presentation/context.png'),png);
 manifest.generatedIntermediates=[refreshSourceRecord(manifest.generatedIntermediates,{...context,path:nav.source.path})];
 const exclude=new Set(['manifest.json',...manifest.inputs.map(x=>x.path),...manifest.generatedIntermediates.map(x=>x.path)]);
 const documents: {path:string}[]=[];
 async function walk(dir: string,pre=''){for(const e of await readdir(dir,{withFileTypes:true})){const rel=pre+e.name;if(e.isDirectory())await walk(resolve(dir,e.name),rel+'/');else if(!exclude.has(rel))documents.push(refreshSourceRecord(manifest.documents,{path:rel}));}}
 await walk(s);manifest.documents=documents.sort((a,b)=>a.path.localeCompare(b.path));await write(resolve(s,'manifest.json'),manifest);
 console.log(c.id,radial.faces.length,png.length);
}
