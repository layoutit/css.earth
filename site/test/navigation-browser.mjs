import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/mercury/?campaign=navigation#vault`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  await page.evaluate(async () => {
    const { OBJECTS } = await import('/site/objects.mjs');
    const selectors = ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content', '.planet-input-surface', '.planet-stage'];
    const proof = window.__navigationProof = {
      selectors, nodes: selectors.map(selector => document.querySelector(selector)), timeOrigin: performance.timeOrigin,
      frames: Object.fromEntries(OBJECTS.filter(object => object.worldFrame).map(object => [object.id, object.worldFrame])),
      samples: [], pushes: 0,
    };
    const push = history.pushState.bind(history);
    history.pushState = (...args) => { proof.pushes++; return push(...args); };
    proof.capture = () => window[`__${window.__cssEarth.activeObjectId}`].camera.captureWorldCamera(proof.frames[window.__cssEarth.activeObjectId]);
    proof.timer = setInterval(() => proof.samples.push({ id: window.__cssEarth.activeObjectId,
      scenes: document.querySelectorAll('.polycss-scene').length,
      transform: document.querySelector('.polycss-scene')?.style.transform }), 40);
    window.__mercury.setView({ controlYaw: 32, controlPitch: 22 });
  });
  const capture = () => page.evaluate(() => window.__navigationProof.capture());
  const waitFor = id => page.waitForFunction(id => location.pathname === `/${id}/` && window.__cssEarth?.activeObjectId === id && window.__cssEarth?.ready === true, id, { timeout: 60000 });
  const select = async id => { await page.locator(`a.scale-stop[href="/${id}/"]`).click(); await waitFor(id); };
  const mercury = await capture();
  await page.waitForFunction(() => new URL(location.href).searchParams.has('v'));
  const savedMercuryUrl = page.url();
  await select('venus');
  const venus = await capture();
  await page.locator('a.scale-stop[href="/mercury/"]').evaluate((anchor, href) => { anchor.href = href; }, savedMercuryUrl);
  await page.locator(`a.scale-stop[href="${savedMercuryUrl}"]`).click(); await waitFor('mercury');
  samePose(await capture(), mercury);
  const returnTrip = await page.evaluate(() => ({ pushes: window.__navigationProof.pushes,
    styles: [...document.head.querySelectorAll('style[data-vite-dev-id]')]
      .filter(style => /\/src\/planets\/[^/]+\/runtime\/styles.css$/.test(style.dataset.viteDevId)).map(style => style.dataset.viteDevId.split('/').at(-3)) }));
  assert.equal(returnTrip.pushes, 2);
  assert.deepEqual(returnTrip.styles, ['mercury']);
  await page.evaluate(() => history.back()); await waitFor('venus');
  samePose(await capture(), venus);
  await page.evaluate(() => history.back()); await waitFor('mercury');
  samePose(await capture(), mercury);
  const before = await capture();
  await page.locator('a.scale-stop[href="/venus/"]').click();
  await page.waitForFunction(before => {
    const p = window.__navigationProof;
    return p && window.__cssEarth.activeObjectId === 'mercury' &&
      Math.hypot(...p.capture().pose.positionM.map((value, index) => value - before.pose.positionM[index])) > 1e6;
  }, before);
  await page.locator('.planet-input-surface').focus();
  await page.keyboard.press('Escape');
  const interrupted = await capture();
  await page.waitForFunction(() => window.__cssEarth.playback.reason !== 'loading');
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
      objectId: window.__cssEarth.activeObjectId, ready: window.__cssEarth.ready,
    };
  });
  assert.ok(proof.sameDocument); assert.ok(proof.retained.every(Boolean)); assert.equal(proof.maxScenes, 1);
  assert.ok(proof.transforms.mercury > 2 && proof.transforms.venus > 2, 'Both native scene cameras paint the flight');
  assert.equal(proof.pushes, 2); assert.equal(proof.pathname, '/mercury/'); assert.equal(proof.objectId, 'mercury');
  assert.equal(proof.campaign, 'navigation'); assert.equal(proof.hash, '#vault'); assert.equal(proof.ready, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', proof, errors }));
} finally { await browser.close(); }

function samePose(actual, expected) {
  assert.equal(actual.referenceFrame, expected.referenceFrame);
  assert.equal(actual.epochJdTt, expected.epochJdTt);
  assert.ok(Math.max(...actual.pose.positionM.map((value, index) => Math.abs(value - expected.pose.positionM[index]))) < .05, 'World camera position survives URL restoration');
  // q and -q encode the same camera orientation.
  const sign = actual.pose.orientationXyzw.reduce((sum, value, index) => sum + value * expected.pose.orientationXyzw[index], 0) < 0 ? -1 : 1;
  assert.ok(Math.max(...actual.pose.orientationXyzw.map((value, index) => Math.abs(value - sign * expected.pose.orientationXyzw[index]))) < 1e-9, 'World camera orientation survives URL restoration');
}
