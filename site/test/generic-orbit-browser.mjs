import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mjs';
import { loadPlanetBrowserProfile } from './load-browser-profile.mjs';
import { auditGenericOrbitOwnership } from '../../tools/generic-orbit-contract.mjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4210';
const mutation = process.argv.includes('--reject-unknown');
const fixtureOnly = mutation || process.argv.includes('--fixture-only');
const output = resolve(process.env.CSSEARTH_CONTRACT_OUTPUT ?? `output/playwright/generic-orbit-${Date.now()}`);
await mkdir(output, { recursive: true });
const ownership = await auditGenericOrbitOwnership();
const sourceFiles = [...new Set([...ownership.sharedClosure, ...ownership.entries.map(({owner}) => owner)])];
const source = Object.fromEntries(await Promise.all(sourceFiles.map(async path =>
  [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const report = { baseUrl, mutation, source, ownership, registered: [], unregistered: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
report.browser = browser.version();
try {
  for (const dpr of [1, 2]) {
    if (!fixtureOnly) for (const object of OBJECTS) {
      const context = await instrumentedContext(dpr);
      try {
        const page = await context.newPage();
        await page.goto(new URL(object.route, baseUrl).href, { waitUntil: 'networkidle' });
        const profile = await loadPlanetBrowserProfile(object);
        await profile.waitForRuntime(page);
        await page.waitForFunction(() => window.__cssEarth?.ready);
        const proof = await page.evaluate(() => ({
          calls: globalThis.__orbitConstruction.map(({ objectId, cameraElement, sceneElement }) => ({
            objectId, cameraIsMounted: cameraElement === document.querySelector('.polycss-camera'),
            sceneIsMounted: sceneElement === document.querySelector('.polycss-scene'),
          })),
          cameras: document.querySelectorAll('.polycss-camera').length,
        }));
        assert.deepEqual(proof, { calls: [{ objectId: object.id, cameraIsMounted: true, sceneIsMounted: true }], cameras: 1 });
        report.registered.push({ id: object.id, dpr, ...proof });
        console.log(`${object.id}/dpr-${dpr}: one actual shared controller, one retained camera`);
      } finally { await context.close(); }
    }
    const context = await instrumentedContext(dpr);
    try {
      const page = await context.newPage();
      await page.goto(new URL('/saturn/', baseUrl).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__cssEarth?.ready);
      await page.evaluate(async () => {
        const { createRetainedCubicSkyOrbit, mountRetainedCubicSky } = await import('/src/platform/cubic-sky-runtime.mjs');
        const { PREPARED_SATURN_STARFIELD } = await import('/src/planets/saturn/runtime/preparedStarfield.mjs');
        const { objectAdapter } = await import('/site/object-adapter.mjs');
        const { requireSceneLifecycle } = await import('/site/scene-contract.mjs');
        const { OBJECTS } = await import('/site/objects.mjs');
        const id = 'unregistered-contract-probe';
        if (OBJECTS.some(object => object.id === id)) throw new Error('Probe must remain outside the application registry');
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
        const stage = document.createElement('div');
        stage.className = 'planet-stage';
        stage.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;overflow:hidden;--planet-viewport-zoom-divisor:1;--unregistered-contract-probe-shell-scale:1';
        document.body.replaceChildren(stage);
        globalThis.__orbitConstruction = [];
        const cameraPlan = {
          cameraModel: 'accumulated-matrix3d', pitchBounded: false, yawBounded: false,
          minimumControlPitchDegrees: 0, maximumControlPitchDegrees: 89,
          defaultControlPitchDegrees: 34, defaultControlYawDegrees: 0,
          initialScenePitchDegrees: 40, maximumScenePitchDegrees: 65,
          minimumZoom: 0.5, maximumZoom: 4, defaultZoom: 2, sceneScale: 0.04,
          logicalBodyDiameter: 400,
          responsiveFit: { model: 'continuous-aspect-smoothstep', portraitBaseWidthShare: 0.34,
            narrowPortraitWidthShareGain: 0.08, landscapeWidthShareGain: 0.02,
            narrowPortraitAspectRatio: 0.46, portraitAspectRatio: 0.75, squareAspectRatio: 1,
            maximumHeightShare: 0.61, maximumMobilePreviewShare: 0.925, minimumZoom: 0.5, maximumZoom: 2 },
        };
        const record = { id, loadScene: async () => (host) => {
          // Static, authored retained leaves: a diagnostic fixture, not a new
          // planet, fallback scene, or runtime geometry generator.
          const template = document.createElement('template');
          template.innerHTML = '<div class="polycss-camera" style="position:absolute;inset:0;perspective:1000000px;transform-style:preserve-3d"><div class="polycss-scene" style="position:absolute;left:50%;top:50%;transform-style:preserve-3d"><s style="position:absolute;width:10000px;height:10000px;transform:translate3d(-5000px,-5000px,0);background:#58a9c1"></s><s style="position:absolute;width:2800px;height:6500px;transform:translate3d(-2500px,-3250px,100);background:#e4ad62"></s></div></div>';
          const cameraElement = template.content.firstElementChild;
          const sceneElement = cameraElement.firstElementChild;
          host.appendChild(cameraElement);
          const sky = mountRetainedCubicSky({ host, plan: PREPARED_SATURN_STARFIELD, imageDensity: 2, objectId: id, requireSun: false });
          const camera = createRetainedCubicSkyOrbit({ stage: host, inputSurface: host, cameraElement, sceneElement,
            cameraPlan, cubicSky: sky, skyPlan: PREPARED_SATURN_STARFIELD, objectId: id, requireSun: false,
            onError(error) { throw error; } });
          return { ready: Promise.resolve(), camera, pause() {}, resume() {}, destroy() { camera.destroy(); sky.destroy(); cameraElement.remove(); } };
        } };
        const mount = await objectAdapter.load(id, [record]);
        const runtime = mount(stage);
        requireSceneLifecycle(runtime, id);
        await runtime.ready;
        globalThis.__genericProbe = { runtime, stage,
          cameraElement: stage.querySelector('.polycss-camera'), sceneElement: stage.querySelector('.polycss-scene') };
      });
      const initial = await probeState(page);
      assert.equal(initial.calls.length, 1);
      assert.equal(initial.calls[0], 'unregistered-contract-probe');
      await page.mouse.move(720, 450);
      await page.mouse.down(); await page.mouse.move(805, 495, { steps: 10 }); await page.mouse.up();
      await page.mouse.down(); await page.mouse.up();
      const dragged = await probeState(page);
      assert.notEqual(dragged.transform, initial.transform, 'Unknown object receives real pointer rotation');
      await page.mouse.wheel(0, -160);
      await page.waitForTimeout(160);
      const wheeled = await probeState(page);
      assert.ok(wheeled.state.zoom > dragged.state.zoom, 'Unknown object receives wheel zoom');
      await page.evaluate(() => __genericProbe.runtime.camera.setState({ zoom: 99 }));
      assert.equal((await probeState(page)).state.zoom, 4);
      await page.evaluate(() => __genericProbe.runtime.camera.setState({ zoom: -99 }));
      assert.equal((await probeState(page)).state.zoom, 0.5);
      await page.evaluate(() => __genericProbe.runtime.camera.setState({ zoom: 2 }));
      await page.setViewportSize({ width: 390, height: 900 });
      const mobile = await probeState(page);
      await page.mouse.move(195, 450); await page.mouse.wheel(0, -160); await page.waitForTimeout(160);
      const afterMobileWheel = await probeState(page);
      assert.equal(afterMobileWheel.state.zoom, mobile.state.zoom, 'Unknown object inherits mobile page scrolling');
      await page.setViewportSize({ width: 1440, height: 900 });
      const restored = await probeState(page);
      assert.equal(restored.retained, true);
      assert.equal(restored.perspective, initial.perspective);
      await page.screenshot({ path: resolve(output, `unregistered-dpr${dpr}.png`) });
      const retired = await page.evaluate(() => {
        const { runtime, sceneElement, cameraElement } = __genericProbe;
        runtime.destroy();
        const transform = sceneElement.style.transform;
        runtime.camera.invalidate(); runtime.camera.setState({ zoom: 3 });
        return { cameras: document.querySelectorAll('.polycss-camera').length,
          detached: !cameraElement.isConnected, inert: sceneElement.style.transform === transform };
      });
      assert.deepEqual(retired, { cameras: 0, detached: true, inert: true });
      report.unregistered.push({ dpr, initial, dragged, wheeled, mobile, restored, retired });
      console.log(`unregistered/dpr-${dpr}: generic adapter, shared controller, drag, wheel, limits, responsive policy and teardown passed`);
    } finally { await context.close(); }
  }
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await browser.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
async function instrumentedContext(dpr) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
  await context.addInitScript(() => { globalThis.__orbitConstruction = []; });
  await context.route('**/src/platform/cubic-sky-runtime.mjs*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const boundary = '  const hasDirectionalSun = directionalSun !== null ||';
    assert.equal(body.split(boundary).length, 2, 'Instrument the actual shared constructor exactly once');
    const guard = mutation ? `if (!${JSON.stringify(OBJECTS.map(({id}) => id))}.includes(objectId)) throw new Error('mutation: hardcoded object registry');\n` : '';
    body = body.replace(boundary, `globalThis.__orbitConstruction.push({ objectId, cameraElement, sceneElement });\n${guard}${boundary}`);
    await route.fulfill({ response, body });
  });
  return context;
}
async function probeState(page) {
  return page.evaluate(() => {
    const { runtime, cameraElement, sceneElement } = __genericProbe;
    return { state: runtime.camera.state(), transform: sceneElement.style.transform,
      perspective: getComputedStyle(cameraElement).perspective,
      retained: cameraElement === document.querySelector('.polycss-camera') && sceneElement === document.querySelector('.polycss-scene'),
      calls: __orbitConstruction.map(({objectId}) => objectId) };
  });
}
