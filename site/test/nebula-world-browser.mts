/** Three real main-site nebulae: retained navigation, lenses and angular compact lights. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { parsePreparedWorldContext } from '../../src/renderers/css/dist/index.js';
import { createTestPage } from './browser-observations.mts';
import { requireRecord } from '../../tools/source-values.mts';
declare global { interface Window { __nebulaProductionNodes: Element[]; } }
const directory='output/nebula-production-browser';await mkdir(directory,{recursive:true});
const context=parsePreparedWorldContext(JSON.parse(await readFile('src/planets/sun/prepared/world-context.json','utf8')));
const browser=await chromium.launch({headless:true}),page=await createTestPage(browser,{viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())requests.push(request.url());});
const report:{objects:unknown[];errors:string[];navigationRequests:string[];result?:string}={objects:[],errors,navigationRequests:requests};
const base=process.argv[2]??'http://127.0.0.1:4210';
try{
 const response=await page.goto(`${base}/sun/?focus=m42`,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200);
 await page.waitForFunction(()=>window.__sun?.ready&&document.querySelectorAll('[data-volume-lens-object]').length>=4,null,{timeout:120000});
 const initial=validatePreparedVolumeLenses(requireRecord(JSON.parse(await readFile('src/objects/m42/prepared/lenses.json','utf8'))).data);
 const initialFrame=initial.lenses[0]!.volume.frame;
 await page.waitForFunction(({frame,center,radius})=>{
  const position=window.__cssearthTest.object('sun').camera.captureWorldCamera(frame).pose.positionM;
  return Math.hypot(...position.map((value,axis)=>value-center[axis]!))<radius*20;
 },{frame:context.frame,center:initialFrame.originM,radius:initial.framingRadiusUnits*initialFrame.metersPerUnit},{timeout:15000});
 await page.screenshot({path:`${directory}/m42-direct-focus.png`});
 const motion=page.locator('input[name="motion"]');if(await motion.count()&&await motion.isChecked())await motion.uncheck({force:true});
 await page.evaluate(()=>{window.__nebulaProductionNodes=[...document.querySelectorAll('[data-volume-lens-object], [data-volume-lens-object] .css-volume-mesh > s, [data-volume-lens-object] [data-catalogue-source]')];});
 for(const id of ['m42','helix','m2-9']){
  const payload=validatePreparedVolumeLenses(requireRecord(JSON.parse(await readFile(`src/objects/${id}/prepared/lenses.json`,'utf8'))).data);
  const frame=payload.lenses[0]!.volume.frame,radius=payload.framingRadiusUnits;
  const apply=async(distance:number,orientation:readonly[number,number,number,number]=[1,0,0,0])=>{
   const pose=cameraPoseToReferenceFrame({positionM:[0,0,-distance*frame.metersPerUnit],orientationXyzw:orientation},frame);
   await page.evaluate(({world,frame})=>window.__cssearthTest.object('sun').camera.applyWorldCamera(world,frame),
    {world:{referenceFrame:frame.referenceFrame,epochJdTt:frame.epochJdTt,pose},frame:context.frame});
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  };
  await apply(radius*5);
  await page.screenshot({path:`${directory}/${id}-before-flight.png`});
  const label=page.locator(`[data-galaxy-label="${id}"]`);
  await page.waitForFunction(id=>{const e=document.querySelector<HTMLElement>(`[data-galaxy-label="${id}"]`);return e&&e.style.pointerEvents==='auto'&&Number(getComputedStyle(e).opacity)>.1;},id,{timeout:15000});
  const labelBounds=await label.boundingBox();assert.ok(labelBounds,'A visible label needs screen bounds.');
  await page.mouse.dblclick(labelBounds.x+labelBounds.width/2,labelBounds.y+labelBounds.height/2,{delay:65});
  await page.waitForFunction(id=>new URL(location.href).searchParams.get('focus')===id,id,{timeout:30000});
  await page.waitForTimeout(350);
  const bank=page.locator(`[data-volume-lens-object="${id}"]`);assert.equal(await bank.evaluate(e=>getComputedStyle(e).display),'block');
  await apply(radius*4);
  const before=await page.evaluate(()=>JSON.stringify(window.__cssearthTest.object('sun').camera.state()));
  const count=await bank.locator('[data-catalogue-source]').count();assert.equal(count,payload.lenses[0]!.stars.points.length);
  for(const lens of payload.lenses){
   const button=page.locator(`[data-focus-lens-bank="${id}"] [data-focus-lens][value="${lens.id}"]`);
   await button.click({force:true});
   await page.waitForFunction(({id,lens})=>document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens')===lens,{id,lens:lens.id});
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__cssearthTest.object('sun').camera.state())),before,'A lens switch moved the world camera.');
   const images=await bank.locator(`[data-volume-lens="${lens.id}"] .css-volume-mesh > s`).evaluateAll(nodes=>[...new Set(nodes.map(e=>getComputedStyle(e).backgroundImage.slice(5,-2)))].filter(Boolean));
   await page.evaluate(async urls=>{await Promise.all(urls.map(url=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Missing nebula texture:${url}`));image.src=url;})));},images);
   await page.screenshot({path:`${directory}/${id}-${lens.id}.png`});
  }
  let angular:boolean|undefined;
  if(count){
   const observed=await bank.locator('[data-catalogue-source]').evaluateAll(nodes=>nodes.filter(e=>getComputedStyle(e).visibility==='visible').map(e=>({id:e.getAttribute('data-catalogue-source'),width:parseFloat(getComputedStyle(e).width)})).filter(p=>p.width>0));
   assert.ok(observed.length>0,'Prepared compact lights must be visible.');
   const star=observed[0]!;await apply(radius*2);
   const closer=await bank.locator(`[data-catalogue-source="${star.id}"]`).evaluate(e=>parseFloat(getComputedStyle(e).width));
   assert.ok(closer>star.width*1.1,'Moving closer must enlarge angular compact lights.');angular=true;
  }
  await apply(radius*4,[Math.cos(.3),Math.sin(.3),0,0]);
  await page.screenshot({path:`${directory}/${id}-oblique.png`});
  assert.equal(await page.evaluate(()=>window.__nebulaProductionNodes.every(e=>e.isConnected)),true,'Navigation replaced prepared object nodes.');
  report.objects.push({id,lenses:payload.lenses.map(l=>l.id),stars:count,angularStars:angular,labelFlyTo:true,cameraRetainedAcrossLenses:true});
 }
 assert.equal(requests.length,1,'Nebula navigation reloaded the page.');assert.deepEqual(errors,[]);report.result='PASS';
 console.log(`NEBULA_WORLD_PASS ${JSON.stringify(report.objects)}`);
}finally{await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
