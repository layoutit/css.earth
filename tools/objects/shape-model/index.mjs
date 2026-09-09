import sharp from 'sharp';
import { lambertAttenuationAtlas } from '../terrestrial-layers/solid-raster.mjs';
import { PREPARED_NAVIGATION_MARKERS } from '../../../site/prepared-navigation-markers.mjs';
import { DEFAULT_LABEL_POLICY } from '../../../src/platform/label-field.mjs';
import { loadAstronomyPackage } from '../../../src/platform/astronomy-package.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import { createSourceManifest } from '../../../src/platform/source-manifest.mjs';
import { prepareSolidBodySurface } from '../../../src/platform/prepare-solid-body-surface.mjs';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mjs';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mjs';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mjs';
import { prepareAstrometricCubeSampling } from '../../../src/platform/astrometric-sky-registration.mjs';
import { prepareCatalogueStars } from '../../../src/platform/prepare-catalogue-stars.mjs';
import { prepareSolarSystemScene, prepareSolarSystemSunPresentation } from '../solar-system-scene.mjs';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mjs';
import { preparedSunResources, preparedResourcePool } from '../../../src/platform/prepared-object-assets.mjs';
import { createPreparedNodeTree } from '../../prepared-node-tree.mjs';
import { prepareCssomDeclarationReads } from '../../prepared-cssom.mjs';
import { prepareModelMarker, prepareModelRasters, prepareRingRaster, prepareSphereLighting } from './raster.mjs';
import { prepareShapeLighting } from './lighting.mjs';
import { prepareCoplanarColorRaster } from '../material-composition/coplanar-raster.mjs';

const writeJson = (dir, name, data) => writeFile(resolve(dir, name + '.json'), JSON.stringify(data) + '\n');

