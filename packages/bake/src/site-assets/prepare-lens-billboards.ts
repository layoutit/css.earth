// `pnpm prepare:lens-billboards` (`packages/bake/cli/prepare-lens-billboards.mts`): what the universe knows about every volume lens bank before fetching it.
// Each bank gets its context visibility (whether it fades with the galaxy) and, when its default lens has
// prepared impostors, the one impostor view that faces the Sun, packed with the others into one atlas image.
// From the Solar System and the nearby stars a nebula is a few pixels to a few dozen: the atlas draws it there,
// and its megabytes of lenses are fetched only once it is large on screen. Inputs are the restored prepared
// lens payloads, each one the object's inventory lists.
// An image-layer galaxy (Andromeda, Triangulum) gets the same one view: its source-facing slices, seen from the Sun and
// composited back to front as the page composites them, so the galaxy shows from afar before its slices load.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { encodeLossyWebp } from '../raster/index.ts';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { readInventory } from '@cssearth/objects/node';

const OUTPUT = { metadata: 'site/prepared-lens-billboards.json', atlas: 'site/prepared-lens-billboards.webp' };
/** Prepared impostor views are 256 px squares; cells keep them at their prepared size. */
const CELL_PX = 256;

type Vector = [number, number, number];
const vector = (value: unknown, label: string): Vector => {
  const values = requireArray(value, label);
  if (values.length !== 3 || !values.every(item => typeof item === 'number' && Number.isFinite(item))) throw new TypeError(`${label} must be three finite numbers.`);
  return values as Vector;
};

async function writeIfChanged(path: string, bytes: Uint8Array | string): Promise<void> {
  const next = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
  try { if (Buffer.compare(await readFile(path), next) === 0) return; } catch (error) { if (!isRecord(error) || error.code !== 'ENOENT') throw error; }
  await writeFile(path, next);
}

