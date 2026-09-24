import type { PreparedCubicSkyPlan } from '../../../src/platform/cubic-sky-contract.mts';
import type { PreparedDirectionalSunPlan } from '../../../src/platform/directional-sun-contract.mts';
import type { PreparedProjectiveTextureLeaf } from '../../prepared/projective-layout.mts';
import type { prepareSolidMaterial } from './solid-raster.mts';
import type { SolidRasterGrid } from './raster-grid.mts';
import type { combineRadialModels } from './radial-models.mts';
import type { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import type { MaterialSourceTrack } from '../../prepare/prepare-materials.mts';
import type { PreparedVariant } from '../../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PreparedPresentationDefinition } from '../../../src/renderers/css/rendering/prepared-presentation.ts';
import { requireString, requireFiniteNumber } from '@cssearth/core';
import { requireObjectControls } from '../../../site/scene/scene-contract.mts';
import { prepareScientificNavigation } from './scientific-focus.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareSolidBodySurface } from '../../../src/platform/prepare-solid-body-surface.mts';
import { preparePerspectiveCamera } from '../../../src/platform/prepare-perspective-camera.mts';
import { prepareAstrometricSkySceneRegistration } from '../../../src/platform/astrometric-sky-registration.mts';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mts';
import { photographDirections, prepareDefaultCameraAngles } from '../../../src/platform/default-camera.mts';
import { loadAstronomyPackage } from '../../../src/platform/astronomy-package.mts';
import { PREPARED_PRESENTATION_SCHEMA } from '../../../src/platform/prepared-presentation-contract.mts';
import { preparedResourcePool } from '../../../src/platform/prepared-object-assets.mts';
import { prepareCssomDeclarationReads } from '../../prepared/prepared-cssom.mts';
import { createPreparedNodeTree } from '../../prepared/prepared-node-tree.mts';
import { prepareMaterialTracks } from '../../prepare/prepare-materials.mts';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mts';
import { requirePreparedResourceCatalog } from '../../contract/object-runtime-contract.mts';
import { prepareSunReferenceViewDirection } from '../../../src/platform/prepare-sun-view-direction.mts';
import { BODY_POSITION_PROVENANCE, SOLAR_GEOMETRY_EPOCH_LABEL } from '../../../src/platform/solar-geometry.mts';
import { restoreDepthSource } from '../../prepared/prepared-depth-partitions.mts';
import { prepareTerrestrialRings } from './rings.mts';
export interface SolidSceneConfig {
  rings?:unknown;namespace:string;kind?:string;publicBase:string;
  geometry:{radius:number;radiusKm:number;mapUrl:string;polesUrl:string;radialTerrain?:{sourceTopology?:string};camera?:{framingScale?:number}};
  raster:SolidRasterGrid & Partial<Record<'observations'|'scientific'|'observedColors'|'surfaceObservations',readonly {id:string;focus?:unknown}[]>>;
  presentation:{defaultLens:string};
}
type SolidCelestial={sky:PreparedCubicSkyPlan;sun:PreparedDirectionalSunPlan};
type SolidScene=ReturnType<typeof import('../../prepared/prepared-replay-source.mts').parseSolidReplayScene>;

/** The terrestrial lane's default camera: the shared rule over the default lens's photograph frames. */
export function solidCameraAngles(config: Pick<SolidSceneConfig, 'namespace' | 'raster' | 'presentation'>, surfacesReport: unknown) {
  return prepareDefaultCameraAngles(config.namespace, { observation: photographDirections(config.namespace, config, surfacesReport) });
}

async function prepareSolidEpochFrame({ config, celestial, surfacesReport }:{config:SolidSceneConfig;celestial:SolidCelestial;surfacesReport:unknown}) {
  const { namespace: id, geometry } = config;
  const { BODIES } = await loadAstronomyPackage();
  const bodyId=(Object.keys(BODIES) as Array<keyof typeof BODIES>).find(key=>key===id);
  if(!bodyId)throw new TypeError(`Missing astronomical body: ${id}`);
  const radiusKm = BODIES[bodyId].meanRadiusKm, radius = geometry.radius;
  if (radiusKm !== geometry.radiusKm) throw new Error(`Authored physical radius differs from astronomy source: ${id}`);
  const frame = prepareEclipticPresentationFrame(id), registration = prepareAstrometricSkySceneRegistration(id);
  if(!celestial.sky.projection)throw new TypeError("Solid sky requires its prepared camera projection.");
  const sky = { ...celestial.sky, projection:{...celestial.sky.projection,focalLengthOverViewportWidth:requireFiniteNumber(celestial.sky.projection.focalLengthOverViewportWidth)}, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
    sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch };
  const source = new Map(Object.entries(BODY_POSITION_PROVENANCE)).get(id);
  const sun = source ? { ...celestial.sun, localDirection: frame.sunDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId: id, ...solidCameraAngles(config, surfacesReport), sceneDirection: frame.sunDirection }),
    provenance: { source: source.model, sourcePath: source.sourcePath,
      qualification: `Computed Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL} from its retained source state and canonical heliocentric parent coordinates. The surface attitude uses its separately authored rotation model.` } } : celestial.sun;
  return { camera: preparePerspectiveCamera({ sky, radius, ...geometry.camera, ...solidCameraAngles(config, surfacesReport) }), sky, sun,
    systemTransform: frame.cssTransform };
}

