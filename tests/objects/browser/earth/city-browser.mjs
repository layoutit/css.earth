import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { readCityFixture } from "../../unit/earth/city-fixture.mjs";
import { PREPARED_EARTH_SCENE, preparePagingDiagnostic, routePagingDiagnostic } from "../../unit/earth/prepared-fixture.mjs";
import { PREPARED_EARTH_CITY_PAGES } from "../../unit/earth/prepared-fixture.mjs";
import { prepareCityPageGeometry } from "../../../../tools/objects/geographic-pages/page-geometry.mjs";
import { projectCityPage } from "../../../../src/renderers/css/dist/testing.js";
import { readWorldCoverCatalog, sourceTilesForBounds } from "../../../../tools/objects/geographic-pages/worldcover-catalog.mjs";

const fixture = await readCityFixture();

const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? "http://127.0.0.1:4210").replace(/\/$/u, "");
const boundaryOnly = process.argv.includes('--boundary-only');
const motionOnly = process.argv.includes('--motion-only');
const handoffOnly = process.argv.includes('--handoff-only');
const localFixture = process.argv.includes('--local-fixture');
const selectedRoot = process.argv.find(arg=>arg.startsWith('--root='))?.slice(7);
const outputTag=process.argv.find(arg=>arg.startsWith('--output-tag='))?.slice(13);
if(outputTag&&!/^[a-z0-9-]+$/.test(outputTag))throw new Error('Invalid output tag.');
if(selectedRoot&&!process.argv.includes('--visual-only')&&!motionOnly)throw new Error('--root requires a focused visual or motion check.');
if(selectedRoot&&!fixture.roots.includes(selectedRoot))throw new Error(`Unknown city proof root: ${selectedRoot}`);
const output = new URL(outputTag ? `../../../../output/playwright/earth-city-${outputTag}/` : motionOnly ? "../../../../output/playwright/earth-city-motion/" : selectedRoot ? "../../../../output/playwright/earth-city-focused/" : boundaryOnly ? "../../../../output/playwright/earth-city-boundary-diagnostic/" : process.argv.includes('--mobile')
  ? "../../../../output/playwright/earth-city-mobile/"
  : "../../../../output/playwright/earth-city/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const reports = [];
const run = promisify(execFile);
const browserSession = await browser.newBrowserCDPSession();
const mobile = process.argv.includes('--mobile');
const visualOnly = process.argv.includes('--visual-only') || boundaryOnly;
const densities = mobile || visualOnly || motionOnly || handoffOnly ? [2] : [1,2];
try {
  for (const dpr of densities) {
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1400,height:1000}, deviceScaleFactor:dpr, isMobile:mobile, hasTouch:mobile });
    const page = await context.newPage();
    const urls = new Set(), indexUrls = new Set(), errors = [], navigations = [];
    page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push({url:frame.url(),at:Date.now()});});
    page.on("request", request => { if(/\/city-[^/]+\.webp$/.test(request.url())) urls.add(request.url()); });
    page.on("request", request => { if(/\/city-index-[^/]+\.json$/.test(request.url())) indexUrls.add(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    try {
      if(localFixture){
        await routePagingDiagnostic(page,await preparePagingDiagnostic(fixture.plan));
        await page.route('**/city-index-*.json',route=>{
          const directory=fixture.directories.get(route.request().url());
          if(!directory)throw new Error('Missing local proof directory');
          return route.fulfill({contentType:'application/json',body:directory.bytes});
        });
        await page.route('**/city-*.webp',async route=>{
          const pathname=new URL(route.request().url()).pathname;
          const bytes=await readFile(new URL(`../../../../.local/earth-city-publish/${fixture.plan.dataset}${pathname}`,import.meta.url));
          return route.fulfill({contentType:'image/webp',body:bytes});
        });
      }
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => window.__earth?.ready);
      const documentTimeOrigin=await page.evaluate(()=>performance.timeOrigin);
      await page.evaluate(({pages,roots}) => {
        { const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); }
        window.__cityPlan = {pages,roots};
        window.__cityNodes = [...document.querySelector('.planet-stage').querySelectorAll('*')];
        window.__cityLongTasks = [];
        new PerformanceObserver(list => window.__cityLongTasks.push(...list.getEntries().map(e=>e.duration)))
          .observe({type:'longtask',buffered:false});
      }, {pages:fixture.pages, roots:fixture.roots});
      if(motionOnly) {
        reports.push(await measureCityMotion(page,selectedRoot??fixture.roots[0]));
        continue;
      }
      if(handoffOnly) {
        reports.push({dpr,browser:browser.version(),delivery:localFixture?'Pinned local proof bytes; remote delivery not tested':'Remote R2',faultProof:await checkCityHandoff(page,fixture.roots[0],dpr)});
        continue;
      }
      const roots = (await page.evaluate(() => window.__cityPlan.roots)).filter(root=>!selectedRoot||root===selectedRoot);
      const memory = dpr === 2 && !visualOnly ? {baseline:await processMemory('baseline')} : null;
      const transitions = [];
      const boundaries = [];
      for (const root of boundaryOnly ? [] : roots) {
        const pose = await aim(page, root);
        for (const zoom of [1.1, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]) {
          await page.evaluate(zoom => window.__earth.camera.setState({zoom}), zoom);
          await settle(page);
          const state = await snapshot(page);
          assert.equal(state.stable, true);
          assert.equal(state.identical, true);
          assert.ok(state.city.retained.length <= state.city.poolSize);
          assert.ok(state.city.reservedDecodedBytes<=state.city.decodedPageByteBound);
          assert.deepEqual(state.city.errors, []);
          assert.deepEqual(state.city.index.errors, []);
          assert.ok(state.city.index.reservedEncodedBytes <= state.city.index.maximumBytes);
          assert.ok(state.city.index.residentDirectories <= state.city.index.maximumDirectories);
          if (zoom > 8) assert.ok(state.city.retained.some(s=>s.published), `${root} zoom ${zoom}`);
          else assert.equal(state.city.retained.length,0,'The accepted globe through 8x stays unchanged');
          if (dpr === 2 && [1.1,4,8,32,128,2048,4096].includes(zoom)) {
            await page.screenshot({path:new URL(`${root}-zoom-${zoom}.png`,output).pathname});
          }
          transitions.push({root,zoom,pose,state});
        }
      }
      // A geographic edge shared by two different accepted coarse faces. Aim at
      // the edge itself, not each page's center where a discontinuity is hidden.
      for(const edge of selectedRoot?[]:[
        {key:'5-319-348',prefix:'face-boundary',longitude:112.5},
        {key:'5-511-208',prefix:'antimeridian',longitude:180,latitude:-16.8},
        {key:'5-511-208',prefix:'antimeridian-source-gap',longitude:180,latitude:-16.685},
      ]) {
        const boundary = fixture.pages.find(p=>p.key===edge.key);
        if(!boundary)continue;
        const f=boundary.frameMatrix.split(',').map(Number),t=boundary.textureMatrix.split(',').map(Number);
        const m=prepareCityPageGeometry(boundary,PREPARED_EARTH_SCENE).geographicMatrix;
        const lon=edge.longitude,lat=edge.latitude;
        let v=.5,u=(lon*(m[7]*v+m[8])-m[1]*v-m[2])/(m[0]-lon*m[6]);
        if(lat!==undefined) {
          const a=m[0]-lon*m[6],b=m[1]-lon*m[7],c=lon*m[8]-m[2];
          const d=m[3]-lat*m[6],e=m[4]-lat*m[7],g=lat*m[8]-m[5],det=a*e-b*d;
          u=(c*e-b*g)/det;v=(a*g-c*d)/det;
        }
        assert.ok(u>=0&&u<=1&&v>=0&&v<=1,'The edge target must lie in the prepared source page');
        const x=1024*u,y=1024*v,w=t[3]*x+t[7]*y+t[15];
        const point=[0,1,2].map(i=>f[i]*x/w+f[i+4]*y/w+f[i+12]);
        const pose=await aim(page,boundary.key,point);
        for(const zoom of [128,512,2048,4096]) {
          await page.evaluate(zoom=>window.__earth.camera.setState({zoom}),zoom);
          await settle(page);
          const state=await snapshot(page);
          assert.equal(state.identical,true);
          assert.ok(state.city.retained.some(slot=>slot.published));
          boundaries.push({edge,zoom,pose,state});
          await page.screenshot({path:new URL(`${edge.prefix}-zoom-${zoom}.png`,output).pathname});
          if(boundaryOnly) {
            await page.evaluate(()=>{
              window.__coarseVisibility=[...document.querySelectorAll('.earth-surface-leaf')].map(n=>[n,n.style.visibility]);
              window.__coarseVisibility.forEach(([n])=>{n.style.visibility='hidden';});
            });
            await page.screenshot({path:new URL(`${edge.prefix}-no-coarse-zoom-${zoom}.png`,output).pathname});
            await page.evaluate(()=>window.__coarseVisibility.forEach(([n,visibility])=>{n.style.visibility=visibility;}));
            await writeFile(new URL(`${edge.prefix}-${zoom}.json`,output),JSON.stringify(await snapshot(page),null,2));
          }
        }
        for(const collapsed of mobile||edge.prefix!=='face-boundary' ? [] : [true,false]) {
          const before=await page.evaluate(()=>window.__earth.runtime.pages().city.selectionRuns);
          await page.locator('.planet-sidebar-toggle').click();
          await page.waitForFunction(before=>window.__earth.runtime.pages().city.selectionRuns>before,before);
          await settle(page);
          assert.equal(await page.evaluate(()=>document.body.dataset.sidebarCollapsed==='true'),collapsed);
          assert.equal((await snapshot(page)).identical,true);
          if(dpr===2)await page.screenshot({path:new URL(`boundary-sidebar-${collapsed?'collapsed':'expanded'}.png`,output).pathname});
        }
      }
      if(visualOnly) {
        reports.push({dpr,transitions,boundaries,urls:[...urls].sort(),indexUrls:[...indexUrls].sort(),errors});
        continue;
      }
      await aim(page, roots[1]??roots[0]);
      await page.evaluate(()=>window.__earth.camera.setState({zoom:2048}));
      await settle(page);
      const cdp = await context.newCDPSession(page);
      if(memory)memory.city=await processMemory('city');
      const endurance=[];
      if(dpr===2&&process.argv.includes('--endurance')) {
        for(let cycle=0;cycle<8;cycle++) {
          for(const root of roots) {
            await aim(page,root);
            await page.evaluate(()=>window.__earth.camera.setState({zoom:4096}));
            await settle(page);
            const state=await snapshot(page);
            assert.ok(state.city.retained.length<=state.city.poolSize);
            assert.ok(state.city.reservedDecodedBytes<=state.city.decodedPageByteBound);
            assert.ok(state.city.retained.every(slot=>slot.published));
            assert.equal(state.identical,true);
          }
          await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
          await settle(page);
          await page.waitForTimeout(1500);
          const state=await snapshot(page);
          assert.equal(state.city.retained.length,0);
          assert.equal(state.city.index.residentDirectories,0);
          endurance.push({cycle,state,memory:await processMemory(`cycle-${cycle}`)});
        }
        await aim(page,roots[1]);
        await page.evaluate(()=>window.__earth.camera.setState({zoom:2048}));
        await settle(page);
      }
      await cdp.send('Performance.enable');
      await cdp.send('Tracing.start',{categories:'-*,benchmark,cc,devtools.timeline,blink.user_timing,toplevel,disabled-by-default-devtools.timeline.frame',transferMode:'ReturnAsStream'});
      const before = await cdp.send('Performance.getMetrics');
      const inputBefore=await page.evaluate(()=>({stats:window.__earth.camera.stats(),scroll:scrollY}));
      const input=await page.locator('.planet-input-surface').boundingBox();
      const sidebar=await page.locator('.planet-sidebar').boundingBox();
      const anchor=mobile?{x:input.x+input.width*.6,y:Math.min(input.y+input.height*.5,sidebar.y*.5)}:{x:950,y:550};
      assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.classList.contains('earth-input-surface'),anchor),true,'Drag must start on the scene input surface');
      if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...anchor,id:1}]});
      else{await page.mouse.move(anchor.x,anchor.y);await page.mouse.down();}
      for(let i=1;i<=90;i++) {
        const point={x:anchor.x+(mobile?45:120)*Math.sin(i/90*Math.PI*2),y:anchor.y+(mobile?25*(1-Math.cos(i/90*Math.PI*4))/2:80*Math.sin(i/90*Math.PI*4))};
        if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
        else await page.mouse.move(point.x,point.y);
        await page.waitForTimeout(16);
      }
      if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      else await page.mouse.up();
      await page.waitForTimeout(300);
      const inputAfter=await page.evaluate(()=>({stats:window.__earth.camera.stats(),scroll:scrollY}));
      assert.ok(inputAfter.stats.interactionStarts>inputBefore.stats.interactionStarts,'Drag must reach the camera, not only scroll the page');
      assert.ok(inputAfter.stats.publications-inputBefore.stats.publications>30,'Drag must publish actual camera movement');
      if(mobile)assert.equal(inputAfter.scroll,inputBefore.scroll,'The city drag must not become page scroll');
      const after = await cdp.send('Performance.getMetrics');
      const complete = new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
      await cdp.send('Tracing.end');
      const {stream} = await complete;
      let json='';
      for(;;){ const chunk=await cdp.send('IO.read',{handle:stream}); json+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString():chunk.data;if(chunk.eof)break; }
      await cdp.send('IO.close',{handle:stream});
      await writeFile(new URL(`drag-dpr${dpr}.json.gz`,output),gzipSync(json));
      const trace = JSON.parse(json);
      const frameStates = {};
      let missing=0,checkerboarded=0;
      for(const event of trace.traceEvents){const f=event.args?.frame_reporter;if(!f)continue;frameStates[f.state]=(frameStates[f.state]??0)+1;missing+=Number(Boolean(f.has_missing_content));checkerboarded+=Number(Boolean(f.checkerboarded_needs_raster||f.checkerboarded_needs_record));}
      const metricDelta = Object.fromEntries(after.metrics.filter(m=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize','Nodes','LayoutCount','RecalcStyleCount'].includes(m.name)).map(m=>[m.name,m.value-(before.metrics.find(b=>b.name===m.name)?.value??0)]));
      await page.screenshot({path:new URL(`after-drag-dpr${dpr}.png`,output).pathname});
      const afterDrag = await snapshot(page);
      assert.equal(afterDrag.stable,true);
      assert.equal(afterDrag.identical,true);
      if(memory) {
        await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
        await settle(page);
        await page.waitForTimeout(2000);
        memory.releasedNormal=await processMemory('released-normal');
        await aim(page,roots[1]);
        await page.evaluate(()=>window.__earth.camera.setState({zoom:2048}));
        await settle(page);
      }
      for (const [shadows,atmosphere] of [[false,false],[true,false],[true,true],[false,true]]) {
        await page.evaluate(({shadows,atmosphere})=>{
          for(const [name,value] of Object.entries({shadows,atmosphere})) {
            const input=document.querySelector(`input[name="${name}"]`);
            input.checked=value;input.dispatchEvent(new Event('change',{bubbles:true}));
          }
        },{shadows,atmosphere});
        await page.waitForFunction(()=>{
          return window.__earth.runtime.resources().pools
            .filter(pool=>["lighting","atmosphere"].includes(pool.id)).every(pool=>pool.pending===0);
        });
        await settle(page);
        assert.deepEqual(await page.evaluate(()=>window.__earth.features.state()),{shadows,atmosphere});
        assert.equal((await snapshot(page)).stable,true);
        if(dpr===2)await page.screenshot({path:new URL(`shadows-${shadows}-atmosphere-${atmosphere}.png`,output).pathname});
      }
      if(!mobile)await page.mouse.dblclick(930,520);
      await page.waitForTimeout(1200);
      const afterDoubleClick=await snapshot(page);
      assert.equal(afterDoubleClick.identical,true);
      assert.ok(afterDoubleClick.camera.zoom<=4096);
      for(const lens of ['topography','night-lights','cross-section']) {
        await page.evaluate(lens=>window.__earth.lenses.select(lens),lens);
        await page.evaluate(()=>window.__earth.camera.setState({zoom:4096}));
        await settle(page);
        const state=await snapshot(page);
        assert.equal(state.camera.zoom,8);
        assert.equal(state.city.retained.length,0);
      }
      await page.evaluate(()=>window.__earth.lenses.select('normal'));
      await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
      await settle(page);
      assert.equal((await snapshot(page)).city.retained.length,0);
      if(memory)memory.afterOtherLenses=await processMemory('after-other-lenses');
      assert.deepEqual(errors,[]);
      const faultProof=await checkCityHandoff(page,roots[0],dpr);
      await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
      await settle(page);
      await page.route('**/city-*.webp',async route=>{
        await new Promise(resolve=>setTimeout(resolve,300));
        await route.continue().catch(()=>{});
      });
      await page.evaluate(()=>window.__earth.camera.setState({zoom:2048}));
      await page.waitForFunction(()=>window.__earth.runtime.pages().city.activeLoads>0);
      await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
      await settle(page);
      await page.waitForTimeout(350);
      faultProof.cancelled=await snapshot(page);
      assert.equal(faultProof.cancelled.city.retained.length,0);
      assert.ok(faultProof.cancelled.city.aborts>0);
      assert.equal(faultProof.cancelled.identical,true);
      await page.unroute('**/city-*.webp');
      await page.route('**/city-*.webp',route=>route.fulfill({status:503,body:'controlled city-page failure'}));
      await page.evaluate(zoom=>window.__earth.camera.setState({zoom}),mobile?1024:256);
      await settle(page);
      faultProof.failed=await snapshot(page);
      assert.ok(faultProof.failed.city.errors.some(error=>error.includes('HTTP 503')));
      const failedRequests=faultProof.failed.city.requests;
      await page.waitForTimeout(200);
      assert.equal((await snapshot(page)).city.requests,failedRequests,'Failed pages must not retry every frame');
      await page.unroute('**/city-*.webp');
      await page.evaluate(()=>window.__earth.camera.setState({zoom:1.1}));
      await settle(page);
      await page.evaluate(zoom=>window.__earth.camera.setState({zoom}),mobile?1024:256);
      await settle(page);
      assert.ok((await snapshot(page)).city.retained.some(slot=>slot.ready),'A revisit must recover after failure');
      assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTimeOrigin,
        'A dev-server reload invalidates this browser run');
      reports.push({dpr,mobile,browser:browser.version(),memory,endurance,transitions,boundaries,inputBefore,inputAfter,afterDrag,afterDoubleClick,faultProof,frameStates,missing,checkerboarded,metricDelta,urls:[...urls].sort(),indexUrls:[...indexUrls].sort(),errors,navigations});
    } catch (error) {
      await writeFile(new URL(`failure-dpr${dpr}.json`,output),JSON.stringify({error:error.message,
        state:await snapshot(page).catch(failure=>({unavailable:failure.message})),pageErrors:errors,navigations},null,2));
      await page.screenshot({path:new URL(`failure-dpr${dpr}.png`,output).pathname});
      throw error;
    } finally { await context.close(); }
  }
  for(const report of reports)for(const url of [...report.urls??[],...report.indexUrls??[]])
    assert.equal(new URL(url).origin,PREPARED_EARTH_CITY_PAGES.assetOrigin,
      'Every city request must use the pinned R2 origin');
  if(reports.length===2){
    const canonical=new Map(fixture.pages.map(page=>[page.key,page.url]));
    const canonicalUrls=new Set(canonical.values());
    for(const report of reports) {
      for(const url of report.urls)assert.ok(canonicalUrls.has(url),'Every request must belong to the canonical dataset');
      for(const transition of report.transitions)for(const key of transition.state.city.desired)
        assert.ok(report.urls.includes(canonical.get(key)),'Each selected prepared page must have been requested');
    }
    // Compare matched views, not entire runs: DPR 2 also performs endurance and
    // memory probes, which deliberately visit extra pages after these views.
    const matched=report=>report.transitions.map(({root,zoom,state})=>({root,zoom,
      urls:state.city.desired.map(key=>canonical.get(key)).sort()}));
    assert.deepEqual(matched(reports[0]),matched(reports[1]),'Matched DPR views must request the same canonical surface URLs');
    const edges=report=>report.boundaries.map(({edge,zoom,state})=>({edge,zoom,urls:state.city.desired.map(key=>canonical.get(key)).sort()}));
    assert.deepEqual(edges(reports[0]),edges(reports[1]),'Matched geographic edges must use the same DPR-independent pages');
    assert.deepEqual(reports[0].indexUrls,reports[1].indexUrls,'DPR must not select another spatial index');
  }
} finally {
  await writeFile(new URL('report.json',output),JSON.stringify(reports,null,2));
  await browser.close();
}
console.log(JSON.stringify(reports.map(({transitions,...report})=>({...report,transitions:transitions?.length})),null,2));

