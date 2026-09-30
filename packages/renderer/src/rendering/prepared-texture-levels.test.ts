import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createTextureTileWriter, selectPreparedTextureLevel, textureTileLeafStyles, tiledTextureKeys, type PreparedTextureTileLeaves } from './prepared-texture-levels.js';
import { mountPreparedPresentation, resolvePreparedPresentation, type PreparedPresentationDefinition } from './prepared-presentation.js';
import type { PreparedResources } from './prepared-residency.js';
import { requireTextureLevels } from '../validation/presentation.js';

const textureLevels = { hysteresis: 0.2, levels: [
  { minimumDiameter: 0, resources: { a: 'a-small', b: 'b-small' } },
  { minimumDiameter: 230, resources: { a: 'a', b: 'b' } },
] };
const variants = ['a', 'b'].map(datasetId => ({ when: { datasetId }, required: [datasetId], materials: [],
  writes: [{ kind: 'texture' as const, resource: datasetId, target: 2, name: 'backgroundImage', quoted: true }] }));
const definition = { textureLevels, variants, materials: [] } as unknown as PreparedPresentationDefinition;

test('startup demands the camera texture level and only the selected dataset', () => {
  const view = { sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } };
  const initial = resolvePreparedPresentation(definition, { selection: { datasetId: 'a' }, view });
  assert.deepEqual(initial.required, ['a']);
  const refined = resolvePreparedPresentation(definition, { selection: { datasetId: 'a' }, view, previousPlan: initial });
  assert.deepEqual(refined.required, ['a']);
  assert.deepEqual(resolvePreparedPresentation(definition, { selection: { datasetId: 'b' }, view }).required, ['b']);
});

test('zoom hysteresis retains detail at a boundary and downgrades outside it', () => {
  assert.equal(selectPreparedTextureLevel(textureLevels, 231, 0), 1);
  assert.equal(selectPreparedTextureLevel(textureLevels, 200, 1), 1);
  assert.equal(selectPreparedTextureLevel(textureLevels, 183, 1), 0);
  assert.equal(selectPreparedTextureLevel(textureLevels, 200, 0), 0);
  assert.equal(selectPreparedTextureLevel(textureLevels, null, 0), 1);
});

test('a fixed level applies from the first demand and stays fixed through zoom', () => {
  const fixed = { ...textureLevels, fixedLevel: 0 };
  assert.equal(selectPreparedTextureLevel(fixed, 900, undefined), 0);
  assert.equal(selectPreparedTextureLevel({ ...textureLevels, fixedLevel: 1 }, 900, undefined), 1);
  assert.equal(selectPreparedTextureLevel({ ...textureLevels, fixedLevel: 1 }, 10, 0), 1);
  assert.equal(selectPreparedTextureLevel(fixed, 900, 0), 0);
  assert.equal(selectPreparedTextureLevel(fixed, null, 0), 0);
  assert.doesNotThrow(() => requireTextureLevels(fixed, variants, new Set(['a', 'b', 'a-small', 'b-small'])));
  assert.throws(() => requireTextureLevels({ ...fixed, fixedLevel: 2 }, variants, new Set(['a', 'b', 'a-small', 'b-small'])));
});

test('external texture plans reject undeclared, incomplete or reordered levels', () => {
  const resources = new Set(['a', 'b', 'a-small', 'b-small']);
  assert.doesNotThrow(() => requireTextureLevels(textureLevels, variants, resources));
  const mutate = (edit: (copy: typeof textureLevels) => void) => {
    const copy = structuredClone(textureLevels); edit(copy);
    assert.throws(() => requireTextureLevels(copy, variants, resources));
  };
  mutate(copy => { copy.levels[0].resources.a = 'missing'; });
  mutate(copy => { delete (copy.levels[0].resources as Record<string, string>).b; });
  mutate(copy => { copy.levels[1].minimumDiameter = 0; });
  // A body capped below its canonical page (maximumWidth) offers a smaller page as its top level.
  const capped = structuredClone(textureLevels); capped.levels[1].resources.a = 'a-small';
  assert.doesNotThrow(() => requireTextureLevels(capped, variants, resources));
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
  const placedDefinition = { textureLevels: placed, materials: [], variants: [{ when: { datasetId: 'a' }, required: written, materials: [],
    writes: written.map((resource, target) => ({ kind: 'texture' as const, resource, target, name: `--page-${resource}`, quoted: true })) }] } as unknown as PreparedPresentationDefinition;
  assert.doesNotThrow(() => requireTextureLevels(placed, placedDefinition.variants, new Set([...written, ...written.map(key => `${key}-small`)])));
  // The eye sits 500 px in front of the body centre on +z, looking at it.
  const eyeFromScene = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-500,1];
  const view = (motionAtRest: boolean, width = 800, height = 600) => ({ sceneMatrix: '', sunViewDirection: null, motionAtRest, viewportWidth: width, viewportHeight: height,
    projection: { focalPixels: 1000, principalOffsetPixels: [0, 0] as [number, number], eyeFromScene },
    levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } });
  const plan = (at: ReturnType<typeof view>) => resolvePreparedPresentation(placedDefinition, { selection: { datasetId: 'a' }, view: at, previousPlan: { textureLevel: 1 } as never }).required;
  // The far side is behind the body; the side page is on screen at the limb.
  assert.deepEqual(plan(view(true)), ['front', 'back-small', 'aside']);
  // A small screen, with its quarter-screen margin, leaves the side page (projected 200 px off centre) out of view.
  assert.deepEqual(plan(view(true, 100, 100)), ['front', 'back-small', 'aside-small']);
  // The eye transform carries the scene's scale (0.02 here, as a mounted camera's does): the same view, the same pages.
  const scaled = (width: number, height: number) => ({ ...view(true, width, height), projection: { ...view(true).projection,
    eyeFromScene: [0.02,0,0,0, 0,0.02,0,0, 0,0,0.02,0, 0,0,-10,1], focalPixels: 1000 } });
  assert.deepEqual(plan(scaled(800, 600)), ['front', 'back-small', 'aside']);
  assert.deepEqual(plan(scaled(100, 100)), ['front', 'back-small', 'aside-small']);
  // While the body spins, the prepared placements no longer hold: every page takes the selected level.
  assert.deepEqual(plan(view(false)), ['front', 'back', 'aside']);
  assert.throws(() => requireTextureLevels({ ...placed, placements: { ...placed.placements, writes: { '--unwritten': page([0, 0, 0], [0, 0, 1]) } } },
    placedDefinition.variants, new Set([...written, ...written.map(key => `${key}-small`)])), /--unwritten/);
});

