/** Bounded property-removal checks. Every file is restored before the next check. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from './inputs.mts';import {L22} from './contrast-density.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'The finer core is removed from the renderer field',file:'contrast-density.mts',from:'map.values[i]=w*fine.values[i]+(1-w)*at(parent,px,py);',to:'map.values[i]=at(parent,px,py);'},
 {name:'Grain is left at the full parent amplitude',file:'contrast-density.mts',from:'population.oldFraction=parentFractions[0]/3;',to:'population.oldFraction=parentFractions[0];'},
 {name:'Finite fine clouds never reach optical attenuation',file:'catalogue-render.mts',from:'...(scene.dustLayer?.clouds??[]).map(object=>({object,fineCloud:true}))',to:'...[]'},
 {name:'Clouds become long depth columns',file:'contrast-dust.mts',from:'axes:[radius,radius,radius]',to:'axes:[radius,radius,radius*100]'},
 {name:'The physical Bell normalization is disconnected',file:'contrast-dust.mts',from:'const factor=measured/model;',to:'const factor=1;'},
 {name:'Global contrast grading loses the accepted outer light',file:'contrast-grade.mts',from:'score=4*Math.max(0,Math.abs(Math.log(Math.max(1e-12,outerRatio)))-Math.log(1.075))**2+',to:'score='},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing removal target');try{await writeFile(path,original.replace(m.from,m.to));const result=spawnSync(process.execPath,['--test',base+'contrast.test.mts'],{encoding:'utf8',timeout:30000});need(result.status!==null&&result.status>0&&/not ok/u.test(result.stdout),'A removed l22 property escaped: '+m.name);checks.push({name:m.name,caught:true,failingTests:result.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L22+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L22_REMOVALS_CAUGHT',checks}));
