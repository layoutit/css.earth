// `pnpm prepare:lens-billboards`: what the universe knows about every volume lens bank before fetching it.
// Each bank gets its context visibility (whether it fades with the galaxy) and, when its default lens has
// prepared impostors, the one impostor view that faces the Sun, packed with the others into one atlas image.
// From the Solar System and the nearby stars a nebula is a few pixels to a few dozen: the atlas draws it there,
// and its megabytes of lenses are fetched only once it is large on screen. Inputs are the restored prepared
// lens payloads; the output records each payload's pinned sha256 so a stale atlas cannot pass for a fresh one.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { presentPhysicalPoseInVolume } from '../packages/engine/dist/index.js';
import { isRecord, requireArray, requireRecord, requireString } from './source-values.mts';

const root = resolve(import.meta.dirname, '..');
const OUTPUT = { metadata: 'site/prepared-lens-billboards.json', atlas: 'site/prepared-lens-billboards.webp' };
/** Prepared impostor views are 256 px squares; cells keep them at their prepared size. */
const CELL_PX = 256;

type Vector = [number, number, number];
const vector = (value: unknown, label: string): Vector => {
  const values = requireArray(value, label);
  if (values.length !== 3 || !values.every(item => typeof item === 'number' && Number.isFinite(item))) throw new TypeError(`${label} must be three finite numbers.`);
  return values as Vector;
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function writeIfChanged(path: string, bytes: Uint8Array | string): Promise<void> {
  const next = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
  try { if (Buffer.compare(await readFile(path), next) === 0) return; } catch (error) { if (!isRecord(error) || error.code !== 'ENOENT') throw error; }
  await writeFile(path, next);
}

export async function prepareLensBillboards(projectRoot = root) {
  const objects = resolve(projectRoot, 'src/objects');
  const banks: { id: string; payloadSha256: string; contextVisibility: 'galactic' | 'independent'; attached: boolean;
    view?: { back: Vector; right: Vector; down: Vector }; radiusUnits?: number; image?: Buffer }[] = [];
  for (const id of (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    let descriptor: Record<string, unknown>;
    try { descriptor = requireRecord(JSON.parse(await readFile(resolve(objects, id, 'object.json'), 'utf8'))); }
    catch (error) { if (isRecord(error) && error.code === 'ENOENT') continue; throw error; }
    if (descriptor.type !== 'volume-lens-bank') continue;
    const pin = requireRecord(descriptor.prepared, `${id} prepared pin`);
    const payloadPath = resolve(objects, id, requireString(pin.url, `${id} prepared url`));
    const bytes = await readFile(payloadPath);
    if (sha256(bytes) !== pin.sha256) throw new TypeError(`${id}: prepared lenses differ from their descriptor pin; run pnpm setup:prepared.`);
    const data = requireRecord(requireRecord(JSON.parse(bytes.toString('utf8'))).data, `${id} lenses`);
    const contextVisibility = data.contextVisibility ?? 'galactic';
    if (contextVisibility !== 'galactic' && contextVisibility !== 'independent') throw new TypeError(`${id}: unsupported context visibility.`);
    const lens = requireArray(data.lenses, `${id} lenses`).map(value => requireRecord(value)).find(value => value.id === data.defaultLens);
    if (!lens) throw new TypeError(`${id}: default lens is missing.`);
    const volume = requireRecord(lens.volume, `${id} default lens volume`);
    if (JSON.stringify(volume.frame) !== JSON.stringify(requireRecord(descriptor.properties).frame)) {
      throw new TypeError(`${id}: default lens frame differs from the descriptor frame.`);
    }
    // A cloud that accompanies a body stays dark until that body's dataset asks for it.
    const bank = { id, payloadSha256: requireString(pin.sha256, `${id} sha256`), contextVisibility, attached: data.attachedTo !== undefined } as (typeof banks)[number];
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
  const atlas = await sharp({ create: { width: columns * CELL_PX, height: rows * CELL_PX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(drawn.map((bank, index) => ({ input: bank.image!, left: (index % columns) * CELL_PX, top: Math.floor(index / columns) * CELL_PX })))
    .webp({ lossless: true, effort: 6 }).toBuffer();
  const metadata = { schema: 'cssearth-lens-billboards@1', atlas: { columns, rows, cellPx: CELL_PX, sha256: sha256(atlas) },
    banks: banks.map(bank => ({ id: bank.id, payloadSha256: bank.payloadSha256, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(bank.view ? { billboard: { cell: drawn.indexOf(bank), radiusUnits: bank.radiusUnits, ...bank.view } } : {}) })) };
  await writeIfChanged(resolve(projectRoot, OUTPUT.atlas), atlas);
  await writeIfChanged(resolve(projectRoot, OUTPUT.metadata), `${JSON.stringify(metadata)}\n`);
  return { banks: banks.length, billboards: drawn.length, atlasBytes: atlas.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await prepareLensBillboards());
