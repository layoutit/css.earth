/**
 * Bake prepared catalogue point banks onto fixed planes in their galaxy's frame, so they move with the galaxy on the
 * compositor instead of being projected on every frame. `source/<planes-id>/planes.json` names two things:
 *
 * - `dots`: banks drawn as SVG circles on the disc-parallel plane nearest each point's height, at a near and a far dot
 *   size the renderer crossfades by how many parsecs a screen pixel covers.
 * - `map`: banks whose points carry a map weight (prepare.mts `mapWeight`), summed as weighted Gaussians on the
 *   midplane, the face-on density map of Hou & Han (2014, Eq. 2), and drawn as one image under the dots.
 *
 * Planes are compiled with the same PolyCSS volume compiler as the galaxy. Points outside the galaxy frame's bounds are
 * counted and left out. Writes `prepared/<planes-id>.json` (`cssearth-catalogue-planes@1`, read by
 * packages/renderer/src/universe/catalogue-planes.ts).
 *
 * Usage: node tools/objects/catalogue-points/planes.mts <object-directory> <planes-id>
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import { compileCssVolume } from '@cssearth/bake/volume-leaves';
import { encodeLossyWebp } from '@cssearth/bake/raster';
import type { VolumeSliceQuad, VolumeSlices } from '@cssearth/bake/volume';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';

type Vector3 = [number, number, number];
const PARSEC_M = 3.0856775814913673e16;
/** Planes parallel to the galactic disc. Points are not a continuous cloud: slabs across the disc lined them up into a
 * grid and stretched them into streaks at oblique views, so every dot is drawn once, on the plane at its height.
 * 16 planes put each dot within 150 pc of its height; the tracers lie within a few hundred parsecs of the midplane. */
const PLANES = 16;
/** Texels per volume unit: the galaxy volume's own sampling (1024 px across its 20-unit disc, 38 pc per texel). The
 * map's 200 pc Gaussians span about ten texels, so it stays smooth without being stretched. */
const TEXELS_PER_UNIT = 51.2;
/** A bank's dot radius, in its CSS pixels, becomes this many parsecs in space per level: its 0.5 px dots are 8 pc
 * discs up close and 32 pc from far out. The renderer crossfades at 32 pc per screen pixel, where the near discs are a
 * quarter pixel across and the far ones one pixel; at the whole-galaxy view (about 57 pc per pixel) a far dot is a pixel. */
const LEVELS = [{ id: 'near', radiusPcPerPointPx: 16 }, { id: 'far', radiusPcPerPointPx: 64 }] as const;
const HANDOFF_PC_PER_PIXEL = 32;

const [objectArgument, planesId] = process.argv.slice(2);
if (!objectArgument || !planesId || !/^[a-z][a-z0-9-]*$/u.test(planesId)) throw new TypeError('Usage: planes.mts <object-directory> <planes-id>');
const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(objectDirectory, 'source', planesId, 'planes.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as { schema?: unknown; id?: unknown; dots?: unknown; map?: {
  banks?: unknown; sigmaPc?: unknown; source?: unknown; method?: unknown; display?: { clipPercentile?: unknown; ramp?: unknown; note?: unknown } } };
const hexColour = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);
const ids = (value: unknown) => Array.isArray(value) && value.length && value.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id));
const map = recipe.map, display = map?.display, ramp = display?.ramp as [number, string][] | undefined;
if (recipe.schema !== 'cssearth-catalogue-planes-source@1' || recipe.id !== planesId || !ids(recipe.dots) || !map || !ids(map.banks) ||
    typeof map.sigmaPc !== 'number' || !(map.sigmaPc > 0) || typeof map.source !== 'string' || typeof map.method !== 'string' ||
    typeof display?.clipPercentile !== 'number' || !(display.clipPercentile > 0 && display.clipPercentile <= 100) || typeof display.note !== 'string' ||
    !Array.isArray(ramp) || ramp.length < 2 || !ramp.every(([at, colour], index) => typeof at === 'number' && hexColour(colour) && (index ? at > ramp[index - 1]![0] : at === 0)) ||
    ramp.at(-1)![0] !== 1) {
  throw new TypeError(`${recipePath}: needs schema cssearth-catalogue-planes-source@1, id ${planesId}, dots, and a map with banks, sigmaPc, source, method and a display ramp from 0 to 1.`);
}
const dotIds = recipe.dots as string[], mapIds = map.banks as string[], sigmaPc = map.sigmaPc;
const galaxy = JSON.parse(await readFile(resolve(prepared, 'volume.json'), 'utf8')) as { data?: { frame?: unknown } };
const frame: DensityVolumeFrame = parseDensityVolumeFrame(galaxy.data?.frame);
const { min, max } = frame.boundsUnits;
const PC_PER_UNIT = frame.metersPerUnit / PARSEC_M, TEXEL_PC = PC_PER_UNIT / TEXELS_PER_UNIT;

