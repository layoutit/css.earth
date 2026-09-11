import { attachSurfaceFeatures } from '../dist/surface-features/attach.js';
import { isRecord, readJsonSource, requireRecord } from '../../source-values.mts';
import type { CameraPlan } from '../../../src/renderers/css/navigation/types.ts';
import { parsePreparedWorldContext } from '../../../src/renderers/css/dist/index.js';
import type { PreparedWorldContext } from '../../../src/renderers/css/dist/index.js';
import { validatePreparedCubicSky } from '../../../src/platform/cubic-sky-contract.mts';
import { validateDirectionalSunPlan } from '../../../src/platform/directional-sun-contract.mts';
import { parseSurfaceGeometry, parseSurfaceRaster, parseCelestialRecipe, parsePhysicalRecipe, parseSurfaceContent, parseTitleRecipe, parseBandLenses, parseEmissiveLenses } from './source-contract.mts';
import { verifyFactsheetSources } from '../../factsheet-sources.mts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { verifySourceManifest, validateSourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareRuntimeAssetManifest } from '../../../src/platform/runtime-asset-closure.mts';
import { createPreparedTitle } from '../../../src/platform/prepared-title.mts';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { prepareBandSurfaceScene } from './band-scene.mts';
import { prepareSegmentedSurfaceScene } from './segmented-scene.mts';
import { prepareBandSurfacePresentation, prepareEmissiveSurfacePresentation } from './presentation.mts';
import { prepareObservationLenses } from './raster.mts';
import { prepareSynopticEmission } from './synoptic-emission.mts';
import { readPhysicalFacts } from './physical.mts';

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const readJson = readJsonSource;
const writeJson = (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value)}\n`);

export function isStaticSurfaceRecipe(value: unknown) {
  return isRecord(value) && value.schema === 'cssearth-static-surface-geometry@1';
}

/** Bind authored observer framing while preserving the prepared physical surface. */
export function contextualizeStaticSurfaceScene<T extends {camera: CameraPlan}>(scene: T, context: unknown, id: string): T & {worldFrame?: PreparedWorldContext['frame']} {
  if (!context) return scene;
  const checked = parsePreparedWorldContext(context);
  if (checked.schema !== 'cssearth-world-context@1' || checked.focus.id !== id) throw new TypeError('Static surface world context identity differs.');
  return { ...scene, camera: { ...scene.camera, ...checked.camera.presentation }, worldFrame: checked.frame };
}

/** Source-pinned geometry, observations and optional emissive/curvature layers. */
export async function prepareStaticSurfaceObject({ objectDirectory, publicDirectory, outputDirectory, write = false }: {objectDirectory: string; publicDirectory: string; outputDirectory: string; write?: boolean}) {
  const descriptorPath = resolve(objectDirectory, 'object.json'), rawDescriptor = requireRecord(await readJson(descriptorPath));
  const descriptor = parseAuthoredObjectDescriptor(rawDescriptor), sources = new Map<string, {reference: ReturnType<typeof parseAuthoredObjectDescriptor>['recipe']['sources'][number]; path: string; value: unknown}>();
  for (const reference of descriptor.recipe.sources) {
    const path = resolve(objectDirectory, reference.path), offset = relative(objectDirectory, path);
    if (offset.startsWith('..')) throw new TypeError('Source escapes the object package.');
    const bytes = await readFile(path);
    if (hash(bytes) !== reference.sha256) throw new TypeError(`Source ${reference.path} does not match its descriptor digest.`);
    sources.set(reference.id, { reference, path, value: JSON.parse(bytes.toString('utf8')) });
  }
  const required = (name: string) => { const value = sources.get(name); if (!value) throw new TypeError(`Static surface recipe requires ${name}.`); return value.value; };
  const geometry = parseSurfaceGeometry(required('geometry')), raster = parseSurfaceRaster(required('raster')), celestial = parseCelestialRecipe(required('celestial')), contentSource = parseSurfaceContent(required('content'));
  if (!isStaticSurfaceRecipe(geometry) || geometry.namespace !== descriptor.id || celestial.id !== descriptor.id || contentSource.id !== descriptor.id) throw new TypeError('Static surface recipe identity differs.');
  if (Boolean(descriptor.recipe.emission) !== (raster.kind === 'synoptic-emission')) throw new TypeError('Authored emission and raster capability disagree.');
  const declaredLenses = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declaredLenses) !== JSON.stringify(contentSource.lenses.controls.map(lens => lens.id))) throw new TypeError('Authored lens declarations differ from their source.');
  const sourceDirectory = resolve(objectDirectory, 'source');
  const sourceManifest = validateSourceManifest(descriptor.id, await readJson(resolve(sourceDirectory, 'manifest.json')));
  const factsheet = await verifyFactsheetSources(contentSource.panel, { objectDirectory });
  await verifySourceManifest({ manifest: sourceManifest, planetName: contentSource.displayName, sourceRoot: sourceDirectory });
  const physical = await readPhysicalFacts({ sourceDirectory, config: parsePhysicalRecipe(required('physical')) });
  if (physical.meanRadiusKm !== descriptor.recipe.shape.radiusKm) throw new TypeError('Authored radius differs from its physical source.');
  for (const field of ['meanRadiusKm', 'meanDensityGPerCm3', 'orbitalPeriodDays', 'orbitalPeriodYears', 'displayAxisTiltDegrees']) {
    if (Object.hasOwn(geometry.metadata.body, field) && physical[field] !== geometry.metadata.body[field]) throw new TypeError(`Scene physical parameter differs from its source: ${field}`);
  }
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const contextSource = sources.get('world-context');
  let worldContext: unknown;
  if (contextSource) {
    const { prepareSpatialContext } = await import('../dist/prepare-spatial-context.js');
    const outputPath = resolve(outputDirectory, 'world-context.json');
    await prepareSpatialContext({ sourcePath: contextSource.path, outputPath,
      solarGeometryPath: resolve(objectDirectory, '../../platform/solar-geometry.mts'),
      objectsDirectory: resolve(objectDirectory, '..') });
    worldContext = await readJson(outputPath);
  }
  const ensureDirectories = () => mkdir(publicDirectory, { recursive: true });
  const band = geometry.kind === 'disc-poles' ? prepareBandSurfaceScene(geometry) : null;
  if (raster.kind === 'observation-lenses') await prepareObservationLenses({ sourceDirectory, publicDirectory, config: raster, geometry: geometry.kind === 'disc-poles' ? geometry : undefined, surfaceRasterCells: band?.surfaceRasterCells });
  else if (raster.kind === 'synoptic-emission') await prepareSynopticEmission({ sourceDirectory, publicDirectory, config: raster });
  else throw new TypeError('Unsupported static observation recipe.');
  const sky = validatePreparedCubicSky(await preparePlanetCubicSky({ objectId: descriptor.id, sourceRoot: sourceDirectory, publicRoot: publicDirectory, ensureDirectories, validateSourceGroup: async () => undefined, includeSun: celestial.includeSun, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD, ...(celestial.sourceSchema ? { sourceSchema: celestial.sourceSchema } : {}), writeModule: false }), {requireSun: celestial.includeSun});
  const sun = celestial.directionalSun ? validateDirectionalSunPlan(await preparePlanetDirectionalSun({ objectId: descriptor.id, publicRoot: publicDirectory, ensureDirectories, ...celestial.directionalSun, writeModule: false })) : null;

  const titleReference = sources.get('title');
  if (!titleReference) throw new TypeError('Static surface recipe requires title.');
  const title = createPreparedTitle(parseTitleRecipe(required('title')), { inputSha256: titleReference.reference.sha256, generator: 'tools/objects/static-surface/index.mts' });
  const { controls, lenses, resources } = contentSource;
  const panel = { ...contentSource.panel, ...factsheet };
  const content = { schema: 'cssearth-prepared-content@1', objectId: descriptor.id, title, introduction: panel.introduction, facts: panel.facts, moreFacts: panel.moreFacts, charts: [], galleries: [], resources, provenance: contentSource.provenance };
  const preparePresentation = async () => {
    if (geometry.kind === 'disc-poles') {
      if (!band) throw new TypeError('Band surface geometry is missing.');
      const scene = contextualizeStaticSurfaceScene(band.scene, worldContext, descriptor.id);
      return {scene, presentation: await prepareBandSurfacePresentation({namespace: descriptor.id, plan: scene, lenses: parseBandLenses(lenses), sky, sun})};
    }
    const scene = contextualizeStaticSurfaceScene(prepareSegmentedSurfaceScene(geometry, sky), worldContext, descriptor.id);
    return {scene, presentation: await prepareEmissiveSurfacePresentation({namespace: descriptor.id, plan: scene, lenses: parseEmissiveLenses(lenses)})};
  };
  const {scene, presentation} = await preparePresentation();
  requirePreparedPresentation(presentation, { controls });
  const attached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition: { ...presentation, schema: 'cssearth-object-runtime@4', id: descriptor.id, controls } });
  const definition = attached.definition as typeof presentation & { schema: string; id: string; controls: typeof controls };
  const contentDocument = attached.features ? { ...content, features: attached.features } : content;
  const values = { scene, lenses, sky, sun, controls, content: contentDocument, title, panel, runtime: definition, ...(band?.surfaceRasterCells.length ? { 'surface-raster-plan': band.surfaceRasterCells } : {}) };
  for (const [name, value] of Object.entries(values)) await writeJson(resolve(outputDirectory, `${name}.json`), value);
  const urls = collectSceneUrls(descriptor.id, values);
  const manifest = await prepareRuntimeAssetManifest({ planetId: descriptor.id, urls, publicRoot: publicDirectory, manifestPath: pathToFileURL(resolve(outputDirectory, 'runtime-assets.json')) });
  const payload = JSON.stringify({ schema: 'cssearth-prepared-object@1', id: descriptor.id, type: descriptor.type, format: 'cssearth-css-object@4', data: definition });
  await writeFile(resolve(outputDirectory, 'object.json'), payload);
  if (write) {
    await writeFile(descriptorPath, `${JSON.stringify({ ...rawDescriptor,
      properties: { ...requireRecord(rawDescriptor.properties), ...(scene.worldFrame ? { worldFrame: scene.worldFrame } : {}) },
      prepared: { format: 'cssearth-css-object@4', url: 'prepared/object.json', sha256: hash(payload) } }, null, 2)}\n`);
    await writeFile(resolve(objectDirectory, 'runtime-assets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await writeJson(resolve(outputDirectory, 'authored-preparation.json'), { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: [...sources.values()].map(value => value.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true } });
  return { descriptor, sources, raster, celestial: { sky, sun }, scene, definition };
}

// URL inventory comes from prepared consumers, including their authored CSS.
function collectSceneUrls(id: string, values: unknown) {
  const prefix = `/scenes/${id}/`, urls = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.startsWith(prefix) && !/[\s;()"']/.test(value)) urls.add(value);
      for (const match of value.matchAll(/url\(\s*["']?(\/scenes\/[^\s)"']+)["']?\s*\)/gu)) if (match[1].startsWith(prefix)) urls.add(match[1]);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(values); return [...urls].sort();
}