export async function prepareSolidScene({ config, celestial, outputDirectory, publicDirectory, radial = null }:{config:SolidSceneConfig;celestial:SolidCelestial;outputDirectory:string;publicDirectory:string;radial?:ReturnType<typeof combineRadialModels>}) {
  const { namespace: id, geometry } = config;
  const epoch = await prepareSolidEpochFrame({ config, celestial, surfacesReport: JSON.parse(await readFile(resolve(outputDirectory, 'surfaces.json'), 'utf8')) });
  const bodyLeaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[]=radial?.leaves ?? prepareSolidBodySurface({ id, radius: geometry.radius, mapUrl: geometry.mapUrl, polesUrl: geometry.polesUrl,
      sourceWidth: config.raster.width, sourceHeight: config.raster.height,
      latitudeSegments: config.raster.bandCount, gutter: config.raster.gutter,
      poleTileSize: config.raster.poleSize });
  const rings = await prepareTerrestrialRings({ config, publicDirectory });
  const scene = { camera: epoch.camera, sky: epoch.sky, sun: epoch.sun,
    ...(rings ? { rings } : {}),
    ...(radial ? { surfaceTriangles: radial.faces.map(face => face.vertices.map(v => [v[1] * BASE_TILE, v[0] * BASE_TILE, v[2] * BASE_TILE])) } : {}),
    ...(radial?.lensRanges ? { surfaceLensRanges: radial.lensRanges } : {}),
    systemTransform: epoch.systemTransform,
    bodyLeaves };
  await writeFile(resolve(outputDirectory, 'scene.json'), `${JSON.stringify(scene)}\n`);
  if (new Map(Object.entries(BODY_POSITION_PROVENANCE)).get(id)) {
    await writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(epoch.sky)}\n`);
    await writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(epoch.sun)}\n`);
  }
  return scene;
}

/** Refresh a changed ephemeris without rebuilding source geometry or image banks.
 * The same numeric owner as full preparation updates the actual retained carrier,
 * so the physical world frame never names a basis absent from the rendered scene. */
export async function refreshSolidSceneEpoch<T extends {sky:PreparedCubicSkyPlan;sun:PreparedDirectionalSunPlan;bodyLeaves:readonly unknown[];systemTransform:string},D extends PreparedPresentationDefinition & {id:string}>({ config, scene, definition: inputDefinition, surfacesReport }:{config:SolidSceneConfig;scene:T;definition:D;surfacesReport:unknown}) {
  // Refresh the canonical preparation branch. Generated projection carriers
  // are rebuilt by prepareObjectJson after its physical frame has changed.
  const definition = restoreDepthSource(inputDefinition);
  const id = config.namespace;
  if (config.kind !== 'solid-observation-body' || definition.id !== id || !Array.isArray(scene.bodyLeaves)) {
    throw new TypeError('Epoch refresh requires its prepared solid-observation scene.');
  }
  const epoch = await prepareSolidEpochFrame({ config, celestial: { sky: scene.sky, sun: scene.sun }, surfacesReport });
  const nodes = definition.tree.nodes;
  const carriers = nodes.map((node, index) => node.className?.split(' ').includes(`${id}-system`) ? index : -1).filter(index => index >= 0);
  if (carriers.length !== 1) throw new TypeError('Epoch refresh needs one retained physical surface carrier.');
  const carrier = nodes[carriers[0]];
  if (carrier.style !== `transform:${scene.systemTransform}` || carrier.properties.some(index => definition.tree.properties[index].name === 'transform')) {
    throw new TypeError('Epoch refresh cannot bind a carrier that differs from its prepared source scene.');
  }
  const nextScene = { ...scene, ...epoch };
  // Lens destinations are camera angles in the same frame, so they follow the refreshed camera.
  const focus = new Map((['observations','scientific','observedColors','surfaceObservations'] as const).flatMap(kind =>
    (config.raster[kind]??[]).filter(lens=>lens.focus).map(lens=>[lens.id,lens.focus] as const)));
  const variants = focus.size === 0 ? definition.variants : definition.variants.map(variant => {
    const lensId = (variant.when as {lensId?:string}|undefined)?.lensId;
    return lensId !== undefined && focus.has(lensId) ? { ...variant, navigation: prepareScientificNavigation(id, focus.get(lensId), epoch.camera) } : variant;
  });
  const nextDefinition = { ...definition, variants, camera: { ...definition.camera, ...epoch.camera }, sky: epoch.sky, sun: epoch.sun,
    tree: { ...definition.tree, nodes: nodes.map((node, index) => index === carriers[0] ? { ...node, style: `transform:${epoch.systemTransform}` } : node) } };
  return { scene: nextScene, definition: nextDefinition };
}

