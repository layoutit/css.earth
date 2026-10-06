import { resolve } from 'node:path';
import sharp from 'sharp';
import type { CollisionBody, EllipsoidBody, ImageLayerRecipe, LayerAxis } from './config.ts';
import { rad } from './disc.ts';
import { removeCompactSources } from './compact-sources.ts';
import { imageLayerGalaxies } from './galaxies.ts';
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
 * in arcseconds.
 *
 * A relaxed cluster's gas and mass (`geometry.ellipsoid`) are spread the same way through ellipsoidal shells about a
 * published centre: ellipses on the sky, and a published number of times as long along the sight line as their long
 * axis on the sky. There the light is taken apart shell by shell, and a body has one station. With
 * `geometry.ellipsoid.galaxies` the photograph's own light leaves its plane too (./galaxies.ts). */
type Collision = NonNullable<ImageLayerRecipe['geometry']['collision']> | NonNullable<ImageLayerRecipe['geometry']['ellipsoid']>;
type Corner = [u: number, v: number, depthArcsec: number];
/** A body of the leaves: its light by channel as optical depth on each face pixel, and how much of it lies at a place and depth. */
interface Body { name: string; medium?: CollisionBody | EllipsoidBody; source: string; tau: Float32Array[]; emission: (east: number, north: number, depth: number) => number; pixels: number; sources: number; wholeArcsec: number; reachArcsec: number; differs: number; refused: number }
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
/** The depths a photograph's galaxies stand at when seen from the Sun: each on the nearest of this many sheets. A sheet's
 * light is raised to make up what the slabs in front of it hide, by this many times at most: from beside the Sun's
 * line the slabs in front are others, and what was raised shows. */
const GALAXY_SHEETS = 16, MOST_RAISED = 3;
/** An ellipsoid's picture fades out over this share of the largest shell its frame holds whole, so that the body ends
 * on a shell and not on the frame's rectangle. */
const SHELL_FADE = .25;

