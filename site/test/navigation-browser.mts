import type {PreparedWorldCameraFrame,WorldCameraPose} from '../../src/renderers/css/navigation/world-camera.ts';
interface NavigationProof {
 selectors:string[];nodes:(Element|null)[];timeOrigin:number;frames:Record<string,PreparedWorldCameraFrame>;
 samples:{id:string;scenes:number;transform:string|undefined}[];pushes:number;capture():WorldCameraPose;timer?:number;
}
declare global {interface Window {__navigationProof:NavigationProof;}}
import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { revealObjectLink, selectObject } from './navigate-object.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await createTestPage(browser, { viewport: { width: 1100, height: 800 } });
  const errors:string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/mercury/?campaign=navigation#vault`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  await page.evaluate(async () => {
    const { SCENE_OBJECTS } = await import('/site/objects.mts');
    const selectors = ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content', '.planet-input-surface', '.planet-stage'];
    const proof:NavigationProof = window.__navigationProof = {
      selectors, nodes: selectors.map(selector => document.querySelector(selector)), timeOrigin: performance.timeOrigin,
      frames: Object.fromEntries(SCENE_OBJECTS.flatMap(object => object.worldFrame ? [[object.id, object.worldFrame] as const] : [])),
      samples: [], pushes: 0,
      capture: () => window.__cssearthTest.object().camera.captureWorldCamera(window.__cssearthTest.required(proof.frames[window.__cssearthTest.scene().activeObjectId],"active world frame")),
    };
    const push = history.pushState.bind(history);
    history.pushState = (...args) => { proof.pushes++; return push(...args); };
    proof.timer = window.setInterval(() => proof.samples.push({ id: window.__cssearthTest.scene().activeObjectId,
      scenes: document.querySelectorAll('.polycss-scene').length,
      transform: window.__cssearthTest.html('.polycss-scene').style.transform }), 40);
    window.__cssearthTest.object('mercury').setView({ controlYaw: 32, controlPitch: 22 });
  });
  const capture = () => page.evaluate(() => window.__navigationProof.capture());
  const waitFor = (id:string) => page.waitForFunction(id => location.pathname === `/${id}/` && window.__cssEarth?.activeObjectId === id && window.__cssEarth?.ready === true, id, { timeout: 60000 });
  const select = async (id:string) => { await selectObject(page, id); await waitFor(id); };
  const mercury = await capture();
  await page.waitForFunction(() => new URL(location.href).searchParams.has('v'));
  const savedMercuryUrl = page.url();
  await select('venus');
  const venus = await capture();
  const mercuryLink = await revealObjectLink(page, 'mercury');
  await mercuryLink.evaluate((anchor, href) => { if(!(anchor instanceof HTMLAnchorElement))throw new Error("Expected navigation anchor"); anchor.href = href; }, savedMercuryUrl);
  await mercuryLink.click(); await waitFor('mercury');
  samePose(await capture(), mercury);
  assert.equal(await page.evaluate(() => window.__navigationProof.pushes), 2);
  await page.evaluate(() => history.back()); await waitFor('venus');
  samePose(await capture(), venus);
  await page.evaluate(() => history.back()); await waitFor('mercury');
  samePose(await capture(), mercury);
  const before = await capture();
  await (await revealObjectLink(page, 'venus')).click();
  await page.waitForFunction(before => {
    const p = window.__navigationProof;
    return p && window.__cssearthTest.scene().activeObjectId === 'mercury' &&
      Math.hypot(...p.capture().pose.positionM.map((value, index) => value - before.pose.positionM[index])) > 1e6;
  }, before);
  await page.locator('.planet-input-surface').focus();
  await page.keyboard.press('Escape');
  const interrupted = await capture();
  await page.waitForFunction(() => window.__cssearthTest.scene().lifecycle !== 'loading');
  await page.waitForTimeout(250);
  samePose(await capture(), interrupted);
  assert.ok(Math.hypot(...interrupted.pose.positionM.map((value, index) => value - before.pose.positionM[index])) > 1e6, 'Interruption preserves the painted flight position');
  const proof = await page.evaluate(() => {
    const p = window.__navigationProof; clearInterval(p.timer);
    return { sameDocument: p.timeOrigin === performance.timeOrigin,
      retained: p.selectors.map((selector, index) => p.nodes[index] === document.querySelector(selector)),
      maxScenes: Math.max(...p.samples.map(sample => sample.scenes)),
      transforms: Object.fromEntries(['mercury', 'venus'].map(id => [id, new Set(p.samples.filter(sample => sample.id === id).map(sample => sample.transform)).size])),
      pushes: p.pushes, pathname: location.pathname, campaign: new URL(location.href).searchParams.get('campaign'), hash: location.hash,
      objectId: window.__cssearthTest.scene().activeObjectId, ready: window.__cssearthTest.scene().ready,
    };
  });
  assert.ok(proof.sameDocument); assert.ok(proof.retained.every(Boolean)); assert.equal(proof.maxScenes, 1);
  assert.ok(proof.transforms.mercury > 2 && proof.transforms.venus > 2, 'Both native scene cameras paint the flight');
  assert.equal(proof.pushes, 2); assert.equal(proof.pathname, '/mercury/'); assert.equal(proof.objectId, 'mercury');
  assert.equal(proof.campaign, 'navigation'); assert.equal(proof.hash, '#vault'); assert.equal(proof.ready, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', proof, errors }));
} finally { await browser.close(); }

function samePose(actual:WorldCameraPose, expected:WorldCameraPose) {
  assert.equal(actual.referenceFrame, expected.referenceFrame);
  assert.equal(actual.epochJdTt, expected.epochJdTt);
  assert.ok(Math.max(...actual.pose.positionM.map((value, index) => Math.abs(value - expected.pose.positionM[index]))) < .05, 'World camera position survives URL restoration');
  // q and -q encode the same camera orientation.
  const sign = actual.pose.orientationXyzw.reduce((sum, value, index) => sum + value * expected.pose.orientationXyzw[index], 0) < 0 ? -1 : 1;
  assert.ok(Math.max(...actual.pose.orientationXyzw.map((value, index) => Math.abs(value - sign * expected.pose.orientationXyzw[index]))) < 1e-9, 'World camera orientation survives URL restoration');
}
