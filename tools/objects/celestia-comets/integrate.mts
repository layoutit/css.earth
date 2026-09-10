import {requireRecord,requireArray,requireString,requireFiniteNumber,hasErrorCode} from '../../source-values.mts';
import {readIntake} from './intake.mts';
const records=(value:unknown)=>requireArray(value).map(item=>requireRecord(item));
// Integrate the reviewed catalog batch into the existing single object registry.
import {readFile,writeFile} from 'node:fs/promises';
import {candidates} from './catalog.mts';
const read=async (p:string)=>requireRecord(JSON.parse(await readFile(p,'utf8'))),write=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const intake=await readIntake();
let registry=await readFile('site/objects.mts','utf8'),bodies=await readFile('packages/astronomy/src/body-data.ts','utf8'),bodyTypes=await readFile('packages/astronomy/src/body-types.ts','utf8'),generator=await readFile('packages/astronomy/tools/generate-comets.mts','utf8');
const universe=await read('src/planets/sun/source/navigation/universe.json');
const universeBodies=records(universe.bodies);universe.bodies=universeBodies;
for(const c of intake){
 const model=await read(`src/planets/${c.id}/source/shape/model.json`);
 const content=await read(`src/planets/${c.id}/source/content/object.json`),name=requireString(content.displayName),variable=c.id.replaceAll('-','')+'Descriptor';
 if(!registry.includes(`object("${c.id}",`)){
  registry=registry.replace('import comet67pDescriptor',`import ${variable} from "../src/planets/${c.id}/object.json" with { type: "json" };\nimport comet67pDescriptor`);
  registry=registry.replace('  object("comet-2p",',`  object(${JSON.stringify(c.id)}, ${JSON.stringify(name)}, "comet", "#b8b6b2", ${c.distanceAu},\n    ${JSON.stringify(`${c.designation}: ${requireString(requireRecord(content.panel).introduction)} Illustrative nucleus at Celestia’s catalog scale.`)}, packaged(${variable}), ${variable}.properties.worldFrame),\n  object("comet-2p",`);
 }
 if(!bodies.includes(`'${c.id}': body(`)){
  bodyTypes=bodyTypes.replace(/export type CometId = ([^\n]+)/,`export type CometId = $1 | '${c.id}'`);
  bodyTypes=bodyTypes.replace(/(export const COMET_IDS: readonly CometId\[\] = \[[^\n]+)(\])/ ,`$1, '${c.id}'$2`);
  bodies=bodies.replace("  'comet-2p': body",`  '${c.id}': body('${c.id}', ${JSON.stringify(c.designation+' '+name)}, '${c.command}', ${requireFiniteNumber(model.volumeEquivalentRadiusKm)}, 0, 'sun'),\n  'comet-2p': body`);
 }
 if(!generator.includes(`['${c.id}',`))generator=generator.replace(/(const bodies = \[[^\n]+)(\];)/,`$1, ['${c.id}', '${c.command}']$2`);
 if(!universeBodies.some(x=>x.id===c.id))universeBodies.push({id:c.id,name,color:'#b8b6b2'});
 for(const [path,value,end]of [['packages/astronomy/src/data/cometElements.data.ts',c.record,' satisfies Record'],['packages/astronomy/src/__fixtures__/horizons.comets.ts',c.fixture,' as const']] as const){
  const t=await readFile(path,'utf8');if(t.includes(`"${c.id}":`))continue;
  const at=t.lastIndexOf('}'+end);if(at<0)throw Error('Unknown generated record format');
  await writeFile(path,t.slice(0,at).trimEnd()+',\n  '+JSON.stringify(c.id)+': '+JSON.stringify(value,null,2)+'\n'+t.slice(at));
 }
}
await writeFile('site/objects.mts',registry);await writeFile('packages/astronomy/src/body-data.ts',bodies);await writeFile('packages/astronomy/src/body-types.ts',bodyTypes);await writeFile('packages/astronomy/tools/generate-comets.mts',generator);await write('src/planets/sun/source/navigation/universe.json',universe);
console.log('Integrated',candidates.length,'comets. Regenerate Sun source pins and navigation after preparation.');
