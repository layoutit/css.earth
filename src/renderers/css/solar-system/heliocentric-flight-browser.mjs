import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const directory = '.local/flight-marker-gap';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/${from}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id, from);
    await page.evaluate(({ from, to }) => {
      window.__markerFlightFrames = [];
      window.__markerFlightDone = false;
      const sample = time => {
        const current = window.__cssEarth?.activeObjectId;
        const diagnostics = window[`__${from}`];
        const marker = diagnostics?.sky.state().planetarySystem?.bodies.find(body => body.id === to);
        const node = document.querySelector(`.planet-heliocentric-system-marker[data-body="${to}"]`);
        window.__markerFlightFrames.push({ time, current, ready: window.__cssEarth?.ready,
          roots: document.querySelectorAll('.polycss-camera').length,
          marker: marker ? { ...marker } : null,
          node: node ? { hidden: node.hidden, opacity: Number(getComputedStyle(node).opacity),
            bounds: node.getBoundingClientRect().toJSON() } : null });
        if (!window.__markerFlightDone) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { from, to });
    await page.locator(`a.scale-stop[href="/${to}/"]`).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${directory}/${from}-to-${to}-approach.png` });
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id, to);
    const frames = await page.evaluate(() => { window.__markerFlightDone = true; return window.__markerFlightFrames; });
    const sourceFrames = frames.filter(frame => frame.current === from && frame.marker);
    const firstVisible = sourceFrames.findIndex(frame => frame.marker.visible);
    // The default departure can initially face away from the destination. Once
    // the real flight brings it into view, approach must keep painting it.
    assert.ok(firstVisible >= 0, `${from} → ${to}: destination never appeared before detail handoff.`);
    const approach = sourceFrames.slice(firstVisible);
    assert.ok(approach.length >= 20, `${from} → ${to}: approach must exercise sustained rendered coverage.`);
    for (const frame of approach) {
      assert.equal(frame.marker.visible, true, `${from} → ${to}: ${frame.marker.classification}`);
      assert.equal(frame.node?.hidden, false);
      assert.ok(frame.node.opacity > 0);
      assert.ok(frame.node.bounds.width > 0 && frame.node.bounds.height > 0);
    }
    assert.ok(frames.every(frame => frame.roots <= 1), 'A flight must keep at most one detailed scene.');
    assert.ok(approach.at(-1).marker.physicalDiameterPx > 400, 'The marker must survive all the way to the framed arrival.');
    assert.deepEqual(errors, []);
    reports.push({ from, to, firstVisible, visibleApproachFrames: approach.length,
      finalMarkerDiameter: approach.at(-1).marker.physicalDiameterPx, frames });
    await page.screenshot({ path: `${directory}/${from}-to-${to}-arrival.png` });
    await page.close();
    console.log(`CELESTIAL APPROACH PASS ${from} → ${to}: ${approach.length} consecutive painted frames through arrival.`);
  }
  console.log('CELESTIAL FLIGHT VISIBILITY PASS: both default flights keep their destination marker until detailed handoff.');
} finally {
  await writeFile(`${directory}/after-frames.json`, JSON.stringify(reports));
  await browser.close();
}
