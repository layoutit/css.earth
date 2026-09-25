/**
 * Fixed-point tone match of one finite lens against its own image (nebula-lab skill, "Matching a lens to
 * its image").
 *
 *   node labs/nebula/run.mts lens-tone-fit <lensResultId> [--delivery-loss 0.12] [--max-bakes 3]
 *     [--solve-exposure [--recipe <model settings.json>]] [--model <modelResultId>]
 *
 * Each round: measure (GET /__nebula/reconstruction-levels plus the same measurement in process, split into a
 * fit half and a held-out half) → fit LUT_{k+1} = C_k ∘ LUT_k from the fit half's paired pixels → re-bake only
 * this lens with that curve → measure the new result. The objective covers the whole range: flux, per-channel
 * p50/p90/p99/p99.9, the core-disc mean, signed delta and chroma angle, each against the tolerance below.
 * Stops inside it, when the score improves by less than EPSILON, when a parameter pins (the lens is then
 * unreachable without a per-lens opacity), when the faint zone or the held-out half gets worse, or after
 * `--max-bakes` (the first bake on a new model counts).
 *
 * Exposure. The render never exceeds the projection byte 255·(1 − e^(−E·I)), so a core riding that shoulder
 * cannot be lifted by the curve. `--solve-exposure` solves E jointly with the curve on the exposure-free
 * integral I (analytic re-exposure, curve re-fitted per candidate; no bakes), writes it into the model's
 * settings recipe, re-bakes the model once (its emission field and envelope must come out byte-identical),
 * then bakes this lens on it with the predicted curve. Exposure is shared by every lens of the geometry;
 * `--model <id>` moves any other lens onto that re-exposed model, seeding its curve the same way.
 *
 * Delivery loss: the measurement's render side is analytic and reads ~12% brighter than the delivered bank,
 * so the target is the sky-removed image × (1 + loss). A uniform factor is an approximation — measured against
 * a browser capture, delivered ÷ analytic is 0.90–0.92 from source level 144 up but 0.6–0.8 in the faint
 * mid-tones — so the faint zone is judged separately, on the baked textures.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { bakeFiniteLens } from '../../server/workflows/density/finite-lens.ts';
import { readPreparedReconstruction } from '../../server/services/density-reconstruction.ts';
import { lensLevels, loadLensLevelGrid } from '../../server/services/lens-levels.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { ceilingShare, composeToneCurve, coreDisc, fitCorrection, highlightExposureBound, identityToneCurve, pairedPixels, pinnedShare,
  predictToneCurve, reexposeProjection, solveExposure, splitFootprint, toneScore, TOLERANCE, type CoreDisc } from './lens-tone-fitting.ts';
import type { LensToneCurve } from '@cssearth/bake/volume';

export { TOLERANCE };
/** Score is in tolerance units, so EPSILON is a twentieth of a tolerance band. */
const EPSILON = .05, PIN_LIMIT = .05, BANDING_LIMIT = 1.1, SHARE_SLACK = .005;

const root = process.cwd(), args = process.argv.slice(2);
const option = (name: string, fallback: number) => { const i = args.indexOf(name); const v = i >= 0 ? Number(args[i + 1]) : fallback; if (!Number.isFinite(v)) throw TypeError(`Invalid ${name}`); return v; };
const text = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const startId = args.find(a => /^[a-f0-9]{64}$/.test(a) && args[args.indexOf(a) - 1] !== '--model');
if (!startId) throw TypeError('Usage: lens-tone-fit <lensResultId> [--delivery-loss 0.12] [--max-bakes 3] [--solve-exposure [--recipe <settings.json>]] [--model <modelResultId>] [--server http://127.0.0.1:4331]');
const loss = option('--delivery-loss', .12), maxBakes = option('--max-bakes', 3), scale = 1 + loss;
const server = text('--server') ?? 'http://127.0.0.1:4331', recipePath = text('--recipe'), modelOption = text('--model');
const solving = args.includes('--solve-exposure');
if (modelOption !== undefined && !/^[a-f0-9]{64}$/.test(modelOption)) throw TypeError('--model takes a 64-hex model result id');
if (solving && modelOption) throw TypeError('--solve-exposure makes the model; --model moves a lens onto one. Use one.');

