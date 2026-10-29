/** Condition tiny physical quads in pc, then transport the prepared geometry back to the common kpc frame. */
import { validatePreparedCssVolume } from '@cssearth/objects';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import type { GalaxyModelBinding } from '../../milky-way-dust/galaxy-slices.mts';
import { deliveryPhysicalFrame } from '../delivery/delivery-frame.mts';
import { array, rec, num, numbers, need } from '../inputs.mts';

export function compileFiniteBank(input: unknown, directory: string, binding: GalaxyModelBinding) {
  const raw = rec(input), field = rec(raw.field), scale = 1000;
  const conditioned = { ...raw, field: { ...field, box: numbers(field.box, 6).map(v => v * scale) }, leaves: array(raw.leaves).map(v => { const r = rec(v); return { ...r, center: num(r.center) * scale, imageBounds: numbers(r.imageBounds, 4).map(v => v * scale) }; }) };
  const physical = deliveryPhysicalFrame(), compiled = compileGalaxySliceVolume(conditioned, { ...physical, metersPerUnit: physical.metersPerUnit / scale }, directory, 'lmc-volume', binding);
  const triple = (v: readonly number[]): [number, number, number] => { need(v.length === 3, 'Invalid prepared coordinate'); return [v[0]! / scale, v[1]! / scale, v[2]! / scale]; };
  const approximation = rec(compiled.approximation), pitch = rec(approximation.slabPitchUnits);
  return validatePreparedCssVolume({ ...compiled,
    frame: { ...compiled.frame, metersPerUnit: compiled.frame.metersPerUnit * scale, boundsUnits: { min: triple(compiled.frame.boundsUnits.min), max: triple(compiled.frame.boundsUnits.max) } },
    stacks: compiled.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => {
      const text = leaf.style.transform; need(text.startsWith('matrix3d(') && text.endsWith(')'), 'Expected a prepared affine leaf');
      const matrix = text.slice(9, -1).split(',').map(Number); need(matrix.length === 16 && matrix.every(Number.isFinite) && matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1, 'Unexpected projective leaf calibration');
      for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) matrix[col * 4 + row] /= scale;
      return { ...leaf, centerUnits: triple(leaf.centerUnits), ...(leaf.boundsCssPixels ? { boundsCssPixels: { min: triple(leaf.boundsCssPixels.min), max: triple(leaf.boundsCssPixels.max) } } : {}), style: { ...leaf.style, transform: 'matrix3d(' + matrix.join(',') + ')' } };
    }) })),
    approximation: { ...approximation, slabPitchUnits: { x: num(pitch.x) / scale, y: num(pitch.y) / scale, z: num(pitch.z) / scale }, geometryCompilation: 'Compile finite quads in pc to keep PolyCSS edge guards small in physical units; rebase every prepared transform and bound to kpc.' },
  });
}
