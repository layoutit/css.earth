import { requireRecord } from '../../tools/source-values.mts';
import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
interface QualityDecode {url:string;start:number;end:number|null;error?:string;}
interface QualityFrame {time:number;id:string|undefined;ready:boolean|undefined;stageOpacity:number;skies:number;scenes:number;sourceDiameter:number|null;detailDiameter:number|null;detailOnscreen:boolean|undefined;detailMaterialReady:boolean;pendingRequired:unknown;inputEnabled:boolean;spinner:string;}
interface QualityProof {from:string;to:string;start:number;frames:QualityFrame[];raf:number;}
interface RequestSample {url:string;start:number;status?:number;cached?:boolean;headerBytes?:number;networkStatus?:number;transferredBytes?:number;}
declare global {interface Window {__qualityDecodes:QualityDecode[];__navigationQuality:QualityProof;__qualityPointerDown:{input:boolean;diameter:number|undefined};}}

import { required } from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import { selectObject } from './navigate-object.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const lateDetail = process.env.CSSEARTH_TEST_LATE_DETAIL === '1';
const directory = `.local/navigation-quality${lateDetail ? '-late-detail' : ''}`;
await mkdir(directory, { recursive: true });
const definitions = Object.fromEntries(await Promise.all(['mercury', 'venus'].map(async id =>
  [id, parsePreparedObjectRuntime(await loadObjectTestDefinition(id))] as const)));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
