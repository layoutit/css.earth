// Isolated dependency cache and no HMR during frozen-byte evidence capture.
import {dev} from 'astro';
import {spawn} from 'node:child_process';
const ids = process.argv.slice(2);
if(ids.length !== 1) throw new Error('Run exactly one body per invocation.');
const server = await dev({root:process.cwd(), server:{host:'127.0.0.1',port:4292}, vite:{cacheDir:'.astro/b10-vite-cache',server:{strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/docs/**']}}}});
let child;
try {
  child=spawn(process.execPath,[process.env.B10_CLEANLINESS ? 'site/test/dom-cleanliness-browser.mjs' : 'site/test/planet-browser-conformance.mjs','http://127.0.0.1:4292',ids[0]],
    {stdio:'inherit',env:{...process.env,CSSEARTH_CHROME_LOG_STDIO:'1'}});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',(code)=>resolve(code??1));child.once('error',reject);});
}finally{await server.stop();}
