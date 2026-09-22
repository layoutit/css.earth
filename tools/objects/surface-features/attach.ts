import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AuthoredObjectDescriptor, SourceReference } from '@cssearth/objects';
import { parseSurfaceAxes, parseSurfaceFeaturesConfig, prepareSurfaceFeatures } from './index.js';
import type { SurfaceFeaturePreparationContext, SurfaceFeaturesConfig } from './index.js';
import { ellipsoidSurfaceCast, parseEllipsoidSemiAxes, renderedEllipsoidSampler } from './ellipsoid.js';
import type { SurfaceSampler } from './ellipsoid.js';
import type { GeographicScene } from '../paged-ellipsoid/geographic/contracts.mts';
import { authoredPresentationBasis } from '../world-navigation-sources.js';

export interface FeatureContent { readonly searchLabel: string; readonly description: string; }
type Verified = { readonly reference: SourceReference; readonly path: string; readonly value: unknown };
function record(value: unknown, at: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Record<string, unknown>; }

/** Prepare the optional named-feature catalogue for any lane whose definition carries the shared node tree.
 * The mesh radius in raw units comes from the authored navigation source (source radius times tile pixels),
 * the same product every lane's world navigation reports as its rendered radius before the scene scale. */
export async function attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition }: {
  descriptor: AuthoredObjectDescriptor; sources: ReadonlyMap<string, Verified>; sourceDirectory: string; publicDirectory: string; outputDirectory: string; definition: Record<string, unknown>;
}): Promise<{ definition: Record<string, unknown>; features: FeatureContent | null }> {
  const featuresRecipe = descriptor.recipe.features;
  if (!featuresRecipe) return { definition, features: null };
  const config = sources.get(featuresRecipe.source);
  if (!config) throw new TypeError(`Authored recipe requires ${featuresRecipe.source}.`);
  // The same lane-aware reading the world navigation uses for its rendered radius: source radius times tile pixels.
  const parsed = new Map([...sources].map(([id, source]) => [id, record(source.value, `${id} source`)]));
  const authored = authoredPresentationBasis(parsed, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const meshRadiusUnits = authored.sourceRadiusUnits * authored.tilePixels;
  if (!(meshRadiusUnits > 0)) throw new TypeError('Surface features need a positive mesh radius from the authored lane.');
  const hit = definition.surfaceHit as { target?: number; triangles?: readonly (readonly (readonly number[])[])[]; lensRanges?: readonly { lensId: string; start: number; count: number }[] } | undefined;
  const radialTerrain = descriptor.recipe.shape.kind === 'radial-terrain';
  if (hit?.triangles?.length && !radialTerrain) {
    const vertexRadius = Math.max(...hit.triangles.flat().map(point => Math.hypot(point[0]!, point[1]!, point[2]!)));
    if (Math.abs(vertexRadius - meshRadiusUnits) > 0.01 * meshRadiusUnits) throw new TypeError(`Surface feature mesh radius ${meshRadiusUnits} disagrees with the prepared hit mesh (${vertexRadius}).`);
  }
  // Shape-model bodies anchor on their picking mesh: the sampler's body-fixed frame is the tool's 0° edge with the shared axes.
  if (radialTerrain && !(hit?.triangles?.length && typeof hit.target === 'number')) throw new TypeError('Shape-model surface features need the prepared hit mesh.');
  const featureConfig = parseSurfaceFeaturesConfig(config.value);
  const ranges = featureConfig.landmarks ? hit?.lensRanges?.filter(range => featureConfig.lensIds.includes(range.lensId)) ?? [] : [];
  if (featureConfig.landmarks && hit?.lensRanges?.length && (ranges.length !== 1 || featureConfig.lensIds.some(id => id !== ranges[0]!.lensId))) throw new TypeError('Features on alternative shapes must select one matching lens range.');
  const range = ranges[0];
  if (range && (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.count) || range.start < 0 || range.count < 1 || range.start + range.count > (hit?.triangles?.length ?? 0))) throw new TypeError('Invalid feature mesh range.');
  const hitMesh = radialTerrain && hit?.triangles && typeof hit.target === 'number' ? { target: hit.target, triangles: range ? hit.triangles.slice(range.start, range.start + range.count) : hit.triangles } : undefined;
  // The paged ellipsoid lane renders an oblate flat-leaf globe whose equatorial radius is the mesh radius: geodetic
  // catalogue positions anchor where its leaf frames draw them, checked against the authored reference ellipsoid.
  const paged = parsed.get('paged-ellipsoid');
  const surface = paged && descriptor.recipe.shape.kind === 'ellipsoid'
    ? await pagedEllipsoidSurface({ descriptor, paged, recipe: parseSurfaceFeaturesConfig(config.value), sourceDirectory, outputDirectory, meshRadiusUnits }) : undefined;
  if (hitMesh && surface) throw new TypeError('Surface features anchor on one surface model: a hit mesh or an ellipsoid.');
  const context: SurfaceFeaturePreparationContext & { readonly surface?: ReturnType<typeof ellipsoidSurfaceCast> } = { objectId: descriptor.id, sourceDirectory, publicDirectory, outputDirectory,
    config: config.value, maxEntries: featuresRecipe.maxEntries, radiusKm: descriptor.recipe.shape.radiusKm, meshRadiusUnits,
    tree: definition.tree as Parameters<typeof prepareSurfaceFeatures>[0]['tree'], ...(hitMesh ? { hitMesh } : {}), ...(surface ? { surface: surface.cast } : {}),
    ...(descriptor.recipe.shape.kind === 'sphere' ? { referenceSphere: true as const } : {}),
    declaredLensIds: descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id)) };
  const features = await prepareSurfaceFeatures(context);
  return { definition: { ...definition, features: features.plan },
    features: { searchLabel: 'Named features', description: featureConfig.naturalEarth
      ? `${features.catalog.features.length.toLocaleString('en')} names from Natural Earth${features.catalog.landmarks ? ' and Wikidata landmarks' : ''}`
      : features.catalog.landmarks || (features.catalog.sites && !parseSurfaceFeaturesConfig(config.value).archive)
      ? `${features.catalog.features.length.toLocaleString('en')} surface places from mission maps and cited studies`
      : `${features.catalog.features.length.toLocaleString('en')} IAU names from the Gazetteer of Planetary Nomenclature` } };
}

