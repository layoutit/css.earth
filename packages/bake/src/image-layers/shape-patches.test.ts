import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_GUTTER_PIXELS, ATLAS_PIXELS, imageLayerShapePatches, PATCH_LEAST_PIXELS, PATCH_OVERLAP_PIXELS, packShapePatches, SCENE_MOST_PATCHES, type ShapePatch } from './shape-patches.ts';
import type { ShapeWalls } from './shape-walls.ts';

const SIZE = 200, TAU = 0.8;

/** Surfaces over a picture of SIZE pixels, a pixel a unit: where `depth` gives one, a near surface that far in front
 * of the picture's plane and a far one as far behind, each with the same light. */
function walls(depth: (x: number, y: number) => number | null): ShapeWalls {
  const count = SIZE * SIZE, layer = (sign: number, shade: number) => { const made = { depth: new Float32Array(count).fill(NaN), tau: new Float32Array(count), hue: new Uint8Array(3 * count).fill(shade) };
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const at = depth(x + .5, y + .5); if (at !== null) { made.depth[y * SIZE + x] = sign * at; made.tau[y * SIZE + x] = TAU; } }
    return made; };
  const near = layer(-1, 200), far = layer(1, 90), sharp = new Uint8Array(count); let pixels = 0;
  for (let p = 0; p < count; p++) if (!Number.isNaN(near.depth[p]!)) { sharp[p] = 1; pixels++; }
  return { layers: [near, far], sharp, pixels };
}
const overlap = (a: ShapePatch, b: ShapePatch) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const depthAt = (patch: ShapePatch, x: number, y: number) => patch.depth + patch.right * (x - patch.left) + patch.down * (y - patch.top);
const middle = (patch: ShapePatch) => depthAt(patch, patch.left + patch.width / 2, patch.top + patch.height / 2);
/** A patch's lit texels: each one's pixel in the picture and its opacity. */
function* texels(patch: ShapePatch): Generator<{ x: number; y: number; opacity: number }> {
  for (let j = 0; j < patch.height; j++) for (let i = 0; i < patch.width; i++) { const opacity = patch.rgba[4 * (j * patch.width + i) + 3]!; if (opacity) yield { x: patch.left + i, y: patch.top + j, opacity }; }
}

test('a flat surface is large patches on its own plane, and a pixel\'s light is shared among the patches that reach it', () => {
  // Two tilted planes over a disc: 0.3 deeper a pixel to the right, 0.2 less deep a pixel down.
  const plane = (x: number, y: number) => 60 + 0.3 * (x - 100) - 0.2 * (y - 100), shape = walls((x, y) => Math.hypot(x - 100, y - 100) < 90 ? plane(x, y) : null);
  const { patches, scenes } = imageLayerShapePatches(shape, SIZE, SIZE, 1, 2);
  // The far surface is drawn first, behind the picture, then the near one, in front.
  const far = patches.filter(patch => middle(patch) > 0), near = patches.filter(patch => middle(patch) < 0);
  assert.equal(far.length + near.length, patches.length); assert.deepEqual(patches.slice(0, far.length), far);
  // A patch whose square is all on the disc lies on the surface's plane, and such patches are larger than the least.
  let onPlane = 0, large = 0;
  for (const patch of patches) { const sign = middle(patch) > 0 ? 1 : -1, inside = [[patch.left, patch.top], [patch.left + patch.width, patch.top + patch.height], [patch.left + patch.width, patch.top], [patch.left, patch.top + patch.height]].every(([x, y]) => Math.hypot(x! - 100, y! - 100) < 80);
    if (!inside) continue; onPlane++; if (Math.max(patch.width, patch.height) > PATCH_LEAST_PIXELS + 2 * PATCH_OVERLAP_PIXELS) large++;
    assert.ok(Math.abs(patch.right - sign * 0.3) < 1e-4 && Math.abs(patch.down + sign * 0.2) < 1e-4, `a patch slopes ${patch.right} and ${patch.down}`);
    assert.ok(Math.abs(depthAt(patch, patch.left + 1, patch.top + 1) - sign * plane(patch.left + 1, patch.top + 1)) < 1e-3, 'a patch is off its surface'); }
  assert.ok(onPlane >= 4 && large >= 2, `${onPlane} patches inside the disc, ${large} of them large`);
  // Along the sight line the optical depths of a surface's patches add up to the surface's at every pixel, within what
  // whole steps of opacity allow; near a patch's edge two or more patches share it.
  const sum = new Float32Array(SIZE * SIZE), sharing = new Uint8Array(SIZE * SIZE);
  for (const patch of near) for (const { x, y, opacity } of texels(patch)) { sum[y * SIZE + x]! += -Math.log(1 - opacity / 255); sharing[y * SIZE + x]!++; assert.equal(patch.rgba[4 * ((y - patch.top) * patch.width + x - patch.left)], 200); }
  let worst = 0, shared = 0, lit = 0;
  for (let p = 0; p < SIZE * SIZE; p++) if (shape.sharp[p]) { lit++; worst = Math.max(worst, Math.abs(sum[p]! - TAU)); if (sharing[p]! > 1) shared++; }
  assert.ok(worst < 0.03, `a pixel's shares add up to within ${worst.toFixed(3)} of its optical depth`);
  assert.ok(shared > lit / 20 && shared < lit, `${shared} of ${lit} pixels are shared`);
  // Scenes: runs that hold every patch once, none larger than a scene may be, no two patches of a run overlapping.
  assert.equal(scenes.reduce((total, size) => total + size, 0), patches.length);
  for (let from = 0, scene = 0; scene < scenes.length; from += scenes[scene++]!) { const run = patches.slice(from, from + scenes[scene]!);
    assert.ok(run.length >= 1 && run.length <= SCENE_MOST_PATCHES);
    for (let i = 0; i < run.length; i++) for (let j = 0; j < i; j++) assert.ok(!overlap(run[i]!, run[j]!), `scene ${scene}: two of its patches overlap`); }
});