/** Observational shape parameters, prepared through the same retained object runtime. */
export async function prepareShapeModel({ descriptor, sources, objectDirectory, publicDirectory, outputDirectory, prepareContent }) {
  const config = sources.get('shape-model').value, id = descriptor.id, shape = descriptor.recipe.shape;
  if (config.schema !== 'cssearth-shape-model@1' || !['sphere', 'ellipsoid'].includes(shape.kind)) throw new TypeError('Expected a spherical or ellipsoidal shape model.');
  const axes = [shape.radiusKm, shape.secondaryRadiusKm ?? shape.radiusKm, shape.polarRadiusKm ?? shape.radiusKm];
  const { latitudeSegments, longitudeSegments, width, height, poleSize } = config.mesh;
  const ringSegments = config.ring?.segments ?? 0;
  const sphereLighting = shape.kind === 'sphere' && !config.ring;
  const quadCount = (latitudeSegments - 2) * longitudeSegments + 4 + ringSegments + 1;
  if (![latitudeSegments, longitudeSegments, width, height, poleSize, config.quadBudget].every(n => Number.isInteger(n) && n > 0) ||
      latitudeSegments < 4 || longitudeSegments < 4 || !!config.ring !== !!descriptor.recipe.rings ||
      width % longitudeSegments || height % latitudeSegments || quadCount > config.quadBudget || quadCount > 2000 ||
      (config.ring && (!Number.isInteger(ringSegments) || ringSegments < 3 ||
        config.ring.innerRadiusKm <= axes[0] || config.ring.outerRadiusKm <= config.ring.innerRadiusKm))) throw new TypeError('Invalid shape tessellation, ring, or quad budget.');
  const sourceDirectory = resolve(objectDirectory, 'source'), publicBase = `/scenes/${id}/`;
  const lenses = sources.get('content').value.lenses.controls;
  const declaredLenses = descriptor.recipe.surfaces.flatMap(surface => surface.lenses);
  if (lenses.length > 1 || lenses.length !== declaredLenses.length ||
      lenses.some(lens => lens.id !== declaredLenses[0].id || lens.thumbnail !== `${lens.id}-thumbnail.webp`)) {
    throw new TypeError('A shape model exposes its one base-color surface through the authored lens contract.');
  }
  const lens = lenses[0];
  const source = await createSourceManifest({ planetId: id, planetName: config.displayName, sourceRoot: sourceDirectory });
  await source.verify();
  await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(publicDirectory, { recursive: true })]);
  const { textures, map, source: modelSource } = await prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory, lensId: lens?.id });
  if (lens) {
    await writeJson(outputDirectory, 'assets', { surfaces: { [lens.id]: {
      url: textures.surface, url2x: textures.surface, polesUrl: textures.poles, polesUrl2x: textures.poles,
    } } });
    const manifest = JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8'));
    const input = manifest.inputs.find(input => input.id === lens.source.id);
    await writeJson(outputDirectory, 'surfaces', { objectId: id, surfaces: [{ id: lens.id, map,
      attribution: { label: input.credit, url: lens.source.url ?? input.origin },
    }] });
  }
  textures.lighting = await prepareSphereLighting({ publicDirectory, publicBase });
  await writeFile(resolve(publicDirectory, 'marker.webp'), await prepareModelMarker(axes));
  const ringTexture = config.ring ? await prepareRingRaster({ config, publicDirectory, publicBase }) : null;
  const skySource = JSON.parse(await readFile(resolve(sourceDirectory, 'stars/hyg-v41-field.json'), 'utf8'));
  const sky = await preparePlanetCubicSky({ objectId: id, sourceRoot: sourceDirectory, publicRoot: publicDirectory,
    ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), validateSourceGroup: group => source.validateGroup(group),
    includeSun: false, writeModule: false, sourceSchema: skySource.schema,
    cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
    astrometricSampling: prepareAstrometricCubeSampling(),
    catalogueStars: await prepareCatalogueStars({ fovDegrees: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees }) });
  const cameraOptions = { bodyId: id, displayName: config.displayName, ...config.camera };
  const observedPole = sources.get('rotation')?.value.schema === 'cssearth-observed-pole@1';
  const sunPresentation = { ...prepareSolarSystemSunPresentation(cameraOptions), source: `JPL Kepler orbit and ${observedPole ? 'authored observed pole' : 'arbitrary display orientation'}; arbitrary display phase`,
    qualification: 'Sun direction is computed at the shared prepared epoch. The surface longitude origin is an arbitrary display phase, not a measured rotational ephemeris.' };
  const sun = await preparePlanetDirectionalSun({ objectId: id, publicRoot: publicDirectory,
    ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), meanHeliocentricDistanceAu: config.distanceAu,
    presentation: sunPresentation, writeModule: false });
  const scene = await prepareSolarSystemScene({ ...cameraOptions, bodyRadiusUnits: config.displayRadius,
    bodyRadiusKilometers: axes[0], defaultZoom: .75, geometryScale: 1, starfield: sky, sun });
  const bodyLeaves = prepareSolidBodySurface({ id, radius: config.displayRadius,
    secondaryRadius: config.displayRadius * axes[1] / axes[0], polarRadius: config.displayRadius * axes[2] / axes[0],
    mapUrl: textures.surface, polesUrl: textures.poles, latitudeSegments, longitudeSegments,
    sourceWidth: width, sourceHeight: height, poleTileSize: poleSize, seamOverlap: config.mesh.seamOverlap });
  const ringFaces = [];
  const sourceRingLeaves = ringTexture ? prepareRingLeaves(config, ringTexture, axes[0], geometry => {
    const m = geometry.matrix.split(',').map(Number);
    const vertices = [[0,0],[geometry.leafWidth,0],[geometry.leafWidth,geometry.leafHeight],[0,geometry.leafHeight]].map(([x,y]) => {
      const w = m[3]*x + m[7]*y + m[15];
      return [0,1,2].map(axis => (m[axis]*x + m[4+axis]*y + m[12+axis])/w);
    });
    ringFaces.push({ vertices, color: [config.ring.displayValue, config.ring.displayValue, config.ring.displayValue,
      Math.round(config.ring.displayOpacity * 255)] });
  }) : [];
  const ringRaster = ringTexture ? await prepareCoplanarColorRaster({ faces: ringFaces,
    pixelsPerUnit: ringTexture.width / (2 * Math.max(...ringFaces.flatMap(face => face.vertices.flatMap(v => [Math.abs(v[0]),Math.abs(v[1])])))) }) : null;
  const ringLeaves = ringRaster ? ringRaster.tiles.map(tile => ({ tag: 's', className: 'shape-model-ring-quad',
    style: `transform:matrix3d(${tile.matrix.join(',')});backface-visibility:visible;--polycss-atlas-width:${tile.width}px;` +
      `--polycss-atlas-height:${tile.height}px;background-position:${-tile.x}px ${-tile.y}px;` +
      `background-size:${ringRaster.width}px ${ringRaster.height}px;background-repeat:no-repeat` })) : [];
  if (ringRaster) await writeFile(resolve(publicDirectory, 'ring.webp'), ringRaster.bytes);
  const preparedContent = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const phase = lambertAttenuationAtlas({ frameSize: 32, columns: 4, frameCount: 32, terminatorWidth: .1, directionalAmbient: .05, fullPhaseAmbient: .35, fullPhaseDiffuse: .65, maximumOpacity: .95 });
  await sharp(phase.pixels, { raw: { width: phase.width, height: phase.height, channels: 4 } }).webp({ lossless: true }).toFile(resolve(publicDirectory, 'marker-phase.webp'));
  const { BODIES } = await loadAstronomyPackage();
  const marker = name => PREPARED_NAVIGATION_MARKERS[name] ? { index: PREPARED_NAVIGATION_MARKERS[name].index, count: PREPARED_NAVIGATION_MARKERS[name].count, size: 5 } : { url: publicBase + 'marker.webp', index: 0, count: 1, size: 5 };
  const entries = [{ key: 'marker-phase', url: publicBase + 'marker-phase.webp', pool: 'mounted' }, ...preparedSunResources(sun, 'mounted'), ...Object.entries(textures).map(([key, url]) => ({ key, url, pool: 'mounted' })),
    ...(ringTexture ? [{ key: 'ring', url: ringTexture.url, pool: 'mounted' }] : []), { key: 'marker', url: publicBase + 'marker.webp', pool: 'mounted' }];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...bodyLeaves, ...ringLeaves].map(leaf => leaf.style)) });
  const camera = b.mesh(`polycss-camera shape-model-camera ${id}-camera planet-render-root`), root = b.mesh('polycss-scene');
  const system = b.mesh('shape-model-system', `transform:${scene.systemTransform}`), body = b.mesh('shape-model-body');
  const ring = ringTexture ? b.mesh('shape-model-ring') : null;
  b.append(null, camera); b.append(camera, root); b.append(root, system); b.append(system, body);
  if (ring) b.append(system, ring);
  for (const leaf of bodyLeaves) {
    const node = b.leaf(leaf);
    node.style.backgroundImage = `var(--shape-${leaf.polar ? 'poles' : 'surface'})`;
    b.append(body, node);
  }
  for (const leaf of ringLeaves) { const node = b.leaf(leaf); node.style.backgroundImage = 'var(--shape-ring)'; b.append(ring, node); }
  const materialRoot = sphereLighting ? b.element('div', 'shape-model-material-root planet-render-root') : null;
  const material = sphereLighting ? b.element('s', 'shape-model-material',
    `width:${scene.camera.logicalBodyDiameter}px;height:${scene.camera.logicalBodyDiameter}px;margin:${-scene.camera.logicalBodyDiameter / 2}px 0 0 ${-scene.camera.logicalBodyDiameter / 2}px`) : null;
  if (material) { b.append(null, materialRoot); b.append(materialRoot, material); }
  const shapeLighting = !sphereLighting ? prepareShapeLighting({ builder: b, root, axes, config, scene }) : null;
  const materialReference = shapeLighting ? {
    materialReferenceControlPitchDegrees: scene.camera.defaultControlPitchDegrees,
    materialReferenceControlYawDegrees: scene.camera.defaultControlYawDegrees,
  } : {};
  const { tree, index } = b.finish({ camera, scene: root });
  const definition = JSON.parse(JSON.stringify({ schema: 'cssearth-object-runtime@4', id, camera: { ...scene.camera, ...materialReference, responsiveFit: { ...scene.camera.responsiveFit, maximumHeightShare: config.camera.maximumHeightShare } }, sky: scene.starfield, sun,
    controls: preparedContent.controls, tree,
    assets: { entries, pools: [preparedResourcePool('mounted', entries)], startup: entries.map(entry => entry.key) },
    variants: [{ when: lens ? { lensId: lens.id } : {}, required: ['surface', 'poles', 'lighting', ...(ringTexture ? ['ring'] : [])], writes: [
      { kind: 'texture', target: index(body), name: '--shape-surface', resource: 'surface', quoted: true },
      { kind: 'texture', target: index(body), name: '--shape-poles', resource: 'poles', quoted: true },
      ...(material ? [{ kind: 'texture', target: index(material), name: '--shape-lighting', resource: 'lighting', quoted: true }] : []),
      ...(ring ? [{ kind: 'texture', target: index(ring), name: '--shape-ring', resource: 'ring', quoted: true }] : []),
    ], materials: shapeLighting ? [shapeLighting.selection] : [] }],
    materials: shapeLighting ? [shapeLighting.track(index(shapeLighting.leaf))] : [], animations: [],
    viewBindings: shapeLighting ? [shapeLighting.binding(index(shapeLighting.counter))] :
      [{ kind: 'silhouette-fit', target: index(materialRoot), minimumRadius: 1.5, unitScale: 2 / scene.camera.logicalBodyDiameter }],
    heliocentricView: { plan: scene.heliocentricView,
      bodyMarker: { url: publicBase + 'marker.webp', index: 0, count: 1, size: 3 },
      systemMarkers: { url: '/navigation/planet-markers.webp', sun: marker('sun'), bodies: Object.fromEntries(scene.heliocentricView.system.bodies.map(body => [body.id, marker(body.id)])),
        phase: { url: publicBase + 'marker-phase.webp', columns: 4, rowCount: 8, frameCount: 32, minimumLightViewZ: -1, maximumLightViewZ: 1, baseLightAzimuthDegrees: 0 } },
      labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: Object.fromEntries(Object.entries(BODIES).map(([key, value]) => [key, value.name])) } },
  }));
  const { id: _id, controls: _controls, ...presentation } = definition;
  requirePreparedPresentation({ ...presentation, schema: 'cssearth-prepared-presentation@3' }, { controls: preparedContent.controls });
  const geometry = { ...scene, bodyLeaves, ringLeaves,
    ...(ringRaster ? { ringCoverage: { sourceFaceCount: sourceRingLeaves.length, preparedTileCount: ringLeaves.length,
      width: ringRaster.width, height: ringRaster.height, sourceFaces: ringFaces } } : {}),
    counts: { bodyQuads: bodyLeaves.length, ringQuads: ringLeaves.length, lightingQuads: 1, totalQuads: bodyLeaves.length + ringLeaves.length + 1, budget: config.quadBudget },
    model: { semiAxesKm: axes, ...(config.ring ? { ring: config.ring } : {}), surface: 'NASA VTAD illustrative model texture; no observed terrain', modelSource, phase: 'arbitrary-display-phase', lighting: sphereLighting ? 'prepared full-phase curvature lighting fitted to the projected sphere; no directional Sun shadows' : 'prepared illustrative full-phase curvature fitted to the projected shape; no directional Sun shadows' } };
  await Promise.all([writeJson(outputDirectory, 'scene', geometry), writeJson(outputDirectory, 'runtime', definition),
    writeJson(outputDirectory, 'sky', scene.starfield), writeJson(outputDirectory, 'sun', sun)]);
  return { scene: geometry, definition, content: preparedContent.content };
}

