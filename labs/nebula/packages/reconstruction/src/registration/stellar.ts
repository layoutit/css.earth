import { applyAffine, type Affine, type Point } from './affine.ts';
/** Offline point-source registration. All coordinates are raster pixel edges (centres at n + .5). */
import sharp from 'sharp';
import { wcsPixelRay, type ImageWcs } from '@cssearth/volume-core/coordinates/overlay-wcs';
import { registrationOverlap, type ReferenceFootprint } from './overlap.ts';
export interface Star { point: Point; peak: number }
export interface Pair { source: Point; frame: Point; sourceIndex: number; referenceIndex: number }
export interface SkyRaster { width: number; height: number; fieldArcminutes: Point; centerIcrsDegrees: Point; northRightDegrees: number; wcs?: ImageWcs }
export interface SkyFrame { width: number; height: number; fieldArcminutes: Point; centerIcrsDegrees: Point; northUp: true }
export function publisherTransform(source: SkyRaster, frame: SkyFrame): Affine {
  if (source.wcs) {
    const wcs = source.wcs, rad = Math.PI / 180, a = frame.centerIcrsDegrees[0] * rad, d = frame.centerIcrsDegrees[1] * rad;
    const normal = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
    const project = (point: Point): Point => {
      const ray = wcsPixelRay(wcs, point[0] * wcs.referenceDimension[0] / source.width + .5,
        wcs.referenceDimension[1] + .5 - point[1] * wcs.referenceDimension[1] / source.height);
      const dot = (v: number[]) => v.reduce((sum, n, i) => sum + n * ray[i]!, 0), denominator = dot(normal);
      if (denominator <= 0) throw new Error('Source WCS points away from the observation frame.');
      return [frame.width / 2 - dot(east) / denominator / rad * 60 * frame.width / frame.fieldArcminutes[0],
        frame.height / 2 - dot(north) / denominator / rad * 60 * frame.height / frame.fieldArcminutes[1]];
    };
    const p = project([0, 0]), x = project([source.width, 0]), y = project([0, source.height]);
    return [(x[0] - p[0]) / source.width, (x[1] - p[1]) / source.width,
      (y[0] - p[0]) / source.height, (y[1] - p[1]) / source.height, p[0], p[1]];
  }
  const rad = Math.PI / 180, theta = -source.northRightDegrees * rad;
  const sx = source.fieldArcminutes[0] / source.width * frame.width / frame.fieldArcminutes[0];
  const sy = source.fieldArcminutes[1] / source.height * frame.height / frame.fieldArcminutes[1];
  const deltaRa = (source.centerIcrsDegrees[0] - frame.centerIcrsDegrees[0]) * rad;
  const dec = source.centerIcrsDegrees[1] * rad, dec0 = frame.centerIcrsDegrees[1] * rad;
  const denominator = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(deltaRa);
  if (denominator <= 0) throw new Error('Image points away from the common tangent plane.');
  const east = Math.cos(dec) * Math.sin(deltaRa) / denominator / rad * 60;
  const north = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(deltaRa)) / denominator / rad * 60;
  const m: Affine = [sx * Math.cos(theta), sx * Math.sin(theta), -sy * Math.sin(theta), sy * Math.cos(theta), 0, 0];
  m[4] = frame.width / 2 - east * frame.width / frame.fieldArcminutes[0] - m[0] * source.width / 2 - m[2] * source.height / 2;
  m[5] = frame.height / 2 - north * frame.height / frame.fieldArcminutes[1] - m[1] * source.width / 2 - m[3] * source.height / 2;
  return m;
}

