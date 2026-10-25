/** Each removed l24 property must fail a behavior test. Sources are restored after every case. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {ROOT,need} from '../inputs.mts';import {L24} from './field.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',checks=[];
for(const m of [
 {name:'The published optical conversion is removed',file:'dust-native/field.mts',from:'AV_PER_SIGMA=7.394',to:'AV_PER_SIGMA=.7394'},
 {name:'The one broad Bell calibration is disconnected',file:'dust-native/field.mts',from:'factor:a/b',to:'factor:1'},
 {name:'Native finite cells lose their exact cloud chords',file:'catalogue-volume.mts',from:"if(v.kind==='dust-tent')return tentChord(v,origin,direction);",to:"if(v.kind==='dust-tent')return null;"},
 {name:'Fine dust never reaches the real renderer',file:'catalogue-render.mts',from:'...(scene.dustLayer?.clouds??[]).map(object=>({object,fineCloud:true}))',to:'...[]'},
 {name:'Dense bar dust loses its near-side placement',file:'dust-native/field.mts',from:'return .3*inside*smoothstep',to:'return 0*inside*smoothstep'},
 {name:'Adjacent native cells receive unrelated depths',file:'dust-native/field.mts',from:'values=blur(raw,512,512,.1/cell)',to:'values=raw'},
 {name:'Saved volume loading rejects the native dust cells',file:'frozen-l12.mts',from:"||kind==='dust-tent'",to:''},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l24 removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'dust-native/dust.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'A removed dust property escaped: '+m.name);checks.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(v=>v.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L24+'removal-checks.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sentinel:'L24_REMOVALS_CAUGHT',checks}));
