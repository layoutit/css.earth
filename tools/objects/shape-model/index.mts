import type { AuthoredObjectDescriptor } from '@cssearth/objects';
import type { prepareObjectContentAssets } from '../content/prepare.ts';
import { parseShapeModelConfig, parseShapeContent } from './source.mts';
import { requireRecord, requireString } from '@cssearth/core';
import { requireObjectRuntimeDefinition } from '../../contract/object-runtime-contract.mts';
import { loadAstronomyPackage } from '../../../src/platform/astronomy-package.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRingLeaves } from './rings.mts';
interface ShapeContext {descriptor:AuthoredObjectDescriptor;sources:ReadonlyMap<string,{value:unknown}>;objectDirectory:string;publicDirectory:string;outputDirectory:string;prepareContent:typeof prepareObjectContentAssets;}

import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { prepareSolidBodySurface } from '../../../src/platform/prepare-solid-body-surface.mts';
import { prepareCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { prepareDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { prepareSolarSystemScene, prepareSolarSystemSunPresentation } from '../solar-system-scene.mts';
import { requirePreparedPresentation } from '../../../src/platform/prepared-presentation-contract.mts';
import { preparedResourcePool } from '../../../src/platform/prepared-object-assets.mts';
import { createPreparedNodeTree } from '../../prepared/prepared-node-tree.mts';
import { prepareCssomDeclarationReads } from '../../prepared/prepared-cssom.mts';
import { prepareModelRasters, prepareRingRaster, prepareSphereLighting } from './raster.mts';
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
  if (!lenses.length || lenses.map(lens => lens.id).join() !== declaredLenses.map(lens => lens.id).join() ||
      lenses.some(lens => lens.thumbnail !== `${lens.id}-thumbnail.webp`)) {
    throw new TypeError('A shape model exposes each authored lens surface through the authored lens contract.');
  }
  const defaultLens = requireString(requireRecord(requireRecord(sources.get('content')?.value).lenses).defaultLens);
  if (!lenses.some(lens => lens.id === defaultLens)) throw new TypeError(`Shape model default lens ${defaultLens} is not authored.`);
  const source = await createSourceManifest({ objectId: id, objectName: config.displayName, sourceRoot: sourceDirectory });
  await source.verify();
  await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(publicDirectory, { recursive: true })]);
  const modelLenses = await prepareModelRasters({ config, axes, publicDirectory, publicBase, sourceDirectory, lensIds: lenses.map(lens => lens.id),
    readSource: async path => { await source.validatePath(path); return readFile(resolve(sourceDirectory, path)); } });
  await writeJson(outputDirectory, 'assets', { surfaces: Object.fromEntries(modelLenses.map(({ id, textures }) => [id, {
    url: textures.surface, url2x: textures.surface, polesUrl: textures.poles, polesUrl2x: textures.poles,
  }])) });
  await writeJson(outputDirectory, 'surfaces', { objectId: id, surfaces: lenses.map((lens, index) => {
    const input = source.manifest.inputs.find(input => input.id === lens.source.id);
    if(!input)throw new TypeError(`Source manifest lacks shape texture ${lens.source.id}`);
    return { id: lens.id, map: modelLenses[index]!.map, attribution: { label: input.credit, url: lens.source.url ?? input.origin } };
  }) });
  const initial = modelLenses.find(lens => lens.id === defaultLens)!;
  const lightingUrl = await prepareSphereLighting({ publicDirectory, publicBase });
  const ringTexture = config.ring ? await prepareRingRaster({ config, publicDirectory, publicBase }) : null;
  const sky = prepareCubicSky({ objectId: id, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD });
  const cameraOptions = { bodyId: id, displayName: config.displayName };
  const rotation=sources.get('rotation');
  const observedPole = rotation && requireRecord(rotation.value).schema === 'cssearth-observed-pole@1';
  const sunPresentation = { ...prepareSolarSystemSunPresentation(cameraOptions), source: `JPL Kepler orbit and ${observedPole ? 'authored observed pole' : 'arbitrary display orientation'}; arbitrary display phase`,
    qualification: 'Sun direction is computed at the shared prepared epoch. The surface longitude origin is an arbitrary display phase, not a measured rotational ephemeris.' };
  const sun = prepareDirectionalSun({ presentation: sunPresentation });
  const astronomy=await loadAstronomyPackage();
  const bodyId=(Object.keys(astronomy.BODIES) as Array<keyof typeof astronomy.BODIES>).find(key=>key===id);
  if(!bodyId)throw new TypeError(`Shape model has no astronomical body ${id}`);
  const scene = await prepareSolarSystemScene({ ...cameraOptions, bodyId, bodyRadiusUnits: config.displayRadius,
    bodyRadiusKilometers: axes[0], defaultZoom: .75, geometryScale: 1, starfield: sky });
  const bodyLeaves = prepareSolidBodySurface({ id, radius: config.displayRadius,
    secondaryRadius: config.displayRadius * axes[1] / axes[0], polarRadius: config.displayRadius * axes[2] / axes[0],
    mapUrl: initial.textures.surface, polesUrl: initial.textures.poles, latitudeSegments, longitudeSegments,
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
  // The default lens mounts with the body; another lens decodes only when it is selected.
  const entries = [...modelLenses.flatMap(lens => (['surface', 'poles'] as const).map(kind =>
      ({ key: `${kind}:${lens.id}`, url: lens.textures[kind], pool: lens.id === defaultLens ? 'mounted' : 'lenses' }))),
    { key: 'lighting', url: lightingUrl, pool: 'mounted' },
    ...(ringTexture ? [{ key: 'ring', url: ringTexture.url, pool: 'mounted' }] : [])];
  const pools = [preparedResourcePool('mounted', entries), ...(modelLenses.length > 1
    ? [preparedResourcePool('lenses', entries, { retention: 'selection', decoding: 'sync' })] : [])];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...bodyLeaves, ...ringLeaves].map(leaf => leaf.style)) });
  const camera = b.mesh(`polycss-camera shape-model-camera ${id}-camera object-render-root`), root = b.mesh('polycss-scene');
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
  const materialRoot = sphereLighting ? b.element('div', 'shape-model-material-root object-render-root') : null;
  const material = sphereLighting ? b.element('s', 'shape-model-material',
    `width:${scene.camera.logicalBodyDiameter}px;height:${scene.camera.logicalBodyDiameter}px;margin:${-scene.camera.logicalBodyDiameter / 2}px 0 0 ${-scene.camera.logicalBodyDiameter / 2}px`) : null;
  if (material && materialRoot) { b.append(null, materialRoot); b.append(materialRoot, material); }
  const shapeLighting = !sphereLighting ? prepareShapeLighting({ builder: b, root, axes, config, scene }) : null;
  const materialReference = shapeLighting ? {
    materialReferenceControlPitchDegrees: scene.camera.defaultControlPitchDegrees,
    materialReferenceControlYawDegrees: scene.camera.defaultControlYawDegrees,
  } : {};
  const { tree, index } = b.finish({ camera, scene: root });
  function requiredMaterialRoot(){if(!materialRoot)throw new TypeError("Shape silhouette lacks its material root.");return materialRoot;}
  const definition = requireObjectRuntimeDefinition(JSON.parse(JSON.stringify({ schema: 'cssearth-object-runtime@4', id, camera: { ...scene.camera, ...materialReference, responsiveFit: { ...scene.camera.responsiveFit, maximumHeightShare: config.camera.maximumHeightShare } }, sky: scene.starfield, sun,
    controls: preparedContent.controls, tree,
    assets: { entries, pools, startup: entries.filter(entry => entry.pool === 'mounted').map(entry => entry.key) },
    variants: lenses.map(lens => ({ when: { lensId: lens.id }, required: [`surface:${lens.id}`, `poles:${lens.id}`, 'lighting', ...(ringTexture ? ['ring'] : [])], writes: [
      { kind: 'texture', target: index(body), name: '--shape-surface', resource: `surface:${lens.id}`, quoted: true },
      { kind: 'texture', target: index(body), name: '--shape-poles', resource: `poles:${lens.id}`, quoted: true },
      ...(material ? [{ kind: 'texture', target: index(material), name: '--shape-lighting', resource: 'lighting', quoted: true }] : []),
      ...(ring ? [{ kind: 'texture', target: index(ring), name: '--shape-ring', resource: 'ring', quoted: true }] : []),
    ], materials: shapeLighting ? [shapeLighting.selection] : [] })),
    materials: shapeLighting ? [shapeLighting.track(index(shapeLighting.leaf))] : [], animations: [],
    viewBindings: shapeLighting ? [shapeLighting.binding(index(shapeLighting.counter))] :
      [{ kind: 'silhouette-fit', target: index(requiredMaterialRoot()), minimumRadius: 1.5, unitScale: 2 / scene.camera.logicalBodyDiameter }],
  })));
  const { id: _id, controls: _controls, ...presentation } = definition;
  requirePreparedPresentation({ ...presentation, schema: 'cssearth-prepared-presentation@3' }, { controls: preparedContent.controls });
  const geometry = { ...scene, bodyLeaves, ringLeaves,
    ...(ringRaster ? { ringCoverage: { sourceFaceCount: sourceRingLeaves.length, preparedTileCount: ringLeaves.length,
      width: ringRaster.width, height: ringRaster.height, sourceFaces: ringFaces } } : {}),
    counts: { bodyQuads: bodyLeaves.length, ringQuads: ringLeaves.length, lightingQuads: 1, totalQuads: bodyLeaves.length + ringLeaves.length + 1, budget: config.quadBudget },
    model: { semiAxesKm: axes, ...(config.ring ? { ring: config.ring } : {}), surfaces: Object.fromEntries(modelLenses.map(lens => [lens.id, lens.source])), phase: 'arbitrary-display-phase', lighting: sphereLighting ? 'prepared full-phase curvature lighting fitted to the projected sphere; no directional Sun shadows' : 'prepared illustrative full-phase curvature fitted to the projected shape; no directional Sun shadows' } };
  await Promise.all([writeJson(outputDirectory, 'scene', geometry), writeJson(outputDirectory, 'runtime', definition),
    writeJson(outputDirectory, 'sky', scene.starfield), writeJson(outputDirectory, 'sun', sun)]);
  return { scene: geometry, definition, content: preparedContent.content };
}
