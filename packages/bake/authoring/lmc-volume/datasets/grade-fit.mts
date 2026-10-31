/** Regrade one model against another picture: register it, then fit the existing global component colors where it has data. No shape, no per-pixel term. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { approvedScene } from '../delivery/reference.mts';
import { refineFields } from '../delivery/refined-fields.mts';
import { catalogueBasis, projectCatalogue } from '../catalogue-render.mts';
import { gradedPrediction, LUMA, type Grade } from '../grade.mts';
import { loadObservation } from '../observation.mts';
import { earthCamera, loss, type Basis, type Target } from '../render.mts';
import { DEG, skyOf, unit, cross, dot, normalize, bodyToIcrs, type V3 } from '../geometry.mts';
import { need } from '../inputs.mts';
import { L37_DIR, allGasSource } from './regions.mts';

sharp.cache(false); sharp.concurrency(4);
export const GRADE_DIR = L37_DIR + 'grades/';
interface Option { id: 'decam' | 'vista'; path: string; ra: number; dec: number; widthArcmin: number; heightArcmin: number; northDeg: number; spectral: string; credit: string; }
export const OPTIONS: Record<Option['id'], Option> = {
  decam: { id: 'decam', path: 'src/objects/lmc-volume/.local/image-options/decam-smash.jpg', ra: 78.796, dec: -71.567, widthArcmin: 561, heightArcmin: 544, northDeg: 196.92, spectral: 'optical', credit: 'CTIO/NOIRLab/NSF/AURA/SMASH, CC BY 4.0' },
  // ESO's record: RA 5 25 10.58, Dec −70 04 22.75, north 2.4° right of vertical, Y J Ks.
  vista: { id: 'vista', path: 'src/objects/lmc-volume/.local/image-options/vista-vmc.jpg', ra: (5 + 25 / 60 + 10.58 / 3600) * 15, dec: -(70 + 4 / 60 + 22.75 / 3600), widthArcmin: 461.9, heightArcmin: 515.88, northDeg: -2.4, spectral: 'near infrared', credit: 'ESO/VMC survey' },
};
const CHECKS: [string, number, number][] = [['30 Doradus', 84.676, -69.101], ['N11', 74.25, -66.42], ['N44', 80.62, -67.93], ['N119', 81.38, -69.14], ['N206', 82.93, -71.08], ['N79', 72.65, -69.33], ['NGC 1850', 77.2, -68.76], ['NGC 2100', 85.54, -69.21]];
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const WORK = 3072;
interface Placement { dxArcmin: number; dyArcmin: number; rotDeg: number; scale: number; north: number; mirror: 1 | -1; }

async function workImage(o: Option) {
  const meta = await sharp(o.path, { limitInputPixels: false }).metadata(), w = WORK, h = Math.round(WORK * meta.height! / meta.width!);
  const { data } = await sharp(o.path, { limitInputPixels: false }).resize(w, h, { kernel: 'cubic' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb = new Float32Array(w * h * 3); for (let i = 0; i < rgb.length; i++) rgb[i] = linear(data[i]! / 255);
  return { rgb, w, h };
}
/** The image's pixel for a sky direction: a gnomonic plane about its centre, turned by its orientation. */
function pixelOf(o: Option, p: Placement, w: number, h: number, ra: number, dec: number): [number, number] {
  const c = unit(o.ra, o.dec), east = normalize(cross([0, 0, 1], c)), north = cross(c, east), v = unit(ra, dec), z = dot(v, c), x = dot(v, east) / z / DEG * 60, y = dot(v, north) / z / DEG * 60;
  const t = (p.north + p.rotDeg) * DEG, X = (p.mirror * x * Math.cos(t) - y * Math.sin(t)) * p.scale + p.dxArcmin, Y = (p.mirror * x * Math.sin(t) + y * Math.cos(t)) * p.scale + p.dyArcmin;
  return [w / 2 + (-X) * w / o.widthArcmin, h / 2 - Y * h / o.heightArcmin];
}
function sampler(image: { rgb: Float32Array; w: number; h: number }) { return (x: number, y: number, c: number) => { const i = Math.floor(x), j = Math.floor(y); return i < 0 || j < 0 || i >= image.w || j >= image.h ? NaN : image.rgb[(j * image.w + i) * 3 + c]!; }; }

