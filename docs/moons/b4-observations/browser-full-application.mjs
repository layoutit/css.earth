// One chart, one density, one server/browser lifetime. Run under run-bounded.py.
import assert from 'node:assert/strict';
import {dev} from 'astro';
import {chromium} from 'playwright';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../../site/objects.mjs';
import {loadPlanetBrowserProfile, assertRenderedObjectControls} from '../../../site/test/load-browser-profile.mjs';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mjs';
const [id,chartId,density] = process.argv.slice(2), dpr=Number(density);
assert.ok('himalia epimetheus telesto pandora ymir albiorix siarnaq methone pallene'.split(' ').includes(id));
assert.ok([1,2].includes(dpr));
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const content=await json(`src/planets/${id}/prepared/content.json`), chart=content.charts.find(c=>c.id===chartId);
assert.ok(chart, 'Select one prepared chart.');
const out=`output/playwright/b4-observations/${id}-${chartId}-dpr${dpr}`;
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const frozenPaths=[`src/planets/${id}/object.json`,`src/planets/${id}/prepared/content.json`,
 `src/planets/${id}/prepared/object.json`,`src/planets/${id}/prepared/runtime-assets.json`,
 'site/components/PlanetInformationPanel.astro','site/planet-shell.css','site/planet-shell-client.mjs'];
const fingerprint=async path=>({path,sha256:sha(await readFile(path))});
const frozen=[];for(const p of frozenPaths)frozen.push(await fingerprint(p));
const report={id,chartId,dpr,viewport:dpr===1?{width:1440,height:1000}:{width:1100,height:900},status:'RUNNING',errors:[],frozen,loaded:[],shutdown:{}};
let server,browser;
try {
 server=await dev({root:process.cwd(),server:{host:'127.0.0.1',port:4292},vite:{server:{strictPort:true}}});
 const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:out,redirectStdio:true});
 browser=await chromium.launch(launch.options);
 report.chrome=launch.diagnostics;
 const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:dpr});
 const page=await context.newPage();page.setDefaultTimeout(25000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 const imageResponse=page.waitForResponse(r=>new URL(r.url()).pathname===chart.src&&r.status()===200);
 const object=OBJECTS.find(o=>o.id===id),profile=await loadPlanetBrowserProfile(object);
 assert.equal((await page.goto(`http://127.0.0.1:4292${object.route}`,{waitUntil:'networkidle'})).status(),200);
 await profile.waitForRuntime(page);await assertRenderedObjectControls(page,profile);
 assert.equal(await profile.selectedDensity(page),2);
 const settings=page.getByRole('button',{name:'Settings',exact:true});await settings.click();
 const motion=page.locator('.planet-settings input[name="motion"]');if(await motion.isChecked())await motion.locator('..').click();
 await page.keyboard.press('Escape');
 await page.locator('[data-information-tab="dataset"]').click();
 const switcher=page.locator('.planet-chart-switcher');
 if(await switcher.getAttribute('open')===null)await switcher.locator('summary').click();
 await page.evaluate(id=>{window.__b4={owner:window[`__${id}`],images:[...document.querySelectorAll('.planet-chart')],stage:document.querySelector('.planet-stage')};},id);
 for(let i=0;i<content.charts.length&&await switcher.getAttribute('data-active-chart')!==chartId;i++)await switcher.locator('[data-chart-step="1"]').click();
 assert.equal(await switcher.getAttribute('data-active-chart'),chartId);
 const slide=page.locator(`[data-chart-id="${chartId}"]`);await slide.waitFor({state:'visible'});
 await slide.scrollIntoViewIfNeeded();
 await page.waitForFunction(id=>{const img=document.querySelector(`[data-chart-id="${id}"] img`);return img?.complete&&img.naturalWidth>0;},chartId);
 assert.equal(await slide.locator('figcaption p').innerText(),chart.caption);
 assert.equal(await slide.locator('a').first().getAttribute('href'),chart.source.url);
 assert.equal(await slide.locator('a[download]').getAttribute('href'),chart.data.src);
 const response=await imageResponse;
 for(const [url,bytes] of [[chart.src,await response.body()],[chart.data.src,await (await context.request.get(`http://127.0.0.1:4292${chart.data.src}`)).body()]]){
  const expected=await readFile(`public${url}`);assert.equal(sha(bytes),sha(expected));report.loaded.push({url,bytes:bytes.length,sha256:sha(bytes)});
 }
 await slide.screenshot({path:`${out}/chart.png`});
 await page.screenshot({path:`${out}/page.png`});
 if(content.charts.length>1){for(let i=0;i<content.charts.length;i++)await switcher.locator('[data-chart-step="1"]').click();assert.equal(await switcher.getAttribute('data-active-chart'),chartId);}
 for(const tab of ['factsheet','sources','dataset'])await page.locator(`[data-information-tab="${tab}"]`).click();
 report.retained=await page.evaluate(id=>({ownerSame:window.__b4.owner===window[`__${id}`],stageSame:window.__b4.stage===document.querySelector('.planet-stage'),stageCount:document.querySelectorAll('.planet-stage').length,active:window.__cssEarth.activeObjectId,imagesSame:window.__b4.images.every((img,i)=>img===document.querySelectorAll('.planet-chart')[i]),ready:window[`__${id}`].ready}),id);
 assert.deepEqual(report.retained,{ownerSame:true,stageSame:true,stageCount:1,active:id,imagesSame:true,ready:true});
 assert.deepEqual(report.errors,[]);
 for(const pin of frozen)assert.equal((await fingerprint(pin.path)).sha256,pin.sha256,'Capture inputs changed');
 report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;}
finally{
 if(browser){await browser.close();report.shutdown.browser='closed';}
 if(server){await server.stop();report.shutdown.server='closed';}
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({id,chartId,dpr,status:report.status,errors:report.errors,failure:report.failure,out}));
}
