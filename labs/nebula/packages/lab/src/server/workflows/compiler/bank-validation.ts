import type { PreparedCssVolume } from '../../../adapters/renderer/volume-types.ts';
import type { CompilerBakeResult, CompilerLensVolume } from '@cssearth/volume-core/contracts/compiler-bake';

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
