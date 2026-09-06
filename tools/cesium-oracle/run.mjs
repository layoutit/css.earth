import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { acquire, project, sha256 } from './acquire.mjs';
import { startServer } from './server.mjs';
import { geographicFrame } from './camera-match.mjs';
import { imageFixture, observeNetwork } from './network.mjs';
import { writeReport } from './report.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,value]=arg.replace(/^--/,'').split('=');return[key,value??true];}));
const dpr=Number(args.dpr??1);assert.ok([1,2].includes(dpr));
const output=new URL(`output/playwright/cesium-oracle-dpr${dpr}-${Date.now()}/`,project);
await mkdir(output,{recursive:true});
const pin=await acquire(),server=await startServer(output);
const fixture=await imageFixture(new URL('.local/cesium-oracle/imagery-current/',project),{mode:args.replay?'replay':'record',delayMs:Number(args.delay??350)});
const browser=await chromium.launch({channel:'chrome',headless:true});
const contexts=[],pages={},network={},report={schema:'cssearth-cesium-loading-oracle@1',output:output.pathname,dpr,browser:browser.version(),pin,
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim(),sourceHashes:{},config:{...server.config,faces:undefined},
  qualification:'Loading observation with real wheel/drag input in cssEarth. Cesium follows sampled geographic center, roll and local scale. This is not native-input parity, pixel parity, or a performance benchmark. NASA base imagery in cssEarth differs from the WMTS overview in Cesium. Imagery passes through a bounded recording/replay fixture; geometry uses the existing local release.',
  actions:[],checkpoints:[],errors:[],frames:[]};
