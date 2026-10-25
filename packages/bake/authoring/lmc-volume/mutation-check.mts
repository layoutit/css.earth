/** Bounded deletion checks for the image round's hard properties. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LOCAL,need} from './inputs.mts';
const base=fileURLToPath(new URL('.',import.meta.url));
const mutations=[
  {name:'Native star emission removed',file:'render.mts',from:'if(model.sources.nativeStars&&has(model,5)){',to:'if(false){'},
  {name:'Gas sky-preserving depth removed',file:'model.mts',from:'const p=gasFootpoint(model,x,y,z),intrinsic=',to:'const p=[x,y,z],intrinsic='},
  {name:'Positive dust bound removed',file:'grade.mts',from:'g.dustStrength>=.25',to:'g.dustStrength>=0'},
  {name:'Independent bar RGB grade removed',file:'grade.mts',from:'grade.coefficients[1][c]',to:'1'},
  {name:'Warp removed from the field',file:'model.mts',from:'const warp=has(model,3)?at(model.sources.warp,x,y):0;',to:'const warp=0;'},
  {name:'Outskirts emission removed',file:'model.mts',from:'if(has(model,4))for',to:'if(false)for'},
  {name:'Duplicate-card normalization removed',file:'qualify-gas.mts',from:'bytes.write(`COMMENT',to:'Buffer.from(bytes).write(`COMMENT'}
];
const results=[];
for(const m of mutations){
  const path=base+m.file,original=await readFile(path,'utf8');need(original.includes(m.from),`Mutation target missing: ${m.name}`);
  try{
    await writeFile(path,original.replace(m.from,m.to));
    const r=spawnSync(process.execPath,['--test',base+'model.test.mts',base+'grade.test.mts'],{encoding:'utf8',timeout:30000});
    need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),`Mutation survived or did not execute: ${m.name}`);
    results.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(s=>s.startsWith('not ok'))});
  }finally{await writeFile(path,original);}
}
await writeFile(`${LOCAL}versions/mutation-results.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({sentinel:'ALL_SEVEN_DELETION_CHECKS_CAUGHT',results}));
