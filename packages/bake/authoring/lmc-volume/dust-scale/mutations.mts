/** Removal checks target scalar application, reddening, metrics and boundary support. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from '../inputs.mts';import {L27} from './model.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',results=[];
for(const m of [
 {name:'The global optical-depth multiplier is disconnected',file:'dust-scale/model.mts',from:'baseStrength*factor',to:'baseStrength'},
 {name:'Scaling secretly changes native dust structure',file:'dust-scale/model.mts',from:'scene.dustLayer.strength=baseStrength*factor;',to:'scene.dustLayer.strength=baseStrength*factor;for(const v of scene.dustLayer.clouds??[])v.weight*=factor;'},
 {name:'The R/B lane contrast metric is replaced by no color contrast',file:'dust-scale/model.mts',from:'return v.rg/v.bg',to:'return 1'},
 {name:'The lane-overlap acceptance gate is removed',file:'dust-scale/model.mts',from:'overlap:overlap>=parentOverlap',to:'overlap:true'},
 {name:'Fractional bar-boundary support is discarded',file:'dust-scale/model.mts',from:'v>0||bar[i]',to:'bar[i]'},
 {name:'Native dust no longer attenuates real photons',file:'catalogue-render.mts',from:'fine*(scene.dustLayer?.strength??1)',to:'0*fine*(scene.dustLayer?.strength??1)'},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing mutation target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'dust-scale/scale.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'Removal escaped: '+m.name);results.push({name:m.name,caught:true,failedTests:r.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L27+'removal-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L27_REMOVALS_CAUGHT',results}));
