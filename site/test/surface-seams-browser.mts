import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import sharp from 'sharp';
import { createTestPage } from './browser-observations.mts';

// Leaf seams on a prepared sphere, measured as a viewer sees them. Each pose is a saved view URL rendered
// four times without moving the camera: the surface over a black and then a white backdrop shows what
// each pixel lets through; flat per-leaf colours mark the disc; and the same colours with every leaf
// shrunk leave a gap centred on each shared edge. Along each seam, brightness is averaged across the seam
// and compared with the same average on parallel control lines inside both leaves, so the texture itself
// sets the noise floor.

const origin = process.argv.find(argument => /^https?:/u.test(argument)) ?? process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const output = resolve(process.env.SURFACE_SEAMS_OUTPUT ?? 'output/playwright/surface-seams');
const BODY = 'venus';
const VIEWPORT = { width: 1490, height: 1218 };
const CLIP = { x: 360, y: 90, width: 770, height: 1080 };
// Saved views of the Venus radar lens at this viewport, with the silhouette diameter each restores:
// feature and mid zoom, where seams are long enough to fit, then the default view and a distant disc.
const POSES = [
  { id: 'feature', diameter: 2405, seams: true, path: '/venus/?v=QMa-EGJN0vGp-74EcrAgxJulwMFWfLFcNnpBQsczQAAAAD_ZN_bVrXpoP9TyuJgcYgW_zILhMsZjJAABAAAAAAAAAAA#dataset=radar' },
  { id: 'middle', diameter: 783, seams: true, path: '/venus/?v=MMZA1Fozu-F17EFCxzNAAAAAP9j-5Ro7MLA_k_zeYOLxyT-A9ta69O-QAAEAAAAAAAAAAA#dataset=radar' },
  { id: 'default', diameter: 536, seams: false, path: '/venus/#dataset=radar' },
  { id: 'far', diameter: 261, seams: false, path: '/venus/?v=MMZA7Vy0s5ZLp0FCxzNAAAAAP9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA#dataset=radar' },
] as const;
// Seams pass when at most 0.2% of the disc lets more than 1% of the backdrop through and no pixel more
// than 10% (the former fixed overlap reached 0.6–7.5% and 12–17% on these views), their lines are no
// stronger than 1.5 times the texture's own variation, and the texture correlates across them almost as
// well as inside a leaf.
const LIMITS = { seeThroughShare: 0.002, seeThroughMax: 0.1, contrastRatio: 1.5, correlationDrop: 0.1 };
const SHRINK_PIXELS = 6;
const ISOLATE = `
  body * { visibility: hidden !important; }
  .polycss-camera, .polycss-camera * { visibility: visible !important; }
  [class*="-material-composite"], [class*="-material-composite"] * { visibility: visible !important; }
  .prepared-celestial-sky-scene, .prepared-celestial-sky-scene *, .prepared-point-field, .prepared-point-field *,
  .css-volume-mesh, .css-volume-mesh *, .prepared-catalogue-points, .prepared-catalogue-points *,
  .prepared-surface-features, .prepared-surface-features * { visibility: hidden !important; }
  .polycss-camera { background: transparent !important; }
  html, body { background: var(--surface-seams-backdrop, #000) !important; }`;

interface Raster { readonly width: number; readonly height: number; readonly data: Buffer }
interface Seam { readonly pair: readonly [number, number]; readonly cx: number; readonly cy: number; readonly ux: number; readonly uy: number; readonly nx: number; readonly ny: number; readonly tMin: number; readonly tMax: number }
interface SeamMeasure { readonly contrast: number; readonly seeThrough: number; readonly correlation: number; readonly controlContrast: number; readonly controlCorrelation: number; readonly length: number }

async function raster(path: string): Promise<Raster> {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}
const luminance = ({ width, height, data }: Raster) => Float32Array.from({ length: width * height },
  (_, i) => 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]);
// Share of the backdrop showing through each pixel: 0 where the surface covers it completely.
const seeThrough = (black: Raster, white: Raster) => Float32Array.from({ length: black.width * black.height },
  (_, i) => (Math.abs(white.data[i * 3] - black.data[i * 3]) + Math.abs(white.data[i * 3 + 1] - black.data[i * 3 + 1]) + Math.abs(white.data[i * 3 + 2] - black.data[i * 3 + 2])) / 765);
