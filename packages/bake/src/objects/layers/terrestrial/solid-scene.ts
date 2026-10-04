import { OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA, requireObjectControls, preparedResourcePool, type PreparedVariant, type PreparedPresentationDefinition, type PreparedCubicSkyPlan, type PreparedDirectionalSunPlan } from '@cssearth/objects';

import type { PreparedProjectiveTextureLeaf, MaterialSourceTrack } from '../../../presentation/index.ts';
import type { prepareSolidMaterial } from './solid/solid-raster.ts';
import type { SolidRasterGrid } from './raster-grid.ts';
import type { combineRadialModels } from './radial/radial-models.ts';
import type { createSourceManifest } from '@cssearth/objects/node';

import { requireString, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { prepareScientificNavigation } from './scientific-focus.ts';
import { prepareTerrestrialRings } from './rings.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareSolidBodySurface, preparePerspectiveCamera } from '../../../scene/index.ts';
import { prepareAstrometricSkySceneRegistration, prepareEclipticPresentationFrame, photographDirections, prepareDefaultCameraAngles, prepareSunReferenceViewDirection, type SolarGeometry } from '../../scene/index.ts';
import { loadAstronomyPackage } from '../../../astronomy/index.ts';
import { prepareCssomDeclarationReads, createPreparedNodeTree, prepareMaterialTracks, requirePreparedPresentation } from '../../../presentation/index.ts';
import { requirePreparedResourceCatalog } from '../../../contract/index.ts';
import { restoreDepthSource } from '../../../prepared-presentation/index.ts';
import { publishedImageSize } from '../shape-model/index.ts';
/** The generated solar geometry the solid scene reads (`src/platform/solar-geometry.mts`, which the host loads and passes in): the
 * frame preparers' contract and the retained source of each body's epoch position. */
export interface SolidSceneSolarGeometry extends SolarGeometry {
  readonly BODY_POSITION_PROVENANCE: Readonly<Record<string, { readonly model: string; readonly sourcePath: string }>>;
}
export interface SolidSceneConfig {
  rings?:unknown;namespace:string;kind?:string;publicBase:string;
  geometry:{radius:number;radiusKm:number;mapUrl:string;polesUrl:string;radialTerrain?:{sourceTopology?:string};camera?:{framingScale?:number}};
  raster:SolidRasterGrid & Partial<Record<'observations'|'scientific'|'observedColors'|'surfaceObservations',readonly {id:string;focus?:unknown}[]>>;
  presentation:{defaultDataset:string};
}
type SolidCelestial={sky:PreparedCubicSkyPlan;sun:PreparedDirectionalSunPlan};
/** The object recipe's shape: a triaxial ellipsoid names its axes, a sphere only its radius. */
export type SolidShape={kind:string;radiusKm:number;secondaryRadiusKm?:number;polarRadiusKm?:number};

/** A body without a mesh is drawn as its recipe's ellipsoid: the longest axis takes the display radius and the others
 * keep their published ratios, as in the shape-model lane (`shape-model.ts`), so the world frame's body radius
 * (`recipe.shape.radiusKm`) is the drawn one. */
export function solidEllipsoidRadii(geometry:{radius:number}, shape:SolidShape|null) {
  const radius = geometry.radius;
  if (!shape || shape.kind !== 'ellipsoid') return { radius, secondaryRadius: radius, polarRadius: radius };
  return { radius, secondaryRadius: radius * (shape.secondaryRadiusKm ?? shape.radiusKm) / shape.radiusKm, polarRadius: radius * (shape.polarRadiusKm ?? shape.radiusKm) / shape.radiusKm };
}
type SolidScene=ReturnType<typeof import('./solid/prepared-replay-source.ts').parseSolidReplayScene>;

/** The terrestrial lane's default camera: the shared rule over the default dataset's photograph frames. */
export function solidCameraAngles(solarGeometry: SolarGeometry, config: Pick<SolidSceneConfig, 'namespace' | 'raster' | 'presentation'>, surfacesReport: unknown) {
  return prepareDefaultCameraAngles(solarGeometry, config.namespace, { observation: photographDirections(config.namespace, config, surfacesReport) });
}

/** Volume-equivalent radius over the largest radius of the body's mesh (vertices in radius units), at most 1: how much
 * smaller than a sphere of its radius the camera frames it, so an elongated body fits the view. An authored value, measured
 * on the source mesh, wins. */
export function meshFramingScale(radius: number, vertices: Iterable<readonly number[]>, authored?: number) {
  if (authored !== undefined) return authored;
  let largest = 0;
  for (const vertex of vertices) largest = Math.max(largest, Math.hypot(...vertex));
  if (!(largest > 0)) return 1;
  return Math.min(1, radius / largest);
}

async function prepareSolidEpochFrame({ config, celestial, surfacesReport, framingScale, solarGeometry }:{config:SolidSceneConfig;celestial:SolidCelestial;surfacesReport:unknown;framingScale:number;solarGeometry:SolidSceneSolarGeometry}) {
  const { namespace: id, geometry } = config;
  const { BODIES } = await loadAstronomyPackage();
  const bodyId=(Object.keys(BODIES) as Array<keyof typeof BODIES>).find(key=>key===id);
  if(!bodyId)throw new TypeError(`Missing astronomical body: ${id}`);
  const radiusKm = BODIES[bodyId].meanRadiusKm, radius = geometry.radius;
  if (radiusKm !== geometry.radiusKm) throw new Error(`Authored physical radius differs from astronomy source: ${id}`);
  const frame = prepareEclipticPresentationFrame(solarGeometry, id), registration = prepareAstrometricSkySceneRegistration(solarGeometry, id);
  if(!celestial.sky.projection)throw new TypeError("Solid sky requires its prepared camera projection.");
  const sky = { ...celestial.sky, projection:{...celestial.sky.projection,focalLengthOverViewportWidth:requireFiniteNumber(celestial.sky.projection.focalLengthOverViewportWidth)}, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
    sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch };
  const source = new Map(Object.entries(solarGeometry.BODY_POSITION_PROVENANCE)).get(id);
  const sun = source ? { ...celestial.sun, localDirection: frame.sunDirection,
    referenceViewDirection: prepareSunReferenceViewDirection(solarGeometry, { bodyId: id, ...solidCameraAngles(solarGeometry, config, surfacesReport), sceneDirection: frame.sunDirection }),
    provenance: { source: source.model, sourcePath: source.sourcePath,
      qualification: `Computed Sun direction at ${solarGeometry.SOLAR_GEOMETRY_EPOCH_LABEL} from its retained source state and canonical heliocentric parent coordinates. The surface attitude uses its separately authored rotation model.` } } : celestial.sun;
  return { camera: preparePerspectiveCamera({ sky, radius, framingScale, ...solidCameraAngles(solarGeometry, config, surfacesReport) }), sky, sun,
    systemTransform: frame.cssTransform };
}

/** The widest surface and pole images any dataset binds to the banded leaves: the lane's assets.json names them, and their
 * files give the widths, so each leaf holds the widest at two texels per CSS pixel. */
async function publishedDatasetImageWidths({ config, outputDirectory, publicDirectory }:{config:SolidSceneConfig;outputDirectory:string;publicDirectory:string}) {
  const path = resolve(outputDirectory, 'assets.json');
  const surfaces = Object.entries(requireRecord(requireRecord(JSON.parse(await readFile(path, 'utf8')), path).surfaces, `${path} surfaces`));
  if (!surfaces.length) throw new TypeError(`${config.namespace}: ${path} lists no dataset surfaces.`);
  const widest = async (fields: readonly string[]) => Math.max(...await Promise.all(surfaces.flatMap(([dataset, value]) => fields.map(async field =>
    (await publishedImageSize({ publicDirectory, publicBase: config.publicBase }, requireString(requireRecord(value, `${path} ${dataset}`)[field], `${path} ${dataset}.${field}`), config.namespace)).width))));
  return { mapPixelWidth: await widest(['url', 'url2x']), polesPixelWidth: await widest(['polesUrl', 'polesUrl2x']) };
}

export async function prepareSolidScene({ config, celestial, outputDirectory, publicDirectory, radial = null, shape = null, solarGeometry }:{config:SolidSceneConfig;celestial:SolidCelestial;outputDirectory:string;publicDirectory:string;radial?:ReturnType<typeof combineRadialModels>;shape?:SolidShape|null;solarGeometry:SolidSceneSolarGeometry}) {
  const { namespace: id, geometry } = config;
  const framingScale = meshFramingScale(geometry.radius, (radial?.faces ?? []).flatMap(face => face.vertices), geometry.camera?.framingScale);
  const epoch = await prepareSolidEpochFrame({ config, celestial, framingScale, surfacesReport: JSON.parse(await readFile(resolve(outputDirectory, 'surfaces.json'), 'utf8')), solarGeometry });
  const bodyLeaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[]=radial?.leaves ?? prepareSolidBodySurface({ id, ...solidEllipsoidRadii(geometry, shape), mapUrl: geometry.mapUrl, polesUrl: geometry.polesUrl,
      sourceWidth: config.raster.width, sourceHeight: config.raster.height,
      latitudeSegments: config.raster.bandCount, gutter: config.raster.gutter,
      poleTileSize: config.raster.poleSize, ...await publishedDatasetImageWidths({ config, outputDirectory, publicDirectory }) });
  const rings = await prepareTerrestrialRings({ config, publicDirectory });
  const scene = { camera: epoch.camera, sky: epoch.sky, sun: epoch.sun,
    ...(rings ? { rings } : {}),
    ...(radial ? { surfaceTriangles: radial.faces.map(face => face.vertices.map(v => [v[1] * BASE_TILE, v[0] * BASE_TILE, v[2] * BASE_TILE])) } : {}),
    ...(radial?.datasetRanges ? { surfaceDatasetRanges: radial.datasetRanges } : {}),
    systemTransform: epoch.systemTransform,
    bodyLeaves };
  await writeFile(resolve(outputDirectory, 'scene.json'), `${JSON.stringify(scene)}\n`);
  if (new Map(Object.entries(solarGeometry.BODY_POSITION_PROVENANCE)).get(id)) {
    await writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(epoch.sky)}\n`);
    await writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(epoch.sun)}\n`);
  }
  return scene;
}

