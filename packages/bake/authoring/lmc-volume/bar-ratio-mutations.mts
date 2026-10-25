/** Deletion checks for the declared l18 color gate and its measurement mask. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {ROOT,LOCAL,need} from './inputs.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',results=[];
for(const m of [
 {name:'Gas and cluster exclusion removed',file:'bar-ratios.mts',from:'bar[i]&&!excluded[i]&&',to:'bar[i]&&true&&'},
 {name:'Color tolerance removed',file:'bar-ratios.mts',from:'BAR_COLOR_TOLERANCE=.02',to:'BAR_COLOR_TOLERANCE=1'},
 {name:'Whole-image RMS guard removed',file:'bar-ratios.mts',from:'MAX_RMS_REGRESSION=.01',to:'MAX_RMS_REGRESSION=1'},
 {name:'Bar color calibration removed',file:'bar-ratios.mts',from:'return{grade,prediction:best.prediction,diagnostics:',to:'return{grade:initial,prediction:gradedPrediction(basis,initial),diagnostics:'},
 {name:'Inner-disc and outskirts colors coupled',file:'catalogue-render.mts',from:'component===0&&scene.innerDiscColor?',to:'component<3&&scene.innerDiscColor?'},
]){
 const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l18 removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'bar-ratios.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'Removed l18 behavior escaped its test');results.push({name:m.name,caught:true});}finally{await writeFile(path,original);}
}
await writeFile(LOCAL+'versions/l18/removal-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L18_REMOVALS_CAUGHT',results}));
