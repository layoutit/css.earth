import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const dpr=Number(option('dpr','1')),built=resolve(option('built-dir','dist'));
assert.ok([1,2].includes(dpr));
const record=option('record','true')==='true';
const output=resolve(option('output',`output/playwright/card-lens-ownership-dpr${dpr}-${Date.now()}`));await mkdir(output,{recursive:true});
const plan=JSON.parse(await readFile(new URL('../../../../src/planets/earth/prepared/runtime.json',import.meta.url)));
const assets=new Map(plan.assets.entries.map(entry=>[entry.key,entry.url]));
const bodyNode=plan.tree.nodes.findIndex(node=>{
 const classes=node.className?.split(/\s+/)??[];
 return classes.includes('earth-body')&&!classes.includes('earth-body-polar');
});
assert.ok(bodyNode>=0);
const baseTextures=Object.fromEntries(['normal','night-lights'].map(id=>[id,Object.fromEntries(
 plan.variants.find(variant=>variant.when.lensId===id).writes.filter(write=>write.kind==='texture'&&write.target===bodyNode&&write.name.startsWith('--earth-surface-page-')).map(write=>[write.name,assets.get(write.resource)]))]));
for(const textures of Object.values(baseTextures))assert.ok(Object.keys(textures).length>0&&Object.values(textures).every(url=>typeof url==='string'&&url.startsWith('/scenes/earth/')));
async function hashDiff(){
 const hash=createHash('sha256'),child=spawn('git',['diff','--binary'],{stdio:['ignore','pipe','pipe']});
 let error='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{error+=chunk;});
 const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error(`git diff failed (${code}): ${error}`)));});
 await Promise.all([completion,(async()=>{for await(const chunk of child.stdout)hash.update(chunk);})()]);
 return hash.digest('hex');
}
// Finish local provenance before opening a browser. Stream large prepared diffs.
const report={output,built,dpr,harnessSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),diffSha256:await hashDiff(),checkpoints:[],errors:[],requests:[]};
const fixture=await serveBuiltFixture(built),browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});
report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr,...(record?{recordVideo:{dir:output,size:{width:1440,height:1000}}}:{})});
const page=await context.newPage(), pending=new Set();
context.on('request',r=>{if([fixture.url,'https://earth-assets.lowpoly.cc','https://mapproxy.terrascope.be'].includes(new URL(r.url()).origin))pending.add(r);});
context.on('requestfinished',r=>pending.delete(r));context.on('requestfailed',r=>pending.delete(r));
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>report.requests.push(r.url()));
const state=()=>page.evaluate(()=>{
 const card=document.querySelector('[data-entity-card]'),stage=document.querySelector('.planet-stage'),nodes=[...stage.querySelectorAll('*')],before=window.__ownershipNodes??=nodes,body=document.querySelector('.earth-body:not(.earth-body-polar)');
 return {entity:card.dataset.entityId,lens:document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,lenses:[...card.querySelectorAll('button[name="lens"]')].filter(n=>!n.closest('[hidden]')).map(n=>n.value),baseLens:stage.dataset.lens??'normal',baseTextures:Object.fromEntries([...body.style].filter(name=>name.startsWith('--earth-surface-page-')).map(name=>[name,body.style.getPropertyValue(name)])),status:[...card.querySelectorAll('[data-geographic-status]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent).join(' '),busy:card.ariaBusy,url:location.href,stable:nodes.length===before.length&&nodes.every((n,i)=>n===before[i]),pages:[...document.querySelectorAll('[data-city-page]')].filter(n=>n.style.visibility==='visible').map(n=>n.dataset.cityPage),production:!window.__earth};
});
const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.ready==='true'&&document.querySelector('[data-entity-card]')?.ariaBusy!=='true');
const lens=id=>page.locator(`button[name="lens"][value="${id}"]`);
const capture=async name=>{
 // Ownership assertions above run immediately. Review screenshots separately
 // allow ordinary base imagery to finish so loading placeholders are visible
 // in the video but cannot be mistaken for the finished city.
 if(process.argv.includes('--visual')){let quiet=Date.now();for(const start=Date.now();Date.now()-start<90000;){if(pending.size)quiet=Date.now();if(Date.now()-quiet>800)break;await page.waitForTimeout(100);}}
 const s=await state();assert.ok(s.stable);assert.ok(s.production);const path=resolve(output,`${String(report.checkpoints.length+1).padStart(2,'0')}-${name}.png`);await page.screenshot({path});report.checkpoints.push({name,path,...s});console.log(JSON.stringify({checkpoint:name,entity:s.entity,lenses:s.lenses}));return s;};
const select=async(q,id)=>{const input=page.locator('.planet-sidebar-search');await input.fill(q);await page.locator(`[data-destination-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('[data-entity-card]').dataset.entityId===id,id);};
const assertOwned=async(id,ids)=>{const s=await state();assert.equal(s.entity,id);assert.deepEqual(s.lenses,ids);assert.ok(ids.includes(s.lens));const base=s.lens==='night-lights'?'night-lights':'normal';assert.equal(s.baseLens,base);for(const [name,url] of Object.entries(baseTextures[base]))assert.ok(s.baseTextures[name]?.includes(url),`${id}: ${name} must paint the prepared ${base} imagery`);return s;};
try{
 await page.goto(`${fixture.url}/earth/`);await ready();await state();
 await assertOwned('earth',['normal','night-lights']);assert.equal(await lens('buenos-aires-noise').isVisible(),false);assert.equal(await lens('worldcover-land-cover').isVisible(),false);
 await lens('night-lights').click();await page.waitForFunction(()=>document.querySelector('.planet-stage').dataset.lens==='night-lights');
 await assertOwned('earth',['normal','night-lights']);await capture('earth-night-lights');
 await select('Buenos Aires','3435910');await assertOwned('3435910',['normal','buenos-aires-noise']);
 await ready();await page.waitForTimeout(800);await capture('buenos-aires-own-lenses');
 await lens('buenos-aires-noise').click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-city-page]')].filter(n=>n.style.visibility==='visible'&&n.dataset.cityPage.startsWith('noise-')).length===16,null,{timeout:90000});await capture('buenos-aires-noise');
 await select('Argentina','country:AR');await assertOwned('country:AR',['normal']);await ready();await capture('country-own-lenses');
 await select('Buenos Aires','admin1:3433955');await assertOwned('admin1:3433955',['normal']);await ready();await capture('province-own-lenses');
 await select('Tokyo','1850147');await assertOwned('1850147',['normal']);await ready();await capture('tokyo-own-lenses');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-entity-card]').dataset.entityId==='admin1:3433955');await assertOwned('admin1:3433955',['normal']);
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-entity-card]').dataset.entityId==='country:AR');await assertOwned('country:AR',['normal']);
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-entity-card]').dataset.entityId==='3435910'&&document.querySelector('button[value="buenos-aires-noise"]')?.ariaPressed==='true');await assertOwned('3435910',['normal','buenos-aires-noise']);await capture('history-restores-city-noise');
 await page.goForward();await page.waitForFunction(()=>document.querySelector('[data-entity-card]').dataset.entityId==='country:AR');await assertOwned('country:AR',['normal']);await capture('forward-clears-city-noise');
 // An old URL cannot grant a card a lens it does not own.
 for(const [id,invalid,ids] of [['3435910','night-lights',['normal','buenos-aires-noise']],['3435910','worldcover-land-cover',['normal','buenos-aires-noise']],['country:AR','night-lights',['normal']],['earth','worldcover-land-cover',['normal','night-lights']],['earth','buenos-aires-noise',['normal','night-lights']]]){
  await page.goto(`${fixture.url}/earth/#${id==='earth'?'':`place=${encodeURIComponent(id)}&`}lens=${invalid}`);await ready();await page.waitForFunction(id=>document.querySelector('[data-entity-card]').dataset.entityId===id,id);await page.waitForTimeout(300);
  const s=await state();assert.equal(s.lens,'normal');assert.equal(new URL(s.url).hash.includes(`lens=${invalid}`),false);assert.equal(await lens(invalid).isVisible(),false);if(ids)await assertOwned(id,ids);
  await capture(`reject-${id.replace(':','-')}-${invalid}`);
 }
 // Begin a global lens load and immediately navigate to a city. Late bytes
 // must not republish Earth's lens into the city card.
 await lens('night-lights').click();await select('Buenos Aires','3435910');await ready();await page.waitForTimeout(1500);await assertOwned('3435910',['normal','buenos-aires-noise']);assert.equal((await state()).lens,'normal');await capture('interrupted-earth-lens-stays-cleared');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.stack;report.failedState=await state().catch(()=>null);await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error;}
finally{report.scripts=[...new Map(fixture.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];for(const script of report.scripts)assert.equal(script.sha256,createHash('sha256').update(await readFile(resolve(built,`.${script.path}`))).digest('hex'));console.log('Cleanup: closing context');await context.close();console.log('Cleanup: context closed');report.video=await page.video()?.path();await browser.close();console.log('Cleanup: browser closed');await fixture.close();console.log('Cleanup: fixture closed');report.browserClosed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,passed:report.passed??false}));}
