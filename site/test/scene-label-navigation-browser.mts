declare global {interface Window {__labelDocument:Document;__labelNavigations:string[];}}

import {required} from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
// Focused native regression for the scene label hit target and navigation gesture.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.argv[2]??'http://localhost:4210';
await mkdir('.local/scene-label-proof',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await createTestPage(browser, {viewport:{width:1440,height:900}});
const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const report:Record<string,unknown>={};
try {
 await page.goto(origin+'/mars/?v=QMJAzBHTYWObiz6x4THbR6qYwQEoyPrAJEu_4p-8CmDbXz_fsO_ophXgv52s6vIzS4UAAQAAAAAAAAAA',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__cssEarth?.ready&&window.__mars?.runtime.selection().ready);
 await page.evaluate(()=>{
  window.__labelDocument=document;
  window.__labelNavigations=[];
  document.addEventListener('objectnavigate',event=>{if(!(event instanceof CustomEvent))throw new Error('Expected navigation event');const id=window.__cssearthTest.record(event.detail,'navigation detail').objectId;if(typeof id!=='string')throw new Error('Expected object ID');window.__labelNavigations.push(id);});
 });
 const label=page.locator('[data-context-label="ceres"]');
 await label.waitFor({state:'visible'});
 const box=await label.boundingBox();
 assert.ok(box&&box.width>15,'Actual text is the target');
 report.label={text:await label.innerText(),box};
 await page.mouse.move(1400,90);
 await page.waitForTimeout(150);
 assert.equal(await page.locator('.planet-input-surface').evaluate(node=>getComputedStyle(node).cursor),'crosshair');
 const dimmed=await label.evaluate(node=>Number(getComputedStyle(node).opacity));
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.waitForTimeout(150);
 const hovered=await label.evaluate(node=>({
  picked:node.dataset.objectHovered,opacity:Number(getComputedStyle(node).opacity),
  decoration:getComputedStyle(node).textDecorationLine,
 }));
 assert.equal(hovered.picked,'true');
 assert.equal(hovered.opacity,1);
 assert.ok(dimmed<hovered.opacity);
 assert.equal(hovered.decoration,'none');
 assert.equal(await page.locator('.planet-input-surface').evaluate(node=>getComputedStyle(node).cursor),'pointer');
 report.hover={dimmed,...hovered};
 await page.screenshot({path:'.local/scene-label-proof/label-hover.png'});
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.waitForFunction(()=>window.__cssEarth?.ready&&window.__cssearthTest.scene().activeObjectId==='ceres'&&location.pathname==='/ceres/',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>document===window.__labelDocument),true);
 assert.deepEqual(await page.evaluate(()=>window.__labelNavigations),['ceres']);
 report.labelFlight='mars → ceres with one click';
 const body=required(await page.locator('.polycss-camera').boundingBox());
 const center={x:body.x+body.width/2,y:body.y+body.height/2};
 await page.mouse.move(center.x,center.y);
 const input=page.locator('.planet-input-surface');
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'grab');
 await page.mouse.down();
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'grabbing');
 await page.mouse.move(center.x+20,center.y+10,{steps:4});
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'grabbing');
 await page.waitForTimeout(180);
 await page.mouse.up();
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'grab');
 await page.mouse.move(1400,90);
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'crosshair');
 await page.mouse.down();
 await page.mouse.move(1380,100,{steps:4});
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'grabbing');
 await page.mouse.up();
 assert.equal(await input.evaluate(node=>getComputedStyle(node).cursor),'crosshair');
 report.cursors='sky crosshair → grabbing → crosshair; planet grab → grabbing → grab';
 assert.deepEqual(errors,[]);report.status='passed';
 console.log('LABEL PASS: pointer and opacity on hover; one click flies to Ceres; sky crosshair; planet grab/grabbing; same document.');
} catch(error){report.status='failed';report.error=error instanceof Error ? error.stack ?? error.message : String(error);await page.screenshot({path:'.local/scene-label-proof/failure.png'});throw error;}
finally{report.errors=errors;await writeFile('.local/scene-label-proof/report.json',JSON.stringify(report,null,2));await browser.close();}