/** The prepared payload a descriptor names, which the object's inventory must list. */
async function preparedPayload(id: string, descriptor: Record<string, unknown>, objects: string) {
  const pin = requireRecord(descriptor.prepared, `${id} prepared pin`);
  const url = requireString(pin.url, `${id} prepared url`), filename = url.replace(/^prepared\//u, '');
  const entry = (await readInventory(id, resolve(objects, id)))?.assets.find(asset => asset.location === 'prepared' && asset.filename === filename);
  if (!entry) throw new TypeError(`${id}: src/objects/${id}/inventory.json lists no prepared ${filename}.`);
  const bytes = await readFile(resolve(objects, id, url)).catch((error: unknown) => {
    throw new Error(`${id}: src/objects/${id}/${url} is missing; run pnpm setup:prepared.`, { cause: error });
  });
  return requireRecord(JSON.parse(bytes.toString('utf8')), `${id} prepared payload`);
}

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const unit = (a: readonly number[]): Vector => { const length = Math.hypot(a[0]!, a[1]!, a[2]!); return [a[0]! / length, a[1]! / length, a[2]! / length]; };
const minus = (a: readonly number[], b: readonly number[]): Vector => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const along = (a: readonly number[], b: readonly number[], scale: number): Vector => [a[0]! - b[0]! * scale, a[1]! - b[1]! * scale, a[2]! - b[2]! * scale];

/** An image-layer galaxy seen from the Sun: its source-facing (z) slices projected along the line of sight onto a plane
 * through the frame origin, each resized to the size it covers there, then stacked far to near with the straight-alpha
 * "over" the page applies to them, in sRGB as the page does. */
async function imageLayerBillboard(id: string, descriptor: Record<string, unknown>, objects: string) {
  const data = await preparedPayload(id, descriptor, objects);
  const frame = requireRecord(data.frame, `${id} frame`) as unknown as Parameters<typeof presentPhysicalPoseInVolume>[1];
  if (JSON.stringify(frame) !== JSON.stringify(requireRecord(descriptor.properties).frame)) throw new TypeError(`${id}: image-layer frame differs from the descriptor frame.`);
  const toViewer = unit(presentPhysicalPoseInVolume({ positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] }, frame).positionUnits);
  const bank = requireArray(data.banks, `${id} banks`).map(value => requireRecord(value)).find(value => value.axis === 'z');
  if (!bank) throw new TypeError(`${id}: no source-facing (z) bank.`);
  const leaves = requireArray(bank.leaves, `${id} z leaves`).map(value => requireRecord(value)).map(leaf => {
    const corners = requireArray(leaf.verticesUnits, `${id} ${String(leaf.id)} vertices`).map((value, index) => vector(value, `${id} ${String(leaf.id)} vertex ${index}`));
    const uvs = JSON.stringify(leaf.uvs);
    if (corners.length !== 4 || uvs !== '[[0,0],[1,0],[1,1],[0,1]]') throw new TypeError(`${id} ${String(leaf.id)}: a slice must be one quad with corner UVs.`);
    return { id: String(leaf.id), texture: requireString(leaf.texturePath, `${id} ${String(leaf.id)} texture`), corners, depth: dot(vector(leaf.centerUnits, `${id} centre`), toViewer) };
  });
  // The billboard's axes follow the slices' own image axes, laid flat across the line of sight.
  const [origin, first, , last] = leaves[0]!.corners as [Vector, Vector, Vector, Vector];
  const rightAxis = unit(along(minus(first, origin), toViewer, dot(minus(first, origin), toViewer)));
  const downRaw = along(minus(last, origin), toViewer, dot(minus(last, origin), toViewer));
  const downAxis = unit(along(downRaw, rightAxis, dot(downRaw, rightAxis)));
  const flat = (point: Vector) => [dot(point, rightAxis), dot(point, downAxis)] as const;
  const radiusUnits = Math.max(...leaves.flatMap(leaf => leaf.corners.flatMap(point => flat(point).map(Math.abs))));
  const scale = CELL_PX / (2 * radiusUnits);
  const pixel = (point: Vector) => { const [x, y] = flat(point); return [(x + radiusUnits) * scale, (y + radiusUnits) * scale] as const; };
  const out = new Float64Array(CELL_PX * CELL_PX * 4);
  for (const leaf of [...leaves].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))) {
    const [p0, p1, , p3] = leaf.corners.map(pixel) as [readonly [number, number], readonly [number, number], unknown, readonly [number, number]];
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], bx = p3[0] - p0[0], by = p3[1] - p0[1], determinant = ax * by - ay * bx;
    const width = Math.max(1, Math.round(Math.hypot(ax, ay))), height = Math.max(1, Math.round(Math.hypot(bx, by)));
    const { data: texels } = await sharp(await readFile(resolve(objects, id, 'prepared', leaf.texture))).ensureAlpha()
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    for (let py = 0; py < CELL_PX; py++) for (let px = 0; px < CELL_PX; px++) {
      const dx = px + .5 - p0[0], dy = py + .5 - p0[1];
      const u = (dx * by - dy * bx) / determinant, v = (ax * dy - ay * dx) / determinant;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      // Bilinear, as the page's texture sampling.
      const sx = Math.min(width - 1, Math.max(0, u * width - .5)), sy = Math.min(height - 1, Math.max(0, v * height - .5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
      const at = (x: number, y: number, channel: number) => texels[(y * width + x) * 4 + channel]!;
      const sample = (channel: number) => (at(x0, y0, channel) * (1 - fx) + at(x1, y0, channel) * fx) * (1 - fy) + (at(x0, y1, channel) * (1 - fx) + at(x1, y1, channel) * fx) * fy;
      const alpha = sample(3) / 255, index = (py * CELL_PX + px) * 4;
      if (alpha <= 0) continue;
      // Premultiplied "over": the new slice in front of what is already there.
      for (let channel = 0; channel < 3; channel++) out[index + channel] = sample(channel) * alpha + out[index + channel]! * (1 - alpha);
      out[index + 3] = alpha + out[index + 3]! * (1 - alpha);
    }
  }
  const rgba = Buffer.alloc(CELL_PX * CELL_PX * 4);
  for (let index = 0; index < CELL_PX * CELL_PX; index++) {
    const alpha = out[index * 4 + 3]!;
    for (let channel = 0; channel < 3; channel++) rgba[index * 4 + channel] = alpha > 0 ? Math.round(Math.min(255, out[index * 4 + channel]! / alpha)) : 0;
    rgba[index * 4 + 3] = Math.round(alpha * 255);
  }
  const image = await sharp(rgba, { raw: { width: CELL_PX, height: CELL_PX, channels: 4 } }).png().toBuffer();
  return { id, contextVisibility: 'galactic' as const, attached: false, view: { back: toViewer, right: rightAxis, down: downAxis }, radiusUnits, image };
}

