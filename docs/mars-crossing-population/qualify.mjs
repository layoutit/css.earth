import {spawn} from 'node:child_process';
import {readFile,open,mkdir} from 'node:fs/promises';
const scripts='docs/mars-crossing-population',output='output/mars-crossing-population';
const bodies=JSON.parse(await readFile(`${scripts}/inputs.json`));
const selected=process.argv.slice(2);
const ids=selected.length?selected:bodies.map(body=>body.id);
if(ids.some(id=>!bodies.some(body=>body.id===id)))throw new Error('Unknown selected Mars-crossing body');
async function run(command,args,path){
 const fd=await open(path,'w');
 try{await new Promise((accept,reject)=>{
  const child=spawn(command,args,{stdio:['ignore',fd.fd,fd.fd],env:process.env});
  child.once('error',reject);child.once('close',code=>code===0?accept():reject(new Error(`${command} failed with ${code}; see ${path}`)));
 });}finally{await fd.close()}
}
for(const id of ids){
 const out=`${output}/${id}`;await mkdir(out,{recursive:true});
 await run(process.execPath,['--test',`tests/objects/unit/${id}/source.test.mjs`],`${out}/unit.log`);
 for(const script of ['scalar-queries.mjs','verify-scalar.py','atlas-anchors.py','compare-scalars.mjs','surface-fit.mjs','source-comparison.mjs']){
  await run(script.endsWith('.py')?(process.env.CSSEARTH_PYTHON??'python3'):process.execPath,[`${scripts}/${script}`,id],`${out}/${script}.log`);
 }
 console.log(id,'source topology, independent scalar, decoded atlas, sampled surface fit and shape comparisons completed');
}
