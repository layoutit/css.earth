import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { verifySourceManifest } from '../../../src/platform/source-manifest.mjs';
import { prepareRuntimeAssetManifest } from '../../../src/platform/runtime-asset-closure.mjs';
import { createPreparedTitle } from '../../../src/platform/prepared-title.mjs';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mjs';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mjs';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mjs';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mjs';
import { prepareBandSurfaceScene } from './band-scene.mjs';
import { prepareSegmentedSurfaceScene } from './segmented-scene.mjs';
import { prepareBandSurfacePresentation, prepareEmissiveSurfacePresentation } from './presentation.mjs';
import { prepareObservationLenses } from './raster.mjs';
import { prepareSynopticEmission } from './synoptic-emission.mjs';
import { readPhysicalFacts } from './physical.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value)}\n`);

export function isStaticSurfaceRecipe(value) {
  return value?.schema === 'cssearth-static-surface-geometry@1';
}

/** Bind authored observer framing while preserving the prepared physical surface. */
export function contextualizeStaticSurfaceScene(scene, context, id) {
  if (!context) return scene;
  if (context.schema !== 'cssearth-world-context@1' || context.focus.id !== id) throw new TypeError('Static surface world context identity differs.');
  return { ...scene, camera: { ...scene.camera, ...context.camera.presentation }, worldFrame: context.frame };
}

