import assert from 'node:assert/strict';
import test from 'node:test';
import { type CompilerBakeResult, createRenderElementBudget } from '@cssearth/bake/volume';
import { CSS_COMPILER_RENDER_BUDGET } from '../../../src/renderers/css/volume/compiler-render-budget.js';
import type { PreparedCssVolume, VolumeVector } from '../../../src/renderers/css/volume/types.js';
import type { PreparedVolumeLenses } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { assertCompilerDeliveryElementBudget } from './element-budget.ts';

const axes = ['x', 'y', 'z'] as const;
const frame = { referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2451545, metersPerUnit: 1,
  originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
function sampling(counts = { x: 50, y: 50, z: 50 }, stars = 3): CompilerBakeResult['sampling'] {
  return { imageWidth: 512, samplesPerSlab: 4, sliceCounts: counts,
    renderBudget: createRenderElementBudget(CSS_COMPILER_RENDER_BUDGET, stars, counts.x + counts.y + counts.z) };
}
function volume(id: string, counts: Record<typeof axes[number], number>, impostorCount: number): PreparedCssVolume {
  const resource = (path: string) => ({ path, width: 1, height: 1, bytes: 1, sha256: 'a'.repeat(64) });
  const views = Array.from({ length: impostorCount }, (_, index) => ({ id: `view-${index}`, texturePath: `${id}/view-${index}.png`,
    back: [0, 0, 1] as VolumeVector, right: [1, 0, 0] as VolumeVector, down: [0, -1, 0] as VolumeVector }));
  return { schema: 'cssearth-css-volume@1', id, frame, anchors: [], provenance: {}, approximation: {},
    stacks: axes.map(axis => ({ axis, leaves: Array.from({ length: counts[axis] }, (_, index) => ({
      id: `${axis}-${index}`, centerUnits: [0, 0, 0], texturePath: `${id}/${axis}.png`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' },
    })) })),
    resources: [...axes.map(axis => resource(`${id}/${axis}.png`)), ...views.map(view => resource(view.texturePath))],
    ...(impostorCount ? { impostors: { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
      fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32, views } } : {}),
  };
}
function bank(counts = { x: 50, y: 50, z: 50 }, stars = 3, impostors = 26): PreparedVolumeLenses {
  return { schema: 'cssearth-volume-lenses@1', id: 'fixture', defaultLens: 'first', framingRadiusUnits: 1, starsEnabled: false,
    lenses: ['first', 'second'].map(id => ({ id, label: id, title: id, description: 'Test delivery', sourceUrl: 'https://example.org/source',
      volume: volume(id, counts, impostors), brightness: { overall: 1, x: 1, y: 1, z: 1 },
      stars: { frame, points: Array.from({ length: stars }, (_, index) => ({ id: `star-${index}`,
        positionUnits: [0, 0, 0], sizePx: 1, opacity: 0, colorCss: '#ffffff' })) },
    })) };
}

test('final delivery counts all retained XYZ copies and hidden stars once across shared lenses', () => {
  assert.deepEqual(assertCompilerDeliveryElementBudget(sampling(), bank()),
    { starCount: 3, slabCount: 150, impostorCount: 26, totalElements: 499 });
});
test('transparent slab pruning preserves the saved plan receipt while lowering actual delivery cost', () => {
  assert.deepEqual(assertCompilerDeliveryElementBudget(sampling(), bank({ x: 49, y: 48, z: 47 })),
    { starCount: 3, slabCount: 144, impostorCount: 26, totalElements: 481 });
});
test('a bank without impostors does not report the three absent LOD wrappers', () => {
  assert.deepEqual(assertCompilerDeliveryElementBudget(sampling(), bank(undefined, 3, 0)),
    { starCount: 3, slabCount: 150, impostorCount: 0, totalElements: 470 });
});
test('a delivery cannot add field stars beyond the compiler reservation, even when disabled', () => {
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling(), bank(undefined, 4)), /star reservation/);
});
test('delivery cannot move or add leaves outside its admitted XYZ count profile', () => {
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling(), bank({ x: 51, y: 49, z: 50 })), /planned XYZ/);
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling(), bank({ x: 51, y: 50, z: 50 })), /planned XYZ/);
});
test('a second retained topology is rejected even when each lens independently fits the cap', () => {
  const data = bank({ x: 1, y: 1, z: 1 }, 0), second = data.lenses[1]!;
  const altered = { ...second, volume: { ...second.volume, stacks: second.volume.stacks.map(stack => ({ ...stack,
    leaves: stack.leaves.map(leaf => ({ ...leaf, centerUnits: [0, 0, .1] as VolumeVector })) })) } };
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling({ x: 1, y: 1, z: 1 }, 0),
    { ...data, lenses: [data.lenses[0]!, altered] }), /one retained topology/);
});
test('separate occulting roots and excess impostors are outside the tested CSS cost profile', () => {
  const data = bank();
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling(), { ...data,
    lenses: data.lenses.map(lens => ({ ...lens, occultingCentreUnits: [0, 0, 0] })) }), /occulting/);
  assert.throws(() => assertCompilerDeliveryElementBudget(sampling(), bank(undefined, 3, 27)), /26 impostors/);
});
test('saved counters and host profile cannot conceal an over-budget or unrelated receipt', () => {
  const saved = sampling();
  assert.throws(() => assertCompilerDeliveryElementBudget({ ...saved,
    renderBudget: { ...saved.renderBudget!, totalElements: 499 } }, bank()), /budget differs/);
  const relaxed = { ...CSS_COMPILER_RENDER_BUDGET, maximumElements: 501 };
  assert.throws(() => assertCompilerDeliveryElementBudget({ ...saved,
    renderBudget: createRenderElementBudget(relaxed, 4, 150) }, bank(undefined, 4)), /profile differs/);
});
test('historical omission does not impose a new quota or mutate an accepted delivery', () => {
  const data = bank({ x: 170, y: 170, z: 170 }, 500), before = JSON.stringify(data);
  assert.equal(assertCompilerDeliveryElementBudget(undefined, data), undefined);
  assert.equal(assertCompilerDeliveryElementBudget({ imageWidth: 512, samplesPerSlab: 4,
    sliceCounts: { x: 170, y: 170, z: 170 } }, data), undefined);
  assert.equal(JSON.stringify(data), before);
});
