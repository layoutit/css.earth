// The drag oracle's command line. node labs/experiments/drag-oracle/run.mts <command>:
//   serve [port]                              the page, to drag by hand (default port 4455)
//   stress [--seed=1] [--count=2000] [--chain=1] [--nosync]   seeded random drags on both, headless, and how far apart they end
//   trace <seed> <index>                      one of those drags again, frame by frame
//   record                                    rewrites the Cesium values the unit tests check (pole-drag.cesium.json)
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const here = import.meta.dirname, root = resolve(here, '../../..');
const RECORDING = resolve(root, 'packages/engine/src/navigation/pole-drag.cesium.json');
// The gestures recorded for the unit tests: this seed's first twelve of thirty frames or fewer.
const RECORDED = { seed: 7, count: 12 };

/** The page's scripts, compiled from this checkout's sources so an edit to the engine or renderer shows without a build. */
async function scripts() {
  const source = (name: string) => resolve(root, `packages/${name}/src/index.ts`);
  const result = await build({ entryPoints: { page: resolve(here, 'page.mts'), 'virtual-clock': resolve(here, 'virtual-clock.mts') }, bundle: true, write: false, outdir: 'out',
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'warning',
    plugins: [{ name: 'checkout-sources', setup(resolver) {
      resolver.onResolve({ filter: /^@cssearth\/(engine|core|objects)$/ }, ({ path }) => ({ path: source(path.slice('@cssearth/'.length)) }));
      // site/runtime-policy.mts takes one function from the renderer's entry; the rest of the renderer is not bundled.
      resolver.onResolve({ filter: /^@cssearth\/renderer$/ }, () => ({ path: resolve(root, 'packages/renderer/src/navigation/shared-input-surface.ts') }));
    } }] });
  return new Map(result.outputFiles.map(file => [`/${file.path.split('/').at(-1)}`, file.text]));
}

async function serve(port: number) {
  const built = await scripts(), html = await readFile(resolve(here, 'index.html'), 'utf8');
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost'), script = built.get(url.pathname);
    if (script !== undefined) { response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(script); return; }
    if (url.pathname !== '/') { response.writeHead(404).end(); return; }
    // ?virtual installs the hand-stepped clock before CesiumJS loads.
    const page = html.replace('<!--virtual-clock-->', url.searchParams.has('virtual') ? '<script src="/virtual-clock.js"></script>' : '');
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end(page);
  });
  await new Promise<void>(done => server.listen(port, '127.0.0.1', done));
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

/** The page under the virtual clock in a headless browser. Nothing is drawn, so software WebGL is enough. */
async function headless<T>(use: (page: Page) => Promise<T>): Promise<T> {
  const { server, origin } = await serve(0);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
    page.on('pageerror', error => { console.error('page error:', error.message); });
    await page.goto(`${origin}/?virtual`);
    await page.waitForFunction('window.dragOracle?.stress != null', null, { timeout: 60000 });
    return await use(page);
  } finally { await browser.close(); server.close(); }
}

const flag = (name: string, fallback: number) => Number(process.argv.find(argument => argument.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const quantile = (values: number[], share: number) => values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.floor(share * values.length))] ?? NaN;
interface Row { index: number; link: number; poleDeg: number; peakDeg: number; releaseDeg: number; endDeg: number; cesiumCoastDeg: number; oursCoastDeg: number; cesiumSelfDeg: number | null;
  distance: number; view: { towardEyeDeg: number; rollDeg: number }; samplesPerFrame: number; holdFrames: number; pressFrames: number; }