/** Refresh a changed ephemeris without rebuilding source geometry or image banks.
 * The same numeric owner as full preparation updates the actual retained carrier,
 * so the physical world frame never names a basis absent from the rendered scene. */
export async function refreshSolidSceneEpoch<T extends {sky:PreparedCubicSkyPlan;sun:PreparedDirectionalSunPlan;bodyLeaves:readonly unknown[];systemTransform:string},D extends PreparedPresentationDefinition & {id:string}>({ config, scene, definition: inputDefinition, surfacesReport, solarGeometry }:{config:SolidSceneConfig;scene:T;definition:D;surfacesReport:unknown;solarGeometry:SolidSceneSolarGeometry}) {
  // Refresh the canonical preparation branch. Generated projection carriers
  // are rebuilt by prepareObjectJson after its physical frame has changed.
  const definition = restoreDepthSource(inputDefinition);
  const id = config.namespace;
  if (config.kind !== 'solid-observation-body' || definition.id !== id || !Array.isArray(scene.bodyLeaves)) {
    throw new TypeError('Epoch refresh requires its prepared solid-observation scene.');
  }
  // The retained scene keeps the mesh in world units (radius units times BASE_TILE).
  const triangles = (scene as { surfaceTriangles?: readonly (readonly (readonly number[])[])[] }).surfaceTriangles ?? [];
  const framingScale = meshFramingScale(config.geometry.radius, triangles.flatMap(triangle => triangle.map(vertex => vertex.map(value => value / BASE_TILE))), config.geometry.camera?.framingScale);
  const epoch = await prepareSolidEpochFrame({ config, celestial: { sky: scene.sky, sun: scene.sun }, surfacesReport, framingScale, solarGeometry });
  const nodes = definition.tree.nodes;
  const carriers = nodes.map((node, index) => node.className?.split(' ').includes(`${id}-system`) ? index : -1).filter(index => index >= 0);
  if (carriers.length !== 1) throw new TypeError('Epoch refresh needs one retained physical surface carrier.');
  const carrier = nodes[carriers[0]];
  if (carrier.style !== `transform:${scene.systemTransform}` || carrier.properties.some(index => definition.tree.properties[index].name === 'transform')) {
    throw new TypeError('Epoch refresh cannot bind a carrier that differs from its prepared source scene.');
  }
  const nextScene = { ...scene, ...epoch };
  // Dataset destinations are camera angles in the same frame, so they follow the refreshed camera.
  const focus = new Map((['observations','scientific','observedColors','surfaceObservations'] as const).flatMap(kind =>
    (config.raster[kind]??[]).filter(dataset=>dataset.focus).map(dataset=>[dataset.id,dataset.focus] as const)));
  const variants = focus.size === 0 ? definition.variants : definition.variants.map(variant => {
    const datasetId = (variant.when as {datasetId?:string}|undefined)?.datasetId;
    return datasetId !== undefined && focus.has(datasetId) ? { ...variant, navigation: prepareScientificNavigation(solarGeometry, id, focus.get(datasetId), epoch.camera) } : variant;
  });
  const nextDefinition = { ...definition, variants, camera: { ...definition.camera, ...epoch.camera }, sky: epoch.sky, sun: epoch.sun,
    tree: { ...definition.tree, nodes: nodes.map((node, index) => index === carriers[0] ? { ...node, style: `transform:${epoch.systemTransform}` } : node) } };
  return { scene: nextScene, definition: nextDefinition };
}

