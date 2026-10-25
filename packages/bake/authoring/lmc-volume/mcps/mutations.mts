/** Removal checks for the new measured-color path; all edited files are restored. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from '../inputs.mts';import {L23} from './input.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'Native catalogue hours are mistaken for degrees',file:'mcps/input.mts',from:'mcpsStar(n(1,8)*15,',to:'mcpsStar(n(1,8),'},
 {name:'Missing catalogue magnitudes become real zero magnitudes',file:'mcps/input.mts',from:'.map(v=>v===0?null:v)',to:'.map(v=>v)'},
 {name:'Vega band zero points are ignored',file:'mcps/photometry.mts',from:'[1438.73,4323.91,3617.50,2452.02]',to:'[1,1,1,1]'},
 {name:'The missing-light correction is removed',file:'mcps/photometry.mts',from:'return resolved.map((x,c)=>x+v*color[c]/color[1]);',to:'return [...resolved];'},
 {name:'Measured regional colors never reach the real renderer',file:'catalogue-render.mts',from:'*materialFactor(scene.photometryMaterial,component,c,p[0],p[1])',to:''},
 {name:'Frozen-parent replay loses the measured field',file:'sequence-state.mts',from:'scene.photometryMaterial=await loadMaterial(versionDir(cfg.photometryVersion))',to:'scene.photometryMaterial=undefined'},
 {name:'Regional colors disappear from the global calibration objective',file:'stellar-grade.mts',from:'...regionalColorResiduals(prediction,sky,options.regionalColors??[]),',to:''},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l23 removal target');try{await writeFile(path,original.replace(m.from,m.to));const result=spawnSync(process.execPath,['--test',base+'mcps/photometry.test.mts'],{encoding:'utf8',timeout:30000});need(result.status!==null&&result.status>0&&/not ok/u.test(result.stdout),'A removed l23 property escaped: '+m.name);checks.push({name:m.name,caught:true,failingTests:result.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L23+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L23_REMOVALS_CAUGHT',checks}));
