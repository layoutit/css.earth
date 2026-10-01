// Entry: node site/build/prepare/prepare-bank-scene.mts [<id>...]. A package whose subject is a bank (a galaxy's image
// layers, a nebula's volume, a cluster's member dots) has no surface to draw, so no body lane bakes it. This writes the
// same prepared scene every body has, with no body in it: the camera, sky and world frame the shared scene preparers give
// its astronomy record, its datasets as the companions its bank already publishes, and its content and text from the
// authored files every package has. The world draws the bank; the scene is where the page stands.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isHostedDescriptor } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';
import { parsePreparedObjectRuntime, requireControls } from '@cssearth/renderer';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, prepareCubicSky } from '@cssearth/bake/presentation';
import { prepareEclipticPresentationFrame, preparePhysicalWorldFrame, prepareSolarSystemScene, transform, transpose } from '@cssearth/bake/objects/scene';
import { refreshPreparedInventory } from '@cssearth/bake/contract';
import type { ObjectContentSource } from '@cssearth/bake/objects/content';
import { prepareObjectContent } from '../content/prepare.ts';
import { parseObjectText, PREPARED_TEXT_SCHEMA } from '../../object-text.mts';

const root = resolve(import.meta.dirname, '../../..');
/** The scene's units: the framing radius is drawn as a sphere of this radius would be, so the shared camera frames it. */
const RADIUS_UNITS = 248, GEOMETRY_SCALE = 1.25, DEFAULT_ZOOM = 1.25;
export const BANK_SCENE_PIN = Object.freeze({ format: 'cssearth-css-object@5', url: 'prepared/object.json' });

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));

