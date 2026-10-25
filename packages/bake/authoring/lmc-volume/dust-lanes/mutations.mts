/** Removal checks exercise the actual optical transfer and measurement owner. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {ROOT,need} from '../inputs.mts';import {L26} from './measure.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'Clump attenuation is disconnected',file:'dust-lanes/opacity.mts',from:'EXTINCTION_RGB[c]*escapeRatio(clump*EXTINCTION_RGB[c])',to:'EXTINCTION_RGB[c]'},
 {name:'Prepared cloud opacity no longer reaches photons',file:'catalogue-render.mts',from:'coefficients=scene.dustLayer?.cloudExtinctionRgb',to:'coefficients=undefined'},
 {name:'Linear lane-depth decoding is removed',file:'dust-lanes/measure.mts',from:'((v+.055)/1.055)**2.4',to:'v'},
 {name:'The complete-aperture foreground bound is removed',file:'dust-lanes/geometry.mts',from:'Math.max(scale,bound)',to:'scale'},
 {name:'The opacity depends on arbitrary depth quadrature weights',file:'dust-lanes/opacity.mts',from:'tau[i+j]=total',to:'tau[i+j]=total*(j+1)/5'},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'dust-lanes/lanes.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'Removed property escaped: '+m.name);checks.push({name:m.name,caught:true,failedTests:r.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L26+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L26_REMOVALS_CAUGHT',checks}));
