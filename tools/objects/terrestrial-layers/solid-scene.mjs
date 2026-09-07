import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
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

export async function prepareSolidScene({ config, celestial, outputDirectory }) {
  const { namespace: id, geometry } = config;
  const { BODIES } = await loadAstronomyPackage();
  const radiusKm = BODIES[id].meanRadiusKm, radius = geometry.radius;
  if (radiusKm !== geometry.radiusKm) throw new Error(`Authored physical radius differs from astronomy source: ${id}`);
  const frame = prepareEclipticPresentationFrame(id), registration = prepareAstrometricSkySceneRegistration(id);
  const sky = { ...celestial.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: registration.cssTransform, sceneRegistrationModel: registration.model,
    sceneRegistrationChain: registration.chain, sceneRegistrationEpoch: registration.epoch };
  const sun = celestial.sun;
  const scene = {
    camera: preparePerspectiveCamera({ sky, radius, ...geometry.camera }), sky, sun,
    systemTransform: frame.cssTransform,
    bodyLeaves: prepareSolidBodySurface({ id, radius, mapUrl: geometry.mapUrl, polesUrl: geometry.polesUrl,
      sourceWidth: config.raster.width, sourceHeight: config.raster.height,
      latitudeSegments: config.raster.bandCount, gutter: config.raster.gutter,
      poleTileSize: config.raster.poleSize }),
    heliocentricView: prepareHeliocentricView({ bodyId: id, presentationFrame: frame,
      bodyRadiusUnits: radius, bodyRadiusKilometers: radiusKm,
      sunSprite: { imagePixels: sun.asset.density1.width,
        opaqueCoreDiameterShare: sun.distanceScaling.spriteOpaqueCoreDiameterShare },
      system: await preparePlanetarySystem({ bodyId: id, presentationFrame: frame, kilometersPerUnit: radiusKm / radius }),
    }),
  };
  await writeFile(resolve(outputDirectory, 'scene.json'), `${JSON.stringify(scene)}\n`);
  return scene;
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
    { key: 'lighting', url: lighting.url, pool: 'mounted' },
    { key: 'system-point', url: pointUrl, pool: 'mounted' },
    ...(parentMarker ? [{ key: 'parent-marker', url: parentMarker.url, pool: 'mounted' }] : []),
    ...surfaces.flatMap(s => [
      { key: `surface:${s.id}`, url: s.surface.url, pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
      { key: `poles:${s.id}`, url: s.polesUrl, pool: s.id === config.presentation.defaultLens ? 'mounted' : 'lenses' },
    ]),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.bodyLeaves.map(leaf => leaf.style)) });
  const camera = b.mesh(`polycss-camera ${id}-camera planet-render-root`);
  const scene = b.mesh(`polycss-scene ${id}-scene`), system = b.mesh(`${id}-system`, `transform:${plan.systemTransform}`);
  const body = b.mesh(`${id}-body`);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) b.append(body, b.leaf(leaf));
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
  const variants = surfaces.flatMap(s => [false, true].flatMap(shadows => [false, true].map(orbit => ({
    when: { lensId: s.id, shadows, orbit }, required: [`surface:${s.id}`, `poles:${s.id}`, 'lighting'],
    writes: [
      { kind: 'texture', target: index(body), name: `--${id}-surface-image`, resource: `surface:${s.id}`, quoted: true },
      { kind: 'texture', target: index(body), name: `--${id}-poles-image`, resource: `poles:${s.id}`, quoted: true },
      { kind: 'style', target: index(materialRoot), name: `--${id}-billboard-color`, value: s.billboardColor },
      { kind: 'attribute', target: -1, name: 'data-lens', value: s.id },
      { kind: 'class', target: -1, name: `${id}-hide-orbit`, value: !orbit },
    ],
    materials: [{ track: 'lighting', bank: 'atlas', mode: shadows ? 'frames' : 'fixed', enabled: true,
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
    tree, variants, materials: [track], animations: [],
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