async function measureCityMotion(page,root) {
  const {entries}=await readWorldCoverCatalog({directory:new URL('../../../../src/planets/earth/source/city/',import.meta.url)});
  const availableRoots=[];
  for(let y=0;y<16;y++)for(let x=0;x<(y===0||y===15?1:32);x++) {
    const geometry=prepareCityPageGeometry({level:0,x,y},PREPARED_EARTH_SCENE);
    if(sourceTilesForBounds(geometry.sourceBounds,entries).available.length)availableRoots.push(geometry);
  }
  // Prepared geometry and publisher availability only: these roots are not
  // injected into the scene or presented as globally prepared imagery.
  const coverage=[];
  const captureView=()=>page.evaluate(()=>{
    const camera=document.querySelector('.polycss-camera'),stage=document.querySelector('.planet-stage');
    const m=new DOMMatrix(getComputedStyle(document.querySelector('.polycss-scene')).transform)
      .multiply(new DOMMatrix(getComputedStyle(document.querySelector('.earth-system')).transform))
      .multiply(new DOMMatrix(getComputedStyle(document.querySelector('.earth-body:not(.earth-body-polar)')).transform));
    const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
    return {matrix:Array.from(m.toFloat64Array()),scale:parseFloat(getComputedStyle(camera).scale),
      viewport:{width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top}};
  });
  for(const key of fixture.roots) {
    await aim(page,key);
    for(const zoom of [8.01,16,32]) {
      await page.evaluate(zoom=>window.__earth.camera.setState({zoom}),zoom);
      const view=await captureView();
      const visible=availableRoots.filter(p=>{const q=projectCityPage(p,view.matrix,view.scale,view.viewport);return q.visible&&q.span>=96;});
      coverage.push({root:key,zoom,visibleAvailableRoots:visible.length,keys:visible.map(p=>p.key)});
    }
  }
  await aim(page,root);
  await page.evaluate(()=>window.__earth.camera.setState({zoom:4096}));
  await settle(page);
  await page.screenshot({path:new URL('before-playback.png',output).pathname});
  const before=await snapshot(page);
  await page.locator('.planet-settings-action').click();
  await page.evaluate(()=>{
    window.__cityMotionRecords=[];
    window.__cityMotionStop=false;
    const camera=document.querySelector('.polycss-camera'),stage=document.querySelector('.planet-stage');
    const scene=document.querySelector('.polycss-scene'),system=document.querySelector('.earth-system'),carrier=document.querySelector('.earth-body:not(.earth-body-polar)');
    const c=camera.getBoundingClientRect(),s=stage.getBoundingClientRect();
    const viewport={width:stage.clientWidth,height:stage.clientHeight,originX:c.left+c.width/2-s.left,originY:c.top+c.height/2-s.top};
    const collect=()=>{
      if(window.__cityMotionStop)return;
      const m=new DOMMatrix(getComputedStyle(scene).transform).multiply(new DOMMatrix(getComputedStyle(system).transform)).multiply(new DOMMatrix(getComputedStyle(carrier).transform));
      window.__cityMotionRecords.push({time:performance.now(),playing:document.documentElement.dataset.playing==='true',
        matrix:Array.from(m.toFloat64Array()),scale:parseFloat(getComputedStyle(camera).scale),viewport,city:window.__earth.runtime.pages().city});
      requestAnimationFrame(collect);
    };
    requestAnimationFrame(collect);
  });
  await page.locator('.planet-motion-setting-control').click();
  await page.waitForFunction(()=>document.documentElement.dataset.playing==='true');
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{window.__cityMotionStop=true;{ const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); }});
  await page.locator('.planet-settings-action').click();
  await settle(page);
  const records=await page.evaluate(()=>window.__cityMotionRecords);
  const after=await snapshot(page);
  await page.screenshot({path:new URL('after-playback.png',output).pathname});
  const prepared=fixture.pages.find(p=>p.key===root),start=records.find(r=>r.playing)?.time;
  const samples=records.filter(r=>r.playing).map(record=>{
    const projection=projectCityPage(prepared,record.matrix,record.scale,record.viewport);
    return {...record,elapsed:record.time-start,originalFootprintVisible:projection.visible};
  });
  assert.ok(samples.length>30,'Playback must produce a real camera-relative motion sample');
  assert.equal(after.identical,true);assert.equal(after.stable,true);
  assert.ok(samples.every(r=>r.city.retained.length<=before.city.poolSize));
  assert.ok(samples.every(r=>r.city.reservedDecodedBytes<=r.city.decodedPageByteBound));
  assert.ok(samples.every(r=>r.city.activeLoads<=3));
  assert.notDeepEqual(samples[0].matrix,samples.at(-1).matrix,'The actual Earth carrier must rotate');
  await writeFile(new URL('motion-samples.json',output),JSON.stringify(samples));
  return {qualification:'Instrumented actual playback plus prepared-root geometry diagnostic; not global imagery or isolated performance proof.',
    dpr:2,browser:browser.version(),root,coverage,visibleCapacity:before.city.poolSize/2,
    samples:samples.length,firstOriginalFootprintExitMs:samples.find(r=>!r.originalFootprintVisible)?.elapsed??null,
    requestDelta:after.city.requests-before.city.requests,abortDelta:after.city.aborts-before.city.aborts,
    publicationDelta:after.city.publications-before.city.publications,before,after};
}