// Sun-centred ICRF kpc → the galaxy frame's units: local = conj(q) · (p − origin) · q / metersPerUnit.
const [qx, qy, qz, qw] = frame.localToReferenceXyzw;
const toLocal = (reference: readonly number[]): Vector3 => {
  const v = reference.map((value, axis) => value - frame.originM[axis]!) as Vector3;
  const [x, y, z] = [-qx!, -qy!, -qz!], w = qw!;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
    .map(value => value / frame.metersPerUnit) as Vector3;
};

/** A `cssearth-catalogue-points@1` bank as prepare.mts writes it: Sun-centred ICRF kpc, one colour or a palette, and map
 * weights when its recipe declares them. */
async function readBank(id: string) {
  const bank = JSON.parse(await readFile(resolve(prepared, `${id}.json`), 'utf8')) as { schema?: unknown; source?: unknown; frame?: unknown;
    appearance?: { colorCss?: unknown; radiusPx?: unknown; opacity?: unknown; palette?: unknown }; points?: unknown; weights?: unknown };
  const bankFrame = parseDensityVolumeFrame(bank?.frame), appearance = bank?.appearance;
  if (bank?.schema !== 'cssearth-catalogue-points@1' || !appearance || !hexColour(appearance.colorCss) || typeof appearance.radiusPx !== 'number' ||
      !(appearance.radiusPx > 0) || typeof appearance.opacity !== 'number' || !(appearance.opacity > 0 && appearance.opacity <= 1) || !Array.isArray(bank.points)) {
    throw new TypeError(`${id}: not a catalogue point bank.`);
  }
  if (bankFrame.referenceFrame !== frame.referenceFrame || bankFrame.epochJdTt !== frame.epochJdTt) throw new TypeError(`${id}: bank frame ${bankFrame.referenceFrame} @ ${bankFrame.epochJdTt} differs from the galaxy's.`);
  if (bankFrame.originM.some(value => value !== 0) || bankFrame.localToReferenceXyzw.some((value, index) => value !== [0, 0, 0, 1][index])) throw new TypeError(`${id}: only Sun-centred, unrotated banks are supported.`);
  const palette = appearance.palette === undefined ? null : appearance.palette;
  if (palette !== null && (!Array.isArray(palette) || !palette.every(hexColour))) throw new TypeError(`${id}: the palette must be hex colours.`);
  const weights = bank.weights;
  if (weights !== undefined && (!Array.isArray(weights) || weights.length !== bank.points.length || !weights.every(value => typeof value === 'number' && value >= 0))) {
    throw new TypeError(`${id}: weights must be one non-negative number per point.`);
  }
  const outside = { count: 0 };
  const points = bank.points.flatMap((point: unknown, index: number) => {
    if (!Array.isArray(point) || point.length !== (palette ? 4 : 3) || !point.every(Number.isFinite)) throw new TypeError(`${id}: point ${index} is malformed.`);
    const colour = palette ? palette[point[3] as number] : appearance.colorCss;
    if (!hexColour(colour)) throw new TypeError(`${id}: point ${index} names palette colour ${point[3]}, which the palette of ${palette!.length} lacks.`);
    const position = toLocal((point.slice(0, 3) as number[]).map(value => value * bankFrame.metersPerUnit));
    if (position.some((value, axis) => value < min[axis]! || value >= max[axis]!)) { outside.count++; return []; }
    return [{ position, colour, weight: weights ? (weights as number[])[index]! : null }];
  });
  return { id, source: typeof bank.source === 'string' ? bank.source : '', radius: appearance.radiusPx, opacity: appearance.opacity, points, outside: outside.count };
}

const output = resolve(prepared, planesId);
await rm(output, { recursive: true, force: true });
const width = Math.round((max[0]! - min[0]!) * TEXELS_PER_UNIT), height = Math.round((max[1]! - min[1]!) * TEXELS_PER_UNIT);
const at = (x: number, y: number, z: number): Vector3 => [min[0]! + x / TEXELS_PER_UNIT, max[1]! - y / TEXELS_PER_UNIT, z];
/** Compile disc-parallel quads into PolyCSS leaves; the compiler wants a normal for every axis, so an empty quad
 * carries the other two and compiles to no leaf. */
