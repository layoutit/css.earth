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
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4291';
const selectedIds = process.argv.slice(3);
const plan = process.env.B7_COHORT === 'b6' ? {
  moon: ['surface','geology','silicate-signature'],
  europa: ['normal','geology','infrared'],
  callisto: ['normal','infrared'],
  charon: ['normal','albedo'],
} : {titan:['normal','geology'],dione:['normal','infrared','ice-absorption'],rhea:['normal','infrared','ice-absorption']};
const ids = selectedIds.length ? selectedIds : Object.keys(plan);
assert.ok(ids.length && new Set(ids).size === ids.length && ids.every(id => plan[id]), 'Select unique cohort IDs.');
const dprs = process.env.B6_DPR ? [Number(process.env.B6_DPR)] : [1,2];
assert.ok(dprs.every(dpr => [1,2].includes(dpr)), 'B6_DPR must be 1 or 2.');
const lensFilter = process.env.B6_LENS;
if (lensFilter) {
  assert.equal(ids.length, 1, 'A single-lens capture requires one body.');
  assert.ok(plan[ids[0]].includes(lensFilter), 'Select a prepared lens for this body.');
  plan[ids[0]] = [lensFilter];
}
const stamp = new Date().toISOString().replaceAll(':', '-');
const parentOut = resolve(root, 'output/playwright/b7-surfaces');
const out = resolve(parentOut, `integrated-${stamp}`);
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
const report = {schema:'cssearth-b7-visual-capture@1', status:'RUNNING', startedAt:new Date().toISOString(),
  root, baseUrl, head:execFileSync('git', ['rev-parse','HEAD'], {cwd:root, encoding:'utf8'}).trim(),
  script:await fingerprint(relative(root, process.argv[1])), viewport, dprs, selectedIds:ids,
  fullCohort:Object.keys(plan), plannedViews:plan, outputBudgetBytes:maxOutputBytes,
  qualification:'Actual Chrome captures and runtime checks; visual review pending. No baseline/native parity or compositor-FPS claim.',
  cases:[], frozenFiles:[], sharedFiles:[], styleArtifacts:[], outputBytes:0, shutdown:{browserClose:'NOT_STARTED'}};
