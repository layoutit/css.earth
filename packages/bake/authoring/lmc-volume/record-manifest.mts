/** Bind generated research records without migrating the pre-existing volume manifest. */
import { readFile,writeFile,stat } from 'node:fs/promises';
import { ROOT,rec,array,need } from './inputs.mts';
const source='src/objects/lmc-volume/source/',path=`${ROOT}${source}manifest.json`;
const manifest=rec(JSON.parse(await readFile(path,'utf8'))),generated=array(manifest.generatedIntermediates);
const prior=generated.filter(v=>{const p=rec(v).path;return typeof p!=='string'||!p.startsWith(`${source}preparation/l`);});
const additions=[];
const maximum=Number(process.argv[2]??34);need(Number.isSafeInteger(maximum)&&maximum>=28&&maximum<=35,'Invalid research-record limit');
for(let version=1;version<=maximum;version++)for(const name of ['recipe','fit','lineage','provenance','frame','field']){
  const recordPath=`${source}preparation/l${version}/${name}.json`,bytes=(await stat(`${ROOT}${recordPath}`)).size;
  need(bytes>0,'Empty research record');
  additions.push({id:`l${version}-${name}-pilot`,path:recordPath,bytes,generator:`packages/bake/authoring/lmc-volume/${version>=29?'owner-rounds/render':version===28?'dust-pins/render':version===27?'dust-scale/render':version===26?'dust-lanes/run':version===25?'dust-geometry/run':version===24?'dust-native/run':version===23?'mcps/run':version===22?'contrast-run':version===21?'crowding-run':version===20?'stellar-run':version===19?'heritage-run':version===18?'bar-ratio-run':version>=15?'sequence-run':version>=11?'catalogue-run':version>=9?'depth-run':version===8?'photo-run':version>=5&&name!=='frame'?'grade-run':'run'}.mts`,sourceBinding:{kind:'local',reason:version>=29?'Physical-model experiment. Tiny/small reference renders only. Individual version records state the owner and experiment decisions. No runtime delivery is implied.':'Unaccepted physical-model experiment. Tiny/small calibration and reference renders only. No runtime delivery or scientific acceptance is implied.'}});
}
manifest.generatedIntermediates=[...prior,...additions];
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sentinel:'LMC_RESEARCH_RECORDS_BOUND',records:additions.length,schema:manifest.schema,existingSchemaPreserved:true}));
