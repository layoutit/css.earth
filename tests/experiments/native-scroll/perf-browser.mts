import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';
import { parseHTML } from 'linkedom';
import { chromium } from 'playwright';
import type { CDPSession } from 'playwright';
import sharp from 'sharp';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';
const directory='output/playwright/native-drag/perf-final';await mkdir(directory,{recursive:true});
const origin='http://127.0.0.1:4352',url=`${origin}/saturn/?drag=resize`;
const html=await (await fetch(url)).text();
const script=(await transform(await readFile(new URL('../../../tools/experiments/native-scroll/input-enhancement.mts',import.meta.url),'utf8'),{loader:'ts',format:'iife',target:'es2022'})).code;
await writeFile(`${directory}/page.html`,html);await writeFile(`${directory}/input.js`,script);
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function drag(cdp:CDPSession,points:readonly (readonly[number,number])[],steps:number){
 const x=800,y=250,pending=[cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1})];
 let dx=0,dy=0;
 for(const [toX,toY] of points){const fromX=dx,fromY=dy;
  for(let i=1;i<=steps;i++){
   pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+Math.round(fromX+(toX-fromX)*i/steps),y:y+Math.round(fromY+(toY-fromY)*i/steps),button:'left',buttons:1}));await pause(16);
  }dx=toX;dy=toY;
 }
 await pause(180);pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1}));await Promise.all(pending);
}
const browser=await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
const results:unknown[]=[];
const references=new Map<string,Buffer>();
try{for(let trial=1;trial<=3;trial++)for(const mode of trial%2?['native','js','solar']:['solar','js','native']){
 const context=await browser.newContext({javaScriptEnabled:mode==='js',viewport:{width:1280,height:900},deviceScaleFactor:1});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);
 const requests:string[]=[];page.on('request',request=>{if(request.url().includes('stream-row'))requests.push(request.url());});
 const {document}=parseHTML(html);
 for(const script of document.querySelectorAll('script:not([type="application/json"])'))script.remove();
 for(const preload of document.querySelectorAll('link[rel="modulepreload"]'))preload.remove();
 for(const meta of document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'))meta.remove();
 if(mode==='js'){
  const style=document.createElement('style');style.textContent='.planet-viewport{animation:native-scroll-distance linear both;animation-timeline:--native-zoom}.native-drag-sensor{resize:none;pointer-events:none}';document.head.append(style);
  const tag=document.createElement('script');tag.src='/native-input-enhancement.js';document.body.append(tag);
 }
 await page.route(url,route=>route.fulfill({body:document.toString(),contentType:'text/html',headers:{'content-security-policy':mode==='js'?"script-src 'self'":"script-src 'none'"}}));
 await page.route(`${origin}/native-input-enhancement.js`,route=>route.fulfill({body:script,contentType:'text/javascript'}));
 await page.goto(url);await page.waitForLoadState('networkidle');
 if(mode==='solar'){await page.mouse.move(800,250);await page.mouse.wheel(0,4000);await pause(500);assert.equal(await page.locator('.planet-input-surface').evaluate(el=>el.scrollTop),4000);}
 if(mode==='js')assert.equal(await page.locator('html').getAttribute('data-native-input-ready'),'true');
 await drag(cdp,[[100,60],[-60,-60],[80,40],[0,0]],12);await pause(300);await page.waitForLoadState('networkidle');
 const read=()=>page.locator('.planet-viewport').evaluate(el=>{const s=getComputedStyle(el);return{x:Number(s.getPropertyValue('--native-drag-x')),y:Number(s.getPropertyValue('--native-drag-y')),log:Number(s.getPropertyValue('--native-log-distance')),scene:getComputedStyle(el.querySelector('.polycss-scene')!).transform,nodes:el.querySelectorAll('[data-prepared-node]').length,activeOrbitChords:[...el.querySelectorAll('.native-orbit-segment')].filter(n=>n.getClientRects().length>0).length};});
 const before=await read();assert.ok(Math.abs(before.x)<.1&&Math.abs(before.y)<.1);
 const name=`${mode}-${trial}`;
 await cdp.send('Tracing.start',{traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:131072,excludedCategories:['*'],includedCategories:['devtools.timeline','blink.user_timing','toplevel','cc','viz','gpu','input','latencyInfo','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame']},transferMode:'ReturnAsStream'});
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:drag-start`});
 await drag(cdp,[[100,60],[-60,-60],[80,40]],72);
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:drag-end`});await pause(300);
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:idle-start`});await pause(1500);
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:idle-end`});
 const complete=new Promise<{stream?:string;dataLossOccurred?:boolean}>(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const done=await complete;
 assert.equal(done.dataLossOccurred,false);if(!done.stream)throw new Error('Missing trace stream.');
 const chunks:Buffer[]=[];for(;;){const part=await cdp.send('IO.read',{handle:done.stream});chunks.push(Buffer.from(part.data,part.base64Encoded?'base64':'utf8'));if(part.eof)break;}
 await cdp.send('IO.close',{handle:done.stream});const bytes=gzipSync(Buffer.concat(chunks));await writeFile(`${directory}/${name}.json.gz`,bytes);
 const after=await read();assert.equal(after.nodes,972);assert.ok(Math.abs(after.x-80)<.1&&Math.abs(after.y-40)<.1);
 const screenshot=`${directory}/${name}.png`;await page.screenshot({path:screenshot});const pixels=await sharp(screenshot).removeAlpha().raw().toBuffer();
 const key=mode==='solar'?'solar':'near',reference=references.get(key);
 let mean=0;if(reference){assert.equal(pixels.length,reference.length);for(let i=0;i<pixels.length;i++)mean+=Math.abs(pixels[i]-reference[i]);mean/=pixels.length;assert.ok(mean<.1,`Mismatched scene: ${mode} ${mean}`);}else references.set(key,pixels);
 results.push({mode,trial,before,after,meanPixelDifference:mean,materialRowsRequested:new Set(requests).size,trace:{file:`${name}.json.gz`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
 await context.close();console.log('PASS',mode,trial,'image difference',mean,'rows',new Set(requests).size);
}}finally{await browser.close();await writeFile(`${directory}/comparison.json`,JSON.stringify({browser:browser.version(),htmlSha256:createHash('sha256').update(html).digest('hex'),inputSha256:createHash('sha256').update(script).digest('hex'),scope:'Same complete CSS camera and scene, native versus JS pointer input near Saturn; a separate native-input Solar System scenario. This does not compare against the full enhanced application renderer.',results},null,2));}
