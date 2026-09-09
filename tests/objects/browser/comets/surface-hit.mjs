// Compare native painted u triangles with source-prepared targeting.
// Uses each mounted leaf's actual CSS matrix and bevel footprint, independently
// of the prepared mesh used by the picker. Boundary-overlap samples are excluded.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {stripTypeScriptTypes} from 'node:module';
const pickerBytes=await readFile('src/renderers/css/navigation/prepared-surface-hit.ts');
const pickerModule='data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(pickerBytes.toString())).toString('base64');
const origin=process.argv[2]??'http://127.0.0.1:4257', id=process.argv[3]??'comet-81p';
const bytes=await readFile(`src/planets/${id}/prepared/runtime.json`),plan=JSON.parse(bytes).surfaceHit;
assert.ok(plan?.triangles?.length,'Surface qualification requires a prepared mesh.');
// Derive closure from the selected bank's physical edges; a front-face picking
// rule also applies to closed completed meshes and does not prove openness.
const selectedLens=process.argv[4], range=plan.lensRanges?.find(r=>r.lensId===(selectedLens??'micas'));
const edges=new Map();
for(const triangle of plan.triangles.slice(range?.start??0,range?range.start+range.count:undefined))for(let i=0;i<3;i++){
 const key=[triangle[i].join(','),triangle[(i+1)%3].join(',')].sort().join('|');edges.set(key,(edges.get(key)??0)+1);
}
const openMesh=[...edges.values()].some(count=>count===1);
const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[],errors=[];
try{
 for(const dpr of [1,2]){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage').dataset.objectId===id,id);
  const lens=process.argv[4];
  if(lens){await page.locator(`button[name="lens"][value="${lens}"]`).click();await page.waitForLoadState('networkidle');}
  const views=[];
  for(let view=0;view<6;view++){
   if(view){await page.mouse.move(950,450);await page.mouse.down();await page.mouse.move(1200,450,{steps:30});await page.mouse.up();await page.waitForTimeout(700);}
   views.push(await page.evaluate(async({id,plan,pickerModule})=>{
    const {bindPreparedSurfaceHit}=await import(pickerModule);
    const body=document.querySelector(`.${id}-body`),scene=document.querySelector('.polycss-scene'),camera=document.querySelector('.polycss-camera');
    const pick=bindPreparedSurfaceHit(plan,body,scene,camera,()=>document.querySelector('.planet-stage').dataset.lens),bounds=camera.getBoundingClientRect(),style=getComputedStyle(camera);
    const focal=parseFloat(style.perspective),principal=style.perspectiveOrigin.split(' ').map(parseFloat),offset=[principal[0]-bounds.width/2,principal[1]-bounds.height/2];
    const leaves=[...body.querySelectorAll(':scope > u')].map((leaf,index)=>{
     const style=getComputedStyle(leaf);if(style.display==='none')return null;if(style.backfaceVisibility!=='hidden')throw Error('Open source leaf paints its backface.');
     let m=new DOMMatrix(),node=leaf;
     while(node&&node!==camera){m=new DOMMatrix(getComputedStyle(node).transform).multiply(m);node=node.parentElement;}
     if(node!==camera)throw Error('Native leaf is detached from the camera.');
     const inv=m.inverse(),eye=inv.transformPoint(new DOMPoint(offset[0],offset[1],focal));
     return {index,inv,eye,w:parseFloat(style.width),h:parseFloat(style.height)};
    }).filter(Boolean);
    let bodyMatrix=new DOMMatrix(),ancestor=body;
    while(ancestor&&ancestor!==camera){bodyMatrix=new DOMMatrix(getComputedStyle(ancestor).transform).multiply(bodyMatrix);ancestor=ancestor.parentElement;}
    const projected=plan.triangles.map(triangle=>triangle.map(v=>{const p=bodyMatrix.transformPoint(new DOMPoint(...v)),scale=focal/(focal-p.z);return [bounds.x+principal[0]+(p.x-offset[0])*scale,bounds.y+principal[1]+(p.y-offset[1])*scale]}));
    const edgeDistance=(x,y,faces)=>Math.min(...faces.flatMap(i=>projected[i].map((a,j)=>{const b=projected[i][(j+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)})));
    const insideFace=(x,y,index)=>{
      const [a,b,c]=projected[index], cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
      const sides=[cross(a,b,[x,y]),cross(b,c,[x,y]),cross(c,a,[x,y])];
      return sides.every(v=>v>=0)||sides.every(v=>v<=0);
    };
    let nativeFrontHits=0,clearMisses=0,backfaceOnlyMisses=0,boundarySkipped=0;const mismatches=[],rasterEdgeSamples=[];
    for(let y=90;y<840;y+=24)for(let x=390;x<1380;x+=24){
     if(document.elementFromPoint(x,y)?.closest('.planet-sidebar,button,a,input,summary'))continue;
     let frontInner=false,frontExpanded=false,backInner=false;const nativeFaces=[];
     for(const {index,inv,eye,w,h} of leaves){
      const ray=inv.transformPoint(new DOMPoint(x-bounds.x-principal[0],y-bounds.y-principal[1],-focal,0));
      if(Math.abs(ray.z)<1e-10)continue;const t=-eye.z/ray.z;if(t<0)continue;
      const px=(eye.x+t*ray.x)/w,py=(eye.y+t*ray.y)/h;
      const margin=Math.min(py,1-py,py/2-Math.abs(px-.5));
      if(eye.z>0){frontInner ||= margin>.035;frontExpanded ||= margin>-.035;if(margin>.035)nativeFaces.push(index);}
      else backInner ||= margin>.035;
     }
     if(frontInner){
      const distance=edgeDistance(x,y,nativeFaces);
      // Native bevel rasters overlap the physical plates. A sample outside all
      // contributing physical triangles is overdraw, not a source interior.
      // A pixel-center sample within half a CSS pixel of the source edge is
      // raster-boundary evidence, not an interior targeting assertion. Native
      // u leaves intentionally overlap edges; the picker uses physical plates.
      if(distance<=.5 || !nativeFaces.some(i=>insideFace(x,y,i))){boundarySkipped++;rasterEdgeSamples.push({x,y,distanceCssPixels:distance,kind:distance<=.5?'pixel-boundary':'native-overdraw-outside-source-triangle'});}
      else {nativeFrontHits++;if(!pick(x,y))mismatches.push({x,y,expected:'painted-front',nativeFaces,distanceCssPixels:distance});}
     }
     else if(!frontExpanded){clearMisses++;if(backInner)backfaceOnlyMisses++;if(pick(x,y))mismatches.push({x,y,expected:backInner?'hidden-backface':'empty-space'});}
     else boundarySkipped++;
    }
    return {nativeLeaves:leaves.length,nativeFrontHits,clearMisses,backfaceOnlyMisses,boundarySkipped,rasterEdgeSamples,mismatches,sceneTransform:getComputedStyle(scene).transform};
   },{id,plan,pickerModule}));
  }
  const totals=views.reduce((s,v)=>({hits:s.hits+v.nativeFrontHits,misses:s.misses+v.clearMisses,back:s.back+v.backfaceOnlyMisses,mismatches:s.mismatches+v.mismatches.length}),{hits:0,misses:0,back:0,mismatches:0});
  reports.push({dpr,views,totals});await page.close();
  assert.ok(totals.hits>100&&totals.misses>100&&(!plan.frontFace||!openMesh||totals.back>100),'Must exercise visible terrain and empty space, plus hidden backfaces for an open mesh.');
  assert.equal(totals.mismatches,0,'Prepared picking must match actual painted native triangles away from raster edges.');
 }
 assert.deepEqual(errors,[]);
}finally{
 await mkdir('output/comet-surface-hit',{recursive:true});await writeFile('output/comet-surface-hit/report.json',JSON.stringify({id,lens:process.argv[4]??null,browser:browser.version(),pickerSha256:createHash('sha256').update(pickerBytes).digest('hex'),runtimeSha256:createHash('sha256').update(bytes).digest('hex'),reports,errors},null,2)+'\n');await browser.close();
}
console.log(`PASS ${id}: native front faces and background misses, DPR 1 and 2.`);
