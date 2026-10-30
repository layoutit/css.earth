/** The comparison sheet, and each arm's light against the accepted delivery. Nothing here enters a bank. */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { COMPONENT_DIR } from '../shape-pilot/component-bank.mts';
import { L37_DIR } from './regions.mts';

const W = 512, H = 384, VIEWS = ['earth', 'pz', 'tilt45', 'py', 'dor30-close'], NAMES = ['Earth', 'face-on', '45 degrees', 'edge-on', '30 Doradus close'];
const COLUMNS = [{ label: 'accepted l36 (reference)', path: (v: string) => L37_DIR + 'accepted/' + v + '.png' }, { label: '1 dots', path: (v: string) => L37_DIR + 'dots/' + v + '.png' }, { label: '2 crossed sprites', path: (v: string) => L37_DIR + 'sprites/' + v + '.png' }, { label: '3 slab components (old pilot, 128 px)', path: (v: string) => COMPONENT_DIR + 'pilot/' + (v === 'dor30-close' ? 'shell-45-0' : v) + '.png' }];
const label = (text: string) => Buffer.from(`<svg width="${W}" height="26"><rect width="${W}" height="26" fill="#000" fill-opacity=".7"/><text x="8" y="19" font-family="Helvetica" font-size="16" fill="#fff">${text}</text></svg>`);

export async function sheet(path = L37_DIR + 'comparison.png') {
  const parts = [];
  for (const [c, column] of COLUMNS.entries()) for (const [r, view] of VIEWS.entries()) {
    parts.push({ input: await sharp(column.path(view)).resize(W, H).png().toBuffer(), left: c * W, top: r * H });
    parts.push({ input: label(column.label + ' / ' + NAMES[r]), left: c * W, top: r * H });
  }
  await sharp({ create: { width: COLUMNS.length * W, height: VIEWS.length * H, channels: 3, background: '#000' } }).composite(parts).png().toFile(path);
}
const toLinear = (v: number) => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
async function raw(path: string) { return (await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })); }
/** Linear light a window adds over the slabs alone. */
async function added(a: string, b: string, box?: number[]) {
  const A = await raw(a), B = await raw(b), w = A.info.width, h = A.info.height, [x0, y0, x1, y1] = box ?? [0, 0, w, h]; let s = 0;
  for (let y = Math.max(0, Math.floor(y0!)); y < Math.min(h, y1!); y++) for (let x = Math.max(0, Math.floor(x0!)); x < Math.min(w, x1!); x++) { const i = (y * w + x) * 3; for (let k = 0; k < 3; k++) s += toLinear(A.data[i + k]!) - toLinear(B.data[i + k]!); }
  return s;
}
export async function lightReport() {
  const result = JSON.parse(await readFile(L37_DIR + 'dots/result.json', 'utf8')) as { regionIds: string[] }, site = JSON.parse(await readFile(L37_DIR + 'dots/site-result.json', 'utf8').catch(() => readFile(L37_DIR + 'dots/result.json', 'utf8'))) as { rows?: { id: string; rects: { cell: number[]; box: number[] }[] }[] };
  const report: Record<string, unknown>[] = [], across = Math.ceil(Math.sqrt(result.regionIds.length));
  for (const view of VIEWS) {
    const bg = L37_DIR + 'dots/' + view + '-background.png', ref = await added(L37_DIR + 'accepted/' + view + '.png', bg), dots = await added(L37_DIR + 'dots/' + view + '.png', bg), sprites = await added(L37_DIR + 'sprites/' + view + '.png', bg);
    const row: Record<string, unknown> = { view, referenceAdded: ref, dotsRatio: dots / ref, spritesRatio: sprites / ref };
    const rects = site.rows?.find(r => r.id === view)?.rects;
    if (rects) { const boxes = new Map<string, number[]>(); for (const r of rects) { const j = r.cell[1]! / 128 * across + r.cell[0]! / 128, id = result.regionIds[j]!, b = boxes.get(id); boxes.set(id, b ? [Math.min(b[0]!, r.box[0]!), Math.min(b[1]!, r.box[1]!), Math.max(b[2]!, r.box[2]!), Math.max(b[3]!, r.box[3]!)] : [...r.box]); } const per: Record<string, number> = {}; for (const [id, box] of boxes) { const R = await added(L37_DIR + 'accepted/' + view + '.png', bg, box); if (R > 1) per[id] = (await added(L37_DIR + 'dots/' + view + '.png', bg, box)) / R; } row.dotsRegionRatios = per; }
    report.push(row);
  }
  await writeFile(L37_DIR + 'light.json', JSON.stringify(report, null, 1) + '\n'); return report;
}
/** Each region's measured excess over the accepted delivery, taken out of its one gain. The asinh tone answers slowly, hence the exponent. */
async function adjustGains(report: Record<string, unknown>[]) {
  const path = L37_DIR + 'dots/adjust.json', adjust = JSON.parse(await readFile(path, 'utf8').catch(() => '{}')) as Record<string, number>, worst: Record<string, number> = {};
  for (const row of report) if (['earth', 'pz', 'tilt45'].includes(String(row.view))) for (const [id, v] of Object.entries(row.dotsRegionRatios as Record<string, number>)) if (v > .05) worst[id] = Math.max(worst[id] ?? 0, v);
  for (const [id, v] of Object.entries(worst)) adjust[id] = (adjust[id] ?? 1) * Math.min(1, .97 / v) ** 1.3;
  await writeFile(path, JSON.stringify(adjust) + '\n'); return { worst, adjust };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { await sheet(); const report = await lightReport(); console.log(JSON.stringify(report.map(r => ({ view: r.view, dots: r.dotsRatio, sprites: r.spritesRatio })))); if (process.argv.includes('--adjust')) console.log(JSON.stringify(await adjustGains(report))); }
