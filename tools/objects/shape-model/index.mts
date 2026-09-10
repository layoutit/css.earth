import type {AuthoredObjectDescriptor} from '@cssearth/objects';
import type {Polygon,Vec3} from '@layoutit/polycss';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import type {ShapeModelConfig} from './source.mts';
import {parseShapeModelConfig,parseShapeContent} from './source.mts';
import {requireRecord,requireString} from '../../source-values.mts';
import {requireObjectRuntimeDefinition} from '../../object-runtime-contract.mts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
interface ShapeContext {descriptor:AuthoredObjectDescriptor;sources:ReadonlyMap<string,{value:unknown}>;objectDirectory:string;publicDirectory:string;outputDirectory:string;prepareContent:typeof prepareObjectContentAssets;}
import sharp from 'sharp';
import { lambertAttenuationAtlas } from '../terrestrial-layers/solid-raster.mts';
import { DEFAULT_LABEL_POLICY } from '../../../src/platform/label-field.mts';
import { loadAstronomyPackage } from '../../../src/platform/astronomy-package.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRingLeaves } from './rings.mts';
export { prepareRingLeaves } from './rings.mts';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareSolidBodySurface } from '../../../src/platform/prepare-solid-body-surface.mts';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { prepareAstrometricCubeSampling } from '../../../src/platform/astrometric-sky-registration.mts';
import { prepareCatalogueStars } from '../../../src/platform/prepare-catalogue-stars.mts';
import { prepareSolarSystemScene, prepareSolarSystemSunPresentation } from '../solar-system-scene.mts';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mts';
import { preparedSunResources, preparedResourcePool } from '../../../src/platform/prepared-object-assets.mts';
import { createPreparedNodeTree } from '../../prepared-node-tree.mts';
import { prepareCssomDeclarationReads } from '../../prepared-cssom.mts';
import { prepareModelMarker, prepareModelRasters, prepareRingRaster, prepareSphereLighting } from './raster.mts';
import { prepareShapeLighting } from './lighting.mts';
import { prepareCoplanarColorRaster } from '../material-composition/coplanar-raster.mts';

const writeJson = (dir:string, name:string, data:unknown) => writeFile(resolve(dir, name + '.json'), JSON.stringify(data) + '\n');

