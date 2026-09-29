/**
 * Prepare a face-on image of a galaxy as a flat backing plane in its volume frame. `source/<id>/recipe.json` names the
 * image, the pixels of the galaxy's centre and of the Sun on it, the view it was drawn from, and the levels that keep it
 * under the catalogue dots. The image is scaled so both anchors land on the app's own positions (the frame origin and
 * the Sun), laid in the plane through them normal to the Galactic north pole, and compiled with the same PolyCSS
 * volume compiler as the galaxy's other planes. Writes `prepared/<id>.json` (`cssearth-galaxy-backing@1`, read by
 * packages/renderer/src/universe/galaxy-backing.ts) and `prepared/<id>/<id>.webp` through the lossy lane.
 *
 * Usage: node packages/bake/cli/prepare-galaxy-backing.mts <object-directory> <id>
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { compileCssVolume } from '@cssearth/bake/volume-leaves';
import { encodeLossyWebp } from '@cssearth/bake/raster';
import type { VolumeSliceQuad } from '@cssearth/bake/volume';
import { parseDensityVolumeFrame } from '@cssearth/objects';

type Vector3 = [number, number, number];
const KPC_M = 3.0856775814913673e19;
/** ICRS to Galactic rotation (Hipparcos, ESA 1997, vol. 1 §1.5.3); its transpose takes Galactic back to ICRS. */
const ICRS_TO_GALACTIC = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]];

const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-galaxy-backing.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared'), sourceDirectory = resolve(objectDirectory, 'source', id);
const recipePath = resolve(sourceDirectory, 'recipe.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as {
  schema?: unknown; id?: unknown; source?: unknown; meaning?: unknown; outputPx?: unknown;
  image?: { path?: unknown; bytes?: unknown; widthPx?: unknown; heightPx?: unknown };
  anchors?: { galacticCentrePx?: unknown; sunPx?: unknown; view?: unknown; galacticCentre?: unknown; longitude90?: unknown; basis?: unknown };
  levels?: { black?: unknown; gamma?: unknown; white?: unknown; note?: unknown } };
const pair = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const { image, anchors, levels } = recipe;
if (recipe.schema !== 'cssearth-galaxy-backing-source@1' || recipe.id !== id || typeof recipe.source !== 'string' || typeof recipe.meaning !== 'string' ||
    !Number.isInteger(recipe.outputPx) || !(recipe.outputPx as number > 0) || !image || typeof image.path !== 'string' || !Number.isInteger(image.bytes) ||
    !anchors || !pair(anchors.galacticCentrePx) || !pair(anchors.sunPx) || anchors.view !== 'north-galactic-pole' || anchors.galacticCentre !== 'up' ||
    (anchors.longitude90 !== 'left' && anchors.longitude90 !== 'right') || typeof anchors.basis !== 'string' || !levels ||
    typeof levels.black !== 'number' || typeof levels.gamma !== 'number' || typeof levels.white !== 'number' || !(levels.gamma > 0) ||
    !(levels.black >= 0 && levels.black < 255) || !(levels.white > 0 && levels.white <= 255) || typeof levels.note !== 'string') {
  throw new TypeError(`${recipePath}: needs schema cssearth-galaxy-backing-source@1, id ${id}, an image, north-pole anchors with centre up, levels and a source.`);
}
const bytes = await readFile(resolve(sourceDirectory, image.path));
if (bytes.length !== image.bytes) throw new TypeError(`${recipePath}: image.bytes expects ${String(image.bytes)}; ${image.path} has ${bytes.length}.`);
const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== image.widthPx || info.height !== image.heightPx) throw new TypeError(`${recipePath}: ${image.path} is ${info.width} x ${info.height}, not ${String(image.widthPx)} x ${String(image.heightPx)}.`);

// Levels, the same curve on every channel, then the image cropped to what the levels leave lit.
const { black, gamma, white } = levels as { black: number; gamma: number; white: number };
const curve = Uint8Array.from({ length: 256 }, (_, value) => Math.round(white * Math.max(0, Math.min(1, (value - black) / (255 - black))) ** gamma));
const graded = Buffer.from(data.map(value => curve[value]!));
let left = info.width, top = info.height, right = -1, bottom = -1;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const i = (y * info.width + x) * 3;
  if (graded[i]! + graded[i + 1]! + graded[i + 2]! < 3) continue;
  left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
}
const cropWidth = right - left + 1, cropHeight = bottom - top + 1, scale = (recipe.outputPx as number) / Math.max(cropWidth, cropHeight);
const widthPx = Math.round(cropWidth * scale), heightPx = Math.round(cropHeight * scale);
const webp = await encodeLossyWebp(sharp(graded, { raw: { width: info.width, height: info.height, channels: 3 } })
  .extract({ left, top, width: cropWidth, height: cropHeight }).resize(widthPx, heightPx));