export function prepareRingLeaves(config, texture, majorRadiusKm, onGeometry) {
  const { segments, innerRadiusKm, outerRadiusKm } = config.ring, scale = config.displayRadius / majorRadiusKm;
  const point = (radius, angle) => [radius * scale * Math.cos(angle), radius * scale * Math.sin(angle), 0];
  return Array.from({ length: segments }, (_, i) => {
    const a = i / segments * 2 * Math.PI, z = (i + 1) / segments * 2 * Math.PI;
    const polygon = { vertices: [point(innerRadiusKm, a), point(innerRadiusKm, z), point(outerRadiusKm, z), point(outerRadiusKm, a)],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: texture.url, color: '#777777',
      textureImageSource: { ...texture, sourceRect: { x: i * texture.width / segments, y: 0, width: texture.width / segments, height: texture.height } },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } };
    const plan = computeTextureAtlasPlanPublic(polygon, i, { tileSize: 50, layerElevation: 50, textureLighting: 'baked', seamBleed: 0 });
    const g = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!g) throw new TypeError(`Ring quad ${i} could not be prepared.`);
    onGeometry?.(g);
    return { tag: 's', className: 'shape-model-ring-quad', style: `transform:matrix3d(${g.matrix});backface-visibility:visible;--polycss-atlas-width:${g.leafWidth}px;--polycss-atlas-height:${g.leafHeight}px;background-image:url("${texture.url}");background-position:${g.backgroundPosition.map(x => `${x}px`).join(' ')};background-size:${g.backgroundSize.map(x => `${x}px`).join(' ')};background-repeat:no-repeat` };
  });
}
