import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
import {prepareCityPageGeometry, createCityCoverageSampler} from '../../../../tools/objects/geographic-pages/page-geometry.mjs';

const {values} = parseArgs({options: {built: {type:'string'}, output: {type:'string'},
  dpr: {type:'string', default:'1'}, place: {type:'string', default:'suva'}}});
assert.ok(values.built, '--built is required');
const dpr = Number(values.dpr); assert.ok([1,2].includes(dpr));
const place = {suva: {query:'Suva', id:'2198148', strokes:[[-240,0],[-240,0],[-240,0],[240,0]]},
  north: {query:'Longyearbyen', id:'2729907', strokes:[[0,200],[0,200],[0,200],[0,-200]]},
  city: {query:'Buenos Aires', id:'3435910', strokes:[[-240,0],[-240,0],[0,200],[240,0]]}}[values.place];
assert.ok(place);
const built = resolve(values.built), output = resolve(values.output ?? `output/playwright/surface-boundary-${Date.now()}`);
await mkdir(output, {recursive:true});
const sceneBytes = await readFile('src/planets/earth/prepared/scene.json'), scene = JSON.parse(sceneBytes);
const source = await readFile(import.meta.filename);
// Independent probe uses the existing prepared page quads and their coverage
// sampler, rather than the runtime hit mesh or its intersection function.
const pages = [];
for(let y=0;y<16;y++) for(let x=0;x<(y===0||y===15?1:32);x++) {
  const page = prepareCityPageGeometry({level:0,x,y},scene);
  pages.push({x,y,...page,covers:createCityCoverageSampler(page)});
}
const sub=(a,b)=>a.map((n,i)=>n-b[i]), dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hit(origin, direction, outer=false) {
  let result=null;
  for(const page of pages) {
    const [a,b,,d]=page.corners, u=sub(b,a), v=sub(d,a), n=cross(u,v), denominator=dot(direction,n);
    if(Math.abs(denominator)<1e-10) continue;
    const t=dot(sub(a,origin),n)/denominator;
    if(t<0 || (result && (outer?t<=result.t:t>=result.t))) continue;
    const point=origin.map((n,i)=>n+direction[i]*t), offset=sub(point,a);
    const uu=dot(u,u), vv=dot(v,v), uv=dot(u,v), det=uu*vv-uv*uv;
    const s=(dot(offset,u)*vv-dot(offset,v)*uv)/det;
    const r=(dot(offset,v)*uu-dot(offset,u)*uv)/det;
    // Regular prepared quads are trapezoids, not parallelograms. Test their
    // four oriented edges; only the affine polar cap uses disc UV coverage.
    if(page.corners.some((corner,i)=>dot(cross(sub(page.corners[(i+1)%4],corner),sub(point,corner)),n)<-1e-6)) continue;
    if((page.y===0||page.y===15) && !page.covers(s,r)) continue;
    result={point,t,page:{x:page.x,y:page.y},uv:[s,r]};
  }
  return result;
}
const fixture=await serveBuiltFixture(built);
const browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,hasTouch:true});
const page=await context.newPage(), cdp=await context.newCDPSession(page);
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),built,output,dpr,place,
  browser:browser.version(),harnessSha256:createHash('sha256').update(source).digest('hex'),
  sceneSha256:createHash('sha256').update(sceneBytes).digest('hex'),
  scope:'Continuous prepared-face clearance and pointer tracking. Measurement queries are intrusive; no performance qualification.',
  states:[],gestures:[],errors:[],network:[]};
