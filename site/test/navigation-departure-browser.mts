import { requireRecord } from '../../tools/source-values.mts';
import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
interface DepartingBody {diameter:number|null;centre:number[]|null;intersectsViewport:boolean;sceneHidden:boolean;sceneOpacity:number;publishedDiameter:number;}
interface DepartureFrame {time:number;id:string|undefined;source:DepartingBody|null;stageOpacity:number;skies:number;scenes:number;previousMarker:unknown;}
interface DepartureProof {start:number;frames:DepartureFrame[];raf:number;}
declare global {interface Window {__departureProof:DepartureProof;}}

import { required } from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import { selectObject } from './navigate-object.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const unlimitedDeparture = process.env.CSSEARTH_TEST_UNLIMITED_DEPARTURE === '1';
const directory = `.local/navigation-departure${unlimitedDeparture ? '-unlimited' : ''}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']]) {
    const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition(from));
    const lod = required(definition.camera.levelOfDetail);
    const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 } });
    const errors:string[] = []; page.on('pageerror', error => errors.push(error.message));
    if (unlimitedDeparture) await page.route('**/site/prepared-world-navigation.mts*', async route => {
      const response = await route.fetch(), source = await response.text();
      const guarded = 'advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample)';
      assert.equal(source.split(guarded).length, 2, 'Mutation must bypass the actual per-paint curve-time guard');
      await route.fulfill({ response, body: source.replace(guarded, 'requestedElapsedS') });
    });
    await page.goto(`${origin}/${from}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id, from);
    await page.evaluate(({ from, to, radiusUnits }) => {
      const proof:DepartureProof = window.__departureProof = { start: performance.now(), frames: [],raf:0 };
      const stage = window.__cssearthTest.html('.planet-stage');
      function sample(time:number) {
        const id = window.__cssearthTest.htmlElement(stage).dataset.objectId, diagnostics = window.__cssEarth?.object(id);
        const camera = stage.querySelector('.polycss-camera'), scene = stage.querySelector('.polycss-scene');
        let source = null;
        if (id === from && camera && scene && diagnostics) {
          // Measure the actual CSS-transformed sphere. The prepared radius and
          // native perspective determine its painted ellipse; no flight sample
          // or timing helper is used as this browser test's oracle.
          const matrix = new DOMMatrix(window.__cssearthTest.htmlElement(scene).style.transform), cameraStyle = getComputedStyle(camera);
          const bounds = camera.getBoundingClientRect();
          const focal = Number.parseFloat(cameraStyle.perspective);
          const [originX, originY] = cameraStyle.perspectiveOrigin.split(' ').map(Number.parseFloat);
          const ox = originX - bounds.width / 2, oy = originY - bounds.height / 2;
          const radius = radiusUnits * Math.hypot(matrix.m11, matrix.m12, matrix.m13);
          const depth = focal - matrix.m43, x = matrix.m41 - ox, y = matrix.m42 - oy;
          const denominator = depth * depth - radius * radius;
          const diameter = denominator > 0 ? 2 * focal * radius / Math.sqrt(denominator) : null;
          const centre = denominator > 0 ? [bounds.x + bounds.width / 2 + ox + focal * x * depth / denominator,
            bounds.y + bounds.height / 2 + oy + focal * y * depth / denominator] : null;
          const radialRadius = denominator > 0 ? focal * radius * Math.sqrt(x * x + y * y + denominator) / denominator : null;
          const radialLength = Math.hypot(x, y), ux = radialLength ? x / radialLength : 1, uy = radialLength ? y / radialLength : 0;
          const halfWidth = radialRadius === null || diameter === null ? 0 : Math.hypot(radialRadius * ux, diameter / 2 * uy);
          const halfHeight = radialRadius === null || diameter === null ? 0 : Math.hypot(radialRadius * uy, diameter / 2 * ux);
          const intersectsViewport = centre !== null && centre[0] + halfWidth > 0 && centre[0] - halfWidth < innerWidth &&
            centre[1] + halfHeight > 0 && centre[1] - halfHeight < innerHeight;
          const publication = diagnostics.runtime.view();
          source = { diameter, centre, intersectsViewport, sceneHidden: window.__cssearthTest.htmlElement(scene).hidden,
            sceneOpacity: Number(getComputedStyle(scene).opacity),
            publishedDiameter: window.__cssearthTest.required(window.__cssearthTest.required(publication,"published view").body,"published body").silhouetteDiameter };
        }
        proof.frames.push({ time, id, source, stageOpacity: Number(getComputedStyle(window.__cssearthTest.required(stage, 'computed style element')).opacity),
          skies: stage.querySelectorAll('.planet-cubic-sky').length, scenes: stage.querySelectorAll('.polycss-scene').length,
          previousMarker: id === to ? diagnostics?.sky.state()?.planetarySystem?.bodies?.find(body => body.id === from) : null });
        proof.raf = requestAnimationFrame(sample);
      }
      proof.raf = requestAnimationFrame(sample);
    }, { from, to, radiusUnits: definition.camera.logicalBodyDiameter / (2 * definition.camera.sceneScale) });
    await selectObject(page, to);
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id, to, { timeout: 60000 });
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.__departureProof.raf); return window.__departureProof.frames; });
    const sourceFrames = frames.flatMap(frame => frame.source ? [{...frame,source:{...frame.source,diameter:required(frame.source.diameter),centre:required(frame.source.centre)}}] : []);
    assert.ok(sourceFrames.length);
    const full = lod.billboardFullDiscPixels, fade = lod.billboardFadeStartDiscPixels;
    // The user requests visible recession, an explicit improvement over the
    // reference's near-surface time jump. One paint must not skip the whole
    // object's authored20→14px transition band at any larger apparent size.
    // This is a screen-space bound; no minimum browser FPS is assumed.
    const logStepLimit = Math.log(fade / full);
    const steps = sourceFrames.slice(1).flatMap((frame, index) => {
      const previous = sourceFrames[index];
      if (!(previous.source.diameter > full) || !previous.source.intersectsViewport) return [];
      return [{ time: frame.time, elapsedMs: frame.time - previous.time,
        previousDiameter: previous.source.diameter, diameter: frame.source.diameter,
        logSizeStep: frame.source.diameter > 0 ? Math.abs(Math.log(frame.source.diameter / previous.source.diameter)) : Infinity,
        centreStepPixels: frame.source.centre ? Math.hypot(...frame.source.centre.map((value, axis) => value - previous.source.centre[axis])) : Infinity,
        previousCentre: previous.source.centre, centre: frame.source.centre }];
    });
    const initialDiameter = sourceFrames[0]?.source.diameter;
    const initialCentre = sourceFrames[0]?.source.centre;
    const intermediate = sourceFrames.filter(frame => frame.source.intersectsViewport &&
      (Math.abs(frame.source.diameter - initialDiameter) > .01 ||
        Math.hypot(...frame.source.centre.map((value, axis) => value - initialCentre[axis])) > .01));
    const recession = sourceFrames.filter(frame => frame.source.intersectsViewport && frame.source.diameter > full &&
      frame.source.diameter < initialDiameter * Math.exp(-logStepLimit));
    const violations = steps.filter(step => step.logSizeStep > logStepLimit + 1e-5 ||
      step.centreStepPixels > step.previousDiameter);
    const report = { from, to, initialDiameter, logStepLimit, visibleIntermediateFrames: intermediate.length,
      visibleRecessionFrames: recession.length,
      hiddenSourceFrames: sourceFrames.filter(frame => frame.source.diameter > fade && frame.source.intersectsViewport &&
        (frame.source.sceneHidden || frame.source.sceneOpacity <= 0)),
      maximumLogSizeStep: Math.max(...steps.map(step => step.logSizeStep)),
      maximumCentreStepInBodyDiameters: Math.max(...steps.map(step => step.centreStepPixels / step.previousDiameter)),
      violations, steps, frames, errors };
    reports.push(report);
    await writeFile(`${directory}/${from}-to-${to}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, frames: undefined, steps: undefined }));
    await page.close();
  }
  for (const report of reports) {
    assert.deepEqual(report.violations, [], `${report.from} → ${report.to}: a visible departing body must not jump in apparent scale or position`);
    assert.deepEqual(report.hiddenSourceFrames, [], 'The projected large source is actually painted by its native scene');
    assert.ok(report.visibleIntermediateFrames > 0, 'The default source paints visible intermediate motion before leaving the viewport');
    // Mercury recedes on the original spatial curve. The reverse Venus path
    // initially approaches its source before turning past it; preserving that
    // path requires smooth intermediate motion, not an invented zoom-out leg.
    if (report.from === 'mercury') assert.ok(report.visibleRecessionFrames > 0,
      'Mercury visibly recedes through its prepared apparent-size band');
    assert.ok(report.frames.every(frame => frame.stageOpacity === 1 && frame.skies >= 1 && frame.scenes === 1),
      'Recession retains exactly one detailed scene and its painted sky');
    assert.deepEqual(report.errors, []);
  }
  console.log('DEPARTURE CONTINUITY PASS: Mercury visibly recedes; both spatial paths retain smooth painted source motion');
} finally { await browser.close(); }