/** Source-pinned geometry, observations and optional emissive/curvature layers. */
export async function prepareStaticSurfaceObject({ objectDirectory, publicDirectory, outputDirectory, write = false }) {
  const descriptorPath = resolve(objectDirectory, 'object.json'), rawDescriptor = await readJson(descriptorPath);
  const descriptor = parseAuthoredObjectDescriptor(rawDescriptor), sources = new Map();
  for (const reference of descriptor.recipe.sources) {
    const path = resolve(objectDirectory, reference.path), offset = relative(objectDirectory, path);
    if (offset.startsWith('..')) throw new TypeError('Source escapes the object package.');
    const bytes = await readFile(path);
    if (hash(bytes) !== reference.sha256) throw new TypeError(`Source ${reference.path} does not match its descriptor digest.`);
    sources.set(reference.id, { reference, path, value: JSON.parse(bytes.toString('utf8')) });
  }
  const required = name => { const value = sources.get(name); if (!value) throw new TypeError(`Static surface recipe requires ${name}.`); return value.value; };
  const geometry = required('geometry'), raster = required('raster'), celestial = required('celestial'), contentSource = required('content');
  if (!isStaticSurfaceRecipe(geometry) || geometry.namespace !== descriptor.id || celestial.id !== descriptor.id || contentSource.id !== descriptor.id) throw new TypeError('Static surface recipe identity differs.');
  if (Boolean(descriptor.recipe.emission) !== (raster.kind === 'synoptic-emission')) throw new TypeError('Authored emission and raster capability disagree.');
  const declaredLenses = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declaredLenses) !== JSON.stringify(contentSource.lenses.controls.map(lens => lens.id))) throw new TypeError('Authored lens declarations differ from their source.');
  const sourceDirectory = resolve(objectDirectory, 'source');
  const sourceManifest = await readJson(resolve(sourceDirectory, 'manifest.json'));
  await verifySourceManifest({ manifest: sourceManifest, planetName: contentSource.displayName, sourceRoot: sourceDirectory });
  const physical = await readPhysicalFacts({ sourceDirectory, config: required('physical') });
  if (physical.meanRadiusKm !== descriptor.recipe.shape.radiusKm) throw new TypeError('Authored radius differs from its physical source.');
  for (const field of ['meanRadiusKm', 'meanDensityGPerCm3', 'orbitalPeriodDays', 'orbitalPeriodYears', 'displayAxisTiltDegrees']) {
    if (Object.hasOwn(geometry.metadata.body, field) && physical[field] !== geometry.metadata.body[field]) throw new TypeError(`Scene physical parameter differs from its source: ${field}`);
  }
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const contextSource = sources.get('world-context');
  let worldContext;
  if (contextSource) {
    const { prepareSpatialContext } = await import('../dist/prepare-spatial-context.js');
    const outputPath = resolve(outputDirectory, 'world-context.json');
    await prepareSpatialContext({ sourcePath: contextSource.path, outputPath,
      solarGeometryPath: resolve(objectDirectory, '../../platform/solar-geometry.mjs'),
      objectsDirectory: resolve(objectDirectory, '..') });
    worldContext = await readJson(outputPath);
  }
  const ensureDirectories = () => mkdir(publicDirectory, { recursive: true });
  const band = geometry.kind === 'disc-poles' ? prepareBandSurfaceScene(geometry) : null;
  if (raster.kind === 'observation-lenses') await prepareObservationLenses({ sourceDirectory, publicDirectory, config: raster, geometry, surfaceRasterCells: band?.surfaceRasterCells });
  else if (raster.kind === 'synoptic-emission') await prepareSynopticEmission({ sourceDirectory, publicDirectory, config: raster });
  else throw new TypeError('Unsupported static observation recipe.');
  const sky = await preparePlanetCubicSky({ objectId: descriptor.id, sourceRoot: sourceDirectory, publicRoot: publicDirectory, ensureDirectories, validateSourceGroup: async () => undefined, includeSun: celestial.includeSun, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD, ...(celestial.sourceSchema ? { sourceSchema: celestial.sourceSchema } : {}), writeModule: false });
  const sun = celestial.directionalSun ? await preparePlanetDirectionalSun({ objectId: descriptor.id, publicRoot: publicDirectory, ensureDirectories, ...celestial.directionalSun, writeModule: false }) : null;
  const scene = contextualizeStaticSurfaceScene(band?.scene ?? prepareSegmentedSurfaceScene(geometry, sky), worldContext, descriptor.id);
  const titleReference = sources.get('title');
  const title = createPreparedTitle(required('title'), { inputSha256: titleReference.reference.sha256, generator: 'tools/objects/static-surface/index.mjs' });
  const { panel, controls, lenses, resources } = contentSource;
  const content = { schema: 'cssearth-prepared-content@1', objectId: descriptor.id, title, introduction: panel.introduction, facts: panel.facts, moreFacts: panel.moreFacts, charts: [], galleries: [], resources, provenance: contentSource.provenance };
  const presentation = geometry.kind === 'disc-poles'
    ? await prepareBandSurfacePresentation({ namespace: descriptor.id, plan: scene, lenses, sky, sun })
    : await prepareEmissiveSurfacePresentation({ namespace: descriptor.id, plan: scene, lenses });
  requirePreparedPresentation(presentation, { controls });
  const definition = { ...presentation, schema: 'cssearth-object-runtime@4', id: descriptor.id, controls };
  const values = { scene, lenses, sky, sun, controls, content, title, panel, runtime: definition, ...(band?.surfaceRasterCells.length ? { 'surface-raster-plan': band.surfaceRasterCells } : {}) };
  for (const [name, value] of Object.entries(values)) await writeJson(resolve(outputDirectory, `${name}.json`), value);
  const urls = collectSceneUrls(descriptor.id, values);
  const manifest = await prepareRuntimeAssetManifest({ planetId: descriptor.id, urls, publicRoot: publicDirectory, manifestPath: pathToFileURL(resolve(outputDirectory, 'runtime-assets.json')) });
  const payload = JSON.stringify({ schema: 'cssearth-prepared-object@1', id: descriptor.id, type: descriptor.type, format: 'cssearth-css-object@4', data: definition });
  await writeFile(resolve(outputDirectory, 'object.json'), payload);
  if (write) {
    await writeFile(descriptorPath, `${JSON.stringify({ ...rawDescriptor,
      properties: { ...rawDescriptor.properties, ...(scene.worldFrame ? { worldFrame: scene.worldFrame } : {}) },
      prepared: { format: 'cssearth-css-object@4', url: 'prepared/object.json', sha256: hash(payload) } }, null, 2)}\n`);
    await writeFile(resolve(objectDirectory, 'runtime-assets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await writeJson(resolve(outputDirectory, 'authored-preparation.json'), { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: [...sources.values()].map(value => value.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true } });
  return { descriptor, sources, raster, celestial: { sky, sun }, scene, definition };
}

// URL inventory comes from prepared consumers, including their authored CSS.
function collectSceneUrls(id, values) {
  const prefix = `/scenes/${id}/`, urls = new Set();
  const visit = value => {
    if (typeof value === 'string') {
      if (value.startsWith(prefix) && !/[\s;()"']/.test(value)) urls.add(value);
      for (const match of value.matchAll(/url\(\s*["']?(\/scenes\/[^\s)"']+)["']?\s*\)/gu)) if (match[1].startsWith(prefix)) urls.add(match[1]);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(values); return [...urls].sort();
}
