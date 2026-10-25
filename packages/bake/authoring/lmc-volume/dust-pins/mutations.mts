/** Each owner-critical property is removed once; every source is restored afterwards. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from '../inputs.mts';import {L28} from './measure.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'G5 enters the default pin calibration',file:'dust-pins/model.mts',from:'model.filter(v=>v.calibrated)',to:'model'},
 {name:'The owner G5 exclusion is removed',file:'dust-pins/measure.mts',from:"y:214,calibrate:false",to:'y:214,calibrate:true'},
 {name:'The dust reddening grade is disconnected',file:'dust-pins/model.mts',from:'scene.dustLayer.extinctionRgb=rgb',to:'scene.dustLayer.extinctionRgb=coefficients(1)'},
 {name:'Calibration modifies the source dust density',file:'dust-pins/model.mts',from:'scene.dustLayer.strength=1.2*strength;',to:'scene.dustLayer.strength=1.2*strength;for(const v of scene.dustLayer.clouds)v.weight*=strength;'},
 {name:'Smooth stellar light ignores the global dust color',file:'catalogue-render.mts',from:'cTau*extinction[c]',to:'cTau*EXTINCTION_RGB[c]'},
 {name:'Finite light ignores the global dust color',file:'catalogue-render.mts',from:'tau*extinction[c]',to:'tau*EXTINCTION_RGB[c]'},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l28 removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'dust-pins/pins.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'Removal escaped: '+m.name);checks.push({name:m.name,caught:true,failedTests:r.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L28+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L28_REMOVALS_CAUGHT',checks}));