const texturePath = `${id}/${id}.webp`;
await rm(resolve(prepared, id), { recursive: true, force: true });
await mkdir(resolve(prepared, id), { recursive: true });
await writeFile(resolve(prepared, texturePath), webp);

// Placement: an image pixel becomes a heliocentric Galactic position (x toward the centre, y toward l = 90°, z to the
// north pole), then ICRS, then the volume frame's units.
const galaxy = JSON.parse(await readFile(resolve(prepared, 'volume.json'), 'utf8')) as { data?: { frame?: unknown } };
const frame = parseDensityVolumeFrame(galaxy.data?.frame);
const [centreU, centreV] = anchors.galacticCentrePx as [number, number], [sunU, sunV] = anchors.sunPx as [number, number];
const r0Kpc = Math.hypot(...frame.originM) / KPC_M, kpcPerPx = r0Kpc / Math.hypot(centreU - sunU, centreV - sunV);
const side = anchors.longitude90 === 'left' ? 1 : -1;
const toIcrs = (galactic: Vector3): Vector3 => [0, 1, 2].map(axis => ICRS_TO_GALACTIC.reduce((sum, row, k) => sum + row[axis]! * galactic[k]!, 0)) as Vector3;
const [qx, qy, qz, qw] = frame.localToReferenceXyzw;
const rotateToLocal = (v: Vector3): Vector3 => {
  const [x, y, z] = [-qx!, -qy!, -qz!], w = qw!;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};
const toLocal = (u: number, v: number): Vector3 => {
  // The Galactic centre is up (smaller v), toward +x; longitude 90° is to the recipe's side.
  const galactic: Vector3 = [(sunV - v) * kpcPerPx, side * (sunU - u) * kpcPerPx, 0];
  const reference = toIcrs(galactic).map((value, axis) => value * KPC_M - frame.originM[axis]!) as Vector3;
  return rotateToLocal(reference).map(value => value / frame.metersPerUnit) as Vector3;
};
const vertices = [toLocal(left, top), toLocal(right + 1, top), toLocal(right + 1, bottom + 1), toLocal(left, bottom + 1)] as [Vector3, Vector3, Vector3, Vector3];
const north = rotateToLocal(toIcrs([0, 0, 1]));
const quad: VolumeSliceQuad = { id, axis: 'z', sliceIndex: 0, texturePath, widthPx, heightPx, vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
  center: toLocal((left + right + 1) / 2, (top + bottom + 1) / 2), normal: north.map(value => -value) as Vector3, bytes: webp.length, alphaCoverage: 1 };
// The compiler wants a normal for every axis; empty quads carry the other two and compile to no leaf.
const empty = (axis: 'x' | 'y', normal: Vector3): VolumeSliceQuad => ({ id: `${axis}-empty`, axis, sliceIndex: 0, texturePath: `${id}/${axis}-empty`, widthPx: 1, heightPx: 1,
  vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, 0], normal, bytes: 0, alphaCoverage: 0 });
const compiled = compileCssVolume({ id, frame, recipe: { anchors: [] }, slices: { quads: [quad, empty('x', [-1, 0, 0]), empty('y', [0, 1, 0])],
  boundsUnits: { min: [...frame.boundsUnits.min] as Vector3, max: [...frame.boundsUnits.max] as Vector3 }, provenance: null, approximation: { method: '', radialEmission: 'None.', limitations: [], samplesPerSlab: 1, opticalWeight: 1,
    exposureGain: 1, sliceCounts: { x: 0, y: 0, z: 1 }, slabPitchUnits: { x: 0, y: 0, z: 0 } } } });
const leaf = compiled.stacks.find(stack => stack.axis === 'z')!.leaves[0]!;
await writeFile(resolve(prepared, `${id}.json`), JSON.stringify({ schema: 'cssearth-galaxy-backing@1', id, source: recipe.source, meaning: recipe.meaning,
  frame, leaf: { texturePath: leaf.texturePath, style: leaf.style }, placement: { kpcPerSourcePx: kpcPerPx, crop: { left, top, width: cropWidth, height: cropHeight } },
  levelsNote: levels.note }) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Prepared a ${widthPx} x ${heightPx} backing (${webp.length} bytes) at ${(kpcPerPx / scale * 1000).toFixed(1)} pc per texel, ${(cropWidth * kpcPerPx).toFixed(1)} kpc across.`);
