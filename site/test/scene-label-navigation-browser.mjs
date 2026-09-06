// Focused native regression for the scene label hit target and navigation gesture.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.argv[2]??'http://localhost:4210';
await mkdir('.local/scene-label-proof',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={};
try {
 await page.goto(origin+'/mars/?v=QMJAzBHTYWObiz6x4THbR6qYwQEoyPrAJEu_4p-8CmDbXz_fsO_ophXgv52s6vIzS4UAAQAAAAAAAAAA',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__cssEarth?.ready&&window.__mars?.runtime.selection().ready);
 await page.evaluate(()=>window.__labelDocument=document);
 const label=page.locator('[data-context-label="ceres"]');
 await label.waitFor({state:'visible'});
 const box=await label.boundingBox();
 assert.ok(box&&box.width>15,'Actual text is the target');
 report.label={text:await label.innerText(),box};
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.waitForTimeout(250);
 assert.equal(new URL(page.url()).pathname,'/mars/','Single label click does not navigate');
 await page.mouse.dblclick(box.x+box.width/2,box.y+box.height/2,{delay:90});
 await page.waitForFunction(()=>window.__cssEarth?.ready&&window.__cssEarth.activeObjectId==='ceres'&&location.pathname==='/ceres/',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>document===window.__labelDocument),true);
 report.labelFlight='mars → ceres';
 await page.locator('a.scale-stop[href="/mars/"] .scale-label').click();
 await page.waitForFunction(()=>window.__cssEarth?.ready&&window.__cssEarth.activeObjectId==='mars'&&location.pathname==='/mars/',null,{timeout:30000});
 report.navbarSingleClick='ceres → mars';
 assert.equal(await page.evaluate(()=>document===window.__labelDocument),true);
 assert.deepEqual(errors,[]);report.status='passed';
 console.log('LABEL PASS: single click stays; double-click Ceres text flies; top navbar remains single-click; same document.');
} catch(error){report.status='failed';report.error=error.stack;await page.screenshot({path:'.local/scene-label-proof/failure.png'});throw error;}
finally{report.errors=errors;await writeFile('.local/scene-label-proof/report.json',JSON.stringify(report,null,2));await browser.close();}
