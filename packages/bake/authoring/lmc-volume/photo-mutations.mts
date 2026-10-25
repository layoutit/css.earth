/** Bounded mutation checks for the l8 conversion and its real renderer path. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LOCAL,need} from './inputs.mts';
const base=fileURLToPath(new URL('.',import.meta.url)),mutations=[
 {name:'Remove photo-field renderer dispatch',file:'model.mts',from:'if(model.sampleField){model.sampleField(x,y,z,out);return;}',to:''},
 {name:'Restore observer-ray texture extrusion',file:'photo-model.mts',from:'const p:V3=[x,y,at(sources.warp,x,y)]',to:'const p:V3=photoFootpoint(sources.warp,x,y,z)'},
 {name:'Erase the thin young and gas distinction',file:'photo-convert.mts',from:'young:.1,gas:.1',to:'young:HEIGHT_DISC,gas:HEIGHT_DISC'},
 {name:'Remove Bell column normalization',file:'photo-model.mts',from:'dustScale=measured/proxy',to:'dustScale=1'},
 {name:'Remove exterior paper profile',file:'photo-model.mts',from:'+(1-w)*(k===0?priorD:k===1?priorB:0)',to:'+0'},
 {name:'Remove spectral inverse',file:'photo-convert.mts',from:'const solved=solve3(columns,rgb)',to:'const solved:V3=[0,0,0]'}
 ,{name:'Remove global gas-color assignment',file:'photo-convert.mts',from:'colors[2]=gasColor;',to:''}
],results=[];
for(const m of mutations){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),`Missing mutation target ${m.name}`);
 try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'photo.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),`Mutation survived or did not execute: ${m.name}`);results.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(s=>s.startsWith('not ok'))});}
 finally{await writeFile(path,original);}
}
await writeFile(`${LOCAL}versions/l8/mutations.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L8_ALL_MUTATIONS_CAUGHT',results}));
