import { resolve } from 'node:path';
import { readAuthoredSources } from '../authored-sources.ts';
import { readJsonSource } from '../../sources/source-values.mts';
import { requireFiniteNumber } from '@cssearth/core';
import { validateSourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { parsePagedProfile, parsePagedLensBindings, isPagedEllipsoidRecipe } from './profile-source.mts';
import { parseInteriorSource } from './source-contract.mts';
import { createAtmospherePreparation } from './atmosphere.mts';
import { createPagedSurfaceRaster } from './surface-raster.mts';
import { preparePagedEllipsoidScene } from './scene.mts';
import { prepareEllipsoidAttitude } from './attitude.mts';

const json = readJsonSource;

/** Read and check a paged ellipsoid's recipe and sources, and plan its scene. The preparation and each of its parallel
 * asset workers (parallel-assets.mts) build their context here, so every stage reads the same inputs. */
export async function readPagedEllipsoid(objectDirectory: string) {
  const { descriptor, entries, sources } = await readAuthoredSources(objectDirectory);
  const required = (id: string) => { const source = sources.get(id); if (!source) throw new TypeError(`Paged ellipsoid requires ${id}.`); return source.value; };
  const config = parsePagedProfile(required('paged-ellipsoid')), bindingSource = parsePagedLensBindings(required('lens-bindings'));
  if (!isPagedEllipsoidRecipe(config) || config.namespace !== descriptor.id || config.publicBase !== `/scenes/${descriptor.id}/`) throw new TypeError('Paged ellipsoid identity differs.');
  if (config.geometry.BODY_LATITUDE_SEGMENTS !== 16 || config.geometry.BODY_LONGITUDE_SEGMENTS !== 32) throw new TypeError('Unsupported segmented projective globe topology.');
  if (descriptor.recipe.shape.radiusKm !== config.equatorialRadiusKm || !descriptor.recipe.cutaway || !descriptor.recipe.atmosphere) throw new TypeError('Authored physical capabilities differ from their prepared operators.');
  const declared = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declared) !== JSON.stringify(bindingSource.controls.map(lens => lens.id))) throw new TypeError('Authored lenses differ from presentation bindings.');
  const sourceDirectory = resolve(objectDirectory, 'source'), sourceManifest = validateSourceManifest(config.namespace, await json(resolve(sourceDirectory, 'manifest.json')));
  const sun = prepareDirectionalSun();
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  // The scene needs the declared retained pool capacity, not a previously prepared overlay.
  const interiorSource = parseInteriorSource(await json(resolve(sourceDirectory, config.interiorPath)));
  requireFiniteNumber(interiorSource[config.interiorRadiusKey], config.interiorRadiusKey);
  if (interiorSource.tomographyPath && sources.get('mantle-tomography')?.reference.path !== `source/${interiorSource.tomographyPath}`)
    throw new Error('Mantle tomography must bind its authored recipe for reproducible provenance.');
  // The body sits in its ecliptic presentation frame; the surface map the feature labels use says where its longitudes start.
  const features = sources.get('features')?.value as { surfaceMap?: unknown } | undefined;
  const surfaceMap = typeof features?.surfaceMap === 'string' ? await json(resolve(sourceDirectory, features.surfaceMap)) as { mapLeftEdgeLongitudeDeg?: unknown } : null;
  const attitude = prepareEllipsoidAttitude(descriptor.id, { meshRotationZDegrees: config.geometry.MESH_ROTATION_Z,
    mapLeftEdgeLongitudeDeg: surfaceMap ? requireFiniteNumber(surfaceMap.mapLeftEdgeLongitudeDeg, 'surface map left edge') : 0 });
  const { scene, surfaceRasterPlan } = preparePagedEllipsoidScene({ config, interiorSource, atmosphereModel, atmosphere, raster, attitude });
  return { descriptor, entries, sources, config, bindingSource, sourceDirectory, sourceManifest, sun, atmosphere, atmosphereModel, raster, interiorSource, attitude, scene, surfaceRasterPlan };
}