export async function prepareSolidPresentation({ config, scene: plan, material: { surfaces, lighting }, controls, source, sourceDirectory, publicDirectory, outputDirectory }:{config:SolidSceneConfig;scene:SolidScene;material:Awaited<ReturnType<typeof prepareSolidMaterial>>;controls:unknown;source:Awaited<ReturnType<typeof createSourceManifest>>;sourceDirectory:string;publicDirectory:string;outputDirectory:string}) {
  const id = config.namespace;
  const entries = [
    ...(plan.rings ? [plan.rings.resource] : []),
    ...(lighting ? [{ key: 'lighting', url: lighting.url, pool: 'mounted' }] : []),
    ...surfaces.flatMap(s => [
      { key: `surface:${s.id}`, url: s.surface.url, pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
      { key: `poles:${s.id}`, url: requireString(s.polesUrl), pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
      ...(s.shadowSurface ? [{ key: `shadow:${s.id}`, url: s.shadowSurface.url, pool: 'lenses' }] : []),
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
    (config.raster[kind]??[]).filter(lens=>lens.focus).map(lens=>[lens.id,lens.focus] as const)));
  const variants = surfaces.flatMap(s => [false, true].map((shadows):PreparedVariant => ({
    ...(focus.has(s.id) ? {navigation: prepareScientificNavigation(id, focus.get(s.id), plan.camera)} : {}),
    when: { lensId: s.id, shadows }, required: [s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, `poles:${s.id}`, ...(lighting ? ['lighting'] : []), ...(rings ? ['rings'] : [])],
    writes: [
      ...(rings ? [{ kind: 'texture' as const, target: index(rings), name: `--${id}-ring-image`, resource: 'rings', quoted: true }] : []),
      { kind: 'texture', target: index(body), name: `--${id}-surface-image`, resource: s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, quoted: true },
      { kind: 'texture', target: index(body), name: `--${id}-poles-image`, resource: `poles:${s.id}`, quoted: true },
      ...[...new Set(plan.bodyLeaves.map(leaf => leaf.attributes?.['data-surface-model']).filter(Boolean))].map(model => ({
        kind: 'style' as const, target: index(body), name: `--${id}-${model}-display`,
        value: surfaceModel(s.id) === model ? 'block' : 'none',
      })),
      { kind: 'style', target: index(materialRoot), name: `--${id}-billboard-color`, value: requireString(s.billboardColor) },
      { kind: 'attribute', target: -1, name: 'data-lens', value: s.id },
    ],
    materials: !track ? [] : [{ track: 'lighting', bank: 'atlas', mode: shadows ? 'frames' : 'fixed', enabled: true,
      rotationEnabled: shadows, frameOverride: null, clearWhenHidden: true, fixedMode: 'full-phase-curvature' }],
  })));
  function surfaceModel(lensId:string) {
    const range=plan.surfaceLensRanges?.find(range=>range.lensId===lensId);
    if(!range)throw new TypeError('Prepared surface model lacks its lens range.');
    return plan.bodyLeaves[range.start].attributes?.['data-surface-model'];
  }
  const presentation = { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.sky, sun: plan.sun,
    assets: { entries, pools: [preparedResourcePool('mounted', entries),
      ...(entries.some(entry => entry.pool === 'lenses')
        ? [preparedResourcePool('lenses', entries, { retention: 'selection', capacity: 4, concurrency: 2 })] : [])],
    startup: entries.filter(entry => entry.pool === 'mounted').map(entry => entry.key) },
    tree, variants, materials: track ? [track] : [], animations: [],
    ...(plan.surfaceTriangles ? { surfaceHit: { target: index(body), triangles: plan.surfaceTriangles,
      ...(plan.surfaceLensRanges ? { lensRanges: plan.surfaceLensRanges } : {}),
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
  return { ...validated, schema: 'cssearth-object-runtime@4', id, controls:requireObjectControls(controls) };
}
