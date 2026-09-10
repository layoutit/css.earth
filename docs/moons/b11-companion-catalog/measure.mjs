import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mjs';
const origin=process.argv[2]??'http://127.0.0.1:4292',out=resolve('output/playwright/b11-companions/cost');
await mkdir(out,{recursive:true});
const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:out});
const browser=await chromium.launch(launch.options),report={origin,browser:browser.version(),viewport:{width:1440,height:1000},dpr:1,cases:[],status:'RUNNING'};
const distribution=values=>{if(!values.length)return null;const s=values.toSorted((a,b)=>a-b);return {count:s.length,median:s[Math.floor(s.length/2)],p95:s[Math.floor(s.length*.95)],maximum:s.at(-1)}};
try{
 for(const id of ['asteroid-2001-sn263','sn263-beta','sn263-gamma']){
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const row={id,responses:[],errors:[]};report.cases.push(row);let queue=Promise.resolve();
  context.on('page',p=>p.on('pageerror',e=>row.errors.push(e.message)));
  page.on('pageerror',e=>row.errors.push(e.message));
  context.on('response',r=>{if(r.status()>=400)row.errors.push(`${r.status()} ${r.url()}`);if(r.status()!==200)return;queue=queue.then(async()=>{const sizes=await r.request().sizes();row.responses.push({url:r.url(),type:r.request().resourceType(),...sizes})}).catch(e=>row.errors.push(e.message))});
  await page.goto(`${origin}/${id}/`,{waitUntil:'networkidle'});await page.waitForFunction(id=>window[`__${id}`]?.ready,id);
  await page.evaluate(()=>{const input=document.querySelector('input[name="motion"]');if(input.checked)input.click()});
  await queue;row.coldResponseBytes=row.responses.reduce((n,r)=>n+r.responseBodySize+r.responseHeadersSize,0);row.coldRequestCount=row.responses.length;
  row.preparedSha256=createHash('sha256').update(await readFile(`src/planets/${id}/prepared/object.json`)).digest('hex');
  row.initial=await page.evaluate(id=>{const r=window[`__${id}`],leaves=[...document.querySelectorAll(`.${id}-body > u`)];return {camera:r.camera.state(),cameraStats:r.camera.stats(),mountedLeaves:leaves.length,rasterSizes:[...new Set(leaves.map(n=>getComputedStyle(n).width+'×'+getComputedStyle(n).height))],loadedImages:r.runtime.resources().images.entries.map(({url,ready})=>({url,ready}))}},id);
  row.images=[];
  for(const image of row.initial.loadedImages.filter(x=>x.ready&&x.url.startsWith('/scenes/'))){const m=await sharp(resolve('public'+image.url)).metadata();row.images.push({url:image.url,width:m.width,height:m.height,rgbaBytes:m.width*m.height*4})}
  row.decodedImageRgbaBytes=row.images.reduce((n,i)=>n+i.rgbaBytes,0);
  const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
  await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame',transferMode:'ReturnAsStream'});
  await page.mouse.move(720,500);await page.mouse.down();
  for(let i=1;i<=12;i++){await page.mouse.move(720+i*5,500+i*2);await page.waitForTimeout(20)}
  await page.mouse.up();await page.waitForFunction(id=>!window[`__${id}`].camera.stats().dragInertia.active,id);
  await cdp.send('Tracing.end');const {stream}=await complete;let trace='';
  while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break}await cdp.send('IO.close',{handle:stream});
  const bytes=Buffer.from(trace);await writeFile(resolve(out,id+'-drag.json'),bytes);
  row.trace={file:id+'-drag.json',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const events=JSON.parse(trace).traceEvents,draws=events.filter(e=>e.name==='DrawFrame').map(e=>e.ts/1000).sort((a,b)=>a-b);
  row.drawFrameIntervalsMs=distribution(draws.slice(1).map((t,i)=>t-draws[i]));
  row.renderEventDurationMs=Object.fromEntries(['Paint','UpdateLayoutTree','Layout','CompositeLayers'].map(name=>[name,distribution(events.filter(e=>e.name===name&&e.ph==='X'&&Number.isFinite(e.dur)).map(e=>e.dur/1000))]));
  row.final=await page.evaluate(id=>({camera:window[`__${id}`].camera.state(),stable:window[`__${id}`].assertStableDomIdentity()}),id);assert.ok(row.final.stable);assert.notDeepEqual(row.initial.camera,row.final.camera);
  await page.screenshot({path:resolve(out,id+'-drag.png')});await queue;assert.deepEqual(row.errors,[]);await context.close();
 }
 report.status='PASS';
}finally{await browser.close();report.browserClosed=true;report.finished=new Date().toISOString();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n')}
