import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { DATASET_BILLBOARDS_SCHEMA } from '@cssearth/objects';
// `pnpm prepare:dataset-billboards` (`packages/bake/cli/prepare-dataset-billboards.mts`): what the universe knows about every volume dataset bank before fetching it.
// Each bank gets its context visibility (whether it fades with the galaxy) and, when its default dataset has
// prepared impostors, the one impostor view that faces the Sun, as an image of its own named by the bank's id.
// Every other dataset with impostors gets the same view as `<bank id>.<dataset id>`: a billboard stands for the dataset
// that is selected. With one image for the bank, zooming out of Betelgeuse drew its 2024 dust, the bank's default, over
// the February 2020 halo that was selected (2026-10-03).
// From the Solar System and the nearby stars a nebula is a few pixels to a few dozen: its billboard draws it there,
// and its megabytes of datasets are fetched only once it is large on screen. Inputs are the restored prepared
// dataset payloads, each one the object's inventory lists.
// One image for each bank, not one atlas for all: a page fetches the billboards it shows, and a billboard's layer draws
// from an image its own size. With 98 billboards in one 2560 px atlas, the first billboard shown fetched 2 MB, and on an
// iPad every billboard's layer made the GPU process copy the whole atlas before drawing its cell: 7 to 12 ms each, 87 to
// 92 ms over a zoom out of Earth. With an image for each, the copies take 0 to 1 ms, and the zoom's frames over 25 ms
// fall from 13 to 17 of 330 to 6 or 7 (three native captures each way, 2026-10-03).
// An image-layer galaxy (Andromeda, Triangulum) gets the same one view: its source-facing slices, seen from the Sun and
// composited back to front as the page composites them, so the galaxy shows from afar before its slices load.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { encodeLossyWebp } from '../raster/index.ts';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { readInventory } from '@cssearth/objects/node';

/** The images are served from the site's own `public/` tree, beside the other generated navigation images. */
const OUTPUT = { metadata: 'site/prepared-dataset-billboards.json', images: 'public/navigation/dataset-billboards' };
/** Prepared impostor views are 256 px squares; billboards keep them at their prepared size. */
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