/** Observational shape parameters, prepared through the same retained object runtime. */
export async function prepareShapeModel({ descriptor, sources, objectDirectory, publicDirectory, outputDirectory, prepareContent }:ShapeContext) {
  const config = parseShapeModelConfig(sources.get('shape-model')?.value), id = descriptor.id, shape = descriptor.recipe.shape;
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
  const lenses = parseShapeContent(sources.get('content')?.value).lenses.controls;
  const declaredLenses = descriptor.recipe.surfaces.flatMap(surface => surface.lenses);
  if (lenses.length > 1 || lenses.length !== declaredLenses.length ||
      lenses.some(lens => lens.id !== declaredLenses[0].id || lens.thumbnail !== `${lens.id}-thumbnail.webp`)) {
    throw new TypeError('A shape model exposes its one base-color surface through the authored lens contract.');
  }
  const lens = lenses[0];
  const source = await createSourceManifest({ planetId: id, planetName: config.displayName, sourceRoot: sourceDirectory });
  await source.verify();
  await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(publicDirectory, { recursive: true })]);
  const modelRasters = await prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory, lensId: lens?.id });
  const {map,source:modelSource}=modelRasters, textures:Record<string,string>=modelRasters.textures;
  if (lens) {
    await writeJson(outputDirectory, 'assets', { surfaces: { [lens.id]: {
      url: textures.surface, url2x: textures.surface, polesUrl: textures.poles, polesUrl2x: textures.poles,
    } } });
    const input = source.manifest.inputs.find(input => input.id === lens.source.id);
    if(!input)throw new TypeError(`Source manifest lacks shape texture ${lens.source.id}`);
    await writeJson(outputDirectory, 'surfaces', { objectId: id, surfaces: [{ id: lens.id, map,
      attribution: { label: input.credit, url: lens.source.url ?? input.origin },
    }] });
  }
  textures.lighting = await prepareSphereLighting({ publicDirectory, publicBase });
  await writeFile(resolve(publicDirectory, 'marker.webp'), await prepareModelMarker(axes));
  const ringTexture = config.ring ? await prepareRingRaster({ config, publicDirectory, publicBase }) : null;
  const skySource = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'stars/hyg-v41-field.json'), 'utf8')));
  const sky = await preparePlanetCubicSky({ objectId: id, sourceRoot: sourceDirectory, publicRoot: publicDirectory,
    ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), validateSourceGroup: group => source.validateGroup(group),
    includeSun: false, writeModule: false, sourceSchema: requireString(skySource.schema),
    cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
    astrometricSampling: prepareAstrometricCubeSampling(),
    catalogueStars: await prepareCatalogueStars({ fovDegrees: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees }) });
  const cameraOptions = { bodyId: id, displayName: config.displayName, ...config.camera };
  const rotation=sources.get('rotation');
  const observedPole = rotation && requireRecord(rotation.value).schema === 'cssearth-observed-pole@1';
  const sunPresentation = { ...prepareSolarSystemSunPresentation(cameraOptions), source: `JPL Kepler orbit and ${observedPole ? 'authored observed pole' : 'arbitrary display orientation'}; arbitrary display phase`,
    qualification: 'Sun direction is computed at the shared prepared epoch. The surface longitude origin is an arbitrary display phase, not a measured rotational ephemeris.' };
  const sun = await preparePlanetDirectionalSun({ objectId: id, publicRoot: publicDirectory,
    ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), meanHeliocentricDistanceAu: config.distanceAu,
    presentation: sunPresentation, writeModule: false });
  const astronomy=await loadAstronomyPackage();
  const bodyId=(Object.keys(astronomy.BODIES) as Array<keyof typeof astronomy.BODIES>).find(key=>key===id);
  if(!bodyId)throw new TypeError(`Shape model has no astronomical body ${id}`);
  const scene = await prepareSolarSystemScene({ ...cameraOptions, bodyId, bodyRadiusUnits: config.displayRadius,
    bodyRadiusKilometers: axes[0], defaultZoom: .75, geometryScale: 1, starfield: {...validatePreparedCubicSky(sky,{requireSun:false}),astrometricRegistration:Object.assign({},requireRecord(requireRecord(sky).astrometricRegistration),{cubeFrame:requireString(requireRecord(requireRecord(sky).astrometricRegistration).cubeFrame)})}, sun });
  const bodyLeaves = prepareSolidBodySurface({ id, radius: config.displayRadius,
    secondaryRadius: config.displayRadius * axes[1] / axes[0], polarRadius: config.displayRadius * axes[2] / axes[0],
    mapUrl: textures.surface, polesUrl: textures.poles, latitudeSegments, longitudeSegments,
    sourceWidth: width, sourceHeight: height, poleTileSize: poleSize, seamOverlap: config.mesh.seamOverlap });
  const ringFaces:Parameters<typeof prepareCoplanarColorRaster>[0]["faces"][number][] = [];
  const ringConfig=config.ring;
  const sourceRingLeaves = ringTexture && ringConfig ? prepareRingLeaves(config, ringTexture, axes[0], geometry => {
    const m = geometry.matrix.split(',').map(Number);
    const vertices = [[0,0],[geometry.leafWidth,0],[geometry.leafWidth,geometry.leafHeight],[0,geometry.leafHeight]].map(([x,y]) => {
      const w = m[3]*x + m[7]*y + m[15];
      const at=(axis:number)=>(m[axis]*x+m[4+axis]*y+m[12+axis])/w;return [at(0),at(1),at(2)] as [number,number,number];
    });
    ringFaces.push({ vertices, color: [ringConfig.displayValue, ringConfig.displayValue, ringConfig.displayValue,
      Math.round(ringConfig.displayOpacity * 255)] });
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
  const names: Record<string, string> = Object.fromEntries(Object.entries(BODIES).map(([key, body]) => [key, body.name]));
  const marker = (name: string) => ({ url: `/navigation/body-${name}.webp`, index: 0, count: 1, size: 5 });
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
  if (material && materialRoot) { b.append(null, materialRoot); b.append(materialRoot, material); }
  const shapeLighting = !sphereLighting ? prepareShapeLighting({ builder: b, root, axes, config, scene }) : null;
  const materialReference = shapeLighting ? {
    materialReferenceControlPitchDegrees: scene.camera.defaultControlPitchDegrees,
    materialReferenceControlYawDegrees: scene.camera.defaultControlYawDegrees,
  } : {};
  const { tree, index } = b.finish({ camera, scene: root });
  if(!scene.heliocentricView.system)throw new TypeError("Shape presentation requires its prepared system.");
  function requiredMaterialRoot(){if(!materialRoot)throw new TypeError("Shape silhouette lacks its material root.");return materialRoot;}
  const definition = requireObjectRuntimeDefinition(JSON.parse(JSON.stringify({ schema: 'cssearth-object-runtime@4', id, camera: { ...scene.camera, ...materialReference, responsiveFit: { ...scene.camera.responsiveFit, maximumHeightShare: config.camera.maximumHeightShare } }, sky: scene.starfield, sun,
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
      [{ kind: 'silhouette-fit', target: index(requiredMaterialRoot()), minimumRadius: 1.5, unitScale: 2 / scene.camera.logicalBodyDiameter }],
    heliocentricView: { plan: scene.heliocentricView,
      bodyMarker: { url: publicBase + 'marker.webp', index: 0, count: 1, size: 3 },
      systemMarkers: { url: '/navigation/body-sun.webp', sun: marker('sun'), bodies: Object.fromEntries(scene.heliocentricView.system.bodies.map(body => [body.id, marker(body.id)])),
        phase: { url: publicBase + 'marker-phase.webp', columns: 4, rowCount: 8, frameCount: 32, minimumLightViewZ: -1, maximumLightViewZ: 1, baseLightAzimuthDegrees: 0 } },
      labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: Object.fromEntries([...new Set([id, 'sun', ...scene.heliocentricView.system.bodies.map(body => body.id)])].map(key => [key, names[key]])) } },
  })));
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
