import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as fontkit from 'fontkit';
import {createPlanetTitleSource} from '../../tools/prepare-planet-title-sources.mjs';
import {PLANET_TITLE_RECIPE} from '../../src/platform/planet-title-recipe.mjs';
import {createSourceManifest} from '../../src/platform/source-manifest.mjs';
import {loadRadialTerrain} from '../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import {prepareSolidRasters} from '../../tools/objects/terrestrial-layers/solid-raster.mjs';
import {renderRadialSnapshot} from '../../tools/objects/terrestrial-layers/radial-snapshot.mjs';

const json=async p=>JSON.parse(await readFile(p,'utf8'));
const write=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const pin=async p=>{const b=await readFile(p);return {expectedBytes:b.length,expectedSha256:createHash('sha256').update(b).digest('hex')}};
async function files(root,prefix=''){const list=[];for(const e of await readdir(root,{withFileTypes:true})){const name=prefix+e.name;list.push(...e.isDirectory()?await files(resolve(root,e.name),name+'/'):[name]);}return list;}
async function seal(root){
 const s=resolve(root,'source'),m=await json(resolve(s,'manifest.json'));
 const special=new Set([...m.inputs,...m.generatedIntermediates].map(e=>e.path));
 m.documents=await Promise.all((await files(s)).filter(p=>p!=='manifest.json'&&!special.has(p)).sort().map(async path=>({path,purpose:'Pinned original source record or authored scientific preparation input.',...await pin(resolve(s,path))})));
 await write(resolve(s,'manifest.json'),m);
 const d=await json(resolve(root,'object.json'));
 for(const ref of d.properties.recipe.sources){try{ref.sha256=(await pin(resolve(root,ref.path))).expectedSha256}catch(e){if(e.code!=='ENOENT')throw e;}}
 await write(resolve(root,'object.json'),d);
}
const args=process.argv.slice(2);
const bodies=(await json(args.find(a=>a.endsWith('.json')) ?? 'docs/mars-crossing-population/inputs.json')).filter(b=>!args.some(a=>a.startsWith('--object='))||args.includes('--object='+b.id));
const font=fontkit.openSync(PLANET_TITLE_RECIPE.checkedFontPath).getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
for(const b of bodies){
 const root=resolve('src/planets',b.id),s=resolve(root,'source');
 const title=createPlanetTitleSource(b.displayName,font);await write(resolve(s,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...title});
 const content=await json(resolve(s,'content/object.json'));content.title=title;await write(resolve(s,'content/object.json'),content);await seal(root);
}
for(const b of bodies){
 const root=resolve('src/planets',b.id),s=resolve(root,'source'),m=await json(resolve(s,'manifest.json'));
 if(m.generatedIntermediates.length&&!args.includes('--refresh-context')){console.log(b.id,'already sealed');continue;}
 const config=await json(resolve(s,'preparation/terrestrial.json'));
 const source=await createSourceManifest({planetId:b.id,planetName:b.displayName,sourceRoot:s});await source.verify();
 const radial=await loadRadialTerrain({config,sourceDirectory:s,source});
 const stage=resolve('output/mars-crossing-population/context',b.id);await mkdir(stage,{recursive:true});
 const surfaces=await prepareSolidRasters({config:{...config,raster:{...config.raster,scientific:[]}},sourceDirectory:s,source,radial,publicDirectory:stage,outputDirectory:stage});
 const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mjs',inputs:[b.id+'-shape'],size:512,longitudeDegrees:0,latitudeDegrees:35,ambient:.45,diffuse:.55,lensId:'shape'};
 const png=await renderRadialSnapshot({...recipe,faces:radial.faces,map:resolve(stage,surfaces.find(x=>x.id==='shape').map.url.split('/').at(-1))});
 await writeFile(resolve(s,'presentation/context.png'),png);
 const shape=m.inputs.find(e=>e.id===b.id+'-shape');
 const generated={id:'prepared-radial-context',path:'presentation/context.png',origin:b.shapeUrl,credit:shape.credit,license:'CC-BY-4.0',consumers:['navigation'],...await pin(resolve(s,'presentation/context.png')),recipe,generator:recipe.generator};
 m.generatedIntermediates=[generated];await write(resolve(s,'manifest.json'),m);
 const navigation=await json('src/planets/dike/source/preparation/navigation.json');navigation.planetId=b.id;navigation.source={...generated};await write(resolve(s,'preparation/navigation.json'),navigation);
 const props=await json(resolve(s,'reference/model-properties.json'));props.simplification=radial.simplification;await write(resolve(s,'reference/model-properties.json'),props);
 await seal(root);console.log(b.id,radial.faces.length,'faces',radial.simplification.estimatedErrorMeters,'m estimated error');
}
