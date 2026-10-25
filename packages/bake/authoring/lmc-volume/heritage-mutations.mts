/** Bounded removal checks; every original source is restored before exit. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {ROOT,LOCAL,need} from './inputs.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',results=[];
for(const m of [
 {name:'HERITAGE column disconnected from the renderer',file:'catalogue-render.mts',from:'scene.dustLayer?at(scene.dustLayer.column,p[0],p[1])*scene.dustLayer.strength:',to:'false?0:'},
 {name:'Positive bounded dust strength removed',file:'catalogue-render.mts',from:'scene.dustLayer.strength>=.25',to:'scene.dustLayer.strength>=0'},
 {name:'Density logarithm used as linear mass',file:'heritage-layer.mts',from:'mass+=10**log*w;',to:'mass+=log*w;'},
 {name:'Crop ignores inherited display calibration',file:'observation.mts',from:'const sky = displayReference?[...displayReference.sky]:',to:'const sky = false?[]:'},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l19 removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'heritage.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'A removed dust behavior escaped its test');results.push({name:m.name,caught:true});}finally{await writeFile(path,original);}}
await writeFile(LOCAL+'versions/l19/removal-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L19_REMOVALS_CAUGHT',results}));
