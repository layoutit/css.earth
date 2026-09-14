import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestPage } from './browser-observations.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { requireRecord } from '../../tools/source-values.mts';

const browser = await chromium.launch({headless:true});
const errors: string[] = [], navigations: string[] = [];
const reference = SCENE_OBJECTS.find(object=>object.id==='mercury')?.worldFrame;
assert.ok(reference);
try {
  const page = await createTestPage(browser,{viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url()); });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4210'}/mercury/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mercury?.ready && document.querySelectorAll('[data-volume-lens-object]').length>=4,null,{timeout:30000}).catch(async error => {
    console.error(await page.evaluate(()=>({title:document.title,body:document.body.innerText.slice(-1200),scene:window.__cssEarth?.ready,mercury:window.__mercury?.ready,banks:document.querySelectorAll('[data-volume-lens-object]').length})));
    throw error;
  });
  const scene = await page.locator('[data-volume-lens-object="m42"]').elementHandle();
  assert.ok(scene);
  console.log('NEBULA_SEARCH_READY');
  const search = page.locator('.planet-sidebar-search');
  for (const [query,id] of [['orion','m42'],['helix','helix'],['m2-9','m2-9'],['NGC 1976','m42'],['NGC 7293','helix'],['M2–9','m2-9']]) {
    console.log('NEBULA_SEARCH_QUERY',query);
    await search.fill(query!);
    const result = page.locator(`.planet-object-link[data-prepared-focus-id="${id}"]`);
    await result.waitFor({state:'visible'});
    await result.click();
    await page.waitForFunction(id=>new URL(location.href).searchParams.get('focus')===id,id);
    await page.locator(`[data-focus-lens-bank="${id}"]`).waitFor({state:'visible'});
    const volume = validatePreparedVolumeLenses(requireRecord(JSON.parse(await readFile(`src/objects/${id}/prepared/lenses.json`,'utf8'))).data);
    const frame = volume.lenses[0]!.volume.frame;
    await page.waitForFunction(({reference,center,radius})=>{
      const position=window.__cssearthTest.object('mercury').camera.captureWorldCamera(reference).pose.positionM;
      return Math.hypot(...position.map((value,axis)=>value-center[axis]!))<20*radius;
    },{reference,center:frame.originM,radius:volume.framingRadiusUnits*frame.metersPerUnit},{timeout:15000});
    assert.equal(new URL(page.url()).pathname,'/mercury/');
    assert.equal(await scene.evaluate(node=>node.isConnected),true);
    await page.waitForTimeout(350);
  }
  await search.fill('nebulae');
  await page.locator('[data-object-tab="nebula"][aria-selected="true"]').waitFor();
  assert.equal(await page.locator('.planet-object-link[data-prepared-focus-id]:visible').count(),3);
  await mkdir('output/nebula-search-browser',{recursive:true});
  await page.screenshot({path:'output/nebula-search-browser/results.png'});
  assert.deepEqual(errors,[]);
  assert.equal(navigations.length,1,'Search selection reloaded the document.');
  console.log('NEBULA_SEARCH_PASS: six aliases, three nebulae, retained Mercury scene, one document load.');
} finally { await browser.close(); }