const save = () => writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let browser;
try {
  await freezeSharedInputs();
  const bodyInputs = new Map();
  for (const id of ids) {
    const prefix = `src/planets/${id}`;
    const controls = await json(`${prefix}/prepared/controls.json`);
    const declared = controls.lenses.controls.map(lens => lens.id);
    assert.ok(plan[id].every(lens => declared.includes(lens)), `${id}: a planned lens is not prepared yet.`);
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
  for (const id of ids) for (const dpr of dprs) await captureBody(id, dpr, bodyInputs.get(id));
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

async function captureBody(id, dpr, inputs) {
  const caseOut = resolve(out, `${id}-dpr${dpr}`); await mkdir(caseOut);
  const entry = {id, dpr, status:'RUNNING', views:[], loadedResponses:[], loadedStylesheetResponses:[], cardNavigation:[], errors:[], mainFrameNavigations:[]};
  report.cases.push(entry); await save();
  const context = await browser.newContext({viewport, deviceScaleFactor:dpr, reducedMotion:'no-preference'});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  // Irregular-body prepared JSON exceeds Chrome's default response-body buffer.
  // Retain actual network bytes for hashing; this is a correctness capture, not a cache/transfer benchmark.
  const network = await context.newCDPSession(page);
  const maximumBodyBytes=Math.max(...inputs.records.map(file=>file.bytes));
  assert.ok(maximumBodyBytes<=64*1024**2,'Prepared body exceeds this capture resource budget.');
  entry.responseCaptureLimits = {maxTotalBufferSize:64*1024**2,maxResourceBufferSize:Math.max(16*1024**2,2*maximumBodyBytes)};
  await network.send('Network.enable',entry.responseCaptureLimits);
  await network.send('Network.setCacheDisabled',{cacheDisabled:true});
  entry.httpCacheDisabled = true;
  let responseQueue = Promise.resolve(), expectedNavigations = 0;
  const objectPin = inputs.records.find(file => file.path.endsWith('/prepared/object.json'));
  const preparedObjectPath = `/objects/${id}/${objectPin.sha256}.json`;
  const scenePins = new Map(inputs.records.filter(file => file.path.startsWith('public/scenes/')).map(file => [basename(file.path), file]));
  page.on('pageerror', error => entry.errors.push({kind:'pageerror', message:error.message, stack:error.stack}));
  page.on('console', message => { if (message.type() === 'error') entry.errors.push({kind:'console', message:message.text()}); });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) entry.mainFrameNavigations.push(frame.url()); });
  page.on('response', response => {
    const responseUrl = new URL(response.url()), path = responseUrl.pathname;
    if (responseUrl.searchParams.has('import')) return; // Vite URL modules are not runtime object payloads.
    if (response.status() >= 400) entry.errors.push({kind:'http', url:response.url(), status:response.status()});
    // Only CSS network products, this exact body object, and its pinned scene assets are read.
    // Stellar catalogues and unrelated large responses never enter response.body().
    const stylesheet = path.endsWith('.css') || (path.endsWith('.astro') && responseUrl.searchParams.get('type') === 'style');
    if (stylesheet) {
      if (response.status() >= 300 && response.status() < 400) { entry.loadedStylesheetResponses.push({url:response.url(),status:response.status(),bodyUnavailable:true}); return; }
      const length=Number(response.headers()['content-length']??0);
      if(length>4*1024**2){entry.errors.push({kind:'oversized-stylesheet-response',url:response.url(),bytes:length});return;}
      responseQueue=Promise.all([responseQueue,(async()=>{
        try {const bytes=await response.body();assert.ok(bytes.length<=4*1024**2,'Stylesheet response exceeded bounded capture');
          entry.loadedStylesheetResponses.push({url:response.url(),status:response.status(),bytes:bytes.length,sha256:sha(bytes)});
        } catch(error){entry.errors.push({kind:'stylesheet-response-read',url:response.url(),message:error.message});}
      })()]);return;
    }
    const isObjectResponse=path===preparedObjectPath || path===`/src/planets/${id}/prepared/object.json`;
    if (!isObjectResponse && !scenePins.has(basename(path))) return;
    if (!isObjectResponse && !path.startsWith(`/scenes/${id}/`)) return;
    if (response.status() >= 300 && response.status() < 400) {
      entry.loadedResponses.push({url:response.url(),status:response.status(),bodyUnavailable:true}); return;
    }
    responseQueue = Promise.all([responseQueue, (async () => {
      try {
        const bytes = await response.body(), hash = sha(bytes), expected = path.startsWith(`/scenes/${id}/`) ? scenePins.get(basename(path)) : null;
        const row = {url:response.url(), observedAt:new Date().toISOString(), status:response.status(), bytes:bytes.length, sha256:hash,
          matchesPreparedObject:hash === objectPin.sha256, ...(expected ? {localPath:expected.path, matchesLocal:hash === expected.sha256 && bytes.length === expected.bytes} : {})};
        entry.loadedResponses.push(row);
        if (!response.ok() || expected && !row.matchesLocal) entry.errors.push({kind:'response', ...row});
      } catch (error) {
        const failure=response.request().failure();
        const row={kind:'response-read',url:response.url(),status:response.status(),message:error.message,requestFailure:failure};
        if (failure?.errorText==='net::ERR_ABORTED') { entry.abortedResponses??=[];entry.abortedResponses.push(row); }
        else entry.errors.push(row);
      }
    })()]);
  });
  try {
    const planet = OBJECTS.find(body => body.id === id), profile = await loadPlanetBrowserProfile(planet);
    const runtime = await json(`src/planets/${id}/prepared/runtime.json`);
    for (const lensId of plan[id]) {
      // A fresh route load restores representative framing through the application.
      // Expected navigations are counted separately from an unsolicited HMR reload.
      expectedNavigations++; entry.expectedFullRouteLoads = expectedNavigations;
      assert.equal((await page.goto(new URL(planet.route, baseUrl).href, {waitUntil:'networkidle'})).status(), 200);
      await profile.waitForRuntime(page); await assertRenderedObjectControls(page, profile);
      await page.evaluate(id => { window.__b6CaptureOwner = window[`__${id}`]; }, id);
      await setting(page, 'motion', false);
      assert.equal(await profile.selectedDensity(page), 2, `${id}: canonical density must be 2 at DPR ${dpr}`);
      await selectInformationTab(page, 'dataset');
      if (lensId === plan[id][0]) {
        entry.actualStylesheets = await retainActualStylesheets(page);
        entry.cardNavigation = await exerciseInformationTabs(page,id,caseOut);
      }
      await selectInformationTab(page, 'dataset');
      await settled(page,id,await profile.visibleLens(page),null);
      const target = runtime.variants.find(variant => variant.when?.lensId === lensId)?.navigation?.camera ?? null;
      const flightBefore = target && lensId !== await profile.visibleLens(page) ? await snapshot(page,id) : null;
      await page.locator(`button[name="lens"][value="${lensId}"]`).click();
      await settled(page, id, lensId, target);
      let regionalFlight=null;
      if (flightBefore) {
        const after=await snapshot(page,id),before=flightBefore.stats.dragInertia.destinationFlyTo,finished=after.stats.dragInertia.destinationFlyTo;
        assert.equal(finished.starts,before.starts+1,'Real lens button starts the prepared destination flight');
        assert.equal(finished.completions,before.completions+1,'The destination flight completes');
        assert.equal(finished.cancels,before.cancels,'No interruption substitutes for completing the flight');
        assert.ok(finished.frames>before.frames);
        regionalFlight={trigger:'Real lens button',target,before:flightBefore,after};
      }
      const preparedLens=inputs.controls.lenses.controls.find(lens=>lens.id===lensId);
      const supportsShadows = inputs.controls.settings?.controls.some(control => control.name === 'shadows' && control.kind === 'toggle');
      for (const shadows of supportsShadows ? [false,true] : [null]) {
        if (shadows !== null) { await setting(page, 'shadows', shadows); await settled(page, id, lensId, target); }
        const view = {lensId, shadows, target, ...(regionalFlight?{regionalFlight}:{}), screenshots:[], status:'RUNNING'}; entry.views.push(view);
        await responseQueue;
        assert.ok(entry.loadedResponses.some(row => row.matchesPreparedObject), `${id}: actual fetched prepared object must match the local pinned bytes.`);
        assert.deepEqual(entry.errors, [], `${id}: runtime/network errors`);
        view.beforeDrag = await snapshot(page, id);
        assert.ok(view.beforeDrag.surfacePaint.leaves > 0 && view.beforeDrag.surfacePaint.textured === view.beforeDrag.surfacePaint.leaves, `${id}: every retained surface leaf must have its bound background image`);
        // History updates can emit same-document navigation events. Runtime identity,
        // rather than event count, detects an unsolicited reload or route handoff.
        assert.ok(view.beforeDrag.ownerSame && view.beforeDrag.ready && view.beforeDrag.activeObjectId === id,
          'INVALID: runtime changed during capture; stop source/prepared edits.');
        assert.equal(await profile.visibleLens(page), lensId); assert.equal(await profile.pressedLens(page), lensId);
        const description = page.locator(`[data-lens-details="${lensId}"]`);
        await description.locator('.planet-lens-details-copy').scrollIntoViewIfNeeded();
        await page.locator(`[data-lens-details="${lensId}"] img`).evaluateAll(async images => {
          await Promise.all(images.map(image => image.decode().catch(() => {})));
        });
        await screenshot(page, caseOut, `${lensId}-shadows-${shadows ?? 'unsupported'}-scene.png`, view.screenshots);
        view.legendContract = await inspectLegend(page,lensId,preparedLens);
        view.visibleDescriptionAndLegend = await captureDetails(page, caseOut, lensId, shadows, view.screenshots);
        // Capture both shadow states at the same framing before one real drag per lens.
        if (shadows === true || shadows === null) {
          view.drag = await drag(page, id);
          view.afterDrag = await snapshot(page, id);
          assert.ok(view.afterDrag.ownerSame && view.afterDrag.ready && view.afterDrag.activeObjectId === id);
          assert.notDeepEqual(view.afterDrag.camera.pose, view.beforeDrag.camera.pose, `${id}: real drag must change camera pose`);
          assert.equal(await profile.stable(page), true);
          await screenshot(page, caseOut, `${lensId}-shadows-${shadows ?? 'unsupported'}-drag.png`, view.screenshots);
        }
        await responseQueue;
        view.loadedResponseCount = entry.loadedResponses.length;
        view.status = 'CAPTURED_UNREVIEWED'; await save();
      }
    }
    await responseQueue; assert.deepEqual(entry.errors, []);
    for (const file of inputs.records) assert.deepEqual(await fingerprint(file.path), file, `INVALID: changed during ${id}: ${file.path}`);
    entry.status = 'CAPTURED_UNREVIEWED';
  } catch (error) {
    entry.status = 'INVALID'; entry.failure = {message:error.message, stack:error.stack};
    try { entry.failureState = await snapshot(page, id); } catch (failure) { entry.failureState = {error:failure.message}; }
    entry.failureScreenshots = [];
    try { await screenshot(page, caseOut, 'failure.png', entry.failureScreenshots, 10000); }
    catch (failure) { entry.failureScreenshotError = failure.message; }
    await save();
    throw error;
  } finally {
    try { await responseQueue; }
    finally { entry.contextClose = 'RUNNING'; await save(); await context.close(); entry.contextClose = 'COMPLETE'; await save(); }
  }
}