async function processMemory(label) {
  const {processInfo}=await browserSession.send('SystemInfo.getProcessInfo');
  const measured=[];
  for(const process of processInfo.filter(p=>['browser','renderer','GPU'].includes(p.type))) {
    const {stdout}=await run('vmmap',['-summary',String(process.id)],{maxBuffer:4*1024*1024});
    await writeFile(new URL(`memory-${label}-${process.type}-${process.id}.txt`,output),stdout);
    measured.push({pid:process.id,type:process.type,summary:stdout.split('\n').filter(line=>/Physical footprint|IOAccelerator|IOSurface/.test(line))});
  }
  return measured;
}

async function checkCityHandoff(page,root,dpr) {
  await aim(page,root);
  await page.evaluate(()=>window.__earth.camera.setState({zoom:16}));
  await settle(page);
  const priorView=(await snapshot(page)).city.retained.filter(slot=>slot.published).map(slot=>slot.key).sort();
  assert.ok(priorView.length,`Handoff starts from a painted city page: ${JSON.stringify((await snapshot(page)).city)}`);
  // Keep the original DOM references so Chrome can measure their projected
  // bounds after zoom. Offscreen pages may be released; onscreen coverage may not.
  await page.evaluate(()=>{window.__handoffLeaves=[...document.querySelectorAll('.earth-city-page')]
    .filter(leaf=>leaf.style.visibility==='visible').map(leaf=>({key:leaf.dataset.cityPage,leaf}));});
  const proof={priorView};
  let releaseHandoff;
  const handoffGate=new Promise(resolve=>{releaseHandoff=resolve;});
  const pauseHandoff=async route=>{await handoffGate;await route.fallback().catch(()=>{});};
  await page.route('**/city-*.webp',pauseHandoff);
  try {
    await page.evaluate(()=>window.__earth.camera.setState({zoom:4096}));
    await page.waitForFunction(()=>window.__earth.runtime.pages().city.activeLoads>0);
    proof.handoffPending=await snapshot(page);
    proof.priorPageBounds=await page.evaluate(()=>{
      const stage=document.querySelector('.planet-stage').getBoundingClientRect();
      return window.__handoffLeaves.map(({key,leaf})=>{
        const r=leaf.getBoundingClientRect();
        return {key,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
          intersects:r.left<stage.right&&r.right>stage.left&&r.top<stage.bottom&&r.bottom>stage.top,
          painted:leaf.style.visibility==='visible'&&leaf.dataset.cityPage===key};
      });
    });
    const visiblePrior=proof.priorPageBounds.filter(page=>page.intersects);
    assert.ok(visiblePrior.length,'Handoff must exercise existing onscreen coverage');
    assert.ok(visiblePrior.every(page=>page.painted),'Every onscreen prior page must stay painted during replacement loads');
    assert.ok(proof.handoffPending.city.retained.filter(slot=>slot.published).every(slot=>priorView.includes(slot.key)),
      'No replacement may publish before all replacements decode');
    if(dpr===2)await page.screenshot({path:new URL('handoff-pending.png',output).pathname});
  } finally {releaseHandoff();await page.unroute('**/city-*.webp',pauseHandoff);}
  await settle(page);
  proof.handoffReady=await snapshot(page);
  assert.deepEqual(proof.handoffReady.city.retained.filter(slot=>slot.published).map(slot=>slot.key).sort(),
    [...proof.handoffReady.city.desired].sort());
  assert.equal(proof.handoffReady.city.retained.length,proof.handoffReady.city.desired.length);
  if(dpr===2)await page.screenshot({path:new URL('handoff-ready.png',output).pathname});
  return proof;
}

