import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mts';
declare global { interface Window { __cssEarth?: unknown; } }
interface MarkerTarget { r: ReturnType<DOMRect['toJSON']>; visibility: string; opacity: string; tag: string; }
interface FinalReport { worldMarker?: {from: string; to: string; input: string; target: MarkerTarget}; searchAliases?: string[]; optInControls?: {shadows: boolean; bodyPixelsChanged: boolean; orbit: boolean}; mobile?: {id: string; position: string; viewport: ReturnType<DOMRect['toJSON']>; cardTop: number; overflow: boolean; diagnostics: boolean}[]; errors?: string[]; }
const out='output/playwright/distant-worlds/final';await mkdir(out,{recursive:true});
const b=await chromium.launch((await conformanceBrowserLaunch({evidenceDirectory:out,redirectStdio:true})).options);
const errors: string[]=[],report: FinalReport={};
try {
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));
 const ready=(id: string)=>p.waitForFunction(value=>document.documentElement.dataset.ready==='true'&&document.querySelector('.planet-stage')?.getAttribute('data-object-id')===value,id);
 await p.goto('http://127.0.0.1:4278/varuna/');await ready('varuna');
 const target=await p.locator('[data-object-navigate="oumuamua"]').evaluateAll(nodes=>nodes.map(n=>({r:n.getBoundingClientRect().toJSON(),visibility:getComputedStyle(n).visibility,opacity:getComputedStyle(n).opacity,tag:n.tagName})).filter(n=>n.visibility==='visible'&&Number(n.opacity)>0&&n.r.width>0&&n.r.height>0&&n.r.x>365&&n.r.right<innerWidth&&n.r.y>115&&n.r.bottom<innerHeight).sort((a,b)=>(a.tag==='I'?-1:1)-(b.tag==='I'?-1:1))[0]);
 assert.ok(target,'Visible interstellar world target');
 await p.mouse.click(target.r.x+target.r.width/2,target.r.y+target.r.height/2);await ready('oumuamua');
 assert.equal(await p.locator('.planet-stage').count(),1);assert.equal(await p.locator('.polycss-camera').count(),1);
 report.worldMarker={from:'varuna',to:'oumuamua',input:'native mouse click at visible prepared marker',target};
 const search=p.locator('.planet-sidebar-search');
 for(const [query,id] of [['2002 MS4','mani'],['Máni','mani'],['2003 AZ84','achlys'],['Achlys','achlys']]){
  await search.fill(query);assert.equal(await p.locator(`.planet-object-link[data-object-id="${id}"]:visible`).count(),1);
 }
 report.searchAliases=['2002 MS4','Máni','2003 AZ84','Achlys'];
 await p.goto('http://127.0.0.1:4278/oumuamua/');await ready('oumuamua');
 await p.waitForLoadState('networkidle');
 const before=await p.screenshot({clip:{x:400,y:220,width:650,height:500}});
 await p.locator('input[name="shadows"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Shadows control is not an HTML element.');node.click();});await p.waitForTimeout(300);
 const after=await p.screenshot({clip:{x:400,y:220,width:650,height:500}});
 assert.notEqual(createHash('sha256').update(before).digest('hex'),createHash('sha256').update(after).digest('hex'));
 await p.screenshot({path:`${out}/oumuamua-shadows-on.png`});
 await p.locator('input[name="orbit"]').evaluate(node=>{if(!(node instanceof HTMLElement))throw new Error('Orbit control is not an HTML element.');node.click();});await p.waitForTimeout(100);
 report.optInControls={shadows:true,bodyPixelsChanged:true,orbit:true};
 assert.equal(await p.locator('.oumuamua-body > u[data-polycss-texture-leaf-sizing="raster"]').count(),480);
 report.mobile=[];
 for(const id of ['oumuamua','gkunhomdima']){
  await p.setViewportSize({width:390,height:844});await p.goto(`http://127.0.0.1:4278/${id}/`);await ready(id);
  const layout=await p.evaluate(()=>{const v=document.querySelector('.planet-viewport'),s=document.querySelector('.planet-sidebar');if(!(v instanceof HTMLElement)||!(s instanceof HTMLElement))throw new Error('Missing mobile layout elements.');const r=v.getBoundingClientRect();return{position:getComputedStyle(v).position,viewport:r.toJSON(),cardTop:s.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth,diagnostics:window.__cssEarth!==undefined};});
  assert.equal(layout.position,'relative');assert.ok(layout.cardTop>=layout.viewport.bottom);assert.equal(layout.overflow,false);assert.equal(layout.diagnostics,false);
  await p.screenshot({path:`${out}/${id}-mobile.png`});report.mobile.push({id,...layout});
 }
 assert.deepEqual(errors,[]);report.errors=errors;
 await writeFile('output/distant-worlds/final-interactions.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:b.version(),headless:true,build:'production',...report},null,2)+'\n');
 console.log('Production marker click, official-name/designation search, opt-in paint and new/existing mobile layouts passed.');
} finally {await b.close();}
