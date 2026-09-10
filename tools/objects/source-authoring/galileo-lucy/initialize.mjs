import {bodies} from './catalog.mjs';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import * as fontkit from 'fontkit';import {createPlanetTitleSource} from '../../../../tools/prepare-planet-title-sources.mjs';import {PLANET_TITLE_RECIPE} from '../../../../src/platform/planet-title-recipe.mjs';
import {loadRadialTerrain} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';import {prepareSolidRasters} from '../../../../tools/objects/terrestrial-layers/solid-raster.mjs';import {renderRadialSnapshot} from '../../../../tools/objects/terrestrial-layers/radial-snapshot.mjs';import {createSourceManifest} from '../../../../src/platform/source-manifest.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8')),write=async(p,o)=>writeFile(p,JSON.stringify(o,null,2)+'\n'),pin=b=>({expectedBytes:b.length,expectedSha256:createHash('sha256').update(b).digest('hex')});
const font=fontkit.openSync('src/planets/dactyl/source/presentation/InterVariable.ttf').getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
for(const c of bodies){
 const p=resolve('src/planets',c.id),s=resolve(p,'source'),config=await read(resolve(s,'preparation/terrestrial.json'));
 c.name=config.displayName;
 await write(resolve(s,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...createPlanetTitleSource(c.name,font)});
 const source=await createSourceManifest({planetId:c.id,planetName:c.name,sourceRoot:s});
 const scratch=resolve('output/galileo-lucy/context',c.id);await mkdir(scratch,{recursive:true});
 const ctx={config,sourceDirectory:s,source,publicDirectory:scratch,outputDirectory:scratch};
 const radial=await loadRadialTerrain(ctx),surfaces=await prepareSolidRasters({...ctx,radial});
 const nav=await read(resolve(s,'preparation/navigation.json')),recipe=nav.source.recipe;
 const png=await renderRadialSnapshot({...recipe,faces:radial.faces,map:resolve(scratch,surfaces[0].map.url.split('/').at(-1))});
 await writeFile(resolve(s,'presentation/context.png'),png);Object.assign(nav.source,pin(png));await write(resolve(s,'preparation/navigation.json'),nav);
 const manifest=await read(resolve(s,'manifest.json'));manifest.generatedIntermediates=[{...nav.source,id:'prepared-radial-context'}];
 const exclude=new Set(['manifest.json',...manifest.inputs.map(x=>x.path),...manifest.generatedIntermediates.map(x=>x.path)]),documents=[];
 async function walk(dir,pre=''){for(const e of await readdir(dir,{withFileTypes:true})){const rel=pre+e.name;if(e.isDirectory())await walk(resolve(dir,e.name),rel+'/');else if(!exclude.has(rel))documents.push({path:rel,...pin(await readFile(resolve(dir,e.name))),purpose:'Source evidence or authored preparation input.'});}}
 await walk(s);manifest.documents=documents.sort((a,b)=>a.path.localeCompare(b.path));await write(resolve(s,'manifest.json'),manifest);
 const descriptor=await read(resolve(p,'object.json'));for(const ref of descriptor.properties.recipe.sources)ref.sha256=pin(await readFile(resolve(p,ref.path))).expectedSha256;await write(resolve(p,'object.json'),descriptor);
 console.log(c.id,radial.faces.length,pin(png));
}
