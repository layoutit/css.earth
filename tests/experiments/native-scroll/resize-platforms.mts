import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import type { Page } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';
const directory='output/playwright/native-drag/platforms';await mkdir(directory,{recursive:true});
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const state=(page:Page)=>page.locator('.planet-viewport').evaluate(el=>{
 const s=getComputedStyle(el),sensor=el.querySelector<HTMLElement>('.native-drag-sensor')!,surface=el.querySelector<HTMLElement>('.planet-input-surface')!;
 return {x:Number(s.getPropertyValue('--native-drag-x')),y:Number(s.getPropertyValue('--native-drag-y')),width:parseFloat(sensor.style.width),height:parseFloat(sensor.style.height),zoom:surface.scrollTop,
  initialTarget:CSS.supports('scroll-initial-target','nearest'),timeline:CSS.supports('animation-timeline','view()'),resizeCorner:CSS.supports('selector(::-webkit-resizer)'),
  scene:getComputedStyle(el.querySelector('.polycss-scene')!).transform,material:getComputedStyle(el.querySelector('[data-prepared-node="970"]')!).transform};
});
const results:Record<string,unknown>={};
const chrome=await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
try{
 const context=await chrome.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4352/saturn/?drag=resize');await page.waitForLoadState('networkidle');
 const initial=await state(page),cdp=await context.newCDPSession(page);
 const pending=[cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:350}]})];
 for(let i=1;i<=16;i++){pending.push(cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170+60*i/16,y:350+40*i/16}]}));await pause(16);}
 pending.push(cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}));await Promise.all(pending);await pause(250);
 const after=await state(page);await pause(500);const released=await state(page);
 const zoomPending=[cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:370,y:420}]})];
 for(let i=1;i<=24;i++){zoomPending.push(cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:370,y:420-180*i/24}]}));await pause(24);}
 zoomPending.push(cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}));await Promise.all(zoomPending);await pause(1000);
 const zoomed=await state(page);
 results.chromeTouch={browser:chrome.version(),initial,after,released,zoomed};
 await page.screenshot({path:`${directory}/chrome-touch.png`});console.log('CHROME TOUCH',results.chromeTouch);
 assert.equal(after.width-initial.width,60);assert.equal(after.height-initial.height,40);assert.ok(Math.abs(after.x-60)<.1&&Math.abs(after.y-40)<.1);
 assert.equal(released.x,after.x);assert.equal(released.y,after.y);await context.close();
 assert.ok(zoomed.zoom>released.zoom+100,'The touch zoom rail must scroll the same scene');
 assert.ok(Math.abs(zoomed.x-released.x)<.1&&Math.abs(zoomed.y-released.y)<.1,'Touch zoom must not rotate');
}finally{await chrome.close();await writeFile(`${directory}/results.json`,JSON.stringify(results,null,2));}
if(process.argv[2]==='chromium') process.exit(0);
const safari=await webkit.launch({headless:true});
try{
 const page=await safari.newPage({javaScriptEnabled:false,viewport:{width:1280,height:900}});
 await page.goto('http://127.0.0.1:4352/saturn/?drag=resize');await page.waitForLoadState('networkidle');const initial=await state(page);
 await page.mouse.move(640,450);const pending=[page.mouse.down()];
 for(let i=1;i<=16;i++){pending.push(page.mouse.move(640+60*i/16,450+40*i/16));await pause(16);}
 pending.push(page.mouse.up());await Promise.all(pending);await pause(250);const after=await state(page);
 await page.mouse.wheel(0,600);await pause(300);const zoomed=await state(page);
 results.webkit={browser:safari.version(),initial,after,zoomed};await page.screenshot({path:`${directory}/webkit.png`});console.log('WEBKIT',results.webkit);
 assert.equal(after.width-initial.width,60);assert.equal(after.height-initial.height,40);assert.ok(Math.abs(after.x-60)<.1&&Math.abs(after.y-40)<.1);
}finally{await safari.close();await writeFile(`${directory}/results.json`,JSON.stringify(results,null,2));}