/** The paged lane's own geodetic mapping (the one its city destinations use) becomes the feature sampler. The lane
 * writes `scene.json` before the presentation, so its leaf frames are read from the output directory. */
export async function pagedEllipsoidSurface({ descriptor, paged, recipe, sourceDirectory, outputDirectory, meshRadiusUnits }: {
  descriptor: AuthoredObjectDescriptor; paged: Record<string, unknown>; recipe: Pick<SurfaceFeaturesConfig, 'surfaceMap'>;
  sourceDirectory: string; outputDirectory: string; meshRadiusUnits: number;
}): Promise<{ sampler: SurfaceSampler; cast: ReturnType<typeof ellipsoidSurfaceCast> }> {
  const shape = descriptor.recipe.shape;
  if (shape.polarRadiusKm === undefined || shape.secondaryRadiusKm !== undefined) throw new TypeError('Paged ellipsoid surface features need an oblate authored shape.');
  if (paged.equatorialRadiusKm !== shape.radiusKm || paged.polarRadiusKm !== shape.polarRadiusKm) throw new TypeError('Authored ellipsoid radii differ from the paged lane profile.');
  const semiAxes = parseEllipsoidSemiAxes({ equatorial: meshRadiusUnits, polar: meshRadiusUnits * shape.polarRadiusKm / shape.radiusKm });
  const axes = parseSurfaceAxes(JSON.parse(await readFile(resolve(sourceDirectory, recipe.surfaceMap), 'utf8')));
  const scene = geographicScene(JSON.parse(await readFile(resolve(outputDirectory, 'scene.json'), 'utf8')));
  const { prepareLocationPoint } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/paged-ellipsoid/geographic/prepare-location.mts')).href) as typeof import('../paged-ellipsoid/geographic/prepare-location.mts');
  const sampler = renderedEllipsoidSampler(axes, axes.mapLeftEdgeLongitudeDeg, semiAxes, (longitudeDeg, latitudeDeg) => {
    // The lane maps signed longitudes; the catalogue keeps positive-east 0–360°.
    const point = prepareLocationPoint(scene, longitudeDeg > 180 ? longitudeDeg - 360 : longitudeDeg, latitudeDeg);
    if (point.length !== 3) throw new TypeError('Paged ellipsoid location is not a mesh point.');
    return [point[0]!, point[1]!, point[2]!];
  });
  return { sampler, cast: ellipsoidSurfaceCast(sampler, axes, axes.mapLeftEdgeLongitudeDeg) };
}

/** The prepared scene facts the lane's location mapping reads: latitude bands of leaves with their frames. */
function geographicScene(value: unknown): GeographicScene {
  const scene = record(value, 'prepared paged scene'), body = record(scene.body, 'prepared paged scene body');
  if (!Array.isArray(body.bands) || !body.bands.length) throw new TypeError('Prepared paged scene has no latitude bands.');
  for (const band of body.bands) {
    const entry = record(band, 'prepared paged scene band');
    if (!Number.isInteger(entry.latitudeIndex) || !Array.isArray(entry.leaves) || !entry.leaves.length) throw new TypeError('Prepared paged scene band is incomplete.');
    for (const leaf of entry.leaves) {
      const item = record(leaf, 'prepared paged scene leaf');
      if (typeof item.style !== 'string' || typeof item.leafWidth !== 'number' || (item.geographicFrameMatrix !== undefined && typeof item.geographicFrameMatrix !== 'string')) throw new TypeError('Prepared paged scene leaf lacks its frame.');
    }
  }
  return { ...scene, body: { bands: body.bands as GeographicScene['body']['bands'] } };
}

/** The shell renders retained search rows for named features when the prepared content declares them. */
export async function writeFeatureContent(outputDirectory: string, features: FeatureContent): Promise<void> {
  const contentPath = resolve(outputDirectory, 'content.json');
  const contentDocument = record(JSON.parse(await readFile(contentPath, 'utf8')), 'prepared content');
  await writeFile(contentPath, `${JSON.stringify({ ...contentDocument, features })}\n`);
}
