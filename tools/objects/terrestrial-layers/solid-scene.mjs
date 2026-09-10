import {prepareScientificNavigation} from './scientific-focus.mjs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { prepareSolidBodySurface } from '../../../src/platform/prepare-solid-body-surface.mjs';
import { preparePerspectiveCamera } from '../../../src/platform/prepare-perspective-camera.mjs';
import { prepareHeliocentricView } from '../../../src/platform/prepare-heliocentric-view.mjs';
import { preparePlanetarySystem } from '../../../src/platform/prepare-planetary-system.mjs';
import { prepareAstrometricSkySceneRegistration } from '../../../src/platform/astrometric-sky-registration.mjs';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mjs';
import { loadAstronomyPackage } from '../../../src/platform/astronomy-package.mjs';
import { PREPARED_PRESENTATION_SCHEMA } from '../../../src/platform/prepared-presentation-contract.mjs';
import { preparedSunResources, preparedResourcePool } from '../../../src/platform/prepared-object-assets.mjs';
import { prepareCssomDeclarationReads } from '../../prepared-cssom.mjs';
import { createPreparedNodeTree } from '../../prepared-node-tree.mjs';
import { PREPARED_NAVIGATION_MARKERS } from '../../../site/prepared-navigation-markers.mjs';
import { DEFAULT_LABEL_POLICY } from '../../../src/platform/label-field.mjs';
import { STAR_LABEL_POLICY } from '../../../src/platform/star-labels.mjs';
import { prepareCatalogueStars } from '../../../src/platform/prepare-catalogue-stars.mjs';
import { renderMarker } from '../../../src/navigation/marker-recipe.mjs';
import { prepareMaterialTracks } from '../../prepare-materials.mjs';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mjs';
import { requirePreparedResourceCatalog } from '../../object-runtime-contract.mjs';
import { prepareSunReferenceViewDirection } from '../../../src/platform/prepare-sun-view-direction.mjs';
import { BODY_POSITION_PROVENANCE, SOLAR_GEOMETRY_EPOCH_LABEL } from '../../../src/platform/solar-geometry.mjs';
import { restoreDepthSource } from '../../prepared-depth-partitions.mjs';
import { prepareTerrestrialRings } from './rings.mjs';

async function prepareSolidEpochFrame({ config, celestial }) {
  const { namespace: id, geometry } = config;
  const { BODIES } = await loadAstronomyPackage();
  const radiusKm = BODIES[id].meanRadiusKm, radius = geometry.radius;
  if (radiusKm !== geometry.radiusKm) throw new Error(`Authored physical radius differs from astronomy source: ${id}`);
  const frame = prepareEclipticPresentationFrame(id), registration = prepareAstrometricSkySceneRegistration(id);
  const sky = { ...celestial.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
    sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch };
  const source = BODY_POSITION_PROVENANCE[id];
  const sun = source ? { ...celestial.sun, localDirection: frame.sunDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId: id, ...config.geometry.camera, sceneDirection: frame.sunDirection }),
    provenance: { source: source.model, sourcePath: source.sourcePath,
      qualification: `Computed Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL} from its retained source state and canonical heliocentric parent coordinates. The surface attitude uses its separately authored rotation model.` } } : celestial.sun;
  return { camera: preparePerspectiveCamera({ sky, radius, ...geometry.camera }), sky, sun,
    systemTransform: frame.cssTransform,
    heliocentricView: prepareHeliocentricView({ bodyId: id, presentationFrame: frame,
      bodyRadiusUnits: radius, bodyRadiusKilometers: radiusKm,
      sunSprite: { imagePixels: sun.asset.density1.width,
        opaqueCoreDiameterShare: sun.distanceScaling.spriteOpaqueCoreDiameterShare },
      system: await preparePlanetarySystem({ bodyId: id, presentationFrame: frame, kilometersPerUnit: radiusKm / radius }),
    }) };
}

