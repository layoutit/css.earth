/** A bounded removal audit: restore each source before trying the next property. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {ROOT,need} from '../inputs.mts';import {L25} from './ogle.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'The agreed foreground subtraction is removed',file:'dust-geometry/ogle.mts',from:'FOREGROUND=.06',to:'FOREGROUND=0'},
 {name:'Measured regional reddening no longer changes foreground fraction',file:'dust-geometry/depth.mts',from:'raw=frontAv/totalAv',to:'raw=.5'},
 {name:'Regional columns are averaged over nearest-centre assignments instead of complete measurement boxes',file:'dust-geometry/regions.mts',from:'sample.containing(p.ra,p.dec)',to:'sample.containing(p.ra,p.dec).slice(0,1)'},
 {name:'The adopted 250 pc dust width is removed',file:'dust-geometry/depth.mts',from:'DUST_SIGMA=.25',to:'DUST_SIGMA=.1'},
 {name:'The lane-location statistic ignores location',file:'dust-geometry/diagnostics.mts',from:'intersection/union',to:'1'},
 {name:'The finite dust field is disconnected from the actual renderer',file:'catalogue-render.mts',from:'...(scene.dustLayer?.clouds??[]).map(object=>({object,fineCloud:true}))',to:'...[]'},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing removal target: '+m.name);try{await writeFile(path,original.replace(m.from,m.to));const result=spawnSync(process.execPath,['--test',base+'dust-geometry/dust.test.mts'],{encoding:'utf8',timeout:30000});need(result.status!==null&&result.status>0&&/not ok/u.test(result.stdout),'A removed property escaped its behavior test: '+m.name);checks.push({name:m.name,caught:true,failedTests:result.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L25+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L25_REMOVALS_CAUGHT',checks}));