function compileLeaves(id: string, quads: VolumeSliceQuad[]) {
  const all = [...quads, ...(['x', 'y'] as const).map((axis): VolumeSliceQuad => ({ id: `${axis}-empty`, axis, sliceIndex: 0, texturePath: `${planesId}/${axis}-empty`,
    widthPx: 1, heightPx: 1, vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, 0],
    normal: axis === 'x' ? [-1, 0, 0] : [0, 1, 0], sha256: '', bytes: 0, alphaCoverage: 0 }))];
  const slices: VolumeSlices = { quads: all, boundsUnits: frame.boundsUnits, provenance: null,
    approximation: { method: '', radialEmission: 'None.', limitations: [], samplesPerSlab: 1, opticalWeight: 1, exposureGain: 1,
      sliceCounts: { x: 0, y: 0, z: quads.length }, slabPitchUnits: { x: 0, y: 0, z: (max[2]! - min[2]!) / PLANES } } };
  const compiled = compileCssVolume({ id, frame, slices, recipe: { anchors: [] } });
  return { leaves: compiled.stacks.find(stack => stack.axis === 'z')!.leaves.map(({ id: leafId, texturePath, style }) => ({ id: leafId, texturePath, style })),
    resources: compiled.resources };
}
const quad = (id: string, texturePath: string, left: number, top: number, right: number, bottom: number, z: number, image: Buffer, coverage: number): VolumeSliceQuad => ({
  id, axis: 'z', sliceIndex: 0, texturePath, widthPx: right - left + 1, heightPx: bottom - top + 1,
  vertices: [at(left, top, z), at(right + 1, top, z), at(right + 1, bottom + 1, z), at(left, bottom + 1, z)],
  uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: at((left + right + 1) / 2, (top + bottom + 1) / 2, z), normal: [0, 0, -1],
  sha256: sha256(image), bytes: image.length, alphaCoverage: coverage });
const write = async (texturePath: string, image: Buffer) => {
  await mkdir(dirname(resolve(prepared, texturePath)), { recursive: true });
  await writeFile(resolve(prepared, texturePath), image);
};
let totalBytes = 0;

// The map: Hou & Han (2014) Eq. 2, L(x, y) = Σ W_i / (2πσ²) · exp(−r² / 2σ²), in kpc⁻², on the midplane.
const mapBanks = await Promise.all(mapIds.map(readBank));
const density = new Float64Array(width * height), sigmaTexels = sigmaPc / TEXEL_PC, sigmaKpc = sigmaPc / 1000, reach = Math.ceil(4 * sigmaTexels);
for (const bank of mapBanks) for (const point of bank.points) {
  if (point.weight === null) throw new TypeError(`${bank.id}: a map bank needs map weights (its recipe's mapWeight).`);
  if (!point.weight) continue;
  const u = (point.position[0] - min[0]!) * TEXELS_PER_UNIT, v = (max[1]! - point.position[1]) * TEXELS_PER_UNIT;
  for (let y = Math.max(0, Math.floor(v) - reach); y <= Math.min(height - 1, Math.floor(v) + reach); y++) {
    for (let x = Math.max(0, Math.floor(u) - reach); x <= Math.min(width - 1, Math.floor(u) + reach); x++) {
      const r2 = ((x + .5 - u) ** 2 + (y + .5 - v) ** 2) / (sigmaTexels * sigmaTexels);
      density[y * width + x] += point.weight / (2 * Math.PI * sigmaKpc * sigmaKpc) * Math.exp(-r2 / 2);
    }
  }
}
// Display: a square-root stretch clipped at a percentile of the non-empty texels, through the recipe's colour ramp, with
// the stretched value as alpha so empty disc stays transparent. Presentation only; the density is the paper's.
const stretched = Array.from(density, Math.sqrt), filled = stretched.filter(value => value > 1e-3).sort((a, b) => a - b);
const clip = filled[Math.min(filled.length - 1, Math.floor(filled.length * (display!.clipPercentile as number) / 100))]!;
const colourAt = (t: number) => {
  const upper = ramp!.findIndex(([stop]) => stop >= t), [t1, c1] = ramp![upper]!, [t0, c0] = ramp![Math.max(0, upper - 1)]!;
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  return [1, 3, 5].map(i => Math.round(parseInt(c0.slice(i, i + 2), 16) * (1 - f) + parseInt(c1.slice(i, i + 2), 16) * f));
};
const rgba = Buffer.alloc(width * height * 4);
let mapLeft = width, mapTop = height, mapRight = -1, mapBottom = -1, mapCovered = 0;
for (let index = 0; index < density.length; index++) {
  const t = Math.min(1, stretched[index]! / clip), alpha = Math.round(t * 255);
  if (!alpha) continue;
  const [r, g, b] = colourAt(t);
  rgba.set([r!, g!, b!, alpha], index * 4);
  const x = index % width, y = Math.floor(index / width);
  mapCovered++; mapLeft = Math.min(mapLeft, x); mapRight = Math.max(mapRight, x); mapTop = Math.min(mapTop, y); mapBottom = Math.max(mapBottom, y);
}
const mapImage = await encodeLossyWebp(sharp(rgba, { raw: { width, height, channels: 4 } })
  .extract({ left: mapLeft, top: mapTop, width: mapRight - mapLeft + 1, height: mapBottom - mapTop + 1 }));