test('a curved surface is cut finer where one plane cannot follow it, and its patches meet along their edges', () => {
  // Level within 40 pixels of the middle, 50 deep; beyond, a rim that curves down to the picture's plane 90 pixels out.
  const FIT = 6, dome = (x: number, y: number) => { const r = Math.hypot(x - 100, y - 100); return r < 40 ? 50 : r < 90 ? 50 - 50 * ((r - 40) / 50) ** 2 : null; };
  const shape = walls(dome), { patches } = imageLayerShapePatches(shape, SIZE, SIZE, 1, FIT), near = patches.filter(patch => middle(patch) < 0);
  // Each patch stands within the fit of its surface where it is lit, across the surface, and the level middle is cut
  // into larger patches than the curved rim.
  let small = 0, large = 0;
  for (const patch of near) { const across = Math.hypot(1, patch.right, patch.down); let worst = 0, radius = 0, count = 0;
    for (const { x, y, opacity } of texels(patch)) { if (opacity < 128) continue; worst = Math.max(worst, Math.abs(depthAt(patch, x + .5, y + .5) + dome(x + .5, y + .5)!) / across); radius += Math.hypot(x + .5 - 100, y + .5 - 100); count++; }
    if (!count) continue;
    assert.ok(worst < 2 * FIT, `a patch of ${patch.width} by ${patch.height} pixels stands ${worst.toFixed(1)} from its surface`);
    if (Math.max(patch.width, patch.height) > PATCH_LEAST_PIXELS + 2 * PATCH_OVERLAP_PIXELS) { if (radius / count < 45) large++; } else if (radius / count > 45) small++; }
  assert.ok(large >= 1 && small >= 8, `${large} large patches toward the middle and ${small} small ones toward the rim`);
  // Where two patches of a surface share a pixel they stand at the same depth: the mesh has no step. Patches fitted
  // each on its own would stand apart by as much as the surface curves across one.
  const held = new Map<number, number[]>(); let step = 0, pairs = 0;
  for (const patch of near) for (const { x, y } of texels(patch)) { const p = y * SIZE + x, depths = held.get(p) ?? []; depths.push(depthAt(patch, x + .5, y + .5)); held.set(p, depths); }
  for (const depths of held.values()) if (depths.length > 1) { pairs++; step = Math.max(step, Math.max(...depths) - Math.min(...depths)); }
  assert.ok(pairs > 500 && step < 4, `${pairs} shared pixels, the patches there up to ${step.toFixed(2)} apart in depth`);
});