function bilinear(field: Float32Array, width: number, height: number) {
  return (x: number, y: number): number => {
    if (!(x >= 0 && y >= 0 && x < width - 1 && y < height - 1)) return Number.NaN;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * width + x0;
    return field[i] * (1 - fx) * (1 - fy) + field[i + 1] * fx * (1 - fy) + field[i + width] * (1 - fx) * fy + field[i + width + 1] * fx * fy;
  };
}
// Interior pixels (a uniform 3 × 3 block) carry their leaf identity; 0 is the backdrop and -1 an edge.
function identities({ width, height, data }: Raster): Int32Array {
  const ids = new Int32Array(width * height).fill(-1);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    let uniform = true;
    for (let dy = -1; dy <= 1 && uniform; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (y + dy) * width + x + dx;
      if (data[j * 3] !== data[i * 3] || data[j * 3 + 1] !== data[i * 3 + 1] || data[j * 3 + 2] !== data[i * 3 + 2]) { uniform = false; break; }
    }
    if (!uniform) continue;
    if (data[i * 3] === 0 && data[i * 3 + 1] === 0 && data[i * 3 + 2] === 0) ids[i] = 0;
    else if (data[i * 3 + 2] === 128) ids[i] = data[i * 3] + 256 * data[i * 3 + 1];
  }
  return ids;
}
const identityAt = (ids: Int32Array, width: number, height: number) => (x: number, y: number) => {
  const xi = Math.round(x), yi = Math.round(y);
  return xi < 0 || yi < 0 || xi >= width || yi >= height ? -2 : ids[yi * width + xi];
};
// Midpoints between facing boundaries of two leaves, at most 24 px apart along a row or a column, fitted
// to one straight line per pair. This holds whether leaves overlap, meet or are shrunk apart.
function seams(ids: Int32Array, width: number, height: number): Seam[] {
  const idAt = identityAt(ids, width, height), midpoints = new Map<string, number[]>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = ids[y * width + x];
    if (a <= 0) continue;
    for (const [sx, sy] of [[1, 0], [0, 1]] as const) {
      if (x + sx >= width || y + sy >= height || ids[(y + sy) * width + x + sx] === a) continue;
      for (let d = 1; d <= 24 && x + sx * d < width && y + sy * d < height; d++) {
        const b = ids[(y + sy * d) * width + x + sx * d];
        if (b <= 0) continue;
        if (b !== a) {
          const key = a < b ? `${a}-${b}` : `${b}-${a}`, points = midpoints.get(key) ?? [];
          points.push(x + sx * d / 2, y + sy * d / 2); midpoints.set(key, points);
        }
        break;
      }
    }
  }
  const found: Seam[] = [];
  for (const [key, points] of midpoints) {
    const count = points.length / 2;
    if (count < 40) continue;
    let cx = 0, cy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < points.length; i += 2) { cx += points[i] / count; cy += points[i + 1] / count; }
    for (let i = 0; i < points.length; i += 2) { const dx = points[i] - cx, dy = points[i + 1] - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(angle), uy = Math.sin(angle);
    let nx = -uy, ny = ux, tMin = Infinity, tMax = -Infinity, spread = 0;
    for (let i = 0; i < points.length; i += 2) {
      const dx = points[i] - cx, dy = points[i + 1] - cy, t = dx * ux + dy * uy;
      tMin = Math.min(tMin, t); tMax = Math.max(tMax, t); spread += (dx * nx + dy * ny) ** 2;
    }
    if (Math.sqrt(spread / count) > 2) continue; // not one straight shared edge
    const [a, b] = key.split('-').map(Number);
    let side = 0;
    for (let d = 1; d <= 24 && side === 0; d++) { const id = idAt(cx + d * nx, cy + d * ny); side = id === a ? -1 : id === b ? 1 : 0; }
    if (side === 0) continue;
    if (side < 0) { nx = -nx; ny = -ny; }
    found.push({ pair: [a, b], cx, cy, ux, uy, nx, ny, tMin, tMax });
  }
  return found;
}
const OFFSETS = Array.from({ length: 41 }, (_, k) => -10 + k * 0.5);
// The strongest deviation within 2 px of the line from a straight fit through the profile 4–10 px away.
function lineContrast(profile: readonly number[]): number {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  OFFSETS.forEach((d, k) => { if (Math.abs(d) >= 4) { n++; sx += d; sy += profile[k]; sxx += d * d; sxy += d * profile[k]; } });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), intercept = (sy - slope * sx) / n;
  return Math.max(...OFFSETS.flatMap((d, k) => Math.abs(d) <= 2 ? [Math.abs(profile[k] - intercept - slope * d)] : []));
}
function correlation(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((sum, value) => sum + value, 0) / a.length, mb = b.reduce((sum, value) => sum + value, 0) / b.length;
  let covariance = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) { covariance += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return covariance / Math.sqrt(va * vb);
}
// Leaf identity is read 14 px either side of the line, beyond the shrink gap; controls run 26 px away.
const PROBE = 14, CONTROL = 26;
function measure(found: readonly Seam[], ids: Int32Array, width: number, height: number, brightness: Float32Array, leak: Float32Array): SeamMeasure[] {
  const lum = bilinear(brightness, width, height), through = bilinear(leak, width, height), idAt = identityAt(ids, width, height);
  return found.flatMap(seam => {
    const line = (offset: number, inside: number | null) => {
      const profile = new Array<number>(OFFSETS.length).fill(0), before: number[] = [], after: number[] = [];
      let used = 0, leaked = 0;
      for (let t = seam.tMin + 10; t <= seam.tMax - 10; t++) {
        const x = seam.cx + t * seam.ux + offset * seam.nx, y = seam.cy + t * seam.uy + offset * seam.ny;
        const valid = inside === null ? idAt(x - PROBE * seam.nx, y - PROBE * seam.ny) === seam.pair[0] && idAt(x + PROBE * seam.nx, y + PROBE * seam.ny) === seam.pair[1]
          : [-10, -5, 0, 5, 10].every(d => idAt(x + d * seam.nx, y + d * seam.ny) === inside);
        const values = OFFSETS.map(d => lum(x + d * seam.nx, y + d * seam.ny));
        if (!valid || values.some(value => !Number.isFinite(value))) continue;
        values.forEach((value, k) => { profile[k] += value; });
        leaked = Math.max(leaked, ...OFFSETS.filter(d => Math.abs(d) <= 2).map(d => through(x + d * seam.nx, y + d * seam.ny)));
        before.push(lum(x - 2.5 * seam.nx, y - 2.5 * seam.ny)); after.push(lum(x + 2.5 * seam.nx, y + 2.5 * seam.ny));
        used++;
      }
      return used < 30 ? null : { used, contrast: lineContrast(profile.map(value => value / used)), leaked, correlation: correlation(before, after) };
    };
    const seamLine = line(0, null), controls = [line(-CONTROL, seam.pair[0]), line(CONTROL, seam.pair[1])].filter(value => value !== null);
    if (!seamLine || !controls.length) return [];
    return [{ length: seamLine.used, contrast: seamLine.contrast, seeThrough: seamLine.leaked, correlation: seamLine.correlation,
      controlContrast: Math.max(...controls.map(control => control.contrast)), controlCorrelation: Math.min(...controls.map(control => control.correlation)) }];
  });
}
// Disc pixels at least 3 px from the backdrop that let it through, from the unshrunk leaf render.
function discSeeThrough(disc: Int32Array, width: number, height: number, leak: Float32Array) {
  let largest = 0, counted = 0, over = 0;
  for (let y = 3; y < height - 3; y++) for (let x = 3; x < width - 3; x++) {
    let backdrop = false;
    for (let dy = -3; dy <= 3 && !backdrop; dy++) for (let dx = -3; dx <= 3; dx++) if (disc[(y + dy) * width + x + dx] === 0) { backdrop = true; break; }
    if (backdrop) continue;
    const value = leak[y * width + x];
    counted++; largest = Math.max(largest, value); if (value > 0.01) over++;
  }
  return { max: largest, shareOver1Percent: over / Math.max(1, counted), pixels: counted };
}
const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) / 2)] ?? Number.NaN; };