async function settle(page) {
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.waitForFunction(()=>{
    const s=window.__earth.runtime.pages().city;return !s.pendingSelection && s.activeLoads===0 && s.index.activeLoads===0;
  });
}

async function snapshot(page) {
  return page.evaluate(()=>({city:window.__earth.runtime.pages().city,camera:window.__earth.camera.state(),
    stable:window.__earth.assertStableDomIdentity(),nodes:document.querySelector('.planet-stage').querySelectorAll('*').length,
    identical:[...document.querySelector('.planet-stage').querySelectorAll('*')].every((n,i)=>n===window.__cityNodes[i]),
    longTasks:[...window.__cityLongTasks]}));
}

// Diagnostic aiming only. Production selects prepared bounds; it does not run
// this numerical camera search or derive geographic geometry.
async function aim(page,key,targetPoint) {
  return page.evaluate(({key,targetPoint})=>{
    const page=window.__cityPlan.pages.find(p=>p.key===key);
    const point=targetPoint??page.corners.reduce((v,p)=>v.map((x,i)=>x+p[i]/4),[0,0,0]);
    const scene=document.querySelector('.polycss-scene'),system=document.querySelector('.earth-system'),carrier=document.querySelector('.earth-body:not(.earth-body-polar)');
    const error=()=>{const m=new DOMMatrix(getComputedStyle(scene).transform).multiply(new DOMMatrix(getComputedStyle(system).transform)).multiply(new DOMMatrix(getComputedStyle(carrier).transform));const p=m.transformPoint(new DOMPoint(...point));return[p.x,p.y,p.z];};
    const move=(pitch,yaw)=>{const c=window.__earth.camera.state();window.__earth.camera.setState({controlPitch:c.controlPitch+pitch,controlYaw:c.controlYaw+yaw});};
    window.__earth.camera.setState({zoom:1.1});
    let best={score:Infinity,pitch:0,yaw:0};
    for(let pitch=0;pitch<360;pitch+=30)for(let yaw=0;yaw<360;yaw+=30){window.__earth.camera.setState({controlPitch:pitch,controlYaw:yaw});const p=error();const score=p[2]>0?Math.hypot(p[0],p[1]):Infinity;if(score<best.score)best={score,pitch,yaw};}
    window.__earth.camera.setState({controlPitch:best.pitch,controlYaw:best.yaw});
    for(let i=0;i<12;i++){
      const e=error();if(Math.hypot(e[0],e[1])<.02)break;
      move(.1,0);const a=error();move(-.1,0);move(0,.1);const b=error();move(0,-.1);
      const ax=(a[0]-e[0])/.1,ay=(a[1]-e[1])/.1,bx=(b[0]-e[0])/.1,by=(b[1]-e[1])/.1,d=ax*by-bx*ay;
      if(Math.abs(d)<1e-8)throw new Error('City camera search is singular');
      move(Math.max(-20,Math.min(20,(-e[0]*by+bx*e[1])/d)),Math.max(-20,Math.min(20,(-ax*e[1]+e[0]*ay)/d)));
    }
    const p=error();if(p[2]<=0||Math.hypot(p[0],p[1])>.1)throw new Error('City camera did not reach the target');
    return window.__earth.camera.state();
  },{key,targetPoint});
}
