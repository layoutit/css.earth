// One prepared real-route shell, chart and DPR. No scene engine is started.
// The SSR markup/styles and the two unchanged production controllers are retained.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mjs';
const [id,chartId,density]=process.argv.slice(2),dpr=Number(density);
assert.ok('himalia epimetheus telesto pandora ymir albiorix siarnaq methone pallene'.split(' ').includes(id));assert.ok([1,2].includes(dpr));
const json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const content=await json(`src/planets/${id}/prepared/content.json`),chart=content.charts.find(c=>c.id===chartId);assert.ok(chart);
const out=`output/playwright/b4-observations/${id}-${chartId}-dpr${dpr}`;await mkdir(out,{recursive:true});
const source=await readFile('site/planet-shell-client.mjs','utf8');
function controller(name){const begin=source.indexOf(`function ${name}(`);assert.ok(begin>=0);const end=source.indexOf('\nfunction ',begin+1);return source.slice(begin,end<0?source.length:end);}
const originalHtml=await readFile(`output/playwright/b4-observations/panel/${id}.html`,'utf8');
// CSS is already emitted into <style> elements by Astro. Remove only executable
// scripts; none of the observation markup or CSS is reconstructed by the test.
const html=originalHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('class="loading"','class=""').replace('</body>',`<script>${controller('createInformationTabsController')}${controller('createChartSwitcherController')}
const lifetime={onDispose(){}};const drawer=document.querySelector('.planet-drawer-content');
createInformationTabsController(drawer,lifetime);createChartSwitcherController(drawer,window,lifetime);
window.__b4Images=[...document.querySelectorAll('.planet-chart')];window.__b4Card=document.querySelector('.planet-information-panel');
</script></body>`);
const frozenPaths=['site/components/PlanetInformationPanel.astro','site/planet-shell-client.mjs','site/planet-shell.css','site/planet-shell-types.ts',`src/planets/${id}/prepared/content.json`,`src/planets/${id}/source/content/charts.json`,`src/planets/${id}/prepared/runtime-assets.json`];
const frozen=[];for(const path of frozenPaths)frozen.push({path,sha256:sha(await readFile(path))});
const report={id,chartId,dpr,status:'RUNNING',qualification:'Real SSR information panel and production chart/tab controllers; scene engine not mounted. Not a full application conformance result.',viewport:dpr===1?{width:1440,height:1000}:{width:390,height:844},frozen,htmlSha256:sha(originalHtml),servedHtmlSha256:sha(html),errors:[],loaded:[],shutdown:{}};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
 const file=resolve('public',`.${path}`);if(!file.startsWith(resolve('public')+'/')){res.writeHead(403).end();return;}
 const bytes=await readFile(file);res.setHeader('content-type',({'.png':'image/png','.webp':'image/webp','.csv':'text/csv','.woff2':'font/woff2','.ico':'image/x-icon'})[extname(file)]??'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end();}});
let browser;
try{
 await new Promise((yes,no)=>{server.once('error',no);server.listen(4292,'127.0.0.1',yes);});
 const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:out,redirectStdio:true});browser=await chromium.launch(launch.options);report.chrome=launch.diagnostics;
 const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:dpr});const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push(e.message));
 const imagePromise=page.waitForResponse(r=>new URL(r.url()).pathname===chart.src&&r.status()===200);imagePromise.catch(()=>{});
 await page.goto('http://127.0.0.1:4292/',{waitUntil:'networkidle'});
 const switcher=page.locator('.planet-chart-switcher');assert.equal(await switcher.count(),1);await switcher.waitFor({state:'visible'});
 await switcher.locator('summary').click();
 for(let i=0;i<content.charts.length&&await switcher.getAttribute('data-active-chart')!==chartId;i++)await switcher.locator('[data-chart-step="1"]').click();
 assert.equal(await switcher.getAttribute('data-active-chart'),chartId);
 const slide=page.locator(`[data-chart-id="${chartId}"]`);await slide.waitFor({state:'visible'});await slide.scrollIntoViewIfNeeded();
 await page.waitForFunction(id=>{const img=document.querySelector(`[data-chart-id="${id}"] img`);return img?.complete&&img.naturalWidth>0;},chartId);
 assert.equal(await slide.locator('figcaption p').innerText(),chart.caption);assert.equal(await slide.locator('a').first().getAttribute('href'),chart.source.url);
 assert.equal(await slide.locator('a[download]').getAttribute('href'),chart.data.src);
 const image=await imagePromise;const data=await context.request.get(`http://127.0.0.1:4292${chart.data.src}`);assert.equal(data.status(),200);
 for(const [url,bytes]of[[chart.src,await image.body()],[chart.data.src,await data.body()]]){const local=await readFile(`public${url}`);assert.equal(sha(bytes),sha(local));report.loaded.push({url,bytes:bytes.length,sha256:sha(bytes)});}
 await slide.screenshot({path:`${out}/chart.png`});await page.screenshot({path:`${out}/page.png`});
 if(content.charts.length>1){for(let i=0;i<content.charts.length;i++)await switcher.locator('[data-chart-step="1"]').click();assert.equal(await switcher.getAttribute('data-active-chart'),chartId);}
 for(const tab of ['factsheet','sources','dataset']){await page.locator(`[data-information-tab="${tab}"]`).click();await page.locator(`[data-information-panel="${tab}"]`).waitFor({state:'visible'});}
 report.retained=await page.evaluate(()=>({cardSame:window.__b4Card===document.querySelector('.planet-information-panel'),imagesSame:window.__b4Images.every((img,i)=>img===document.querySelectorAll('.planet-chart')[i]),chartCount:document.querySelectorAll('.planet-chart').length}));
 assert.deepEqual(report.retained,{cardSame:true,imagesSame:true,chartCount:content.charts.length});
 report.geometry=await slide.evaluate(el=>({width:el.getBoundingClientRect().width,scrollWidth:el.scrollWidth,captionFont:getComputedStyle(el.querySelector('figcaption')).fontSize}));
 assert.ok(report.geometry.scrollWidth<=report.geometry.width+1,'Chart/caption overflow horizontally');assert.deepEqual(report.errors,[]);
 for(const pin of frozen)assert.equal(sha(await readFile(pin.path)),pin.sha256,'Capture inputs changed');report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1;}
finally{if(browser){await browser.close();report.shutdown.browser='closed';}await new Promise(yes=>server.close(yes));report.shutdown.server='closed';await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,chartId,dpr,status:report.status,failure:report.failure,out}));}
