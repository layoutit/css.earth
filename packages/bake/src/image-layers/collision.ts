import { resolve } from 'node:path';
import sharp from 'sharp';
import type { ImageLayerRecipe, LayerAxis } from './config.ts';
import { rad } from './disc.ts';
import { removeCompactSources } from './compact-sources.ts';
import { paintTexel } from './texel.ts';

/** A cluster merger's hot gas and mass (`geometry.collision`). The X-ray papers take the gas as round about the line
 * the subcluster moves along, and take it apart under that symmetry; the lensing papers fit the mass with two round
 * halos, which together are round about the line through their middles. Each has a picture of its own on the
 * photograph's frame, and a line: the published places of its two concentrations. Here a picture's light is spread
 * along each sight line through the body of revolution that adds up to it: at each station along its line, the two
 * sides' mean light by distance from the line is taken apart ring by ring from the outside in, which gives how much
 * the body emits at each distance from the line there. A pixel keeps its own light; the body only says where along
 * the sight line it lies. The photograph stays on its plane.
 *
 * Each line is tipped from the plane of the sky about its main concentration, which lies on the photograph's plane;
 * its far end is the subcluster's. The frame is the bake's: east, north and z along the sight line away from the Sun,
 * in arcseconds. */
type Collision = NonNullable<ImageLayerRecipe['geometry']['collision']>;
type Corner = [u: number, v: number, depthArcsec: number];
export interface CollisionLeaf { id: string; axis: LayerAxis; rgba: Buffer; width: number; height: number; corners: [Corner, Corner, Corner, Corner] }

/** Steps along a sight line within one slab, when a body's emission there is summed. */
const STEPS = 8;
/** A gas or mass picture's light under this, of 255, is its background: measured on the Bullet Cluster's two, away from
 * the cluster, nine pixels in ten are at 2 or under and 99 in 100 at 8 or under. */
const PICTURE_FLOOR = 4;
/** The least opacity a lit texel of a slab is stored with, of 255. A lossy encoding moves a texel's color a little, and
 * color times opacity is cut to a whole number: under an opacity of 1 or 2 that loses the texel's light. */
const LEAST_OPACITY = 4;
/** How much opacity, of 255, a slab's texel may take beyond its own light's, to make up what the slabs behind it fell
 * short by in rounding. Without a limit, a sum that is nearly full and a little short asks every nearer slab for a
 * nearly opaque texel: plates that come apart as soon as the stack is seen from beside the Sun's line. */
const MAKE_UP = 4;