export async function imageLayerCollision(options: { recipe: ImageLayerRecipe; sourceDirectory: string; width: number; height: number;
  /** The photograph on its plane, RGBA with straight color: with `geometry.ellipsoid.galaxies`, the light that leaves the plane is cleared from it. */
  photograph?: Buffer;
  /** A face pixel's place on the sky from the bank's target, arcseconds east and north. */
  sky: (px: number, py: number) => [number, number];
  /** A sky position's face pixel. */
  pixel: (raDeg: number, decDeg: number) => [number, number] }) {
  const { recipe, width: W, height: H, sky } = options, key = recipe.geometry.collision ? 'collision' : 'ellipsoid', collision: Collision = recipe.geometry.collision ?? recipe.geometry.ellipsoid!, count = W * H, facePixels = recipe.bake.bulgeFacePixels!;
  const tilt = rad('tiltDeg' in collision ? collision.tiltDeg : 0), cos = Math.cos(tilt), sin = Math.sin(tilt), pixelArcsec = Math.hypot(sky(1, 0)[0] - sky(0, 0)[0], sky(1, 0)[1] - sky(0, 0)[1]);
  // A picture's light by channel as optical depth: the pictures were added by a screen, under which optical depths add.
  // Light under the pictures' background is none, and a picture ends at the frame as the photograph does.
  // Where a place on the sky lies in a body. A collision's: how far along its line, from the main concentration to the
  // subcluster's, and how far across it. An ellipsoid's: nowhere along, and on which shell, by the shell's long half
  // axis, with the side of that axis as its sign; `deep` is how many times as far a shell reaches along the sight line.
  const placed = (name: string, medium: CollisionBody | EllipsoidBody) => {
    if (!('from' in medium)) { const centre = sky(...options.pixel(medium.centre.raDeg, medium.centre.decDeg)), pa = rad(medium.majorAxisPaDeg), long = [Math.sin(pa), Math.cos(pa)] as const;
      return { shells: true, deep: medium.elongation, station: () => 0, offset: (east: number, north: number) => { const across = (north - centre[1]) * long[0] - (east - centre[0]) * long[1]; return (across < 0 ? -1 : 1) * Math.hypot((east - centre[0]) * long[0] + (north - centre[1]) * long[1], across / medium.axisRatio); } }; }
    const from = sky(...options.pixel(medium.from.raDeg, medium.from.decDeg)), to = sky(...options.pixel(medium.to.raDeg, medium.to.decDeg)), length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (!(length > 0)) throw new TypeError(`${recipe.id}: geometry.collision.${name} runs from one place on the sky to another; its ends are the same.`);
    const along = [(to[0] - from[0]) / length, (to[1] - from[1]) / length] as const;
    return { shells: false, deep: 1, station: (east: number, north: number) => (east - from[0]) * along[0] + (north - from[1]) * along[1], offset: (east: number, north: number) => (north - from[1]) * along[0] - (east - from[0]) * along[1] }; };
  const read = async (name: 'gas' | 'mass') => { const medium = collision[name]!, picture = sharp(resolve(options.sourceDirectory, medium.path)), metadata = await picture.metadata();
    if (metadata.width !== recipe.source.dimensions[0] || metadata.height !== recipe.source.dimensions[1]) throw new TypeError(`${recipe.id}: ${medium.path} is ${metadata.width} by ${metadata.height} px; the ${name} picture (geometry.${key}.${name}.path) is on the photograph's frame, ${recipe.source.dimensions.join(' by ')} px.`);
    const rgb = await picture.resize({ width: W, height: H, fit: 'fill' }).removeAlpha().toColorspace('srgb').raw().toBuffer(), tau = [0, 1, 2].map(() => new Float32Array(count)), light = new Float32Array(count), framed = new Uint8Array(count); let pixels = 0;
    // Point sources in the picture are not the body's light: they are taken down to the light around them.
    const sources = medium.pointSourceArcsec === undefined ? 0 : removeCompactSources(rgb, W, H, Math.max(1, Math.ceil(medium.pointSourceArcsec / 2 / pixelArcsec)));
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const p = py * W + px, edge = Math.min(px / Math.max(1, W - 1), (W - 1 - px) / Math.max(1, W - 1), py / Math.max(1, H - 1), (H - 1 - py) / Math.max(1, H - 1)), t = Math.min(1, edge / recipe.bake.edgeTaperFraction), fade = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) { const value = Math.max(0, rgb[3 * p + c]! - PICTURE_FLOOR) / (255 - PICTURE_FLOOR) * fade; tau[c]![p] = -Math.log(1 - Math.min(value, .998)); light[p] += tau[c]![p]!; }
      framed[p] = fade === 1 ? 1 : 0;
      if (light[p]! > 0) pixels++; }
    const place = placed(name, medium), s = new Float32Array(count), r = new Float32Array(count), faded = new Float32Array(count).fill(1); let whole = Infinity;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const p = py * W + px, [east, north] = sky(px, py); s[p] = place.station(east, north); r[p] = place.offset(east, north);
      if (!framed[p] || px === 0 || py === 0 || px === W - 1 || py === H - 1) whole = Math.min(whole, Math.abs(r[p]!)); }
    // An ellipsoid ends on a shell: its picture fades out toward the largest shell the frame holds whole.
    if (place.shells) { pixels = 0; for (let p = 0; p < count; p++) { const t = Math.min(1, Math.max(0, (whole - Math.abs(r[p]!)) / (SHELL_FADE * whole))), fade = t * t * (3 - 2 * t); faded[p] = fade; light[p] *= fade; for (let c = 0; c < 3; c++) tau[c]![p] *= fade; if (light[p]! > 0) pixels++; } }
    if (!pixels) throw new TypeError(`${recipe.id}: the ${name} picture (${medium.path}) holds no light above its background.`);
    return { name, medium, tau, light, framed, pixels, sources, place, s, r, faded, wholeArcsec: whole }; };
  const pictures = [await read('gas'), ...(collision.mass ? [await read('mass')] : [])];
  // The photograph's galaxies follow the mass's shells, or the gas's where the recipe has no mass.
  const galaxies = 'galaxies' in collision && options.photograph ? { ...collision.galaxies!, photograph: options.photograph, shells: pictures.at(-1)! } : null;
  let left = W, top = H, right = -1, bottom = -1;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) if (pictures.some(picture => picture.light[py * W + px]! > 0) || (galaxies && galaxies.photograph[4 * (py * W + px) + 3]! * galaxies.shells.faded[py * W + px]! > 0)) { left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py); }
  const bw = right - left + 1, bh = bottom - top + 1, fscale = Math.min(1, facePixels / Math.max(bw, bh)), sw = Math.max(2, Math.round(bw * fscale)), sh = Math.max(2, Math.round(bh * fscale));
  // Stations and rings are as wide as a cell of the leaves: a body can show nothing finer.
  const bin = pixelArcsec / fscale;
  const bodies: Body[] = pictures.map(({ name, medium, tau, light, framed, pixels, sources, place: { shells, deep, station, offset }, s, r, wholeArcsec }) => {
    let first = Infinity, last = -Infinity, widest = 0;
    for (let p = 0; p < count; p++) if (light[p]! > 0) { first = Math.min(first, s[p]!); last = Math.max(last, s[p]!); widest = Math.max(widest, Math.abs(r[p]!)); }
    const stations = Math.floor((last - first) / bin) + 1, rings = Math.floor(widest / bin) + 1, sums = [new Float64Array(stations * rings), new Float64Array(stations * rings)], counts = [new Uint32Array(stations * rings), new Uint32Array(stations * rings)];
    // Where the picture fades out at the frame it holds no reading of the body: the frame cuts that side off there.
    for (let p = 0; p < count; p++) { const i = Math.floor((s[p]! - first) / bin), j = Math.floor(Math.abs(r[p]!) / bin); if (!framed[p] || i < 0 || i >= stations || j >= rings) continue; const side = r[p]! < 0 ? 1 : 0; sums[side]![i * rings + j] += light[p]!; counts[side]![i * rings + j]++; }
    // The two sides' mean light, and how much of the light differs between them. Where the frame cuts one side off, the other stands for both.
    const mean = new Float32Array(stations * rings); let differs = 0, all = 0;
    for (let k = 0; k < stations * rings; k++) { const a = counts[0]![k]! ? sums[0]![k]! / counts[0]![k]! : NaN, b = counts[1]![k]! ? sums[1]![k]! / counts[1]![k]! : NaN, weight = counts[0]![k]! + counts[1]![k]!;
      mean[k] = Number.isNaN(a) ? Number.isNaN(b) ? 0 : b : Number.isNaN(b) ? a : (a + b) / 2;
      if (!Number.isNaN(a) && !Number.isNaN(b)) { differs += Math.abs(a - b) * weight / 2; all += (a + b) * weight / 2; } }
    // Shells are taken as even all the way round, not only alike on two sides: how much of the light differs from its shell's mean.
    if (shells) { differs = 0; all = 0; for (let p = 0; p < count; p++) { const j = Math.floor(Math.abs(r[p]!) / bin); if (!framed[p] || j >= rings) continue; differs += Math.abs(light[p]! - mean[j]!); all += light[p]!; } }
    // The emission of each ring that adds up to that light: the outermost ring is seen alone at the body's edge, and
    // each ring inward through those outside it. What comes out below nothing is counted and left at nothing.
    const through = (ray: number, of: number) => 2 * (Math.sqrt((of + 1) ** 2 - (ray + .5) ** 2) - Math.sqrt(Math.max(0, of ** 2 - (ray + .5) ** 2))), rung = new Float32Array(stations * rings);
    let refused = 0, whole = 0, outermost = 0;
    for (let i = 0; i < stations; i++) for (let ray = rings - 1; ray >= 0; ray--) { let rest = 0; for (let of = ray + 1; of < rings; of++) rest += rung[i * rings + of]! * through(ray, of);
      const value = (mean[i * rings + ray]! - rest) / through(ray, ray); whole += mean[i * rings + ray]!; if (value < 0) refused -= value * through(ray, ray); else if (value > 0) { rung[i * rings + ray] = value; outermost = Math.max(outermost, ray); } }
    const emit = (alongLine: number, fromLine: number) => { const x = shells ? 0 : (alongLine - first) / bin - .5, y = fromLine / bin - .5, i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
      const at = (i: number, j: number) => i < 0 || i >= stations || j >= rings ? 0 : rung[i * rings + Math.max(0, j)]!;
      return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty; };
    /** How much the body emits at a place on the sky and a depth. */
    const emission = (east: number, north: number, depth: number) => { const alongSky = station(east, north), z = depth / deep; return emit(alongSky * cos + z * sin, Math.hypot(offset(east, north), z * cos - alongSky * sin)); };
    return { name, medium, source: medium.source, tau, emission, pixels, sources, wholeArcsec, reachArcsec: (outermost + 1) * bin * deep, differs: all > 0 ? differs / all : 0, refused: whole > 0 ? refused / whole : 0 }; });
  let lifted: ReturnType<typeof imageLayerGalaxies> | null = null;
  if (galaxies) { const shells = bodies.at(-1)!, medium = galaxies.shells.medium as EllipsoidBody;
    lifted = imageLayerGalaxies({ photograph: galaxies.photograph, width: W, height: H, radius: Math.max(1, Math.ceil(galaxies.widthArcsec / 2 / pixelArcsec)), pixelArcsec, binArcsec: bin, sky,
      shells: { emission: shells.emission, reachArcsec: shells.reachArcsec, fade: galaxies.shells.faded, centre: options.pixel(medium.centre.raDeg, medium.centre.decDeg) } });
    const blank = { source: galaxies.source, sources: 0, wholeArcsec: shells.wholeArcsec, reachArcsec: shells.reachArcsec, differs: 0, refused: 0 };
    bodies.push({ ...blank, name: 'galaxies', tau: lifted.own, emission: lifted.emission, pixels: lifted.ownPixels }, { ...blank, name: 'starlight', tau: lifted.diffuse, emission: shells.emission, pixels: lifted.diffusePixels }); }
  // The grid of the leaves: each cell's place on the sky and each picture's light toward the Sun there by channel (0 to 1).
  const cells = Array.from({ length: sw * sh }, (_, t) => { const i = t % sw, j = Math.floor(t / sw), x0 = left + Math.floor(i * bw / sw), x1 = Math.max(x0 + 1, left + Math.floor((i + 1) * bw / sw)), y0 = top + Math.floor(j * bh / sh), y1 = Math.max(y0 + 1, top + Math.floor((j + 1) * bh / sh));
    const area = (x1 - x0) * (y1 - y0), [east, north] = sky((x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2);
    return { east, north, lights: bodies.map(body => body.tau.map(channel => { let sum = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += 1 - Math.exp(-channel[y * W + x]!); return Math.min(.998, sum / area); })) }; });
  return { collision, bodies, lifted, width: W, height: H, grid: [left, top, bw, bh] as const, cells, columns: sw, rows: sh, reachArcsec: Math.max(...bodies.map(body => body.reachArcsec)), binArcsec: bin,
    window: [2 * left / W - 1, 2 * (right + 1) / W - 1, 1 - 2 * top / H, 1 - 2 * (bottom + 1) / H] as const, sizeArcsec: [bw * pixelArcsec, bh * pixelArcsec] as const };
}