/** Writes the dataset billboards of the checkout at `projectRoot`. */
export async function prepareDatasetBillboards(projectRoot = checkoutProjectRoot(import.meta.url)) {
  const objects = resolve(projectRoot, 'src/objects');
  type Drawn = { view: { back: Vector; right: Vector; down: Vector }; radiusUnits: number; image: Buffer };
  const banks: { id: string; contextVisibility: 'galactic' | 'independent'; attached: boolean; framingRadiusUnits?: number;
    view?: Drawn['view']; radiusUnits?: number; image?: Buffer; defaultDataset?: string; datasets?: (Drawn & { id: string })[] }[] = [];
  for (const id of (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    let descriptor: Record<string, unknown>;
    try { descriptor = requireRecord(JSON.parse(await readFile(resolve(objects, id, 'object.json'), 'utf8'))); }
    catch (error) { if (isRecord(error) && error.code === 'ENOENT') continue; throw error; }
    if (descriptor.type === 'image-layer-bank') { banks.push(await imageLayerBillboard(id, descriptor, objects)); continue; }
    if (descriptor.type !== 'volume-dataset-bank') continue;
    const data = requireRecord((await preparedPayload(id, descriptor, objects)).data, `${id} datasets`);
    const contextVisibility = data.contextVisibility ?? 'galactic';
    if (contextVisibility !== 'galactic' && contextVisibility !== 'independent') throw new TypeError(`${id}: unsupported context visibility.`);
    const datasets = requireArray(data.datasets, `${id} datasets`).map(value => requireRecord(value));
    const dataset = datasets.find(value => value.id === data.defaultDataset);
    if (!dataset) throw new TypeError(`${id}: default dataset is missing.`);
    const descriptorFrame = JSON.stringify(requireRecord(descriptor.properties).frame);
    /** The impostor view the renderer would pick for a camera at the Sun, or none for a dataset without impostors. */
    const sunView = async (dataset: Record<string, unknown>): Promise<Drawn | undefined> => {
      const label = `${id} ${String(dataset.id)}`, volume = requireRecord(dataset.volume, `${label} volume`);
      // The billboard is placed in the bank's one frame, whichever dataset it pictures.
      if (JSON.stringify(volume.frame) !== descriptorFrame) throw new TypeError(`${label}: dataset frame differs from the descriptor frame.`);
      if (volume.impostors === undefined) return undefined;
      const impostors = requireRecord(volume.impostors, `${label} impostors`);
      const frame = requireRecord(volume.frame) as unknown as Parameters<typeof presentPhysicalPoseInVolume>[1];
      const local = presentPhysicalPoseInVolume({ positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] }, frame).positionUnits;
      const length = Math.hypot(...local), toViewer = local.map(value => value / length);
      const views = requireArray(impostors.views, `${label} impostor views`).map(value => requireRecord(value));
      const view = views.reduce((best, candidate) => {
        const score = (value: Record<string, unknown>) => vector(value.back, `${label} view back`).reduce((sum, item, axis) => sum + item * toViewer[axis]!, 0);
        return score(candidate) > score(best) ? candidate : best;
      });
      const image = await readFile(resolve(objects, id, 'prepared', requireString(view.texturePath, `${label} view texture`)));
      const { width, height } = await sharp(image).metadata();
      if (width !== CELL_PX || height !== CELL_PX) throw new TypeError(`${label}: impostor view is ${width}x${height}, not ${CELL_PX} px.`);
      const radiusUnits = typeof impostors.radiusUnits === 'number' ? impostors.radiusUnits : NaN;
      if (!(radiusUnits > 0)) throw new TypeError(`${label}: impostor radius must be positive.`);
      return { view: { back: vector(view.back, `${label} back`), right: vector(view.right, `${label} right`), down: vector(view.down, `${label} down`) }, radiusUnits, image };
    };
    // A cloud that accompanies a body stays dark until that body's dataset asks for it.
    const framingRadiusUnits = data.framingRadiusUnits;
    if (typeof framingRadiusUnits !== 'number' || !(framingRadiusUnits > 0)) throw new TypeError(`${id}: datasets need a positive framingRadiusUnits, got ${String(framingRadiusUnits)}.`);
    // The authored framing radius is what the universe hangs the bank's caption under, before any dataset loads.
    const bank = { id, contextVisibility, attached: data.attachedTo !== undefined, framingRadiusUnits } as (typeof banks)[number];
    Object.assign(bank, await sunView(dataset));
    const others: NonNullable<(typeof bank)['datasets']> = [];
    for (const other of datasets) {
      if (other === dataset) continue;
      const drawn = await sunView(other);
      if (drawn) others.push({ id: requireString(other.id, `${id} dataset id`), ...drawn });
    }
    if (others.length) { bank.defaultDataset = requireString(dataset.id, `${id} default dataset`); bank.datasets = others; }
    banks.push(bank);
  }
  const drawn = banks.flatMap(bank => [...(bank.image ? [{ name: bank.id, image: bank.image }] : []),
    ...(bank.datasets ?? []).map(dataset => ({ name: `${bank.id}.${dataset.id}`, image: dataset.image }))]);
  // Photographic billboards go through the lossy lane with exact alpha. Effort 4, not 6: every dev start encodes these;
  // on the atlas they replaced, 6 took 4.7 s and 4 took 0.3 s for 6.7 KB more, and pixelmatch (threshold 0.1) found none
  // of its 1,310,720 pixels different between the two (2026-09-30).
  const images = resolve(projectRoot, OUTPUT.images);
  await mkdir(images, { recursive: true });
  const names = new Set(drawn.map(billboard => `${billboard.name}.webp`));
  // A bank that lost its billboard, or was removed, leaves no image behind.
  for (const stale of (await readdir(images)).filter(name => !names.has(name))) await rm(resolve(images, stale));
  let imageBytes = 0, next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < drawn.length) {
      const billboard = drawn[next++]!;
      const bytes = await encodeLossyWebp(sharp(billboard.image), { alphaQuality: 100, effort: 4 });
      imageBytes += bytes.length;
      await writeIfChanged(resolve(images, `${billboard.name}.webp`), bytes);
    }
  }));
  const metadata = { schema: DATASET_BILLBOARDS_SCHEMA, imagePx: CELL_PX,
    banks: banks.map(bank => ({ id: bank.id, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(bank.framingRadiusUnits === undefined ? {} : { framingRadiusUnits: bank.framingRadiusUnits }),
      ...(bank.view ? { billboard: { radiusUnits: bank.radiusUnits, ...bank.view } } : {}),
      ...(bank.datasets ? { defaultDataset: bank.defaultDataset,
        datasets: bank.datasets.map(dataset => ({ id: dataset.id, radiusUnits: dataset.radiusUnits, ...dataset.view })) } : {}) })) };
  await writeIfChanged(resolve(projectRoot, OUTPUT.metadata), `${JSON.stringify(metadata)}\n`);
  // The atlas an earlier checkout wrote here is no longer read.
  await rm(resolve(projectRoot, 'site/prepared-dataset-billboards.webp'), { force: true });
  return { banks: banks.length, billboards: drawn.length, imageBytes };
}
