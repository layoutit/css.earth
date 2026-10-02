import { IMAGE_MESH_SCHEMA, CATALOGUE_POINTS_BINARY_SCHEMA, DENSITY_VOLUME_FORMAT, OBJECT_RUNTIME_SCHEMA, parsePreparedObjectRuntime, requireControls } from '@cssearth/objects';

// The scene of an authored object with no surface (`recipe.surfaces: []`): a galaxy, a nebula, a cluster of galaxies. It is
// the scene every body has with no body in it: the camera, sky and world frame the shared scene preparers give its
// astronomy record. Its datasets show context banks as their companions; the world draws those, the scene is where the
// page stands. prepare-authored.ts runs it as one of its lanes.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, prepareCubicSky } from '@cssearth/bake/presentation';
import { prepareSolarSystemScene } from '@cssearth/bake/objects/scene';

type SolarGeometry = Parameters<typeof prepareSolarSystemScene>[0];
export interface SurfacelessSource { readonly bodyId: string; readonly bodyRadiusUnits: number; readonly bodyRadiusKilometers: number;
  readonly defaultZoom?: number; readonly geometryScale?: number; readonly maximumZoom?: number }

export async function prepareSurfacelessScene({ source, controls, solarGeometry }: { source: SurfacelessSource; controls: { datasets: { controls: readonly { id: string }[] } | null; settings: unknown }; solarGeometry: SolarGeometry }) {
  const id = source.bodyId;
  const scene = await prepareSolarSystemScene(solarGeometry, { ...source, bodyId: id as never, light: 'self',
    starfield: prepareCubicSky({ objectId: id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD }) } as never);
  // The world-navigation stage gives the scene its world frame and registers the sky in it, as it does for every body.
  const sky = scene.starfield;
  requireControls(controls as never);
  const camera = scene.camera;
  const node = (parent: number, className: string, style = '', attributes: Record<string, string> = {}) => ({ parent, tag: 'div', className, style, properties: [], attributes });
  const definition = { schema: OBJECT_RUNTIME_SCHEMA, camera, sky, sun: null,
    assets: { entries: [], pools: [{ id: 'material', capacity: 8, concurrency: 8, retention: 'selection', reuse: false }], startup: [] },
    tree: { nodes: [node(-1, 'polycss-camera object-render-root'),
      node(0, 'polycss-scene', `transform:${camera.defaultTransform}`, { 'aria-hidden': 'true', 'data-polycss-lighting': 'baked' }),
      node(1, `polycss-mesh ${id}-system`, `transform:${scene.systemTransform}`)],
      properties: [{ name: 'scale', value: '1', custom: false }], camera: 0, scene: 1, stageClasses: [], activationGroups: [], textureBindings: [] },
    // An object none of whose datasets shows a bank (the Milky Way: the world always draws its volume) has the one view.
    variants: controls.datasets?.controls.length ? controls.datasets.controls.map(control => ({ when: { datasetId: control.id }, required: [], writes: [], materials: [] }))
      : [{ when: {}, required: [], writes: [], materials: [] }],
    materials: [], viewBindings: [{ kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null }],
    animations: [], id, controls, motion: [] };
  parsePreparedObjectRuntime(definition, { parsedJson: true });
  return { definition, scene };
}

/** A bank of dots as seen from the Sun: each dot in its own color on the plane across the line of sight to the bank's
 * middle, north up and east left as the sky is drawn, fitted to the picture. Returns the picture's public address. */
export async function dotsPicture(bankDirectory: string, outputPath: string): Promise<void> {
  const { unpackPreparedBinary } = await import('@cssearth/objects/node');
  const { decodeCatalogueBankBinary } = await import('@cssearth/objects');
  const bank = decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(resolve(bankDirectory, 'prepared/dots.bin'))), `${bankDirectory}/prepared/dots.bin`);
  const points = bank.points as readonly (readonly number[])[], appearance = bank.appearance as { colorCss: string; palette?: readonly string[] };
  if (!Array.isArray(points) || !points.length) throw new TypeError(`${bankDirectory}/prepared/dots.bin: a bank of dots has points.`);
  await pointsPicture(points, appearance, outputPath);
}

