import {refreshSourceRecord} from '../../source-authoring-templates.mts';
import {requireRecord,requireArray,requireString,requireFiniteNumber,hasErrorCode} from '../../source-values.mts';
import {readIntake} from './intake.mts';
const records=(value:unknown)=>requireArray(value).map(item=>requireRecord(item));
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import * as fontkit from 'fontkit';import {createPlanetTitleSource} from '../../../tools/prepare-planet-title-sources.mts';import {PLANET_TITLE_RECIPE} from '../../../src/platform/planet-title-recipe.mts';
import {loadRadialTerrain} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';import {prepareSolidRasters} from '../../../tools/objects/terrestrial-layers/solid-raster.mts';import {renderRadialSnapshot} from '../../../tools/objects/terrestrial-layers/radial-snapshot.mts';import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
const read=async(p:string)=>requireRecord(JSON.parse(await readFile(p,'utf8'))),write=async(p:string,o:unknown)=>writeFile(p,JSON.stringify(o,null,2)+'\n'),pin=(b:Uint8Array)=>({expectedBytes:b.length,expectedSha256:createHash('sha256').update(b).digest('hex')});
const baseFont=fontkit.openSync(PLANET_TITLE_RECIPE.checkedFontPath);
if(!('getVariation' in baseFont))throw new TypeError('Title source requires one font face.');
const font=baseFont.getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
for(const c of await readIntake()){
 const p=resolve('src/planets',c.id),s=resolve(p,'source'),rawConfig=await read(resolve(s,'preparation/terrestrial.json'));
 const geometry=requireRecord(rawConfig.geometry),config={...rawConfig,displayName:requireString(rawConfig.displayName),namespace:requireString(rawConfig.namespace),geometry:{...geometry,radius:requireFiniteNumber(geometry.radius),radiusKm:requireFiniteNumber(geometry.radiusKm)}};
 c.name=config.displayName;
 await write(resolve(s,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...createPlanetTitleSource(c.name,font)});
 const source=await createSourceManifest({planetId:c.id,planetName:c.name,sourceRoot:s});
 const scratch=resolve('output/celestia-comets/context',c.id);await mkdir(scratch,{recursive:true});
 const ctx={config,sourceDirectory:s,source,publicDirectory:scratch,outputDirectory:scratch};
 const radial=await loadRadialTerrain(ctx),surfaces=await prepareSolidRasters({...ctx,radial});
 if(!radial)throw new TypeError('Comet context requires radial terrain.');
 const nav=await read(resolve(s,'preparation/navigation.json')),navSource=requireRecord(nav.source),rawRecipe=requireRecord(navSource.recipe);
 const recipe={...rawRecipe,size:requireFiniteNumber(rawRecipe.size),longitudeDegrees:requireFiniteNumber(rawRecipe.longitudeDegrees),latitudeDegrees:requireFiniteNumber(rawRecipe.latitudeDegrees),ambient:requireFiniteNumber(rawRecipe.ambient),diffuse:requireFiniteNumber(rawRecipe.diffuse)};
 const png=await renderRadialSnapshot({...recipe,faces:radial.faces,map:resolve(scratch,requireString(requireRecord(surfaces[0].map).url).split('/').at(-1)!)});
 await writeFile(resolve(s,'presentation/context.png'),png);Object.assign(navSource,pin(png));await write(resolve(s,'preparation/navigation.json'),nav);
 const manifest=await read(resolve(s,'manifest.json'));manifest.generatedIntermediates=[refreshSourceRecord(records(manifest.generatedIntermediates),{...navSource,path:requireString(navSource.path),id:'prepared-radial-context'})];
 const exclude=new Set(['manifest.json',...records(manifest.inputs).map(x=>requireString(x.path)),...records(manifest.generatedIntermediates).map(x=>requireString(x.path))]),documents:{path:string;expectedBytes:number;expectedSha256:string;purpose:string}[]=[];
 async function walk(dir:string,pre=''):Promise<void>{for(const e of await readdir(dir,{withFileTypes:true})){const rel=pre+e.name;if(e.isDirectory())await walk(resolve(dir,e.name),rel+'/');else if(!exclude.has(rel))documents.push(refreshSourceRecord(records(manifest.documents),{path:rel,...pin(await readFile(resolve(dir,e.name))),purpose:'Source evidence or authored preparation input.'}));}}
 await walk(s);manifest.documents=documents.sort((a,b)=>a.path.localeCompare(b.path));await write(resolve(s,'manifest.json'),manifest);
 const descriptor=await read(resolve(p,'object.json'));for(const ref of records(requireRecord(requireRecord(descriptor.properties).recipe).sources))ref.sha256=pin(await readFile(resolve(p,requireString(ref.path)))).expectedSha256;await write(resolve(p,'object.json'),descriptor);
 console.log(c.id,radial.faces.length,pin(png));
}
