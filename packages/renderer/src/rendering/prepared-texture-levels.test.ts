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

test('a fixed level keeps the same texture through zoom once the prepared first pass is shown', () => {
  const fixed = { ...textureLevels, fixedLevel: 0 };
  expect(selectPreparedTextureLevel(fixed, 900, undefined, true)).toBe(0);
  // The first pass is the small prepared bank the page already shows; the fixed level follows it and never swaps on zoom.
  expect(selectPreparedTextureLevel({ ...textureLevels, fixedLevel: 1 }, 900, undefined, true)).toBe(0);
  expect(selectPreparedTextureLevel({ ...textureLevels, fixedLevel: 1 }, 10, 0)).toBe(1);
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
  // A body capped below its canonical page (maximumWidth) offers a smaller page as its top level.
  const capped = structuredClone(textureLevels); capped.levels[1].resources.a = 'a-small';
  expect(() => requireTextureLevels(capped, variants, resources)).not.toThrow();
});

test('a texture whose faces are behind the body or off screen keeps the first level while the body rests', () => {
  const page = (center: [number, number, number], normal: [number, number, number]) => ({ center, radius: 20, normal, spread: 0.2 });
  const placed = { hysteresis: 0.2, levels: [
    { minimumDiameter: 0, resources: { front: 'front-small', back: 'back-small', aside: 'aside-small' } },
    { minimumDiameter: 230, resources: { front: 'front', back: 'back', aside: 'aside' } },
  ], placements: { body: { center: [0, 0, 0] as [number, number, number], radius: 100 }, writes: {
    '--page-front': page([0, 0, 100], [0, 0, 1]), '--page-back': page([0, 0, -100], [0, 0, -1]), '--page-aside': page([100, 0, 0], [1, 0, 0]),
  } } };
  const written = ['front', 'back', 'aside'];
  const placedDefinition = { textureLevels: placed, materials: [], variants: [{ when: { lensId: 'a' }, required: written, materials: [],
    writes: written.map((resource, target) => ({ kind: 'texture' as const, resource, target, name: `--page-${resource}`, quoted: true })) }] } as unknown as PreparedPresentationDefinition;
  expect(() => requireTextureLevels(placed, placedDefinition.variants, new Set([...written, ...written.map(key => `${key}-small`)]))).not.toThrow();
  // The eye sits 500 px in front of the body centre on +z, looking at it.
  const eyeFromScene = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-500,1];
  const view = (motionAtRest: boolean, width = 800, height = 600) => ({ sceneMatrix: '', sunViewDirection: null, motionAtRest, viewportWidth: width, viewportHeight: height,
    projection: { focalPixels: 1000, principalOffsetPixels: [0, 0] as [number, number], eyeFromScene },
    levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } });
  const plan = (at: ReturnType<typeof view>) => resolvePreparedPresentation(placedDefinition, { selection: { lensId: 'a' }, view: at, previousPlan: { textureLevel: 1 } as never }).required;
  // The far side is behind the body; the side page is on screen at the limb.
  expect(plan(view(true))).toEqual(['front', 'back-small', 'aside']);
  // A small screen, with its quarter-screen margin, leaves the side page (projected 200 px off centre) out of view.
  expect(plan(view(true, 100, 100))).toEqual(['front', 'back-small', 'aside-small']);
  // The eye transform carries the scene's scale (0.02 here, as a mounted camera's does): the same view, the same pages.
  const scaled = (width: number, height: number) => ({ ...view(true, width, height), projection: { ...view(true).projection,
    eyeFromScene: [0.02,0,0,0, 0,0.02,0,0, 0,0,0.02,0, 0,0,-10,1], focalPixels: 1000 } });
  expect(plan(scaled(800, 600))).toEqual(['front', 'back-small', 'aside']);
  expect(plan(scaled(100, 100))).toEqual(['front', 'back-small', 'aside-small']);
  // While the body spins, the prepared placements no longer hold: every page takes the selected level.
  expect(plan(view(false))).toEqual(['front', 'back', 'aside']);
  expect(() => requireTextureLevels({ ...placed, placements: { ...placed.placements, writes: { '--unwritten': page([0, 0, 0], [0, 0, 1]) } } },
    placedDefinition.variants, new Set([...written, ...written.map(key => `${key}-small`)]))).toThrow('--unwritten');
});