/** Points as seen from the Sun, each in its color, on the plane across the line of sight to their middle. */
async function pointsPicture(points: readonly (readonly number[])[], appearance: { colorCss: string; palette?: readonly string[] }, outputPath: string): Promise<void> {
  const centre = [0, 1, 2].map(axis => points.reduce((sum, point) => sum + point[axis]!, 0) / points.length);
  const distance = Math.hypot(...centre), sight: number[] = centre.map(value => value / distance);
  // East and north on the sky at the bank's middle, from the ICRF pole.
  const east: number[] = [-sight[1]!, sight[0]!, 0].map(value => value / Math.hypot(sight[0]!, sight[1]!));
  const north: number[] = [sight[1]! * east[2]! - sight[2]! * east[1]!, sight[2]! * east[0]! - sight[0]! * east[2]!, sight[0]! * east[1]! - sight[1]! * east[0]!];
  const along = (offset: readonly number[], direction: readonly number[]) => offset.reduce((sum: number, value: number, axis: number) => sum + value * direction[axis]!, 0);
  const flat = points.map(point => { const offset = point.slice(0, 3).map((value: number, axis: number) => value - centre[axis]!);
    return { x: -along(offset, east), y: -along(offset, north), palette: point[3] }; });
  const SIZE = 160, reach = Math.max(...flat.map(dot => Math.max(Math.abs(dot.x), Math.abs(dot.y)))) * 1.05, pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (const dot of flat) {
    const color = (dot.palette === undefined ? appearance.colorCss : appearance.palette?.[dot.palette]) ?? appearance.colorCss;
    const column = Math.round((dot.x / reach + 1) / 2 * (SIZE - 1)), row = Math.round((dot.y / reach + 1) / 2 * (SIZE - 1));
    for (let channel = 0; channel < 3; channel++) pixels[(row * SIZE + column) * 3 + channel] = Number.parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16);
  }
  const sharp = (await import('sharp')).default, { mkdir } = await import('node:fs/promises');
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } }).webp({ lossless: true }).toFile(outputPath);
}

/** The thumbnail of each dataset that shows a companion bank, written to the object's public directory under the name the
 * dataset authors: a bank of dots is drawn as it lies on the sky; a bank that publishes a picture of its dataset lends it. */
export async function companionThumbnails({ objectDirectory, publicDirectory, content }: { objectDirectory: string; publicDirectory: string; content: unknown }) {
  const controls = ((content as { datasets?: { controls?: unknown } }).datasets?.controls ?? []) as { id: string; thumbnail?: string; volume?: { objectId: string; datasetId: string } }[];
  const { copyFile, mkdir } = await import('node:fs/promises');
  for (const control of controls) {
    if (!control.volume || !control.thumbnail || control.thumbnail.startsWith('/')) continue;
    const bankDirectory = resolve(objectDirectory, '..', control.volume.objectId), output = resolve(publicDirectory, control.thumbnail);
    const bank = JSON.parse(await readFile(resolve(bankDirectory, 'object.json'), 'utf8')) as { prepared?: { format?: string } };
    if (bank.prepared?.format === CATALOGUE_POINTS_BINARY_SCHEMA) { await dotsPicture(bankDirectory, output); continue; }
    // The galaxy's own volume publishes one picture of itself, its backing.
    if (bank.prepared?.format === DENSITY_VOLUME_FORMAT) {
      await mkdir(dirname(output), { recursive: true });
      const sharp = (await import('sharp')).default;
      await sharp(resolve(bankDirectory, 'prepared/backing/backing.webp')).resize(160, 160, { fit: 'cover' }).webp({ quality: 80 }).toFile(output);
      continue;
    }
    // A sphere of sky (the microwave background) publishes a picture of each of its datasets.
    if (bank.prepared?.format === IMAGE_MESH_SCHEMA) {
      const datasets = JSON.parse(await readFile(resolve(bankDirectory, 'prepared/datasets.json'), 'utf8')) as { controls: { id: string; thumbnailUrl: string }[] };
      const picture = datasets.controls.find(candidate => candidate.id === control.volume!.datasetId)?.thumbnailUrl;
      if (!picture) throw new TypeError(`${bankDirectory}/prepared/datasets.json: dataset ${control.volume.datasetId} names no picture.`);
      await mkdir(dirname(output), { recursive: true });
      await copyFile(resolve(bankDirectory, 'prepared', picture), output);
      continue;
    }
    // A catalogue of galaxies is drawn as its dots lie on the sky, like a bank of dots.
    if (bank.prepared?.format === 'cssearth-galaxy-catalog@1') {
      const catalogue = JSON.parse(await readFile(resolve(bankDirectory, 'prepared/catalogue.json'), 'utf8')) as { objects: { positionM: number[] }[] };
      await pointsPicture(catalogue.objects.map(object => object.positionM), { colorCss: '#d8d8d8' }, output);
      continue;
    }
    const presentation = JSON.parse(await readFile(resolve(bankDirectory, 'prepared/presentation.json'), 'utf8')) as { controls: { id: string; thumbnailUrl: string }[] };
    const picture = presentation.controls.find(candidate => candidate.id === control.volume!.datasetId)?.thumbnailUrl;
    const prefix = `/scenes/${control.volume.objectId}/`;
    if (!picture?.startsWith(prefix)) throw new TypeError(`${bankDirectory}/prepared/presentation.json: dataset ${control.volume.datasetId} names no picture under ${prefix}.`);
    await mkdir(dirname(output), { recursive: true });
    // The bank's public files are the checkout's, whatever directory this run stages the object's own into.
    await copyFile(resolve(objectDirectory, '../../../public/scenes', control.volume.objectId, picture.slice(prefix.length)), output);
  }
}