let interruption;
try {
  for (const delayedImages of lateDetail ? [false] : [false, true]) {
    const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
    const errors:string[] = [], screenshots:{name:string;time:number}[] = [], writes:Promise<void>[] = [], requests = new Map<string,RequestSample>();
    const cdp = await page.context().newCDPSession(page);
    let throttleUntil = 0, throttledRequests = 0, screenshotSerial = 0, timeOrigin = 0;
    const delayedUrls = new Set(definitions.mercury.assets.entries.map(asset => new URL(asset.url, origin).href));
    page.on('pageerror', error => errors.push(error.message));
    if (lateDetail) await page.route('**/site/prepared-world-navigation.mts*', async route => {
      const response = await route.fetch(), source = await response.text();
      const checkpoint = '? detailHandoffTime(flight, from, source.frame, optics) : 0;';
      assert.equal(source.split(checkpoint).length, 2, 'Mutation must remove the real early handoff checkpoint');
      await route.fulfill({ response, body: source.replace(checkpoint, '? flight.durationS : 0;') });
    });
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', event => {
      if (event.type === 'Image') requests.set(event.requestId, { url: event.request.url,
        start: event.wallTime * 1000 - timeOrigin });
    });
    cdp.on('Network.responseReceived', event => {
      const request = requests.get(event.requestId);
      if (request) Object.assign(request, { status: event.response.status,
        cached: request.cached || event.response.fromDiskCache || event.response.fromPrefetchCache,
        headerBytes: event.response.encodedDataLength });
    });
    cdp.on('Network.requestServedFromCache', event => {
      const request = requests.get(event.requestId);
      if (request) request.cached = true;
    });
    cdp.on('Network.responseReceivedExtraInfo', event => {
      const request = requests.get(event.requestId);
      if (request) request.networkStatus = event.statusCode;
    });
    cdp.on('Network.loadingFinished', event => {
      const request = requests.get(event.requestId);
      if (request) request.transferredBytes = event.encodedDataLength;
    });
    await page.addInitScript(() => {
      window.__qualityDecodes = [];
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function () {
        const event:QualityDecode = { url: this.currentSrc || this.src, start: performance.now(), end: null };
        window.__qualityDecodes.push(event);
        return decode.call(this).then(value => { event.end = performance.now(); return value; }, error => {
          event.error = String(error); throw error;
        });
      };
    });
    if (delayedImages) {
      await cdp.send('Fetch.enable', { patterns: [{ resourceType: 'Image', requestStage: 'Response' }] });
      cdp.on('Fetch.requestPaused', async event => {
        const wait = throttleUntil - Date.now();
        if (wait > 0 && delayedUrls.has(event.request.url)) {
          throttledRequests++;
          await new Promise(resolve => setTimeout(resolve, wait));
        }
        await cdp.send('Fetch.continueRequest', { requestId: event.requestId });
      });
    }
    await page.goto(`${origin}/venus/`);
    await page.waitForFunction(() => window.__cssEarth?.ready === true);
    timeOrigin = await page.evaluate(() => performance.timeOrigin);
    requests.clear();
    if (!delayedImages) {
      cdp.on('Page.screencastFrame', event => {
        const name = `${String(screenshotSerial++).padStart(4, '0')}.jpg`;
        screenshots.push({ name, time: required(event.metadata.timestamp) * 1000 - timeOrigin });
        writes.push(writeFile(`${directory}/${name}`, Buffer.from(event.data, 'base64')));
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: 1000, maxHeight: 700, everyNthFrame: 4 });
    }
    for (const [from, to] of [['venus', 'mercury'], ['mercury', 'venus']]) {
      await page.evaluate(({ from, to }) => {
        const stage = window.__cssearthTest.html('.planet-stage');
        const proof:QualityProof = window.__navigationQuality = { from, to, start: performance.now(), frames: [],raf:0 };
        function sample(time:number) {
          const id = window.__cssearthTest.htmlElement(stage).dataset.objectId, diagnostics = window.__cssEarth?.object(id);
          const body = diagnostics?.runtime.view()?.body;
          const camera = stage.querySelector('.polycss-camera')?.getBoundingClientRect();
          const centre = body?.screen && camera ? [camera.x + camera.width / 2 + body.screen[0],
            camera.y + camera.height / 2 + body.screen[1]] : null;
          proof.frames.push({ time, id, ready: window.__cssEarth?.ready,
            stageOpacity: Number(getComputedStyle(window.__cssearthTest.required(stage, 'computed style element')).opacity), skies: stage.querySelectorAll('.planet-cubic-sky').length,
            scenes: stage.querySelectorAll('.polycss-scene').length,
            sourceDiameter: id === from ? diagnostics?.runtime.view()?.levelOfDetail?.silhouetteDiameter ?? null : null,
            detailDiameter: diagnostics?.runtime.view()?.levelOfDetail?.silhouetteDiameter ?? null,
            detailOnscreen: body?.visible && centre !== null && centre[0] > 0 && centre[0] < innerWidth &&
              centre[1] > 0 && centre[1] < innerHeight,
            detailMaterialReady: diagnostics?.runtime.selection().ready ?? false,
            pendingRequired: diagnostics?.runtime.resources().pending ?? null,
            inputEnabled: getComputedStyle(window.__cssearthTest.required(document.querySelector('.planet-input-surface'), 'computed style element')).pointerEvents === 'auto',
            spinner: getComputedStyle(document.body, '::after').content,
          });
          proof.raf = requestAnimationFrame(sample);
        }
        proof.raf = requestAnimationFrame(sample);
      }, { from, to });
      if (delayedImages && to === 'mercury') throttleUntil = Date.now() + 3500;
      await selectObject(page, to);
      await page.waitForFunction(to => location.pathname === `/${to}/` && window.__cssEarth?.activeObjectId === to && window.__cssEarth?.ready === true, to, { timeout: 60000 }).catch(async error => {
        await page.screenshot({ path: `${directory}/failed-${from}-to-${to}.png` });
        await writeFile(`${directory}/failed-${from}-to-${to}.json`, JSON.stringify(await page.evaluate(() => ({
          url: location.href, state: window.__cssEarth, proof: window.__navigationQuality, decodes: window.__qualityDecodes,
        })), null, 2));
        throw error;
      });
      const arrivalTime = await page.evaluate(() => performance.now());
      await page.waitForTimeout(250);
      const proof = await page.evaluate(to => {
        const p = window.__navigationQuality; cancelAnimationFrame(p.raf);
        return { start: p.start, end: performance.now(), frames: p.frames,
          decodes: window.__qualityDecodes.filter(event => event.start >= p.start),
          required: window.__cssearthTest.object(to).runtime.resources().committed };
      }, to);
      assert.ok(proof.frames.length > 0, `The real frame sampler must run: ${JSON.stringify(errors)}`);
      const definition = definitions[to], assets = new Map(definition.assets.entries.map(asset => [asset.key, new URL(asset.url, origin).href]));
      const requiredUrls = new Set(proof.required.map(key => assets.get(key)));
      const startupUrls = new Set(definition.assets.startup.map(key => assets.get(key)));
      const sourceFrames = proof.frames.filter(frame => frame.id === from);
      const switched = proof.frames.find(frame => frame.id === to && frame.scenes === 1);
      const limit = required(definition.camera.levelOfDetail).billboardFadeStartDiscPixels;
      const requiredDecodes = proof.decodes.filter(event => requiredUrls.has(event.url));
      const startupDecodes = proof.decodes.filter(event => startupUrls.has(event.url));
      // A304 response revalidates an already decoded entity; it does not fetch
      // destination image bytes again. CDP exposes the actual network status.
      const imageTransfers = [...requests.values()].filter(event => !event.cached && event.networkStatus !== 304 &&
        event.transferredBytes !== undefined && event.headerBytes !== undefined && event.transferredBytes > event.headerBytes);
      const detailApproach = proof.frames.filter(frame => frame.id === to && frame.time < arrivalTime &&
        frame.detailOnscreen && frame.detailDiameter !== null && frame.detailDiameter > limit && frame.detailDiameter < 300);
      const report = { from, to, delayedImages, start: proof.start, end: proof.end,
        durationMs: proof.end - proof.start, switchMs: switched ? switched.time - proof.start : null,
        startupImagesReadyMs: Math.max(...startupDecodes.map(event => event.end ?? Infinity)) - proof.start,
        lastRequiredDecodeMs: Math.max(...requiredDecodes.map(event => event.end ?? Infinity)) - proof.start,
        lateRequiredDecodes: requiredDecodes.filter(event => event.start > (switched?.time ?? Infinity)),
        lateRequiredImageRequests: imageTransfers.filter(event => event.start >= (switched?.time ?? Infinity) && requiredUrls.has(event.url)),
        arrivalImageRequests: imageTransfers.filter(event => event.start >= arrivalTime && requiredUrls.has(event.url)),
        imageRequests: [...requests.values()].filter(event => event.start >= proof.start && requiredUrls.has(event.url)),
        distantWaitFrames: delayedImages && to === 'mercury' ? sourceFrames.filter(frame =>
          frame.time > proof.start + 2000 && frame.sourceDiameter !== null && frame.sourceDiameter <= limit).length : 0,
        detailedApproachFrames: detailApproach.length,
        detailedApproachDurationMs: detailApproach.length ? required(detailApproach.at(-1)).time - detailApproach[0].time : 0,
        detailedApproachGrowth: detailApproach.length ? required(required(detailApproach.at(-1)).detailDiameter) /
          Math.min(...detailApproach.map(frame => required(frame.detailDiameter))) : 0,
        unreadyDetailedApproach: detailApproach.filter(frame => !frame.detailMaterialReady),
        disabledApproachInput: detailApproach.filter(frame => !frame.inputEnabled),
        loadingSpinners: proof.frames.filter(frame => !['none', 'normal'].includes(frame.spinner)),
        finalDetailDiameter: required(proof.frames.at(-1)).detailDiameter,
        maximumDetailedScenes: Math.max(...proof.frames.map(frame => frame.scenes)),
        gaps: proof.frames.filter(frame => frame.stageOpacity !== 1 || frame.skies < 1),
        throttledRequests, frames: proof.frames, decodes: proof.decodes, errors };
      reports.push(report);
      console.log(JSON.stringify({ ...report, frames: undefined, decodes: undefined, imageRequests: undefined }));
    }
    if (!delayedImages && !lateDetail) {
      await selectObject(page, 'mercury');
      await page.mouse.move(720, 500);
      await page.evaluate(() => document.addEventListener('pointerdown', event => {
        window.__qualityPointerDown = { input: Boolean((event.target instanceof Element ? event.target : null)?.closest('.planet-input-surface')),
          diameter: window.__mercury?.runtime.view()?.levelOfDetail?.silhouetteDiameter };
      }, { capture: true, once: true }));
      await page.waitForFunction(() => {
        const diagnostics = window.__mercury, diameter = diagnostics?.runtime.view()?.levelOfDetail?.silhouetteDiameter;
        const body = diagnostics?.runtime.view()?.body;
        const camera = document.querySelector('.polycss-camera')?.getBoundingClientRect();
        if (!body?.visible || !body.screen || !camera || diameter === undefined) return false;
        const x = camera.x + camera.width / 2 + body.screen[0], y = camera.y + camera.height / 2 + body.screen[1];
        // A large off-axis projection can precede the actual visible approach.
        return window.__cssEarth?.ready === false && diameter > 30 && diameter < 150 &&
          x > 0 && x < innerWidth && y > 0 && y < innerHeight;
      });
      await page.mouse.down(); await page.mouse.up();
      await page.waitForFunction(() => window.__cssEarth?.ready === true);
      const stopped = await page.evaluate(() => ({ id: window.__cssearthTest.scene().activeObjectId, path: location.pathname,
        diameter: window.__mercury?.runtime.view()?.levelOfDetail?.silhouetteDiameter,
        pointer: window.__qualityPointerDown,
        transform: window.__cssearthTest.html('.polycss-scene').style.transform }));
      await page.waitForTimeout(300);
      const retained = await page.locator('.polycss-scene').evaluate(node => window.__cssearthTest.htmlElement(node).style.transform);
      interruption = { ...stopped, poseRetained: stopped.transform === retained };
      assert.equal(stopped.id, 'mercury'); assert.equal(stopped.path, '/mercury/');
      assert.equal(stopped.pointer.input, true, 'The interruption uses an actual pointerdown on the native input surface');
      assert.ok(stopped.diameter !== undefined);
      assert.ok(stopped.diameter > 20 && stopped.diameter < 300,
        `Pointer input must stop the incoming approach before arrival: ${JSON.stringify(stopped)}`);
      assert.equal(retained, stopped.transform, 'Input cancellation preserves the last painted incoming camera');
      console.log(`NATIVE APPROACH INTERRUPTION PASS at ${stopped.diameter.toFixed(2)}px`);
    }
    if (!delayedImages) {
      await cdp.send('Page.stopScreencast'); await Promise.all(writes);
      await writeFile(`${directory}/filmstrip.json`, JSON.stringify(screenshots, null, 2));
    }
    await page.close();
  }
  await writeFile(`${directory}/report.json`, JSON.stringify({ reports, interruption }, null, 2));
  for (const report of reports) {
    assert.equal(report.maximumDetailedScenes, 1);
    assert.deepEqual(report.gaps, [], 'The world sky must remain fully visible');
    assert.deepEqual(report.lateRequiredDecodes, [], 'Required destination images must decode before detailed handoff');
    assert.deepEqual(report.lateRequiredImageRequests, [], 'Required destination images must be fetched before detailed handoff');
    assert.deepEqual(report.arrivalImageRequests, [], 'Arrival introduces no new required image transfer');
    assert.ok(report.detailedApproachFrames >= 3 && report.detailedApproachDurationMs >= 100 && report.detailedApproachGrowth > 2,
      'Detailed geometry must paint a sustained growing approach between20px and300px');
    assert.deepEqual(report.unreadyDetailedApproach, [], 'Approach uses committed detailed materials');
    assert.deepEqual(report.disabledApproachInput, [], 'The visible detailed approach remains interruptible through the native input surface');
    assert.deepEqual(report.loadingSpinners, [], 'A presented world is not overlaid by the cold-start spinner');
    assert.ok(required(report.finalDetailDiameter) > 300, 'Detailed geometry reaches the close arrival');
    assert.deepEqual(report.errors, []);
    if (report.delayedImages && report.to === 'mercury') {
      assert.ok(report.throttledRequests > 0, 'Delayed preflight must intercept actual destination image responses');
      assert.ok(report.startupImagesReadyMs >= 3500, 'Real destination decode must await the delayed response');
      assert.ok(report.distantWaitFrames >= 20, 'The source remains distant while destination images are unavailable');
    }
  }
  console.log('NAVIGATION QUALITY PASS: detailed handoff paints a growing approach, including delayed destination images');
} finally { await browser.close(); }