/** A positive Gaussian high-pass rejects smooth nebular emission before finding compact maxima. */
export async function detectStars(source: Buffer, native: Point, workingMaximum = 2048, maximumStars = 6000): Promise<Star[]> {
  const { data: gray, info } = await sharp(source).removeAlpha().resize({ width: workingMaximum, height: workingMaximum, fit: 'inside', withoutEnlargement: true })
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const blurred = await sharp(gray, { raw: { width, height, channels: 1 } }).blur(3).greyscale().raw().toBuffer();
  if (gray.length !== width * height || blurred.length !== gray.length) throw new Error('Star high-pass raster channels differ.');
  const high = Float32Array.from(gray, (value, i) => Math.max(0, value - blurred[i]!));
  const found: Star[] = [];
  for (let y = 5; y < height - 5; y++) for (let x = 5; x < width - 5; x++) {
    const peak = high[y * width + x]!;
    if (peak < 9) continue;
    let local = true;
    for (let dy = -3; dy <= 3 && local; dy++) for (let dx = -3; dx <= 3; dx++) {
      const other = high[(y + dy) * width + x + dx]!;
      if (other > peak || (other === peak && (dy < 0 || (dy === 0 && dx < 0)))) { local = false; break; }
    }
    if (!local) continue;
    let weight = 0, cx = 0, cy = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const w = high[(y + dy) * width + x + dx]!;
      weight += w; cx += w * dx; cy += w * dy;
    }
    found.push({ point: [(x + cx / weight + .5) * native[0] / width, (y + cy / weight + .5) * native[1] / height], peak });
  }
  return found.sort((a, b) => b.peak - a.peak).slice(0, maximumStars);
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function nearest(point: Point, candidates: Point[], maximum: number): number {
  let index = -1, best = maximum;
  for (let i = 0; i < candidates.length; i++) { const d = distance(point, candidates[i]!); if (d < best) { best = d; index = i; } }
  return index;
}

/** Reciprocal positions plus neighbouring constellations identify stars before partitioning fit/holdout. */
export function matchStars(source: Star[], reference: Star[], sourceToFrame: Affine, referenceToFrame: Affine): Pair[] {
  const sp = source.map(star => applyAffine(sourceToFrame, star.point));
  const rp = reference.map(star => applyAffine(referenceToFrame, star.point));
  const pairs: Pair[] = [];
  for (let i = 0; i < sp.length; i++) {
    const j = nearest(sp[i]!, rp, 2.5);
    if (j < 0 || nearest(rp[j]!, sp, 2.5) !== i) continue;
    let neighbours = 0;
    for (let k = 0; k < sp.length; k++) {
      const d = distance(sp[k]!, sp[i]!);
      if (d < 2 || d > 18) continue;
      const expected: Point = [rp[j]![0] + sp[k]![0] - sp[i]![0], rp[j]![1] + sp[k]![1] - sp[i]![1]];
      if (nearest(expected, rp, .4) >= 0) neighbours++;
      if (neighbours >= 6) break;
    }
    if (neighbours >= 6) pairs.push({ source: source[i]!.point, frame: rp[j]!, sourceIndex: i, referenceIndex: j });
  }
  return pairs;
}

function solve3(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((row, i) => [...row, values[i]!]);
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(rows[r]![c]!) > Math.abs(rows[pivot]![c]!)) pivot = r;
    [rows[c], rows[pivot]] = [rows[pivot]!, rows[c]!];
    const divisor = rows[c]![c]!;
    if (Math.abs(divisor) < 1e-10) throw new Error('Degenerate star configuration.');
    for (let k = c; k < 4; k++) rows[c]![k]! /= divisor;
    for (let r = 0; r < 3; r++) if (r !== c) { const gain = rows[r]![c]!; for (let k = c; k < 4; k++) rows[r]![k]! -= gain * rows[c]![k]!; }
  }
  return rows.map(row => row[3]!);
}
export function fitAffine(pairs: Pair[]): Affine {
  if (pairs.length < 3) throw new Error('At least three matched stars required.');
  const normal = Array.from({ length: 3 }, () => [0, 0, 0]), vx = [0, 0, 0], vy = [0, 0, 0];
  for (const pair of pairs) {
    const p = [pair.source[0], pair.source[1], 1];
    for (let r = 0; r < 3; r++) { vx[r]! += p[r]! * pair.frame[0]; vy[r]! += p[r]! * pair.frame[1];
      for (let c = 0; c < 3; c++) normal[r]![c]! += p[r]! * p[c]!; }
  }
  const x = solve3(normal, vx), y = solve3(normal, vy);
  return [x[0]!, y[0]!, x[1]!, y[1]!, x[2]!, y[2]!];
}

