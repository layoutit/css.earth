import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { createTextureTileWriter, selectPreparedTextureLevel, textureTileLeafStyles, tiledTextureKeys, type PreparedTextureTileLeaves } from './prepared-texture-levels.js';
import { mountPreparedPresentation, resolvePreparedPresentation, type PreparedPresentationDefinition } from './prepared-presentation.js';
import type { PreparedResources } from './prepared-residency.js';
import { requireTextureLevels } from '../validation/presentation.js';

const textureLevels = { hysteresis: 0.2, levels: [
  { minimumDiameter: 0, resources: { a: 'a-small', b: 'b-small' } },
  { minimumDiameter: 230, resources: { a: 'a', b: 'b' } },
] };
const variants = ['a', 'b'].map(lensId => ({ when: { lensId }, required: [lensId], materials: [],
  writes: [{ kind: 'texture' as const, resource: lensId, target: 2, name: 'backgroundImage', quoted: true }] }));
const definition = { textureLevels, variants, materials: [] } as unknown as PreparedPresentationDefinition;

test('startup demands the camera texture level and only the selected dataset', () => {
  const view = { sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } };
  const initial = resolvePreparedPresentation(definition, { selection: { lensId: 'a' }, view });
  expect(initial.required).toEqual(['a']);
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

test('a fixed level applies from the first demand and stays fixed through zoom', () => {
  const fixed = { ...textureLevels, fixedLevel: 0 };
  expect(selectPreparedTextureLevel(fixed, 900, undefined)).toBe(0);
  expect(selectPreparedTextureLevel({ ...textureLevels, fixedLevel: 1 }, 900, undefined)).toBe(1);
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

test('a sheet level plans each page as a tile of one shared image; the page level plans the pages themselves', () => {
  const sheet = { hysteresis: 0.2, levels: [
    { minimumDiameter: 0, resources: { a: 'sheet', b: 'sheet' }, tiles: { a: { x: 0, y: 0, scale: 2 }, b: { x: 3, y: 0, scale: 2 } } },
    { minimumDiameter: 230, resources: { a: 'a', b: 'b' } },
  ] };
  const both = [{ when: { lensId: 'a' }, required: ['a', 'b'], materials: [], writes: ['a', 'b'].map((resource, i) =>
    ({ kind: 'texture' as const, resource, target: i, name: `--page-${i}`, quoted: true })) }];
  const paged = { textureLevels: sheet, variants: both, materials: [] } as unknown as PreparedPresentationDefinition;
  const view = { sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } };
  const initial = resolvePreparedPresentation(paged, { selection: { lensId: 'a' }, view: { ...view, levelOfDetail: { ...view.levelOfDetail, silhouetteDiameter: 100 } } });
  // One decode for both pages.
  expect(initial.required).toEqual(['sheet']);
  expect(initial.textureTiles).toEqual(sheet.levels[0]!.tiles);
  const refined = resolvePreparedPresentation(paged, { selection: { lensId: 'a' }, view, previousPlan: initial });
  expect(refined.required).toEqual(['a', 'b']);
  expect(refined.textureTiles).toBeUndefined();
  expect([...tiledTextureKeys(sheet)]).toEqual(['a', 'b']);
  // A leaf of page b, 0.25 px into it: on the sheet it moves by the tile's offset and draws the sheet twice the page's width.
  expect(textureTileLeafStyles({ unit: -1, width: 168 }, 0.25, 84.0625, sheet.levels[0]!.tiles!.b)).toEqual([['backgroundPosition', '-3.25px -84.0625px'], ['backgroundSize', '336px auto']]);
  expect(textureTileLeafStyles({ unit: -1, width: 168 }, 0.25, 84.0625, undefined)).toEqual([['backgroundPosition', '-0.25px -84.0625px'], ['backgroundSize', '168px auto']]);
  expect(() => requireTextureLevels(sheet, both, new Set(['a', 'b', 'sheet']))).not.toThrow();
  expect(() => requireTextureLevels({ ...sheet, levels: [{ ...sheet.levels[0], tiles: { a: { x: 0, y: 0, scale: 0.5 } } }, sheet.levels[1]] }, both, new Set(['a', 'b', 'sheet']))).toThrow(/tile a/);
});


test('system-scale proxies require no detail images and acquire them on geometry entry', () => {
  const at = (stage: string) => ({sceneMatrix: '', sunViewDirection: null,
    levelOfDetail: {stage, silhouetteDiameter: 13, billboardOpacity: 1, markerOpacity: 0}});
  for (const stage of ['marker', 'billboard']) {
    const plan = resolvePreparedPresentation(definition, {selection: {lensId: 'a'}, view: at(stage)});
    expect(plan.deferredTextures).toBe(true);
    expect(plan.required).toEqual([]);
    expect(plan.prewarm).toEqual([]);
  }
  const detail = resolvePreparedPresentation(definition, {selection: {lensId: 'a'}, view: at('geometry')});
  expect(detail.required).toEqual(['a-small']);
  expect(detail.deferredTextures).toBeUndefined();
});

// Two of Earth's page leaves (packages/bake/src/presentation/texture-tile-records.ts): page 0's first two leaves under the
// body, node 1, whose image write is --page-0.
const tileLeaves: PreparedTextureTileLeaves[] = [{ target: 1, name: '--page-0', unit: -1, width: 168, initial: { x: 168, y: 0, scale: 7 }, leaves: [[2, 0.25, 0.25], [3, 84.0625, 0.25]] }];
const tiledLevels = { hysteresis: 0.2, tileLeaves, levels: [
  { minimumDiameter: 0, resources: { page: 'sheet' }, tiles: { page: { x: 168, y: 0, scale: 7 } } },
  { minimumDiameter: 230, resources: { page: 'page' } },
] };
const tiledVariants = [{ when: { lensId: 'a' }, required: ['page'], materials: [], writes: [{ kind: 'texture' as const, resource: 'page', target: 1, name: '--page-0', quoted: true }] }];

test('a tiled page leaf takes its final placement directly and writes only what changes', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2, 3].map(() => document.createElement('s'));
  // The prepared literal values at the initial tile, as the tree or server markup sets them.
  nodes[2]!.style.setProperty('background-position', '-168.25px -0.25px'); nodes[2]!.style.setProperty('background-size', '1176px auto');
  const writes: [number, string, string][] = [];
  const writer = createTextureTileWriter(tiledLevels, nodes, (element, name, value) => {
    writes.push([nodes.indexOf(element), name, value]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value);
  });
  expect(writer.has(1, '--page-0')).toBe(true);
  // Node 2 already shows the sheet tile; node 3 has no prepared value yet.
  expect(writer.publish(1, '--page-0', tiledLevels.levels[0]!.tiles!.page)).toBe(2);
  expect(writes).toEqual([[3, 'backgroundPosition', '-252.0625px -0.25px'], [3, 'backgroundSize', '1176px auto']]);
  expect(writer.publish(1, '--page-0', tiledLevels.levels[0]!.tiles!.page)).toBe(0);
  writes.length = 0;
  // The page level draws the page itself: offsets lose the tile's, the size is the page's.
  expect(writer.publish(1, '--page-0', undefined)).toBe(4);
  expect(writes.map(([node, name, value]) => `${node} ${name} ${value}`)).toEqual([
    '2 backgroundPosition -0.25px -0.25px', '2 backgroundSize 168px auto', '3 backgroundPosition -84.0625px -0.25px', '3 backgroundSize 168px auto']);
  for (const node of nodes) expect(node.getAttribute('style') ?? '').not.toMatch(/var\(|calc\(|--/);
  expect(writer.publish(1, '--other', undefined)).toBe(0);
});

test('a level switch commits each tiled leaf with its image, and no tile variable on the target', () => {
  const { document } = parseHTML('<html><body><main></main></body></html>');
  const stage = document.querySelector('main')!;
  const nodes = [0, 1, 2, 3].map(() => document.createElement('s'));
  nodes[0]!.append(nodes[1]!); nodes[1]!.append(nodes[2]!, nodes[3]!);
  const definition = { textureLevels: tiledLevels, variants: tiledVariants, materials: [], animations: [], viewBindings: [],
    tree: { nodes: [], camera: 0, scene: 0, stageClasses: [], textureBindings: [{ target: 1, name: '--page-0', leaves: [2, 3] }] } } as unknown as PreparedPresentationDefinition;
  const presentation = mountPreparedPresentation(stage as unknown as HTMLElement, { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes: nodes as unknown as HTMLElement[], roots: [nodes[0]] as unknown as HTMLElement[] }), destroy() {} });
  const resources = { url: (key: string) => `/${key}.webp` } as unknown as PreparedResources;
  const view = (silhouetteDiameter: number) => ({ sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter, billboardOpacity: 0, markerOpacity: 0 } });
  const small = resolvePreparedPresentation(definition, { selection: { lensId: 'a' }, view: view(100) });
  presentation.commitSelection({ selection: { lensId: 'a' }, resources, plan: small });
  expect([nodes[3]!.style.backgroundImage, nodes[3]!.style.backgroundPosition, nodes[3]!.style.backgroundSize]).toEqual(['url("/sheet.webp")', '-252.0625px -0.25px', '1176px auto']);
  const large = resolvePreparedPresentation(definition, { selection: { lensId: 'a' }, view: view(900), previousPlan: small });
  presentation.commitSelection({ selection: { lensId: 'a' }, resources, plan: large });
  expect([nodes[3]!.style.backgroundImage, nodes[3]!.style.backgroundPosition, nodes[3]!.style.backgroundSize]).toEqual(['url("/page.webp")', '-84.0625px -0.25px', '168px auto']);
  expect(nodes[1]!.getAttribute('style') ?? '').not.toMatch(/--page-0-/);
});

test('tile leaf records name one texture write each, with finite placements and each leaf once', () => {
  const resources = new Set(['page', 'sheet']);
  expect(() => requireTextureLevels(tiledLevels, tiledVariants, resources)).not.toThrow();
  const broken = (group: Record<string, unknown>) => ({ ...tiledLevels, tileLeaves: [{ ...tileLeaves[0], ...group }] });
  expect(() => requireTextureLevels(broken({ name: '--page-9' }), tiledVariants, resources)).toThrow(/1:--page-9 is not one texture write/);
  expect(() => requireTextureLevels(broken({ width: 0 }), tiledVariants, resources)).toThrow(/width 0/);
  expect(() => requireTextureLevels(broken({ leaves: [[2, 0, 0], [2, 1, 1]] }), tiledVariants, resources)).toThrow(/leaf \[2,1,1\]/);
  expect(() => requireTextureLevels(broken({ leaves: [[2, 0]] }), tiledVariants, resources)).toThrow(/leaf/);
  expect(() => requireTextureLevels(broken({ extra: 1 }), tiledVariants, resources)).toThrow(/unknown fields extra/);
});
