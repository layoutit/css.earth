import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { geometrySha } from '../geometry/registered-source.ts';
import { jointPath, jointRecord } from '../../../features/joint-fit/model.ts';
import { readPhotometricMgeRecipe as readScientificRecipe, createPhotometricMgePrior, type PhotometricMgeRecipe } from '@cssearth/nebula-reconstruction/methods/inference/photometric-mge';
import { fitSimulationGuidedEmission, type SimulationDepthSettings } from '@cssearth/nebula-reconstruction/methods/inference/simulation-guided';
import { fitSimulationEnvelope } from '@cssearth/nebula-reconstruction/methods/inference/simulation-envelope';
import { createPhotometricEmission, type EnvelopeColors } from '@cssearth/volume-core/fields/photometric-emission';
import { envelopeChromaticity, envelopeChromaSettings, pixelCenter } from '@cssearth/volume-core/fields/simulation-envelope';
import type { MaterialImage } from '@cssearth/volume-core/materials/component-material';
import type { EmissionFieldModel } from '@cssearth/volume-core/contracts/emission';
import type { EmissionFitInput } from '@cssearth/volume-core/contracts/emission';
export function readPhotometricMgeRecipe(value: unknown): PhotometricMgeRecipe {
  const recipe = readScientificRecipe(value);
  if (!recipe.evidence.path.startsWith('labs/nebula/models/')) throw new TypeError('Photometric evidence must be object-owned.');
  return recipe;
}

/** Live compilation and saved-result restoration enforce the same scientific source identity. */
export function verifyPhotometricEvidence(recipe: PhotometricMgeRecipe, evidence: unknown, subjectId: string): void {
  if (recipe.id !== subjectId) throw new TypeError('Photometric model belongs to another subject.');
  if (!jointRecord(evidence) || evidence.schema !== 'cssearth-nebula-physical-evidence@1' || evidence.subjectId !== subjectId ||
      !Array.isArray(evidence.sources) || !evidence.sources.some(row => jointRecord(row) && jointRecord(row.download) &&
        row.download.url === recipe.source.url))
    throw new TypeError('Photometric model lacks its source-owned evidence ledger.');
}

export async function loadPhotometricPrior(root: string, path: string, subjectId: string) {
  if (!jointPath(path) || !path.startsWith('labs/nebula/models/')) throw new TypeError('Photometric model must be object-owned.');
  const source = async (name: string) => {
    const actual = await realpath(resolve(root, name)), offset = relative(await realpath(root), actual);
    if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) throw new TypeError('Photometric source leaves the repository.');
    return readFile(actual);
  };
  const recipeBytes = await source(path), recipe = readPhotometricMgeRecipe(JSON.parse(recipeBytes.toString()));
  const evidenceBytes = await source(recipe.evidence.path);
  const evidence: unknown = JSON.parse(evidenceBytes.toString());
  verifyPhotometricEvidence(recipe, evidence, subjectId);
  return { recipe, recipeBytes, evidenceBytes, recipeSha256: geometrySha(recipeBytes), prior: createPhotometricMgePrior(recipe) };
}

