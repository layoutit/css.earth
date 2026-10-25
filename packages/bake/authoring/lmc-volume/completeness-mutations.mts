/** Bounded l21 counterfactual checks; restore every source before returning. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from './inputs.mts';import {L21} from './completeness.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];for(const m of [
{name:'Inverse probability disconnected from the light field',file:'corrected-population.mts',from:'return flux[i]/probability[i];',to:'return flux[i];'},
{name:'Returned grain amplitude is not the one measured',file:'crowding-calibrate.mts',from:'return{...best,target,trials',to:'return{...best,scale:1,target,trials'},
{name:'Magnitude-dependent selection removed',file:'completeness.mts',from:'return 1-(.5*(Math.tanh((g-g0)/slope)+1))**shape;',to:'return 1;'},
{name:'Published recovery calibration removed',file:'crowding.mts',from:'return .5*(1-Math.tanh((crowd-.13)/.07));',to:'return 1;'},
{name:'Exact RC quality selection removed',file:'rathore-calibration.mts',from:'astrometric_excess_noise<0.2',to:'astrometric_excess_noise<2'},
{name:'Frozen grain amplitudes become free during RGB grading',file:'stellar-grade.mts',from:'if(!options.freezeFractions)for(let k=0;k<2;k++)',to:'for(let k=0;k<2;k++)'},
{name:'Fixed declared RGB bounds are replaced by drifting seed-relative bounds',file:'stellar-grade.mts',from:'options.coefficientBounds?[...options.coefficientBounds]:',to:''},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'completeness.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'A removed l21 property escaped: '+m.name);checks.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}await writeFile(L21+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L21_REMOVALS_CAUGHT',checks}));
