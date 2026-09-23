import { prepareEllipsoidAttitude } from './attitude.mts';
import { readAuthoredSources } from '../authored-sources.ts';
import {requireObjectControls} from '../../../site/scene/scene-contract.mts';
import type {AuthoredObjectDescriptor} from '@cssearth/objects';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString} from '../../sources/source-values.mts';
import {validateSourceManifest} from '../../../src/platform/source-manifest.mts';
import {parsePagedProfile, parsePagedLensBindings, isPagedEllipsoidRecipe} from './profile-source.mts';
import {parseInteriorSource} from './source-contract.mts';
import {parseBodyAttitude} from './geographic/source-records.mts';
export {isPagedEllipsoidRecipe} from './profile-source.mts';
export interface PagedEllipsoidContext {
  objectDirectory: string; publicDirectory: string; outputDirectory: string; packDirectory?: string;
  prepareContent: typeof prepareObjectContentAssets;
  /** Reuse this object's published raster, overlay, place, page and texture-level outputs from outputDirectory and publicDirectory,
   * and prepare only what the presentation derives from them. Refuses when the recipe sources or the recomputed plan differ. */
  presentationOnly?: boolean;
  /** Recipe sources the author states changed without feeding the reused outputs; each is named in the run's output. */
  acceptChanged?: readonly string[];
}
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { verifySourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { prepareDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { createAtmospherePreparation } from './atmosphere.mts';
import { createPagedSurfaceRaster } from './surface-raster.mts';
import { preparePagedEllipsoidScene } from './scene.mts';
import { preparePagedEllipsoidAssets } from './assets.mts';
import { preparePagedEllipsoidPresentation } from './presentation.mts';
import { prepareLocationPoint, prepareLocationCamera } from './geographic/prepare-location.mts';
import { preparePlaces } from './geographic/places.mts';
import { withFocusedCamera } from '../focused-camera.mts';

import { prepareTextureLevels } from './texture-levels.mts';

const json = readJsonSource;
const write = (directory: string, name: string, value: unknown) => writeFile(resolve(directory, `${name}.json`), `${JSON.stringify(value)}\n`);


/** Source-derived projective globe, atmosphere, cutaway, map hierarchy and places. */
export async function preparePagedEllipsoidObject({ objectDirectory, publicDirectory, outputDirectory, prepareContent, presentationOnly = false, acceptChanged = [], packDirectory = process.env.CSSEARTH_WMTS_PACK_DIRECTORY ?? resolve(process.cwd(), '.local/wmts-global') }: PagedEllipsoidContext) {
  const { descriptor, entries, sources } = await readAuthoredSources(objectDirectory);
  const required = (id: string) => { const source = sources.get(id); if (!source) throw new TypeError(`Paged ellipsoid requires ${id}.`); return source.value; };
  const config = parsePagedProfile(required('paged-ellipsoid')), bindingSource = parsePagedLensBindings(required('lens-bindings'));
  if (!isPagedEllipsoidRecipe(config) || config.namespace !== descriptor.id || config.publicBase !== `/scenes/${descriptor.id}/`) throw new TypeError('Paged ellipsoid identity differs.');
  if (config.geometry.BODY_LATITUDE_SEGMENTS !== 16 || config.geometry.BODY_LONGITUDE_SEGMENTS !== 32) throw new TypeError('Unsupported segmented projective globe topology.');
  if (descriptor.recipe.shape.radiusKm !== config.equatorialRadiusKm || !descriptor.recipe.cutaway || !descriptor.recipe.atmosphere) throw new TypeError('Authored physical capabilities differ from their prepared operators.');
  const declared = descriptor.recipe.surfaces.flatMap(surface => surface.lenses.map(lens => lens.id));
  if (JSON.stringify(declared) !== JSON.stringify(bindingSource.controls.map(lens => lens.id))) throw new TypeError('Authored lenses differ from presentation bindings.');
  const sourceDirectory = resolve(objectDirectory, 'source'), sourceManifest = validateSourceManifest(config.namespace, await json(resolve(sourceDirectory, 'manifest.json')));
  // The raw imagery is read only by the stages a presentation-only run reuses; it may be absent from this checkout.
  if (!presentationOnly) await verifySourceManifest({ sourceRoot: sourceDirectory, manifest: sourceManifest, objectName: config.displayName });
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const published = async (name: string) => requireRecord(await json(resolve(outputDirectory, `${name}.json`)), `published ${name}`);
  // Published JSON may order keys differently from a fresh run; compare values, not serializations.
  const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : item);
  // Read the published plan before any stage below rewrites a file in this output directory.
  const publishedPlan = presentationOnly ? { scene: await published('scene'), 'surface-raster-plan': await published('surface-raster-plan'), lenses: await published('lenses') } : null;
  if (presentationOnly) {
    const previous = await published('authored-preparation');
    const publishedSources = new Map(requireArray(previous.sources, 'published sources').map(source => requireRecord(source, 'published source'))
      .map(source => [requireString(source.id, 'source id'), JSON.stringify(source)] as const));
    const current = entries.map(entry => entry.reference);
    const changed = [...new Set([...publishedSources.keys(), ...current.map(reference => reference.id)])]
      .filter(sourceId => publishedSources.get(sourceId) !== JSON.stringify(current.find(reference => reference.id === sourceId)));
    const unaccepted = changed.filter(sourceId => !acceptChanged.includes(sourceId));
    if (unaccepted.length) throw new Error(`${descriptor.id}: recipe sources changed since the published preparation (${unaccepted.join(', ')}); run the full preparation, or pass --accept-changed when a change feeds none of the reused outputs.`);
    if (changed.length) console.log(`${descriptor.id}: reusing published outputs across accepted recipe changes: ${changed.join(', ')}.`);
  }
  const sun = prepareDirectionalSun();
  const sky = prepareCubicSky({ objectId: descriptor.id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD });
  const atmosphere = createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun }), atmosphereModel = await atmosphere.readAtmosphereModel(), raster = createPagedSurfaceRaster(config);
  const destinations = descriptor.recipe.destinations;
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
  if (publishedPlan) {
    // The reused outputs read the surface raster plan whole, and from the scene only its surface asset banks (texture
    // levels resolve them); the rest of the scene is presentation, which this lane prepares afresh.
    const banks = (plan: Record<string, unknown>) => {
      const body = requireRecord(plan.body, 'scene body'), interior = requireRecord(plan.interior, 'scene interior');
      return { surface: requireRecord(requireRecord(body.assets, 'body assets').surface, 'body surface'), interior: interior.outerAssets };
    };
    if (canonical(banks(publishedPlan.scene)) !== canonical(banks(requireRecord(scene, 'scene'))))
      throw new Error(`${descriptor.id}: scene surface banks differ from the published preparation; run the full preparation.`);
    if (canonical(publishedPlan['surface-raster-plan']) !== canonical(surfaceRasterPlan))
      throw new Error(`${descriptor.id}: surface-raster-plan differs from the published preparation; run the full preparation.`);
  }
  const rasterAssets = presentationOnly ? await published('raster-assets') as unknown as Awaited<ReturnType<typeof preparePagedEllipsoidAssets>>
    : await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster, attitude });
  const context = { sourceDirectory, publicDirectory, config, scene };
  // The city catalogue is an authored capability (a search over GeoNames places on the globe), not a requirement of a globe.
  // It reads only the scene geometry, so a presentation-only run rebuilds it as well.
  const catalog = destinations ? await preparePlaces(context) : undefined;
  if (catalog && destinations && catalog.count > destinations.maxEntries) throw new TypeError('Prepared places exceed the authored destination capability.');
  const lenses = { ...bindingSource, controls: bindingSource.controls.map(({ surfacePagePrefix, focus, ...lens }) => {
    return { ...lens,
    ...(surfacePagePrefix ? { surfaceUrls: raster.surfacePageUrls(surfacePagePrefix, surfaceRasterPlan.pages.length) } : {}),
    ...(focus ? { camera: { ...prepareLocationCamera(scene, prepareLocationPoint(scene, focus.longitude, focus.latitude), focus.zoom, { body: parseBodyAttitude(scene[config.sceneBodyKey]), camera: config.camera, northUp: focus.northUp }), ...(focus.transition ? { transition: focus.transition } : {}) } } : {}),
  }; }) };
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const content = { ...preparedContent.content, ...(catalog ? { destinations: { searchLabel: config.destinations.searchLabel, description: `${catalog.count.toLocaleString('en')}${config.destinations.descriptionSuffix}` } } : {}) };
  const textureLevels = presentationOnly ? await json(resolve(outputDirectory, 'texture-levels.json')).then(value => value === null ? null : requireRecord(value, 'published texture-levels') as unknown as Awaited<ReturnType<typeof prepareTextureLevels>>,
      error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; })
    : await prepareTextureLevels({ config, plan: scene, lenses, publicDirectory });
  if (textureLevels) await write(outputDirectory, 'texture-levels', textureLevels);
  if (publishedPlan && canonical(publishedPlan.lenses) !== canonical(lenses)) throw new Error(`${descriptor.id}: lenses differ from the published preparation; run the full preparation.`);
  const controls = requireObjectControls(preparedContent.controls, descriptor.id);
  const rawDefinition = await preparePagedEllipsoidPresentation({ config, plan: scene, lenses, sky, sun, catalog, textureLevels, controls });
  const definition = withFocusedCamera(rawDefinition, sky);
  for (const [name, value] of Object.entries({ scene, 'raster-assets': rasterAssets, 'surface-raster-plan': surfaceRasterPlan, sky, sun, ...(catalog ? { places: catalog } : {}), lenses, content, runtime: definition })) await write(outputDirectory, name, value);
  await write(outputDirectory, 'authored-preparation', { schema: 'cssearth-authored-preparation@1', id: descriptor.id, sources: entries.map(entry => entry.reference), lanes: { raster: true, celestial: true, geometry: true, content: true, presentation: true} });
  return { descriptor, sources, raster: rasterAssets, celestial: { sky, sun }, scene, definition, content };
}
