import { expect, test } from 'vitest';
import { selectPreparedTextureLevel } from './prepared-texture-levels.js';
import { resolvePreparedPresentation, type PreparedPresentationDefinition } from './prepared-presentation.js';
import { requireTextureLevels } from '../validation/presentation.js';

const textureLevels = { hysteresis: 0.2, levels: [
  { minimumDiameter: 0, resources: { a: 'a-small', b: 'b-small' } },
  { minimumDiameter: 230, resources: { a: 'a', b: 'b' } },
] };
const variants = ['a', 'b'].map(lensId => ({ when: { lensId }, required: [lensId], materials: [],
  writes: [{ kind: 'texture' as const, resource: lensId, target: 2, name: 'backgroundImage', quoted: true }] }));
const definition = { textureLevels, variants, materials: [] } as unknown as PreparedPresentationDefinition;

test('startup is coarse even for a close URL; selection demand contains only the selected dataset', () => {
  const view = { sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } };
  const initial = resolvePreparedPresentation(definition, { selection: { lensId: 'a' }, view, initial: true });
  expect(initial.required).toEqual(['a-small']);
  const refined = resolvePreparedPresentation(definition, { selection: { lensId: 'a' }, view, previousPlan: initial });
  expect(refined.required).toEqual(['a']);
  expect(resolvePreparedPresentation(definition, { selection: { lensId: 'b' }, view }).required).toEqual(['b']);
});

test('zoom hysteresis retains detail at a boundary and downgrades outside it', () => {
  expect(selectPreparedTextureLevel(textureLevels, 231, 0)).toBe(1);
  expect(selectPreparedTextureLevel(textureLevels, 200, 1)).toBe(1);
  expect(selectPreparedTextureLevel(textureLevels, 183, 1)).toBe(0);
  expect(selectPreparedTextureLevel(textureLevels, 200, 0)).toBe(0);
  expect(selectPreparedTextureLevel(textureLevels, null, 0)).toBe(1);
});

test('a fixed level keeps the same texture through zoom and initial publication', () => {
  const fixed = { ...textureLevels, fixedLevel: 0 };
  expect(selectPreparedTextureLevel(fixed, 900, undefined, true)).toBe(0);
  expect(selectPreparedTextureLevel(fixed, 900, 0)).toBe(0);
  expect(selectPreparedTextureLevel(fixed, null, 0)).toBe(0);
  expect(() => requireTextureLevels(fixed, variants, new Set(['a', 'b', 'a-small', 'b-small']))).not.toThrow();
  expect(() => requireTextureLevels({ ...fixed, fixedLevel: 2 }, variants, new Set(['a', 'b', 'a-small', 'b-small']))).toThrow();
});

test('external texture plans reject undeclared, incomplete or reordered levels', () => {
  const resources = new Set(['a', 'b', 'a-small', 'b-small']);
  expect(() => requireTextureLevels(textureLevels, variants, resources)).not.toThrow();
  const mutate = (edit: (copy: typeof textureLevels) => void) => {
    const copy = structuredClone(textureLevels); edit(copy);
    expect(() => requireTextureLevels(copy, variants, resources)).toThrow();
  };
  mutate(copy => { copy.levels[0].resources.a = 'missing'; });
  mutate(copy => { delete (copy.levels[0].resources as Record<string, string>).b; });
  mutate(copy => { copy.levels[1].minimumDiameter = 0; });
  mutate(copy => { copy.levels[1].resources.a = 'a-small'; });
});
