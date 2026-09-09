// Run from the repository root only after preparation/source edits have settled.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve, relative, basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = resolve(process.env.CSSEARTH_ROOT ?? process.cwd());
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4210';
const selectedIds = process.argv.slice(3);
const plan = {
  moon: ['surface', 'topography', 'rock-abundance'],
  phobos: ['normal', 'elevation', 'albedo', 'slope'],
  deimos: ['normal', 'elevation', 'albedo', 'slope'],
  dimorphos: ['shape', 'elevation', 'slope', 'albedo'],
  io: ['normal', 'geology'], europa: ['normal', 'elevation'], ganymede: ['normal', 'geology'],
  enceladus: ['normal', 'elevation', 'shape'],
  tethys: ['normal', 'elevation', 'relative-albedo', 'shape'],
  dione: ['normal', 'elevation', 'relative-albedo', 'shape'],
  rhea: ['normal', 'elevation', 'relative-albedo', 'shape'],
  titan: ['normal', 'topography', 'interpolated', 'coverage-distance'],
  charon: ['normal', 'enhanced-color', 'elevation'],
};
const ids = selectedIds.length ? selectedIds : Object.keys(plan);
assert.ok(ids.length && new Set(ids).size === ids.length && ids.every(id => plan[id]), 'Select unique B2 cohort IDs.');
const stamp = new Date().toISOString().replaceAll(':', '-');
const parentOut = resolve(root, 'output/playwright/b2-surfaces');
const out = resolve(parentOut, `legend-correction-${stamp}`);
const viewport = {width:1440, height:1000};
const maxOutputBytes = 900 * 1024 ** 2;
const require = createRequire(resolve(root, 'package.json'));
const {chromium} = require('playwright');
const localImport = path => import(pathToFileURL(resolve(root, path)).href);
const [{OBJECTS}, {loadPlanetBrowserProfile, assertRenderedObjectControls}, {conformanceBrowserLaunch}] = await Promise.all([
  localImport('site/objects.mjs'), localImport('site/test/load-browser-profile.mjs'),
  localImport('site/test/conformance-browser-launch.mjs'),
]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const fingerprint = async path => {
  const absolute = resolve(root, path), hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(absolute)) { bytes += chunk.length; hash.update(chunk); }
  return {path, bytes, sha256:hash.digest('hex')};
};
await mkdir(parentOut, {recursive:true}); await mkdir(out);
const report = {schema:'cssearth-b2-visual-capture@1', status:'RUNNING', startedAt:new Date().toISOString(),
  root, baseUrl, head:execFileSync('git', ['rev-parse','HEAD'], {cwd:root, encoding:'utf8'}).trim(),
  script:await fingerprint(relative(root, process.argv[1])), viewport, dprs:[1,2], selectedIds:ids,
  fullCohort:Object.keys(plan), plannedViews:plan, outputBudgetBytes:maxOutputBytes,
  qualification:'Focused final card-layout regression capture; actual CSSOM and source pins. Parent containment, unclipped label text, nonoverlapping description and retained scene. Reuses prior scene imagery qualification.',
  cases:[], frozenFiles:[], sharedFiles:[], styleArtifacts:[], outputBytes:0, shutdown:{browserClose:'NOT_STARTED'}};