/** What the prepared bank says of the bodies: the model in a sentence, and each body's account with its measured numbers. */
export function imageLayerCollisionAccount(model: Awaited<ReturnType<typeof imageLayerCollision>>): { model: string; limitations: string[] } {
  const { collision, lifted } = model, bodies = model.bodies.filter((body): body is Body & { medium: CollisionBody | EllipsoidBody } => body.medium !== undefined), tiltDeg = 'tiltDeg' in collision ? collision.tiltDeg : 0, pictures = bodies.length > 1 ? 'The hot gas and the mass, each a picture of its own on the same frame, are' : 'The hot gas, a picture of its own on the same frame, is';
  const taken = (body: typeof bodies[number]) => `${(100 * body.refused).toFixed(2)}% asked for less than nothing and was left at none`, sources = (body: typeof bodies[number]) => body.sources ? ` ${body.sources} point sources narrower than ${body.medium.pointSourceArcsec} arcsec were taken down to the light around them.` : '';
  return { model: `The photograph lies on one plane. ${pictures} spread along each sight line through ${'tiltDeg' in collision ? 'a body of revolution about a published line' : 'ellipsoidal shells of a published shape'}.`,
    limitations: bodies.map(body => 'from' in body.medium
      ? `The ${body.name} (${body.source}) is taken as round about its published line, ${tiltDeg ? `tipped ${tiltDeg} degrees from the plane of the sky with the subcluster's end the farther` : 'in the plane of the sky'}; ${body.pixels} face pixels hold its light, out to ${body.reachArcsec.toFixed(0)} arcsec along the sight line. How much it emits at each distance from the line is read from its picture, the two sides' mean taken apart ring by ring in steps of ${model.binArcsec.toFixed(2)} arcsec: ${(100 * body.differs).toFixed(1)}% of the picture's light differs between the two sides, and ${taken(body)}. The picture is a display, not a calibrated map; no depth is measured.${sources(body)}`
      : `The ${body.name} (${body.source}) is taken as ellipsoidal shells about its published centre: on the sky ellipses ${body.medium.axisRatio} as wide as long, the long axis at position angle ${body.medium.majorAxisPaDeg} degrees, and ${body.medium.elongation} times as long along the sight line as that axis; ${body.pixels} face pixels hold its light, out to ${body.reachArcsec.toFixed(0)} arcsec along the sight line. The picture fades out toward the largest shell the frame holds whole, ${body.wholeArcsec.toFixed(0)} arcsec along the long axis. How much each shell emits is read from the picture, the shells' mean light taken apart from the outside in, in steps of ${model.binArcsec.toFixed(2)} arcsec: ${(100 * body.differs).toFixed(1)}% of the picture's light differs from its shell's mean, and ${taken(body)}. The picture is a display, not a calibrated map; the shells' length along the sight line is the published one, and the long axis is drawn on the sight line; where a pixel's light lies within the shells is not measured.${sources(body)}`)
      .concat(lifted && 'galaxies' in collision ? [`The photograph's galaxies (${collision.galaxies!.source}) are not at measured depths. A galaxy is a bright nucleus with the compact light nearer to it than to another; each is put at a depth drawn once, by its place in the picture, from where the ${collision.mass ? 'mass' : 'gas'}'s shells put matter on its sight line, the one nearest the shells' centre at their middle. A galaxy's light is what is narrower than ${collision.galaxies!.widthArcsec} arcsec, ${(100 * lifted.compactShare).toFixed(1)}% of the photograph's: seen from the Sun its own cut-out of the photograph, on the nearest of ${GALAXY_SHEETS} sheets, and seen from the side a blob at its depth. ${lifted.galaxies} galaxies were placed, and ${lifted.islands} patches of compact light with no nucleus. The rest of the photograph, its diffuse light, is spread through the shells. The photograph fades out toward the largest shell the frame holds whole.`] : []) };
}

