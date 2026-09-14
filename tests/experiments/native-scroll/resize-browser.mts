import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import type { CDPSession, Page } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';

const directory='output/playwright/native-drag';
await mkdir(directory,{recursive:true});
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function drag(cdp:CDPSession,x:number,y:number,dx:number,dy:number){
  const pending=[cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1})];
  for(let i=1;i<=12;i++){
    pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/12,y:y+dy*i/12,button:'left',buttons:1}));
    await pause(16);
  }
  pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1}));
  await Promise.all(pending);await pause(80);
}
const state=(page:Page)=>page.locator('.planet-viewport').evaluate(el=>{
  const sensor=el.querySelector<HTMLElement>('.native-drag-sensor')!;
  const frame=el.querySelector<HTMLElement>('.native-drag-frame')!;
  const surface=el.querySelector<HTMLElement>('.planet-input-surface')!;
  const s=getComputedStyle(el),r=frame.getBoundingClientRect();
  return {width:parseFloat(sensor.style.width),height:parseFloat(sensor.style.height),
    x:Number(s.getPropertyValue('--native-drag-x')),y:Number(s.getPropertyValue('--native-drag-y')),
    frame:{x:r.x,y:r.y,width:r.width,height:r.height},frameScroll:[frame.scrollLeft,frame.scrollTop],
    zoom:surface.scrollTop,distance:s.getPropertyValue('--native-log-distance'),
    nodes:el.querySelectorAll('[data-prepared-node]').length,objects:el.querySelectorAll('main[data-object-id]').length};
});
const browser=await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
const results:Record<string,unknown>={browser:browser.version()};
try{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900},deviceScaleFactor:1});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);page.setDefaultTimeout(10000);
 await page.goto('http://127.0.0.1:4352/saturn/?drag=resize');await pause(1000);
 const initial=await state(page);results.initial=initial;console.log('INITIAL',initial);
 const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.05,`${a} != ${b}`);
 near(initial.x,0);near(initial.y,0);near(initial.zoom,400);
 let x=0,y=0;
 for(const [fx,fy,dx,dy] of [[.5,.5,1,1],[.35,.15,60,40],[.67,.2,-40,50],[.35,.85,30,-70]]){
   const before=await state(page),r=before.frame;
   await drag(cdp,r.x+r.width*fx,r.y+r.height*fy,dx,dy);x+=dx;y+=dy;
   const after=await state(page);console.log('DRAG',after);near(after.x,x);near(after.y,y);near(after.width,20480+x);near(after.height,20480+y);
 }
 const released=await state(page);await page.mouse.move(1250,880);await pause(500);const idle=await state(page);
 near(idle.x,x);near(idle.y,y);results.released=released;results.idle=idle;
 const r=idle.frame;await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.wheel(0,700);await pause(400);
 const zoomed=await state(page);results.zoomed=zoomed;console.log('ZOOMED',zoomed);
 assert.ok(zoomed.zoom>idle.zoom+500,'Wheel must reach zoom scrollport');near(zoomed.x,x);near(zoomed.y,y);near(zoomed.frame.y,idle.frame.y);
 await drag(cdp,r.x+r.width*.6,r.y+r.height*.5,50,-40);x+=50;y-=40;
 const afterZoomDrag=await state(page);near(afterZoomDrag.x,x);near(afterZoomDrag.y,y);near(afterZoomDrag.zoom,zoomed.zoom);results.afterZoomDrag=afterZoomDrag;
 await page.screenshot({path:`${directory}/resize-with-zoom.png`});
 await page.mouse.move(640,450);await page.mouse.wheel(0,4000);await pause(500);
 const solar=await state(page);assert.ok(solar.zoom>3900);results.solar=solar;
 const selected=page.locator('[data-native-destination="saturn"]');assert.equal(await selected.evaluate(el=>getComputedStyle(el).visibility),'visible');
 await selected.hover();await page.mouse.wheel(0,-500);await pause(500);
 const wheelOverLink=await state(page);assert.ok(wheelOverLink.zoom<solar.zoom-400);results.wheelOverLink=wheelOverLink;
 near(wheelOverLink.x,x);near(wheelOverLink.y,y);
 await page.mouse.move(800,250);await page.mouse.wheel(0,4000);await pause(500);
 const candidate=await page.locator('.native-context-link:not(.native-context-selected)').evaluateAll(links=>links.flatMap(el=>{
   const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   return document.elementFromPoint(x,y)?.closest('a')===el?[{id:el.getAttribute('data-native-destination'),x,y}]:[];
 }).find(link=>link.id==='neptune')??null);
 assert.ok(candidate,'Neptune must expose its ordinary scene link');
 await page.mouse.click(candidate.x,candidate.y);await page.waitForURL('**/neptune/');await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('main[data-object-id="neptune"]').count(),1);assert.equal(await page.locator('main[data-object-id]').count(),1);
 results.destination=page.url();
 console.log('PASS: four start points, release, independent wheel zoom and drag, wheel over scene links, native Neptune navigation');
 await context.close();
}finally{await browser.close();await writeFile(`${directory}/input.json`,JSON.stringify(results,null,2));}