const save = () => writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let browser;
try {
  const closure = await json('docs/moons/b2-preparation/source-closure-13.json');
  assert.deepEqual([...closure.bodies.map(row => row.body)].sort(), Object.keys(plan).sort());
  await freezeSharedInputs();
  const bodyInputs = new Map();
  for (const id of ids) {
    const prefix = `src/planets/${id}`;
    const controls = await json(`${prefix}/prepared/controls.json`);
    const declared = controls.lenses.controls.map(lens => lens.id);
    assert.ok(plan[id].every(lens => declared.includes(lens)), `${id}: a planned B2 lens is not prepared yet.`);
    const inventory = await json(`${prefix}/prepared/runtime-assets.json`);
    const records = [];
    for (const name of ['object.json','source/manifest.json','prepared/object.json','prepared/runtime.json',
      'prepared/controls.json','prepared/scene.json','prepared/lenses.json','prepared/content.json','prepared/runtime-assets.json','prepared/provenance.json']) {
      records.push(await fingerprint(`${prefix}/${name}`));
    }
    records.push(await fingerprint(`src/renderers/css/styles/${id}-surfaces.css`));
    for (const asset of inventory.assets) {
      const record = await fingerprint(`public/scenes/${id}/${asset.filename}`);
      assert.equal(record.bytes, asset.bytes, `${id}: asset byte count changed`);
      assert.equal(record.sha256, asset.sha256, `${id}: asset hash changed`); records.push(record);
    }
    const descriptor = await json(`${prefix}/object.json`);
    for (const source of (descriptor.recipe ?? descriptor.properties.recipe).sources) {
      const record = await fingerprint(`${prefix}/${source.path}`);
      assert.equal(record.sha256, source.sha256, `${id}: descriptor source pin changed`); records.push(record);
    }
    for (const record of records) if (!report.frozenFiles.some(file=>file.path===record.path)) report.frozenFiles.push(record);
    bodyInputs.set(id, {controls, records});
  }
  await save();
  const launch = await conformanceBrowserLaunch({channel:'chrome', evidenceDirectory:out});
  report.chromeLaunch = launch.diagnostics;
  browser = await chromium.launch(launch.options); report.browserVersion = browser.version();
  for (const id of ids) for (const dpr of [1,2]) await captureBody(id, dpr, bodyInputs.get(id));
  for (const file of report.frozenFiles) assert.deepEqual(await fingerprint(file.path), file, `INVALID: file changed during capture: ${file.path}`);
  report.status = 'CAPTURED_UNREVIEWED';
} catch (error) {
  report.status = 'INVALID'; report.failure = {message:error.message, stack:error.stack}; throw error;
} finally {
  // Persist capture results before awaiting Chrome shutdown; RUNNING is never a clean-close claim.
  report.captureFinishedAt = new Date().toISOString();
  report.shutdown.browserClose = browser ? 'RUNNING' : 'NOT_LAUNCHED'; await save();
  try { if (browser) { await browser.close(); report.shutdown.browserClose = 'COMPLETE'; } }
  catch (error) { report.shutdown.browserClose = 'FAILED'; report.shutdown.error = error.message; if (!report.failure) throw error; }
  finally { report.finishedAt = new Date().toISOString(); await save(); console.log(resolve(out, 'report.json')); }
}

async function captureBody(id,dpr,inputs) {
 const caseOut=resolve(out,`${id}-dpr${dpr}`);await mkdir(caseOut);
 const entry={id,dpr,status:'RUNNING',views:[],errors:[]};report.cases.push(entry);await save();
 const context=await browser.newContext({viewport,deviceScaleFactor:dpr});const page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',e=>entry.errors.push(e.message));
 try {
  const planet=OBJECTS.find(o=>o.id===id),profile=await loadPlanetBrowserProfile(planet);
  await page.goto(new URL(planet.route,baseUrl).href,{waitUntil:'networkidle'});await profile.waitForRuntime(page);await assertRenderedObjectControls(page,profile);
  await page.evaluate(id=>{window.__b2CaptureOwner=window[`__${id}`];},id);await setting(page,'motion',false);await selectInformationTab(page,'dataset');entry.actualStylesheets=await retainActualStylesheets(page);
  for(const lensId of plan[id]) {
   await page.locator(`button[name="lens"][value="${lensId}"]`).click();await settled(page,id,lensId,null);
   const prepared=inputs.controls.lenses.controls.find(l=>l.id===lensId);const view={lensId,screenshots:[]};
   view.legendContract=await inspectLegend(page,lensId,prepared);
   view.flow=await page.locator(`[data-lens-details="${lensId}"]`).evaluate(element=>{
    const panel=element.querySelector('[data-lens-legend]'),copy=element.querySelector('.planet-lens-details-copy');if(!panel)return null;
    const r=panel.getBoundingClientRect(),c=copy.getBoundingClientRect();
    const items=[...panel.querySelectorAll('.planet-lens-legend-categories li, .planet-lens-legend-labels > span')];
    return {height:r.height,copyGap:c.top-r.bottom,contained:items.every(e=>{const b=e.getBoundingClientRect();return b.top>=r.top-1&&b.bottom<=r.bottom+1&&e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1;}),labels:items.map(e=>e.textContent.trim())};
   });
   if(view.flow){assert.ok(view.flow.contained,'Every legend row fits inside its parent without clipping');assert.ok(view.flow.copyGap>=0,'Description follows the complete legend without overlap');}
   view.visibleDescriptionAndLegend=await captureDetails(page,caseOut,lensId,null,view.screenshots);assert.equal(await profile.stable(page),true);entry.views.push(view);await save();
  }
  assert.deepEqual(entry.errors,[]);entry.status='CAPTURED_UNREVIEWED';
 }catch(e){entry.status='INVALID';entry.failure=e.stack;throw e;}finally{await context.close();await save();}
}