/** The delivered faint zone, from the baked textures themselves: alpha 1–3 share and tint, alpha 1–8 roughness. */
async function bankGuards(directory: string) {
  const slices = parseLabModelJson(await readFile(resolve(directory, 'prepared/volume-slices.json'), 'utf8'));
  let lit = 0, faint = 0, saturation = 0, roughness = 0, rough = 0;
  for (const quad of slices.quads) {
    if (!(quad.alphaCoverage > 0)) continue;
    const { data, info } = await sharp(resolve(directory, 'prepared', quad.texturePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, luma = new Float64Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const a = data[p * 4 + 3]!, r = data[p * 4]!, g = data[p * 4 + 1]!, b = data[p * 4 + 2]!;
      luma[p] = .2126 * Math.round(a * r / 255) + .7152 * Math.round(a * g / 255) + .0722 * Math.round(a * b / 255);
      if (a > 0) lit++;
      if (a >= 1 && a <= 3) { faint++; const max = Math.max(r, g, b); saturation += max > 0 ? (max - Math.min(r, g, b)) / max : 0; }
    }
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const p = j * w + i, a = data[p * 4 + 3]!;
      if (a < 1 || a > 8) continue;
      roughness += Math.abs(luma[p]! - (luma[p - 1]! + luma[p + 1]! + luma[p - w]! + luma[p + w]!) / 4); rough++;
    }
  }
  return { alpha13Share: +(faint / Math.max(1, lit)).toFixed(4), alpha13Saturation: +(saturation / Math.max(1, faint)).toFixed(4),
    faintRoughness: +(roughness / Math.max(1, rough)).toFixed(4) };
}
type Guards = Awaited<ReturnType<typeof bankGuards>>;
/** Names the faint-zone guard a bank breaks against the starting lens, or null. */
function faintWorse(next: Guards, start: Guards): string | null {
  if (next.alpha13Share > start.alpha13Share + SHARE_SLACK) return `alpha 1–3 share ${start.alpha13Share} → ${next.alpha13Share}`;
  if (next.alpha13Saturation > start.alpha13Saturation * BANDING_LIMIT + .005) return `alpha 1–3 tint ${start.alpha13Saturation} → ${next.alpha13Saturation}`;
  if (next.faintRoughness > start.faintRoughness * BANDING_LIMIT) return `faint roughness ${start.faintRoughness} → ${next.faintRoughness}`;
  return null;
}

let core: CoreDisc | null = null;
async function measure(id: string) {
  const prepared = await readPreparedReconstruction(root, id);
  const response = await fetch(`${server}/__nebula/reconstruction-levels?resultId=${id}`);
  const served = await response.json() as { flux?: { percent: number }; error?: string };
  if (!response.ok || !served.flux) throw Error(`Levels endpoint failed for ${id}: ${served.error ?? response.status}`);
  const local = await lensLevels(root, prepared);
  // A lab server started before this lens's tone curve existed measures without it; the in-process
  // measurement is the same function on the same pinned files, so it is authoritative and the gap is reported.
  const endpointCurrent = Math.abs(local.flux.percent - served.flux.percent) < 1e-9;
  const { grid, material } = await loadLensLevelGrid(root, prepared);
  // One core disc for the whole run: the lens image and the projection grid are the same on every model.
  core ??= coreDisc(grid);
  const halves = splitFootprint(grid.mask, grid.width, grid.height);
  return { prepared, grid, material, halves, exposure: (await modelSettings(prepared.finiteMaterial!.modelResultId)).exposureGain,
    endpoint: { flux: +served.flux.percent.toFixed(2), current: endpointCurrent },
    full: toneScore(grid, material, grid.mask, scale, core), heldOut: toneScore(grid, material, halves.heldOut, scale, core),
    guards: await bankGuards(resolve(root, prepared.subject.directory)) };
}
type State = Awaited<ReturnType<typeof measure>>;

