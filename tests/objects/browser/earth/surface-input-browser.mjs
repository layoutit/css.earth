import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
import {prepareLocationPoint} from '../../../../tools/objects/geographic-pages/prepare-location.mjs';
import {parseSharedView} from '../../../../src/renderers/css/dist/index.js';
import {WHEEL_ZOOM_SPEED_MULTIPLIER} from '../../../../site/runtime-policy.mjs';
const {values}=parseArgs({options:{built:{type:'string'},output:{type:'string'},dpr:{type:'string',default:'1'},place:{type:'string',default:'buenos-aires'},restore:{type:'boolean',default:false},input:{type:'string',default:'pinch'}}});
assert.ok(values.built,'--built is required');
assert.ok(['pinch','wheel'].includes(values.input));
const dpr=Number(values.dpr);assert.ok([1,2].includes(dpr));
const storyId=values.place;
const story={
'buenos-aires':{name:'Buenos Aires',longitude:-58.3816,latitude:-34.6037},
'longyearbyen':{name:'Longyearbyen',longitude:15.6469,latitude:78.2233},
'suva':{name:'Suva',longitude:178.4415,latitude:-18.1416},
'apia':{name:'Apia',longitude:-171.7514,latitude:-13.8333},
}[storyId];
assert.ok(story);
const output=resolve(values.output??`output/playwright/surface-input-${Date.now()}`,`dpr${dpr}-${storyId}`);
await mkdir(output,{recursive:true});
const built=resolve(values.built);
const bytes=await readFile('src/planets/earth/prepared/scene.json'),scene=JSON.parse(bytes);
const points=[[0,0],[.01,0],[0,.01]].map(([lon,lat])=>prepareLocationPoint(scene,story.longitude+lon,story.latitude+lat));
const fixture=await serveBuiltFixture(built), browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});
const harnessBytes=await readFile(import.meta.filename);
const report={harnessSha256:createHash('sha256').update(harnessBytes).digest('hex'),dpr,story,built,output,browser:browser.version(),sceneSha256:createHash('sha256').update(bytes).digest('hex'),points,states:[],errors:[]};
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,hasTouch:true});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
page.on('pageerror',e=>report.errors.push(e.message));
const pause=ms=>page.waitForTimeout(ms);
const capture=async name=>{
 const result=await page.evaluate(points=>{
  const camera=document.querySelector('.polycss-camera'),body=document.querySelector('.earth-body:not(.earth-body-polar)');
  let transform=new DOMMatrix(),typedTransform=new DOMMatrix();
  const ancestors=[];
  for(let node=body;node&&node!==camera;node=node.parentElement){
   const value=node.computedStyleMap().get('transform');
   const matrix=typeof value.toMatrix==='function'?value.toMatrix():new DOMMatrix();
   ancestors.push({className:node.className,text:getComputedStyle(node).transform,typed:Array.from(matrix.toFloat64Array())});
   transform=new DOMMatrix(getComputedStyle(node).transform).multiply(transform);typedTransform=matrix.multiply(typedTransform);
  }
  const bounds=camera.getBoundingClientRect(),style=getComputedStyle(camera),focal=parseFloat(style.perspective),principal=style.perspectiveOrigin.split(' ').map(Number.parseFloat);
  const projected=points.map(p=>{const q=typedTransform.transformPoint(new DOMPoint(...p)),depth=focal-q.z;
   return {depth,screen:[bounds.x+principal[0]+(q.x-principal[0]+bounds.width/2)*focal/depth,bounds.y+principal[1]+(q.y-principal[1]+bounds.height/2)*focal/depth],point:q.toJSON()};});
  return {projectionMethod:'CSS Typed OM float64',ancestors,url:location.href,readout:document.querySelector('.planet-view-readout')?.textContent,bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},focal,projected};
 },points);
 const row={name,...result,camera:parseSharedView(new URL(result.url).search)?.camera};report.states.push(row);console.log(JSON.stringify(row));return row;
};
try{
 await writeFile(resolve(output,'captured-harness.mjs'),harnessBytes);
 await page.goto(`${fixture.url}/earth/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:120000});
 await page.locator('.planet-sidebar-search').fill(story.name);
 const choice=page.locator('[data-destination-id]:visible').first();await choice.waitFor();
 assert.ok((await choice.textContent()).toLowerCase().includes(story.name.toLowerCase()));
 const selectedId=await choice.getAttribute('data-destination-id');report.selectedId=selectedId;await choice.click();
 await page.waitForFunction(id=>document.querySelector('[data-entity-card]').dataset.entityId===id,selectedId);await pause(6000);
 const before=await capture('before');await page.screenshot({path:resolve(output,'before.png')});
 const x=before.bounds.x+before.bounds.width/2,y=before.bounds.y+before.bounds.height/2;
 assert.ok(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.planet-input-surface')),{x,y}));
 const touchPoints=span=>[1,2].map((id,i)=>({id,x:x+(i?1:-1)*span/2,y,radiusX:4,radiusY:4,force:1}));
 report.input=values.input;
 if(values.input==='wheel'){
  const plan=JSON.parse(await readFile('src/planets/earth/prepared/runtime.json'));
  const total=-Math.log(1.2)/(plan.camera.dolly.wheelStepPerDelta*WHEEL_ZOOM_SPEED_MULTIPLIER);
  await page.evaluate(()=>{window.__surfaceWheels=[];addEventListener('wheel',e=>window.__surfaceWheels.push({deltaY:e.deltaY,trusted:e.isTrusted}),{passive:true})});
  await page.mouse.move(x,y);
  for(let step=0;step<20;step++){await page.mouse.wheel(0,total*dpr/20);await pause(30)}
  report.wheelEvents=await page.evaluate(()=>window.__surfaceWheels);
  assert.ok(report.wheelEvents.every(e=>e.trusted));
  assert.ok(Math.abs(report.wheelEvents.reduce((sum,e)=>sum+e.deltaY,0)-total)<1e-5,'Delivered wheel deltas must match the calibrated gesture');
 }else{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchPoints(120)});await pause(100);
  for(let step=1;step<=20;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchPoints(120+24*step/20)});await pause(30)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await pause(500);await capture('after-zoom');
 const [dragX,dragY]=report.states[1].projected[0].screen;
 await page.mouse.move(dragX,dragY);await page.mouse.down();for(let step=1;step<=20;step++){await page.mouse.move(dragX+100*step/20,dragY);await pause(30)}await pause(140);await page.mouse.up();await pause(300);await capture('after-drag');
 await page.screenshot({path:resolve(output,'after.png')});
 const span=row=>Math.hypot(...row.projected[1].screen.map((v,i)=>v-row.projected[0].screen[i]));
 report.visibleZoomRatio=span(report.states[1])/span(report.states[0]);
 report.dragPixels=report.states[2].projected[0].screen.map((v,i)=>v-report.states[1].projected[0].screen[i]);
 report.expected={pinchRatio:1.2,dragPixels:[100,0]};
 assert.ok(Math.abs(report.visibleZoomRatio-1.2)<.01, `Visible pinch scale ${report.visibleZoomRatio} differs from 1.2`);
 assert.ok(Math.hypot(report.dragPixels[0]-100,report.dragPixels[1])<1, `Visible drag ${report.dragPixels} differs from [100,0]`);
 if(values.restore){
  for(let gesture=0;gesture<2;gesture++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchPoints(120)});
   for(let step=1;step<=30;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchPoints(120+4*step)});await pause(30)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await pause(300);const saved=await capture('deep-saved-view');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:120000});await pause(500);
  const restored=await capture('restored-view');
  assert.equal(await page.locator('[data-entity-card]').getAttribute('data-entity-id'),selectedId);
  const errorPixels=Math.hypot(...restored.projected[0].screen.map((v,i)=>v-saved.projected[0].screen[i]));
  report.restore={errorPixels,saved:saved.camera.distanceKilometers,restored:restored.camera.distanceKilometers};
  assert.ok(errorPixels<.1,`Saved view shifted ${errorPixels} pixels after reload`);
  assert.ok(Math.abs(report.restore.saved-report.restore.restored)<.000001,'Saved physical distance changed after reload');
 }
 assert.equal(report.errors.length,0);
}catch(e){report.error=String(e);console.error(e);process.exitCode=1}
finally{report.scripts=fixture.requests.filter(r=>r.sha256);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await context.close();await browser.close();await fixture.close();report.closed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({visibleZoomRatio:report.visibleZoomRatio,dragPixels:report.dragPixels,error:report.error}));}