async function setting(page, name, checked) {
  const button = page.locator('.planet-settings-action');
  const publicSettings = await button.isVisible();
  const input = page.locator(`.planet-settings input[name="${name}"]`);
  if (publicSettings) {
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
    if (await input.isChecked() !== checked) await input.locator('..').click();
  } else {
    // Current main deliberately hides this button. Exercise the retained
    // control binding for lighting evidence; this is NOT public UI qualification.
    report.settingsAccess ??= {publicButtonVisible:false, method:'existing hidden input click binding',
      qualification:'Public settings reachability is blocked by upstream hidden button.'};
    await input.evaluate((element,value)=>{if(element.checked!==value)element.click();},checked);
  }
  assert.equal(await input.isChecked(), checked);
  if (name === 'shadows') await page.waitForFunction(checked => {
    const r=window[`__${window.__cssEarth.activeObjectId}`], s=r.runtime.selection();
    return s.ready && !s.pending && s.committed?.shadows === checked;
  }, checked);
  // Settings is a panel selector, not a toggle. The shared shell's real
  // Escape action returns to the retained information drawer.
  if(publicSettings)await page.keyboard.press('Escape');
  await page.locator('.planet-settings-panel').waitFor({state:'hidden'});
  await page.locator('.planet-information-panel').waitFor({state:'visible'});
}
async function settled(page, id, lensId, target) {
  await page.waitForFunction(({id,lensId,target}) => {
    const app = window.__cssEarth, runtime = window[`__${id}`];
    if (app?.error) throw new Error(String(app.error.message ?? app.error));
    if (runtime !== window.__b6CaptureOwner || app?.activeObjectId !== id) throw new Error('Runtime owner changed during capture');
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
      ready:app?.ready, appError:app?.error == null ? null : String(app.error.message ?? app.error), ownerSame:runtime === window.__b6CaptureOwner,
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
    window.__b6DragEnd=()=>{cancelAnimationFrame(frameId);for(const type of ['pointerdown','pointermove','pointerup'])document.removeEventListener(type,pointer,true);
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
    try {await page.mouse.up();} finally {result=await page.evaluate(()=>{const result=window.__b6DragEnd();delete window.__b6DragEnd;return result;});}
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
    const rgb=color=>color.startsWith('#') ? color.slice(1).match(/../g).map(v=>parseInt(v,16)) : (color.match(/[\d.]+/g)??[]).slice(0,3).map(Number);
    for(const [index,row]of rows.entries()){
      const expected=legend.items[index];assert.equal(row.label,expected.label);assert.equal(row.description,expected.description??'');
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