async function modelSettings(modelResultId: string) {
  const provenance = parseLabModelJson(await readFile(resolve(root, '.local/nebula-lab/reconstructions', modelResultId, 'source/provenance.json'), 'utf8'));
  const settings = provenance.material?.settings;
  if (!settings || !(Number(settings.exposureGain) > 0)) throw Error(`Model ${modelResultId} records no exposure`);
  return settings as Record<string, unknown> & { exposureGain: number };
}
/** Re-bake the shared geometry at a new exposure through its own settings recipe; returns the new model id. */
async function bakeModel(fromModel: string, path: string, exposure: number): Promise<string> {
  const recipe = parseLabModelJson(await readFile(resolve(root, path), 'utf8')), pinned = await modelSettings(fromModel);
  const without = (value: Record<string, unknown>) => JSON.stringify({ ...value, exposureGain: null });
  if (without(recipe) !== without(pinned)) throw Error(`${path} is not the recipe of model ${fromModel} (settings differ beyond exposureGain)`);
  const original = await readFile(resolve(root, path));
  await writeFile(resolve(root, path), JSON.stringify({ ...recipe, exposureGain: exposure }, null, 2) + '\n');
  const run = spawnSync(process.execPath, ['labs/nebula/run.mts', 'simulation-guided-reconstruction', path], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (run.status !== 0) { await writeFile(resolve(root, path), original); throw Error(`Model bake failed: ${run.stderr.slice(-2000)}`); }
  const last = run.stdout.trim().split('\n').reverse().map(line => { try { return JSON.parse(line) as { resultId?: string; output?: string }; } catch { return null; } })
    .find(line => line?.resultId && line.output);
  if (!last?.resultId) throw Error('Model bake printed no result id');
  // The exposure-free emission must not move: only the display transfer may differ between the two models.
  for (const file of ['source/emission-field.json', 'source/envelope.json', 'source/depth-assignments.json']) {
    const [a, b] = await Promise.all([fromModel, last.resultId].map(id => readFile(resolve(root, '.local/nebula-lab/reconstructions', id, file)).catch(() => null)));
    if (!a !== !b || (a && b && !a.equals(b))) throw Error(`Re-exposed model changed ${file}; exposure is not the only difference`);
  }
  return last.resultId;
}
async function bakeLens(state: State, modelResultId: string, curve: LensToneCurve) {
  const finite = state.prepared.finiteMaterial!;
  const provenance = parseLabModelJson(await readFile(resolve(root, state.prepared.subject.directory, 'source/provenance.json'), 'utf8'));
  return bakeFiniteLens(root, { modelResultId, sourceResultId: finite.sourceResultId,
    ...(provenance.finiteMaterial?.channelGain ? { channelGain: provenance.finiteMaterial.channelGain } : {}), toneCurve: curve },
  undefined, p => { if (p.current % 96 === 0) console.log(p.message); });
}

const log: unknown[] = [];
let state = await measure(startId), bakes = 0, verdict = 'max-bakes';
const start = state, startModel = state.prepared.finiteMaterial!.modelResultId;
const report = (round: number, s: State, extra: Record<string, unknown> = {}) => {
  const row = { round, resultId: s.prepared.resultId, model: s.prepared.finiteMaterial!.modelResultId, exposure: s.exposure,
    endpointFlux: s.endpoint.flux, endpointCurrent: s.endpoint.current, full: s.full, heldOut: s.heldOut, guards: s.guards, ...extra };
  log.push(row); console.log(JSON.stringify(row));
};
report(0, state);

// Move onto a re-exposed model: solve it here, or take one another lens already solved.
let exposure: Record<string, unknown> | null = null, targetModel = startModel, seed: LensToneCurve | null = null;
if (solving) {
  const bound = highlightExposureBound(state.grid, scale);
  const upper = Math.min(4, Math.max(2, 1.5 * bound)), solved = solveExposure(state.grid, state.material.channelGain, state.halves, scale, core!, .5, upper);
  const next = +(state.exposure * solved.k).toFixed(3);
  exposure = { from: state.exposure, to: next, ratio: +solved.k.toFixed(4), highlightBound: +bound.toFixed(4), bracket: [.5, +upper.toFixed(3)],
    predicted: { full: solved.full, heldOut: solved.heldOut, ceilingShare: +solved.ceilingShare.toFixed(4), pinnedShare: +solved.pinnedShare.toFixed(4) } };
  console.log(JSON.stringify({ exposure }));
  if (solved.ceilingShare > PIN_LIMIT || solved.pinnedShare > PIN_LIMIT) verdict = 'unreachable without per-lens opacity (predicted at the solved exposure)';
  else if (!(solved.full.score < state.full.score - EPSILON)) verdict = 'exposure kept: the solve predicts no improvement';
  else if (!recipePath) verdict = 'prediction only: pass --recipe <model settings> to re-bake the model';
  else { targetModel = await bakeModel(startModel, recipePath, next); seed = solved.curve; exposure.model = targetModel; }
} else if (modelOption && modelOption !== startModel) {
  const ratio = (await modelSettings(modelOption)).exposureGain / state.exposure;
  const exposed = { ...state.grid, projection: reexposeProjection(state.grid.projection, ratio) };
  const fit = predictToneCurve(exposed, state.material.channelGain, state.halves.fit, scale, 6, identityToneCurve(8));
  exposure = { from: state.exposure, to: state.exposure * ratio, ratio: +ratio.toFixed(4), model: modelOption,
    predicted: { full: toneScore(exposed, { channelGain: state.material.channelGain, toneCurve: fit.curve }, state.grid.mask, scale, core!),
      ceilingShare: +fit.ceilingShare.toFixed(4), pinnedShare: +fit.pinnedShare.toFixed(4) } };
  console.log(JSON.stringify({ exposure }));
  targetModel = modelOption; seed = fit.curve;
}
if (seed && targetModel !== startModel) {
  const result = await bakeLens(state, targetModel, seed);
  bakes++;
  const next = await measure(result.resultId), worse = faintWorse(next.guards, start.guards);
  report(bakes, next, { moved: { from: startModel, to: targetModel } });
  // The start lens lives on the old model, so a rejection here rejects the exposure itself.
  if (worse) verdict = `rejected: re-exposed model worsens the faint zone (${worse})`;
  else if (next.heldOut.score > start.heldOut.score + EPSILON) verdict = `rejected: held-out score ${start.heldOut.score} → ${next.heldOut.score} on the re-exposed model`;
  state = next;
}

while (!/^(rejected|unreachable|exposure kept|prediction only)/.test(verdict)) {
  if (state.full.inside) { verdict = 'converged'; break; }
  if (bakes >= maxBakes) break;
  const pairs = pairedPixels(state.grid, state.material, state.halves.fit, scale);
  const current = state.material.toneCurve ?? identityToneCurve();
  const { curve, pinned } = composeToneCurve(current, pairs.map(fitCorrection));
  const ceiling = ceilingShare(pairs), pins = pinnedShare(pairs, curve, pinned);
  console.log(JSON.stringify({ fit: { ceilingShare: +ceiling.toFixed(4), pinnedShare: +pins.toFixed(4), pinnedKnots: pinned } }));
  if (ceiling > PIN_LIMIT || pins > PIN_LIMIT) { verdict = 'unreachable without per-lens opacity'; log.push({ ceilingShare: ceiling, pinnedShare: pins, pinned }); break; }
  const result = await bakeLens(state, state.prepared.finiteMaterial!.modelResultId, curve);
  bakes++;
  const next = await measure(result.resultId), worse = faintWorse(next.guards, start.guards);
  const heldOutWorse = next.heldOut.score > state.heldOut.score + EPSILON;
  report(bakes, next, { ceilingShare: +ceiling.toFixed(4), pinnedShare: +pins.toFixed(4), faint: worse, heldOutWorse });
  if (worse) { verdict = `rejected: faint zone worsened (${worse}); keeping previous lens`; break; }
  if (heldOutWorse) { verdict = `rejected: held-out score ${state.heldOut.score} → ${next.heldOut.score}; keeping previous lens`; break; }
  const improvement = state.full.score - next.full.score;
  // A bake that scores worse is not adopted: the previous lens stays the result.
  if (improvement < 0) { verdict = `stalled: score ${state.full.score} → ${next.full.score}; keeping previous lens`; break; }
  state = next;
  if (state.full.inside) { verdict = 'converged'; break; }
  if (improvement < EPSILON) { verdict = `stalled: improvement ${improvement.toFixed(4)} < ${EPSILON}`; break; }
}
const numbers = (s: State) => ({ resultId: s.prepared.resultId, exposure: s.exposure, full: s.full, guards: s.guards });
const final = { schema: 'cssearth-lens-tone-fit@2', startResultId: startId, imageId: state.prepared.imageId, finalResultId: state.prepared.resultId,
  tolerance: TOLERANCE, epsilon: EPSILON, deliveryLoss: loss, core, bakes, verdict, exposure, before: numbers(start), after: numbers(state),
  toneCurve: state.material.toneCurve, rounds: log };
const out = resolve(root, 'output/lens-tone-fit');
await mkdir(out, { recursive: true });
await writeFile(resolve(out, `${state.prepared.imageId}-${startId.slice(0, 8)}.json`), JSON.stringify(final, null, 2) + '\n');
console.log(JSON.stringify({ verdict, bakes, finalResultId: state.prepared.resultId, model: state.prepared.finiteMaterial!.modelResultId }));
