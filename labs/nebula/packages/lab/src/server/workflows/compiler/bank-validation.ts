import sharp from 'sharp';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { readGeometryPin } from '../geometry/registered-source.ts';
import { jointRecord, jointPath } from '../../../features/joint-fit/model.ts';
import { readCompilerRecipe } from '../../../features/compiler/model.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { readDepthRecipe, verifyDepthEvidence } from './depth-model.ts';
import { readPhotometricMgeRecipe, verifyPhotometricEvidence } from './photometric-prior.ts';
import type { PreparedCssVolume } from '../../../adapters/renderer/volume-types.ts';
import type { CompilerBakeResult, CompilerLensVolume, CompilerPin } from '@cssearth/bake/volume';

type BankIdentity = Pick<CompilerBakeResult, 'id' | 'volumeId' | 'frame' | 'fieldIdentity' | 'alphaSha256'>;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The neutral bank and ordinary RGB lenses retain the scene's original alpha contract. */
export function assertCompilerBankIdentity(payload: PreparedCssVolume, result: BankIdentity) {
  const provenance = payload.provenance;
  if (payload.id !== `compiler-${result.volumeId ?? result.id}` || JSON.stringify(payload.frame) !== JSON.stringify(result.frame) ||
      !record(provenance) || provenance.alphaSha256 !== result.alphaSha256 || provenance.fieldIdentity !== result.fieldIdentity)
    throw new TypeError('Prepared compiler volume belongs to a different result or alpha support.');
}

/** A qualified component mixture can pin different alpha without changing its spatial frame or slabs. */
export function assertCompilerLensGeometry(neutral: PreparedCssVolume, textured: PreparedCssVolume, result: BankIdentity,
  lens: Pick<CompilerLensVolume, 'alphaSha256'>) {
  assertCompilerBankIdentity(textured, { ...result, alphaSha256: lens.alphaSha256 ?? result.alphaSha256 });
  for (const axis of ['x', 'y', 'z'] as const) {
    const first = neutral.stacks.find(stack => stack.axis === axis)!, second = textured.stacks.find(stack => stack.axis === axis)!;
    if (first.leaves.length !== second.leaves.length) throw new Error('Compiler materials have different slice counts.');
    for (let i = 0; i < first.leaves.length; i++) {
      const a = first.leaves[i]!, b = second.leaves[i]!;
      if (a.id !== b.id || a.widthPx !== b.widthPx || a.heightPx !== b.heightPx || JSON.stringify(a.centerUnits) !== JSON.stringify(b.centerUnits) ||
          JSON.stringify(a.boundsCssPixels) !== JSON.stringify(b.boundsCssPixels) || (Object.keys(a.style) as (keyof typeof a.style)[]).some(key => a.style[key] !== b.style[key]))
        throw new Error('Compiler materials do not share prepared geometry.');
    }
  }
}


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
  for (const lens of result.scene.lenses) {
    assertCompilerLensGeometry(neutral, await readBank(lens.volume), result.scene, lens);
  }
  return result;
}
