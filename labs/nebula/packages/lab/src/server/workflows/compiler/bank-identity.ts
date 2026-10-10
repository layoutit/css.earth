/** Browser-safe checks that a prepared compiler bank belongs to its result: the compiler viewer and the server's
 * result validation run the same ones. */
import { isRecord as coreIsRecord } from '@cssearth/core';
import type { PreparedCssVolume, CompilerBakeResult } from '@cssearth/objects';

type BankIdentity = Pick<CompilerBakeResult, 'id' | 'volumeId' | 'frame' | 'fieldIdentity'>;
const record = coreIsRecord;

/** The neutral bank and every dataset belong to the scene's volume, frame and fitted field. */
export function assertCompilerBankIdentity(payload: PreparedCssVolume, result: BankIdentity) {
  const provenance = payload.provenance;
  if (payload.id !== `compiler-${result.volumeId ?? result.id}` || JSON.stringify(payload.frame) !== JSON.stringify(result.frame) ||
      !record(provenance) || provenance.fieldIdentity !== result.fieldIdentity)
    throw new TypeError(`Prepared compiler volume ${payload.id} belongs to a different result or field.`);
}

/** A qualified component mixture can carry different alpha without changing its spatial frame or slabs. */
export function assertCompilerDatasetGeometry(neutral: PreparedCssVolume, textured: PreparedCssVolume, result: BankIdentity) {
  assertCompilerBankIdentity(textured, result);
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
