import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import { prepareVolumeImpostors } from './volume-impostors.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { PreparedCssVolume, PreparedVolumeLeaf, VolumeAxis, VolumeVector } from '../volume/types.js';
import type { PreparedVolumeLensBrightness } from '../volume/prepared-volume-lenses.js';

const AXES = ['x', 'y', 'z'] as const;
const WHITE: PreparedVolumeLensBrightness = { overall: 1, x: 1, y: 1, z: 1 };
type Rgba = readonly [number, number, number, number];
interface Source {
  axis: VolumeAxis; depth: number; color: Rgba;
  bounds?: readonly [number, number, number, number];
  raster?: { width: number; height: number; data: Uint8Array };
}
interface Fixture { volume: PreparedCssVolume; bytes: Map<string, Uint8Array> }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const dot = (a: VolumeVector, b: VolumeVector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function point(axis: VolumeAxis, depth: number, u: number, v: number): [number, number, number] {
  return axis === 'x' ? [depth, u, v] : axis === 'y' ? [u, depth, v] : [u, v, depth];
}
async function fixture(sources: readonly Source[]): Promise<Fixture> {
  const bytes = new Map<string, Uint8Array>(), leaves: { axis: VolumeAxis; leaf: PreparedVolumeLeaf }[] = [];
  const resources: PreparedCssVolume['resources'][number][] = [];
  for (const [index, source] of sources.entries()) {
    const { axis, depth } = source, id = `${axis}-${index}`, path = `slices/${id}.png`;
    const [u0, u1, v0, v1] = source.bounds ?? [-2, 2, -2, 2];
    const raster = source.raster ?? { width: 1, height: 1, data: Uint8Array.from(source.color) };
    const png = await sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } }).png().toBuffer();
    bytes.set(path, png);
    resources.push({ path, sha256: hash(png), bytes: png.length, width: raster.width, height: raster.height });
    const polygon: Polygon = {
      vertices: [point(axis, depth, u0, v1), point(axis, depth, u1, v1), point(axis, depth, u1, v0), point(axis, depth, u0, v0)],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: path,
      textureImageSource: { url: path, width: raster.width, height: raster.height },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true,
    };
    const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
    assert(plan);
    const geometry = resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    assert(geometry);
    leaves.push({ axis, leaf: { id, centerUnits: point(axis, depth, (u0 + u1) / 2, (v0 + v1) / 2), texturePath: path,
      widthPx: raster.width, heightPx: raster.height, style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`,
        transform: `matrix3d(${geometry.matrix})`, backgroundSize: geometry.backgroundSize.map(n => `${n}px`).join(' '),
        backgroundPosition: geometry.backgroundPosition.map(n => `${n}px`).join(' ') } } });
  }
  return { bytes, volume: { schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [100, -200, 300], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 17, boundsUnits: { min: [-2, -3, -1], max: [4, 2, 1] } }, anchors: [],
    stacks: AXES.map(axis => ({ axis, leaves: leaves.filter(item => item.axis === axis).map(item => item.leaf) })),
    resources, provenance: { fixture: true }, approximation: {} } };
}
async function bake(input: Fixture, brightness = WHITE, volume = input.volume) {
  const written = new Map<string, Uint8Array>(), reads: string[] = [];
  const result = await prepareVolumeImpostors({ volume, brightness, prefix: 'fixture/impostors',
    readResource: async path => { reads.push(path); const bytes = input.bytes.get(path); assert(bytes); return bytes; },
    writeResource: async (path, bytes) => { written.set(path, bytes); } });
  const image = async (direction: VolumeVector) => {
    const length = Math.hypot(...direction), normalized = direction.map(value => value / length);
    const view = result.impostors!.views.find(candidate => candidate.back.every((value, axis) => Math.abs(value - normalized[axis]!) < 1e-12));
    assert(view); const bytes = written.get(view.texturePath); assert(bytes);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, info, view };
  };
  return { result, written, reads, image };
}
function near(actual: number, expected: number, tolerance = 1): void {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${actual} within ${tolerance} of ${expected}`);
}
function over(destination: number[], source: readonly number[], opacity = 1): number[] {
  const alpha = source[3]! * opacity;
  return [source[0]! * opacity + destination[0]! * (1 - alpha), source[1]! * opacity + destination[1]! * (1 - alpha),
    source[2]! * opacity + destination[2]! * (1 - alpha), alpha + destination[3]! * (1 - alpha)];
}

test('26 pinned views use an origin-centered radius and canonical orthonormal basis, and rebake reproducibly', async () => {
  const input = await fixture(AXES.map(axis => ({ axis, depth: 0, color: [80, 100, 120, 100] })));
  const baked = await bake(input), bank = baked.result.impostors!;
  assert.equal(bank.schema, 'cssearth-volume-impostors@1'); assert.equal(bank.radiusUnits, Math.sqrt(26));
  assert.equal(bank.fullBelowDiameterPixels, 128); assert.equal(bank.volumeAboveDiameterPixels, 256);
  assert.equal(bank.views.length, 26); assert.equal(new Set(bank.views.map(view => view.id)).size, 26);
  assert.equal(baked.written.size, 26); assert.equal(baked.result.resources.length, input.volume.resources.length + 26);
  assert.deepEqual(baked.result.stacks, input.volume.stacks); assert.equal(input.volume.impostors, undefined);
  assert.deepEqual(validatePreparedCssVolume(baked.result), baked.result);
  for (const view of bank.views) {
    near(Math.hypot(...view.back), 1, 1e-12); near(Math.hypot(...view.right), 1, 1e-12); near(Math.hypot(...view.down), 1, 1e-12);
    near(dot(view.back, view.right), 0, 1e-12); near(dot(view.back, view.down), 0, 1e-12); near(dot(view.down, view.right), 0, 1e-12);
    const up: VolumeVector = Math.abs(view.back[1]) > .99 ? [0, 0, 1] : [0, 1, 0];
    assert(dot(view.down, up) < 0, 'Top of every PNG is the canonical camera up direction');
    const bytes = baked.written.get(view.texturePath)!;
    const metadata = baked.result.resources.find(resource => resource.path === view.texturePath)!;
    assert.equal(metadata.sha256, hash(bytes)); assert.equal(metadata.bytes, bytes.byteLength);
    assert.equal(metadata.width, 256); assert.equal(metadata.height, 256);
    const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, 256); assert.equal(decoded.info.height, 256); assert.equal(decoded.info.channels, 4);
    assert(decoded.data.some(value => value > 0), 'Every view must actually contain the prepared signal');
  }
  const repeated = await bake(input, WHITE, baked.result);
  assert.deepEqual(repeated.result, baked.result); assert.deepEqual(repeated.written, baked.written);
});

