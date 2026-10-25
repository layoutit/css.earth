/** Bounded deletion checks for the one-change bar stages. Originals are always restored. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ROOT,LOCAL,need} from './inputs.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/';
const mutations=[
 {name:'Measured bar projection removed',file:'bar-geometry.mts',from:'const result=at((lo+hi)/2);',to:'const result=legacyBar(sigmaZ);',test:'bar-geometry.test.mts'},
 {name:'SFH population color removed',file:'bar-population.mts',from:'const color:V3=[sums[2]/sums[1],1,sums[0]/sums[1]];',to:'const color:V3=[1,1,1];',test:'bar-population.test.mts'},
 {name:'Independent bar color calibration removed',file:'bar-color.mts',from:'return{grade,prediction,diagnostics:',to:'return{grade:initial,prediction:gradedPrediction(basis,initial),diagnostics:',test:'bar-population.test.mts'},
];
const results=[];
for(const m of mutations){
 const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing deletion target');
 try{await writeFile(path,original.replace(m.from,m.to));const run=spawnSync(process.execPath,['--test',base+m.test],{encoding:'utf8',timeout:30000});need(run.status!==null&&run.status>0&&/not ok/u.test(run.stdout),'Removed behavior escaped its test');results.push({name:m.name,caught:true});}
 finally{await writeFile(path,original);}
}
await mkdir(LOCAL+'versions/l16/',{recursive:true});await writeFile(LOCAL+'versions/l16/removal-checks.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({sentinel:'BAR_STAGE_REMOVALS_CAUGHT',results}));