test('a sheet level plans each page as a tile of one shared image; the page level plans the pages themselves', () => {
  const sheet = { hysteresis: 0.2, levels: [
    { minimumDiameter: 0, resources: { a: 'sheet', b: 'sheet' }, tiles: { a: { x: 0, y: 0, scale: 2 }, b: { x: 3, y: 0, scale: 2 } } },
    { minimumDiameter: 230, resources: { a: 'a', b: 'b' } },
  ] };
  const both = [{ when: { datasetId: 'a' }, required: ['a', 'b'], materials: [], writes: ['a', 'b'].map((resource, i) =>
    ({ kind: 'texture' as const, resource, target: i, name: `--page-${i}`, quoted: true })) }];
  const paged = { textureLevels: sheet, variants: both, materials: [] } as unknown as PreparedPresentationDefinition;
  const view = { sceneMatrix: '', sunViewDirection: null, levelOfDetail: { stage: 'geometry', silhouetteDiameter: 900, billboardOpacity: 0, markerOpacity: 0 } };
  const initial = resolvePreparedPresentation(paged, { selection: { datasetId: 'a' }, view: { ...view, levelOfDetail: { ...view.levelOfDetail, silhouetteDiameter: 100 } } });
  // One decode for both pages.
  assert.deepEqual(initial.required, ['sheet']);
  assert.deepEqual(initial.textureTiles, sheet.levels[0]!.tiles);
  const refined = resolvePreparedPresentation(paged, { selection: { datasetId: 'a' }, view, previousPlan: initial });
  assert.deepEqual(refined.required, ['a', 'b']);
  assert.equal(refined.textureTiles, undefined);
  assert.deepEqual(([...tiledTextureKeys(sheet)]), ['a', 'b']);
  // A leaf of page b, 0.25 px into it: on the sheet it moves by the tile's offset and draws the sheet twice the page's width.
  assert.deepEqual(textureTileLeafStyles({ unit: -1, width: 168 }, 0.25, 84.0625, sheet.levels[0]!.tiles!.b), [['backgroundPosition', '-3.25px -84.0625px'], ['backgroundSize', '336px auto']]);
  assert.deepEqual(textureTileLeafStyles({ unit: -1, width: 168 }, 0.25, 84.0625, undefined), [['backgroundPosition', '-0.25px -84.0625px'], ['backgroundSize', '168px auto']]);
  assert.doesNotThrow(() => requireTextureLevels(sheet, both, new Set(['a', 'b', 'sheet'])));
  assert.throws(() => requireTextureLevels({ ...sheet, levels: [{ ...sheet.levels[0], tiles: { a: { x: 0, y: 0, scale: 0.5 } } }, sheet.levels[1]] }, both, new Set(['a', 'b', 'sheet'])), /tile a/);
});


test('system-scale proxies require no detail images and acquire them on geometry entry', () => {
  const at = (stage: string) => ({sceneMatrix: '', sunViewDirection: null,
    levelOfDetail: {stage, silhouetteDiameter: 13, billboardOpacity: 1, markerOpacity: 0}});
  for (const stage of ['marker', 'billboard']) {
    const plan = resolvePreparedPresentation(definition, {selection: {datasetId: 'a'}, view: at(stage)});
    assert.equal(plan.deferredTextures, true);
    assert.deepEqual(plan.required, []);
    assert.deepEqual(plan.prewarm, []);
  }
  const detail = resolvePreparedPresentation(definition, {selection: {datasetId: 'a'}, view: at('geometry')});
  assert.deepEqual(detail.required, ['a-small']);
  assert.equal(detail.deferredTextures, undefined);
});

