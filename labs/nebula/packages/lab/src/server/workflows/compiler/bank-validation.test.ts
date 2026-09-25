import assert from 'node:assert/strict';
import test from 'node:test';
import type { PreparedCssVolume, PreparedVolumeLeaf } from '../../../adapters/renderer/volume-types.ts';
import type { CompilerBakeResult } from '@cssearth/bake/volume';
import { assertCompilerBankIdentity, assertCompilerLensGeometry } from './bank-validation.ts';

const neutralAlpha = 'a'.repeat(64), spectralAlpha = 'b'.repeat(64);
const result: Pick<CompilerBakeResult, 'id' | 'frame' | 'fieldIdentity' | 'alphaSha256'> = {
  id: 'test-volume', fieldIdentity: 'c'.repeat(64), alphaSha256: neutralAlpha,
  frame: { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
};
function volume(alphaSha256 = neutralAlpha): PreparedCssVolume {
  return { schema: 'cssearth-css-volume@1', id: `compiler-${result.id}`, frame: result.frame,
    provenance: { fieldIdentity: result.fieldIdentity, alphaSha256 }, approximation: {}, resources: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.png`, widthPx: 512, heightPx: 512,
      style: { width: '100px', height: '100px', transform: 'translateZ(0)', backgroundSize: '100%', backgroundPosition: 'center' } }] })) };
}
function changeLeaf(payload: PreparedCssVolume, edit: Partial<PreparedVolumeLeaf>): PreparedCssVolume {
  return { ...payload, stacks: payload.stacks.map(stack => stack.axis === 'x' ? { ...stack, leaves: [{ ...stack.leaves[0]!, ...edit }] } : stack) };
}

test('standard RGB lenses still require exact neutral alpha when no component pin exists', () => {
  assert.doesNotThrow(() => assertCompilerBankIdentity(volume(), result));
  assert.doesNotThrow(() => assertCompilerLensGeometry(volume(), volume(), result, {}));
  assert.throws(() => assertCompilerLensGeometry(volume(), volume(spectralAlpha), result, {}), /alpha support/);
  assert.throws(() => assertCompilerBankIdentity(volume(spectralAlpha), result), /alpha support/);
});

test('a stellar-only result retains the explicitly pinned cloud identity and rejects unrelated banks', () => {
  const retained = { ...result, id: 'new-stellar-result', volumeId: result.id };
  assert.doesNotThrow(() => assertCompilerBankIdentity(volume(), retained));
  assert.throws(() => assertCompilerBankIdentity(volume(), { ...retained, volumeId: 'unrelated' }), /different result/);
  const { volumeId: _id, ...unqualified } = retained;
  assert.throws(() => assertCompilerBankIdentity(volume(), unqualified), /different result/);
  assert.throws(() => assertCompilerBankIdentity(volume(spectralAlpha), retained), /alpha support/);
});

test('sampled spectral alpha must equal its explicit pin, not merely be different from neutral', () => {
  assert.doesNotThrow(() => assertCompilerLensGeometry(volume(), volume(spectralAlpha), result, { alphaSha256: spectralAlpha }));
  assert.throws(() => assertCompilerLensGeometry(volume(), volume(), result, { alphaSha256: spectralAlpha }), /alpha support/);
  assert.throws(() => assertCompilerLensGeometry(volume(), volume('d'.repeat(64)), result, { alphaSha256: spectralAlpha }), /alpha support/);
});

test('spectral alpha never relaxes result, frame or field identity', () => {
  const original = volume(spectralAlpha), lens = { alphaSha256: spectralAlpha };
  for (const changed of [
    { ...original, id: 'compiler-another-result' },
    { ...original, frame: { ...original.frame, metersPerUnit: 2 } },
    { ...original, provenance: { alphaSha256: spectralAlpha, fieldIdentity: 'd'.repeat(64) } },
  ]) assert.throws(() => assertCompilerLensGeometry(volume(), changed, result, lens), /different result/);
});

test('spectral alpha never relaxes shared slab count, position, dimensions or style', () => {
  const original = volume(spectralAlpha), lens = { alphaSha256: spectralAlpha };
  assert.throws(() => assertCompilerLensGeometry(volume(), { ...original, stacks: original.stacks.map(stack =>
    stack.axis === 'y' ? { ...stack, leaves: [] } : stack) }, result, lens), /slice counts/);
  for (const changed of [
    changeLeaf(original, { centerUnits: [0, 0, 1] }), changeLeaf(original, { id: 'other-slice' }),
    changeLeaf(original, { widthPx: 256 }), changeLeaf(original, { heightPx: 256 }),
    changeLeaf(original, { style: { ...original.stacks[0]!.leaves[0]!.style, transform: 'translateZ(2px)' } }),
  ]) assert.throws(() => assertCompilerLensGeometry(volume(), changed, result, lens), /share prepared geometry/);
});