test('actual compiled crop positions register on both sides of every principal physical axis', async () => {
  const sources: Source[] = AXES.map((axis, index) => ({ axis, depth: .3, bounds: [.4, 1.2, -.9, -.1],
    color: [index === 0 ? 255 : 0, index === 1 ? 255 : 0, index === 2 ? 255 : 0, 255] }));
  const baked = await bake(await fixture(sources));
  for (const [axisIndex, source] of sources.entries()) for (const sign of [-1, 1]) {
    const direction: [number, number, number] = [0, 0, 0]; direction[axisIndex] = sign;
    const { data, view } = await baked.image(direction), center = point(source.axis, .3, .8, -.5);
    let count = 0, xSum = 0, ySum = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const p = (y * 256 + x) * 4;
      if (data[p + 3]! === 0) continue;
      assert.equal(data[p + axisIndex], 255); count++; xSum += x + .5; ySum += y + .5;
    }
    assert(count > 100);
    near(xSum / count, 128 + dot(view.right, center) * 128 / Math.sqrt(26), .75);
    near(ySum / count, 128 + dot(view.down, center) * 128 / Math.sqrt(26), .75);
  }
});

test('front/back order, fractional optical copies, normalized source-over axes and completed brightness match the runtime', async () => {
  const colors: Record<VolumeAxis, readonly Rgba[]> = { x: [[255, 0, 0, 80], [0, 0, 255, 160]],
    y: [[0, 255, 0, 100], [255, 0, 0, 50]], z: [[0, 0, 255, 40], [0, 255, 0, 120]] };
  const sources: Source[] = AXES.flatMap(axis => colors[axis].map((color, index) => ({ axis, depth: index === 0 ? -.2 : .2, color })));
  const input = await fixture(sources);
  // A wrong implementation using source metadata or input order must fail.
  input.volume = { ...input.volume, stacks: input.volume.stacks.map(stack => ({ ...stack,
    leaves: [...stack.leaves].reverse().map(leaf => ({ ...leaf, centerUnits: [99, -99, 99] })) })) };
  const brightness: PreparedVolumeLensBrightness = { overall: .8, x: .2, y: .6, z: .9 };
  const baked = await bake(input, brightness);
  for (const view of baked.result.impostors!.views) {
    const { data } = await baked.image(view.back);
    const active = AXES.filter((_, index) => view.back[index] !== 0), gain = Math.sqrt(active.length);
    let mixed = [0, 0, 0, 0], count = 0, brightnessSum = 0;
    for (const axis of active) {
      let stack = [0, 0, 0, 0];
      const ordered = view.back[AXES.indexOf(axis)]! > 0 ? colors[axis] : [...colors[axis]].reverse();
      for (const color of ordered) {
        const alpha = color[3] / 255, premult = [color[0] / 255 * alpha, color[1] / 255 * alpha, color[2] / 255 * alpha, alpha];
        // Explicitly composite each coincident runtime copy, independently of the baker formula.
        for (let copy = 0; copy < 3; copy++) stack = over(stack, premult, Math.max(0, Math.min(1, gain - copy)));
      }
      count++; brightnessSum += brightness[axis]; mixed = over(mixed, stack, 1 / count);
    }
    const attenuation = brightness.overall * brightnessSum / count, p = (128 * 256 + 128) * 4;
    near(data[p + 3]!, Math.round(mixed[3]! * attenuation * 255));
    for (let c = 0; c < 3; c++) near(data[p + c]!, Math.round(mixed[c]! / mixed[3]! * 255));
  }
});

