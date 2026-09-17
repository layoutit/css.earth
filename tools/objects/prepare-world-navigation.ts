import { sha256 } from '../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readAuthoredSources, verifiedSource } from './authored-sources.js';
import { parseWorldContextSource } from '../../src/preparation/spatial-context.js';
import { authoredPresentationBasis, POLYCSS_SURFACE_PLACEMENT, renderedBodyToPresentation, solveSystemTransform, type SurfaceMapPlacement } from './world-navigation-sources.js';
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
    return { definition, frame: context.frame, systemTransform: null, receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id,
      sources: pinnedSources, frame: context.frame, model: 'authored-context-focus' } };
  }
  const solar = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href) as Input;
  const presentation = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-presentation-frame.mts')).href) as Input;
  const direction = await import(pathToFileURL(resolve(projectRoot, 'src/platform/prepare-sun-view-direction.mts')).href) as Input;
  const ecliptic = presentation.prepareEclipticPresentationFrame(descriptor.id);
  const intended = ecliptic.basis.flat() as Matrix3, placement = await surfacePlacement(objectDirectory, bound, sources.get('features'));
  assertAtlasOrigins(descriptor.id, sources.get('raster'), placement);
  // The body is drawn in its ecliptic presentation frame: the outermost mesh node is solved through whatever the lane placed below it.
  const solved = eclipticLane(sources) ? solveSystemTransform(definition, descriptor.id, placement, intended) : null;
  const oriented = solved ? replaceSystemTransform(definition, solved) : definition;
  const authored = authoredPresentationBasis(sources, solved?.matrix ?? intended);
  // The world frame follows the body as drawn; for an ecliptic lane that is the intended frame, to rounding.
  const bodyToPresentation = renderedBodyToPresentation(oriented, descriptor.id, placement);
  if (solved && bodyToPresentation.some((value, index) => Math.abs(value - intended[index]!) > 1e-9)) {
    throw new Error(`${descriptor.id}: the drawn body differs from its ecliptic presentation frame after solving its system transform.`);
  }
  const bodyToReference = solar.requireBodyFixedToIcrf(descriptor.id) as Matrix3;
  const bodySun = solar.requireBodyFixedSunDirection(descriptor.id) as Vector3;
  const distanceM = solar.requireBodyOrbit(descriptor.id).heliocentricDistanceAu * solar.ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const originM = transform(bodyToReference, bodySun).map(component => -component * distanceM) as unknown as Vector3;
  const bodyRadiusM = descriptor.recipe.shape.radiusKm * 1000;
  const renderedRadiusUnits = authored.sourceRadiusUnits * authored.tilePixels * definition.camera.sceneScale;
  const eclipticUp = transform(bodyToReference, solar.requireBodyFixedEclipticNorth(descriptor.id));
  const frame = preparePhysicalWorldFrame({ referenceFrame: 'sun-icrf', epochJdTt: solar.SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM, bodyToReference, bodyToPresentation, orbitUpReference: eclipticUp,
    physicalRadiusM: bodyRadiusM, renderedRadiusUnits });
  const alreadyPhysical = sources.has('shape-model') || sources.get('solar-system')?.schema === 'cssearth-solar-system-preparation@1' ||
    sources.get('terrestrial')?.kind === 'solid-observation-body';
  const camera = alreadyPhysical ? oriented.camera : physicalCamera(oriented.camera, oriented.sky.projection, descriptor.recipe.paging !== undefined);
  // The sky cube rides the frame for every capability, so it follows the body as drawn.
  const sceneRegistration = matrixCss(transpose(frame.presentationToReference));
  const sky = alreadyPhysical ? { ...oriented.sky, sceneRegistration } : { ...oriented.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration, sceneRegistrationModel: 'icrf-in-authored-presentation-frame', sceneRegistrationEpoch: solar.SOLAR_GEOMETRY_EPOCH_LABEL };
  // An ecliptic lane is drawn in its frame, so its Sun is the physical one. The paged and layered lanes bake their material banks
  // against a light carried through their typed node angles, and their runtime picks frames against that same light.
  const localDirection = transform(solved ? bodyToPresentation : authored.bodyToPresentation, bodySun);
  const sun = oriented.sun ? { ...oriented.sun, localDirection,
    referenceViewDirection: direction.prepareSunReferenceViewDirection({ bodyId: descriptor.id,
      initialScenePitchDegrees: camera.initialScenePitchDegrees, defaultControlYawDegrees: camera.defaultControlYawDegrees, sceneDirection: localDirection }) } : definition.sun;
  const prepared = preparePhysicalMaterialTracks({ definition: { ...oriented, camera, sky, sun }, ...authored, sources, refreshPhysical: solved !== null,
    physicalShape: { equatorialRadiusM: bodyRadiusM, polarRadiusM: (descriptor.recipe.shape.polarRadiusKm ?? descriptor.recipe.shape.radiusKm) * 1000 } });
  return { definition: prepared, frame, systemTransform: solved,
    receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id, sources: pinnedSources,
      frame, bodyToPresentation, sourceRadiusUnits: authored.sourceRadiusUnits,
      tilePixels: authored.tilePixels, sceneScale: camera.sceneScale, renderedRadiusUnits,
      sourceGeometryConvention: 'ecliptic presentation frame, drawn by solving the outermost mesh node; body as drawn: retained node chain at the first spin keyframe, then the surface map axes and left edge the feature labels use; PolyCSS writes world X/Y as CSS Y/X',
      ephemerisSource: 'src/platform/solar-geometry.mts' } };
}

