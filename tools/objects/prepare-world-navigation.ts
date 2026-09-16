import { sha256 } from '../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readAuthoredSources } from './authored-sources.js';
import { parseWorldContextSource } from '../../src/preparation/spatial-context.js';
import { authoredPresentationBasis } from './world-navigation-sources.js';
import { preparePhysicalMaterialTracks } from './world-navigation-materials.js';
import { preparePhysicalWorldFrame, transform, transpose, type Matrix3, type Vector3 } from './world-navigation.js';

type Input = Record<string, any>;
export interface WorldNavigationOptions { readonly objectDirectory: string; readonly definition: Input; readonly projectRoot?: string; }

/** Final preparation stage, shared by isolated authored builds and canonical JSON publication. */
export async function prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot = resolve(objectDirectory, '../../..') }: WorldNavigationOptions) {
  const bound = await readAuthoredSources(objectDirectory), descriptor = bound.descriptor;
  // The receipt names the manifest pins each source had, so a later reader can tell which inputs this frame came from.
  const pinnedSources = bound.entries.map(entry => entry.reference);
  const sources = new Map<string, Input>([...bound.sources].map(([id, entry]) => [id, entry.value as Input]));
  if (definition.id !== descriptor.id || definition.schema !== 'cssearth-object-runtime@4') throw new TypeError('Physical navigation runtime identity differs.');
  const contextSource = sources.get('world-context');
  if (contextSource) {
    const context = parseWorldContextSource(contextSource);
    if (context.focus.id !== descriptor.id) throw new TypeError('Authored context focus differs.');
    return { definition, frame: context.frame, receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id,
      sources: pinnedSources, frame: context.frame, model: 'authored-context-focus' } };
  }
  const solar = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href) as Input;
  const presentation = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-presentation-frame.mts')).href) as Input;
  const direction = await import(pathToFileURL(resolve(projectRoot, 'src/platform/prepare-sun-view-direction.mts')).href) as Input;
  const ecliptic = presentation.prepareEclipticPresentationFrame(descriptor.id);
  const authored = authoredPresentationBasis(sources, ecliptic.basis.flat() as Matrix3);
  const bodyToReference = solar.requireBodyFixedToIcrf(descriptor.id) as Matrix3;
  const bodySun = solar.requireBodyFixedSunDirection(descriptor.id) as Vector3;
  const distanceM = solar.requireBodyOrbit(descriptor.id).heliocentricDistanceAu * solar.ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const originM = transform(bodyToReference, bodySun).map(component => -component * distanceM) as unknown as Vector3;
  const bodyRadiusM = descriptor.recipe.shape.radiusKm * 1000;
  const renderedRadiusUnits = authored.sourceRadiusUnits * authored.tilePixels * definition.camera.sceneScale;
  const eclipticUp = transform(bodyToReference, solar.requireBodyFixedEclipticNorth(descriptor.id));
  const frame = preparePhysicalWorldFrame({ referenceFrame: 'sun-icrf', epochJdTt: solar.SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM, bodyToReference, bodyToPresentation: authored.bodyToPresentation, orbitUpReference: eclipticUp,
    physicalRadiusM: bodyRadiusM, renderedRadiusUnits });
  const alreadyPhysical = sources.has('shape-model') || sources.get('solar-system')?.schema === 'cssearth-solar-system-preparation@1' ||
    sources.get('terrestrial')?.kind === 'solid-observation-body';
  const camera = alreadyPhysical ? definition.camera : physicalCamera(definition.camera, definition.sky.projection, descriptor.recipe.paging !== undefined);
  const sky = alreadyPhysical ? definition.sky : { ...definition.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: matrixCss(transpose(frame.presentationToReference)),
    sceneRegistrationModel: 'icrf-in-authored-presentation-frame', sceneRegistrationEpoch: solar.SOLAR_GEOMETRY_EPOCH_LABEL };
  const localDirection = transform(authored.bodyToPresentation, bodySun);
  const sun = alreadyPhysical ? definition.sun : definition.sun ? { ...definition.sun, localDirection,
    referenceViewDirection: direction.prepareSunReferenceViewDirection({ bodyId: descriptor.id,
      initialScenePitchDegrees: camera.initialScenePitchDegrees, defaultControlYawDegrees: camera.defaultControlYawDegrees, sceneDirection: localDirection }) } : definition.sun;
  const prepared = preparePhysicalMaterialTracks({ definition: { ...definition, camera, sky, sun }, ...authored, sources,
    physicalShape: { equatorialRadiusM: bodyRadiusM, polarRadiusM: (descriptor.recipe.shape.polarRadiusKm ?? descriptor.recipe.shape.radiusKm) * 1000 } });
  return { definition: prepared, frame,
    receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id, sources: pinnedSources,
      frame, bodyToPresentation: authored.bodyToPresentation, sourceRadiusUnits: authored.sourceRadiusUnits,
      tilePixels: authored.tilePixels, sceneScale: camera.sceneScale, renderedRadiusUnits,
      sourceGeometryConvention: 'PolyCSS authored mesh axes; world raster X/Y transport is shared with the retained source geometry',
      ephemerisSource: 'src/platform/solar-geometry.mts' } };
}

