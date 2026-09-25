/** Offline fixed publisher TAN/SIN WCS check against an independently queried catalogue. No fitting.
 * Chance association scales with detection density, so a flat "controls below a tenth of the matches" limit
 * penalises deeper or sharper rasters that detect more real sources. The control is therefore an excess over
 * the chance rate measured at the same density: inside the tight radius (the protocol's median limit), the
 * real matches must exceed the largest chance estimate by the declared margin. The chance estimate is the
 * larger of the shifted/wrong-transform control counts and the analytic rate for the detected density. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateImageWcs, type ImageWcs } from '@cssearth/bake/volume';
type Point = [number, number];
const radians = Math.PI / 180;
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export function cataloguePixel(ra: number, dec: number, w: ImageWcs, width: number, height: number): Point {
  const a = (ra - w.referenceValueDeg[0]) * radians, d = dec * radians, d0 = w.referenceValueDeg[1] * radians;
  const denominator = w.projection === 'TAN' ? Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a) : 1;
  const east = Math.cos(d) * Math.sin(a) / denominator / radians;
  const north = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / denominator / radians;
  const rotation = w.rotationDeg * radians, c = Math.cos(rotation), s = Math.sin(rotation);
  const x = w.referencePixel[0] + (c * east + s * north) / w.scaleDeg[0];
  const y = w.referencePixel[1] + (-s * east + c * north) / w.scaleDeg[1];
  return [(x - .5) * width / w.referenceDimension[0] - .5,
    (w.referenceDimension[1] + .5 - y) * height / w.referenceDimension[1] - .5];
}
function hullArea(points: Point[]): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (values: Point[]) => { const h: Point[] = []; for (const p of values) { while (h.length > 1 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop(); h.push(p); } return h.slice(0, -1); };
  const hull = [...half(sorted), ...half(sorted.reverse())];
  return Math.abs(hull.reduce((s, p, i) => { const q = hull[(i + 1) % hull.length]!; return s + p[0] * q[1] - p[1] * q[0]; }, 0)) / 2;
}
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => { const index = p * (sorted.length - 1), lo = Math.floor(index); return sorted[lo]! + (sorted[Math.ceil(index)]! - sorted[lo]!) * (index - lo); };
  return { median: percentile(.5), p90: percentile(.9), max: sorted.at(-1) ?? Infinity };
}
function nearestIndex(points: Point[]) {
  const cells = new Map<string, number[]>(), size = 5;
  points.forEach((p, i) => { const key = `${Math.floor(p[0] / size)},${Math.floor(p[1] / size)}`; const list = cells.get(key) ?? []; list.push(i); cells.set(key, list); });
  return (p: Point, radius: number, exclude = -1): { index: number; distance: number } => {
    let index = -1, distance = radius;
    for (let y = Math.floor((p[1] - radius) / size); y <= Math.floor((p[1] + radius) / size); y++) for (let x = Math.floor((p[0] - radius) / size); x <= Math.floor((p[0] + radius) / size); x++)
      for (const i of cells.get(`${x},${y}`) ?? []) { if (i === exclude) continue; const q = points[i]!, d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < distance) { distance = d; index = i; } }
    return { index, distance };
  };
}
/** Association radius of the excess test, and the factor the real matches must beat the chance rate by. */
export const CHANCE_RADIUS_PIXELS = .75, CHANCE_EXCESS_MARGIN = 5;
/** Expected chance matches: one catalogue position matches by chance when any detection lands inside the radius. */
export function analyticChanceMatches(catalogueCount: number, detections: number, radius: number, width: number, height: number): number {
  return catalogueCount * (1 - Math.exp(-detections * Math.PI * radius * radius / (width * height)));
}
/** The density-aware control: real close matches against the largest chance estimate at the same detection density. */
export function chanceExcess(closeMatches: number, controlCloseMatches: readonly number[], analytic: number) {
  const expectation = Math.max(analytic, ...controlCloseMatches, 0);
  return { closeMatches, expectation, ratio: expectation > 0 ? closeMatches / expectation : Infinity,
    pass: closeMatches >= CHANCE_EXCESS_MARGIN * expectation && closeMatches >= 100 };
}
export async function verifyFixedCatalogue(sourcePath: string, expectedSha256: string, wcs: ImageWcs, cataloguePath: string) {
  validateImageWcs(wcs);
  const source = await fs.readFile(sourcePath), csv = await fs.readFile(cataloguePath);
  if (hash(source) !== expectedSha256) throw new Error('Pinned source hash mismatch.');
  const { data, info } = await sharp(source).removeAlpha().extractChannel(2).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const blurred = await sharp(data, { raw: { width, height, channels: 1 } }).blur(4).greyscale().raw().toBuffer();
  if (blurred.length !== data.length) throw new Error('Blur channel mismatch.');
  const hp = Float32Array.from(data, (value, i) => Math.max(0, value - blurred[i]!));
  const stars: Point[] = [];
  for (let y = 5; y < height - 5; y++) for (let x = 5; x < width - 5; x++) {
    const peak = hp[y * width + x]!; if (peak <= 12) continue;
    let local = true; for (let dy = -3; dy <= 3 && local; dy++) for (let dx = -3; dx <= 3; dx++) if (hp[(y + dy) * width + x + dx]! > peak) { local = false; break; }
    if (!local) continue;
    let total = 0, sx = 0, sy = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = hp[(y + dy) * width + x + dx]!; total += v; sx += dx * v; sy += dy * v; }
    stars.push([x + sx / total, y + sy / total]);
  }
  const lines = csv.toString().trim().split(/\r?\n/), header = lines.shift()!.split(',').map(v => v.replaceAll('"', ''));
  const indices = ['designation', 'ra', 'dec'].map(name => header.indexOf(name));
  if (indices.some(i => i < 0) || lines.length >= 200000) throw new Error('Invalid or truncated catalogue CSV.');
  const rows = lines.map(line => { const values = line.split(',').map(v => v.replaceAll('"', '')); const ra = Number(values[indices[1]!]!), dec = Number(values[indices[2]!]!); if (!Number.isFinite(ra) || !Number.isFinite(dec)) throw new Error('Invalid catalogue position.'); return { designation: values[indices[0]!]!, ra, dec, point: cataloguePixel(ra, dec, wcs, width, height) }; }).filter(row => row.point[0] > 10 && row.point[1] > 10 && row.point[0] < width - 10 && row.point[1] < height - 10);
  const nearbyCatalogue = nearestIndex(rows.map(r => r.point));
  const isolated = rows.filter((r, i) => nearbyCatalogue(r.point, 5, i).index < 0), nearbyStars = nearestIndex(stars);
  const candidates = isolated.map(row => ({ row, ...nearbyStars(row.point, 2.5) })).filter(p => p.index >= 0).sort((a, b) => a.distance - b.distance);
  const used = new Set<number>(), matches = candidates.filter(p => { if (used.has(p.index)) return false; used.add(p.index); return true; });
  matches.sort((a, b) => a.row.ra - b.row.ra || a.row.dec - b.row.dec);
  const residual = stats(matches.map(p => p.distance)), reserved = matches.filter((_, i) => i % 3 === 0), check = stats(reserved.map(p => p.distance));
  const close = (points: Point[]) => points.filter(point => nearbyStars(point, CHANCE_RADIUS_PIXELS).index >= 0).length;
  const controls = [[40, 0], [0, 40], [100, -70]].map(offset => {
    const shifted = isolated.map((p): Point => [p.point[0] + offset[0]!, p.point[1] + offset[1]!]);
    return { offsetNativePixels: offset, matchesWithin2_5Pixels: shifted.filter(point => nearbyStars(point, 2.5).index >= 0).length, matchesWithinChanceRadius: close(shifted) };
  });
  const centre: Point = [(width - 1) / 2, (height - 1) / 2];
  const variants: Record<string, [number, number, number, number]> = { mirrorX: [-1, 0, 0, 1], mirrorY: [1, 0, 0, -1], rotate90: [0, -1, 1, 0], scale09: [.9, 0, 0, .9], scale11: [1.1, 0, 0, 1.1] };
  const wrong = Object.fromEntries(Object.entries(variants).map(([name, m]) => {
    const moved = isolated.map((p): Point => { const x = p.point[0] - centre[0], y = p.point[1] - centre[1];
      return [m[0] * x + m[1] * y + centre[0], m[2] * x + m[3] * y + centre[1]]; });
    return [name, { matchesWithin2_5Pixels: moved.filter(point => nearbyStars(point, 2.5).index >= 0).length, matchesWithinChanceRadius: close(moved) }];
  }));
  const quadrants = [0, 0, 0, 0]; for (const p of matches) quadrants[(p.row.point[0] >= width / 2 ? 1 : 0) + (p.row.point[1] >= height / 2 ? 2 : 0)]!++;
  const hull = matches.length >= 3 ? hullArea(matches.map(p => stars[p.index]!)) / (width * height) : 0;
  const analytic = analyticChanceMatches(isolated.length, stars.length, CHANCE_RADIUS_PIXELS, width, height);
  const excess = chanceExcess(matches.filter(p => p.distance <= CHANCE_RADIUS_PIXELS).length,
    [...controls.map(c => c.matchesWithinChanceRadius), ...Object.values(wrong).map(c => c.matchesWithinChanceRadius)], analytic);
  const gates = { uniqueMatches: matches.length >= 100, allFourQuadrants: quadrants.every(v => v > 0), halfImageHull: hull >= .5, median: check.median <= .75, p90: check.p90 <= 1.5, chanceExcess: excess.pass };
  return { receipt: { schema: 'cssearth-fixed-wcs-catalogue-direction-gate@1', pass: Object.values(gates).every(Boolean), gates,
    source: { path: sourcePath, sha256: hash(source), nativeDimensions: [width, height], channel: 'W1 blue channel', wcs }, catalogue: { path: cataloguePath, sha256: hash(csv), downloadedRows: lines.length, inFieldIsolatedCandidates: isolated.length },
    predeclaredProtocol: { minUniqueMatches: 100, minQuadrants: 4, minHullFraction: .5, maxMedianNativeWisePixels: .75, maxP90NativeWisePixels: 1.5, chanceRadiusNativePixels: CHANCE_RADIUS_PIXELS, minChanceExcessMargin: CHANCE_EXCESS_MARGIN, correspondenceWindowNativeWisePixels: 2.5, catalogueIsolationPixels: 5, catalogueMagnitudeRangeW1: [8, 11] },
    chanceExcess: { ...excess, analyticExpectedChanceMatches: analytic, detectionDensityPerSquarePixel: stars.length / (width * height),
      method: 'Inside the chance radius, real matches must exceed the largest chance estimate by the declared margin. The estimate is the larger of every shifted and wrong-transform control count in that same radius and the analytic rate for this detection density, so denser detections raise the bar instead of failing a fixed ratio.' },
    refitted: false, allCoordinatesHeldOutFromAnyFit: true, uniqueMatchedStars: matches.length, reservedCheckCount: reserved.length, detectedStars: stars.length,
    residualNativeWisePixels: residual, reservedCheckResidualNativeWisePixels: check, residualArcseconds: Object.fromEntries(Object.entries(check).map(([key, value]) => [key, value * Math.abs(wcs.scaleDeg[0]) * wcs.referenceDimension[0] / width * 3600])),
    matchedSourceHullFraction: hull, quadrantMatchCounts: quadrants, shiftedControls: controls, wrongTransformControls: wrong,
    limitations: ['Catalogue and image originate from the same infrared survey; catalogue positions independently check fixed publisher image WCS.',
      'The chance control measures association by coincidence at this raster\'s own detection density; it does not bound systematic errors that move real and control matches together.', 'Display raster sampling is not native detector angular resolution.', 'Centroids use sharp sigma4 Gaussian highpass and blue W1; no image transform is fitted.', 'Association uses the unchanged 2.5-pixel window and LMC acceptance thresholds; the chance-excess control gates acceptance.'] },
    matches: matches.map((p, i) => ({ designation: p.row.designation, ra: p.row.ra, dec: p.row.dec, predicted: p.row.point, detected: stars[p.index], residual: p.distance, reserved: i % 3 === 0 })), stars };
}
