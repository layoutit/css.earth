import { resolve } from 'node:path';
import { readAuthoredSources } from '../../../sources/index.ts';
import { readJsonSource } from '../../../sources/index.ts';
import { requireFiniteNumber } from '@cssearth/core';
import { validateSourceManifest } from '@cssearth/objects/node';
import { prepareDirectionalSun } from '../../../../presentation/index.ts';
import { parsePagedProfile, parsePagedDatasetBindings, isPagedEllipsoidRecipe } from './profile-source.ts';
import { parseInteriorSource } from '../source-contract.ts';
import { createPagedSurfaceRaster } from '../surface-raster.ts';
import { createAtmospherePreparation } from './atmosphere.ts';
import { preparePagedEllipsoidScene } from './scene.ts';
import { prepareEllipsoidAttitude } from './attitude.ts';
import type { SolarGeometry } from '../../../scene/index.ts';

const json = readJsonSource;

/** Read and check a paged ellipsoid's recipe and sources, and plan its scene. The preparation and each of its parallel
 * asset workers (packages/bake/cli/paged-ellipsoid-asset-worker.mts) build their context here, so every stage reads the same inputs. */
export async function readPagedEllipsoid(solarGeometry: SolarGeometry, objectDirectory: string) {
  const { descriptor, entries, sources } = await readAuthoredSources(objectDirectory);
  const required = (id: string) => { const source = sources.get(id); if (!source) throw new TypeError(`Paged ellipsoid requires ${id}.`); return source.value; };
  const config = parsePagedProfile(required('paged-ellipsoid')), bindingSource = parsePagedDatasetBindings(required('dataset-bindings'));
  if (!isPagedEllipsoidRecipe(config) || config.namespace !== descriptor.id || config.publicBase !== `/scenes/${descriptor.id}/`) throw new TypeError('Paged ellipsoid identity differs.');
  if (config.geometry.BODY_LATITUDE_SEGMENTS !== 16 || config.geometry.BODY_LONGITUDE_SEGMENTS !== 32) throw new TypeError('Unsupported segmented projective globe topology.');
  if (descriptor.recipe.shape.radiusKm !== config.equatorialRadiusKm || !descriptor.recipe.cutaway || !descriptor.recipe.atmosphere) throw new TypeError('Authored physical capabilities differ from their prepared operators.');
  const declared = descriptor.recipe.surfaces.flatMap(surface => surface.datasets.map(dataset => dataset.id));
  if (JSON.stringify(declared) !== JSON.stringify(bindingSource.controls.map(dataset => dataset.id))) throw new TypeError('Authored datasets differ from presentation bindings.');
  const sourceDirectory = resolve(objectDirectory, 'source'), sourceManifest = validateSourceManifest(config.namespace, await json(resolve(sourceDirectory, 'manifest.json')));
  const sun = prepareDirectionalSun();
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun, polarToEquatorial: config.polarRadiusKm / config.equatorialRadiusKm }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  // The scene needs the declared retained pool capacity, not a previously prepared overlay.
  const interiorSource = parseInteriorSource(await json(resolve(sourceDirectory, config.interiorPath)));
  requireFiniteNumber(interiorSource[config.interiorRadiusKey], config.interiorRadiusKey);
  if (interiorSource.tomographyPath && sources.get('mantle-tomography')?.reference.path !== `source/${interiorSource.tomographyPath}`)
    throw new Error('Mantle tomography must bind its authored recipe for reproducible provenance.');
  // The body sits in its ecliptic presentation frame; the surface map the feature labels use says where its longitudes start.
  const features = sources.get('features')?.value as { surfaceMap?: unknown } | undefined;
  const surfaceMap = typeof features?.surfaceMap === 'string' ? await json(resolve(sourceDirectory, features.surfaceMap)) as { mapLeftEdgeLongitudeDeg?: unknown } : null;
  const attitude = prepareEllipsoidAttitude(solarGeometry, descriptor.id, { meshRotationZDegrees: config.geometry.MESH_ROTATION_Z,
    mapLeftEdgeLongitudeDeg: surfaceMap ? requireFiniteNumber(surfaceMap.mapLeftEdgeLongitudeDeg, 'surface map left edge') : 0 });
  // Block pages need every cell's size before a face names its page: one pass measures the cells, the next lays them out.
  const cellSizes = preparePagedEllipsoidScene({ config, interiorSource, atmosphereModel, atmosphere, raster, attitude }).surfaceRasterPlan.cells.map(cell => cell.size);
  const { scene, surfaceRasterPlan } = preparePagedEllipsoidScene({ config, interiorSource, atmosphereModel, atmosphere, raster, attitude, cellSizes });
  return { descriptor, entries, sources, config, bindingSource, sourceDirectory, sourceManifest, sun, atmosphere, atmosphereModel, raster, interiorSource, attitude, scene, surfaceRasterPlan };
}