test('a surface of smooth light is cut and drawn on a coarser grid, on the same plane', () => {
  const plane = (x: number, y: number) => 60 + 0.3 * (x - 100) - 0.2 * (y - 100), fine = walls((x, y) => Math.hypot(x - 100, y - 100) < 90 ? plane(x, y) : null), coarse = walls((x, y) => Math.hypot(x - 100, y - 100) < 90 ? plane(x, y) : null);
  for (const layer of coarse.layers) layer.texels = 2;
  const all = imageLayerShapePatches(fine, SIZE, SIZE, 1, 2).patches, patches = imageLayerShapePatches(coarse, SIZE, SIZE, 1, 2).patches;
  assert.ok(patches.length >= 2 && patches.length < all.length, `${patches.length} coarse patches, ${all.length} fine ones`);
  let onPlane = 0;
  for (const patch of patches) { const sign = middle(patch) > 0 ? 1 : -1;
    // A texel is two face pixels across: the rectangle is whole texels and the texture half of it each way.
    assert.deepEqual([patch.left % 2, patch.top % 2, patch.width / patch.texture[0], patch.height / patch.texture[1], patch.rgba.length], [0, 0, 2, 2, patch.texture[0] * patch.texture[1] * 4]);
    if (![[patch.left, patch.top], [patch.left + patch.width, patch.top + patch.height], [patch.left + patch.width, patch.top], [patch.left, patch.top + patch.height]].every(([x, y]) => Math.hypot(x! - 100, y! - 100) < 80)) continue;
    onPlane++; assert.ok(Math.abs(patch.right - sign * 0.3) < 1e-4 && Math.abs(patch.down + sign * 0.2) < 1e-4 && Math.abs(depthAt(patch, patch.left + 2, patch.top + 2) - sign * plane(patch.left + 2, patch.top + 2)) < 1e-3, `a coarse patch slopes ${patch.right} and ${patch.down}`); }
  assert.ok(onPlane >= 1, `${onPlane} coarse patches inside the disc`);
  // Its texels hold the surface's light: a texel in the middle of a patch is as opaque as the surface's optical depth makes it.
  const whole = patches.find(patch => patch.texture[0] >= 8 && patch.texture[1] >= 8 && Math.hypot(patch.left + patch.width / 2 - 100, patch.top + patch.height / 2 - 100) < 30)!, at = 4 * (Math.floor(whole.texture[1] / 2) * whole.texture[0] + Math.floor(whole.texture[0] / 2));
  assert.ok(Math.abs(whole.rgba[at + 3]! - 255 * (1 - Math.exp(-TAU))) <= 1, `a texel's opacity is ${whole.rgba[at + 3]}`);
});

test('the patches\' textures are packed on atlases with clear texels between them', () => {
  const texture = (width: number, height: number, shade: number): ShapePatch => ({ left: 0, top: 0, width, height, texture: [width, height], rgba: Buffer.alloc(width * height * 4, shade), depth: 0, right: 0, down: 0 });
  const patches = [texture(140, 140, 10), texture(28, 28, 20), texture(60, 44, 30), ...Array.from({ length: 300 }, (_, index) => texture(140, 136, 40 + index % 200))];
  const { atlases, places } = packShapePatches(patches);
  assert.ok(atlases.length >= 2 && atlases.every(atlas => atlas.width <= ATLAS_PIXELS && atlas.height <= ATLAS_PIXELS && atlas.rgba.length === atlas.width * atlas.height * 4), `${atlases.length} atlases`);
  for (const [index, patch] of patches.entries()) { const place = places[index]!, atlas = atlases[place.atlas]!;
    assert.ok(place.x >= ATLAS_GUTTER_PIXELS && place.y >= ATLAS_GUTTER_PIXELS && place.x + patch.width + ATLAS_GUTTER_PIXELS <= atlas.width && place.y + patch.height + ATLAS_GUTTER_PIXELS <= atlas.height);
    // Its own texels at its place, and a clear texel beside its corner.
    assert.equal(atlas.rgba[4 * ((place.y + patch.height - 1) * atlas.width + place.x + patch.width - 1)], patch.rgba[0]);
    assert.equal(atlas.rgba[4 * ((place.y - 1) * atlas.width + place.x - 1) + 3], 0);
    for (let other = 0; other < index; other++) { const b = places[other]!; if (b.atlas !== place.atlas) continue; const q = patches[other]!;
      assert.ok(place.x + patch.width + ATLAS_GUTTER_PIXELS <= b.x || b.x + q.width + ATLAS_GUTTER_PIXELS <= place.x || place.y + patch.height + ATLAS_GUTTER_PIXELS <= b.y || b.y + q.height + ATLAS_GUTTER_PIXELS <= place.y, 'two patches touch'); } }
  assert.throws(() => packShapePatches([texture(ATLAS_PIXELS, 8, 1)]), /does not fit an atlas of 2048/u);
});
