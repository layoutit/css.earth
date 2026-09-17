import type { ShellCamera } from '../browser-types.mts';
import type { ObjectWorldNavigation } from '../../src/renderers/css/runtime/world-navigation-types.ts';
import type { WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.ts';
import type { SurfaceAxes } from '../surface-minimap-math.mts';
import type { SurfaceMapConfig } from '../surface-map-context.mts';
import { createTestPage } from './browser-observations.mts';
// Native DOM/animation checks for shell work scheduling and shared map state.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const dpr = Number(process.env.DPR ?? 1);
const output = `output/playwright/shell-surface-dpr-${dpr}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
const result: { dpr: number; checks: Record<string, boolean | number>; errors: string[] } = { dpr, checks: {}, errors: [] };
try {
  const page = await createTestPage(browser, { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: dpr });
  page.on('pageerror', error => result.errors.push(error.message));
  await page.route('**/__shell-surface-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(`${origin}/__shell-surface-fixture`);
  result.checks = await page.evaluate(async () => {
    const { createSurfaceMapReader, surfaceMapContext } = await import('/site/surface-map-context.mts');
    const { createSurfaceMinimap } = await import('/site/surface-minimap.mts');
    const { createViewReadout, formatViewDistance, formatViewDate } = await import('/site/view-readout.mts');
    document.body.innerHTML = `<div class="planet-stage"><div class="polycss-scene"><div class="model"><div class="surface"></div></div></div></div>
      <div class="drawer"><details open><summary>Surface Lens</summary><div data-lens-details><div data-surface-minimap style="width:200px;height:100px;position:relative">
      <i class="planet-minimap-viewport"></i><i class="planet-minimap-viewport"></i><i class="planet-minimap-viewport"></i></div></div></details></div>
      <div class="planet-view-readout"><div class="planet-view-date"><span data-view-date></span></div>
      <div class="planet-view-coordinates"><span data-view-latitude></span><span data-view-longitude></span></div>
      <div class="planet-view-altitude"><span data-view-distance-label></span><span data-view-altitude></span></div>
      <div class="planet-view-scale"><span data-view-scale-label></span><span class="planet-view-ruler"><span class="planet-view-measure"></span></span></div></div>`;
    const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
    // Computed CSS matrices serialize trigonometric entries to six decimals.
    const near = (a: number,b: number) => Math.abs(a-b) < 1e-6;
    const equalAxes = (a: SurfaceAxes,b: SurfaceAxes) => (['prime','east','north'] as const).every(k=>a[k].every((v,i)=>near(v,b[k][i])));
    const next = () => new Promise(requestAnimationFrame);
    const pause = (ms: number) => new Promise(resolve=>setTimeout(resolve,ms));
    const map = window.__cssearthTest.html('[data-surface-minimap]'), body = window.__cssearthTest.html('.surface');
    const config: SurfaceMapConfig = {surfaceSelector: '.surface', prime:[0,0,1], east:[1,0,0], north:[0,1,0], mapLeftEdgeLongitudeDeg:0};
    window.__cssearthTest.htmlElement(map).dataset.surfaceMinimap = JSON.stringify(config);
    const spin = body.animate([{transform:'rotateZ(0deg)'},{transform:'rotateZ(90deg)'}],{duration:1000,fill:'both'});
    spin.pause(); spin.currentTime = 0;
    let world: WorldCameraPose = {referenceFrame:'sun-icrf',pose:{positionM:[0,0,3e6],orientationXyzw:[0,0,0,1]},epochJdTt:2461286.5};
    const shared = new Set<() => void>(), navigation = new Set<() => void>();
    const optics: ObjectWorldNavigation['optics'] = () => ({focalPixels:1000,principalOffsetPixels:[0,0],visibleRect:{left:-500,right:500,top:-500,bottom:500},framingRadiusPixels:400,detailHandoffDiameterPixels:320});
    const camera: ShellCamera = {
      navigation: { frame: {referenceFrame:'sun-icrf',epochJdTt:2461286.5,metersPerUnit:1e6,originM:[0,0,0],bodyRadiusM:1e6,presentationToReference:[1,0,0,0,-1,0,0,0,1]},
        capture:()=>world, optics, preparedFocus:()=>null, setPreparedFocus(){}, async flyToPreparedFocus(){throw new Error('Surface fixture does not navigate to prepared focus.');},
        subscribe(fn){const publish = () => fn(world,optics());navigation.add(publish);return()=>navigation.delete(publish);}, apply(value){world=value;publish();} },
      sharedView: {capture:()=>null,restore(){throw new Error('Surface fixture does not restore URL state.');},subscribe(fn){shared.add(fn);return()=>shared.delete(fn);}},
    };
    const publish = () => { for(const fn of navigation) fn(); for(const fn of shared) fn(); };
    const reader = createSurfaceMapReader({documentTarget:document,windowTarget:window});
    const readSurface = (...args: Parameters<typeof reader.read>) => window.__cssearthTest.required(reader.read(...args), 'surface snapshot');
    const first = readSurface(map,camera), second = readSurface(map,camera);
    check(first.axes === second.axes,'Consumers must share the cached axes');
    world = {...world,pose:{...world.pose,positionM:[1e5,0,3e6]}};
    const moved = readSurface(map,camera);
    check(moved.axes === first.axes && moved.relative[0] === 1e5,'Camera movement must keep axes and refresh eye position');
    spin.currentTime = 500;
    const sought = readSurface(map,camera);
    check(near(sought.axes.east[0],Math.SQRT1_2) && near(sought.axes.east[1],Math.SQRT1_2),'Paused animation seeks must invalidate axes');
    window.__cssearthTest.required(spin.effect, 'surface animation effect').updateTiming({duration:2000});
    check(near(readSurface(map,camera).axes.east[0],Math.cos(Math.PI/8)),'Timing changes must refresh axes even at the same paused time');
    window.__cssearthTest.required(spin.effect, 'surface animation effect').updateTiming({duration:1000});
    spin.currentTime = 0;
    check(near(readSurface(map,camera).axes.east[0],1),'Resetting paused motion refreshes immediately');
    window.__cssearthTest.html('.model').style.transform = 'rotateY(30deg)';
    const changed = readSurface(map,camera);
    check(equalAxes(changed.axes,window.__cssearthTest.required(surfaceMapContext(config,camera,document,window), 'surface context').axes),'Synchronous ancestor changes must invalidate before observer delivery');
    spin.play(); await pause(60);
    check(equalAxes(readSurface(map,camera).axes,window.__cssearthTest.required(surfaceMapContext(config,camera,document,window), 'surface context').axes),'Playing axes must match the current native animation');
    spin.pause();
    const replacement = body.cloneNode(); body.replaceWith(replacement);
    check(equalAxes(readSurface(map,camera).axes,window.__cssearthTest.required(surfaceMapContext(config,camera,document,window), 'surface context').axes),'Replaced body must not reuse the outgoing axes');
    const alternative = {...config,prime:config.east,east:config.prime};
    window.__cssearthTest.htmlElement(map).dataset.surfaceMinimap = JSON.stringify(alternative);
    check(equalAxes(readSurface(map,camera).axes,window.__cssearthTest.required(surfaceMapContext(alternative,camera,document,window), 'alternate surface context').axes),'Changing prepared map axes must invalidate the cache');
    window.__cssearthTest.htmlElement(map).dataset.surfaceMinimap = JSON.stringify(config);

    let surfaceReads = 0;
    const sharedReader = {...reader,read(...args: Parameters<typeof reader.read>){surfaceReads++;return readSurface(...args);}};
    const drawer = window.__cssearthTest.html('.drawer'), panel = window.__cssearthTest.detailsElement(drawer.querySelector('details'));
    const minimap = createSurfaceMinimap({drawer,documentTarget:document,windowTarget:window,surfaceReader:sharedReader,onInteraction(){}});
    minimap.setCamera(camera); minimap.setPlaybackState({allowed:false,reason:'motion-off'});
    await next(); await next();
    check(shared.size === 1,'Open minimap subscribes to camera');
    panel.open = false; await next();
    minimap.setPlaybackState({allowed:true,reason:'motion-on'});
    const closedReads = surfaceReads;
    for(let i=0;i<8;i++){world={...world,pose:{...world.pose,positionM:[i*2e5,0,3e6]}};publish();await next();}
    check(shared.size === 0 && surfaceReads === closedReads,'Closed minimap must unsubscribe and perform no surface work');
    minimap.setPlaybackState({allowed:false,reason:'motion-off'});
    panel.open = true; await next(); await next();
    check(shared.size === 1 && surfaceReads > closedReads,'Reopening refreshes from current camera');
    const reopened = window.__cssearthTest.htmlElement(map).dataset.centerU;
    world = {...world,pose:{...world.pose,positionM:[-2e6,1e6,3e6]}};publish();await next();
    check(window.__cssearthTest.htmlElement(map).dataset.centerU !== reopened,'Open minimap continues tracking the camera');
    panel.open = false; await next();

    let readoutReads = 0;
    const readout = createViewReadout({drawer,documentTarget:document,windowTarget:window,
      surfaceReader:{...reader,read(...args: Parameters<typeof reader.read>){readoutReads++;return readSurface(...args);}}});
    readout.setCamera(camera);readout.setPlaybackState({allowed:false,reason:'motion-off'});
    await next();
    const baseline = readoutReads, start = performance.now();
    for(let i=0;i<40;i++){world={...world,pose:{...world.pose,positionM:[0,0,3e6+i*10000]}};publish();await next();}
    const elapsed=performance.now()-start, sampled=readoutReads-baseline;
    check(sampled <= Math.ceil(elapsed/100)+1 && sampled < 20,'Header must coalesce camera publications to 10 Hz');
    await pause(130);
    check(window.__cssearthTest.element('[data-view-altitude]').textContent === formatViewDistance(world.pose.positionM[2]-1e6),'Trailing sample must reflect the final camera');
    readout.setPlaybackState({allowed:false,reason:'unavailable'});await next();
    world={...world,epochJdTt:2461287.5,pose:{...world.pose,positionM:[0,0,9e6]}};publish();
    readout.setPlaybackState({allowed:false,reason:'motion-off'});await next();
    check(window.__cssearthTest.element('[data-view-altitude]').textContent === '8,000 km','Arrival bypasses throttle');
    check(window.__cssearthTest.element('[data-view-date]').textContent === formatViewDate(world.epochJdTt),'Date refreshes on calendar change');
    world={...world,pose:{...world.pose,positionM:[0,0,10e6]}};publish();
    readout.destroy();minimap.destroy();reader.destroy();
    const stopped=readoutReads;await pause(150);
    check(readoutReads===stopped && navigation.size===0 && shared.size===0,'Disposal cancels subscriptions and trailing timer');
    return {sharedAxes:true,pausedSeek:true,animationTiming:true,ancestorMutation:true,animation:true,bodyReplacement:true,
      closedMinimap:true,reopen:true,headerSamples:sampled,headerWindowMs:elapsed,arrival:true,date:true,disposal:true};
  });
  await page.goto(`${origin}/mercury/`);
  await page.waitForFunction(()=>window.__cssEarth?.ready);
  // Each surface lens has its own details section; the dataset context adds one more.
  const panel = page.locator('section[id$="-surface-lens"].planet-lens-details');
  await panel.evaluate(node=>window.__cssearthTest.detailsElement(node).open=true);
  const map = page.locator('[data-surface-minimap]:visible').first();
  await page.waitForFunction(()=>document.querySelector('[data-surface-minimap][data-ready="true"]'));
  const snapshot = () => map.evaluate(node=>JSON.stringify([window.__cssearthTest.htmlElement(node).dataset.centerU,window.__cssearthTest.htmlElement(node).dataset.centerV]));
  const before = await snapshot();
  await panel.locator('summary').click();
  await page.mouse.move(1100,500);await page.mouse.down();await page.mouse.move(1200,580,{steps:12});await page.mouse.up();
  await page.waitForTimeout(150);
  // Locator visibility changes on collapse; keep the same retained DOM element.
  const closed = await page.locator('[data-surface-minimap][data-ready="true"]').first()
    .evaluate(node=>JSON.stringify([window.__cssearthTest.htmlElement(node).dataset.centerU,window.__cssearthTest.htmlElement(node).dataset.centerV]));
  assert.equal(closed,before,'Collapsed app minimap does not publish stale hidden updates');
  await panel.locator('summary').click();
  await page.waitForFunction(before=>{
    const n=document.querySelector('[data-surface-minimap][data-ready="true"]');
    return JSON.stringify([window.__cssearthTest.htmlElement(n).dataset.centerU,window.__cssearthTest.htmlElement(n).dataset.centerV])!==before;
  },before);
  const reopened = await snapshot();
  await map.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(before=>{
    const n=document.querySelector('[data-surface-minimap][data-ready="true"]');
    return JSON.stringify([window.__cssearthTest.htmlElement(n).dataset.centerU,window.__cssearthTest.htmlElement(n).dataset.centerV])!==before;
  },reopened);
  result.checks.realCollapseReopen = true;
  result.checks.realMinimapInput = true;
  assert.equal(await page.locator('.planet-stage > .polycss-camera').count(),1);
  assert.deepEqual(result.errors,[]);
} finally { await browser.close(); await writeFile(`${output}/report.json`,JSON.stringify(result,null,2)); }
console.log(JSON.stringify(result));