export async function prepareSolidScene({ config, celestial, outputDirectory, publicDirectory, radial = null }) {
  const { namespace: id, geometry } = config;
  const epoch = await prepareSolidEpochFrame({ config, celestial });
  const rings = await prepareTerrestrialRings({ config, publicDirectory });
  const scene = { camera: epoch.camera, sky: epoch.sky, sun: epoch.sun,
    ...(rings ? { rings } : {}),
    ...(radial ? { surfaceTriangles: radial.faces.map(face => face.vertices.map(v => [v[1] * BASE_TILE, v[0] * BASE_TILE, v[2] * BASE_TILE])) } : {}),
    ...(radial?.lensRanges ? { surfaceLensRanges: radial.lensRanges } : {}),
    systemTransform: epoch.systemTransform,
    bodyLeaves: radial?.leaves ?? prepareSolidBodySurface({ id, radius: geometry.radius, mapUrl: geometry.mapUrl, polesUrl: geometry.polesUrl,
      sourceWidth: config.raster.width, sourceHeight: config.raster.height,
      latitudeSegments: config.raster.bandCount, gutter: config.raster.gutter,
      poleTileSize: config.raster.poleSize }),
    heliocentricView: epoch.heliocentricView };
  await writeFile(resolve(outputDirectory, 'scene.json'), `${JSON.stringify(scene)}\n`);
  if (BODY_POSITION_PROVENANCE[id]) {
    await writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(epoch.sky)}\n`);
    await writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(epoch.sun)}\n`);
  }
  return scene;
}

/** Refresh a changed ephemeris without rebuilding source geometry or image banks.
 * The same numeric owner as full preparation updates the actual retained carrier,
 * so the physical world frame never names a basis absent from the rendered scene. */
export async function refreshSolidSceneEpoch({ config, scene, definition }) {
  // Refresh the canonical preparation branch. Generated projection carriers
  // are rebuilt by prepareObjectJson after its physical frame has changed.
  definition = restoreDepthSource(definition);
  const id = config.namespace;
  if (config.kind !== 'solid-observation-body' || definition.id !== id || !Array.isArray(scene.bodyLeaves)) {
    throw new TypeError('Epoch refresh requires its prepared solid-observation scene.');
  }
  const epoch = await prepareSolidEpochFrame({ config, celestial: { sky: scene.sky, sun: scene.sun } });
  const nodes = definition.tree.nodes;
  const carriers = nodes.map((node, index) => node.className?.split(' ').includes(`${id}-system`) ? index : -1).filter(index => index >= 0);
  if (carriers.length !== 1) throw new TypeError('Epoch refresh needs one retained physical surface carrier.');
  const carrier = nodes[carriers[0]];
  if (carrier.style !== `transform:${scene.systemTransform}` || carrier.properties.some(index => definition.tree.properties[index].name === 'transform')) {
    throw new TypeError('Epoch refresh cannot bind a carrier that differs from its prepared source scene.');
  }
  const nextScene = { ...scene, ...epoch };
  const nextDefinition = { ...definition, camera: { ...definition.camera, ...epoch.camera }, sky: epoch.sky, sun: epoch.sun,
    tree: { ...definition.tree, nodes: nodes.map((node, index) => index === carriers[0] ? { ...node, style: `transform:${epoch.systemTransform}` } : node) },
    heliocentricView: { ...definition.heliocentricView, plan: epoch.heliocentricView } };
  return { scene: nextScene, definition: nextDefinition };
}