/** The gas and the mass as leaves, from one grid of cells over their pictures. Face-on (the z bank): slabs parallel to
 * the photograph, each holding the light the bodies put between its two faces; from the Sun the slabs add up to the
 * pictures, screened. From the side (the x and y banks): curtains through the grid's columns and rows, each holding
 * the light of the slab of cluster around it, whitened so that from the side they add up as a screen does too. A corner is a place on the photograph (u and v, -1 to 1) and a depth
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
  // A photograph's galaxies are not in the slabs: seen from the Sun each is its own sharp cut-out, on a sheet at its depth.
  const sheeted = new Set(bodies.flatMap((body, b) => body.name === 'galaxies' ? [b] : []));
  const owed = new Float32Array(count * 3), shown = new Float32Array(count * 3), drawn: CollisionLeaf[] = [], veils: (Buffer | undefined)[] = [];
  for (let k = slices - 1; k >= 0; k--) { const rgba = Buffer.alloc(count * 4), depth = -reach + (k + .5) * step; let any = false;
    for (let t = 0; t < count; t++) { const o = 4 * t, wanted = [0, 0, 0]; let opacity = 0, own = 0;
      // Color is kept under transparent texels too, so the lossy encoding has no dark edge to bleed in.
      for (let c = 0; c < 3; c++) { rgba[o + c] = hues[t * 3 + c]!; let within = 0; for (let b = 0; b < B; b++) if (!sheeted.has(b)) within += depths[(t * B + b) * 3 + c]! * parts[(t * B + b) * slices + k]!; own = Math.max(own, within); owed[t * 3 + c] += within; wanted[c] = 1 - Math.exp(-owed[t * 3 + c]!); if (shown[t * 3 + c]! < 1) opacity = Math.max(opacity, (wanted[c]! - shown[t * 3 + c]!) / (1 - shown[t * 3 + c]!)); }
      if (!(own > 0 && 255 * opacity >= .5)) continue;
      const stored = Math.min(254, Math.max(LEAST_OPACITY, Math.ceil(Math.min(255 * opacity, 255 * (1 - Math.exp(-own)) + MAKE_UP) - 1e-6))), light = [0, 1, 2].map(c => Math.max(0, Math.min(stored - 1, Math.round(255 * (wanted[c]! - (1 - stored / 255) * shown[t * 3 + c]!)))));
      rgba[o + 3] = stored; any = true;
      for (let c = 0; c < 3; c++) { rgba[o + c] = Math.min(255, Math.ceil((light[c]! + .5) * 255 / stored)); shown[t * 3 + c] = Math.min(light[c]!, Math.floor(rgba[o + c]! * stored / 255)) / 255 + (1 - stored / 255) * shown[t * 3 + c]!; } }
    if (any) veils[k] = rgba;
    if (any) drawn.push({ id: name('z', k), axis: 'z', rgba, width: sw, height: sh, corners: [[u0, v0, depth], [u1, v0, depth], [u1, v1, depth], [u0, v1, depth]] }); }
  leaves.push(...drawn.reverse());
  // A galaxy's sheet stands among the slabs, and the slabs nearer the Sun veil it. So a sheet's light is raised by what
  // those slabs take away, cell by cell, up to `MOST_RAISED` times and as far as a texel can hold: seen from the Sun the
  // galaxy then shows its own light.
  if (model.lifted) { const { width: W, height: H, grid: [left, top, bw, bh] } = model;
    for (const [index, sheet] of model.lifted.sheets(Array.from({ length: GALAXY_SHEETS }, (_, k) => -reach + (k + .5) * 2 * reach / GALAXY_SHEETS)).entries()) { const through = new Float32Array(count).fill(1);
      for (let k = 0; k < slices; k++) if (veils[k] && -reach + (k + .5) * step < sheet.depth) for (let t = 0; t < count; t++) through[t]! *= 1 - veils[k]![4 * t + 3]! / 255;
      for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) { const o = 4 * (y * sheet.width + x) + 3; if (!sheet.rgba[o]) continue; const i = Math.floor((sheet.left + x - left) * sw / bw), j = Math.floor((sheet.top + y - top) * sh / bh); if (i < 0 || j < 0 || i >= sw || j >= sh) continue; sheet.rgba[o] = Math.min(255, Math.round(sheet.rgba[o]! / Math.max(through[j * sw + i]!, 1 / MOST_RAISED))); }
      const a = 2 * sheet.left / W - 1, b = 2 * (sheet.left + sheet.width) / W - 1, c = 1 - 2 * sheet.top / H, d = 1 - 2 * (sheet.top + sheet.height) / H;
      leaves.push({ id: `galaxies-${String(index).padStart(2, '0')}`, axis: 'z', rgba: sheet.rgba, width: sheet.width, height: sheet.height, corners: [[a, c, sheet.depth], [b, c, sheet.depth], [b, d, sheet.depth], [a, d, sheet.depth]] }); } }
  const depthPixels = Math.max(8, Math.round(2 * reach / model.binArcsec)), planeFrom = -reach + plane * step;
  for (const axis of ['x', 'y'] as const) { const lengthPixels = axis === 'x' ? sh : sw, acrossCells = axis === 'x' ? sw : sh, spacing = model.sizeArcsec[axis === 'x' ? 0 : 1] / crossSlices, size = lengthPixels * depthPixels, rounding = new Float32Array(size);
    // Each channel's light in each curtain's slab of cells, per unit length, times the curtain spacing; and all of it on each sight line through the curtains.
    const each = Array.from({ length: crossSlices }, () => new Float32Array(size * 3)), through = new Float32Array(size * 3), span = (slice: number) => { const from = Math.floor(slice * acrossCells / crossSlices); return [from, Math.max(from + 1, Math.floor((slice + 1) * acrossCells / crossSlices))] as const; };
    for (let slice = 0; slice < crossSlices; slice++) { const [from, to] = span(slice);
      for (let a = 0; a < lengthPixels; a++) for (let d = 0; d < depthPixels; d++) { const depth = reach - (d + .5) / depthPixels * 2 * reach, q = 3 * (d * lengthPixels + a), inPlane = depth >= planeFrom && depth < planeFrom + step;
        for (let i = from; i < to; i++) { const t = axis === 'x' ? a * sw + i : i * sw + a, cell = cells[t]!;
          for (let b = 0; b < B; b++) { if (!(depths[(t * B + b) * 3]! + depths[(t * B + b) * 3 + 1]! + depths[(t * B + b) * 3 + 2]! > 0)) continue; const here = wholes[t * B + b]! > 0 ? bodies[b]!.emission(cell.east, cell.north, depth) / wholes[t * B + b]! : inPlane ? 1 / step : 0; if (!(here > 0)) continue;
            for (let c = 0; c < 3; c++) { const light = depths[(t * B + b) * 3 + c]! * here * spacing / (to - from); each[slice]![q + c] += light; through[q + c] += light; } } } } }
    for (let slice = 0; slice < crossSlices; slice++) { const fraction = (slice + .5) / crossSlices, rgba = Buffer.alloc(size * 4); let any = false;
      for (let p = 0; p < size; p++) { const q = 3 * p, optical = [each[slice]![q]!, each[slice]![q + 1]!, each[slice]![q + 2]!], own = Math.max(...optical); if (!(own > 0)) continue;
        // Light of several colors on one sight line adds toward white, and a browser lays the curtains over each other,
        // which keeps their color. So a texel is as much whiter than its own light as all the light on its sight line
        // through the curtains is than that light spread thin: from the side the curtains then add up as a screen does.
        const most = Math.max(through[q]!, through[q + 1]!, through[q + 2]!);
        for (let c = 0; c < 3; c++) if (through[q + c]! > 0) optical[c] = Math.min(own, optical[c]! * (Math.expm1(-through[q + c]!) / Math.expm1(-most)) / (through[q + c]! / most));
        // A curtain's rounding is carried to the next one at the same place.
        rounding[p] = paintTexel(rgba, 4 * p, optical, rounding[p]!); if (rgba[4 * p + 3]) any = true; }
      if (!any) continue;
      const u = u0 + (u1 - u0) * fraction, v = v0 + (v1 - v0) * fraction;
      leaves.push({ id: name(axis, slice), axis, rgba, width: lengthPixels, height: depthPixels, corners: axis === 'x' ? [[u, v0, reach], [u, v1, reach], [u, v1, -reach], [u, v0, -reach]] : [[u0, v, reach], [u1, v, reach], [u1, v, -reach], [u0, v, -reach]] }); } }
  return leaves;
}
