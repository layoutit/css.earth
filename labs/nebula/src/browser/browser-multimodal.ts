/** Actual combined-source and measured-slit interactions in an isolated browser session. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const directory='.local/nebula-lab/multimodal-browser';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();
const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')requests.push(r.url());});
const base=process.argv[2]??'http://127.0.0.1:4331';
async function fusionReady(){await page.waitForFunction(()=>!!document.querySelector('.evidence-fusion-controls')?.getAttribute('data-result-id')&&document.querySelector('.evidence-fusion-controls')?.getAttribute('data-busy')==='false',null,{timeout:60000});assert.equal(await page.locator('.fusion-status[role="alert"]').count(),0);}
async function kinematicsReady(){await page.waitForFunction(()=>{
 const panel=document.querySelector('.kinematics-panel');if(panel?.getAttribute('data-updating')!=='false')return false;
 const text=panel.getAttribute('data-prediction-settings');if(!text)return false;const p:unknown=JSON.parse(text);
 if(!p||typeof p!=='object')return false;
 return ['depthRatio','inclinationDegrees','expansionKmS'].every(key=>key in p&&Number(document.querySelector<HTMLInputElement>(`#kinematics-${key}`)?.value)===Reflect.get(p,key));
},null,{timeout:30000});}
async function snapshot(name:string){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.screenshot({path:`${directory}/${name}.png`});}
async function changed(previous:string|null){await page.waitForFunction(id=>document.querySelector('.evidence-fusion-controls')?.getAttribute('data-result-id')!==id,previous,{timeout:60000});await fusionReady();}
try{
 await page.goto(`${base}/reconstruction?subject=helix-model-prior&inspection=combined`);await fusionReady();await snapshot('combined');
 const original=await page.locator('.evidence-fusion-controls').getAttribute('data-result-id');const baseline=requests.length;
 await page.locator('#fusion-background').selectOption('eso-wide');await page.getByRole('button',{name:'Shared',exact:true}).click();
 await page.getByLabel('Image background',{exact:true}).uncheck();await snapshot('shared');
 assert.equal(requests.length,baseline,'Display controls triggered evidence processing.');
 const area=await page.locator('.fusion-viewport').boundingBox();assert.ok(area);
 await page.mouse.click(area.x+area.width/2,area.y+area.height/2);
 await page.waitForFunction(()=>document.querySelectorAll('.fusion-inspect output').length===3);
 await page.getByRole('button',{name:'Broad',exact:true}).click();await changed(original);
 const broad=await page.locator('.evidence-fusion-controls').getAttribute('data-result-id');
 await page.locator('#fusion-eso-vista').press('Home');await changed(broad);assert.equal(await page.locator('#fusion-eso-vista').inputValue(),'0');
 const saved=await page.locator('.evidence-fusion-controls').getAttribute('data-result-id'),count=requests.length;
 await page.reload();await fusionReady();assert.equal(await page.locator('.evidence-fusion-controls').getAttribute('data-result-id'),saved);assert.equal(requests.length,count,'Refresh reprocessed finished combined map.');
 assert.equal(await page.locator('#fusion-eso-vista').inputValue(),'0');
 await page.getByRole('button',{name:'Velocity',exact:true}).click();
 await kinematicsReady();
 assert.equal(await page.locator('.kinematics-observed').count(),27);assert.equal(await page.locator('.kinematics-model').count(),2);
 await snapshot('velocity');
 const observed=await page.locator('.kinematics-observed').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('cx'),n.getAttribute('cy')]));
 const initial=await page.locator('.kinematics-model').first().getAttribute('d');
 await page.locator('#kinematics-depthRatio').press('ArrowRight');
 await page.waitForFunction(d=>document.querySelector('.kinematics-model')?.getAttribute('d')!==d,initial,{timeout:30000});
 assert.deepEqual(await page.locator('.kinematics-observed').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('cx'),n.getAttribute('cy')])),observed,'Changing assumptions moved observations.');
 await page.locator('#kinematics-inclinationDegrees').press('ArrowRight');
 await kinematicsReady();
 const depth=await page.locator('#kinematics-depthRatio').inputValue();await page.reload();
 await kinematicsReady();
 assert.equal(await page.locator('#kinematics-depthRatio').inputValue(),depth);
 await page.getByRole('button',{name:'Reset hypothesis',exact:true}).click();
 await kinematicsReady();
 assert.equal(await page.locator('#kinematics-depthRatio').inputValue(),'1');
 let releasePrediction: (()=>void)|undefined;
 await page.route('**/__nebula/kinematics',async route=>{
   if(route.request().method()==='POST')await new Promise<void>(resolve=>{releasePrediction=resolve;});
   await route.continue().catch(()=>{});
 });
 const pendingPrediction=page.waitForRequest(request=>request.method()==='POST'&&request.url().endsWith('/__nebula/kinematics'));
 await page.locator('#kinematics-depthRatio').press('ArrowRight');await pendingPrediction;
 await page.getByRole('button',{name:'Reset hypothesis',exact:true}).click();
 await kinematicsReady();
 releasePrediction?.();await page.unroute('**/__nebula/kinematics');
 await page.setViewportSize({width:1000,height:800});await snapshot('velocity-1000');
 assert.deepEqual(errors,[]);await writeFile(`${directory}/result.json`,JSON.stringify({status:'passed',sources:3,measuredSamples:27,displayDoesNotProcess:true,refreshReuses:true,observationsStayFixed:true},null,2));
 console.log('PASS combined evidence:3sources, source controls, sample inspection, refresh; velocity:27fixed measurements, live model controls, persistence.');
}catch(error){await snapshot('failure');throw error;}finally{await browser.close();}
