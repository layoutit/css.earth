import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { acquire, project, sha256 } from './acquire.mjs';
import { startServer } from './server.mjs';
import { imageFixture, observeNetwork } from './network.mjs';
import { writeReport } from './report.mjs';

const dpr=Number(process.argv.find(a=>a.startsWith('--dpr='))?.slice(6)??1);
assert.ok([1,2].includes(dpr));
const output=new URL(`output/playwright/cesium-explore-dpr${dpr}-${Date.now()}/`,project);await mkdir(new URL('frames/',output),{recursive:true});
const pin=await acquire(),server=await startServer(output),browser=await chromium.launch({channel:'chrome',headless:true});
const fixture=await imageFixture(new URL('.local/cesium-oracle/imagery-current/',project),{delayMs:350});
const report={schema:'cssearth-cesium-loading-oracle@1',dpr,pin,browser:browser.version(),actions:[],checkpoints:[],errors:[],sourceHashes:{},
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim(),
  qualification:'Continuous real interaction in cssEarth; Cesium follows the prepared geographic view every animation frame. Video and lifecycle events share recorded frame timestamps. The imagery fixture adds 350 ms per response. This is a loading comparison, not native-input parity or a performance benchmark.'};
for(const name of await readdir(new URL('./',import.meta.url)))if(/\.(mjs|html)$/.test(name)){const file='tools/cesium-oracle/'+name;report.sourceHashes[file]=sha256(await readFile(new URL(file,project)));}
for(const name of ['city-pages','city-index','api-image-transport','page-publication','city-page-selection']){const file=`src/platform/prepared-map/${name}.mjs`;report.sourceHashes[file]=sha256(await readFile(new URL(file,project)));}
for(const file of ['package.json','astro.config.mjs','src/planets/earth/runtime/preparedPresentation.mjs','src/planets/earth/runtime/preparedScene.mjs'])report.sourceHashes[file]=sha256(await readFile(new URL(file,project)));
report.preparedFacesSha256=sha256(JSON.stringify(server.config.faces));report.config={...server.config,faces:undefined};
const context=await browser.newContext({viewport:{width:2560,height:960},deviceScaleFactor:dpr});
await context.addInitScript(()=>{
  const t=window.__loadingOracle={timeOrigin:performance.timeOrigin,events:[],samples:[],frame:0,lastSample:0,overflow:false,stopped:false};
  t.event=(type,data)=>{if(t.stopped)return;if(t.events.length>=200000){t.overflow=true;return;}t.events.push({at:performance.now(),frame:t.frame,type,...data});};
  const frame=()=>{t.frame++;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  window.addEventListener('error',e=>{t.error=e.message;});window.addEventListener('unhandledrejection',e=>{t.error=String(e.reason);});
  window.addEventListener('wheel',e=>t.event('input-wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode}),{passive:true});
  for(const type of ['pointerdown','pointermove','pointerup'])window.addEventListener(type,e=>{if(e.buttons||type!=='pointermove')t.event(type,{x:e.clientX,y:e.clientY,buttons:e.buttons});},{passive:true});
});
await fixture.route(context,r=>r.request().frame().url().includes('/earth/')?'css':'cesium');
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
const network=await observeNetwork(context,page),frames=[],writes=[];
let bytes=0,acceptFrames=false;
network.cdp.on('Page.screencastFrame',event=>{
  network.cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  if(!acceptFrames)return;
  const body=Buffer.from(event.data,'base64'),at=event.metadata.timestamp*1000;
  if(frames.length>=2400||bytes+body.length>256*1024*1024){report.errors.push('Video frame bound reached');acceptFrames=false;return;}
  const path=`frames/frame_${String(frames.length).padStart(5,'0')}.jpg`;bytes+=body.length;
  frames.push({path,at,sha256:sha256(body),bytes:body.length});writes.push(writeFile(new URL(path,output),body));
});
try{
  await page.goto(server.url+'/__oracle/live.html');
  const css=page.frames().find(f=>f.url().includes('/earth/'));
  assert.ok(css);await css.waitForFunction(()=>window.__earth?.ready&&window.__cssOracleView);
  await css.evaluate(()=>{for(const name of ['motion','atmosphere','shadows']){const n=document.querySelector(`input[name="${name}"]`);if(n?.checked)n.click();}});
  await page.waitForFunction(()=>document.querySelector('#cesium').contentWindow.__cesiumOracle&&window.__liveOracle);
  await page.evaluate(()=>window.__liveOracle.start());
  await page.waitForTimeout(1000);
  const mark=async phase=>{report.actions.push({phase,at:Date.now()});await page.evaluate(p=>window.__liveOracle.phase=p,phase);console.log(phase);};
  acceptFrames=true;await network.cdp.send('Page.startScreencast',{format:'jpeg',quality:82,maxWidth:1600,maxHeight:600,everyNthFrame:1});
  await mark('Earth');await page.waitForTimeout(2200);
  await mark('Find Buenos Aires');await css.locator('.planet-sidebar-search').fill('');await css.locator('.planet-sidebar-search').pressSequentially('Buenos Aires',{delay:90});
  await page.waitForTimeout(500);await css.locator('[data-destination-id="3435910"]').click();
  await mark('Travel to Buenos Aires');await page.waitForTimeout(6500);
  const v=await css.evaluate(()=>window.__cssOracleView().viewport);
  await page.mouse.move(v.originX,60+v.originY);
  const wheel=async(direction,count)=>{for(let i=0;i<count;i++){await page.mouse.wheel(0,direction*40*dpr);await page.waitForTimeout(160);}};
  await mark('See the surrounding area');await wheel(1,10);await page.waitForTimeout(1800);
  await mark('Look along the coast');await page.mouse.down();
  for(let i=1;i<=32;i++){const t=i/32,e=t*t*(3-2*t);await page.mouse.move(v.originX+170*e,60+v.originY+32*e);await page.waitForTimeout(45);}
  await page.mouse.up();await page.waitForTimeout(1500);
  await mark('A closer look');await wheel(-1,7);await page.waitForTimeout(4000);
  await mark('Buenos Aires');await page.waitForTimeout(2000);
  await network.cdp.send('Page.stopScreencast');acceptFrames=false;await Promise.all(writes);
  await page.evaluate(()=>{window.__liveOracle.stop();for(const id of ['css','cesium'])document.getElementById(id).contentWindow.__loadingOracle.stopped=true;});
  const snapshot=await page.evaluate(()=>{
    const css=document.querySelector('#css').contentWindow,cesium=document.querySelector('#cesium').contentWindow;
    const trace=w=>({timeOrigin:w.__loadingOracle.timeOrigin,events:w.__loadingOracle.events,samples:w.__loadingOracle.samples,overflow:w.__loadingOracle.overflow});
    return {traces:{css:trace(css),cesium:trace(cesium)},follow:{frames:window.__liveOracle.frames,matches:window.__liveOracle.matches,errors:window.__liveOracle.errors}};
  });Object.assign(report,snapshot);
  const tree=await network.cdp.send('Page.getFrameTree'),ids=Object.fromEntries(tree.frameTree.childFrames.map(f=>[f.frame.url.includes('/earth/')?'css':'cesium',f.frame.id]));
  report.network=Object.fromEntries(Object.entries(ids).map(([engine,id])=>[engine,{events:network.events.filter(e=>e.frameId===id),requests:[...network.requests.values()].filter(r=>r.frameId===id)}]));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.follow.errors,[]);assert.ok(frames.length>100);
  assert.ok(Object.values(report.traces).every(t=>!t.overflow));
  assert.ok(report.traces.css.samples.length>50&&report.traces.cesium.samples.length>50,'Both renderer timelines remain attached throughout the take');
  const centers=report.traces.cesium.samples.flatMap(s=>(s.registration.anchors??[]).filter(a=>a.screen[0]===s.registration.center.screen[0]&&a.screen[1]===s.registration.center.screen[1]));
  report.registration={maximumCenterErrorPixels:Math.max(...centers.map(a=>a.errorPixels)),
    maximumAnchorErrorPixels:Math.max(...report.traces.cesium.samples.flatMap(s=>s.registration.anchors.map(a=>a.errorPixels??0)))};
  assert.ok(report.registration.maximumCenterErrorPixels<1);
  report.qualification+=` Maximum measured off-center projection difference: ${report.registration.maximumAnchorErrorPixels.toFixed(1)} CSS pixels. This does not qualify pixel parity.`;
  for(const [file,hash]of Object.entries(report.sourceHashes))assert.equal(sha256(await readFile(new URL(file,project))),hash,`Source changed during capture: ${file}`);
  report.complete=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{
  acceptFrames=false;await network.cdp.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(writes);
  await fixture.close();await context.close();await browser.close();await server.close();report.closed=true;
  report.fixture={...fixture.stats(),errors:fixture.errors,deliveries:fixture.deliveries};if(fixture.errors.length){report.complete=false;process.exitCode=1;}
  await writeFile(new URL('frames.json',output),JSON.stringify(frames));
  if(frames.length>1){
    const list=frames.map((f,i)=>`file '${f.path}'\nduration ${Math.max(.001,((frames[i+1]?.at??(f.at+33.333))-f.at)/1000)}`).join('\n');
    await writeFile(new URL('frames.concat',output),list+`\nfile '${frames.at(-1).path}'\n`);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',new URL('frames.concat',output).pathname,'-vf','fps=30','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',new URL('comparison.mp4',output).pathname]);
    const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',new URL('comparison.mp4',output).pathname],{encoding:'utf8'}));
    report.video={url:'comparison.mp4',startEpoch:frames[0].at,endEpoch:frames.at(-1).at,duration,frames:frames.length,sourceBytes:bytes,source:'Timestamped Chrome CDP screencast JPEG frames',sha256:sha256(await readFile(new URL('comparison.mp4',output)))};
    if(Math.abs(duration-(frames.at(-1).at-frames[0].at)/1000)>.15){report.complete=false;report.errors.push('Video duration differs from capture timestamps');process.exitCode=1;}
  }
  await writeFile(new URL('report.json',output),JSON.stringify(report));await writeReport(report,output);
  console.log(JSON.stringify({output:output.pathname,complete:report.complete??false,video:report.video,errors:report.errors}));
}