async function setting(page, name, checked) {
  const button = page.getByRole('button', {name:'Settings', exact:true});
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  const input = page.locator(`.planet-settings input[name="${name}"]`);
  if (await input.isChecked() !== checked) await input.locator('..').click();
  assert.equal(await input.isChecked(), checked);
  if (name === 'shadows') await page.waitForFunction(checked => {
    const r=window[`__${window.__cssEarth.activeObjectId}`], s=r.runtime.selection();
    return s.ready && !s.pending && s.committed?.shadows === checked;
  }, checked);
  // Settings is a panel selector, not a toggle. The shared shell's real
  // Escape action returns to the retained information drawer.
  await page.keyboard.press('Escape');
  await page.locator('.planet-settings-panel').waitFor({state:'hidden'});
  await page.locator('.planet-information-panel').waitFor({state:'visible'});
}
async function settled(page, id, lensId, target) {
  await page.waitForFunction(({id,lensId,target}) => {
    const app = window.__cssEarth, runtime = window[`__${id}`];
    if (app?.error) throw new Error(String(app.error.message ?? app.error));
    if (runtime !== window.__b2CaptureOwner || app?.activeObjectId !== id) throw new Error('Runtime owner changed during capture');
    const selection = runtime.runtime.selection(), state = runtime.camera.state(), movement = runtime.camera.stats().dragInertia;
    const angle = (a,b) => Math.abs(((a-b+180)%360+360)%360-180);
    return runtime.ready && selection.ready && !selection.pending && selection.committed?.lensId === lensId &&
      !movement.active && !movement.pendingPointer && !movement.surfaceFlyTo?.active && !movement.destinationFlyTo?.active && !movement.wheelZoom?.active &&
      (!target || Math.abs(state.controlPitch-target.controlPitch)<1e-5 && angle(state.controlYaw,target.controlYaw)<1e-5 && Math.abs(state.zoom-target.zoom)<1e-5);
  }, {id,lensId,target}, {timeout:45000});
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function snapshot(page, id) {
  return page.evaluate(id => {
    const app = window.__cssEarth, runtime = window[`__${id}`], state = runtime?.camera.state();
    return {at:performance.now(), url:location.href, activeObjectId:app?.activeObjectId, selectedObjectId:app?.selectedObjectId,
      ready:app?.ready, appError:app?.error == null ? null : String(app.error.message ?? app.error), ownerSame:runtime === window.__b2CaptureOwner,
      camera:state && {...state, pose:state.pose}, lens:runtime?.runtime.selection(), stats:runtime?.camera.stats(),
      surfacePaint:(() => { const nodes=[...document.querySelectorAll(`.${id}-body > s, .${id}-body > u`)]; return {leaves:nodes.length, textured:nodes.filter(node=>getComputedStyle(node).backgroundImage !== 'none').length, tags:[...new Set(nodes.map(node=>node.tagName))]}; })(),
      shell:{drawerHidden:document.querySelector('.planet-drawer-content')?.hidden,
        informationHidden:document.querySelector('.planet-information-panel')?.hidden,
        settingsHidden:document.querySelector('.planet-settings-panel')?.hidden,
        sidebarCollapsed:document.body.dataset.sidebarCollapsed ?? null,
        informationTab:document.querySelector('[data-information-tab][aria-selected="true"]')?.dataset.informationTab ?? null},
      shadows:document.querySelector('input[name="shadows"]')?.checked ?? null,
      preparedDensity:runtime?.renderStats.selectedPreparedDensity, retainedStable:runtime?.assertStableDomIdentity(),
      loadedImages:runtime?.runtime.resources().images.entries.map(({key,url,ready})=>({key,url,ready}))};
  }, id);
}
async function screenshot(page, directory, name, records, timeout = 30000) {
  const path = resolve(directory, name); await page.screenshot({path, fullPage:false, animations:'allow', type:'png', timeout});
  const file = await fingerprint(relative(root, path)); report.outputBytes += file.bytes;
  records.push(file); assert.ok(report.outputBytes < maxOutputBytes, 'Capture reached 900 MiB; stop and request a new output budget.');
}
async function captureDetails(page, directory, lensId, shadows, screenshots) {
  const selector = `[data-lens-details="${lensId}"]`;
  const blocks = page.locator(`${selector} .planet-lens-details-copy, ${selector} .planet-facts li, ${selector} .planet-lens-source, ${selector} .planet-lens-legend-title, ${selector} .planet-lens-legend-scale-row, ${selector} .planet-lens-legend-labels, ${selector} .planet-lens-legend-categories li`);
  const result = {text:await page.locator(selector).innerText(), blocks:[], screenshots:[]};
  const count = await blocks.count(), covered = new Set();
  for (let index=0; index<count; index++) {
    if (covered.has(index)) continue;
    // Ordinary sidebar scrolling: no expanded styles, hidden-content capture or stitching.
    await blocks.nth(index).evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
    const visible = await blocks.evaluateAll(elements => {
      const sidebar = document.querySelector('.planet-sidebar').getBoundingClientRect();
      const overlays=[...document.querySelectorAll('.planet-view-readout, .planet-attribution-footer')].filter(node=>getComputedStyle(node).display!=='none').map(node=>node.getBoundingClientRect());
      const bottom=Math.min(innerHeight,sidebar.bottom,...overlays.filter(r=>r.height>0&&r.right>sidebar.left&&r.left<sidebar.right&&r.top>sidebar.top).map(r=>r.top));
      return elements.map((element,index) => { const r=element.getBoundingClientRect(); return {index,text:element.innerText,
        visible:r.height>0 && r.top>=Math.max(0,sidebar.top)-1 && r.bottom<=bottom+1 &&
          r.left>=Math.max(0,sidebar.left)-1 && r.right<=Math.min(innerWidth,sidebar.right)+1 && element.scrollWidth<=element.clientWidth+1,
        rectangle:{x:r.x,y:r.y,width:r.width,height:r.height}}; });
    });
    assert.ok(visible[index].visible, 'Description/legend block overflows or cannot fit in the actual sidebar; inspect the layout without changing the viewport.');
    const name = `${lensId}-shadows-${shadows ?? 'unsupported'}-details-${result.screenshots.length+1}.png`;
    await screenshot(page, directory, name, screenshots); result.screenshots.push(name);
    for (const block of visible.filter(block => block.visible)) { covered.add(block.index); result.blocks[block.index] = {...block, screenshot:name}; }
  }
  assert.equal(covered.size,count); return result;
}
async function drag(page, id) {
  const point = await page.evaluate(() => {
    const r=document.querySelector('.polycss-camera').getBoundingClientRect(), input=document.querySelector('.planet-input-surface');
    const point={x:r.x+r.width/2,y:r.y+r.height/2};
    if (!input.contains(document.elementFromPoint(point.x,point.y))) throw new Error('Drag target is not on the actual input surface');
    return point;
  });
  await page.mouse.move(point.x,point.y);
  await page.evaluate(id => {
    const runtime=window[`__${id}`], root=document.querySelector('.planet-stage');
    const nodes=[...root.querySelectorAll('*')], parents=nodes.map(n=>n.parentNode), frames=[], events=[];
    const pointer=event=>events.push({type:event.type,timeStamp:event.timeStamp,observedAt:performance.now(),x:event.clientX,y:event.clientY});
    for (const type of ['pointerdown','pointermove','pointerup']) document.addEventListener(type,pointer,true);
    let frameId; const tick=time=>{frames.push({time,publications:runtime.camera.stats().publications??null});frameId=requestAnimationFrame(tick);};
    frameId=requestAnimationFrame(tick);
    window.__b2DragEnd=()=>{cancelAnimationFrame(frameId);for(const type of ['pointerdown','pointermove','pointerup'])document.removeEventListener(type,pointer,true);
      return {frames,events,nodeCount:nodes.length,allNodesRetained:nodes.every((n,i)=>n.isConnected&&n.parentNode===parents[i]),
        nodeCountAfter:root.querySelectorAll('*').length,ownerSame:runtime===window[`__${id}`],stable:runtime.assertStableDomIdentity()};};
  }, id);
  let result;
  try {
    await page.mouse.down();
    for (let i=1;i<=12;i++) {await page.mouse.move(point.x+i*5,point.y+i*2);await page.waitForTimeout(20);}
    await page.waitForTimeout(150); await page.mouse.up();
    await page.waitForFunction(id=>!window[`__${id}`].camera.stats().dragInertia.active, id);
  } finally {
    try {await page.mouse.up();} finally {result=await page.evaluate(()=>{const result=window.__b2DragEnd();delete window.__b2DragEnd;return result;});}
  }
  assert.ok(result.ownerSame&&result.allNodesRetained&&result.stable);assert.equal(result.nodeCountAfter,result.nodeCount);
  const intervals = times => times.slice(1).map((time,index)=>time-times[index]);
  const distribution = values => {
    if (!values.length) return null;
    const sorted=[...values].sort((a,b)=>a-b);
    return {count:values.length, minimum:sorted[0], median:sorted[Math.floor(sorted.length/2)],
      p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))], maximum:sorted.at(-1)};
  };
  const counters=result.frames.map(frame=>frame.publications).filter(Number.isFinite);
  result.observedCadence={pointerMoveIntervalsMs:distribution(intervals(result.events.filter(event=>event.type==='pointermove').map(event=>event.timeStamp))),
    observerRafIntervalsMs:distribution(intervals(result.frames.map(frame=>frame.time))),
    cameraPublicationDelta:counters.length?counters.at(-1)-counters[0]:null};
  result.cadenceQualification='Observed pointer receipt timestamps and RAF-sampled existing camera publication counters; not compositor frame rate or native/baseline comparison.';
  return result;
}