/** Writes the lens billboards of the checkout at `projectRoot`. */
export async function prepareLensBillboards(projectRoot = process.cwd()) {
  const objects = resolve(projectRoot, 'src/objects');
  const banks: { id: string; contextVisibility: 'galactic' | 'independent'; attached: boolean;
    view?: { back: Vector; right: Vector; down: Vector }; radiusUnits?: number; framingRadiusUnits?: number; image?: Buffer }[] = [];
  for (const id of (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    let descriptor: Record<string, unknown>;
    try { descriptor = requireRecord(JSON.parse(await readFile(resolve(objects, id, 'object.json'), 'utf8'))); }
    catch (error) { if (isRecord(error) && error.code === 'ENOENT') continue; throw error; }
    if (descriptor.type === 'image-layer-bank') { banks.push(await imageLayerBillboard(id, descriptor, objects)); continue; }
    if (descriptor.type !== 'volume-lens-bank') continue;
    const data = requireRecord((await preparedPayload(id, descriptor, objects)).data, `${id} lenses`);
    const contextVisibility = data.contextVisibility ?? 'galactic';
    if (contextVisibility !== 'galactic' && contextVisibility !== 'independent') throw new TypeError(`${id}: unsupported context visibility.`);
    const lens = requireArray(data.lenses, `${id} lenses`).map(value => requireRecord(value)).find(value => value.id === data.defaultLens);
    if (!lens) throw new TypeError(`${id}: default lens is missing.`);
    const volume = requireRecord(lens.volume, `${id} default lens volume`);
    if (JSON.stringify(volume.frame) !== JSON.stringify(requireRecord(descriptor.properties).frame)) {
      throw new TypeError(`${id}: default lens frame differs from the descriptor frame.`);
    }
    // A cloud that accompanies a body stays dark until that body's dataset asks for it.
    const framingRadiusUnits = data.framingRadiusUnits;
    if (typeof framingRadiusUnits !== 'number' || !(framingRadiusUnits > 0)) throw new TypeError(`${id}: lenses need a positive framingRadiusUnits, got ${String(framingRadiusUnits)}.`);
    // The authored framing radius is what the universe hangs the bank's caption under, before any lens loads.
    const bank = { id, contextVisibility, attached: data.attachedTo !== undefined, framingRadiusUnits } as (typeof banks)[number];
    if (volume.impostors !== undefined) {
      const impostors = requireRecord(volume.impostors, `${id} impostors`);
      const frame = requireRecord(volume.frame) as unknown as Parameters<typeof presentPhysicalPoseInVolume>[1];
      // The view the renderer would pick for a camera at the Sun: its direction to the viewer in the volume.
      const local = presentPhysicalPoseInVolume({ positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] }, frame).positionUnits;
      const length = Math.hypot(...local), toViewer = local.map(value => value / length);
      const views = requireArray(impostors.views, `${id} impostor views`).map(value => requireRecord(value));
      const view = views.reduce((best, candidate) => {
        const score = (value: Record<string, unknown>) => vector(value.back, `${id} view back`).reduce((sum, item, axis) => sum + item * toViewer[axis]!, 0);
        return score(candidate) > score(best) ? candidate : best;
      });
      const image = await readFile(resolve(objects, id, 'prepared', requireString(view.texturePath, `${id} view texture`)));
      const { width, height } = await sharp(image).metadata();
      if (width !== CELL_PX || height !== CELL_PX) throw new TypeError(`${id}: impostor view is ${width}x${height}, not ${CELL_PX} px.`);
      bank.view = { back: vector(view.back, `${id} back`), right: vector(view.right, `${id} right`), down: vector(view.down, `${id} down`) };
      bank.radiusUnits = typeof impostors.radiusUnits === 'number' ? impostors.radiusUnits : NaN;
      if (!(bank.radiusUnits > 0)) throw new TypeError(`${id}: impostor radius must be positive.`);
      bank.image = image;
    }
    banks.push(bank);
  }
  const drawn = banks.filter(bank => bank.image);
  const columns = Math.max(1, Math.ceil(Math.sqrt(drawn.length))), rows = Math.max(1, Math.ceil(drawn.length / columns));
  // Photographic billboards go through the lossy lane with exact alpha: lossless was 247 KB, lossy 98 KB, and pixelmatch
  // (threshold 0.1) flags 4 of the atlas's 1,048,576 pixels (2026-09-25). Effort 4, not 6: every dev start encodes this
  // atlas; 6 took 4.7 s and 4 takes 0.3 s for 6.7 KB more (220,384 against 227,078 bytes), and pixelmatch (threshold
  // 0.1) finds 0 of the 1,310,720 pixels differ between the two atlases (2026-09-30).
  const atlas = await encodeLossyWebp(sharp({ create: { width: columns * CELL_PX, height: rows * CELL_PX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(drawn.map((bank, index) => ({ input: bank.image!, left: (index % columns) * CELL_PX, top: Math.floor(index / columns) * CELL_PX }))),
    { alphaQuality: 100, effort: 4 });
  const metadata = { schema: 'cssearth-lens-billboards@1', atlas: { columns, rows, cellPx: CELL_PX },
    banks: banks.map(bank => ({ id: bank.id, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(bank.framingRadiusUnits === undefined ? {} : { framingRadiusUnits: bank.framingRadiusUnits }),
      ...(bank.view ? { billboard: { cell: drawn.indexOf(bank), radiusUnits: bank.radiusUnits, ...bank.view } } : {}) })) };
  await writeIfChanged(resolve(projectRoot, OUTPUT.atlas), atlas);
  await writeIfChanged(resolve(projectRoot, OUTPUT.metadata), `${JSON.stringify(metadata)}\n`);
  return { banks: banks.length, billboards: drawn.length, atlasBytes: atlas.length };
}