async function capture(page: Page, pose: typeof POSES[number]) {
  await page.goto(origin + pose.path, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__cssEarth?.ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(6000);
  await page.addStyleTag({ content: ISOLATE });
  const diameter = await page.evaluate(id => {
    const object = window.__cssearthTest?.object(id);
    if (!object) throw new Error(`${id} has no test handle.`);
    const radius = object.camera?.state()?.silhouetteRadius;
    if (typeof radius !== "number" || !Number.isFinite(radius)) throw new Error(`${id} has no silhouette radius.`);
    return 2 * radius;
  }, BODY);
  const paths = { black: resolve(output, `${pose.id}-black.png`), white: resolve(output, `${pose.id}-white.png`),
    disc: resolve(output, `${pose.id}-disc.png`), seams: resolve(output, `${pose.id}-seams.png`) };
  for (const backdrop of ['black', 'white'] as const) {
    await page.evaluate(colour => document.documentElement.style.setProperty('--surface-seams-backdrop', colour), backdrop === 'black' ? '#000' : '#fff');
    await page.waitForTimeout(500);
    await page.screenshot({ path: paths[backdrop], clip: CLIP });
  }
  // Flat leaf colours without the lighting overlay, over the black backdrop: first as prepared, then with
  // every leaf shrunk SHRINK_PIXELS per edge through its own outset, so even prepared overlaps open a gap.
  await page.addStyleTag({ content: '[class*="-material-composite"], [class*="-material-composite"] * { visibility: hidden !important; }' });
  for (const [path, outset] of [[paths.disc, 0], [paths.seams, -SHRINK_PIXELS / diameter]] as const) {
    await page.evaluate(([id, value]) => {
      document.querySelectorAll<HTMLElement>(`.polycss-mesh.${id}-body > s`).forEach((leaf, index) => {
        leaf.style.setProperty('background-image', 'none', 'important');
        leaf.style.setProperty('background-color', `rgb(${(index + 1) & 255}, ${((index + 1) >> 8) & 255}, 128)`, 'important');
        leaf.style.setProperty('--surface-seam-outset', String(value));
      });
      document.documentElement.style.setProperty('--surface-seams-backdrop', '#000');
    }, [BODY, outset] as const);
    await page.waitForTimeout(1000);
    await page.screenshot({ path, clip: CLIP });
  }
  return { diameter, paths };
}

await mkdir(output, { recursive: true });
const checks: { id: string; ok: boolean; [key: string]: unknown }[] = [], report: Record<string, unknown>[] = [];
const check = (id: string, ok: boolean, detail: Record<string, unknown>) => {
  checks.push({ id, ok, ...detail });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
};
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
try {
  for (const pose of POSES) {
    const page = await createTestPage(browser, { viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      const { diameter, paths } = await capture(page, pose);
      check(`${pose.id}: the saved view restores its silhouette`, Math.abs(diameter - pose.diameter) <= pose.diameter * 0.05, { diameter, expected: pose.diameter });
      const [black, white, discImage, seamImage] = await Promise.all([raster(paths.black), raster(paths.white), raster(paths.disc), raster(paths.seams)]);
      const { width, height } = black, leak = seeThrough(black, white), seamIds = identities(seamImage);
      const disc = discSeeThrough(identities(discImage), width, height, leak);
      check(`${pose.id}: the surface hides the backdrop`, disc.shareOver1Percent <= LIMITS.seeThroughShare && disc.max <= LIMITS.seeThroughMax, { diameter, ...disc });
      const measured = pose.seams ? measure(seams(seamIds, width, height), seamIds, width, height, luminance(black), leak) : [];
      const summary = { diameter, seeThrough: disc, seams: measured.length,
        contrast: median(measured.map(seam => seam.contrast)), controlContrast: median(measured.map(seam => seam.controlContrast)),
        correlation: median(measured.map(seam => seam.correlation)), controlCorrelation: median(measured.map(seam => seam.controlCorrelation)) };
      report.push({ pose: pose.id, ...summary, measured });
      if (pose.seams) {
        check(`${pose.id}: enough straight seams to measure`, measured.length >= 8, { seams: measured.length });
        if (measured.length >= 8) {
          check(`${pose.id}: seam lines stay within the texture's own variation`, summary.contrast <= LIMITS.contrastRatio * summary.controlContrast, summary);
          check(`${pose.id}: texture continues across seams`, summary.correlation >= summary.controlCorrelation - LIMITS.correlationDrop, summary);
        }
      }
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify({ origin, limits: LIMITS, checks, report }, null, 2)}\n`);
}
const failed = checks.filter(entry => !entry.ok);
console.log(JSON.stringify({ suite: 'surface-seams', passed: checks.length - failed.length, failed: failed.length, output }));
if (failed.length) process.exitCode = 1;