async function freezeSharedInputs() {
  const tracked=execFileSync('git',['ls-files','--','site','src/platform','src/renderers/css/styles'],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const required=new Set(tracked.filter(path=>
    path.endsWith('.css') && !path.startsWith('src/renderers/css/styles/') ||
    /^site\/(components|layouts)\/.*\.astro$/.test(path)));
  for(const path of ['src/renderers/css/styles/volume.css','src/renderers/css/styles/world-context.css',
    'site/planet-shell-client.mjs','site/runtime-policy.mjs','site/scene-router.mjs','site/object-sources.mjs',
    'site/dataset-spacecraft.mjs','site/prepared-spacecraft.json','site/diagnostics-policy.mjs'])required.add(path);
  for(const path of [...required].sort()){
    const file=await fingerprint(path);report.frozenFiles.push(file);report.sharedFiles.push(file);
  }
}

async function selectInformationTab(page, name) {
  const tab=page.locator(`.planet-information-panel [data-information-tab="${name}"]`);
  assert.equal(await tab.count(),1,'Exactly one active object card owns the tab');
  if(await tab.getAttribute('aria-selected')!=='true')await tab.click();
  await page.locator(`.planet-information-panel [data-information-panel="${name}"]`).waitFor({state:'visible'});
  assert.equal(await tab.getAttribute('aria-selected'),'true');
  assert.deepEqual(await page.locator('.planet-information-panel [data-information-tab]').evaluateAll(tabs=>
    tabs.filter(tab=>tab.getAttribute('aria-selected')==='true').map(tab=>tab.dataset.informationTab)),[name]);
}

async function exerciseInformationTabs(page,id,directory) {
  const result=[];
  for(const name of ['factsheet','sources','dataset']){
    await selectInformationTab(page,name);
    const panel=page.locator(`.planet-information-panel [data-information-panel="${name}"]`);
    const text=await panel.innerText();assert.ok(text.trim().length,`${name} card panel is populated`);
    if(name==='sources')assert.ok(await panel.locator('a[href]').count()>0,'Prepared provenance provides actual source links');
    if(name==='factsheet')assert.ok(await panel.locator('[data-fact-id]').count()>0,'Prepared facts remain accessible');
    const state=await snapshot(page,id);assert.ok(state.ownerSame&&state.ready&&state.activeObjectId===id,'Card tabs retain the current scene');
    const screenshots=[];
    if(name!=='dataset'){
      await panel.evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));
      await screenshot(page,directory,`card-${name}.png`,screenshots);
    }
    result.push({name,text,links:await panel.locator('a[href]').evaluateAll(links=>links.map(link=>({label:link.textContent.trim(),href:link.href}))),screenshots});
  }
  return result;
}

