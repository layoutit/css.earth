import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import type { Page, CDPSession } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';
const directory='output/playwright/native-resize'; await mkdir(directory,{recursive:true});
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
const results:Record<string,unknown>={browser:browser.version(),viewport:{width:1280,height:900},dpr:1,htmlSha256:createHash('sha256').update(await readFile(new URL('../../../tools/experiments/native-resize/index.html',import.meta.url))).digest('hex')};
try{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900},deviceScaleFactor:1});const page=await context.newPage();const cdp=await context.newCDPSession(page);
 await page.goto('http://127.0.0.1:4351/');await pause(300);const initial=await size(page);assert.equal(initial.width,1200);assert.ok(Math.abs(initial.cssWidth-1200)<.01);
 const bounds=await page.locator('.controls').boundingBox();if(!bounds)throw Error('Drag area missing');
 const samples=[];let width=1200,height=1200;
 for(const [x,y,dx,dy]of [[10,10,1,1],[150,150,30,20],[290,10,-20,30],[10,290,40,-10],[290,290,-30,-40]]){
  await gesture(cdp,bounds.x+x,bounds.y+y,[[dx,dy]]);await pause(100);width+=dx;height+=dy;const value=await size(page);
  assert.equal(value.width,width);assert.equal(value.height,height);assert.ok(Math.abs(value.cssWidth-width)<.01);assert.ok(Math.abs(value.cssHeight-height)<.01);samples.push({start:[x,y],delta:[dx,dy],state:value});
 }
 await page.mouse.move(1200,800);await pause(500);assert.equal((await size(page)).width,width);await page.screenshot({path:`${directory}/area-before.png`});
 const recorded=await trace(page,cdp,'native-area-rotation',bounds.x+150,bounds.y+150);results.desktop={initial,samples,trace:recorded,after:await size(page)};await context.close();
 const phone=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mobile=await phone.newPage();await mobile.goto('http://127.0.0.1:4351/');await pause(300);const touchInitial=await size(mobile),area=await mobile.locator('.controls').boundingBox();if(!area)throw Error('Touch area missing');
 const session=await phone.newCDPSession(mobile),x=area.x+60,y=area.y+60;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60*i/12,y:y+40*i/12}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(300);results.touch={initial:touchInitial,after:await size(mobile)};await mobile.screenshot({path:`${directory}/area-phone.png`});await phone.close();
}finally{await browser.close();await writeFile(`${directory}/area-study.json`,JSON.stringify(results,null,2));}
const safari=await webkit.launch({headless:true});try{const page=await safari.newPage({javaScriptEnabled:false,viewport:{width:1280,height:900}});await page.goto('http://127.0.0.1:4351/');await pause(300);const initial=await size(page),area=await page.locator('.controls').boundingBox();if(!area)throw Error('WebKit drag area missing');
 await page.mouse.move(area.x+60,area.y+60);await page.mouse.down();await page.mouse.move(area.x+120,area.y+100,{steps:12});await page.mouse.up();await pause(300);results.webkit={version:safari.version(),initial,after:await size(page)};await page.screenshot({path:`${directory}/area-webkit.png`});
}finally{await safari.close();await writeFile(`${directory}/area-study.json`,JSON.stringify(results,null,2));}
console.log('Area drag: five starting points and single-pixel precision passed. Touch and WebKit results saved.');