/** A lens raster that states where its longitudes start must start where the surface map places them, or it draws turned. */
function assertAtlasOrigins(id: string, raster: Input | undefined, placement: SurfaceMapPlacement) {
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { value.forEach((entry, index) => visit(entry, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'outputLongitudeOrigin' && (((entry as number) - placement.mapLeftEdgeLongitudeDeg) % 360 + 360) % 360 !== 0) {
        throw new Error(`${id}: raster ${path}.${key} is ${String(entry)}, but the surface map's left edge is longitude ${placement.mapLeftEdgeLongitudeDeg}.`);
      }
      visit(entry, `${path}.${key}`);
    }
  };
  visit(raster, 'raster');
}

/** Lanes whose system node carries the ecliptic presentation frame directly. */
function eclipticLane(sources: ReadonlyMap<string, Input>): boolean {
  return sources.get('shape-model')?.schema === 'cssearth-shape-model@1' || sources.get('solar-system')?.schema === 'cssearth-solar-system-preparation@1' ||
    sources.get('terrestrial')?.kind === 'solid-observation-body';
}

/** Every prepared copy of the system node's transform (the node itself, counter bindings, physical material tracks) is one value. */
function replaceSystemTransform<T>(value: T, solved: { from: string; to: string }): T {
  if (solved.from === solved.to) return value;
  const text = JSON.stringify(value), from = JSON.stringify(solved.from).slice(1, -1), to = JSON.stringify(solved.to).slice(1, -1);
  if (!text.includes(from)) throw new TypeError('The solved system transform has no prepared copy to replace.');
  return JSON.parse(text.split(from).join(to)) as T;
}

/** The surface map the feature labels place names with, or PolyCSS's own placement for a body without one. */
async function surfacePlacement(objectDirectory: string, bound: Awaited<ReturnType<typeof readAuthoredSources>>, features: Input | undefined): Promise<SurfaceMapPlacement> {
  if (!features) return POLYCSS_SURFACE_PLACEMENT;
  if (typeof features.surfaceMap !== 'string') throw new TypeError('Surface features name their surface map.');
  const map = (await verifiedSource(objectDirectory, bound.manifest, { id: 'surface-map', path: `source/${features.surfaceMap}` })).value as Input;
  return { prime: map.prime, east: map.east, north: map.north, mapLeftEdgeLongitudeDeg: map.mapLeftEdgeLongitudeDeg };
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
  const nextScene = scene ? { ...replaceSystemTransform(scene, result.systemTransform ?? { from: '', to: '' }), worldFrame: result.frame } : undefined;
  // The scene carries the same frame the descriptor does, so a re-derived frame rewrites it too.
  const outputs = { runtime: result.definition, 'world-navigation': result.receipt, ...(nextScene ? { scene: nextScene } : {}) };
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
