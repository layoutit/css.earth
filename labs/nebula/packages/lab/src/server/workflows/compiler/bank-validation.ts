import { isRecord as coreIsRecord } from '@cssearth/core';
import sharp from 'sharp';
import { validatePreparedCssVolume, readPhotometricMgeRecipe, type PreparedCssVolume, type CompilerBakeResult, type CompilerPin } from '@cssearth/objects';
import { readGeometryPin } from '../geometry/registered-source.ts';
import { jointRecord, jointPath } from '../../../features/joint-fit/model.ts';
import { readCompilerRecipe } from '../../../features/compiler/model.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { readDepthRecipe, verifyDepthEvidence } from './depth-model.ts';
import { verifyPhotometricEvidence } from './photometric-prior.ts';

// The bank checks are browser-safe and live apart, so the compiler viewer can run them without this module's Node reads.
import { assertCompilerBankIdentity, assertCompilerDatasetGeometry } from './bank-identity.ts';
export { assertCompilerBankIdentity, assertCompilerDatasetGeometry };
const record = coreIsRecord;

export async function validateCompilerResult(root: string, value: unknown) {
  const result = readCompilerResult(value);
  if (result.scene.starSprites) {
    const sprites = result.scene.starSprites, bytes = await readGeometryPin(root, sprites.atlas);
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== sprites.width || metadata.height !== sprites.height || !metadata.hasAlpha)
      throw new TypeError('Saved stellar atlas dimensions or alpha differ.');
  }
  for (const pin of [result.model, result.method, result.target, result.projection, result.residual, ...result.sources.flatMap(s => [s.original, s.starless])]) await readGeometryPin(root, pin);
  const method: unknown = JSON.parse((await readGeometryPin(root, result.method)).toString());
  if (jointRecord(method) && method.physicalDepth !== undefined) {
    const depth = method.physicalDepth;
    if (!jointRecord(depth)) throw new TypeError('Invalid saved physical-depth method.');
    const snapshot = async (v: unknown) => {
      if (!jointRecord(v) || !jointPath(v.path) || !v.path.startsWith(`.local/nebula-lab/compiler/${result.id}/`)) throw new TypeError('Invalid physical evidence snapshot.');
      return readGeometryPin(root, { path: v.path });
    };
    const recipe = readDepthRecipe(JSON.parse((await snapshot(depth.recipe)).toString())), evidence = await snapshot(depth.evidence);
    verifyDepthEvidence(recipe, JSON.parse(evidence.toString()));
  }
  if (jointRecord(method) && method.photometricPrior !== undefined) {
    const prior = method.photometricPrior;
    if (!jointRecord(prior) || !jointRecord(prior.recipe) || !jointRecord(prior.evidence)) throw new TypeError('Invalid saved photometric model.');
    const snapshot = async (pin: Record<string, unknown>) => {
      if (!jointPath(pin.path) || !pin.path.startsWith(`.local/nebula-lab/compiler/${result.id}/`)) throw new TypeError('Invalid photometric evidence snapshot.');
      return readGeometryPin(root, { path: pin.path });
    };
    const recipe = readPhotometricMgeRecipe(JSON.parse((await snapshot(prior.recipe)).toString()));
    const evidenceBytes = await snapshot(prior.evidence);
    const compilerRecipe = readCompilerRecipe(method.recipe);
    if (!compilerRecipe.photometricPriorRecipe) throw new TypeError('Saved compiler recipe omits its photometric prior.');
    verifyPhotometricEvidence(recipe, JSON.parse(evidenceBytes.toString()), compilerRecipe.id);
  }
  async function readBank(pin: CompilerPin) {
    const volume = validatePreparedCssVolume(JSON.parse((await readGeometryPin(root, pin)).toString())), directory = pin.path.slice(0, pin.path.lastIndexOf('/') + 1);
    for (const resource of volume.resources) await readGeometryPin(root, { path: directory + resource.path });
    return volume;
  }
  const neutral = await readBank(result.scene.neutral);
  assertCompilerBankIdentity(neutral, result.scene);
  for (const dataset of result.scene.datasets) {
    assertCompilerDatasetGeometry(neutral, await readBank(dataset.volume), result.scene);
  }
  return result;
}