const mapPath = `${planesId}/map.webp`;
await write(mapPath, mapImage); totalBytes += mapImage.length;
const mapPlane = compileLeaves(`${planesId}-map`, [quad('map', mapPath, mapLeft, mapTop, mapRight, mapBottom, 0, mapImage,
  mapCovered / ((mapRight - mapLeft + 1) * (mapBottom - mapTop + 1)))]);

// The dots, once per level, each on the plane nearest its height.
const dotBanks = await Promise.all(dotIds.map(readBank));
const dots = dotBanks.flatMap(bank => bank.points.map(point => ({ ...point, radius: bank.radius, opacity: bank.opacity })));
const pitch = (max[2]! - min[2]!) / PLANES;
const levels = [];
for (const level of LEVELS) {
  const quads: VolumeSliceQuad[] = [];
  for (let slice = 0; slice < PLANES; slice++) {
    const members = dots.filter(dot => Math.min(PLANES - 1, Math.floor((dot.position[2] - min[2]!) / pitch)) === slice);
    if (!members.length) continue;
    // Vector circles: the browser draws them sharp at whatever scale the plane is shown.
    const circles = members.map(dot => ({ u: (dot.position[0] - min[0]!) * TEXELS_PER_UNIT, v: (max[1]! - dot.position[1]) * TEXELS_PER_UNIT,
      r: dot.radius * level.radiusPcPerPointPx / TEXEL_PC, dot }));
    const left = Math.max(0, Math.floor(Math.min(...circles.map(c => c.u - c.r)))), top = Math.max(0, Math.floor(Math.min(...circles.map(c => c.v - c.r))));
    const right = Math.min(width, Math.ceil(Math.max(...circles.map(c => c.u + c.r)))) - 1, bottom = Math.min(height, Math.ceil(Math.max(...circles.map(c => c.v + c.r)))) - 1;
    const image = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${right - left + 1}" height="${bottom - top + 1}" viewBox="0 0 ${right - left + 1} ${bottom - top + 1}">` +
      circles.map(({ u, v, r, dot }) => `<circle cx="${+(u - left).toFixed(2)}" cy="${+(v - top).toFixed(2)}" r="${+r.toFixed(3)}" fill="${dot.colour}"${dot.opacity < 1 ? ` fill-opacity="${dot.opacity}"` : ''}/>`).join('') + '</svg>\n');
    const texturePath = `${planesId}/${level.id}/${String(slice).padStart(2, '0')}.svg`;
    await write(texturePath, image); totalBytes += image.length;
    const coverage = Math.min(1, circles.reduce((sum, c) => sum + Math.PI * c.r * c.r, 0) / ((right - left + 1) * (bottom - top + 1)));
    quads.push({ ...quad(`${level.id}-${slice}`, texturePath, left, top, right, bottom, min[2]! + (slice + .5) * pitch, image, coverage), sliceIndex: slice });
  }
  levels.push({ id: level.id, dotRadiusPcPerPointPx: level.radiusPcPerPointPx, ...compileLeaves(`${planesId}-${level.id}`, quads) });
}

const banks = [...mapBanks.map(bank => ({ id: bank.id, source: bank.source, role: 'map', points: bank.points.length, outside: bank.outside })),
  ...dotBanks.map(bank => ({ id: bank.id, source: bank.source, role: 'dots', points: bank.points.length, outside: bank.outside }))];
const planes = { schema: 'cssearth-catalogue-planes@1', id: planesId, frame, handoffPcPerPixel: HANDOFF_PC_PER_PIXEL,
  map: { source: map.source, method: map.method, sigmaPc, displayNote: display!.note, clipDensityPerKpc2: +(clip * clip).toFixed(4), ...mapPlane },
  levels, provenance: { banks },
  approximation: { method: 'Dots as SVG circles on the disc-parallel plane nearest each point, at two dot sizes; the density map as one midplane image.',
    limitations: [`A dot sits on the plane nearest its height: up to ${(pitch / 2 * PC_PER_UNIT).toFixed(0)} pc off.`,
      'Seen edge-on, the planes flatten to lines.', 'Dots have a fixed size in space at each level, not on screen.',
      'The map is flat: it draws the tracers\' face-on density on the midplane.'] } };
await writeFile(resolve(prepared, `${planesId}.json`), JSON.stringify(planes) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Baked a ${mapRight - mapLeft + 1} x ${mapBottom - mapTop + 1} map from ${JSON.stringify(Object.fromEntries(mapBanks.map(bank => [bank.id, bank.points.length])))} ` +
  `and ${dots.length} dots on ${levels.map(level => `${level.leaves.length} ${level.id}`).join(' and ')} planes (${totalBytes} bytes); ` +
  `outside the frame: ${JSON.stringify(Object.fromEntries(banks.map(bank => [bank.id, bank.outside])))}.`);
