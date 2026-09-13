import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

interface FlightMarker { id: string; visible: boolean; classification: string; physicalDiameterPx: number; }
interface FlightFrame { time: number; current: string | undefined; ready: boolean | undefined; detailDiameter: number | null; roots: number; marker: FlightMarker | null; node: { hidden: boolean; opacity: number; bounds: { width: number; height: number } } | null; }
interface FlightDiagnostics { sky: { state(): { planetarySystem?: { bodies: FlightMarker[] }; lod?: { silhouetteDiameter?: number } } }; }
interface FlightDefinition { camera: { levelOfDetail: { billboardFadeStartDiscPixels: number } }; }
declare global { interface Window { __markerFlightFrames?: FlightFrame[]; __markerFlightDone?: boolean; [key: string]: unknown; } }

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const directory = '.local/flight-marker-gap';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports: Record<string, unknown>[] = [];
try {
  for (const [from, to] of [['mercury', 'venus'], ['venus', 'mercury']] as const) {
    const definition = flightDefinition(JSON.parse(await readFile(`src/objects/${to}/prepared/object.json`, 'utf8')));
    const proxyLimit = definition.camera.levelOfDetail.billboardFadeStartDiscPixels;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/${from}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(id => { const app = window.__cssEarth as { ready: boolean; activeObjectId?: string } | undefined; return app?.ready && app.activeObjectId === id; }, from);
    await page.evaluate(({ from, to }) => {
      window.__markerFlightFrames = [];
      window.__markerFlightDone = false;
      const sample = (time: number) => {
        const app = window.__cssEarth as { ready: boolean; activeObjectId?: string } | undefined;
        const current = app?.activeObjectId;
        const candidate = window[`__${from}`];
        const diagnostics = candidate !== null && typeof candidate === 'object' && 'sky' in candidate &&
          typeof (candidate as { sky?: unknown }).sky === 'object' &&
          typeof ((candidate as { sky: { state?: unknown } }).sky.state) === 'function'
          ? candidate as FlightDiagnostics : null;
        const sky = diagnostics?.sky;
        const marker = sky?.state().planetarySystem?.bodies.find((body: FlightMarker) => body.id === to) ?? null;
        const node = document.querySelector(`.planet-heliocentric-system-marker[data-body="${to}"]`);
        window.__markerFlightFrames?.push({ time, current, ready: app?.ready,
          detailDiameter: (window[`__${to}`] as FlightDiagnostics | undefined)?.sky.state().lod?.silhouetteDiameter ?? null,
          roots: document.querySelectorAll('.polycss-camera').length,
          marker: marker ? { ...marker } : null,
          node: node instanceof HTMLElement ? { hidden: node.hidden, opacity: Number(getComputedStyle(node).opacity),
            bounds: node.getBoundingClientRect().toJSON() } : null });
        if (!window.__markerFlightDone) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { from, to });
    // The planetary scale bar was retired; navigate the way a person does.
    await page.locator('.planet-sidebar-search').fill(to);
    await page.locator(`.planet-object-link[data-object-id="${to}"]`).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${directory}/${from}-to-${to}-approach.png` });
    await page.waitForFunction(id => { const app = window.__cssEarth as { ready: boolean; activeObjectId?: string } | undefined; return app?.ready && app.activeObjectId === id; }, to);
    const frames = flightFrames(await page.evaluate(() => { window.__markerFlightDone = true; return window.__markerFlightFrames; }));
    const sourceFrames = frames.filter(frame => frame.current === from && frame.marker);
    const firstVisible = sourceFrames.findIndex(frame => frame.marker?.visible === true);
    // The default departure can initially face away from the destination. Once
    // the real flight brings it into view, approach must keep painting it.
    // Early detail handoff can precede the first in-frustum destination point.
    // If the source paints it, it remains visible and physically small until
    // its detailed owner takes over; the close approach uses native geometry.
    const approach = firstVisible < 0 ? [] : sourceFrames.slice(firstVisible);
    for (const frame of approach) {
      const marker = frame.marker; assert.ok(marker);
      assert.equal(marker.visible, true, `${from} → ${to}: ${marker.classification}`);
      assert.equal(frame.node?.hidden, false);
      assert.ok(frame.node.opacity > 0);
      assert.ok(frame.node.bounds.width > 0 && frame.node.bounds.height > 0);
      assert.ok(marker.physicalDiameterPx <= proxyLimit, 'A small atlas proxy must never substitute for large detailed geometry.');
    }
    assert.ok(frames.every(frame => frame.roots <= 1), 'A flight must keep at most one detailed scene.');
    const detailedApproach = frames.filter((frame): frame is FlightFrame & { detailDiameter: number } => frame.detailDiameter !== null && frame.detailDiameter > proxyLimit && frame.detailDiameter < 300);
    const finalApproach = detailedApproach.at(-1);
    const approachMilliseconds = finalApproach && detailedApproach[0] ? finalApproach.time - detailedApproach[0].time : 0;
    assert.ok(detailedApproach.length >= 3 && approachMilliseconds >= 100 &&
      (finalApproach?.detailDiameter ?? 0) / Math.min(...detailedApproach.map(frame => frame.detailDiameter)) > 2,
    'The detailed owner must paint a sustained growing approach before close arrival.');
    assert.ok((frames.at(-1)?.detailDiameter ?? 0) > 400, 'The detailed destination reaches the framed arrival.');
    assert.deepEqual(errors, []);
    reports.push({ from, to, firstVisible, visibleApproachFrames: approach.length,
      maximumProxyDiameter: Math.max(0, ...approach.map(frame => frame.marker?.physicalDiameterPx ?? 0)),
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

function flightDefinition(value: unknown): FlightDefinition {
  if (!value || typeof value !== 'object') throw new TypeError('Prepared flight definition is invalid.');
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== 'object') throw new TypeError('Prepared flight definition has no data.');
  const camera = (data as { camera?: unknown }).camera;
  const level = camera && typeof camera === 'object' ? (camera as { levelOfDetail?: unknown }).levelOfDetail : null;
  if (!level || typeof level !== 'object' || typeof (level as { billboardFadeStartDiscPixels?: unknown }).billboardFadeStartDiscPixels !== 'number') throw new TypeError('Prepared flight level-of-detail is invalid.');
  return data as FlightDefinition;
}

function flightFrames(value: unknown): FlightFrame[] {
  if (!Array.isArray(value) || !value.every(frame => frame !== null && typeof frame === 'object' &&
      typeof (frame as { time?: unknown }).time === 'number' &&
      typeof (frame as { roots?: unknown }).roots === 'number')) throw new TypeError('Flight frame capture is invalid.');
  return value as FlightFrame[];
}
