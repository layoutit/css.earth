/** Removal checks for the finer member map and finite association luminosity control. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ROOT,LOCAL,need} from './inputs.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',path=base+'blue-structure.mts',results=[];
for(const m of [
 {name:'Finer Gaia smoothing removed',from:'BLUE_SMOOTHING_KPC=.1',to:'BLUE_SMOOTHING_KPC=.2'},
 {name:'Bica association luminosity control removed',from:'if(youngAssociation(scene.owners[i]))amplitudes[i]*=gains[1];',to:'if(false)amplitudes[i]*=gains[1];'},
 {name:'Gaia luminosity control removed',from:'scene.youngTint.map(v=>v*gains[0])',to:'scene.youngTint.map(v=>v)'},
]){
 const original=await readFile(path,'utf8');need(original.includes(m.from),'Missing blue removal target');try{await writeFile(path,original.replace(m.from,m.to));const run=spawnSync(process.execPath,['--test',base+'blue-structure.test.mts'],{encoding:'utf8',timeout:30000});need(run.status!==null&&run.status>0&&/not ok/u.test(run.stdout),'A removed blue behavior escaped its test');results.push({name:m.name,caught:true});}finally{await writeFile(path,original);}
}
await writeFile(LOCAL+'versions/l17/removal-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'BLUE_STRUCTURE_REMOVALS_CAUGHT',results}));