async function inspectLegend(page,lensId,prepared) {
  const details=page.locator(`[data-lens-details="${lensId}"]`),copy=details.locator('.planet-lens-details-copy');
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  assert.equal(normalize(await copy.innerText()),normalize(prepared.summary??prepared.description));
  assert.equal(await copy.getAttribute('title'),prepared.description,'Full source qualification remains attached to the visible copy');
  const legend=prepared.legend;
  if(!legend)return {kind:'none',description:await copy.innerText()};
  const panel=details.locator(`[data-lens-legend="${lensId}"]`);assert.equal(await panel.count(),1);
  if(legend.kind==='categories'){
    const rows=await panel.locator('.planet-lens-legend-categories li').evaluateAll(rows=>rows.map(row=>({
      label:row.querySelector('.planet-lens-legend-category-label')?.textContent.trim(),
      description:row.querySelector('.planet-lens-legend-category-description')?.textContent.trim(),
      color:getComputedStyle(row.querySelector('.planet-lens-legend-swatch')).backgroundColor,
      rendered:row.getClientRects().length>0,overflow:row.scrollWidth>row.clientWidth+1,
    })));
    assert.equal(rows.length,legend.items.length,'Every categorical source unit has a visible code/name row');
    const rgb=color=>(color.match(/[\d.]+/g)??[]).slice(0,3).map(Number);
    for(const [index,row]of rows.entries()){
      const expected=legend.items[index];assert.equal(row.label,expected.label);assert.equal(row.description,expected.description);
      assert.deepEqual(rgb(row.color),rgb(expected.color));assert.ok(row.rendered&&!row.overflow,'Categorical row must render without horizontal overflow');
    }
    return {kind:legend.kind,rows};
  }
  const labels=await panel.locator('.planet-lens-legend-labels > span').allTextContents();
  assert.deepEqual(labels.map(normalize),legend.labels.map((text,index)=>normalize(`${text}${index===legend.labels.length-1&&legend.meta?' '+legend.meta:''}`)));
  return {kind:legend.kind,labels,meta:legend.meta??null};
}