export async function prepareSolidPresentation({ config, scene: plan, material: { surfaces, lighting }, controls, source, sourceDirectory, publicDirectory, outputDirectory, solarGeometry }:{config:SolidSceneConfig;scene:SolidScene;material:Awaited<ReturnType<typeof prepareSolidMaterial>>;controls:unknown;source:Awaited<ReturnType<typeof createSourceManifest>>;sourceDirectory:string;publicDirectory:string;outputDirectory:string;solarGeometry:SolarGeometry}) {
  const id = config.namespace;
  const entries = [
    ...(plan.rings ? [plan.rings.resource] : []),
    ...(lighting ? [{ key: 'lighting', url: lighting.url, pool: 'mounted' }] : []),
    ...surfaces.flatMap(s => [
      { key: `surface:${s.id}`, url: s.surface.url, pool: s.id === config.presentation.defaultDataset ? 'mounted' : 'datasets' },
      { key: `poles:${s.id}`, url: requireString(s.polesUrl), pool: s.id === config.presentation.defaultDataset ? 'mounted' : 'datasets' },
      ...(s.shadowSurface ? [{ key: `shadow:${s.id}`, url: s.shadowSurface.url, pool: 'datasets' }] : []),
    ]),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...plan.bodyLeaves, ...(plan.rings?.leaves ?? [])].map(leaf => leaf.style)) });
  const camera = b.mesh(`polycss-camera ${id}-camera object-render-root`);
  const scene = b.mesh(`polycss-scene ${id}-scene`), system = b.mesh(`${id}-system`, `transform:${plan.systemTransform}`);
  const body = b.mesh(`${id}-body`);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) {
    const node = b.leaf(leaf);
    Object.assign(node.attributes, leaf.attributes ?? {});
    b.append(body, node);
  }
  const rings = plan.rings ? b.mesh(`${id}-rings`) : null;
  if (rings && plan.rings) {
    b.append(system, rings);
    for (const leaf of plan.rings.leaves) {
      const node = b.leaf(leaf);
      node.style.backgroundImage = `var(--${id}-ring-image)`;
      b.append(rings, node);
    }
  }
  const materialRoot = b.element('div', `${id}-material-root object-render-root`);
  const billboard = b.element('s', `${id}-billboard`), material = b.element('s', `${id}-material`);
  b.append(null, materialRoot); b.append(materialRoot, billboard); b.append(materialRoot, material);
  const { tree, index } = b.finish({ camera, scene });
  const track:MaterialSourceTrack|null = lighting && { id: 'lighting', target: index(material),
    frame: { source: 'sun-z', minimum: -1, maximum: 1, count: lighting.frameCount, baseFrame: 0, remap: null },
    banks: [{ id: 'atlas', frames: lighting.frames, default: null, fixed: lighting.frames[lighting.frames.length-1],
      rows: [{ row: 0, resource: 'lighting', firstFrame: 0, lastFrame: lighting.frameCount - 1 }] }],
    demand: { capacity: 1, defaultFrame: Math.floor(lighting.frameCount / 2) },
    rotation: { kind: 'angle', source: 'view-sun', reference: 'prepared', baseDegrees: 0,
      zeroAtPole: false, property: `--${id}-light-roll` }, frameAttribute: null, modeAttribute: null, quoted: true };
  const focus = new Map((['observations','scientific','observedColors','surfaceObservations'] as const).flatMap(kind =>
    (config.raster[kind]??[]).filter(dataset=>dataset.focus).map(dataset=>[dataset.id,dataset.focus] as const)));
  const variants = surfaces.flatMap(s => [false, true].map((shadows):PreparedVariant => ({
    ...(focus.has(s.id) ? {navigation: prepareScientificNavigation(solarGeometry, id, focus.get(s.id), plan.camera)} : {}),
    when: { datasetId: s.id, shadows }, required: [s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, `poles:${s.id}`, ...(lighting ? ['lighting'] : []), ...(rings ? ['rings'] : [])],
    writes: [
      ...(rings ? [{ kind: 'texture' as const, target: index(rings), name: `--${id}-ring-image`, resource: 'rings', quoted: true }] : []),
      { kind: 'texture', target: index(body), name: `--${id}-surface-image`, resource: s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, quoted: true },
      { kind: 'texture', target: index(body), name: `--${id}-poles-image`, resource: `poles:${s.id}`, quoted: true },
      ...[...new Set(plan.bodyLeaves.map(leaf => leaf.attributes?.['data-surface-model']).filter(Boolean))].map(model => ({
        kind: 'style' as const, target: index(body), name: `--${id}-${model}-display`,
        value: surfaceModel(s.id) === model ? 'block' : 'none',
      })),
      { kind: 'style', target: index(materialRoot), name: `--${id}-billboard-color`, value: requireString(s.billboardColor) },
      { kind: 'attribute', target: -1, name: 'data-dataset', value: s.id },
    ],
    materials: !track ? [] : [{ track: 'lighting', bank: 'atlas', mode: shadows ? 'frames' : 'fixed', enabled: true,
      rotationEnabled: shadows, frameOverride: null, clearWhenHidden: true, fixedMode: 'full-phase-curvature' }],
  })));
  function surfaceModel(datasetId:string) {
    const range=plan.surfaceDatasetRanges?.find(range=>range.datasetId===datasetId);
    if(!range)throw new TypeError('Prepared surface model lacks its dataset range.');
    return plan.bodyLeaves[range.start].attributes?.['data-surface-model'];
  }
  const presentation = { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.sky, sun: plan.sun,
    assets: { entries, pools: [preparedResourcePool('mounted', entries),
      ...(entries.some(entry => entry.pool === 'datasets')
        ? [preparedResourcePool('datasets', entries, { retention: 'selection', capacity: 4, concurrency: 2 })] : [])],
    startup: entries.filter(entry => entry.pool === 'mounted').map(entry => entry.key) },
    tree, variants, materials: track ? [track] : [], animations: [],
    ...(plan.surfaceTriangles ? { surfaceHit: { target: index(body), triangles: plan.surfaceTriangles,
      ...(plan.surfaceDatasetRanges ? { datasetRanges: plan.surfaceDatasetRanges } : {}),
      // XYZ source coordinates swap X/Y for CSS: outward faces are clockwise.
      ...(config.geometry.radialTerrain?.sourceTopology === 'open' ? { frontFace: 'clockwise' } : {}) } } : {}),
    viewBindings: [
      { kind: 'silhouette-fit', target: index(materialRoot), minimumRadius: 1.5, unitScale: 2 / plan.camera.logicalBodyDiameter },
      { kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null },
      { kind: 'view-property', target: index(materialRoot), property: `--${id}-billboard-opacity`, source: 'billboard-opacity', precision: 6 },
    ],
  };
  const prepared = { ...presentation, materials: prepareMaterialTracks(presentation) };
  const validated=requirePreparedPresentation(prepared, { controls });
  requirePreparedResourceCatalog(prepared.assets);
  return { ...validated, schema: OBJECT_RUNTIME_SCHEMA, id, controls:requireObjectControls(controls) };
}