export async function prepareBankScene(id: string, projectRoot = root) {
  const directory = resolve(projectRoot, 'src/objects', id), descriptorPath = resolve(directory, 'object.json');
  const descriptor = await json(descriptorPath);
  if (!isRecord(descriptor) || descriptor.id !== id || !isHostedDescriptor(descriptor) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.catalog)
      || !isRecord(descriptor.properties.worldFrame)) throw new TypeError(`src/objects/${id}/object.json: a bank scene needs a bank package with a catalogue entry and a world frame.`);
  const framingRadiusM = descriptor.properties.worldFrame.bodyRadiusM;
  if (typeof framingRadiusM !== 'number' || !(framingRadiusM > 0)) throw new TypeError(`src/objects/${id}/object.json: worldFrame.bodyRadiusM is its framing radius, a positive number of metres.`);
  const solarGeometry = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href) as typeof import('../../../src/platform/solar-geometry.mts');
  const scene = await prepareSolarSystemScene(solarGeometry, { bodyId: id as never, bodyRadiusUnits: RADIUS_UNITS, bodyRadiusKilometers: framingRadiusM / 1000,
    defaultZoom: DEFAULT_ZOOM, geometryScale: GEOMETRY_SCALE, light: 'self',
    starfield: prepareCubicSky({ objectId: id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD }) });
  // The world frame as the world-navigation stage gives every body: the ecliptic presentation frame at its place, with the
  // framing radius where a body's radius would be. The sky rides that frame.
  const ecliptic = prepareEclipticPresentationFrame(solarGeometry, id);
  const bodyToReference = solarGeometry.requireBodyFixedToIcrf(id), distanceM = solarGeometry.requireBodyOrbit(id).heliocentricDistanceAu * solarGeometry.ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const frame = preparePhysicalWorldFrame({ referenceFrame: 'sun-icrf', epochJdTt: solarGeometry.SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM: transform(bodyToReference as never, solarGeometry.requireBodyFixedSunDirection(id) as never).map(component => -component * distanceM) as never,
    bodyToReference: bodyToReference as never, bodyToPresentation: ecliptic.basis.flat() as never,
    orbitUpReference: transform(bodyToReference as never, solarGeometry.requireBodyFixedEclipticNorth(id) as never),
    physicalRadiusM: framingRadiusM, renderedRadiusUnits: RADIUS_UNITS * GEOMETRY_SCALE });
  const registration = transpose(frame.presentationToReference);
  const sky = { ...scene.starfield, sceneRegistration: `matrix3d(${[registration[0], registration[3], registration[6], 0, registration[1], registration[4], registration[7], 0,
    registration[2], registration[5], registration[8], 0, 0, 0, 0, 1].join(',')})`, sceneRegistrationModel: 'icrf-in-authored-presentation-frame', sceneRegistrationEpoch: solarGeometry.SOLAR_GEOMETRY_EPOCH_LABEL };
  const source = await json(resolve(directory, 'source/content/object.json')) as ObjectContentSource;
  const content = prepareObjectContent(source);
  const text = parseObjectText(await json(resolve(directory, 'text.json')), id);
  // Its datasets are the ones its bank publishes: each shows that bank's dataset, as a star's disc dataset shows its volume.
  // A package of catalogue dots has one dataset, the dots themselves, shown by a picture of them as they lie on the sky.
  const presentation = descriptor.type === 'catalogue-point-bank'
    ? { defaultDataset: 'members', controls: [{ id: 'members', label: 'Member galaxies', thumbnailUrl: await memberDotsThumbnail(id, directory, projectRoot) }] }
    : await json(resolve(directory, 'prepared/presentation.json'));
  if (!isRecord(presentation) || typeof presentation.defaultDataset !== 'string' || !Array.isArray(presentation.controls)) throw new TypeError(`src/objects/${id}/prepared/presentation.json: a bank's presentation lists its datasets and names the default.`);
  const published = presentation.controls.filter(isRecord);
  const datasets = { title: content.datasets.title, defaultDataset: presentation.defaultDataset,
    controls: published.map(({ title: _title, summary: _summary, detail: _detail, description: _description, ...control }) =>
      // Each dataset shows the package's bank as its companion, as a star's disc dataset shows its disc.
      ({ ...control, id: String(control.id), volume: { objectId: id, datasetId: String(control.id), surface: String(control.id) } })) };
  for (const control of datasets.controls) if (!text.datasets[control.id]) throw new TypeError(`src/objects/${id}/text.json: dataset ${control.id} has no reader text.`);
  const controls = { datasets, settings: content.settings };
  requireControls(controls);
  const camera = scene.camera;
  const node = (parent: number, className: string, style = '', attributes: Record<string, string> = {}) => ({ parent, tag: 'div', className, style, properties: [], attributes });
  const definition = { schema: 'cssearth-object-runtime@5', camera, sky, sun: null,
    assets: { entries: [], pools: [{ id: 'material', capacity: 8, concurrency: 8, retention: 'selection', reuse: false }], startup: [] },
    tree: { nodes: [node(-1, 'polycss-camera object-render-root'),
      node(0, 'polycss-scene', `transform:${camera.defaultTransform}`, { 'aria-hidden': 'true', 'data-polycss-lighting': 'baked' }),
      node(1, `polycss-mesh ${id}-system`, `transform:${scene.systemTransform}`)],
      properties: [{ name: 'scale', value: '1', custom: false }], camera: 0, scene: 1, stageClasses: [], activationGroups: [], textureBindings: [] },
    variants: datasets.controls.map(control => ({ when: { datasetId: control.id }, required: [], writes: [], materials: [] })),
    materials: [], viewBindings: [{ kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null }],
    animations: [], id, controls, motion: [] };
  parsePreparedObjectRuntime(definition, { parsedJson: true });
  const prepared = resolve(directory, 'prepared');
  await writeFile(resolve(prepared, 'runtime.json'), `${JSON.stringify(definition)}\n`);
  await writeFile(resolve(prepared, 'controls.json'), `${JSON.stringify(controls)}\n`);
  await writeFile(resolve(prepared, 'content.json'), `${JSON.stringify({ schema: 'cssearth-prepared-content@2', objectId: id, title: content.title, facts: content.facts, moreFacts: content.moreFacts,
    charts: [], galleries: [], resources: content.resources, provenance: source.provenance })}\n`);
  await writeFile(resolve(prepared, 'text.json'), `${JSON.stringify({ schema: PREPARED_TEXT_SCHEMA, objectId: id, card: text.card, introduction: text.introduction, datasets: text.datasets })}\n`);
  // The descriptor takes the frame the scene was prepared in and names the scene's transports, as every body's does.
  const properties = { ...descriptor.properties, worldFrame: frame, page: { stylesheets: ['src/renderers/css/styles/body-surfaces.css'], metadata: { url: 'prepared/page.json' } }, scene: BANK_SCENE_PIN,
    catalog: { ...descriptor.properties.catalog, description: text.card.text } };
  await writeFile(descriptorPath, `${JSON.stringify({ ...descriptor, properties }, null, 2)}\n`);
  await refreshPreparedInventory(id, projectRoot);
  // A bank of dots publishes no image of its own; the picture of its dots written here is its one public file.
  if (descriptor.type === 'catalogue-point-bank') {
    const { inventoryPublicAssets } = await import('@cssearth/objects/node');
    await inventoryPublicAssets({ objectId: id, objectDirectory: directory, urls: datasets.controls.map(control => String((control as { thumbnailUrl?: unknown }).thumbnailUrl)),
      publicRoot: resolve(projectRoot, 'public/scenes', id) });
  }
  return { id, datasets: datasets.controls.length, facts: content.facts.length };
}

