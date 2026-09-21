import type {ObjectRuntimeDiagnostics} from '../env.d.ts';
import type {PreparedWorldCameraFrame} from '../../src/renderers/css/dist/navigation.js';
type CameraState=ReturnType<ObjectRuntimeDiagnostics['camera']['state']>;
declare global {interface Window {__overviewDocument:boolean;__overviewMountedCounts:number[];__overviewSampling:boolean;__retainedSun:ObjectRuntimeDiagnostics|undefined;}}

import {required} from '../../tools/test-values.mts';
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { SCENE_OBJECTS } from '../objects.mts';
import context from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import { OVERVIEW_SELECTION_POLICY } from '../runtime-policy.mts';
import { parseSharedView, savedWorldCamera } from '../../src/renderers/css/dist/navigation.js';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/overview-selection';
await mkdir(output, { recursive: true });
const sun = required(required(SCENE_OBJECTS.find(object => object.id === 'sun')).worldFrame);
const ceres = required(required(SCENE_OBJECTS.find(object => object.id === 'ceres')).worldFrame);
const exitKm = OVERVIEW_SELECTION_POLICY.exitSunDistanceM / 1000;
function worldFromState(state:CameraState, frame:PreparedWorldCameraFrame) {
  return savedWorldCamera({ camera: { distanceKilometers: required(state.distanceKilometers),
    ...(state.bodyCenterKilometers ? { bodyCenterKilometers: state.bodyCenterKilometers } : {}),
    pose: { schema: 'cssearth-camera-pose@2', scene: state.pose.scene } },
    preparedEpochJdTt: frame.epochJdTt, playback: { times: [0], speed: 1, motionRequested: false },
  }, frame, { focalPixels: required(state.focal), principalOffsetPixels: [required(state.principalOffset?.[0]),required(state.principalOffset?.[1])] });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors:string[] = [];
try {
  for (const dpr of [1, 2]) {
    const page = await createTestPage(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => (errors.push(error.message), console.error(error.message)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${origin}/ceres/`);
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__ceres?.ready);
    await page.evaluate(() => {
      window.__overviewDocument = true;
      window.__overviewMountedCounts = [];
      window.__overviewSampling = true;
      const sample = () => {
        if (!window.__overviewSampling) return;
        window.__overviewMountedCounts.push(window.__cssEarth?.mountedObjectCount ?? 0);
        requestAnimationFrame(sample);
      };
      sample();
    });
    // Ceres is about 2.7 AU from the Sun; these margins bracket the Sun-based threshold in any direction.
    await page.evaluate(distanceKilometers => window.__cssearthTest.object('ceres').camera.setState({ distanceKilometers }), exitKm * .95);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__cssearthTest.scene().selectedObjectId), 'ceres');
    const beforeHandoff = worldFromState(await page.evaluate(distanceKilometers =>
      window.__cssearthTest.object('ceres').camera.setState({ distanceKilometers }), exitKm * 1.05), ceres);
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().overview && window.__cssearthTest.scene().activeObjectId === 'sun', null, { timeout: 20000 });
    await page.locator('[data-system-results]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.planet-object-browser').isVisible(), false);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), '');
    assert.equal(await page.locator('.planet-object-link[aria-current]').count(), 0);
    assert.equal(await page.locator('.planet-information-panel').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__overviewDocument), true, 'No document navigation');
    assert.ok(await page.evaluate(() => Math.max(...window.__overviewMountedCounts) <= 1), 'Only one detailed object mounts');
    const afterHandoff = worldFromState(await page.evaluate(() => window.__cssearthTest.object('sun').camera.state()), sun);
    const handoffError = Math.hypot(...beforeHandoff.pose.positionM.map((value, axis) => value - afterHandoff.pose.positionM[axis]));
    assert.ok(handoffError < Math.hypot(...beforeHandoff.pose.positionM) * 1e-10, `Handoff preserves the world eye: ${handoffError}m`);
    // q and -q are the same physical orientation after changing local frames.
    const orientationSign = beforeHandoff.pose.orientationXyzw.reduce((sum, value, axis) =>
      sum + value * afterHandoff.pose.orientationXyzw[axis], 0) < 0 ? -1 : 1;
    beforeHandoff.pose.orientationXyzw.forEach((value, axis) =>
      assert.ok(Math.abs(value - orientationSign * afterHandoff.pose.orientationXyzw[axis]) < 1e-10,
        `Handoff preserves camera orientation: ${JSON.stringify([beforeHandoff.pose.orientationXyzw, afterHandoff.pose.orientationXyzw])}`));
    const screenOffset = () => page.evaluate(() => {
      const state = window.__cssearthTest.physicalCamera('sun'), [x, y, z] = window.__cssearthTest.required(state.bodyCenterKilometers,'body center');
      return Math.hypot(state.principalOffset[0] + state.focal * x / -z,
        state.principalOffset[1] + state.focal * y / -z);
    });
    const initialOffset = await screenOffset();
    await page.mouse.move(810, 400);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(1000);
    const centered = await screenOffset();
    assert.ok(centered < initialOffset, 'The Sun moves toward the centre only during subsequent zoom-out');
    const stopped = await page.evaluate(() => window.__cssearthTest.object('sun').camera.state());
    await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => window.__cssearthTest.object('sun').camera.state()), stopped, 'There is no recentering drift after scrolling stops');
    await page.screenshot({ path: `${output}/overview-dpr-${dpr}.png` });
    const overviewUrl = page.url();
    assert.equal(required(parseSharedView(`v=${new URL(overviewUrl).searchParams.get('v')}`)).preparedEpochJdTt, sun.epochJdTt,
      'Overview links carry the same prepared date as the shared world camera');
    await page.reload();
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().overview);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), '');
    await page.locator('.planet-sidebar-search').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.planet-information-panel').isVisible(), false, 'Escape cannot reveal a deselected card');

    // The final threshold crossing uses native wheel input. Preparing a nearby
    // range keeps this trace independent of the initial astronomical distance.
    await page.evaluate(() => {
      const state = window.__cssearthTest.physicalCamera('sun'), [ox, oy] = state.principalOffset;
      const norm = Math.hypot(ox, oy, state.focal), distance = 38000000;
      window.__cssearthTest.object('sun').camera.setState({ distanceKilometers: distance,
        bodyCenterKilometers: [-ox / norm * distance, -oy / norm * distance, -state.focal / norm * distance] });
    });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__cssearthTest.scene().overview), true);
    await page.evaluate(() => { window.__retainedSun = window.__sun; });
    await page.mouse.move(810, 400);
    await page.mouse.wheel(0, -240);
    await page.waitForFunction(() => window.__cssearthTest.scene().selectedObjectId === 'sun' && !window.__cssearthTest.scene().overview);
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), '');
    assert.equal(await page.locator('.planet-information-panel').isVisible(), true);
    assert.equal(await page.evaluate(() => window.__retainedSun === window.__sun), true, 'Showing the Sun card retains its scene');
    await page.screenshot({ path: `${output}/sun-card-dpr-${dpr}.png` });
    await page.evaluate(() => window.__cssearthTest.object('sun').camera.setState({ distanceKilometers: 40000000 }));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__cssearthTest.scene().selectedObjectId), 'sun', 'Zoom reversal does not flicker back to overview');
    await page.evaluate(distanceKilometers => window.__cssearthTest.object('sun').camera.setState({ distanceKilometers }), exitKm * .98);
    await page.waitForTimeout(300);
    let flippedDuringScroll = false;
    for (let step = 0; step < 24; step++) {
      await page.mouse.wheel(0, 12);
      await page.waitForTimeout(35);
      if (await page.evaluate(() => window.__cssearthTest.scene().overview)) flippedDuringScroll = true;
    }
    assert.ok(flippedDuringScroll, 'The Sun flips while outward scrolling is still ongoing');
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().overview);
    assert.equal(await page.evaluate(() => window.__retainedSun === window.__sun), true, 'Returning to overview retains the Sun scene');

    await page.goto(overviewUrl);
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().overview);
    await page.getByRole('button', { name: 'Browse celestial objects' }).click();
    await page.locator('[data-object-type-group="dwarf-planet"] > summary').click();
    await page.locator('.planet-object-link[data-object-id="ceres"]').click();
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().selectedObjectId === 'ceres', null, { timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.has('overview'), false, 'Explicit body selection clears overview');
    await page.goBack();
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssearthTest.scene().overview, null, { timeout: 30000 }).catch(async error => {
      console.log('BACK FAILED', await page.evaluate(() => ({ url: location.href, state: window.__cssEarth,
        camera: window.__sun?.camera.state(), search: window.__cssearthTest.input('.planet-sidebar-search').value })));
      throw error;
    });
    assert.equal(await page.locator('.planet-sidebar-search').inputValue(), '', 'Back restores the overview without turning selection into a query');
    await page.evaluate(distanceKilometers => window.__cssearthTest.object('sun').camera.setState({ distanceKilometers }), context.camera.maximumDistanceM / 1000);
    await page.waitForFunction(() => window.__cssearthTest.input('.planet-sidebar-search').value === 'Milky Way');
    const galaxy = page.locator('[data-galactic-overview]');
    assert.deepEqual(await galaxy.locator('.planet-breadcrumbs li').allTextContents().then(labels =>
      labels.map(label => label.replace('»', '').trim())), ['Nearby Universe', 'Local Group', 'Milky Way']);
    assert.equal(await galaxy.getByRole('region', { name: 'Planetary systems', exact: true }).isVisible(), true);
    assert.equal(await galaxy.locator('.planet-factsheet-section').isVisible(), false);
    assert.equal(await page.locator('[data-system-results] .planet-factsheet-section').count(), 1);
    assert.equal(await page.locator('[data-system-results] [data-solar-system-facts]').isVisible(), false);
    assert.equal(await page.locator('[data-object-type-group="asteroid"]').count(), 0);
    const disabled = galaxy.locator('.planet-object-link[aria-disabled="true"]');
    assert.equal(await disabled.count(), 4);
    assert.equal(await disabled.locator('[href]').count(), 0);
    const markers = await disabled.locator('.planet-navigation-marker').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return { size: Number.parseFloat(style.getPropertyValue('--planet-size')), color: style.getPropertyValue('--planet-color') };
    }));
    assert.ok(markers[0].size < markers[2].size && markers[2].size < markers[3].size);
    assert.equal(new Set(markers.map(marker => marker.color)).size, 4);
    await galaxy.getByRole('radio', { name: 'Factsheet', exact: true }).check();
    assert.equal(await galaxy.locator('.planet-factsheet-section').isVisible(), true);
    assert.equal(await galaxy.getByRole('region', { name: 'Planetary systems', exact: true }).isVisible(), false);
    await galaxy.getByRole('radio', { name: 'Sources', exact: true }).check();
    assert.equal(await galaxy.getByRole('region', { name: 'Sources', exact: true }).isVisible(), true);
    await galaxy.getByRole('radio', { name: /^Systems/ }).check();
    await page.screenshot({ path: `${output}/milky-way-dpr-${dpr}.png` });
    results.push({ dpr, handoffError, initialOffset, centered, overviewUrl, passed: true });
    console.log(`OVERVIEW PASS DPR ${dpr}: preserved camera, zoom-only centering, continuous Sun wheel-out, saved overview, Sun-only wheel-in, hysteresis, selection and Back`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