export async function earthBasis() {
  const path = GRADE_DIR + 'earth-basis.f64le', { scene, amplitudes, grade, cfg } = { ...(await approvedScene()) } as Awaited<ReturnType<typeof approvedScene>> & { cfg?: unknown }; void cfg;
  const o = await loadObservation(8), camera = earthCamera(o.width, o.height, o.rayAt, o.pixelOf);
  const saved = await readFile(path).catch(() => null); let planes: Float64Array[];
  if (saved) { const all = new Float64Array(Uint8Array.from(saved).buffer), n = o.width * o.height * 3; planes = Array.from({ length: 5 }, (_, k) => all.slice(k * n, (k + 1) * n)); }
  else { await refineFields(scene); const b = catalogueBasis(projectCatalogue(scene, camera, .015, undefined, undefined, { objectSubpixels: 4, cacheFinishedDust: true, gaussianTailSigma: 10 }), scene, amplitudes); planes = b.planes; const out = new Float64Array(planes.length * planes[0]!.length); planes.forEach((p, k) => out.set(p, k * p.length)); await writeFile(path, Buffer.from(out.buffer)); }
  const basis: Basis = { width: o.width, height: o.height, planes, dustGain: 1 };
  return { basis, rayAt: o.rayAt, grade };
}

export async function fitArm(id: Option['id']) {
  const o = OPTIONS[id], image = await workImage(o), { basis, rayAt, grade } = await earthBasis(), { width, height } = basis, model = gradedPrediction(basis, grade), sample = sampler(image);
  const sky = Array.from({ length: width * height }, (_, p) => skyOf(normalize(rayAt(p % width + .5, Math.floor(p / width) + .5) as V3)));
  const lumaModel = Float64Array.from({ length: width * height }, (_, p) => dot([model[p * 3]!, model[p * 3 + 1]!, model[p * 3 + 2]!], LUMA));
  const score = (place: Placement) => { let n = 0, a = 0, b = 0, aa = 0, bb = 0, ab = 0; for (let p = 0; p < sky.length; p += 7) { const [x, y] = pixelOf(o, place, image.w, image.h, sky[p]![0], sky[p]![1]), v = sample(x, y, 1); if (!(v > .002)) continue; const m = lumaModel[p]!; n++; a += m; b += v; aa += m * m; bb += v * v; ab += m * v; } if (n < 200) return -1; const r = (ab - a * b / n) / Math.sqrt(Math.max(1e-12, (aa - a * a / n) * (bb - b * b / n))); return r; };
  // The record's orientation may be stated either way round; the picture decides.
  let best: Placement = { dxArcmin: 0, dyArcmin: 0, rotDeg: 0, scale: 1, north: o.northDeg, mirror: 1 }, bestR = -2, tried: { north: number; mirror: number; r: number }[] = [];
  for (const north of [o.northDeg, -o.northDeg, o.northDeg + 180, 180 - o.northDeg]) for (const mirror of [1, -1] as const) { const place = { ...best, north, mirror }, r = score(place); tried.push({ north, mirror, r: +r.toFixed(3) }); if (r > bestR) { bestR = r; best = place; } }
  for (const step of [8, 4, 2, 1, .5, .25]) { let moved = true; while (moved) { moved = false; for (const change of [{ dxArcmin: step }, { dxArcmin: -step }, { dyArcmin: step }, { dyArcmin: -step }, { rotDeg: step / 4 }, { rotDeg: -step / 4 }, { scale: step / 400 }, { scale: -step / 400 }] as Partial<Placement>[]) { const t: Placement = { ...best }; for (const k of Object.keys(change) as (keyof Placement)[]) (t[k] as number) += change[k] as number; const r = score(t); if (r > bestR + 1e-5) { best = t; bestR = r; moved = true; } } } }
  // Residuals on named objects: the light peak near where the registered picture says each one is.
  const arcminPerPixel = o.widthArcmin / image.w, windowPx = Math.round(6 / arcminPerPixel), residuals: Record<string, number | string> = {}; let worst = 0;
  for (const [name, ra, dec] of CHECKS) { const [cx, cy] = pixelOf(o, best, image.w, image.h, ra, dec); if (!(cx >= 0 && cy >= 0 && cx < image.w && cy < image.h)) { residuals[name] = 'outside'; continue; }
    let s = 0, sx = 0, sy = 0, peak = 0; for (let y = -windowPx; y <= windowPx; y++) for (let x = -windowPx; x <= windowPx; x++) { const v = sample(cx + x, cy + y, 0); if (v > peak) peak = v; } for (let y = -windowPx; y <= windowPx; y++) for (let x = -windowPx; x <= windowPx; x++) { const v = sample(cx + x, cy + y, 0); if (v > .5 * peak) { s += v; sx += v * x; sy += v * y; } }
    const off = s ? Math.hypot(sx / s, sy / s) * arcminPerPixel : NaN; residuals[name] = +off.toFixed(2); if (off > worst) worst = off; }
  // Target: linear light above the picture's own dark sky, only where it holds data; star peaks left out.
  const target = new Float64Array(width * height * 3), train = new Uint8Array(width * height), floor = [0, 1, 2].map(c => { const v: number[] = []; for (let i = c; i < image.rgb.length; i += 3 * 9) if (image.rgb[i]! > .0005) v.push(image.rgb[i]!); v.sort((a, b) => a - b); return v[Math.floor(v.length * .05)] ?? 0; });
  for (let p = 0; p < sky.length; p++) { const [x, y] = pixelOf(o, best, image.w, image.h, sky[p]![0], sky[p]![1]), v = [0, 1, 2].map(c => sample(x, y, c)); if (v.every(n => n > .0005) && x > 8 && y > 8 && x < image.w - 8 && y < image.h - 8) { train[p] = 1; for (let c = 0; c < 3; c++) target[p * 3 + c] = Math.max(0, v[c]! - floor[c]!); } }
  const lumas = Array.from({ length: sky.length }, (_, p) => train[p] ? dot([target[p * 3]!, target[p * 3 + 1]!, target[p * 3 + 2]!], LUMA) : NaN).filter(Number.isFinite).sort((a, b) => a - b), top = lumas[Math.floor(lumas.length * .995)]!;
  for (let p = 0; p < sky.length; p++) { const y = dot([target[p * 3]!, target[p * 3 + 1]!, target[p * 3 + 2]!], LUMA); if (train[p] && y > top) train[p] = 0; }
  const t: Target = { data: target, train, holdout: new Uint8Array(train.length) };
  // Few values: one gain per component and one global tint. The Horálek tints stay, so a survey's stretched sky cannot turn the old stars blue.
  const compose = (x: number[]): Grade => ({ ...grade, coefficients: grade.coefficients.map((v, k) => [v[0] * x[k]! * x[4]!, v[1] * x[k]!, v[2] * x[k]! * x[5]!] as V3) });
  const trainSum = (a: Float64Array, c: number) => { let n = 0; for (let p = 0; p < train.length; p++) if (train[p]) n += a[p * 3 + c]!; return n; };
  const wants = [0, 1, 2].map(c => trainSum(target, c));
  const objective = (x: number[]) => { const q = gradedPrediction(basis, compose(x)); return loss(q, t) ** 2 + [0, 1, 2].reduce((n, c) => n + .25 * Math.log(Math.max(1e-12, trainSum(q, c) / wants[c]!)) ** 2, 0); };
  let x = [1, 1, 1, 1, 1, 1], value = objective(x);
  for (const step of [.3, .15, .07, .03]) for (let round = 0; round < 3; round++) for (let k = 0; k < x.length; k++) for (const sign of [-1, 1]) { const trial = [...x]; trial[k] = Math.max(.1, Math.min(4, trial[k]! * (1 + sign * step))); const v = objective(trial); if (v < value) { value = v; x = trial; } }
  const graded = { ...compose(x), score: loss(gradedPrediction(basis, compose(x)), t) }, fitted = graded, after = gradedPrediction(basis, graded); let lm = 0, lt = 0, bm = 0; for (let p = 0; p < train.length; p++) if (train[p]) { lm += dot([after[p * 3]!, after[p * 3 + 1]!, after[p * 3 + 2]!], LUMA); lt += dot([target[p * 3]!, target[p * 3 + 1]!, target[p * 3 + 2]!], LUMA); bm += lumaModel[p]!; }
  // Regions: where the picture holds them, by their light-weighted centre.
  const { regions } = await allGasSource(), outside: string[] = [], gap: string[] = []; let lit = 0;
  for (const r of regions) { const L = r.emitters.reduce((n, e) => n + e.object.weight * e.amplitude, 0); if (!(L > 0)) continue; lit++; const c = [0, 1, 2].map(k => r.emitters.reduce((n, e) => n + e.object.weight * e.amplitude * e.object.center[k]!, 0) / L) as V3, [ra, dec] = skyOf(bodyToIcrs(c) as V3), [x, y] = pixelOf(o, best, image.w, image.h, ra, dec); if (!(x >= 0 && y >= 0 && x < image.w && y < image.h)) outside.push(r.label); else if (!(sample(x, y, 0) + sample(x, y, 1) + sample(x, y, 2) > .0015)) gap.push(r.label); }
  const mean = (a: Float64Array, c: number) => { let s = 0, n = 0; for (let p = 0; p < train.length; p++) if (train[p]) { s += a[p * 3 + c]!; n++; } return s / n; };
  const channel = [0, 1, 2].map(c => mean(after, c) / Math.max(1e-12, mean(model, c)));
  const names = ['disc', 'bar', 'young', 'gas'], componentChange = Object.fromEntries(names.map((n, k) => { const a = grade.coefficients[k]!, b = graded.coefficients[k]!, ga = (a[0] + a[1] + a[2]) / 3, gb = (b[0] + b[1] + b[2]) / 3; return [n, { gain: +(gb / ga).toFixed(3), tintBefore: a.map(v => +(v / ga).toFixed(3)), tintAfter: b.map(v => +(v / Math.max(gb, 1e-9)).toFixed(3)) }]; }));
  const result = { targetSize: [width, height], fitValues: { disc: x[0], bar: x[1], young: x[2], gas: x[3], redTint: x[4], blueTint: x[5] }, id, spectral: o.spectral, credit: o.credit, placement: best, tried, correlation: +bestR.toFixed(3), residualsArcmin: residuals, worstResidualArcmin: +worst.toFixed(2), trainShare: +(train.reduce((n, v) => n + v, 0) / train.length).toFixed(3), lit, outside, gap, grade: graded, wholeLightModelOverImage: +(lm / lt).toFixed(3), wholeLightHoralekOverImage: +(bm / lt).toFixed(3), channelGains: channel, componentChange, score: fitted.score };
  await mkdir(GRADE_DIR, { recursive: true }); const linearY = new Float32Array(train.length); for (let p = 0; p < train.length; p++) linearY[p] = train[p] ? dot([target[p * 3]!, target[p * 3 + 1]!, target[p * 3 + 2]!], LUMA) : -1; await writeFile(GRADE_DIR + id + '-target.f32le', Buffer.from(linearY.buffer));
  await writeFile(GRADE_DIR + id + '.json', JSON.stringify(result, null, 1) + '\n');
  console.log('GRADE_FIT ' + JSON.stringify({ ...result, grade: undefined, outside: outside.length, gap: gap.length, outsideSample: outside.slice(0, 8), gapSample: gap.slice(0, 8) }));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { const id = process.argv[2]; need(id === 'decam' || id === 'vista', 'Choose decam or vista'); await fitArm(id); }
