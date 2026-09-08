/** Explicit local sampling actions, progress/cancel and retained scene integration. */
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright';
import type { SamplingResult, SamplePoint } from './star-sampling-types.js';

interface CapturedSampleResponse { action: string; status?: number; raw?: string; contentType?: string; error?: string; }
declare global { interface Window { __sampleResponses?: CapturedSampleResponse[]; __loupeClick?: { x: number; y: number; width: number; height: number; extent: {x:number;y:number;width:number;height:number} }; __samplingLeaves?: HTMLElement[]; __overviewClick?: { x: number; y: number; width: number; height: number }; } }
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage(), errors: string[] = [], calls: { imageId: string; action: string; points?: SamplePoint[]; point?: SamplePoint }[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.url().endsWith('/__nebula/star-samples')) calls.push(request.postDataJSON()); });
const output = '.local/nebula-lab/star-sampling-browser'; await mkdir(output, { recursive: true });
await page.route('**/__nebula/star-removal-jobs**', route => route.abort('blockedbyclient')); // Never process a full real source in this gate.
await page.addInitScript(() => {
  const original = window.fetch; window.__sampleResponses = [];
  window.fetch = async (...args) => {
    if (!String(args[0]).endsWith('/__nebula/star-samples')) return original(...args);
    const record: CapturedSampleResponse = { action: JSON.parse(String(args[1]?.body)).action };
    window.__sampleResponses!.push(record);
    try {
      const response = await original(...args);
      record.status = response.status; record.contentType = response.headers.get('content-type') ?? '';
      void response.clone().text().then(raw => { record.raw = raw; }).catch(error => { record.error = String(error); });
      return response;
    } catch (error) { record.error = String(error); throw error; }
  };
});
const fits = () => calls.filter(call => call.action !== 'overview').length;
let progressEvents = 0;
async function prepared(action: string, actionFn: () => Promise<unknown>, reload = false): Promise<SamplingResult> {
  console.log(`Sampling action: ${action}`);
  const index = reload ? 0 : await page.evaluate(() => window.__sampleResponses!.length);
  await actionFn();
  await page.waitForFunction(({ index, action }) => window.__sampleResponses?.slice(index).some(record => record.action === action && (record.raw !== undefined || record.error)), { index, action }, { timeout: 45000 });
  const reply = await page.evaluate(({ index, action }) => window.__sampleResponses!.slice(index).find(record => record.action === action && (record.raw !== undefined || record.error))!, { index, action });
  assert.equal(reply.error, undefined); assert.equal(reply.status, 200);
  const raw = reply.raw!;
  const events = reply.contentType?.includes('application/x-ndjson') ? raw.trim().split('\n').map(line => JSON.parse(line)) : [];
  progressEvents += events.filter(event => event.type === 'progress').length;
  const body = events.length ? [...events].reverse().find(event => event.type === 'result')?.result : JSON.parse(raw);
  assert.ok(body, `No completed sample result: ${raw.slice(-1000)}`);
  await page.waitForFunction(operation => document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.samplingOperation === operation &&
    document.querySelector<HTMLButtonElement>('#star-cancel')?.disabled === true, action, { timeout: 120000 });
  console.log(`Sampling completed: ${action}, ${body.samples.length} samples`);
  return body;
}
async function verifyApplyFixture(calibrated: SamplingResult) {
  const fixtureDirectory = `${output}/applied-fixture`; await mkdir(fixtureDirectory, { recursive: true });
  const catalogue = JSON.parse(await readFile('labs/nebula/models/lmc-star-separation/variants.json', 'utf8'));
  const row = catalogue.variants.find((value: {imageId:string}) => value.imageId === calibrated.imageId);
  const layers = await Promise.all(row.layers.map(async (layer: {id:'diffuse'|'stars';texturePath:string;widthPx:number;heightPx:number}) => {
    const texturePath = `${fixtureDirectory}/${layer.id}.webp`; await copyFile(layer.texturePath, texturePath);
    return { id: layer.id, texturePath, url: `/@fs/alternate-realpath-checkout/${texturePath}`, widthPx: layer.widthPx, heightPx: layer.heightPx,
      sha256: createHash('sha256').update(await readFile(texturePath)).digest('hex') };
  }));
  type Job = { id:string; imageId:string; status:string; progress:{stage:string;current:number;total:number;message:string};result:SamplingResult };
  const jobs = new Map<string,Job>(), results = new Map<string,SamplingResult>(), started: {requestId:string;request:{points:SamplePoint[];calibrationToken:string}}[] = [];
  let holdJob = false, failedStatusReads = 0, cancelCalls = 0, holdRestore = false, failRestore = false, releaseRestore!: () => void;
  let restoreBarrier = new Promise<void>(resolve => { releaseRestore = resolve; });
  const toneCalls: {samplingResultId?:string;removalStrength?:number}[] = [];
  const latestCalibration = () => page.evaluate(() => {
    const raw = [...window.__sampleResponses!].reverse().find(record => record.action === 'preview' && record.raw)!.raw!;
    return [...raw.trim().split('\n').map(line => JSON.parse(line))].reverse().find(event => event.type === 'result').result as SamplingResult;
  });
  await page.route('**/__nebula/star-removal-jobs**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/star-removal-jobs')) {
      const body = route.request().postDataJSON();
      if (!jobs.has(body.requestId)) {
        const learned = await latestCalibration(); assert.equal(body.request.calibrationToken, learned.calibrationToken);
        const saved = await page.evaluate(imageId => JSON.parse(localStorage.getItem(`cssearth-star-removal-job-v1:${imageId}`)!), calibrated.imageId);
        assert.equal(saved.id, body.requestId); assert.deepEqual(saved.request, body.request, 'Persist the exact job request before POST.');
        started.push(body); const resultId = `browser-fixture-${started.length}`;
        const result: SamplingResult = { ...learned, operation: 'apply', applied: { resultId, layers } }; results.set(resultId, result);
        jobs.set(body.requestId, { id: body.requestId, imageId: learned.imageId, status: holdJob ? 'running' : 'completed', result,
          progress: { stage:'fixture', current:1, total:2, message:'Controlled job fixture' } });
      }
      return route.fulfill({ status:202, json:{job:jobs.get(body.requestId)} });
    }
    const id = path.split('/').at(path.endsWith('/cancel') ? -2 : -1)!, job = jobs.get(id);
    if (!job) return route.fulfill({ status:404,json:{error:'Job not found'} });
    if (path.endsWith('/cancel')) { cancelCalls++; job.status = 'cancelled'; }
    else if (failedStatusReads > 0) { failedStatusReads--; return route.abort('failed'); }
    return route.fulfill({json:{job}});
  });
  await page.route('**/__nebula/star-samples/restore', async route => {
    const request = route.request().postDataJSON(), result = results.get(request.resultId);
    if (holdRestore) await restoreBarrier;
    if (!result || failRestore) return route.fulfill({status:404,json:{error:'Prepared images unavailable'}}).catch(()=>{});
    return route.fulfill({json:{imageId:result.imageId,sourceSha256:result.sourceSha256,sourcePreviewSha256:result.sourcePreviewSha256,nativeDimensions:result.nativeDimensions,applied:result.applied}}).catch(()=>{});
  });
  await page.route('**/__nebula/prepare-tone', async route => {
    const request = route.request().postDataJSON(); toneCalls.push(request);
    if (!results.has(request.samplingResultId)) return route.continue();
    if (request.imageLayer === 'original') { const {samplingResultId:_id,...base}=request; return route.continue({postData:JSON.stringify(base)}); }
    const layer = layers.find(value => value.id === request.imageLayer)!;
    let url = `/@fs${resolve(layer.texturePath)}`;
    if (request.removalStrength === 50 && request.imageLayer === 'diffuse') {
      const path = `${fixtureDirectory}/midpoint.png`;
      const manifest = JSON.parse(await readFile('labs/nebula/models/lmc-candidates/overlays.json','utf8'));
      const original = manifest.overlays.find((value:{id:string})=>value.id===calibrated.imageId);
      const source = await sharp(`labs/nebula/models/lmc-candidates/${original.texturePath}`).resize(layer.widthPx,layer.heightPx).ensureAlpha().raw().toBuffer();
      const endpoint = await sharp(layer.texturePath).ensureAlpha().raw().toBuffer();
      for(let index=0;index<source.length;index++) if(index%4!==3) source[index]=Math.round((source[index]!+endpoint[index]!)/2);
      await sharp(source,{raw:{width:layer.widthPx,height:layer.heightPx,channels:4}}).png().toFile(path);url=`/@fs${resolve(path)}`;
    }
    return route.fulfill({json:{resources:[{sourcePath:layer.texturePath,url,width:layer.widthPx,height:layer.heightPx}]}});
  });
  async function start() {
    const count = started.length; await page.locator('#star-apply').click();
    await page.waitForFunction(() => Boolean(document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.removalJob));
    for(let tries=0;started.length===count&&tries<100;tries++) await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(started.length,count+1);return jobs.get(started.at(-1)!.requestId)!;
  }
  const waitInstalled = (id:string) => page.waitForFunction(value=>document.querySelector<HTMLElement>('#viewer')?.dataset.samplingResultId===value,id);
  const before = await scene();
  await prepared('survey',()=>page.locator('#star-survey').click()); assert.equal(await page.locator('#star-apply').isEnabled(),true);
  const first = await start(); await waitInstalled(first.result.applied!.resultId);
  const after = await scene(); assert.deepEqual(after.nodes.map(({image:_image,...geometry})=>geometry),before.nodes.map(({image:_image,...geometry})=>geometry));
  assert.ok(after.nodes.some(node=>node.image.includes('applied-fixture')));assert.ok(after.nodes.every(node=>!node.image.includes('alternate-realpath-checkout')));
  await page.locator('#star-removal').fill('50');await page.locator('#star-removal').dispatchEvent('change');
  await page.waitForFunction(()=>[...document.querySelectorAll<HTMLElement>('[data-overlay-leaf="wise-wide-infrared"]')].every(node=>node.style.backgroundImage.includes('midpoint.png')));
  assert.ok(toneCalls.some(call=>call.samplingResultId===first.result.applied!.resultId&&call.removalStrength===50));
  const countBeforeRefresh=started.length, fitsBeforeRefresh=fits();
  await page.reload();await waitInstalled(first.result.applied!.resultId);
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.samplingOperation==='overview');
  assert.equal(started.length,countBeforeRefresh);assert.equal(fits(),fitsBeforeRefresh);assert.equal(await page.locator('#star-removal').inputValue(),'50');

  holdJob=true;const running=await start();assert.equal(await page.locator('#star-apply').isDisabled(),true);
  const startsBeforeDetach=started.length, fitsBeforeDetach=fits();failedStatusReads=1;
  await page.reload();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.removalJobStatus==='running');
  assert.equal(await page.locator('#star-apply').isDisabled(),true);assert.equal(started.length,startsBeforeDetach);assert.equal(fits(),fitsBeforeDetach);
  assert.equal(cancelCalls,0,'Refresh must not cancel the server job.');
  running.status='completed';await waitInstalled(running.result.applied!.resultId);
  const cancelling=await start();await page.locator('#star-cancel').click();
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.removalJobStatus==='cancelled');
  assert.equal(cancelling.status,'cancelled');assert.equal(cancelCalls,1);assert.equal(await page.locator('#star-apply').isEnabled(),true);

  holdRestore=true;await page.reload();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.samplingOperation==='overview');
  holdJob=false;const newer=await start();await waitInstalled(newer.result.applied!.resultId);releaseRestore();holdRestore=false;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#viewer').getAttribute('data-sampling-result-id'),newer.result.applied!.resultId,'A stale restore must not overwrite the new result.');
  failRestore=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#overlay-status')?.textContent?.includes('Saved removal unavailable'));
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('#star-sampling-controls')?.dataset.samplingOperation==='overview');
  assert.ok(Number(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'))>=32,'Missing outputs must retain reference previews and positions.');
  await page.screenshot({path:`${output}/persistence.png`});
}
const scene = () => page.evaluate(() => ({ revision: document.querySelector<HTMLElement>('#viewer')?.dataset.cameraRevision,
  distance: document.querySelector<HTMLElement>('#viewer')?.dataset.distance,
  nodes: window.__samplingLeaves!.map(node => ({ connected: node.isConnected, transform: node.style.transform, image: node.style.backgroundImage, opacity: node.style.opacity })) }));
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/?subject=lmc-clouds&tab=alignment`);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true' && document.querySelectorAll('#overlay-choice option').length === 8);
  assert.equal(await page.locator('#image-sidebar-tab').getAttribute('aria-selected'), 'true'); assert.equal(calls.length, 0);
  await page.selectOption('#overlay-choice', 'wise-wide-infrared');
  await page.waitForFunction(() => document.querySelectorAll('[data-overlay-leaf="wise-wide-infrared"]').length === 3);
  await page.waitForFunction(() => document.querySelector('[data-tone-target="image"] .tone-status')?.textContent === 'Tone applied');
  await page.evaluate(() => { window.__samplingLeaves = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh > s')]; });
  const before = await scene();
  const overviewMetadata = await prepared('overview', () => page.locator('#star-removal-tab').click());
  assert.equal(fits(), 0, 'Opening Star removal must not fit stars.');
  assert.equal(overviewMetadata.samples.length, 0);
  assert.equal(await page.locator('#star-survey').isVisible(), true);
  assert.equal(await page.locator('#star-apply').isDisabled(), true);
  assert.equal(await page.locator('#star-overview').isVisible(), true);
  assert.equal(await page.locator('#star-removal-range').isVisible(), true);
  assert.equal(await page.locator('#overlay-options').isVisible(), false);

  await page.locator('#star-survey').click();
  await page.locator('#star-sampling-progress').waitFor({ state: 'visible' });
  await page.locator('#star-cancel').click();
  assert.match(await page.locator('#star-sampling-status').innerText(), /Cancelled/);
  assert.equal(await page.locator('#star-cancel').isDisabled(), true);
  const started = performance.now();
  const survey = await prepared('survey', () => page.locator('#star-survey').click());
  const surveyElapsedMs = Math.round(performance.now() - started);
  assert.ok(progressEvents > 0, 'The real worker must report progress.');
  assert.equal(survey.imageId, 'wise-wide-infrared'); assert.ok(survey.samples.length >= 20 && survey.samples.length <= 50);
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'), String(survey.samples.length));
  assert.equal(await page.locator('#star-position').innerText(), `1 / ${survey.samples.length}`);
  await page.locator('#star-next').click(); assert.equal(await page.locator('#star-position').innerText(), `2 / ${survey.samples.length}`);
  await page.locator('#star-previous').click();
  await page.waitForFunction(() => ['source', 'model', 'residual'].every(id => {
    const image = document.querySelector<HTMLImageElement>(`#star-crop-${id}`); return image?.complete && image.naturalWidth > 0;
  }));
  const first = survey.samples[0]!;
  const marked = page.locator('#star-include'), priorIncluded = await marked.isChecked();
  const beforeChanges = fits();
  await marked.setChecked(!priorIncluded);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(fits(), beforeChanges, 'Selection changes must not start automatic fitting.');
  assert.match(await page.locator('#star-sampling-status').innerText(), /References changed/);
  assert.equal(await page.locator('#copy-star-recipe').isDisabled(), true);
  assert.equal(await page.locator('#star-apply').isEnabled(), true, 'Changed references must not require a separate calibration step.');
  const preview = await prepared('preview', () => page.locator('#star-preview').click());
  assert.equal(preview.calibration!.controls.widthScale, 1);
  assert.equal(await page.locator('#star-apply').isEnabled(), Boolean(preview.calibrationToken && preview.calibration?.profileBank?.length));
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'), String(survey.samples.length), 'A moved fitted centroid must not duplicate the same seed.');
  if (preview.validationSamples?.length) {
    assert.equal(await page.locator('#star-reference-view').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#star-include').isVisible(), true);
    await page.locator('#star-check-view').click(); assert.equal(await page.locator('#star-include').isVisible(), false);
    await page.locator('#star-reference-view').click();
  }
  assert.deepEqual(await scene(), before);

  const overview = await page.locator('#star-overview').boundingBox(); assert.ok(overview);
  await page.evaluate(() => document.querySelector('#star-overview')!.addEventListener('click', event => {
    const bounds = (event.currentTarget as HTMLImageElement).getBoundingClientRect(), mouse = event as MouseEvent;
    window.__overviewClick = { x: mouse.clientX - bounds.left, y: mouse.clientY - bounds.top, width: bounds.width, height: bounds.height };
  }, { once: true }));
  const beforePick = fits(), previousCrop = await page.locator('#star-crop-source').getAttribute('src');
  await page.locator('#star-overview').click({ position: { x: (first.point.x + .5) / survey.nativeDimensions[0] * overview.width,
    y: (first.point.y + .5) / survey.nativeDimensions[1] * overview.height } });
  assert.equal(fits(), beforePick, 'Picking a position must not start an automatic fit.');
  assert.equal(await page.locator('#star-selected').isVisible(), true, 'A pending pick must retain the current star crops.');
  assert.equal(await page.locator('#star-crop-source').getAttribute('src'), previousCrop);
  assert.equal(await page.locator('#star-loupe').isVisible(), true);
  assert.equal(await page.locator('#star-apply').isDisabled(), true, 'An unconfirmed position must not masquerade as an included reference.');
  const crop = await page.locator('#star-crop-source').boundingBox(); assert.ok(crop);
  await page.locator('#star-crop-source').click({ position: { x: (first.point.x - first.cutout.x + .5) / first.cutout.width * crop.width,
    y: (first.point.y - first.cutout.y + .5) / first.cutout.height * crop.height } });
  assert.equal(await page.locator('.star-loupe-label').textContent(), 'Native crop');
  await page.evaluate(() => document.querySelector('#star-loupe')!.addEventListener('click', event => {
    const host = event.currentTarget as HTMLElement, bounds = host.getBoundingClientRect(), mouse = event as MouseEvent;
    window.__loupeClick = { x: mouse.clientX - bounds.left - host.clientLeft, y: mouse.clientY - bounds.top - host.clientTop,
      width: host.clientWidth, height: host.clientHeight, extent: JSON.parse(host.dataset.extent!) };
  }, { once: true, capture: true }));
  await page.locator('#star-loupe').click({ position: { x: 65, y: 65 } });
  assert.equal(fits(), beforePick, 'Refining a position must not fit automatically.');
  await page.screenshot({ path: `${output}/magnifier.png` });
  const click = await page.evaluate(() => window.__loupeClick!);
  const expected = { x: Math.max(click.extent.x, Math.min(click.extent.x + click.extent.width - 1, click.extent.x + click.x / click.width * click.extent.width - .5)),
    y: Math.max(click.extent.y, Math.min(click.extent.y + click.extent.height - 1, click.extent.y + click.y / click.height * click.extent.height - .5)) };
  const inspect = await prepared('inspect', () => page.locator('#star-inspect').click());
  const inspectCall = calls.filter(value => value.action === 'inspect').at(-1)!;
  assert.ok(Math.abs(inspectCall.point!.x - expected.x) < 1e-8 && Math.abs(inspectCall.point!.y - expected.y) < 1e-8);
  assert.ok(inspect.samples.length > 0);
  assert.equal(await page.locator('#star-include').isChecked(), true, 'An explicitly added star must enter the reference selection.');
  assert.equal(await page.locator('#star-apply').isEnabled(), true);
  const beforeAdditional = Number(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'));
  const additions = preview.validationSamples!.filter(value => !survey.samples.some(sample => Math.hypot(sample.point.x - value.point.x, sample.point.y - value.point.y) < 64)).slice(0,2);
  assert.equal(additions.length,2,'Two separate native check stars are needed for manual references.');
  for (const additional of additions) {
    await page.locator('#star-overview').evaluate((image, point) => {
      const bounds = image.getBoundingClientRect(); image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: bounds.left + (point.x + .5) / point.width * bounds.width, clientY: bounds.top + (point.y + .5) / point.height * bounds.height }));
    }, { ...additional.point, width: survey.nativeDimensions[0], height: survey.nativeDimensions[1] });
    await prepared('inspect', () => page.locator('#star-inspect').click());
  }
  const referenceCount = await page.locator('#star-sampling-controls').getAttribute('data-sample-count');
  assert.equal(referenceCount,String(beforeAdditional+2));
  const focusedReference = await page.locator('#star-sampling-controls').getAttribute('data-selected-reference');
  await prepared('preview', () => page.locator('#star-preview').click());
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'), referenceCount);
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-selected-reference'), focusedReference);
  assert.equal(await page.locator('#star-reference-view').getAttribute('aria-pressed'), 'true', 'Calibrating must not replace the references with check stars.');
  await page.locator('#copy-star-recipe').click();
  await page.waitForFunction(() => document.querySelector('#star-sampling-status')?.textContent === 'Calibration copied.');
  const recipe = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(recipe.sourceSha256, survey.sourceSha256); assert.deepEqual(recipe.nativeDimensions, survey.nativeDimensions); assert.equal(recipe.controls.widthScale, 1);
  assert.deepEqual(await scene(), before);

  const focusedCrop = await page.locator('#star-crop-source').getAttribute('src'), beforeRefresh = fits();
  await prepared('overview', () => page.reload(), true);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#viewer')?.dataset.ready === 'true');
  assert.equal(fits(), beforeRefresh, 'Refresh must not fit or remove any stars.');
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-sample-count'), referenceCount);
  assert.equal(await page.locator('#star-sampling-controls').getAttribute('data-selected-reference'), focusedReference);
  await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('#star-crop-source'); return image?.complete && image.naturalWidth > 0; });
  assert.equal(await page.locator('#star-crop-source').getAttribute('src'), focusedCrop, 'Real cached native crop URLs must survive refresh.');
  assert.equal(await page.locator('#copy-star-recipe').isDisabled(), true, 'Restored previews are not a freshly verified calibration.');
  await page.evaluate(() => { window.__samplingLeaves = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh > s')]; });
  await page.locator('#image-sidebar-tab').click(); assert.equal(await page.locator('#overlay-options').isVisible(), true);
  const beforeRestore = fits();
  await prepared('overview', () => page.locator('#star-removal-tab').click());
  assert.equal(fits(), beforeRestore, 'Restoring sample settings must not fit stars.');
  assert.equal(await page.locator('#star-width').count(), 0, 'Technical profile inputs should not be shown.');
  await prepared('preview', () => page.locator('#star-preview').click());
  const restored = calls.filter(value => value.action === 'preview').at(-1)!;
  assert.deepEqual(restored.points, recipe.points, 'Restoring must retain replay seeds and exclude unchecked stars.');
  await page.locator('#image-sidebar-tab').click(); await page.selectOption('#overlay-choice', 'smash-original');
  const requestCount = calls.length; await page.locator('#star-removal-tab').click();
  assert.match(await page.locator('#star-sampling-status').innerText(), /available for VISTA/); assert.equal(calls.length, requestCount);
  await page.locator('#image-sidebar-tab').click(); await page.selectOption('#overlay-choice', 'wise-wide-infrared');
  await prepared('overview', () => page.locator('#star-removal-tab').click());
  await prepared('preview', () => page.locator('#star-preview').click());
  await page.screenshot({ path: `${output}/sidebar.png` });
  await verifyApplyFixture(preview);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ passed: true, surveyElapsedMs, samples: survey.samples.length,
    qualified: survey.samples.filter(sample => sample.qualified).length, applyValidation: 'Controlled API fixture; no full native source was processed', progressEvents, requestCount: calls.length, controls: recipe.controls }, null, 2));
  console.log(JSON.stringify({ passed: true, surveyElapsedMs, samples: survey.samples.length, progressEvents }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.error({ status: await page.locator('#star-sampling-status').textContent(), calls, errors });
  throw error;
} finally { await browser.close(); }
