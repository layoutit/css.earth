import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import type { Page, CDPSession } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';
const directory='output/playwright/native-resize/matched-input'; await mkdir(directory,{recursive:true});
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function gesture(cdp:CDPSession,x:number,y:number,points:readonly (readonly[number,number])[],paced=false){
 const pending=[cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1})];
 let lastX=x,lastY=y;
 for(const [dx,dy] of points){const nextX=x+dx,nextY=y+dy,startX=lastX,startY=lastY;
  for(let i=1;i<=72;i++){pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:startX+(nextX-startX)*i/72,y:startY+(nextY-startY)*i/72,button:'left',buttons:1}));if(paced)await pause(16);}
  lastX=nextX;lastY=nextY;
 }
 pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:lastX,y:lastY,button:'left',buttons:0,clickCount:1})); await Promise.all(pending);
}
const size=(page:Page)=>page.locator('.resizable').evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(document.body);return{x:r.x,y:r.y,width:r.width,height:r.height,style:node.getAttribute('style'),cssWidth:Number(s.getPropertyValue('--box-width')),cssHeight:Number(s.getPropertyValue('--box-height')),yaw:Number(s.getPropertyValue('--yaw')),pitch:Number(s.getPropertyValue('--pitch')),transform:getComputedStyle(document.querySelector('.cube')!).transform,scrollX:document.querySelector('.controls')!.scrollLeft,scrollY:document.querySelector('.controls')!.scrollTop};});
async function trace(page:Page,cdp:CDPSession,name:string,x:number,y:number){
 await cdp.send('Tracing.start',{traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:131072,excludedCategories:['*'],includedCategories:['devtools.timeline','blink.user_timing','toplevel','cc','viz','gpu','input','latencyInfo','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame','disabled-by-default-v8.cpu_profiler']},transferMode:'ReturnAsStream'});
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:drag-start`});
 await gesture(cdp,x,y,[[100,60],[-60,-60],[80,40]],true);
 await cdp.send('Tracing.recordClockSyncMarker',{syncId:`${name}:drag-end`}); await pause(250);
 const complete=new Promise<{stream?:string;dataLossOccurred?:boolean}>(resolve=>cdp.once('Tracing.tracingComplete',resolve));
 await cdp.send('Tracing.end'); const result=await complete; if(!result.stream)throw Error('Trace stream missing');assert.equal(result.dataLossOccurred,false);
 const buffers:Buffer[]=[];for(;;){const chunk=await cdp.send('IO.read',{handle:result.stream});buffers.push(Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8'));if(chunk.eof)break;}
 await cdp.send('IO.close',{handle:result.stream}); const bytes=gzipSync(Buffer.concat(buffers));await writeFile(`${directory}/${name}.json.gz`,bytes);
 console.log('TRACE',name,bytes.length);await page.screenshot({path:`${directory}/${name}-after.png`});return {file:`${name}.json.gz`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),dataLoss:result.dataLossOccurred};
}
const browser=await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
const results:unknown[]=[];
try{for(let trial=1;trial<=3;trial++)for(const mode of trial%2?['native','size','strict','js']:['js','strict','size','native']){
 const context=await browser.newContext({javaScriptEnabled:mode==='js',viewport:{width:1280,height:900},deviceScaleFactor:1});const page=await context.newPage();const cdp=await context.newCDPSession(page);
 await page.goto(`http://127.0.0.1:4351/${mode==='js'?'?input=js':mode==='native'?'':`?contain=${mode}`}`);if(mode==='js')await page.waitForFunction(()=>document.documentElement.dataset.inputReady==='true');await pause(300);
 const bounds=await page.locator('.controls').boundingBox();if(!bounds)throw Error('Input surface missing');const x=bounds.x+150,y=bounds.y+150;
 await page.mouse.move(x,y);await gesture(cdp,x,y,[[20,10],[0,0]]);await pause(300);
 const before=await size(page);assert.ok(Math.abs(before.cssWidth-1200)<.01);assert.ok(Math.abs(before.cssHeight-1200)<.01);
 const captured=await trace(page,cdp,`${mode}-${trial}`,x,y);const after=await size(page);
 assert.ok(Math.abs(after.cssWidth-1280)<.01);assert.ok(Math.abs(after.cssHeight-1240)<.01);assert.ok(Math.abs(after.yaw-120)<.01);assert.ok(Math.abs(after.pitch-25)<.01);
 results.push({mode,trial,browser:browser.version(),before,after,trace:captured});await context.close();console.log('PASS',mode,trial);
}}finally{await browser.close();await writeFile(`${directory}/comparison.json`,JSON.stringify({description:'Identical orientation indicator, viewport, DPR, angle mapping, input path and warm-up. Three interleaved trials each, including size and strict containment. Full Saturn performance is not measured by this comparison.',results},null,2));}