export async function imageLayerCollision(options: { recipe: ImageLayerRecipe; sourceDirectory: string; width: number; height: number;
  /** A face pixel's place on the sky from the bank's target, arcseconds east and north. */
  sky: (px: number, py: number) => [number, number];
  /** A sky position's face pixel. */
  pixel: (raDeg: number, decDeg: number) => [number, number] }) {
  const { recipe, width: W, height: H, sky } = options, collision: Collision = recipe.geometry.collision!, count = W * H, facePixels = recipe.bake.bulgeFacePixels!;
  const tilt = rad(collision.tiltDeg), cos = Math.cos(tilt), sin = Math.sin(tilt), pixelArcsec = Math.hypot(sky(1, 0)[0] - sky(0, 0)[0], sky(1, 0)[1] - sky(0, 0)[1]);
  // A picture's light by channel as optical depth: the pictures were added by a screen, under which optical depths add.
  // Light under the pictures' background is none, and a picture ends at the frame as the photograph does.
  const read = async (name: 'gas' | 'mass') => { const medium = collision[name]!, picture = sharp(resolve(options.sourceDirectory, medium.path)), metadata = await picture.metadata();
    if (metadata.width !== recipe.source.dimensions[0] || metadata.height !== recipe.source.dimensions[1]) throw new TypeError(`${recipe.id}: ${medium.path} is ${metadata.width} by ${metadata.height} px; the ${name} picture (geometry.collision.${name}.path) is on the photograph's frame, ${recipe.source.dimensions.join(' by ')} px.`);
    const rgb = await picture.resize({ width: W, height: H, fit: 'fill' }).removeAlpha().toColorspace('srgb').raw().toBuffer(), tau = [0, 1, 2].map(() => new Float32Array(count)), light = new Float32Array(count), framed = new Uint8Array(count); let pixels = 0;
    // Point sources in the picture are not the body's light: they are taken down to the light around them.
    const sources = medium.pointSourceArcsec === undefined ? 0 : removeCompactSources(rgb, W, H, Math.max(1, Math.ceil(medium.pointSourceArcsec / 2 / pixelArcsec)));
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const p = py * W + px, edge = Math.min(px / Math.max(1, W - 1), (W - 1 - px) / Math.max(1, W - 1), py / Math.max(1, H - 1), (H - 1 - py) / Math.max(1, H - 1)), t = Math.min(1, edge / recipe.bake.edgeTaperFraction), fade = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) { const value = Math.max(0, rgb[3 * p + c]! - PICTURE_FLOOR) / (255 - PICTURE_FLOOR) * fade; tau[c]![p] = -Math.log(1 - Math.min(value, .998)); light[p] += tau[c]![p]!; }
      framed[p] = fade === 1 ? 1 : 0;
      if (light[p]! > 0) pixels++; }
    if (!pixels) throw new TypeError(`${recipe.id}: the ${name} picture (${medium.path}) holds no light above its background.`);
    return { name, medium, tau, light, framed, pixels, sources }; };
  const pictures = [await read('gas'), ...(collision.mass ? [await read('mass')] : [])];
  let left = W, top = H, right = -1, bottom = -1;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) if (pictures.some(picture => picture.light[py * W + px]! > 0)) { left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py); }
  const bw = right - left + 1, bh = bottom - top + 1, fscale = Math.min(1, facePixels / Math.max(bw, bh)), sw = Math.max(2, Math.round(bw * fscale)), sh = Math.max(2, Math.round(bh * fscale));
  // Stations and rings are as wide as a cell of the leaves: a body can show nothing finer.
  const bin = pixelArcsec / fscale;
  const bodies = pictures.map(({ name, medium, tau, light, framed, pixels, sources }) => {
    // The line on the sky, from the main concentration to the subcluster's, and the direction across it.
    const from = sky(...options.pixel(medium.from.raDeg, medium.from.decDeg)), to = sky(...options.pixel(medium.to.raDeg, medium.to.decDeg)), length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (!(length > 0)) throw new TypeError(`${recipe.id}: geometry.collision.${name} runs from one place on the sky to another; its ends are the same.`);
    const along = [(to[0] - from[0]) / length, (to[1] - from[1]) / length] as const, station = (east: number, north: number) => (east - from[0]) * along[0] + (north - from[1]) * along[1], offset = (east: number, north: number) => (north - from[1]) * along[0] - (east - from[0]) * along[1];
    let first = Infinity, last = -Infinity, widest = 0; const s = new Float32Array(count), r = new Float32Array(count);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const p = py * W + px, [east, north] = sky(px, py); s[p] = station(east, north); r[p] = offset(east, north);
      if (light[p]! > 0) { first = Math.min(first, s[p]!); last = Math.max(last, s[p]!); widest = Math.max(widest, Math.abs(r[p]!)); } }
    const stations = Math.floor((last - first) / bin) + 1, rings = Math.floor(widest / bin) + 1, sums = [new Float64Array(stations * rings), new Float64Array(stations * rings)], counts = [new Uint32Array(stations * rings), new Uint32Array(stations * rings)];
    // Where the picture fades out at the frame it holds no reading of the body: the frame cuts that side off there.
    for (let p = 0; p < count; p++) { const i = Math.floor((s[p]! - first) / bin), j = Math.floor(Math.abs(r[p]!) / bin); if (!framed[p] || i < 0 || i >= stations || j >= rings) continue; const side = r[p]! < 0 ? 1 : 0; sums[side]![i * rings + j] += light[p]!; counts[side]![i * rings + j]++; }
    // The two sides' mean light, and how much of the light differs between them. Where the frame cuts one side off, the other stands for both.
    const mean = new Float32Array(stations * rings); let differs = 0, all = 0;
    for (let k = 0; k < stations * rings; k++) { const a = counts[0]![k]! ? sums[0]![k]! / counts[0]![k]! : NaN, b = counts[1]![k]! ? sums[1]![k]! / counts[1]![k]! : NaN, weight = counts[0]![k]! + counts[1]![k]!;
      mean[k] = Number.isNaN(a) ? Number.isNaN(b) ? 0 : b : Number.isNaN(b) ? a : (a + b) / 2;
      if (!Number.isNaN(a) && !Number.isNaN(b)) { differs += Math.abs(a - b) * weight / 2; all += (a + b) * weight / 2; } }
    // The emission of each ring that adds up to that light: the outermost ring is seen alone at the body's edge, and
    // each ring inward through those outside it. What comes out below nothing is counted and left at nothing.
    const through = (ray: number, of: number) => 2 * (Math.sqrt((of + 1) ** 2 - (ray + .5) ** 2) - Math.sqrt(Math.max(0, of ** 2 - (ray + .5) ** 2))), rung = new Float32Array(stations * rings);
    let refused = 0, whole = 0, outermost = 0;
    for (let i = 0; i < stations; i++) for (let ray = rings - 1; ray >= 0; ray--) { let rest = 0; for (let of = ray + 1; of < rings; of++) rest += rung[i * rings + of]! * through(ray, of);
      const value = (mean[i * rings + ray]! - rest) / through(ray, ray); whole += mean[i * rings + ray]!; if (value < 0) refused -= value * through(ray, ray); else if (value > 0) { rung[i * rings + ray] = value; outermost = Math.max(outermost, ray); } }
    const emit = (alongLine: number, fromLine: number) => { const x = (alongLine - first) / bin - .5, y = fromLine / bin - .5, i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
      const at = (i: number, j: number) => i < 0 || i >= stations || j >= rings ? 0 : rung[i * rings + Math.max(0, j)]!;
      return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty; };
    /** How much the body emits at a place on the sky and a depth. */
    const emission = (east: number, north: number, depth: number) => { const alongSky = station(east, north); return emit(alongSky * cos + depth * sin, Math.hypot(offset(east, north), depth * cos - alongSky * sin)); };
    return { name, source: medium.source, tau, emission, pixels, sources, reachArcsec: (outermost + 1) * bin, differs: all > 0 ? differs / all : 0, refused: whole > 0 ? refused / whole : 0 }; });
  // The grid of the leaves: each cell's place on the sky and each picture's light toward the Sun there by channel (0 to 1).
  const cells = Array.from({ length: sw * sh }, (_, t) => { const i = t % sw, j = Math.floor(t / sw), x0 = left + Math.floor(i * bw / sw), x1 = Math.max(x0 + 1, left + Math.floor((i + 1) * bw / sw)), y0 = top + Math.floor(j * bh / sh), y1 = Math.max(y0 + 1, top + Math.floor((j + 1) * bh / sh));
    const area = (x1 - x0) * (y1 - y0), [east, north] = sky((x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2);
    return { east, north, lights: bodies.map(body => body.tau.map(channel => { let sum = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += 1 - Math.exp(-channel[y * W + x]!); return Math.min(.998, sum / area); })) }; });
  return { collision, bodies, cells, columns: sw, rows: sh, reachArcsec: Math.max(...bodies.map(body => body.reachArcsec)), binArcsec: bin,
    window: [2 * left / W - 1, 2 * (right + 1) / W - 1, 1 - 2 * top / H, 1 - 2 * (bottom + 1) / H] as const, sizeArcsec: [bw * pixelArcsec, bh * pixelArcsec] as const };
}

