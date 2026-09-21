/** Real exported HTML, with scripting disabled. Pass one or more sphere.html files. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page, type CDPSession } from 'playwright';
import { conformanceBrowserLaunch } from '../../../site/test/conformance-browser-launch.mts';

const files=process.argv.slice(2);
if(!files.length)throw new Error('Pass exported sphere.html files');
const directory='output/playwright/telescope-no-js';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({...((await conformanceBrowserLaunch({evidenceDirectory:directory})).options),ignoreDefaultArgs:['--hide-scrollbars']});
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function drag(cdp:CDPSession,x:number,y:number,dx:number,dy:number){
  const pending=[cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1})];
  for(let i=1;i<=12;i++){pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/12,y:y+dy*i/12,button:'left',buttons:1}));await pause(16);}
  pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0}));await Promise.all(pending);await pause(200);
}
const read=(page:Page)=>page.evaluate(()=>{
  const viewport=document.querySelector<HTMLElement>('.planet-viewport')!,sensor=document.querySelector<HTMLElement>('.native-drag-sensor')!;
  const style=getComputedStyle(viewport),scene=document.querySelector<HTMLElement>('.polycss-scene')!;
  return {x:Number(style.getPropertyValue('--native-drag-x')),y:Number(style.getPropertyValue('--native-drag-y')),
    radius:Number(style.getPropertyValue('--native-radius-px')),zoom:document.querySelector('.planet-input-surface')!.scrollTop,
    width:parseFloat(sensor.style.width),height:parseFloat(sensor.style.height),matrix:getComputedStyle(scene).transform,
    nodes:document.querySelectorAll('[data-prepared-node]').length,scripts:document.scripts.length};
});
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.05,`${a} != ${b}`);
const results=[];
try{
  for(const [index,file] of files.entries()){
    const html=await readFile(resolve(file),'utf8');assert.doesNotMatch(html,/<script\b/i);assert.match(html,/script-src 'none'/);
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900},deviceScaleFactor:1});
    const page=await context.newPage(),cdp=await context.newCDPSession(page),requests:string[]=[];
    page.on('request',request=>requests.push(request.url()));
    await page.setContent(html,{waitUntil:'load'});await pause(350);
    const initial=await read(page);assert.equal(initial.scripts,0);assert.ok(initial.nodes>400);near(initial.x,0);near(initial.y,0);near(initial.zoom,400);
    await page.screenshot({path:`${directory}/${index}-initial.png`,timeout:10000});
    await drag(cdp,600,400,100,50);const dragged=await read(page);
    near(dragged.x,100);near(dragged.y,50);near(dragged.radius,initial.radius);near(dragged.zoom,initial.zoom);
    assert.equal(dragged.nodes,initial.nodes);assert.notEqual(dragged.matrix,initial.matrix);
    // Native DOMMatrix is independent of the CSS expression compiler.
    const matrixError=await page.evaluate(({initial,actual})=>{
      // View timeline progress is rounded by the browser. Compare the same
      // published angles, including the small initial offset, without relaxing the matrix budget.
      const turn=(x:number,y:number)=>new DOMMatrix().rotateAxisAngle(1,0,0,-y*.3).rotateAxisAngle(0,1,0,x*.3);
      const expected=turn(actual.x,actual.y).multiply(turn(initial.x,initial.y).inverse()).multiply(new DOMMatrix(initial.matrix)).toFloat64Array(),found=new DOMMatrix(actual.matrix).toFloat64Array();
      return Math.max(...Array.from({length:12},(_,i)=>Math.abs(expected[i]-found[i])));
    },{initial,actual:dragged});assert.ok(matrixError<1e-6,`CSS camera differs from DOMMatrix by ${matrixError}`);
    await page.mouse.move(1100,100);await pause(250);const released=await read(page);assert.deepEqual(released,dragged);
    await page.mouse.move(600,400);await page.mouse.wheel(0,500);await pause(350);const zoomed=await read(page);
    assert.ok(zoomed.zoom>initial.zoom);assert.ok(zoomed.radius<initial.radius);near(zoomed.x,100);near(zoomed.y,50);
    await drag(cdp,450,350,-50,25);const repeated=await read(page);near(repeated.x,50);near(repeated.y,75);near(repeated.zoom,zoomed.zoom);
    assert.equal(repeated.nodes,initial.nodes);assert.deepEqual(requests,[],'A self-contained export must request no resources');
    await page.screenshot({path:`${directory}/${index}-dragged.png`,timeout:10000});
    results.push({file,initial,dragged,released,zoomed,repeated,matrixError,requests});await context.close();
  }
  await writeFile(`${directory}/report.json`,JSON.stringify({browser:browser.version(),javaScriptEnabled:false,results},null,2));
  console.log(`PASS: ${files.length} spheres, no scripts or network, retained geometry, camera parity, drag/release/repeated drag and independent zoom`);
}finally{await browser.close();}
