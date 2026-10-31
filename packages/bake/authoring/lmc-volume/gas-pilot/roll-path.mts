/** Billboard roll along camera paths on the live page, from real transforms. Numbers only. */
import { writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { parseSharedView, formatSharedView } from '@cssearth/renderer/navigation';
import { cameraUrl, pilotCamera } from '../piece-pilot/cameras.mts';
import { mul } from '../geometry.mts';
import { L37_DIR } from './regions.mts';
const ORIGIN = 'http://127.0.0.1:4313', FROM = 'UMNAahsZLIANA0ASAQiInu59w5Zo-c6-NlhBQsczQAAAAL-wkk_AtWesv72ziNhtNNc_xMzYN9zzEQAA', TO = 'UMNAahsZLIANA0ASAQiInu59w5Zo-c6-NlhBQsczQAAAAL_F-X4D-4URP7Wd5sMSO1k_x6L4urtZzwAA';
type M = number[];
const matrix = (scene: string): M => scene.slice(9, -1).split(',').map(Number);
const rot = (m: M): M => [m[0]!, m[4]!, m[8]!, m[1]!, m[5]!, m[9]!, m[2]!, m[6]!, m[10]!];
const mulR = (a: M, b: M): M => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!));
const tr = (a: M): M => [a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!];
function slerpPath(from: M, to: M, count: number) { const d = mulR(to, tr(from)), angle = Math.acos(Math.max(-1, Math.min(1, (d[0]! + d[4]! + d[8]! - 1) / 2))), ax = [d[7]! - d[5]!, d[2]! - d[6]!, d[3]! - d[1]!], n = Math.hypot(...ax) || 1, [x, y, z] = ax.map(v => v / n) as [number, number, number];
  return Array.from({ length: count + 1 }, (_, i) => { const t = angle * i / count, c = Math.cos(t), s = Math.sin(t), C = 1 - c; return mulR([c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C], from); }); }
async function read(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 120000 }); await page.waitForFunction(() => document.querySelectorAll('.prepared-cloud-points > div').length > 0, {}, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(500);
  return page.evaluate(() => { const v = (Reflect.get(Reflect.get(window, '__lmc') as object, 'runtime') as { view(): { worldCamera: { pose: { orientationXyzw: number[] } } } }).view().worldCamera.pose.orientationXyzw, boards = [...document.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')], one = boards.find(n => /rotate\(/u.test(n.style.transform)); return { q: v, roll: one ? Number(/rotate\((-?[\d.]+)deg\)/u.exec(one.style.transform)![1]) : NaN, count: boards.length, errorless: true }; });
}
const axis = (q: number[]) => { const [x, y, z, w] = q as [number, number, number, number]; return [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]; };
function stats(rows: { q: number[]; roll: number }[]) { let worst = 0, largest = 0, total = 0; for (let i = 1; i < rows.length; i++) { const a = axis(rows[i - 1]!.q), b = axis(rows[i]!.q), deg = Math.acos(Math.max(-1, Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!))) * 180 / Math.PI, change = Math.abs(((rows[i]!.roll - rows[i - 1]!.roll + 540) % 360) - 180); largest = Math.max(largest, change); total += change; if (deg > .05) worst = Math.max(worst, change / deg); } return { samples: rows.length, worstRollPerDegree: +worst.toFixed(2), largestStep: +largest.toFixed(1), total: +total.toFixed(1), range: [rows[0]!.roll, rows.at(-1)!.roll] }; }
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), page = await browser.newPage({ viewport: { width: 1024, height: 768 } }), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
const orbit = (name: string, tilt: number, az: number) => { const b = pilotCamera(name, 128, [0, 0, 0], 10, tilt, az), distance = 24; return cameraUrl(ORIGIN, { ...b, distance, eye: mul(b.back, distance), focal: 128 * Math.sqrt(3) / 2 * 1.5 }); };
const saved = parseSharedView('?v=' + FROM)!, m0 = rot(matrix(saved.camera!.pose!.scene)), m1 = rot(matrix(parseSharedView('?v=' + TO)!.camera!.pose!.scene)), out: Record<string, unknown> = {}, rows: Record<string, { q: number[]; roll: number }[]> = { owner: [], edge: [], orbit: [] };
for (const r of slerpPath(m0, m1, 16)) { const m = [r[0]!, r[3]!, r[6]!, 0, r[1]!, r[4]!, r[7]!, 0, r[2]!, r[5]!, r[8]!, 0, 0, 0, 0, 1]; const q = formatSharedView({ ...saved, camera: { ...saved.camera!, pose: { ...saved.camera!.pose!, scene: 'matrix3d(' + m.join(',') + ')' } } } as never); rows.owner!.push(await read(page, ORIGIN + '/lmc/?' + q)); }
for (let tilt = 60; tilt <= 120; tilt += 5) rows.edge!.push(await read(page, await orbit('e', tilt, 15)));
for (let az = 0; az <= 360; az += 15) rows.orbit!.push(await read(page, await orbit('o', 60, az)));
for (const [k, v] of Object.entries(rows)) out[k] = stats(v);
const top: Record<string, number> = {}; for (const [k, u] of [['face', await orbit('f', 0, 0)], ['tilt25', await orbit('g', 25, 120)], ['opening', ORIGIN + '/lmc/']] as const) top[k] = (await read(page, u)).roll;
out.top = top; out.errors = errors.length; await browser.close();
writeFileSync(L37_DIR + 'roll-' + (process.argv[2] ?? 'run') + '.json', JSON.stringify(out, null, 1) + '\n'); console.log('GAS_ROLL ' + JSON.stringify(out));