function physicalCamera(camera: Input, projection: Input, paged: boolean): Input {
  const hadPerspective = camera.projection?.model === 'css-perspective-shared-with-sky';
  return { ...camera,
    projection: hadPerspective ? camera.projection : { model: 'css-perspective-shared-with-sky', ...projection,
      cssPerspective: projection.cssPerspective, eyeOnCameraRootAxis: true, nearPlaneClipping: 'javascript-before-publication' },
    dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .006, minimumDistanceRadii: paged ? 1 + 1e-10 : 1.2,
      maximumDistanceOverOrbitExtent: 1, zoomIsSilhouetteFraming: true, ...camera.dolly,
      ...(paged ? { minimumDistanceRadii: 1 + 1e-10 } : {}) },
    levelOfDetail: camera.levelOfDetail ?? { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
    orbitLineFade: camera.orbitLineFade ?? { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 },
    drag: camera.drag ?? { model: 'screen-axis-tumble' } };
}
function matrixCss(m: Matrix3): string {
  return `matrix3d(${[m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1].map(value => Math.abs(value) < 1e-15 ? 0 : value).join(',')})`;
}

export async function writeWorldNavigationArtifacts(outputDirectory: string, result: Awaited<ReturnType<typeof prepareWorldNavigationDefinition>>, scene?: Input): Promise<Input | undefined> {
  await mkdir(outputDirectory, { recursive: true });
  const nextScene = scene ? { ...scene, worldFrame: result.frame } : undefined;
  const outputs = { runtime: result.definition, 'world-navigation': result.receipt };
  for (const [name, value] of Object.entries(outputs)) await writeFile(resolve(outputDirectory, `${name}.json`), `${JSON.stringify(value)}\n`);
  return nextScene;
}

const invoked = process.argv[1] && basename(fileURLToPath(import.meta.url)) === 'prepare-world-navigation.js' && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const [directory] = process.argv.slice(2);
  if (!directory || process.argv.length !== 3) throw new TypeError('Usage: prepare-world-navigation <object-directory>');
  const objectDirectory = resolve(directory), outputDirectory = resolve(objectDirectory, 'prepared');
  const definition = JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8'));
  const scene = JSON.parse(await readFile(resolve(outputDirectory, 'scene.json'), 'utf8'));
  const result = await prepareWorldNavigationDefinition({ objectDirectory, definition });
  await writeWorldNavigationArtifacts(outputDirectory, result, scene);
  const descriptorPath = resolve(objectDirectory, 'object.json'), descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  await writeFile(descriptorPath, `${JSON.stringify({ ...descriptor, properties: { ...descriptor.properties, worldFrame: result.frame } }, null, 2)}\n`);
  const { writeObjectJson } = await import(pathToFileURL(resolve(objectDirectory, '../../../tools/prepare-object-json.mts')).href);
  console.log(JSON.stringify(await writeObjectJson(descriptor.id, result.definition)));
}