export function verifyRegistration(pairs: Pair[], source: SkyRaster, frame: SkyFrame, initial: Affine, reference?: ReferenceFootprint) {
  if (pairs.length < 45) throw new Error(`Registration impasse: only ${pairs.length} independently matched stars (need 45).`);
  const ordered = [...pairs].sort((a, b) => Math.floor(a.source[1] / source.height * 5) - Math.floor(b.source[1] / source.height * 5) || a.source[0] - b.source[0]);
  const train = ordered.filter((_, i) => i % 3 !== 0), heldOut = ordered.filter((_, i) => i % 3 === 0);
  let seed = 7293, best: Pair[] = [];
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let round = 0; round < 500; round++) {
    const sample = Array.from({ length: 3 }, () => train[Math.floor(random() * train.length)]!);
    try {
      const m = fitAffine(sample), inliers = train.filter(pair => distance(applyAffine(m, pair.source), pair.frame) < .65);
      if (inliers.length > best.length) best = inliers;
    } catch { /* Repeated/collinear samples cannot define an affine fit. */ }
  }
  if (best.length < 30) throw new Error(`Registration impasse: only ${best.length} consistent training stars.`);
  const matrix = fitAffine(best);
  const residuals = heldOut.map(pair => distance(applyAffine(matrix, pair.source), pair.frame));
  const rmsPixels = Math.sqrt(residuals.reduce((sum, d) => sum + d * d, 0) / residuals.length);
  const maxResidualPixels = Math.max(...residuals);
  const overlap = registrationOverlap(source.width, source.height, initial, reference);
  const min = [Math.min(...overlap.map(p => p[0])), Math.min(...overlap.map(p => p[1]))];
  const max = [Math.max(...overlap.map(p => p[0])), Math.max(...overlap.map(p => p[1]))];
  const cells = new Set(heldOut.map(pair => `${pair.source[0] >= (min[0]! + max[0]!) / 2 ? 1 : 0},${pair.source[1] >= (min[1]! + max[1]!) / 2 ? 1 : 0}`));
  const spanX = (Math.max(...heldOut.map(p => p.source[0])) - Math.min(...heldOut.map(p => p.source[0]))) / (max[0]! - min[0]!);
  const spanY = (Math.max(...heldOut.map(p => p.source[1])) - Math.min(...heldOut.map(p => p.source[1]))) / (max[1]! - min[1]!);
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  const initialDeterminant = initial[0] * initial[3] - initial[1] * initial[2];
  const relativeScale = Math.sqrt(determinant / initialDeterminant);
  const centreShiftPixels = distance(applyAffine(matrix, [source.width / 2, source.height / 2]), applyAffine(initial, [source.width / 2, source.height / 2]));
  const pass = rmsPixels < .5 && maxResidualPixels < 1.5 && cells.size === 4 && spanX > .45 && spanY > .45 && Math.abs(relativeScale - 1) < .025 && centreShiftPixels < 5;
  const evidence = { status: pass ? 'verified' as const : 'publisher' as const, matchedStars: pairs.length,
    trainingStars: best.length, trainingCandidates: train.length, rejectedTrainingStars: train.length - best.length,
    heldOutStars: heldOut.length, rmsPixels, maxResidualPixels,
    spatialQuadrants: cells.size, coverageFraction: [spanX, spanY], relativeScale, centreShiftPixels,
    coverageDomain: { kind: reference ? 'common-observed-footprint' : 'complete-source', sourcePixelPolygon: overlap },
    residualArcseconds: rmsPixels * frame.fieldArcminutes[0] * 60 / frame.width,
    matches: ordered.map((pair, index) => ({ source: pair.source, frame: pair.frame, predictedFrame: applyAffine(matrix, pair.source),
      heldOut: index % 3 === 0, fitInlier: best.includes(pair), residualPixels: distance(applyAffine(matrix, pair.source), pair.frame) })),
    interpretation: 'Relative field-star alignment to the configured reference image; absolute sky scale and orientation remain publisher metadata. No stellar membership or physical depth.',
  };
  return { matrix, evidence, pass };
}

/** An inspectable footprint is not a successful registration or a processing input. */
export function publisherRegistration(reason: string): ReturnType<typeof verifyRegistration>['evidence'] {
  return { status: 'publisher', matchedStars: 0, trainingStars: 0, trainingCandidates: 0, rejectedTrainingStars: 0,
    heldOutStars: 0, rmsPixels: 0, maxResidualPixels: 0, spatialQuadrants: 0, coverageFraction: [0, 0],
    relativeScale: 1, centreShiftPixels: 0, coverageDomain: { kind: 'complete-source', sourcePixelPolygon: [] },
    residualArcseconds: 0, matches: [], interpretation: reason };
}