/** A bank of dots as seen from the Sun: each dot in its own colour on the plane across the line of sight to the bank's
 * middle, north up and east left as the sky is drawn, fitted to the picture. Returns the picture's public address. */
export async function memberDotsThumbnail(id: string, directory: string, projectRoot: string): Promise<string> {
  const { unpackPreparedBinary } = await import('@cssearth/objects/node');
  const { decodeCatalogueBankBinary } = await import('@cssearth/renderer/prepared-data/catalogue-bank-binary.ts');
  const bank = decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(resolve(directory, 'prepared/dots.bin'))), `src/objects/${id}/prepared/dots.bin`);
  const points = bank.points as readonly (readonly number[])[], appearance = bank.appearance as { colorCss: string; palette?: readonly string[] };
  if (!Array.isArray(points) || !points.length) throw new TypeError(`src/objects/${id}/prepared/dots.bin: a bank of dots has points.`);
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
    const colour = (dot.palette === undefined ? appearance.colorCss : appearance.palette?.[dot.palette]) ?? appearance.colorCss;
    const column = Math.round((dot.x / reach + 1) / 2 * (SIZE - 1)), row = Math.round((dot.y / reach + 1) / 2 * (SIZE - 1));
    for (let channel = 0; channel < 3; channel++) pixels[(row * SIZE + column) * 3 + channel] = Number.parseInt(colour.slice(1 + channel * 2, 3 + channel * 2), 16);
  }
  const sharp = (await import('sharp')).default, { mkdir } = await import('node:fs/promises');
  const output = resolve(projectRoot, 'public/scenes', id), filename = `${id}-dataset-members.webp`;
  await mkdir(output, { recursive: true });
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } }).webp({ lossless: true }).toFile(resolve(output, filename));
  return `/scenes/${id}/${filename}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const named = process.argv.slice(2);
  const ids = named.length ? named : (await Promise.all((await readdir(resolve(root, 'src/objects'))).map(async id => {
    const descriptor = await json(resolve(root, 'src/objects', id, 'object.json')).catch(() => null);
    return isHostedDescriptor(descriptor) && isRecord(descriptor) && isRecord(descriptor.properties) && descriptor.properties.catalog !== undefined ? id : null;
  }))).filter((id): id is string => id !== null);
  for (const id of ids) console.log(JSON.stringify(await prepareBankScene(id)));
}
