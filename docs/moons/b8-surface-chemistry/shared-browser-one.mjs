// Reuse repository-owned browser suites, one body and one Chrome at a time.
import {dev} from 'astro';
import {spawn} from 'node:child_process';
const [mode,id] = process.argv.slice(2);
const scripts={conformance:'site/test/planet-browser-conformance.mjs',cleanliness:'site/test/dom-cleanliness-browser.mjs'};
if(!scripts[mode] || !['io','ganymede','enceladus','all'].includes(id)) throw new Error('Select conformance|cleanliness and a B8 body or all.');
const server=await dev({root:process.cwd(),server:{host:'127.0.0.1',port:4291},vite:{server:{strictPort:true}}});
try {
  const child=spawn(process.execPath,[scripts[mode],'http://127.0.0.1:4291',...(id==='all'?[]:[id])],
    {stdio:'inherit',env:{...process.env,CSSEARTH_CHROME_LOG_STDIO:'1'}});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
} finally {await server.stop();}
