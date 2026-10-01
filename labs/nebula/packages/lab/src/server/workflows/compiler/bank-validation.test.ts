import assert from 'node:assert/strict';
import test from 'node:test';
import type { PreparedCssVolume, PreparedVolumeLeaf } from '../../../adapters/renderer/volume-types.ts';
import type { CompilerBakeResult } from '@cssearth/objects';
import { assertCompilerBankIdentity, assertCompilerDatasetGeometry } from './bank-validation.ts';

const result: Pick<CompilerBakeResult, 'id' | 'frame' | 'fieldIdentity'> = {
  id: 'test-volume', fieldIdentity: 'test-compiler',
  frame: { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
};
function volume(fieldIdentity = result.fieldIdentity): PreparedCssVolume {
  return { schema: 'cssearth-css-volume@1', id: `compiler-${result.id}`, frame: result.frame,
    provenance: { fieldIdentity }, approximation: {}, resources: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.png`, widthPx: 512, heightPx: 512,
      style: { width: '100px', height: '100px', transform: 'translateZ(0)', backgroundSize: '100%', backgroundPosition: 'center' } }] })) };
}
function changeLeaf(payload: PreparedCssVolume, edit: Partial<PreparedVolumeLeaf>): PreparedCssVolume {
  return { ...payload, stacks: payload.stacks.map(stack => stack.axis === 'x' ? { ...stack, leaves: [{ ...stack.leaves[0]!, ...edit }] } : stack) };
}

test('neutral and RGB banks belong to their result, frame and fitted field', () => {
  assert.doesNotThrow(() => assertCompilerBankIdentity(volume(), result));
  assert.doesNotThrow(() => assertCompilerDatasetGeometry(volume(), volume(), result));
  assert.throws(() => assertCompilerBankIdentity(volume('another-field'), result), /different result or field/);
});

test('a stellar-only result retains the explicitly named cloud volume and rejects unrelated banks', () => {
  const retained = { ...result, id: 'new-stellar-result', volumeId: result.id };
  assert.doesNotThrow(() => assertCompilerBankIdentity(volume(), retained));
  assert.throws(() => assertCompilerBankIdentity(volume(), { ...retained, volumeId: 'unrelated' }), /different result/);
  const { volumeId: _id, ...unqualified } = retained;
  assert.throws(() => assertCompilerBankIdentity(volume(), unqualified), /different result/);
});

test('a dataset never relaxes result, frame or field identity', () => {
  const original = volume();
  for (const changed of [
    { ...original, id: 'compiler-another-result' },
    { ...original, frame: { ...original.frame, metersPerUnit: 2 } },
    { ...original, provenance: { fieldIdentity: 'another-field' } },
  ]) assert.throws(() => assertCompilerDatasetGeometry(volume(), changed, result), /different result/);
});

test('a dataset never relaxes shared slab count, position, dimensions or style', () => {
  const original = volume();
  assert.throws(() => assertCompilerDatasetGeometry(volume(), { ...original, stacks: original.stacks.map(stack =>
    stack.axis === 'y' ? { ...stack, leaves: [] } : stack) }, result), /slice counts/);
  for (const changed of [
    changeLeaf(original, { centerUnits: [0, 0, 1] }), changeLeaf(original, { id: 'other-slice' }),
    changeLeaf(original, { widthPx: 256 }), changeLeaf(original, { heightPx: 256 }),
    changeLeaf(original, { style: { ...original.stacks[0]!.leaves[0]!.style, transform: 'translateZ(2px)' } }),
  ]) assert.throws(() => assertCompilerDatasetGeometry(volume(), changed, result), /share prepared geometry/);
});
