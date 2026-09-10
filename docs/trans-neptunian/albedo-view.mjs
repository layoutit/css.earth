import {chromium} from 'playwright';
import {conformanceBrowserLaunch} from '../../site/test/conformance-browser-launch.mjs';
import {writeFile} from 'node:fs/promises';
const out='output/playwright/trans-neptunian';
const browser=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:out,redirectStdio:true})).options);
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4278/arrokoth/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.locator('button[name="lens"][value="albedo"]').click();
 await page.waitForLoadState('networkidle');
 const views=[];
 for(const [n,x0,y0,x1,y1] of [[1,850,250,850,720],[2,850,250,850,720],[3,650,440,1170,440]]){
  await page.mouse.move(x0,y0);await page.mouse.down();await page.mouse.move(x1,y1,{steps:50});
  await page.waitForTimeout(160);await page.mouse.up();await page.waitForTimeout(180);
  const path=`${out}/arrokoth-albedo-rotated-${n}.png`;await page.screenshot({path});
  views.push({path,route:page.url(),drag:{x0,y0,x1,y1,steps:50},sceneTransform:await page.locator('.polycss-scene').evaluate(n=>getComputedStyle(n).transform)});
 }
 await writeFile(`${out}/albedo-views.json`,JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),headless:true,viewport:{width:1440,height:900},lens:'albedo',shadows:false,errors,views},null,2)+'\n');
}finally{await browser.close();}
