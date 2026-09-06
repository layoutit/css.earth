import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const directory = '.local/flight-marker-gap';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']]) {
    const definition = JSON.parse(await readFile(`src/planets/${to}/prepared/object.json`, 'utf8')).data;
    const proxyLimit = definition.camera.levelOfDetail.billboardFadeStartDiscPixels;
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
          detailDiameter: window[`__${to}`]?.sky.state().lod?.silhouetteDiameter ?? null,
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
    // Early detail handoff can precede the first in-frustum destination point.
    // If the source paints it, it remains visible and physically small until
    // its detailed owner takes over; the close approach uses native geometry.
    const approach = firstVisible < 0 ? [] : sourceFrames.slice(firstVisible);
    for (const frame of approach) {
      assert.equal(frame.marker.visible, true, `${from} → ${to}: ${frame.marker.classification}`);
      assert.equal(frame.node?.hidden, false);
      assert.ok(frame.node.opacity > 0);
      assert.ok(frame.node.bounds.width > 0 && frame.node.bounds.height > 0);
      assert.ok(frame.marker.physicalDiameterPx <= proxyLimit, 'A small atlas proxy must never substitute for large detailed geometry.');
    }
    assert.ok(frames.every(frame => frame.roots <= 1), 'A flight must keep at most one detailed scene.');
    const detailedApproach = frames.filter(frame => frame.detailDiameter > proxyLimit && frame.detailDiameter < 300);
    const approachMilliseconds = detailedApproach.length ? detailedApproach.at(-1).time - detailedApproach[0].time : 0;
    assert.ok(detailedApproach.length >= 3 && approachMilliseconds >= 100 &&
      detailedApproach.at(-1).detailDiameter / Math.min(...detailedApproach.map(frame => frame.detailDiameter)) > 2,
    'The detailed owner must paint a sustained growing approach before close arrival.');
    assert.ok(frames.at(-1).detailDiameter > 400, 'The detailed destination reaches the framed arrival.');
    assert.deepEqual(errors, []);
    reports.push({ from, to, firstVisible, visibleApproachFrames: approach.length,
      maximumProxyDiameter: Math.max(0, ...approach.map(frame => frame.marker.physicalDiameterPx)),
      detailedApproachFrames: detailedApproach.length, approachMilliseconds, frames });
    await page.screenshot({ path: `${directory}/${from}-to-${to}-arrival.png` });
    await page.close();
    console.log(`CELESTIAL APPROACH PASS ${from} → ${to}: ${approach.length} small proxy frames and ${detailedApproach.length} detailed approach frames.`);
  }
  console.log('CELESTIAL FLIGHT VISIBILITY PASS: both default flights keep their destination marker until detailed handoff.');
} finally {
  await writeFile(`${directory}/after-frames.json`, JSON.stringify(reports));
  await browser.close();
}
