import {dev} from 'astro';
import {spawn} from 'node:child_process';
const ids = process.argv.slice(2);
if(ids.length !== 1) throw new Error('Run exactly one body per invocation.');
const server = await dev({root:process.cwd(), server:{host:'127.0.0.1',port:4291}, vite:{server:{strictPort:true}}});
let child;
try {
  child=spawn(process.execPath,['docs/moons/b3-preparation/capture-b3-integrated.mjs','http://127.0.0.1:4291',ids[0]],
    {stdio:'inherit',env:{...process.env,CSSEARTH_CHROME_LOG_STDIO:'1'}});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',(code)=>resolve(code??1));child.once('error',reject);});
}finally{await server.stop();}