export async function prepareSolidPresentation({ config, scene: plan, material: { surfaces, lighting }, controls, source, sourceDirectory, publicDirectory, outputDirectory }) {
  const id = config.namespace;
  let parentMarker;
  if (config.parentMarker) {
    const [entry] = await source.validateGroup(config.parentMarker.consumer);
    const png = await renderMarker({ schema: 'cssearth-navigation-marker@1', planetId: entry.bodyId,
      owner: 'object', source: entry, operations: config.parentMarker.operations },
    { sourcePath: resolve(sourceDirectory, entry.path), tileSize: config.parentMarker.tileSize });
    const filename = `${id}-parent-${entry.bodyId}.webp`;
    await sharp(png).webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 4 }).toFile(resolve(publicDirectory, filename));
    parentMarker = { id: entry.bodyId, url: `${config.publicBase}${filename}`, index: 0, count: 1, size: config.parentMarker.size };
    await writeFile(resolve(outputDirectory, 'parent-marker.json'), JSON.stringify(parentMarker));
  }
  const pointUrl = `${config.publicBase}${id}-system-point.webp`;
  const point = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.hypot(x - 15.5, y - 15.5) <= 15.5) {
    point.set([...config.presentation.pointColor, 255], (y * 32 + x) * 4);
  }
  await sharp(point, { raw: { width: 32, height: 32, channels: 4 } }).webp({ lossless: true }).toFile(resolve(publicDirectory, `${id}-system-point.webp`));
  const entries = [
    ...preparedSunResources(plan.sun, 'mounted'),
    ...(plan.rings ? [plan.rings.resource] : []),
    { key: 'lighting', url: lighting.url, pool: 'mounted' },
    { key: 'system-point', url: pointUrl, pool: 'mounted' },
    ...(parentMarker ? [{ key: 'parent-marker', url: parentMarker.url, pool: 'mounted' }] : []),
    ...surfaces.flatMap(s => [
      { key: `surface:${s.id}`, url: s.surface.url, pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
      { key: `poles:${s.id}`, url: s.polesUrl, pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
      ...(s.shadowSurface ? [{ key: `shadow:${s.id}`, url: s.shadowSurface.url, pool: 'lenses' }] : []),
    ]),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...plan.bodyLeaves, ...(plan.rings?.leaves ?? [])].map(leaf => leaf.style)) });
  const camera = b.mesh(`polycss-camera ${id}-camera planet-render-root`);
  const scene = b.mesh(`polycss-scene ${id}-scene`), system = b.mesh(`${id}-system`, `transform:${plan.systemTransform}`);
  const body = b.mesh(`${id}-body`);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) {
    const node = b.leaf(leaf);
    Object.assign(node.attributes, leaf.attributes ?? {});
    b.append(body, node);
  }
  const rings = plan.rings ? b.mesh(`${id}-rings`) : null;
  if (rings) {
    b.append(system, rings);
    for (const leaf of plan.rings.leaves) {
      const node = b.leaf(leaf);
      node.style.backgroundImage = `var(--${id}-ring-image)`;
      b.append(rings, node);
    }
  }
  const materialRoot = b.element('div', `${id}-material-root planet-render-root`);
  const billboard = b.element('s', `${id}-billboard`), material = b.element('s', `${id}-material`);
  b.append(null, materialRoot); b.append(materialRoot, billboard); b.append(materialRoot, material);
  const { tree, index } = b.finish({ camera, scene });
  const track = { id: 'lighting', target: index(material),
    frame: { source: 'sun-z', minimum: -1, maximum: 1, count: lighting.frameCount, baseFrame: 0, remap: null },
    banks: [{ id: 'atlas', frames: lighting.frames, default: null, fixed: lighting.frames.at(-1),
      rows: [{ row: 0, resource: 'lighting', firstFrame: 0, lastFrame: lighting.frameCount - 1 }] }],
    demand: { capacity: 1, defaultFrame: Math.floor(lighting.frameCount / 2) },
    rotation: { kind: 'angle', source: 'view-sun', reference: 'prepared', baseDegrees: 0,
      zeroAtPole: false, property: `--${id}-light-roll` }, frameAttribute: null, modeAttribute: null, quoted: true };
  const focus = new Map(['observations','mosaics','scientific','observedColors'].flatMap(kind =>
    (config.raster[kind]??[]).filter(lens=>lens.focus).map(lens=>[lens.id,lens.focus])));
  const variants = surfaces.flatMap(s => [false, true].flatMap(shadows => [false, true].map(orbit => ({
    ...(focus.has(s.id) ? {navigation: prepareScientificNavigation(id, focus.get(s.id), plan.camera)} : {}),
    when: { lensId: s.id, shadows, orbit }, required: [s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, `poles:${s.id}`, 'lighting', ...(rings ? ['rings'] : [])],
    writes: [
      ...(rings ? [{ kind: 'texture', target: index(rings), name: `--${id}-ring-image`, resource: 'rings', quoted: true }] : []),
      { kind: 'texture', target: index(body), name: `--${id}-surface-image`, resource: s.shadowSurface && shadows ? `shadow:${s.id}` : `surface:${s.id}`, quoted: true },
      { kind: 'texture', target: index(body), name: `--${id}-poles-image`, resource: `poles:${s.id}`, quoted: true },
      ...[...new Set(plan.bodyLeaves.map(leaf => leaf.attributes?.['data-surface-model']).filter(Boolean))].map(model => ({
        kind: 'style', target: index(body), name: `--${id}-${model}-display`,
        value: plan.bodyLeaves[plan.surfaceLensRanges.find(range => range.lensId === s.id).start].attributes['data-surface-model'] === model ? 'block' : 'none',
      })),
      { kind: 'style', target: index(materialRoot), name: `--${id}-billboard-color`, value: s.billboardColor },
      { kind: 'attribute', target: -1, name: 'data-lens', value: s.id },
      { kind: 'class', target: -1, name: `${id}-hide-orbit`, value: !orbit },
    ],
    materials: config.geometry.radialTerrain ? [] : [{ track: 'lighting', bank: 'atlas', mode: shadows ? 'frames' : 'fixed', enabled: true,
      rotationEnabled: shadows, frameOverride: null, clearWhenHidden: true, fixedMode: 'full-phase-curvature' }],
  }))));
  const atlasUrl = config.presentation.markerAtlasUrl;
  const sprite = bodyId => {
    if (bodyId === parentMarker?.id) return { url: parentMarker.url, index: 0, count: 1, size: parentMarker.size };
    const marker = PREPARED_NAVIGATION_MARKERS[bodyId];
    return marker ? { index: marker.index, count: marker.count, size: marker.presentation.size }
      : { url: pointUrl, index: 0, count: 1, size: 5 };
  };
  const { BODIES } = await loadAstronomyPackage();
  const catalogue = await prepareCatalogueStars({ fovDegrees: plan.sky.catalogueStars.exposure.fovDegrees });
  const presentation = { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.sky, sun: plan.sun,
    assets: { entries, pools: [preparedResourcePool('mounted', entries),
      ...(entries.some(entry => entry.pool === 'lenses')
        ? [preparedResourcePool('lenses', entries, { retention: 'selection', capacity: 4, concurrency: 2 })] : [])],
    startup: entries.filter(entry => entry.pool === 'mounted').map(entry => entry.key) },
    tree, variants, materials: config.geometry.radialTerrain ? [] : [track], animations: [],
    ...(plan.surfaceTriangles ? { surfaceHit: { target: index(body), triangles: plan.surfaceTriangles,
      ...(plan.surfaceLensRanges ? { lensRanges: plan.surfaceLensRanges } : {}),
      // XYZ source coordinates swap X/Y for CSS: outward faces are clockwise.
      ...(config.geometry.radialTerrain?.sourceTopology === 'open' ? { frontFace: 'clockwise' } : {}) } } : {}),
    heliocentricView: { plan: plan.heliocentricView,
      bodyMarker: { url: atlasUrl, ...sprite(id), size: 3 },
      systemMarkers: { url: atlasUrl, sun: sprite('sun'),
        bodies: Object.fromEntries(plan.heliocentricView.system.bodies.map(body => [body.id, sprite(body.id)])),
        phase: { url: lighting.url, columns: lighting.columns, rowCount: lighting.rowCount,
          frameCount: lighting.frameCount, minimumLightViewZ: -1, maximumLightViewZ: 1, baseLightAzimuthDegrees: 0 } },
      labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: Object.fromEntries(Object.entries(BODIES).map(([bodyId, body]) => [bodyId, body.name])),
        stars: { policy: { ...STAR_LABEL_POLICY }, exposure: { ...catalogue.exposure }, records: catalogue.stars.flatMap((star, i) =>
          star.name ? [{ id: `star:${i}`, hip: star.hip, name: star.name, direction: star.direction, magnitude: star.magnitude }] : []) } },
    },
    viewBindings: [
      { kind: 'silhouette-fit', target: index(materialRoot), minimumRadius: 1.5, unitScale: 2 / plan.camera.logicalBodyDiameter },
      { kind: 'view-attribute', target: -1, property: 'data-lod', source: 'level-of-detail-stage', precision: null },
      { kind: 'view-property', target: index(materialRoot), property: `--${id}-billboard-opacity`, source: 'billboard-opacity', precision: 6 },
    ],
  };
  const prepared = { ...presentation, materials: prepareMaterialTracks(presentation) };
  requirePreparedPresentation(prepared, { controls });
  requirePreparedResourceCatalog(prepared.assets);
  return { ...prepared, schema: 'cssearth-object-runtime@4', id, controls };
}