const requests=new Map();
context.on('request',r=>requests.set(r,{url:r.url(),at:Date.now()}));
context.on('requestfinished',r=>{const row=requests.get(r);if(row)row.end=Date.now()});
context.on('requestfailed',r=>{const row=requests.get(r);if(row){row.end=Date.now();row.error=r.failure()?.errorText}});
page.on('pageerror',e=>report.errors.push(e.message));
const pause=ms=>page.waitForTimeout(ms);
const sample=async(name,point=null,pointer=null)=>{
  const row=await page.evaluate(({point,pointer})=>{
    const camera=document.querySelector('.polycss-camera'), body=document.querySelector('.earth-body:not(.earth-body-polar)');
    let matrix=new DOMMatrix();
    for(let node=body;node&&node!==camera;node=node.parentElement) {
      const value=node.computedStyleMap().get('transform');
      matrix=(typeof value.toMatrix==='function'?value.toMatrix():new DOMMatrix()).multiply(matrix);
    }
    const bounds=camera.getBoundingClientRect(), style=getComputedStyle(camera), focal=parseFloat(style.perspective);
    const principal=style.perspectiveOrigin.split(' ').map(Number.parseFloat), inverse=matrix.inverse();
    const eye=inverse.transformPoint(new DOMPoint(principal[0]-bounds.width/2,principal[1]-bounds.height/2,focal));
    const xy=pointer??[bounds.x+bounds.width/2,bounds.y+bounds.height/2];
    const ray=inverse.transformPoint(new DOMPoint(xy[0]-bounds.x-principal[0],xy[1]-bounds.y-principal[1],-focal,0));
    const q=point&&matrix.transformPoint(new DOMPoint(...point));
    const nodes=[...document.querySelector('.planet-stage').querySelectorAll('*')];
    window.__boundaryNodes??=nodes;
    return {at:performance.now(),eye:[eye.x,eye.y,eye.z],ray:[ray.x,ray.y,ray.z],
      projected:q?[bounds.x+principal[0]+(q.x-principal[0]+bounds.width/2)*focal/(focal-q.z),bounds.y+principal[1]+(q.y-principal[1]+bounds.height/2)*focal/(focal-q.z)]:null,
      bounds:bounds.toJSON(),matrix:Array.from(matrix.toFloat64Array()),url:location.href,entity:document.querySelector('[data-entity-card]').dataset.entityId,
      readout:document.querySelector('.planet-view-readout')?.textContent,
      stable:window.__boundaryNodes.length===nodes.length&&window.__boundaryNodes.every((n,i)=>n===nodes[i]),
      scenes:document.querySelectorAll('.polycss-scene').length,
      paintedPages:document.querySelectorAll('[data-city-page][style*="visibility: visible"]').length};
  },{point,pointer});
  const distance=Math.hypot(...row.eye), boundary=hit([0,0,0],row.eye.map(n=>n/distance),true);
  assert.ok(boundary,'Camera has a prepared radial boundary');
  row.name=name; row.clearanceUnits=distance-boundary.t; row.boundary=boundary.page;
  row.surface=hit(row.eye,row.ray); row.pendingRequests=[...requests.values()].filter(r=>!r.end).length;
  report.states.push(row);
  assert.ok(row.clearanceUnits>0, `Camera entered prepared page ${JSON.stringify(boundary.page)} by ${-row.clearanceUnits} units`);
  assert.ok(row.stable); assert.equal(row.scenes,1);
  return row;
};
async function pinch(scale) {
  const row=await sample(`before-pinch-${scale}`), {x,y,width,height}=row.bounds;
  const points=span=>[1,2].map((id,i)=>({id,x:x+width/2+(i?1:-1)*span/2,y:y+height/2,radiusX:4,radiusY:4,force:1}));
  const start=scale>1?120:240;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(start)});
  for(let i=1;i<=30;i++) {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(start*(1+(scale-1)*i/30))});
    await pause(30); if(i%5===0) await sample(`pinch-${scale}-${i}`);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function drag(dx,dy) {
  const before=await sample('before-drag'), {x,y,width,height}=before.bounds, start=[x+width/2,y+height/2];
  await page.mouse.move(...start);await page.mouse.down();
  // Pointer-down cancels flight synchronously. Measure that grabbed frame,
  // rather than a point sampled before two asynchronous input round trips.
  const pressed=await sample('pointer-down',null,start);
  assert.ok(pressed.surface, 'Drag starts on painted surface');
  const gesture={dx,dy,point:pressed.surface.point,samples:[]}; report.gestures.push(gesture);
  for(let i=1;i<=30;i++) {
    const t=(1-Math.cos(Math.PI*i/30))/2, expected=[start[0]+dx*t,start[1]+dy*t];
    await page.mouse.move(...expected);await pause(30);
    if(i%5===0) {
      const row=await sample(`drag-${i}`,gesture.point,expected);
      gesture.samples.push({at:row.at,expected,actual:row.projected,errorPixels:Math.hypot(...sub(row.projected,expected))});
    }
  }
  await pause(140);await page.mouse.up();
  console.log(JSON.stringify({drag:[dx,dy],maxErrorPixels:Math.max(...gesture.samples.map(s=>s.errorPixels)),boundary:report.states.at(-1).boundary}));
}
try {
  await writeFile(resolve(output,'captured-harness.mjs'),source);
  await page.goto(`${fixture.url}/earth/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:120000});
  await page.locator('.planet-sidebar-search').fill(place.query);
  await page.locator(`[data-destination-id="${place.id}"]:visible`).click();
  // Initial destination setup only; subsequent gestures do not wait for tiles.
  await pause(6000);await sample('arrival');await page.screenshot({path:resolve(output,'arrival.png')});
  for(let i=0;i<5;i++) await pinch(.5);
  for(const [dx,dy] of place.strokes) await drag(dx,dy);
  for(let i=0;i<7;i++) await pinch(2);
  await drag(100,0);await pinch(.5);await drag(-100,0);
  report.panBoundaries=[...new Set(report.states.map(s=>`${s.boundary.x}/${s.boundary.y}`))];
  assert.ok(report.panBoundaries.length>1,'Panning must cross a prepared face boundary');
  if(values.place==='suva') assert.ok(report.panBoundaries.some(k=>k.startsWith('15/'))&&
    report.panBoundaries.some(k=>k.startsWith('16/')),'Panning must cross the antimeridian');
  const saved=await sample('before-interruption');
  assert.ok(saved.surface);
  const savedPoint=saved.surface.point;
  const savedProjection=await sample('saved-ground-reference',savedPoint);
  await page.locator('.planet-sidebar-search').fill('Tokyo');
  await page.locator('[data-destination-id="1850147"]:visible').click();
  await pause(600);const movingA=await sample('flight-in-progress-a');
  await pause(120);const movingB=await sample('flight-in-progress-b');
  assert.notDeepEqual(movingA.matrix,movingB.matrix,'The next drag must interrupt a moving flight');
  await drag(100,0);
  const stopped=await sample('interrupted-flight-stopped');await pause(300);
  const later=await sample('interrupted-flight-later');
  assert.deepEqual(later.matrix,stopped.matrix,'Flight must stay canceled after release');
  await page.goBack();
  await page.waitForFunction(id=>document.querySelector('[data-entity-card]').dataset.entityId===id,place.id);
  await pause(300);const restored=await sample('history-restored',savedPoint);
  report.historyShiftPixels=Math.hypot(...sub(restored.projected,savedProjection.projected));
  assert.ok(report.historyShiftPixels<.1,`History shifted the prepared ground by ${report.historyShiftPixels} px`);
  await page.goForward();await pause(300);
  assert.equal((await sample('history-forward')).entity,'1850147');
  await page.goBack();await pause(300);
  await sample('final');await page.screenshot({path:resolve(output,'final.png')});
  report.maxGrabErrorPixels=Math.max(...report.gestures.flatMap(g=>g.samples.map(s=>s.errorPixels)));
  report.boundaries=[...new Set(report.states.map(s=>`${s.boundary.x}/${s.boundary.y}`))];
  assert.ok(report.maxGrabErrorPixels<2,`Grabbed surface slipped ${report.maxGrabErrorPixels} px`);
  assert.ok(report.boundaries.length>1,'Must cross a prepared face boundary');
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {
  report.error=String(error);report.passed=false;
  await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});console.error(error);
} finally {
  report.scripts=fixture.requests.filter(r=>r.sha256);report.network=[...requests.values()];
  await context.close();await browser.close();await fixture.close();report.closed=true;
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,error:report.error,boundaries:report.boundaries,maxGrabErrorPixels:report.maxGrabErrorPixels}));
}
if(!report.passed) process.exitCode=1;
