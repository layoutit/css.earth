import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {serveBuiltFixture} from '../../../../tools/test-built-server.mjs';
const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const built=resolve(option('built-dir','dist')),output=resolve(option('output',`output/playwright/selection-cards-${Date.now()}`));await mkdir(output,{recursive:true});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),built,output,
 qualification:'Production cards, source introductions, hierarchy, lens ownership and history through visible browser controls. Dedicated recovery/input harnesses cover faults and surface movement. No development globals or application camera writes.',
 harnessSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[]};
const fixture=await serveBuiltFixture(built);let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:fixture.launchArgs});report.browser=browser.version();
 for(const dpr of option('dpr','1,2').split(',').map(Number)){
  assert.ok([1,2].includes(dpr));const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:dpr}),page=await context.newPage();
  const row={dpr,checks:[],errors:[]};report.cases.push(row);page.on('pageerror',e=>row.errors.push(e.message));
  const waitCard=async id=>{await page.waitForFunction(id=>document.documentElement.dataset.ready==='true'&&document.querySelector('[data-entity-card]')?.dataset.entityId===id&&document.querySelector('[data-entity-card]').ariaBusy!=='true',id,{timeout:90000});await page.waitForTimeout(1600);};
  const lenses=()=>page.locator('[data-lens-option]:visible button[name="lens"]').evaluateAll(nodes=>nodes.map(n=>n.value));
  const select=async(query,id,expected)=>{
   await page.locator('.planet-sidebar-search').fill(query);await page.locator(`[data-destination-id="${id}"]:visible`).click();await waitCard(id);
   assert.deepEqual(await lenses(),expected);
   await page.waitForFunction(()=>['ready','unavailable'].includes(document.querySelector('[data-entity-card]').dataset.introductionState),null,{timeout:25000});
   const intro=await page.locator('[data-entity-card]').evaluate(card=>({state:card.dataset.introductionState,source:card.dataset.introductionSource,text:card.querySelector('.planet-introduction')?.textContent}));
   assert.equal(intro.state,'ready','This source-backed test requires the real introduction service');const source=JSON.parse(intro.source);assert.match(source.wikidata,/^Q\d+$/);assert.ok(source.revision>0&&intro.text.length>40);
   assert.equal(await page.locator('.planet-resource-row').filter({has:page.locator(`a[href="${source.url}"]`)}).count()+await page.locator(`.planet-resource-row[href="${source.url}"]`).count(),1);
   row.checks.push({id,lenses:expected,introduction:{...source,text:intro.text}});
  };
  try{
   await page.goto(fixture.url+'/earth/');await waitCard('earth');assert.deepEqual(await lenses(),['normal','night-lights']);
   await page.evaluate(()=>{window.__cardIdentity=document.querySelector('[data-entity-card]');window.__sceneIdentity=document.querySelector('.polycss-scene');});
   await select('Argentina','country:AR',['normal']);await select('Buenos Aires','3435910',['normal','buenos-aires-noise']);
   assert.equal(await page.locator('[data-entity-parent="country:AR"]').textContent(),'Argentina');
   const parents=await page.locator('[data-entity-parent]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.entityParent,name:n.textContent})));assert.ok(parents.some(p=>p.id.startsWith('adm1:')));row.parents=parents;
   const noise=page.locator('button[name="lens"][value="buenos-aires-noise"]');await noise.click();
   await page.waitForFunction(()=>document.querySelector('button[value="buenos-aires-noise"]')?.getAttribute('aria-pressed')==='true');
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-city-page]')].some(n=>n.dataset.cityPage.startsWith('noise-')&&n.style.visibility==='visible'),null,{timeout:90000});
   await page.mouse.move(1000,500);await page.mouse.wheel(0,dpr);await page.waitForTimeout(500);
   const saved=page.url();row.saved=saved;await page.screenshot({path:resolve(output,`dpr${dpr}-noise.png`)});
   await select('Tokyo','1850147',['normal']);await page.goBack();await waitCard('3435910');
   assert.equal(new URL(page.url()).search,new URL(saved).search);assert.equal(await noise.getAttribute('aria-pressed'),'true');
   await page.locator('[data-entity-parent="country:AR"]').click();await waitCard('country:AR');assert.deepEqual(await lenses(),['normal']);
   await page.locator('[data-entity-parent="earth"]').click();await waitCard('earth');assert.deepEqual(await lenses(),['normal','night-lights']);
   await page.locator('button[name="lens"][value="night-lights"]').click();await page.waitForFunction(()=>document.querySelector('button[value="night-lights"]').getAttribute('aria-pressed')==='true');
   assert.equal(await page.evaluate(()=>window.__cardIdentity===document.querySelector('[data-entity-card]')&&window.__sceneIdentity===document.querySelector('.polycss-scene')),true);
   await page.goto(saved);await waitCard('3435910');assert.equal(await noise.getAttribute('aria-pressed'),'true');assert.equal(new URL(page.url()).search,new URL(saved).search);
   assert.equal(await page.evaluate(()=>Boolean(window.__earth)),false);assert.equal(await page.locator('.polycss-scene').count(),1);assert.deepEqual(row.errors,[]);row.passed=true;
   console.log(JSON.stringify({dpr,passed:true,cards:row.checks.length}));
  }finally{await context.close();}
 }
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{report.scripts=[...new Map(fixture.requests.filter(r=>r.sha256).map(r=>[r.path,r])).values()];for(const r of report.scripts)assert.equal(r.sha256,createHash('sha256').update(await readFile(resolve(built,'.'+r.path))).digest('hex'));await browser?.close();await fixture.close();report.closed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed??false,error:report.error}));}