test('bilinear sampling uses premultiplied alpha and actual CSS background registration', async () => {
  const input = await fixture(AXES.map(axis => ({ axis, depth: 0, color: [0, 0, 0, 0],
    ...(axis === 'z' ? { raster: { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 0]) } } : {}) })));
  const baked = await bake(input), { data } = await baked.image([0, 0, 1]);
  let transitionPixels = 0;
  for (let p = 0; p < data.length; p += 4) if (data[p + 3]! > 10 && data[p + 3]! < 245) {
    assert.equal(data[p], 255); assert.equal(data[p + 1], 0); assert.equal(data[p + 2], 0); transitionPixels++;
  }
  assert(transitionPixels > 100, 'The fixture must sample across the texel transition');
  const z = input.volume.stacks.find(stack => stack.axis === 'z')!.leaves[0]!;
  const shifted: PreparedCssVolume = { ...input.volume, stacks: input.volume.stacks.map(stack => stack.axis !== 'z' ? stack :
    { ...stack, leaves: [{ ...z, style: { ...z.style, backgroundPosition: `${Number.parseFloat(z.style.width) / 2}px 0px` } }] }) };
  const moved = await bake(input, WHITE, shifted), movedImage = await moved.image([0, 0, 1]);
  assert.notDeepEqual(movedImage.data, data, 'CSS image offset must affect the bake');
  assert(movedImage.data.some((value, p) => p % 4 === 3 && value > 0), 'Shifted source must still render');
});

test('rejects source identity errors, unsafe output collisions and unsupported projection geometry before writing', async () => {
  const input = await fixture(AXES.map(axis => ({ axis, depth: 0, color: [255, 255, 255, 100] })));
  let writes = 0;
  const options = { volume: input.volume, brightness: WHITE, prefix: 'fixture/impostors',
    readResource: async (path: string) => { const bytes = input.bytes.get(path); assert(bytes); return bytes; },
    writeResource: async () => { writes++; } };
  await assert.rejects(prepareVolumeImpostors({ ...options, prefix: '../escape' }), /safe relative/);
  await assert.rejects(prepareVolumeImpostors({ ...options, brightness: { ...WHITE, x: 2 } }), /brightness/);
  await assert.rejects(prepareVolumeImpostors({ ...options, readResource: async () => new Uint8Array([1]) }), /identity mismatch/);
  const source = input.volume.resources[0]!;
  await assert.rejects(prepareVolumeImpostors({ ...options, volume: { ...input.volume, resources: [...input.volume.resources,
    { ...source, path: 'fixture/impostors/view-nnn.png' }] } }), /overwrite a source/);
  const first = input.volume.stacks[0]!.leaves[0]!, m = first.style.transform.slice(9, -1).split(',').map(Number);
  m[3] = .1;
  await assert.rejects(prepareVolumeImpostors({ ...options, volume: { ...input.volume,
    stacks: input.volume.stacks.map((stack, index) => index > 0 ? stack : { ...stack, leaves: [{ ...first,
      style: { ...first.style, transform: `matrix3d(${m})` } }] }) } }), /affine CSS matrix/);
  assert.equal(writes, 0);
});

