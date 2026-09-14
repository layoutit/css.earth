import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { chromium, webkit } from 'playwright';
import type { CDPSession, Page } from 'playwright';
import sharp from 'sharp';
import { parseSharedView, formatSharedView } from '../../../src/renderers/css/navigation/view-url.js';
import { multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4, serializePreparedMatrix4 } from '../../../src/renderers/css/solar-system/prepared-ellipsoid-projection.js';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';

const engine=process.argv[2]??'chromium';
if(engine!=='chromium'&&engine!=='webkit') throw new TypeError('Choose chromium or webkit.');
const capturedReference=process.argv[3];
const origin='http://127.0.0.1:4352',directory=`output/playwright/native-drag/camera-${engine}-${capturedReference?'captured':'numeric'}`;
await mkdir(directory,{recursive:true});
const {document}=parseHTML(await (await fetch(`${origin}/saturn/?drag=resize`)).text());
const token=document.querySelector<HTMLElement>('.planet-stage')?.dataset.preparedView;
if(!token) throw new TypeError('Missing prepared initial camera.');
const initial=parseSharedView(new URLSearchParams({v:token}).toString());
if(!initial || initial.camera.pose.schema!=='cssearth-camera-pose@2') throw new TypeError('Missing physical initial camera.');
const base=readPreparedMatrix4(initial.camera.pose.scene);
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function drag(page:Page,cdp:CDPSession|undefined,x:number,y:number,dx:number,dy:number){
 await page.mouse.move(x,y);
 const pending=[cdp?cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1}):page.mouse.down()];
 for(let i=1;i<=24;i++){
  pending.push(cdp?cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/24,y:y+dy*i/24,button:'left',buttons:1}):page.mouse.move(x+dx*i/24,y+dy*i/24));await pause(16);
 }
 pending.push(cdp?cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1}):page.mouse.up());await Promise.all(pending);
}
const browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
const results:unknown[]=[];
let referenceHtmlSha256:string|null=null;
try{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900},deviceScaleFactor:1});
 const native=await context.newPage(),reference=await context.newPage();const cdp=engine==='chromium'?await context.newCDPSession(native):undefined;
 const referenceCdp=engine==='chromium'&&capturedReference?await context.newCDPSession(reference):undefined;
 if(capturedReference){
  const body=await readFile(capturedReference,'utf8');
  referenceHtmlSha256=createHash('sha256').update(body).digest('hex');
  await reference.route(`${origin}/captured-reference`,route=>route.fulfill({body,contentType:'text/html',headers:{'content-security-policy':"script-src 'none'"}}));
  await reference.goto(`${origin}/captured-reference`);await reference.waitForLoadState('networkidle');
 }
 await native.goto(`${origin}/saturn/?drag=resize`);await native.waitForLoadState('networkidle');
 const errors:string[]=[];native.on('pageerror',e=>errors.push(e.message));
 for(const [name,dx,dy,wheel] of [['initial',0,0,0],['turn-right',120,60,0],['turn-left',-240,-120,0],['level',220,200,0],['past-pole',0,350,0],['inverted',0,350,0],['zoomed',0,0,700],['solar-system',0,0,2900],['solar-turn',-240,180,0]] as const){
  if(dx||dy) await drag(native,cdp,name==='solar-turn'?800:640,name==='solar-turn'?250:450,dx,dy);
  if(wheel){await native.mouse.move(640,450);await native.mouse.wheel(0,wheel);}
  if(capturedReference){
   if(dx||dy)await drag(reference,referenceCdp,name==='solar-turn'?800:640,name==='solar-turn'?250:450,dx,dy);
   if(wheel){await reference.mouse.move(640,450);await reference.mouse.wheel(0,wheel);}
  }
  await pause(500);await native.waitForLoadState('networkidle');
  const state=await native.locator('.planet-viewport').evaluate(el=>{
   const style=getComputedStyle(el),scene=el.querySelector<HTMLElement>('.polycss-scene')!,material=el.querySelector<HTMLElement>('[data-prepared-node="970"]')!;
   return {x:Number(style.getPropertyValue('--native-drag-x')),y:Number(style.getPropertyValue('--native-drag-y')),log:Number(style.getPropertyValue('--native-log-distance')),
    scene:getComputedStyle(scene).transform,material:getComputedStyle(material).transform,background:getComputedStyle(material).backgroundPosition,
    materialImage:getComputedStyle(material).backgroundImage,nodes:el.querySelectorAll('[data-prepared-node]').length};
  });
  if(dx||dy){
   const previous=results.at(-1);
   assert.ok(previous && typeof previous==='object' && 'state' in previous);
   const last=previous.state;
   assert.ok(last && typeof last==='object' && 'x' in last && 'y' in last && typeof last.x==='number' && typeof last.y==='number');
   assert.ok(Math.abs(state.x-last.x-dx)<.1&&Math.abs(state.y-last.y-dy)<.1,`${name}: native input did not deliver the requested rotation`);
  }
  const matrix=multiplyPreparedMatrix4(multiplyPreparedMatrix4(preparedRotationMatrix4('x',state.y*-.3),preparedRotationMatrix4('y',state.x*.3)),base);
  const saved={...initial,camera:{distanceKilometers:initial.camera.distanceKilometers!*Math.exp(state.log),pose:{schema:'cssearth-camera-pose@2' as const,scene:serializePreparedMatrix4(matrix)}}};
  const referenceUrl=`${origin}/saturn/?${formatSharedView(saved)}`;
  if(!capturedReference){await reference.goto(referenceUrl);await reference.waitForLoadState('networkidle');}
  await native.mouse.move(20,20);await reference.mouse.move(20,20);await pause(500);
  const nativePath=`${directory}/${name}-native.png`,referencePath=`${directory}/${name}-reference.png`;
  await native.screenshot({path:nativePath});await reference.screenshot({path:referencePath});
  const rect={left:360,top:64,width:560,height:810};
  const a=await sharp(nativePath).extract(rect).removeAlpha().raw().toBuffer(),b=await sharp(referencePath).extract(rect).removeAlpha().raw().toBuffer();
  let sum=0,different=0;const diff=Buffer.alloc(a.length);
  for(let i=0;i<a.length;i+=3){let max=0;for(let c=0;c<3;c++){const delta=Math.abs(a[i+c]-b[i+c]);sum+=delta;max=Math.max(max,delta);diff[i+c]=Math.min(255,delta*4);}if(max>12)different++;}
  await sharp(diff,{raw:{width:rect.width,height:rect.height,channels:3}}).png().toFile(`${directory}/${name}-diff.png`);
  const error={meanChannel:sum/a.length,fractionOver12:different/(a.length/3)};
  const refState=await reference.locator('[data-prepared-node="970"]').evaluate(el=>({transform:getComputedStyle(el).transform,background:getComputedStyle(el).backgroundPosition,image:getComputedStyle(el).backgroundImage}));
  results.push({name,state,reference:refState,error,referenceUrl:capturedReference?`${origin}/captured-reference`:referenceUrl});console.log(name,JSON.stringify({state,reference:refState,error}));
  assert.equal(state.nodes,972);assert.ok(state.material!=='none');
  assert.ok(error.meanChannel<.1 && error.fractionOver12<.002,`${name}: the CSS and numeric renderers diverged`);
 }
 assert.deepEqual(errors,[]);
 await context.close();
}finally{await browser.close();await writeFile(`${directory}/comparison.json`,JSON.stringify({browser:browser.version(),scope:capturedReference?'Native CSS camera versus a captured earlier CSS camera, using the same native inputs; both pages block scripts.':'Native CSS camera versus the same retained scene published by the shared numeric renderer at the matching physical pose; both pages block scripts.',capturedReference:capturedReference??null,referenceHtmlSha256,results},null,2));}