async function retainActualStylesheets(page) {
  const sheets=await page.evaluate(()=>[...document.styleSheets].map((sheet,index)=>{
    try{return {index,href:sheet.href,owner:sheet.ownerNode?.getAttribute('data-vite-dev-id')??null,
      cssText:[...sheet.cssRules].map(rule=>rule.cssText).join('\n')};}
    catch(error){return {index,href:sheet.href,error:String(error)};}
  }));
  assert.ok(sheets.length,'The page exposes its consumed stylesheets');
  const result=[];
  for(const sheet of sheets){
    assert.equal(sheet.error,undefined,'Consumed stylesheet must be inspectable');
    const bytes=Buffer.from(sheet.cssText),hash=sha(bytes);assert.ok(bytes.length<=4*1024**2,'Bounded stylesheet evidence');
    let artifact=report.styleArtifacts.find(file=>file.sha256===hash);
    if(!artifact){
      const path=resolve(out,'styles',`${hash}.css`);await mkdir(resolve(out,'styles'),{recursive:true});await writeFile(path,bytes);
      artifact=await fingerprint(relative(root,path));report.styleArtifacts.push(artifact);report.outputBytes+=artifact.bytes;
      assert.ok(report.outputBytes<maxOutputBytes,'Capture output budget exceeded');
    }
    const sourcePath=sheet.owner?.startsWith(root+'/')?relative(root,sheet.owner.split('?')[0]):null;
    const sourcePin=sourcePath?report.frozenFiles.find(file=>file.path===sourcePath):null;
    result.push({index:sheet.index,href:sheet.href,owner:sheet.owner,artifact,
      sourcePin:sourcePin??null,qualification:sourcePin?'Browser CSSOM serialization retained beside its pinned source owner; transformations are not byte-equated.':'Browser CSSOM serialization retained; inline/bundled CSS source mapping is not inferred.'});
  }
  return result;
}