test('leaves that share one delivered atlas render the same views as leaves that own their textures', async () => {
  // Delivered lens banks pack every slice of an axis into one atlas image, which is how the Magellanic Clouds ship.
  // The leaf's CSS background is the mapping, so the same pixels must come out either way, with one decode per image.
  const raster = (color: Rgba) => ({ width: 4, height: 4, data: Uint8Array.from(Array.from({ length: 16 }, () => color).flat()) });
  const red = raster([220, 40, 40, 255]), blue = raster([40, 80, 220, 255]);
  const separate = await fixture([
    { axis: 'x', depth: 0, color: [90, 90, 90, 255], raster: raster([90, 90, 90, 255]) },
    { axis: 'y', depth: 0, color: [60, 60, 60, 255], raster: raster([60, 60, 60, 255]) },
    { axis: 'z', depth: -0.5, color: [220, 40, 40, 255], raster: red },
    { axis: 'z', depth: 0.5, color: [40, 80, 220, 255], raster: blue },
  ]);
  // One image holding both slices, each with the edge bleed the packer writes so bilinear taps never cross a tile.
  const ATLAS_WIDTH = 10, TILE_ORIGIN = [0, 6];
  const atlasData = new Uint8Array(ATLAS_WIDTH * 4 * 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < ATLAS_WIDTH; x++) {
    const source = x < 5 ? red : blue, sx = Math.min(3, Math.max(0, (x < 5 ? x : x - 6)));
    for (let c = 0; c < 4; c++) atlasData[(y * ATLAS_WIDTH + x) * 4 + c] = source.data[(y * 4 + sx) * 4 + c]!;
  }
  const atlasPng = await sharp(atlasData, { raw: { width: ATLAS_WIDTH, height: 4, channels: 4 } }).png().toBuffer();
  const atlasPath = 'atlases/z.png';
  const leaves = separate.volume.stacks.find(stack => stack.axis === 'z')!.leaves;
  const atlased = validatePreparedCssVolume({ ...separate.volume,
    stacks: separate.volume.stacks.map(stack => stack.axis !== 'z' ? stack : { ...stack,
      leaves: stack.leaves.map((leaf, index) => {
        const [backgroundWidth, backgroundHeight] = leaf.style.backgroundSize.split(' ').map(Number.parseFloat);
        const [backgroundX, backgroundY] = leaf.style.backgroundPosition.split(' ').map(Number.parseFloat);
        // The background widens with the atlas and the offset walks to this leaf's tile, so the leaf still covers
        // exactly the pixels it owned when it had its own image.
        const perPixel = backgroundWidth! / 4;
        return { ...leaf, texturePath: atlasPath, style: { ...leaf.style,
          backgroundSize: `${backgroundWidth! * (ATLAS_WIDTH / 4)}px ${backgroundHeight}px`,
          backgroundPosition: `${backgroundX! - TILE_ORIGIN[index]! * perPixel}px ${backgroundY}px` } };
      }) }),
    resources: [...separate.volume.resources.filter(resource => !leaves.some(leaf => leaf.texturePath === resource.path)),
      { path: atlasPath, sha256: hash(atlasPng), bytes: atlasPng.length, width: ATLAS_WIDTH, height: 4 }] });
  const atlasFixture = { volume: atlased, bytes: new Map([...separate.bytes, [atlasPath, atlasPng]]) };
  const one = await bake(separate), two = await bake(atlasFixture);
  assert.equal(two.reads.filter(path => path === atlasPath).length, 1, 'A shared atlas is decoded once.');
  for (const direction of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1]] as VolumeVector[]) {
    const expected = await one.image(direction), actual = await two.image(direction);
    assert.deepEqual([...actual.data], [...expected.data], `Atlased view ${actual.view.id} differs.`);
  }
});

test('an atlased leaf whose background does not cover its texture is refused', async () => {
  const white = { width: 4, height: 4, data: Uint8Array.from(Array.from({ length: 16 }, () => [255, 255, 255, 255]).flat()) };
  const input = await fixture([{ axis: 'x', depth: 0, color: [255, 255, 255, 255], raster: white },
    { axis: 'y', depth: 0, color: [255, 255, 255, 255], raster: white },
    { axis: 'z', depth: 0, color: [255, 255, 255, 255], raster: white }]);
  const broken = { ...input.volume, stacks: input.volume.stacks.map(stack => stack.axis !== 'z' ? stack : { ...stack,
    leaves: stack.leaves.map(leaf => ({ ...leaf, style: { ...leaf.style, backgroundSize: '3px 3px' } })) }) };
  await assert.rejects(bake(input, WHITE, broken), /background does not cover/u);
});