async function stress() {
  const seed = flag('seed', 1), count = flag('count', 2000), chain = flag('chain', 1), together = !process.argv.includes('--nosync'), batch = 250;
  const rows = await headless(async page => {
    await page.evaluate(`document.getElementById('together').checked = ${together}; document.getElementById('together').dispatchEvent(new Event('change'))`);
    const all: Row[] = [];
    for (let first = 0; first < count; first += batch) {
      all.push(...await page.evaluate(`window.dragOracle.stress.run(${JSON.stringify({ seed, first, count: Math.min(batch, count - first), chain })})`) as Row[]);
    }
    return all;
  });
  const line = (name: string, values: number[]) => console.log(name.padEnd(24), 'median', quantile(values, .5).toFixed(3).padStart(8), 'p99', quantile(values, .99).toFixed(3).padStart(8),
    'max', Math.max(...values).toFixed(3).padStart(8), '| over 0.1 deg', String(values.filter(value => value > .1).length).padStart(5), 'of', values.length);
  console.log(`seed ${seed}: ${rows.length} drags, chain ${chain}, ${together ? 'each drag starts together' : 'no re-sync'}; ${rows.filter(row => row.cesiumCoastDeg > 0).length} coast, ${rows.filter(row => row.poleDeg <= .82).length} bring the eye within 0.82 deg of a pole`);
  line('peak while dragging', rows.map(row => row.peakDeg)); line('at release', rows.map(row => row.releaseDeg)); line('after the coast', rows.map(row => row.endDeg));
  const differ = rows.filter(row => Math.max(row.peakDeg, row.endDeg) > .1);
  // A drag where Cesium itself ends elsewhere after a thousandth-of-a-pixel nudge amplifies rounding; the rest are differences of rule.
  const amplified = differ.filter(row => row.cesiumSelfDeg !== null && row.cesiumSelfDeg > .1 * Math.max(row.peakDeg, row.endDeg)), rule = differ.filter(row => !amplified.includes(row));
  console.log(`over 0.1 deg: ${differ.length}; ${amplified.length} where Cesium itself moves under a 0.001 px nudge, ${rule.length} differences of rule`);
  for (const row of [...rule, ...amplified].slice(0, 12)) {
    console.log(`${rule.includes(row) ? 'RULE ' : 'noise'} #${row.index}.${row.link} peak ${row.peakDeg.toFixed(2)} release ${row.releaseDeg.toFixed(2)} end ${row.endDeg.toFixed(2)} cesium against itself ${row.cesiumSelfDeg?.toFixed(2) ?? '-'} coast ${row.cesiumCoastDeg.toFixed(1)}/${row.oursCoastDeg.toFixed(1)} | distance ${row.distance.toFixed(2)} lat ${row.view.towardEyeDeg.toFixed(0)} roll ${row.view.rollDeg.toFixed(0)} samples ${row.samplesPerFrame} hold ${row.holdFrames} frames ${row.pressFrames}`);
  }
  if (rule.length) process.exitCode = 1;
}

async function trace(seed: number, index: number) {
  const out = await headless(page => page.evaluate(`window.dragOracle.stress.trace(${seed}, ${index})`)) as { gesture: unknown; result: unknown;
    notes: { phase: string; x: number | null; y: number | null; apartDeg: number; cesium: { lonDeg: number; latDeg: number }; ours: { lonDeg: number; latDeg: number }; cesiumRotating: boolean }[] };
  console.log(JSON.stringify(out.gesture)); console.log(JSON.stringify(out.result));
  for (const note of out.notes) {
    console.log(note.phase.padEnd(6), 'at', note.x === null ? ''.padStart(13) : `${note.x.toFixed(1)},${note.y?.toFixed(1)}`.padStart(13), 'apart', note.apartDeg.toFixed(3).padStart(8),
      '| cesium', note.cesium.latDeg.toFixed(3).padStart(8), note.cesium.lonDeg.toFixed(2).padStart(8), note.cesiumRotating ? 'turn' : 'pan ', '| ours', note.ours.latDeg.toFixed(3).padStart(8), note.ours.lonDeg.toFixed(2).padStart(8));
  }
}

async function record() {
  const recording = await headless(page => page.evaluate(`window.dragOracle.stress.record(${RECORDED.seed}, ${RECORDED.count})`)) as { gestures: { frames: { movement: unknown; rotating: boolean }[] }[] };
  const frames = recording.gestures.flatMap(gesture => gesture.frames);
  await writeFile(RECORDING, `${JSON.stringify({ generator: 'labs/experiments/drag-oracle/run.mts record', oracle: 'CesiumJS 1.145.0 ScreenSpaceCameraController', seed: RECORDED.seed, ...recording })}\n`);
  console.log(`${RECORDING}: ${recording.gestures.length} gestures, ${frames.length} frames, ${frames.filter(frame => frame.movement && !frame.rotating).length} panned, ${frames.filter(frame => frame.movement && frame.rotating).length} turned off the globe`);
}

const [command = 'serve', ...rest] = process.argv.slice(2);
if (command === 'serve') { const { origin } = await serve(Number(rest[0] ?? 4455)); console.log(`drag oracle on ${origin}/`); }
else if (command === 'stress') await stress();
else if (command === 'trace') await trace(Number(rest[0]), Number(rest[1]));
else if (command === 'record') await record();
else throw new Error(`Unknown command ${command}: serve, stress, trace or record.`);