for(const file of ['src/platform/prepared-map/city-pages.mjs','src/platform/prepared-map/api-image-transport.mjs','src/platform/prepared-map/city-index.mjs','src/platform/prepared-map/page-publication.mjs','src/platform/prepared-map/city-page-selection.mjs','src/planets/earth/runtime/preparedPresentation.mjs'])report.sourceHashes[file]=sha256(await readFile(new URL(file,project)));
for(const name of await readdir(new URL('./',import.meta.url)))if(/\.(mjs|html)$/.test(name)){
  const file='tools/cesium-oracle/'+name;report.sourceHashes[file]=sha256(await readFile(new URL(file,project)));
}
report.preparedFacesSha256=sha256(JSON.stringify(server.config.faces));
let syncTimer=null,syncing=false,phase='boot';
try {
  for(const engine of ['css','cesium']) {
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:dpr,recordVideo:{dir:new URL(engine+'/',output).pathname,size:{width:1280,height:900}}});contexts.push(context);
    await context.addInitScript(()=>{
      const t=window.__loadingOracle={timeOrigin:performance.timeOrigin,events:[],samples:[],frame:0,lastSample:0,overflow:false};
      window.addEventListener('error',e=>{t.error=e.message;});
      window.addEventListener('unhandledrejection',e=>{t.error=String(e.reason);});
      t.event=(type,data)=>{if(t.events.length>=200000){t.overflow=true;return;}t.events.push({at:performance.now(),frame:t.frame,type,...data});};
      const frame=()=>{t.frame++;requestAnimationFrame(frame);};requestAnimationFrame(frame);
      window.addEventListener('wheel',e=>t.event('input-wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode}),{passive:true});
      for(const name of ['pointerdown','pointermove','pointerup'])window.addEventListener(name,e=>{if(e.buttons||name!=='pointermove')t.event(name,{x:e.clientX,y:e.clientY,buttons:e.buttons});},{passive:true});
    });
    await fixture.route(context,engine);
    const page=pages[engine]=await context.newPage();
    page.on('pageerror',error=>report.errors.push({engine,error:error.message}));
    network[engine]=await observeNetwork(context,page);
  }
  await pages.css.goto(server.url+'/earth/');
  await pages.css.waitForFunction(()=>window.__earth?.ready);
  await pages.css.evaluate(()=>{for(const name of ['motion','atmosphere','shadows']){const n=document.querySelector(`input[name="${name}"]`);if(n?.checked)n.click();}});
  await pages.cesium.goto(server.url+'/__oracle/');
  await pages.cesium.waitForFunction(()=>window.__cesiumOracle||window.__loadingOracle?.error,{},{timeout:30000});
  assert.deepEqual(report.errors,[]);
  const sampleCss=()=>pages.css.evaluate(()=>({at:performance.now(),frame:window.__loadingOracle.frame,camera:window.__earth.camera.state(),...window.__earth.runtime.pages().city}));
  async function sync() {
    if(syncing)return;syncing=true;
    try {
      const state=await sampleCss();state.phase=phase;
      const geo=geographicFrame(state.oracle,server.config.faces,server.config.camera);
      const match=await pages.cesium.evaluate(frame=>window.__cesiumOracle.match(frame),geo);
      report.frames.push({at:Date.now(),phase,cssAt:state.at,geographic:geo,match});
      await pages.css.evaluate(s=>window.__loadingOracle.samples.push(s),state);
    } finally {syncing=false;}
  }
  await sync();
  syncTimer=setInterval(()=>sync().catch(error=>{report.errors.push({engine:'registration',error:error.message});clearInterval(syncTimer);}),200);
  const mark=async name=>{phase=name;report.actions.push({phase,at:Date.now()});console.log(JSON.stringify({phase,output:output.pathname}));};
  const checkpoint=async name=>{
    const record={name,phase,at:Date.now(),before:{css:await sampleCss(),cesium:await pages.cesium.evaluate(()=>window.__cesiumOracle.sample())}};
    await Promise.all(['css','cesium'].map(async engine=>{record[engine]=`${name}-${engine}.png`;await pages[engine].screenshot({path:new URL(record[engine],output).pathname});}));
    record.after={css:await sampleCss(),cesium:await pages.cesium.evaluate(()=>window.__cesiumOracle.sample())};record.end=Date.now();
    report.checkpoints.push(record);
    console.log(JSON.stringify({checkpoint:name,zoom:record.before.css.camera.zoom,cssPublished:record.before.css.retained.filter(p=>p.published).length,cesiumDraws:record.before.cesium.draws.length,center:record.before.cesium.registration.center}));
  };
  await mark('initial-globe');await pages.css.waitForTimeout(1200);await checkpoint('01-globe');
  if(!args.smoke){
    // A real place selection establishes the region; the recorded fly-to is
    // observable too. Do not invent a camera pose from a place label.
    await mark('select-buenos-aires');await pages.css.locator('.planet-sidebar-search').fill('Buenos Aires');await pages.css.locator('[data-destination-id="3435910"]').click();
    await pages.css.waitForTimeout(1500);await checkpoint('02-flight-pending');
    await pages.css.waitForTimeout(2500);await checkpoint('03-city-pending');
    const v=(await sampleCss()).oracle.viewport;await pages.css.mouse.move(v.originX,v.originY);
    const wheel=async(direction,count)=>{for(let i=0;i<count;i++){await pages.css.mouse.wheel(0,direction*40*dpr);await pages.css.waitForTimeout(120);}};
    await mark('zoom-out-while-loading');await wheel(1,28);await checkpoint('04-region');
    await mark('reverse-into-city');await wheel(-1,28);await checkpoint('05-reversal');
    await mark('pan-while-loading');await pages.css.mouse.down();for(let i=1;i<=12;i++){await pages.css.mouse.move(v.originX+i*2,v.originY+Math.sin(i/3)*7);await pages.css.waitForTimeout(35);}await pages.css.mouse.up();await checkpoint('06-pan');
    await mark('zoom-out-again');await wheel(1,22);await checkpoint('07-coarse-return');
    await mark('return-to-detail');await wheel(-1,22);await checkpoint('08-detail-return');
  }
  await mark('final-drain');await pages.css.waitForTimeout(Number(args.drain??5000));await checkpoint('09-final');
  clearInterval(syncTimer);syncTimer=null;while(syncing)await pages.css.waitForTimeout(10);
  report.traces={};report.network={};
  for(const engine of ['css','cesium']){
    report.traces[engine]=await pages[engine].evaluate(()=>{const t=window.__loadingOracle;return {timeOrigin:t.timeOrigin,events:t.events,samples:t.samples,overflow:t.overflow};});
    report.network[engine]={events:network[engine].events,requests:[...network[engine].requests.values()]};
  }
  assert.deepEqual(report.errors,[]);assert.ok(Object.values(report.traces).every(t=>!t.overflow),'No observation overflow');
  assert.ok(!report.traces.cesium.events.some(e=>e.type==='render-error'),'No Cesium renderer failure');
  const centers=report.traces.cesium.samples.flatMap(s=>(s.registration.anchors??[]).filter(a=>a.screen[0]===s.registration.center.screen[0]&&a.screen[1]===s.registration.center.screen[1]));
  report.registration={centerSamples:centers.length,maximumCenterErrorPixels:Math.max(...centers.map(a=>a.errorPixels))};
  assert.ok(centers.length>5&&centers.every(a=>Number.isFinite(a.errorPixels)&&a.errorPixels<1),'Geographic camera center stays registered');
  assert.ok(report.traces.cesium.samples.some(s=>s.draws.some(d=>d.images.length)),'Observed Cesium texture draw commands');
  assert.ok(report.traces.cesium.events.some(e=>e.type==='imagery-state'&&e.state==='RECEIVED'),'Observed image received stage');
  assert.ok(report.traces.cesium.events.some(e=>e.type==='imagery-state'&&e.state==='TEXTURE_LOADED'),'Observed GPU texture stage');
  assert.ok(report.traces.cesium.samples.every(s=>s.draws.every(d=>d.images.every(i=>!i.unknown))),'All drawn textures mapped to imagery identity');
  if(!args.smoke){assert.ok(report.traces.css.events.some(e=>e.type==='image-decode-end'));assert.ok(report.traces.css.events.some(e=>e.type==='page-publish'));}
  for(const [file,hash] of Object.entries(report.sourceHashes))assert.equal(sha256(await readFile(new URL(file,project))),hash,`Loaded source changed during capture: ${file}`);
  report.complete=true;
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}
finally {
  if(syncTimer)clearInterval(syncTimer);
  report.traces??={};report.network??={};
  for(const engine of Object.keys(pages)){
    report.traces[engine]??=await pages[engine].evaluate(()=>{const t=window.__loadingOracle;return t?{timeOrigin:t.timeOrigin,events:t.events,samples:t.samples,overflow:t.overflow}:null;}).catch(()=>null);
    report.network[engine]??={events:network[engine].events,requests:[...network[engine].requests.values()]};
  }
  await fixture.close();
  report.fixture={...fixture.stats(),errors:fixture.errors,deliveries:fixture.deliveries};
  if(fixture.errors.length){report.complete=false;process.exitCode=1;}
  report.videos={};for(const engine of Object.keys(pages))report.videos[engine]=await pages[engine].video().path();
  await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();await server.close();
  report.closed=true;
  await writeFile(new URL('report.json',output),JSON.stringify(report)+'\n');
  await writeReport(report,output);
  console.log(JSON.stringify({output:output.pathname,complete:report.complete??false,errors:report.errors,fixture:fixture.stats()}));
}
