// Entry script: node packages/bake/authoring/m1/frame-fit.mts
/**
 * The real mapping from the pixels of the Crab's SITELLE deep frame to the sky, fitted to Gaia DR3.
 *
 * Martin, Milisavljevic & Drissen (2021) publish their deep frame with world coordinates in its header, and their 3D
 * map's points stand on that frame's pixels (./filament-speeds.mts). The header's matrix alone is too small a scale (1.5
 * to 1.8 % across the nebula) and names a distortion it does not carry, so points placed by it miss the nebula's
 * filaments in every other picture. This ties the frame to the sky instead: each Gaia DR3 star brighter than G 19 within
 * 5.1 arcmin, moved by its proper motion to the cube's date, is looked for on the frame; the star images found give
 * tangent-plane arcseconds about the header's reference point as a cubic polynomial of the pixel's offset from the
 * reference pixel (over 1,000 pixels). It prints the coefficients ./filament-speeds.mts holds, with their residual.
 *
 * Input: the deep frame, from the authors' repository at the commit ./filament-speeds.mts names, and a cone of Gaia DR3
 * from the ARI Heidelberg mirror of the Gaia archive. Output: the printed fit.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FRAME_URL = 'https://raw.githubusercontent.com/thomasorb/M1_paper/af491d4a13d408464ffb3ea75e6a424f6ef5d140/m1.deep_frame.fits', GAIA_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const GAIA_QUERY = "SELECT ra, dec, pmra, pmdec, phot_g_mean_mag FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', 83.633, 22.0145, 0.085)) AND phot_g_mean_mag < 19";
const cache = resolve(checkoutProjectRoot(import.meta.url), '.local/m1-filament-speeds');
await mkdir(cache, { recursive: true });
async function cached(name: string, fetchIt: () => Promise<Buffer>): Promise<Buffer> { const path = resolve(cache, name); if (!await stat(path).then(() => true, () => false)) await writeFile(path, await fetchIt()); return readFile(path); }
const frameBytes = await cached('m1.deep_frame.fits', async () => { const response = await fetch(FRAME_URL); if (!response.ok) throw new Error(`${FRAME_URL}: ${response.status}`); return Buffer.from(await response.arrayBuffer()); });
const gaiaCsv = (await cached('gaia-dr3-cone.csv', async () => { const response = await fetch(GAIA_TAP, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: GAIA_QUERY }) }); const text = await response.text(); if (!response.ok || !text.startsWith('ra')) throw new Error(`${GAIA_TAP}: ${response.status} ${text.slice(0, 200)}`); return Buffer.from(text); })).toString('utf8');
function fits(bytes: Buffer) { const cards = new Map<string, string>(); let offset = 0;
  for (;; offset += 80) { const card = bytes.subarray(offset, offset + 80).toString('latin1'); if (card.trim() === 'END') break; const match = /^([A-Z0-9_]+)\s*=\s*([^/]*)/u.exec(card); if (match) cards.set(match[1]!, match[2]!.trim()); }
  const start = Math.ceil((offset + 80) / 2880) * 2880, width = Number(cards.get('NAXIS1')), height = Number(cards.get('NAXIS2')), view = new DataView(bytes.buffer, bytes.byteOffset + start, width * height * 4);
  const data = new Float32Array(width * height); for (let i = 0; i < data.length; i++) data[i] = view.getFloat32(i * 4, false); return { cards, width, height, data }; }
const frame = fits(frameBytes), card = (name: string) => Number(frame.cards.get(name)), RAD = Math.PI / 180, YEARS = 2016.9 - 2016.0;
const pc = [card('PC1_1'), card('PC1_2'), card('PC2_1'), card('PC2_2')] as const, det = pc[0] * pc[3] - pc[1] * pc[2], ra0 = card('CRVAL1') * RAD, dec0 = card('CRVAL2') * RAD, x0 = card('CRPIX1') - 1, y0 = card('CRPIX2') - 1;
const stars = gaiaCsv.trim().split('\n').slice(1).map(line => line.split(',').map(Number)).map(([ra, dec, pmra, pmdec, g]) => { const a = (ra! + (Number.isFinite(pmra) ? pmra! * YEARS / 3.6e6 / Math.cos(dec! * RAD) : 0)) * RAD, d = (dec! + (Number.isFinite(pmdec) ? pmdec! * YEARS / 3.6e6 : 0)) * RAD;
  const cosc = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a - ra0); return { xi: Math.cos(d) * Math.sin(a - ra0) / cosc / RAD * 3600, eta: (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a - ra0)) / cosc / RAD * 3600, g: g! }; });
const at = (x: number, y: number) => x >= 0 && y >= 0 && x < frame.width && y < frame.height && Number.isFinite(frame.data[y * frame.width + x]!) ? frame.data[y * frame.width + x]! : NaN;
function image(px: number, py: number, reach: number): { x: number; y: number } | null { const cx = Math.round(px), cy = Math.round(py); let peak = -Infinity, bx = 0, by = 0;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) { const value = at(cx + dx, cy + dy); if (value > peak) { peak = value; bx = cx + dx; by = cy + dy; } }
  const ring: number[] = []; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const r = Math.hypot(dx, dy); if (r >= 6 && r <= 9) { const value = at(bx + dx, by + dy); if (Number.isFinite(value)) ring.push(value); } }
  if (ring.length < 40) return null; ring.sort((a, b) => a - b); const floor = ring[ring.length >> 1]!, spread = ring[Math.floor(ring.length * 0.84)]! - floor;
  if (!(peak - floor > 8 * Math.max(spread, 1e-9))) return null; let sx = 0, sy = 0, sw = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const weight = Math.max(0, at(bx + dx, by + dy) - floor); if (Number.isFinite(weight)) { sx += weight * (bx + dx); sy += weight * (by + dy); sw += weight; } }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : null; }
// Terms of a cubic in u, v (pixel offsets over 1000).
const terms = (u: number, v: number) => [1, u, v, u * u, u * v, v * v, u * u * u, u * u * v, u * v * v, v * v * v];
function solve(rows: number[][], values: number[]): number[] { const n = rows[0]!.length, a = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  rows.forEach((row, r) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) a[i]![j]! += row[i]! * row[j]!; a[i]![n]! += row[i]! * values[r]!; } });
  for (let i = 0; i < n; i++) { let pivot = i; for (let r = i + 1; r < n; r++) if (Math.abs(a[r]![i]!) > Math.abs(a[pivot]![i]!)) pivot = r; [a[i], a[pivot]] = [a[pivot]!, a[i]!]; for (let r = 0; r < n; r++) if (r !== i) { const f = a[r]![i]! / a[i]![i]!; for (let c = i; c <= n; c++) a[r]![c]! -= f * a[i]![c]!; } }
  return a.map((row, i) => row[n]! / row[i]!); }
// Sky (arcsec) from pixel: start from the frame's own matrix at the header's SCALE.
const scale0 = card('SCALE') / (Math.sqrt(Math.abs(det)) * 3600); let toXi = (x: number, y: number) => (pc[0] * (x - x0) + pc[1] * (y - y0)) * 3600 * scale0, toEta = (x: number, y: number) => (pc[2] * (x - x0) + pc[3] * (y - y0)) * 3600 * scale0;
let coefficients: { xi: number[]; eta: number[] } | null = null, used = 0, rms = 0;
for (let round = 0; round < 6; round++) { const gate = round < 2 ? 2.5 : 1.2, pairs: { u: number; v: number; xi: number; eta: number }[] = [];
  for (const star of stars) { if (star.g > 19) continue;
    // The pixel whose sky is the star's: two steps of Newton from the linear guess.
    let x = x0 + (pc[3] * star.xi - pc[1] * star.eta) / det / 3600 / scale0, y = y0 + (-pc[2] * star.xi + pc[0] * star.eta) / det / 3600 / scale0;
    for (let step = 0; step < 3; step++) { const ex = star.xi - toXi(x, y), ey = star.eta - toEta(x, y); x += (pc[3] * ex - pc[1] * ey) / det / 3600 / scale0; y += (-pc[2] * ex + pc[0] * ey) / det / 3600 / scale0; }
    if (x < 15 || y < 15 || x > frame.width - 15 || y > frame.height - 15) continue; const seen = image(x, y, round < 2 ? 3 : 2); if (!seen || Math.hypot(seen.x - x, seen.y - y) > gate) continue;
    pairs.push({ u: (seen.x - x0) / 1000, v: (seen.y - y0) / 1000, xi: star.xi, eta: star.eta }); }
  const rows = pairs.map(pair => terms(pair.u, pair.v)), cx = solve(rows, pairs.map(pair => pair.xi)), ce = solve(rows, pairs.map(pair => pair.eta)); coefficients = { xi: cx, eta: ce };
  toXi = (x, y) => terms((x - x0) / 1000, (y - y0) / 1000).reduce((sum, term, index) => sum + term * cx[index]!, 0); toEta = (x, y) => terms((x - x0) / 1000, (y - y0) / 1000).reduce((sum, term, index) => sum + term * ce[index]!, 0);
  used = pairs.length; rms = Math.sqrt(pairs.reduce((sum, pair) => sum + (toXi(x0 + pair.u * 1000, y0 + pair.v * 1000) - pair.xi) ** 2 + (toEta(x0 + pair.u * 1000, y0 + pair.v * 1000) - pair.eta) ** 2, 0) / pairs.length);
  console.log(`round ${round}: ${used} stars within ${gate} px, residual ${rms.toFixed(3)} arcsec rms`); }
const local = (x: number, y: number) => Math.hypot(toXi(x + 1, y) - toXi(x - 1, y), toEta(x + 1, y) - toEta(x - 1, y)) / 2;
console.log(`arcsec a pixel along x: at the reference pixel ${local(x0, y0).toFixed(5)}; 300 px east ${local(x0 - 300, y0).toFixed(5)}, west ${local(x0 + 300, y0).toFixed(5)}; 500 px north ${local(x0, y0 + 500).toFixed(5)}, south ${local(x0, y0 - 500).toFixed(5)}; the matrix alone ${(Math.sqrt(Math.abs(det)) * 3600).toFixed(5)}; header SCALE ${card('SCALE')}`);
console.log(`reference pixel maps ${toXi(x0, y0).toFixed(3)} arcsec east-tangent and ${toEta(x0, y0).toFixed(3)} north of the header's reference point`);
console.log(`${used} stars, ${rms.toFixed(3)} arcsec rms.\nxi: [${coefficients!.xi.map(value => Number(value.toPrecision(9))).join(', ')}]\neta: [${coefficients!.eta.map(value => Number(value.toPrecision(9))).join(', ')}]`);
