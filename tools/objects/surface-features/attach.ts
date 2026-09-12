import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AuthoredObjectDescriptor, SourceReference } from '@cssearth/objects';
import { prepareSurfaceFeatures } from './index.js';
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
  const hit = definition.surfaceHit as { target?: number; triangles?: readonly (readonly (readonly number[])[])[] } | undefined;
  const radialTerrain = descriptor.recipe.shape.kind === 'radial-terrain';
  if (hit?.triangles?.length && !radialTerrain) {
    const vertexRadius = Math.max(...hit.triangles.flat().map(point => Math.hypot(point[0]!, point[1]!, point[2]!)));
    if (Math.abs(vertexRadius - meshRadiusUnits) > 0.01 * meshRadiusUnits) throw new TypeError(`Surface feature mesh radius ${meshRadiusUnits} disagrees with the prepared hit mesh (${vertexRadius}).`);
  }
  // Shape-model bodies anchor on their picking mesh: the sampler's body-fixed frame is the tool's 0° edge with the shared axes.
  if (radialTerrain && !(hit?.triangles?.length && typeof hit.target === 'number')) throw new TypeError('Shape-model surface features need the prepared hit mesh.');
  const hitMesh = radialTerrain && hit?.triangles && typeof hit.target === 'number' ? { target: hit.target, triangles: hit.triangles } : undefined;
  const features = await prepareSurfaceFeatures({ objectId: descriptor.id, sourceDirectory, publicDirectory, outputDirectory,
    config: config.value, maxEntries: featuresRecipe.maxEntries, radiusKm: descriptor.recipe.shape.radiusKm, meshRadiusUnits,
    tree: definition.tree as Parameters<typeof prepareSurfaceFeatures>[0]['tree'], ...(hitMesh ? { hitMesh } : {}),
    declaredLensIds: descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id)) });
  return { definition: { ...definition, features: features.plan },
    features: { searchLabel: 'Named features', description: `${features.plan.catalog.count.toLocaleString('en')} IAU names from the Gazetteer of Planetary Nomenclature` } };
}

/** The shell renders retained search rows for named features when the prepared content declares them. */
export async function writeFeatureContent(outputDirectory: string, features: FeatureContent): Promise<void> {
  const contentPath = resolve(outputDirectory, 'content.json');
  const contentDocument = record(JSON.parse(await readFile(contentPath, 'utf8')), 'prepared content');
  await writeFile(contentPath, `${JSON.stringify({ ...contentDocument, features })}\n`);
}