/** Finite light features receive one conditional depth realization, not an extruded image or claimed stellar distance. */
export function fitPhotometricEmission(input: EmissionFitInput, controls: unknown,
  model: Awaited<ReturnType<typeof loadPhotometricPrior>>, signal: AbortSignal, onProgress: (message: string) => void) {
  const pixelPitch = Math.max((input.bounds.max[0] - input.bounds.min[0]) / input.width,
    (input.bounds.max[1] - input.bounds.min[1]) / input.height);
  const settings: SimulationDepthSettings = { depthSamples: 2048, modeRelativeThreshold: .1, maximumModes: 1,
    minimumSigmaZ: pixelPitch, maximumSigmaZ: Math.max(pixelPitch, ...model.recipe.gaussians.map(row => row.sigmaArcsec)),
    featureThicknessRatio: 1, supportSigma: 4, placement: 'conditional-quantile' };
  const coverage = input.coverage ?? new Uint8Array(input.target.length).fill(1);
  const envelope = model.recipe.envelope && fitSimulationEnvelope({ ...input, coverage }, model.prior, model.recipe.envelope, signal);
  const detail = envelope ? input.target.map((value, p) => Math.max(0, value - envelope.projection[p]!)) : input.target;
  const fitted = fitSimulationGuidedEmission({ ...input, target: detail }, controls, model.prior, settings, { signal, onProgress, maximumComponents: model.recipe.residualMaximumComponents });
  if (!envelope) return fitted;
  fitted.field.photometricEnvelope = { schema: 'cssearth-photometric-envelope@1', priorIdentity: model.prior.identity,
    recipe: model.recipe, ...envelope.grid, gain: Array.from(envelope.grid.gain) };
  fitted.field.identity = geometrySha(JSON.stringify({ finiteIdentity: fitted.field.identity, envelope: fitted.field.photometricEnvelope }));
  fitted.field.bounds = createPhotometricEmission(fitted.field).bounds;
  fitted.field.assumptions.depth += ' The smooth envelope retains the oblate MGE density at every depth; only positive residual features receive conditional quantile depths.';
  let targetSum = 0, modeledSum = 0, missing = 0, excess = 0, before = 0, after = 0, count = 0;
  for (let p = 0; p < input.target.length; p++) {
    fitted.projection[p] += envelope.projection[p]!;
    if (!coverage[p]) continue;
    const target = input.target[p]!, residual = target - fitted.projection[p]!;
    fitted.residual[p] = residual; fitted.unassigned[p] = Math.max(0, residual);
    targetSum += target; modeledSum += fitted.projection[p]!; missing += Math.max(0, residual); excess += Math.max(0, -residual);
    before += target * target; after += residual * residual; count++;
  }
  Object.assign(fitted.metrics, { targetSum, modeledSum, unassignedSum: missing, excessSum: excess,
    beforeRmse: Math.sqrt(before / Math.max(1, count)), afterRmse: Math.sqrt(after / Math.max(1, count)), relativeSquaredError: after / Math.max(1e-12, before) });
  return { ...fitted, envelopeMetrics: envelope.metrics };
}

/** Retain only envelope-scale chromaticity; fine image detail stays attached to finite XYZ emitters. */
export function photometricEnvelopeColors(model: EmissionFieldModel, image: MaterialImage): EnvelopeColors | undefined {
  const envelope = model.photometricEnvelope;
  if (!envelope) return undefined;
  const settings = envelope.recipe.envelope!;
  const rgb = new Float32Array(envelope.width * envelope.height * 3), coverage = new Uint8Array(envelope.width * envelope.height), pixel: [number, number, number] = [0, 0, 0];
  for (let p = 0; p < coverage.length; p++) {
    const [x, y] = pixelCenter(envelope.bounds, envelope.width, envelope.height, p);
    if (image.sampleRgb(x, y, pixel)) { coverage[p] = 1; for (let c = 0; c < 3; c++) rgb[p * 3 + c] = pixel[c]!; }
  }
  const chroma = envelopeChromaSettings(settings);
  const sample = envelopeChromaticity(rgb, coverage, envelope.width, envelope.height, envelope.bounds, settings.scalePixels,
    chroma.halfSaturationQuantile, chroma.skyQuantile, chroma.coverageTaper);
  // Two samples per smoothing sigma retain only the coarse envelope chromaticity.
  const width = Math.max(2, Math.min(envelope.width, Math.ceil(2 * envelope.width / settings.scalePixels)));
  const height = Math.max(2, Math.min(envelope.height, Math.ceil(2 * envelope.height / settings.scalePixels)));
  const colors = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const [x, y] = pixelCenter(envelope.bounds, width, height, p);
    sample(x, y, pixel); for (let c = 0; c < 3; c++) colors[p * 3 + c] = pixel[c]!;
  }
  return { width, height, rgb: Array.from(colors) };
}