/** The gas and the mass as leaves, from one grid of cells over their pictures. Face-on (the z bank): slabs parallel to
 * the photograph, each holding the light the bodies put between its two faces; from the Sun the slabs add up to the
 * pictures, screened. From the side (the x and y banks): curtains through the grid's columns and rows, each holding
 * the light of the slab of cluster around it. A corner is a place on the photograph (u and v, -1 to 1) and a depth
 * from its plane. */
export function imageLayerCollisionLeaves(model: Awaited<ReturnType<typeof imageLayerCollision>>, bake: { bulgeSlices?: number; bulgeCrossSlices?: number }): CollisionLeaf[] {
  const { cells, bodies, columns: sw, rows: sh, reachArcsec: reach } = model, [u0, u1, v0, v1] = model.window, slices = bake.bulgeSlices!, crossSlices = bake.bulgeCrossSlices!, step = 2 * reach / slices, plane = slices >> 1, count = sw * sh, B = bodies.length, leaves: CollisionLeaf[] = [];
  const name = (axis: LayerAxis, index: number) => `shape-${axis}-${String(index).padStart(2, '0')}`;
  // Each body's light in a cell by channel, as optical depth, and its share of emission by slab; light a body has no
  // place for keeps the plane.
  const depths = new Float32Array(count * B * 3), parts = new Float32Array(count * B * slices), wholes = new Float32Array(count * B), hues = Buffer.alloc(count * 3);
  for (let t = 0; t < count; t++) { const cell = cells[t]!, seen = [0, 1, 2].map(c => 1 - cell.lights.reduce((dark, light) => dark * (1 - light[c]!), 1)), most = Math.max(...seen); if (!(most > 0)) continue;
    for (let c = 0; c < 3; c++) hues[t * 3 + c] = Math.round(255 * seen[c]! / most);
    for (let b = 0; b < B; b++) { const o = (t * B + b) * slices; if (!(Math.max(...cell.lights[b]!) > 0)) continue;
      for (let c = 0; c < 3; c++) depths[(t * B + b) * 3 + c] = -Math.log(1 - cell.lights[b]![c]!);
      for (let k = 0; k < slices; k++) { const lo = -reach + k * step, dz = step / STEPS; let part = 0; for (let i = 0; i < STEPS; i++) part += bodies[b]!.emission(cell.east, cell.north, lo + (i + .5) * dz) * dz; parts[o + k] = part; wholes[t * B + b] += part; }
      if (wholes[t * B + b]! > 0) for (let k = 0; k < slices; k++) parts[o + k] /= wholes[t * B + b]!; else parts[o + plane] = 1; } }
  // The slabs, farthest first. Lights of different colors add as a screen does, and a browser lays each slab over those
  // behind it: a slab that only held its own light would hide part of another color's light behind it. So each texel
  // holds what brings the sum so far, as a browser will show it, up to the screen of all the light from there back:
  // its own light and what it hides. Its opacity is the least that can and leaves room above its brightest channel; its
  // color is stored in the middle of the values that give its light, since a browser keeps color times opacity in whole
  // numbers and the encoding moves the color a little. Every slab is the same rectangle, so a browser places them all alike.
  const owed = new Float32Array(count * 3), shown = new Float32Array(count * 3), drawn: CollisionLeaf[] = [];
  for (let k = slices - 1; k >= 0; k--) { const rgba = Buffer.alloc(count * 4), depth = -reach + (k + .5) * step; let any = false;
    for (let t = 0; t < count; t++) { const o = 4 * t, wanted = [0, 0, 0]; let opacity = 0, own = 0;
      // Color is kept under transparent texels too, so the lossy encoding has no dark edge to bleed in.
      for (let c = 0; c < 3; c++) { rgba[o + c] = hues[t * 3 + c]!; let within = 0; for (let b = 0; b < B; b++) within += depths[(t * B + b) * 3 + c]! * parts[(t * B + b) * slices + k]!; own = Math.max(own, within); owed[t * 3 + c] += within; wanted[c] = 1 - Math.exp(-owed[t * 3 + c]!); if (shown[t * 3 + c]! < 1) opacity = Math.max(opacity, (wanted[c]! - shown[t * 3 + c]!) / (1 - shown[t * 3 + c]!)); }
      if (!(own > 0 && 255 * opacity >= .5)) continue;
      const stored = Math.min(254, Math.max(LEAST_OPACITY, Math.ceil(Math.min(255 * opacity, 255 * (1 - Math.exp(-own)) + MAKE_UP) - 1e-6))), light = [0, 1, 2].map(c => Math.max(0, Math.min(stored - 1, Math.round(255 * (wanted[c]! - (1 - stored / 255) * shown[t * 3 + c]!)))));
      rgba[o + 3] = stored; any = true;
      for (let c = 0; c < 3; c++) { rgba[o + c] = Math.min(255, Math.ceil((light[c]! + .5) * 255 / stored)); shown[t * 3 + c] = Math.min(light[c]!, Math.floor(rgba[o + c]! * stored / 255)) / 255 + (1 - stored / 255) * shown[t * 3 + c]!; } }
    if (any) drawn.push({ id: name('z', k), axis: 'z', rgba, width: sw, height: sh, corners: [[u0, v0, depth], [u1, v0, depth], [u1, v1, depth], [u0, v1, depth]] }); }
  leaves.push(...drawn.reverse());
  const depthPixels = Math.max(8, Math.round(2 * reach / model.binArcsec)), planeFrom = -reach + plane * step;
  for (const axis of ['x', 'y'] as const) { const lengthPixels = axis === 'x' ? sh : sw, acrossCells = axis === 'x' ? sw : sh, spacing = model.sizeArcsec[axis === 'x' ? 0 : 1] / crossSlices, rounding = new Float32Array(lengthPixels * depthPixels);
    for (let slice = 0; slice < crossSlices; slice++) { const fraction = (slice + .5) / crossSlices, rgba = Buffer.alloc(lengthPixels * depthPixels * 4), from = Math.floor(slice * acrossCells / crossSlices), to = Math.max(from + 1, Math.floor((slice + 1) * acrossCells / crossSlices)); let any = false;
      for (let a = 0; a < lengthPixels; a++) for (let d = 0; d < depthPixels; d++) { const depth = reach - (d + .5) / depthPixels * 2 * reach, o = 4 * (d * lengthPixels + a), optical = [0, 0, 0], inPlane = depth >= planeFrom && depth < planeFrom + step;
        // Each channel's light in the curtain's slab of cells at this depth, per unit length, times the curtain spacing.
        for (let i = from; i < to; i++) { const t = axis === 'x' ? a * sw + i : i * sw + a, cell = cells[t]!;
          for (let b = 0; b < B; b++) { if (!(depths[(t * B + b) * 3]! + depths[(t * B + b) * 3 + 1]! + depths[(t * B + b) * 3 + 2]! > 0)) continue; const here = wholes[t * B + b]! > 0 ? bodies[b]!.emission(cell.east, cell.north, depth) / wholes[t * B + b]! : inPlane ? 1 / step : 0; if (!(here > 0)) continue;
            for (let c = 0; c < 3; c++) optical[c]! += depths[(t * B + b) * 3 + c]! * here * spacing / (to - from); } }
        // A curtain's rounding is carried to the next one at the same place.
        if (!(Math.max(...optical) > 0)) continue; rounding[d * lengthPixels + a] = paintTexel(rgba, o, optical, rounding[d * lengthPixels + a]!); if (rgba[o + 3]) any = true; }
      if (!any) continue;
      const u = u0 + (u1 - u0) * fraction, v = v0 + (v1 - v0) * fraction;
      leaves.push({ id: name(axis, slice), axis, rgba, width: lengthPixels, height: depthPixels, corners: axis === 'x' ? [[u, v0, reach], [u, v1, reach], [u, v1, -reach], [u, v0, -reach]] : [[u0, v, reach], [u1, v, reach], [u1, v, -reach], [u0, v, -reach]] }); } }
  return leaves;
}