// Two of Earth's page leaves (packages/bake/src/presentation/texture-tile-records.ts): page 0's first two leaves under the
// body, node 1, whose image write is --page-0.
const tileLeaves: PreparedTextureTileLeaves[] = [{ target: 1, name: '--page-0', unit: -1, width: 168, initial: { x: 168, y: 0, scale: 7 }, leaves: [[2, 0.25, 0.25], [3, 84.0625, 0.25]] }];
const tiledLevels = { hysteresis: 0.2, tileLeaves, levels: [
  { minimumDiameter: 0, resources: { page: 'sheet' }, tiles: { page: { x: 168, y: 0, scale: 7 } } },
  { minimumDiameter: 230, resources: { page: 'page' } },
] };
const tiledVariants = [{ when: { datasetId: 'a' }, required: ['page'], materials: [], writes: [{ kind: 'texture' as const, resource: 'page', target: 1, name: '--page-0', quoted: true }] }];

test('a tiled page leaf takes its final placement directly and writes only what changes', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2, 3].map(() => document.createElement('s'));
  // The prepared literal values at the initial tile, as the tree or server markup sets them.
  nodes[2]!.style.setProperty('background-position', '-168.25px -0.25px'); nodes[2]!.style.setProperty('background-size', '1176px auto');
  const writes: [number, string, string][] = [];
  const writer = createTextureTileWriter(tiledLevels, nodes, (element, name, value) => {
    writes.push([nodes.indexOf(element), name, value]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value);
  });
  assert.equal(writer.has(1, '--page-0'), true);
  // Node 2 already shows the sheet tile; node 3 has no prepared value yet.
  assert.equal(writer.publish(1, '--page-0', tiledLevels.levels[0]!.tiles!.page), 2);
  assert.deepEqual(writes, [[3, 'backgroundPosition', '-252.0625px -0.25px'], [3, 'backgroundSize', '1176px auto']]);
  assert.equal(writer.publish(1, '--page-0', tiledLevels.levels[0]!.tiles!.page), 0);
  writes.length = 0;
  // The page level draws the page itself: offsets lose the tile's, the size is the page's.
  assert.equal(writer.publish(1, '--page-0', undefined), 4);
  assert.deepEqual(writes.map(([node, name, value]) => `${node} ${name} ${value}`), [
    '2 backgroundPosition -0.25px -0.25px', '2 backgroundSize 168px auto', '3 backgroundPosition -84.0625px -0.25px', '3 backgroundSize 168px auto']);
  for (const node of nodes) assert.doesNotMatch((node.getAttribute('style') ?? ''), /var\(|calc\(|--/);
  assert.equal(writer.publish(1, '--other', undefined), 0);
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
  const small = resolvePreparedPresentation(definition, { selection: { datasetId: 'a' }, view: view(100) });
  presentation.commitSelection({ selection: { datasetId: 'a' }, resources, plan: small });
  assert.deepEqual(([nodes[3]!.style.backgroundImage, nodes[3]!.style.backgroundPosition, nodes[3]!.style.backgroundSize]), ['url("/sheet.webp")', '-252.0625px -0.25px', '1176px auto']);
  const large = resolvePreparedPresentation(definition, { selection: { datasetId: 'a' }, view: view(900), previousPlan: small });
  presentation.commitSelection({ selection: { datasetId: 'a' }, resources, plan: large });
  assert.deepEqual(([nodes[3]!.style.backgroundImage, nodes[3]!.style.backgroundPosition, nodes[3]!.style.backgroundSize]), ['url("/page.webp")', '-84.0625px -0.25px', '168px auto']);
  assert.doesNotMatch((nodes[1]!.getAttribute('style') ?? ''), /--page-0-/);
});

test('tile leaf records name one texture write each, with finite placements and each leaf once', () => {
  const resources = new Set(['page', 'sheet']);
  assert.doesNotThrow(() => requireTextureLevels(tiledLevels, tiledVariants, resources));
  const broken = (group: Record<string, unknown>) => ({ ...tiledLevels, tileLeaves: [{ ...tileLeaves[0], ...group }] });
  assert.throws(() => requireTextureLevels(broken({ name: '--page-9' }), tiledVariants, resources), /1:--page-9 is not one texture write/);
  assert.throws(() => requireTextureLevels(broken({ width: 0 }), tiledVariants, resources), /width 0/);
  assert.throws(() => requireTextureLevels(broken({ leaves: [[2, 0, 0], [2, 1, 1]] }), tiledVariants, resources), /leaf \[2,1,1\]/);
  assert.throws(() => requireTextureLevels(broken({ leaves: [[2, 0]] }), tiledVariants, resources), /leaf/);
  assert.throws(() => requireTextureLevels(broken({ extra: 1 }), tiledVariants, resources), /unknown fields extra/);
});
