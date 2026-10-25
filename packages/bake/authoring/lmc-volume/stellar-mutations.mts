/** Removal checks for l20. Sources are restored even when a check fails. */
import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {ROOT,need} from './inputs.mts';import {L20} from './gaia-old.mts';
const base=ROOT+'packages/bake/authoring/lmc-volume/',results=[];
for(const m of [
 {name:'Measured old density disconnected',file:'catalogue-render.mts',from:'if(scene.oldPopulation){values[0]=',to:'if(false){values[0]='},
 {name:'Resolved Gaia points disconnected',file:'catalogue-render.mts',from:'if(scene.oldPopulation){need(camera.pixelOf',to:'if(false){need(camera.pixelOf'},
 {name:'Individual Gaia colors removed',file:'gaia-old-model.mts',from:'return[10**(-.4*(abR-abG)),1,10**(-.4*(abB-abG))]',to:'return[1,1,1]'},
 {name:'Conserved smooth-light fraction removed',file:'catalogue-render.mts',from:'planes[k][i]*(1-scene.oldPopulation.oldFraction)',to:'planes[k][i]'},
 {name:'Molecular ovals remain despite layer replacement',file:'catalogue-render.mts',from:'if(scene.dustLayer&&!scene.dustLayer.retainMolecular)return screens;',to:''},
 {name:'Adopted height is ignored',file:'gaia-plane.mts',from:'return(ra:number,dec:number,height=0,sigma=.15):V3=>{',to:'return(ra:number,dec:number,ignoredHeight=0,sigma=.15):V3=>{const height=0;'},
 {name:'Discarded point-buffer tail is serialized',file:'gaia-old-model.mts',from:'Buffer.from(points.positions.buffer,points.positions.byteOffset,points.positions.byteLength)',to:'Buffer.from(points.positions.buffer)'},
 {name:'Measured luminosity weights are ignored',file:'gaia-density.mts',from:'counts[yy*n+xx]+=weight*',to:'counts[yy*n+xx]+='},
]){const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),'Missing l20 removal target');try{await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'stellar.test.mts',base+'heritage.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),'A removed l20 property escaped its test: '+m.name);results.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(s=>s.startsWith('not ok'))});}finally{await writeFile(path,original);}}
await writeFile(L20+'removal-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L20_REMOVALS_CAUGHT',results}));
