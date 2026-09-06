import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const lateWorldCamera = process.env.CSSEARTH_TEST_LATE_WORLD_CAMERA === '1';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
try {
  for (const delayedSelection of lateWorldCamera ? [true] : [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let releaseStartup, startupHeld = false;
    const startupGate = new Promise(resolve => { releaseStartup = resolve; });
    await page.route('**/objects/prepared/*.json*', async route => {
      if (!startupHeld) { startupHeld = true; await startupGate; }
      await route.continue();
    });
    if (delayedSelection) await page.route('**/src/renderers/css/dist/index.js*', async route => {
      const response = await route.fetch();
      let source = await response.text();
      const original = 'const initialized = await lifetime.wait(selection.start());';
      assert.equal(source.split(original).length, 2, 'Delay injection must bind to the actual native selection start');
      if (lateWorldCamera) {
        const blocks = source.match(/      if \(initialWorldCamera\) \{\n(?:        .*\n){2}      \}\n/g) ?? [];
        assert.equal(blocks.length, 1, 'Timing mutation must move the actual incoming world-camera application');
        assert.match(blocks[0], /\.applyWorldCamera\(initialWorldCamera, worldFrame\)/);
        assert.ok(source.indexOf(blocks[0]) < source.indexOf(original), 'The control must seed the camera before selection');
        source = source.replace(blocks[0], '').replace(original, `${original}\n${blocks[0]}`);
      }
      const changed = source.replace(original, `const initialized = await lifetime.wait((async () => {
        if (window.__visibilityProof) {
          window.__visibilityProof.delayedStarts++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        return selection.start();
      })());`);
      await route.fulfill({ response, body: changed });
    });
    await page.goto(`${origin}/mercury/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'loading');
    const initial = await page.locator('.planet-stage').evaluate(stage => Number(getComputedStyle(stage).opacity));
    assert.equal(initial, .001, 'Cold startup stays hidden until the first native scene is ready');
    releaseStartup();
    await page.waitForFunction(() => window.__cssEarth?.ready === true);
    await page.evaluate(async () => {
      const { OBJECTS } = await import('/site/objects.mjs');
      const { presentWorldCamera } = await import('/src/renderers/css/dist/navigation.js');
      const frames = Object.fromEntries(OBJECTS.filter(object => object.worldFrame).map(object => [object.id, object.worldFrame]));
      const stage = document.querySelector('.planet-stage');
      const proof = window.__visibilityProof = { frames: [], delayedStarts: 0, poseFrames: 0, poseTransitions: 0, poseGaps: [],
        maximumTranslationErrorPixels: 0, maximumProjectedErrorPixels: 0, maximumOrientationErrorDegrees: 0 };
      let previousScene = stage.querySelector('.polycss-scene'), previousId = stage.dataset.objectId;
      let previousDiagnostics = window[`__${previousId}`], arrivingWorld = null;
      function checkPose(scene, id, firstPaint) {
        if (firstPaint) {
          // The retained diagnostics reference keeps the source's final precise
          // pose after removal, even if its last write happened after our rAF.
          arrivingWorld = previousDiagnostics.camera.captureWorldCamera(frames[previousId]);
          proof.poseTransitions++;
        }
        // Once native selection publishes diagnostics, the incoming owner
        // continues the same flight. Its first paint and all preparation paints
        // must retain the handoff pose; later camera movement is intentional.
        if (!arrivingWorld || (!firstPaint && window[`__${id}`])) return;
        const camera = stage.querySelector('.polycss-camera'), sky = stage.querySelector('.planet-cubic-sky');
        const cameraBounds = camera.getBoundingClientRect(), skyBounds = sky.getBoundingClientRect();
        const origin = getComputedStyle(sky).perspectiveOrigin.split(' ').map(Number.parseFloat);
        const viewport = { focalPixels: Number.parseFloat(getComputedStyle(camera).perspective), principalOffsetPixels: [
          skyBounds.x + origin[0] - cameraBounds.x - cameraBounds.width / 2,
          skyBounds.y + origin[1] - cameraBounds.y - cameraBounds.height / 2,
        ] };
        const expected = presentWorldCamera(arrivingWorld, frames[id], viewport);
        const actualMatrix = new DOMMatrix(scene.style.transform);
        const scale = Math.hypot(actualMatrix.m11, actualMatrix.m12, actualMatrix.m13);
        const expectedMatrix = new DOMMatrix().translate(...expected.translateCssPixels)
          .scale(scale, scale, scale).multiply(new DOMMatrix(expected.sceneMatrix));
        const actual = [...actualMatrix.toFloat64Array()], target = [...expectedMatrix.toFloat64Array()];
        // Compare geometric errors; component-relative error exaggerates tiny
        // entries near zero. Native CSS serializes about six significant digits.
        const translationErrorPixels = Math.hypot(...[12, 13, 14].map(index => actual[index] - target[index]));
        const radius = frames[id].bodyRadiusM / frames[id].metersPerUnit;
        const project = (matrix, point) => {
          const p = new DOMPoint(...point).matrixTransform(matrix);
          return [p.x, p.y].map(value => value * viewport.focalPixels / (viewport.focalPixels - p.z));
        };
        const projectedErrorPixels = Math.max(...[[0, 0, 0], [radius, 0, 0], [-radius, 0, 0],
          [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius]].map(point => {
          const a = project(actualMatrix, point), b = project(expectedMatrix, point);
          return Math.hypot(a[0] - b[0], a[1] - b[1]);
        }));
        const orientationErrorDegrees = Math.max(...[0, 4, 8].map(offset => {
          const a = actual.slice(offset, offset + 3), b = target.slice(offset, offset + 3);
          const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
          return Math.atan2(Math.hypot(...cross), a.reduce((sum, value, index) => sum + value * b[index], 0)) * 180 / Math.PI;
        }));
        proof.maximumTranslationErrorPixels = Math.max(proof.maximumTranslationErrorPixels, translationErrorPixels);
        proof.maximumProjectedErrorPixels = Math.max(proof.maximumProjectedErrorPixels, projectedErrorPixels);
        proof.maximumOrientationErrorDegrees = Math.max(proof.maximumOrientationErrorDegrees, orientationErrorDegrees);
        proof.poseFrames++;
        // At the distant handoff, CSS serializes translations millions of units
        // deep. Judge their actual projected center/body-axis error, while the
        // independent angular bound still rejects a wrong initial orientation.
        if (projectedErrorPixels > .01 || orientationErrorDegrees > .0002) {
          proof.poseGaps.push({ id, firstPaint, translationErrorPixels, projectedErrorPixels, orientationErrorDegrees });
        }
      }
      function sample(time) {
        const scene = stage.querySelector('.polycss-scene'), id = stage.dataset.objectId;
        if (scene) {
          checkPose(scene, id, scene !== previousScene);
          previousScene = scene; previousId = id;
          previousDiagnostics = window[`__${id}`] ?? previousDiagnostics;
        }
        proof.frames.push({ time, id: stage.dataset.objectId, ready: document.documentElement.dataset.ready,
          opacity: Number(getComputedStyle(stage).opacity), scenes: stage.querySelectorAll('.polycss-scene').length,
          skies: stage.querySelectorAll('.planet-cubic-sky').length, vaults: stage.querySelectorAll('.planet-heliocentric-sky').length });
        proof.raf = requestAnimationFrame(sample);
      }
      proof.raf = requestAnimationFrame(sample);
    });
    for (const id of ['venus', 'mercury']) {
      await page.locator(`a.scale-stop[href="/${id}/"]`).click();
      await page.waitForFunction(id => location.pathname === `/${id}/` && window.__cssEarth?.ready === true, id, { timeout: 60000 }).catch(async error => {
        console.error(JSON.stringify({ delayedSelection, errors, diagnostics: await page.evaluate(() => ({
          url: location.href, state: window.__cssEarth, stage: document.querySelector('.planet-stage').dataset.objectId,
          tail: window.__visibilityProof.frames.slice(-3), poseGaps: window.__visibilityProof.poseGaps.slice(0, 3),
        })) }));
        throw error;
      });
    }
    const result = await page.evaluate(() => {
      const proof = window.__visibilityProof; cancelAnimationFrame(proof.raf);
      return { frames: proof.frames.length, delayedStarts: proof.delayedStarts,
        poseFrames: proof.poseFrames, poseTransitions: proof.poseTransitions,
        maximumTranslationErrorPixels: proof.maximumTranslationErrorPixels,
        maximumProjectedErrorPixels: proof.maximumProjectedErrorPixels,
        maximumOrientationErrorDegrees: proof.maximumOrientationErrorDegrees,
        poseGapCount: proof.poseGaps.length, poseGaps: proof.poseGaps.slice(0, 3),
        loadingFrames: proof.frames.filter(frame => frame.ready === 'loading').length,
        gaps: proof.frames.filter(frame => frame.opacity !== 1 || frame.skies < 1 || frame.vaults < 1),
        maximumDetailedScenes: Math.max(...proof.frames.map(frame => frame.scenes)) };
    });
    assert.deepEqual(result.gaps, [], 'Every painted handoff frame keeps the world sky and vault fully visible');
    assert.equal(result.poseGapCount, 0, `Incoming painted world camera differs from outgoing final pose: ${JSON.stringify(result.poseGaps)}`);
    assert.equal(result.poseTransitions, 2, 'Both incoming first-painted camera poses were checked');
    assert.ok(result.poseFrames >= (delayedSelection ? 20 : 2), 'Initial selection never paints the default camera pose');
    assert.equal(result.maximumDetailedScenes, 1, 'Detailed object scenes never coexist');
    assert.ok(result.loadingFrames >= (delayedSelection ? 20 : 1), 'The test observes actual incoming readiness waits');
    assert.equal(result.delayedStarts, delayedSelection ? 2 : 0);
    assert.deepEqual(errors, []);
    results.push({ delayedSelection, initialOpacity: initial, ...result });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'passed', results }));
} finally { await browser.close(); }
