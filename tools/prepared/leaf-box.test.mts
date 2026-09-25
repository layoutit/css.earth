import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { leafBoxBlocks, leafBoxDensity, leafBoxLengths, leafBoxPlacements, prepareLeafBoxBindings, prepareLeafBoxSteps, withLeafBoxes,
  LEAF_BOX_FACTOR, LEAF_BOX_PROPERTY, LEAF_BOX_SCREEN_PIXELS, LEAF_BOX_UNSCALE, type MeasuredLeafBox } from './leaf-box.mts';
import { createPreparedNodeTree } from './prepared-node-tree.mts';
import { unseenTextureWrites } from '../../src/renderers/css/rendering/prepared-texture-levels.ts';

const identity = (scale: number, x = 0, y = 0, z = 0) => [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const layer = (frame: number[], extra: Record<string, unknown> = {}) => ({ schema: 'polycss-prepared-projective-texture-layer@1', rasterScale: 1,
  textureMatrix: identity(1).join(','), frameMatrix: frame.join(','), ...extra });

test('every px length reads the leaf factor, which defaults to one, and zero stays zero', () => {
  assert.equal(leafBoxLengths('-31.256px 0px'), `calc(-31.256px * var(${LEAF_BOX_FACTOR}, 1)) 0px`);
  assert.equal(leafBoxLengths('var(--moon-surface-position)'), 'var(--moon-surface-position)');
});

test('the node builder boxes every projective leaf once, and puts the inverse scale before the seam outset', () => {
  const b = createPreparedNodeTree();
  const node = b.leaf({ style: '--polycss-atlas-width:128px;--polycss-atlas-height:64px;background-position:-32px 0px;background-size:512px 256px',
    projectiveTextureLayer: layer(identity(2, 10, 20, 30), { seamOutset: { property: '--surface-seam-outset', scale: [2, 2] } }) });
  const record = node.style.preparedRecord().properties;
  // Each length is written once, already reading the factor.
  for (const name of ['--polycss-atlas-width', 'backgroundPosition', 'backgroundSize']) assert.equal(record.filter(entry => entry.name === name).length, 1, name);
  assert.equal(node.style.getPropertyValue('--polycss-atlas-width'), `calc(128px * var(${LEAF_BOX_FACTOR}, 1))`);
  const transform = node.style.transform;
  assert.ok(transform.startsWith(`matrix3d(${identity(2, 10, 20, 30).join(',')}) ${LEAF_BOX_UNSCALE} translate(50%, 50%)`), transform);
  // Evaluate the written CSS at factor k: the box shrinks by k and its far corner lands where the full box's did.
  const at = (value: string, k: number) => Number.parseFloat(value.replace(/calc\((-?[\d.]+)px \* var\(--leaf-box, 1\)\)/u, (_, length) => `${Number(length) * k}px`));
  for (const k of [1, 0.5, 0.125]) {
    const width = at(node.style.getPropertyValue('--polycss-atlas-width'), k), height = at(node.style.getPropertyValue('--polycss-atlas-height'), k);
    assert.deepEqual([width / k * 2 + 10, height / k * 2 + 20], [266, 148]);
  }
  // A generator that opts out keeps its full box.
  const full = createPreparedNodeTree().leaf({ style: '--polycss-atlas-width:128px;--polycss-atlas-height:64px;background-position:0px 0px;background-size:512px 256px',
    projectiveTextureLayer: layer(identity(2), { leafBox: false }) });
  assert.equal(full.style.getPropertyValue('--polycss-atlas-width'), '128px');
  assert.ok(!full.style.transform.includes(LEAF_BOX_FACTOR));
});

test('a leaf density is what its box needs per silhouette pixel, at its most magnified line', () => {
  assert.equal(leafBoxDensity(identity(3), 128, 128, 600), LEAF_BOX_SCREEN_PIXELS * 3 / 600);
  // A homography that grows along x: the far edge is the most magnified, and it decides.
  assert.ok(leafBoxDensity([1, 0, 0, -0.001, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 100, 100, 1) > LEAF_BOX_SCREEN_PIXELS);
  assert.throws(() => leafBoxDensity(identity(1), 0, 10, 1), /positive box/);
});

test('steps grow by √2 from the first until every leaf holds its full box', () => {
  const steps = prepareLeafBoxSteps([1 / 1295, 1 / 700]);
  assert.equal(steps.property, LEAF_BOX_PROPERTY);
  assert.deepEqual(steps.levels[0], { minimumDiameter: 0, value: '16' });
  for (const [index, level] of steps.levels.entries()) if (index > 0) {
    // Each step publishes its upper bound, √2 above its threshold.
    assert.ok(Math.abs(Number(level.value) / level.minimumDiameter - Math.SQRT2) < 1e-3, `step ${index}`);
  }
  // The last step reaches a factor of one for the least dense leaf, and the one before it does not.
  assert.ok(Number(steps.levels.at(-1)!.value) / 1295 >= 1);
  assert.ok(steps.levels.at(-1)!.minimumDiameter < 1295);
  assert.throws(() => prepareLeafBoxSteps([]), /positive leaf densities/);
});

// Leaf centres on a sphere of radius 1000 scene units around the origin (a body's scale; placements round to 0.01).
const sphere = Array.from({ length: 400 }, (_, index) => {
  const y = 1 - 2 * (index + 0.5) / 400, ring = Math.sqrt(1 - y * y), angle = index * 2.39996;
  return [Math.cos(angle) * ring * 1000, y * 1000, Math.sin(angle) * ring * 1000];
});

test('blocks group leaves by direction, and their placements count a leaf as seen before it turns into view', () => {
  const blocks = leafBoxBlocks(sphere, [0, 0, 0], 16);
  assert.equal(new Set(blocks).size, 16);
  const points = new Map<string, number[][]>();
  sphere.forEach((centre, index) => points.set(`--step-${blocks[index]}`, [...points.get(`--step-${blocks[index]}`) ?? [], centre]));
  const placements = leafBoxPlacements(points, [0, 0, 0]);
  for (const [name, corners] of points) {
    const write = placements.writes[name]!;
    for (const corner of corners) {
      assert.ok(Math.hypot(...corner.map((value, axis) => value - write.center[axis]!)) <= write.radius + 1e-9, `${name} bounds its leaves`);
      const angle = Math.acos(corner.reduce((sum, value, axis) => sum + value * write.normal[axis]!, 0) / Math.hypot(...corner));
      assert.ok(angle <= write.spread + 1e-9, `${name} spreads over its leaves`);
    }
  }
  // A camera far along +z sees the blocks facing it and none facing away.
  const projection = { eyeFromScene: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10000, 1], principalOffsetPixels: [0, 0], focalPixels: 1000 };
  const unseen = unseenTextureWrites(placements, projection as never, { width: 1000, height: 1000 });
  for (const [name, write] of Object.entries(placements.writes)) {
    if (write.normal[2]! > 0.6) assert.ok(!unseen.has(name), `${name} faces the camera`);
    if (write.normal[2]! < -0.6) assert.ok(unseen.has(name), `${name} faces away`);
  }
});

// A measured surface leaf: a 10-unit square tangent to the sphere at `centre`, drawn from a 20 px box.
const tangentLeaf = (node: number, centre: number[], surface = true): MeasuredLeafBox => {
  const normal = centre.map(value => value / 1000), helper = Math.abs(normal[1]!) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const unit = (a: number[]) => a.map(value => value / Math.hypot(...a));
  const u = unit(cross(helper, normal)), v = unit(cross(normal, u));
  const [x, y] = [u, v].map(axis => axis.map(value => value * 0.5));
  const origin = centre.map((value, axis) => value - (x![axis]! + y![axis]!) * 10);
  return { node, frame: [...x!, 0, ...y!, 0, ...normal, 0, ...origin, 1], width: 20, height: 20, surface };
};

test('a block above the body shows past its horizon, so its spread grows by the altitude angle', () => {
  const low = [[0, 0, 1000], [10, 0, 1000]], high = [[1000, 0, 100], [1010, 0, 100]].map(point => point.map(value => value * 1.1));
  const placements = leafBoxPlacements(new Map([['--step-0', low], ['--step-1', high]]), [0, 0, 0]);
  const shell = placements.writes['--step-1']!, ground = placements.writes['--step-0']!;
  assert.ok(placements.body.radius <= 1000);
  // Heights 1.1 times the body's radius see acos(1 / 1.1) ≈ 0.43 rad past its horizon.
  assert.ok(shell.spread >= Math.acos(placements.body.radius / Math.hypot(...high[1]!)) && shell.spread > ground.spread + 0.4);
});

test('the bindings put each surface leaf in its block, every other leaf in the whole body, and give every leaf one step', () => {
  const leaves = [...sphere.slice(0, 64).map((centre, index) => tangentLeaf(index + 3, centre)), tangentLeaf(99, [0, 1000, 0], false)];
  const { factors, initial, binding } = prepareLeafBoxBindings(leaves, { bodyCentre: [0, 0, 0], bodyDiameter: 2000, target: 2, closed: true, initialDiameter: 460 });
  assert.equal(factors.length, 65);
  assert.ok(factors.every(factor => factor.value === `min(1, var(${LEAF_BOX_PROPERTY}, 1e6) * 0.0005)`));
  assert.deepEqual(initial.map(step => step.name), [LEAF_BOX_PROPERTY]);
  // Every placed block has its leaves; the leaf off the surface is in the whole body's group; no leaf is in two groups.
  const groups = binding.groups;
  assert.ok(binding.placements && Object.keys(binding.placements.writes).every(name => name.startsWith(`${LEAF_BOX_PROPERTY}-`) && groups[name]!.length > 0));
  assert.deepEqual(groups[`${LEAF_BOX_PROPERTY}-body-0`], [99]);
  assert.equal(Object.values(groups).flat().length, 65);
  assert.equal(new Set(Object.values(groups).flat()).size, 65);
  // An open body (a ring system, a shell) has no surface to test against: every leaf follows the whole body.
  const open = prepareLeafBoxBindings(leaves, { bodyCentre: [0, 0, 0], bodyDiameter: 2000, target: 2, closed: false, initialDiameter: 460 });
  assert.ok(!('placements' in open.binding));
  // In chunks of LEAF_BOX_GROUP_LEAVES, so a whole-body step change is spread over frames too.
  assert.deepEqual(Object.values(open.binding.groups).map(group => group.length), [8, 8, 8, 8, 8, 8, 8, 8, 1]);
  assert.ok(Object.keys(open.binding.groups).every(name => name.startsWith(`${LEAF_BOX_PROPERTY}-body-`)));
});

test('measured leaf boxes are written into the tree, and measuring again replaces them', () => {
  const properties = [{ name: 'transform', value: 'matrix3d(1)', custom: false }];
  const nodes = [{ parent: -1, properties: [] }, { parent: 0, properties: [] }, { parent: 1, properties: [] }, { parent: 2, properties: [0] }, { parent: 2, properties: [0] }];
  const definition = { tree: { nodes, properties, camera: 0, scene: 1 }, viewBindings: [{ kind: 'silhouette-fit' }] };
  const measured = { leaves: [tangentLeaf(3, [0, 0, 1000]), tangentLeaf(4, [0, 0, -1000])], bodyCentre: [0, 0, 0] };
  const once = withLeafBoxes(definition, measured, { closed: true, initialDiameter: 460 });
  const twice = withLeafBoxes(once, measured, { closed: true, initialDiameter: 460 });
  assert.deepEqual(twice.tree.nodes, once.tree.nodes);
  assert.equal(once.viewBindings.length, 2);
  assert.equal(twice.viewBindings.length, 2);
  const named = (node: number) => once.tree.nodes[node]!.properties.map(id => once.tree.properties[id]!.name);
  assert.deepEqual(named(3), ['transform', LEAF_BOX_FACTOR]);
  // The leaves' outermost common ancestor below the scene holds the initial step they inherit.
  assert.deepEqual(named(2), [LEAF_BOX_PROPERTY]);
  // With no rendered leaf (a body whose sphere is display: none), an earlier bake's factors, steps and binding go.
  const cleared = withLeafBoxes(once, null, { closed: true, initialDiameter: 460 });
  assert.deepEqual(cleared.tree.nodes.map(node => node.properties.map(id => cleared.tree.properties[id]!.name)), [[], [], [], ['transform'], ['transform']]);
  assert.deepEqual(cleared.viewBindings, [{ kind: 'silhouette-fit' }]);
});

test('a leaf between two blocks joins the same one whatever float noise its measured frame carries', () => {
  // The midpoint of two lattice directions of a 12-block body, and that point nudged by measurement-sized noise.
  const golden = Math.PI * (3 - Math.sqrt(5)), direction = (index: number) => {
    const y = 1 - 2 * (index + 0.5) / 12, ring = Math.sqrt(1 - y * y), angle = golden * index;
    return [Math.cos(angle) * ring, y, Math.sin(angle) * ring];
  };
  const [a, b] = [direction(3), direction(4)], middle = a.map((value, axis) => value + b[axis]!);
  const nudged = [1e-12, -1e-12, 3e-13].map(noise => middle.map(value => value + noise));
  const blocks = leafBoxBlocks([middle, ...nudged, a, b], [0, 0, 0], 12);
  assert.deepEqual(new Set(blocks.slice(0, 4)).size, 1);
});

