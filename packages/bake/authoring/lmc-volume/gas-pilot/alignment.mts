/** Billboard against slabs at the same camera, by state and registration, from real camera places. Nothing is saved but numbers. */
import { writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import { cameraUrl, pilotCamera } from '../piece-pilot/cameras.mts';
import { add, mul, type V3 } from '../geometry.mts';
import { siteViewLinks } from '../delivery/site-views.mts';
import { L37_DIR } from './regions.mts';

const SIDE = 256, WIDTH_KPC = 26;
function far(name: string, tilt: number, az: number, distance: number) {
  const base = pilotCamera(name, 128, [0, 0, 0], WIDTH_KPC, tilt, az), eye = add([0, 0, 0] as V3, mul(base.back, distance)), focal = 128 * distance / WIDTH_KPC;
  return { ...base, distance, eye, focal, ray(x: number, y: number) { return base.ray(x, y); }, pixelOf: base.pixelOf, areaAt: base.areaAt };
}
async function luma(page: Page) {
  const { data } = await sharp(await page.screenshot()).removeAlpha().resize(SIDE, Math.round(SIDE * .75)).greyscale().blur(1.5).raw().toBuffer({ resolveWithObject: true });
  return Float64Array.from(data, v => v / 255);
}
const H = Math.round(SIDE * .75);
function sample(a: Float64Array, x: number, y: number) { const i = Math.floor(x), j = Math.floor(y); if (i < 0 || j < 0 || i >= SIDE - 1 || j >= H - 1) return 0; const u = x - i, v = y - j; return a[j * SIDE + i]! * (1 - u) * (1 - v) + a[j * SIDE + i + 1]! * u * (1 - v) + a[(j + 1) * SIDE + i]! * (1 - u) * v + a[(j + 1) * SIDE + i + 1]! * u * v; }
/** The similarity carrying the billboard onto the slabs: a coarse search, then a finer one, by normalized correlation over the galaxy's own pixels. */
function register(slab: Float64Array, board: Float64Array) {
  const cx = SIDE / 2, cy = H / 2, floor = .04; const idx: number[] = []; for (let p = 0; p < slab.length; p++) if (slab[p]! > floor) idx.push(p);
  const mean = idx.reduce((n, p) => n + slab[p]!, 0) / idx.length, sd = Math.sqrt(idx.reduce((n, p) => n + (slab[p]! - mean) ** 2, 0) / idx.length) || 1;
  const score = (dx: number, dy: number, s: number, deg: number) => { const c = Math.cos(deg * Math.PI / 180) / s, n = Math.sin(deg * Math.PI / 180) / s; const v = idx.map(p => { const x = p % SIDE - cx - dx, y = Math.floor(p / SIDE) - cy - dy; return sample(board, c * x + n * y + cx, -n * x + c * y + cy); }), m = v.reduce((a, b) => a + b, 0) / v.length, d = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return idx.reduce((sum, p, i) => sum + (slab[p]! - mean) * (v[i]! - m), 0) / (idx.length * sd * d); };
  let best = { dx: 0, dy: 0, s: 1, deg: 0, r: score(0, 0, 1, 0) }; const none = best.r;
  for (const deg of [-180, -135, -90, -45, -20, -10, -5, 0, 5, 10, 20, 45, 90, 135, 180]) for (const s of [.8, .9, 1, 1.1, 1.25]) for (const dx of [-20, -10, 0, 10, 20]) for (const dy of [-20, -10, 0, 10, 20]) { const r = score(dx, dy, s, deg); if (r > best.r) best = { dx, dy, s, deg, r }; }
  for (const step of [4, 2, 1, .5, .25]) { let moved = true; while (moved) { moved = false; for (const [a, b, c, d] of [[step, 0, 0, 0], [-step, 0, 0, 0], [0, step, 0, 0], [0, -step, 0, 0], [0, 0, step / 100, 0], [0, 0, -step / 100, 0], [0, 0, 0, step], [0, 0, 0, -step]] as const) { const r = score(best.dx + a, best.dy + b, best.s + c, best.deg + d); if (r > best.r + 1e-5) { best = { dx: best.dx + a, dy: best.dy + b, s: best.s + c, deg: best.deg + d, r }; moved = true; } } } }
  return { ...best, none };
}
async function cropLuma(page: Page) {
  const { data } = await sharp(await page.screenshot({ clip: { x: 312, y: 234, width: 400, height: 300 } })).removeAlpha().resize(SIDE, H).greyscale().blur(1.2).raw().toBuffer({ resolveWithObject: true });
  return Float64Array.from(data, v => v / 255);
}
const OLD_BACKING = 'matrix3d(0.001762,0.93158,-0.003758,0,-0.843556,0,-0.395312,0,0.424339,-0.004456,-0.905493,0,646.497608,-715.453024,306.486862,1)';
/** The real handoff on the site: the universe backing against the volume at radius ~96 px, old and new placing, from several sides. */
export async function backingReport(page: Page, origin: string, errors: string[]) {
  const { parseSharedView, formatSharedView } = await import('@cssearth/renderer/navigation'), rows: Record<string, unknown>[] = [];
  const earthQuery = new URL((await siteViewLinks(origin))[0]!.url).search.slice(1), earth = parseSharedView(earthQuery)!;
  const earthAtOne = origin + '/lmc/?' + formatSharedView({ ...earth, camera: { ...earth.camera!, projectionScale: 1 } } as never);
  const near = (name: string, tilt: number, az: number) => { const c = far(name, tilt, az, 46.2); return cameraUrl(origin, { ...c, focal: 128 * Math.sqrt(3) / 2 }); };
  const list: [string, string][] = [['from-sun', earthAtOne], ['face', await near('a', 0, 0)], ['tilt25-away', await near('b', 25, 120)], ['tilt45', await near('c', 45, 0)], ['tilt65', await near('d', 65, 30)], ['edge', await near('e', 90, 0)]];
  for (const [id, url] of list) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(page);
    const shown = await page.waitForFunction(() => { const b = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'); return b && b.querySelectorAll('.css-volume-detail s').length > 0; }, {}, { timeout: 60000 }).then(() => true, () => false); if (!shown) { errors.push('No volume at ' + id); continue; }
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')!, k = document.querySelector<HTMLElement>('[data-galaxy-backing="lmc-volume"]'), i = k?.querySelector('img')?.getBoundingClientRect(); return { bankOpacity: getComputedStyle(b).opacity, bankDisplay: getComputedStyle(b).display, backingOpacity: k && getComputedStyle(k).opacity, backingDisplay: k && getComputedStyle(k).display, image: i && [i.width | 0, i.height | 0] }; });
    const hideBack = await page.addStyleTag({ content: '[data-galaxy-backing="lmc-volume"]{display:none!important}[data-volume-dataset-object="lmc-volume"]{display:block!important;opacity:1!important}.css-volume-detail{display:block!important;opacity:1!important}.css-volume-impostors{display:none!important}' }); await page.waitForTimeout(400); const slab = await cropLuma(page); await hideBack.evaluate(n => (n as unknown as Element).remove());
    const back = await page.addStyleTag({ content: '[data-volume-dataset-object="lmc-volume"]{display:none!important}[data-galaxy-backing="lmc-volume"]{display:block!important;opacity:1!important}' }); await page.waitForTimeout(400); const fresh = await cropLuma(page);
    const saved = await page.evaluate(([matrix]) => { const i = document.querySelector<HTMLImageElement>('[data-galaxy-backing="lmc-volume"] img'); if (!i) return null; const was = [i.style.transform, i.src]; i.style.transform = matrix!; i.src = i.src.replace(/pz(\.[a-z0-9-]*)?\.png/u, 'earth$1.png'); return was; }, [OLD_BACKING]); await page.waitForTimeout(700); const old = await cropLuma(page); await back.evaluate(n => (n as unknown as Element).remove()); void saved;
    const a = register(slab, old), b = register(slab, fresh), scale = 400 / SIDE, row = (r: typeof a) => ({ offsetPx: [+(r.dx * scale).toFixed(1), +(r.dy * scale).toFixed(1)], scale: +r.s.toFixed(3), rotationDeg: +r.deg.toFixed(1), correlationUnmoved: +r.none.toFixed(3) }); const light = (x: Float64Array) => x.reduce((n, v) => n + (v > .04 ? v : 0), 0);
    rows.push({ id, state, before: row(a), after: row(b), lightBackingOverVolume: +(light(fresh) / light(slab)).toFixed(3) }); console.log('GAS_BACKING ' + JSON.stringify(rows.at(-1)));
  }
  writeFileSync(L37_DIR + 'backing.json', JSON.stringify(rows, null, 1) + '\n');
}
const ready = (page: Page) => page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
export async function alignmentReport(origin: string) {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), rows: Record<string, unknown>[] = [], errors: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 }); page.on('pageerror', e => errors.push(e.message));
    const links = await siteViewLinks(origin), earth = links[0]!.url + '&embed';
    const list: [string, string][] = [['earth-from-sun', earth], ['face-200', await cameraUrl(origin, far('a', 0, 0, 200))], ['tilt45-200', await cameraUrl(origin, far('b', 45, 0, 200))], ['edge-200', await cameraUrl(origin, far('c', 90, 0, 200))], ['tilt22-az20-200', await cameraUrl(origin, far('d', 22, 20, 200))], ['tilt65-az30-200', await cameraUrl(origin, far('e', 65, 30, 200))], ['tilt65-az210-200', await cameraUrl(origin, far('f', 65, 210, 200))], ['tilt25-az120-100', await cameraUrl(origin, far('g', 25, 120, 100))]];
    list.push(['opening-entry', origin + '/lmc/?embed']);
    for (const [id, url] of list) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(page);
      await page.waitForFunction(() => document.querySelectorAll('.css-volume-impostors s[style*="background-image"]').length > 0 && document.querySelectorAll('.css-volume-detail s').length > 0, {}, { timeout: 90000 }).catch(() => errors.push('Both presentations did not mount at ' + id));
      await page.evaluate(async () => { const urls = [...document.querySelectorAll<HTMLElement>('.css-volume-detail s, .css-volume-impostors s')].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!)); await Promise.all([...new Set(urls)].map(async url => { const i = new Image(); i.src = url; await i.decode(); })); }); await page.waitForTimeout(800);
      const style = await page.addStyleTag({ content: '.css-volume-impostors{display:none!important}.css-volume-detail{display:block!important;opacity:1!important}.prepared-cloud-points{display:none!important}' });
      await page.waitForTimeout(300); const slab = await luma(page); await style.evaluate(n => (n as unknown as Element).remove());
      const other = await page.addStyleTag({ content: '.css-volume-detail{display:none!important}.css-volume-impostors{display:block!important;opacity:1!important}.prepared-cloud-points{display:none!important}' });
      await page.waitForTimeout(300); const board = await luma(page); await other.evaluate(n => (n as unknown as Element).remove());
      const views = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.css-volume-impostors s')].filter(n => getComputedStyle(n).display !== 'none').map(n => [n.dataset.volumeImpostor, +Number(getComputedStyle(n).opacity).toFixed(2), n.getBoundingClientRect().width | 0]));
      const r = register(slab, board), scale = 1024 / SIDE, sum = (a: Float64Array) => a.reduce((n, v) => n + (v > .04 ? v : 0), 0);
      rows.push({ id, views, offsetPx: [+(r.dx * scale).toFixed(1), +(r.dy * scale).toFixed(1)], scale: +r.s.toFixed(3), rotationDeg: +r.deg.toFixed(2), correlation: +r.r.toFixed(3), correlationUnmoved: +r.none.toFixed(3), lightBoardOverSlab: +(sum(board) / sum(slab)).toFixed(3) });
      console.log('GAS_ALIGN ' + JSON.stringify(rows.at(-1)));
    }
  } finally { await browser.close(); }
  writeFileSync(L37_DIR + 'alignment.json', JSON.stringify({ errors, rows }, null, 1) + '\n'); console.log('GAS_ALIGN_DONE errors=' + errors.length + ' ' + errors.slice(0, 3).join(' | '))
}
