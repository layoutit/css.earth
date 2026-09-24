import { sha256 } from '../../src/platform/sha256.mts';
import { HOSTED_PLANET_IDS, STAR_IDS } from '@cssearth/astronomy';
import { buildPolyCameraSceneTransform } from '@layoutit/polycss';
import { preparedControlPitch } from '@cssearth/engine';
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
  const sources = new Map<string, Input>([...bound.sources].map(([id, entry]) => [id, entry.value as Input]));
  if (definition.id !== descriptor.id || definition.schema !== 'cssearth-object-runtime@4') throw new TypeError('Physical navigation runtime identity differs.');
  const contextSource = sources.get('world-context');
  if (contextSource) {
    const context = parseWorldContextSource(contextSource);
    if (context.focus.id !== descriptor.id) throw new TypeError('Authored context focus differs.');
    return { definition, frame: context.frame, systemTransform: null, defaultCamera: null, receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id,
      frame: context.frame, model: 'authored-context-focus' } };
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
  const physical = alreadyPhysical ? oriented.camera : physicalCamera(oriented.camera, oriented.sky.projection, pagedSurfaceArcPerCssPixel(sources.get('paged-ellipsoid')));
  // The default camera has one owner: this stage derives it and rewrites every prepared value computed from it, so a rule change
  // re-runs this stage, not the lanes.
  const cameraModule = await import(pathToFileURL(resolve(projectRoot, 'src/platform/default-camera.mts')).href) as typeof import('../../src/platform/default-camera.mts');
  const surfacesReport = await readFile(resolve(objectDirectory, 'prepared/surfaces.json'), 'utf8').then(JSON.parse, () => null);
  const terrestrial = sources.get('terrestrial');
  // A flyby body without photograph frames faces the side its spacecraft approached (tools/spice/approach.mts).
  const approachSource = sources.get('approach');
  const approachModule = approachSource ? await import(pathToFileURL(resolve(projectRoot, 'tools/spice/approach.mts')).href) as typeof import('../spice/approach.mts') : undefined;
  const observation = terrestrial ? cameraModule.photographDirections(descriptor.id, terrestrial, surfacesReport)
    : approachModule ? [(await approachModule.spacecraftApproach(approachModule.parseApproachRecipe(approachSource, `${descriptor.id} approach`))).direction] : undefined;
  const light = (STAR_IDS as readonly string[]).includes(descriptor.id) ? 'self' : (HOSTED_PLANET_IDS as readonly string[]).includes(descriptor.id) ? 'host' : 'sun';
  // A lit body without photograph frames opens on the side of its default map that has data.
  const coverageModule = await import(pathToFileURL(resolve(projectRoot, 'tools/objects/default-view/lens-coverage.mts')).href) as typeof import('./default-view/lens-coverage.mts');
  const coverage = !observation?.length && light === 'sun' ? await coverageModule.readDefaultLensCoverage(objectDirectory, placement.mapLeftEdgeLongitudeDeg) : undefined;
  const angles = cameraModule.prepareDefaultCameraAngles(descriptor.id, { observation, light, coverage: coverage && coverageModule.coverageDirection(coverage) });
  if (coverage) {
    const shown = coverageModule.visibleCoverageShare(coverage, cameraModule.openingDirection(descriptor.id, angles));
    const design = coverageModule.visibleCoverageShare(coverage, cameraModule.openingDirection(descriptor.id, cameraModule.LIT_DEFAULT_VIEW));
    if (shown < design) throw new Error(`${descriptor.id}: the default camera (yaw ${angles.defaultControlYawDegrees.toFixed(1)}) shows ${(shown * 100).toFixed(1)}% of the ${coverage.lens} map's data, less than the design pose's ${(design * 100).toFixed(1)}%.`);
  }
  // Only a solved lane takes the derived pose; a typed lane keeps the camera its own bakes were made for.
  const posed = solved ? poseDefaultCamera(oriented, physical, angles) : null;
  const camera = posed?.camera ?? physical;
  // The sky cube rides the frame for every capability, so it follows the body as drawn.
  const sceneRegistration = matrixCss(transpose(frame.presentationToReference));
  const sky = alreadyPhysical ? { ...oriented.sky, sceneRegistration } : { ...oriented.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration, sceneRegistrationModel: 'icrf-in-authored-presentation-frame', sceneRegistrationEpoch: solar.SOLAR_GEOMETRY_EPOCH_LABEL };
  // The sky cube and the Sun follow the body as drawn, for a solved lane and for a lane that still carries typed node angles.
  // The light is the body's own star's where it has one: a planet of another star is lit by its host, whose direction the scene
  // stage records; the frame origin above still places the body from the Sun.
  const localDirection = transform(bodyToPresentation, (solar.bodyFixedStarDirection(descriptor.id) ?? bodySun) as Vector3);
  const sun = oriented.sun ? { ...oriented.sun, localDirection,
    referenceViewDirection: direction.prepareSunReferenceViewDirection({ bodyId: descriptor.id,
      initialScenePitchDegrees: camera.initialScenePitchDegrees, defaultControlYawDegrees: camera.defaultControlYawDegrees, sceneDirection: localDirection }) } : definition.sun;
  const prepared = preparePhysicalMaterialTracks({ definition: { ...(posed?.definition ?? oriented), camera, sky, sun }, ...authored, sources, refreshPhysical: solved !== null,
    physicalShape: { equatorialRadiusM: bodyRadiusM, polarRadiusM: (descriptor.recipe.shape.polarRadiusKm ?? descriptor.recipe.shape.radiusKm) * 1000 } });
  return { definition: prepared, frame, systemTransform: solved, defaultCamera: posed ? { angles, transform: posed.transform } : null,
    receipt: { schema: 'cssearth-world-navigation-preparation@1', id: descriptor.id,
      frame, bodyToPresentation, sourceRadiusUnits: authored.sourceRadiusUnits,
      tilePixels: authored.tilePixels, sceneScale: camera.sceneScale, renderedRadiusUnits, ...(posed ? { defaultCamera: angles } : {}),
      sourceGeometryConvention: solved
        ? 'ecliptic presentation frame, drawn by solving the outermost mesh node; body as drawn: retained node chain at the first spin keyframe, then the surface map axes and left edge the feature labels use; PolyCSS writes world X/Y as CSS Y/X'
        : 'body as drawn: retained node chain at the first spin keyframe, then the surface map axes and left edge the feature labels use; PolyCSS writes world X/Y as CSS Y/X',
      ephemerisSource: 'src/platform/solar-geometry.mts' } };
}

/** The camera's default pose and everything prepared from it: the control and scene pitch, the yaw, the retained state and
 * material reference, and the scene transform string the camera and the retained scene node carry. */
const SCENE_ROTATION = /rotateX\((-?[\d.e+-]+)deg\) rotate\((-?[\d.e+-]+)deg\)/u;
function poseDefaultCamera(definition: Input, camera: Input, angles: { initialScenePitchDegrees: number; defaultControlYawDegrees: number }) {
  const pitch = angles.initialScenePitchDegrees, yaw = angles.defaultControlYawDegrees;
  const control = preparedControlPitch(pitch, camera as { maximumControlPitchDegrees: number; maximumScenePitchDegrees: number });
  const rotation = `rotateX(${pitch}deg) rotate(${yaw}deg)`;
  const next: Input = { ...camera, initialScenePitchDegrees: pitch, defaultControlYawDegrees: yaw, defaultControlPitchDegrees: control,
    ...(camera.state ? { state: { ...camera.state, rotX: control, rotY: yaw } } : {}),
    ...(camera.materialReferenceControlPitchDegrees !== undefined ? { materialReferenceControlPitchDegrees: control, materialReferenceControlYawDegrees: yaw } : {}),
    ...(typeof camera.defaultTransform === 'string' ? { defaultTransform: camera.defaultTransform.replace(SCENE_ROTATION, rotation) } : {}) };
  // The retained scene node carries the same transform the camera starts from. Reuse the
  // original node, and the original tree, when the pose changes nothing (idempotency).
  const nodes = definition.tree.nodes.map((node: Input) => {
    if (!(String(node.className ?? '').split(/\s+/u).includes('polycss-scene') && SCENE_ROTATION.test(String(node.style ?? '')))) return node;
    const style = String(node.style).replace(SCENE_ROTATION, rotation);
    return style === node.style ? node : { ...node, style };
  });
  const changed = nodes.some((node: Input, index: number) => node !== definition.tree.nodes[index]);
  return { camera: next, transform: { pitch, yaw, control, rotation }, definition: changed ? { ...definition, tree: { ...definition.tree, nodes } } : definition };
}

/** Apply the derived default camera to a prepared scene document the lanes wrote alongside the runtime. */
function poseSceneDocument(scene: Input, camera: Input, sun: Input | null, pose: { pitch: number; yaw: number; control: number; rotation: string }): Input {
  const document: Input = { ...scene };
  if (scene.camera && typeof scene.camera === 'object') {
    const previous = scene.camera, next: Input = { ...previous };
    for (const key of ['initialScenePitchDegrees', 'defaultScenePitchDegrees'] as const) if (key in previous) next[key] = pose.pitch;
    for (const key of ['defaultControlPitchDegrees', 'defaultPitchDegrees'] as const) if (key in previous) next[key] = pose.control;
    if ('defaultControlYawDegrees' in previous) next.defaultControlYawDegrees = pose.yaw;
    if ('materialReferenceControlPitchDegrees' in previous) Object.assign(next, { materialReferenceControlPitchDegrees: pose.control, materialReferenceControlYawDegrees: pose.yaw });
    if (previous.state && typeof previous.state === 'object') next.state = { ...previous.state, rotX: previous.state.rotX === previous.initialScenePitchDegrees || previous.state.rotX === previous.defaultScenePitchDegrees ? pose.pitch : pose.control, rotY: pose.yaw };
    for (const key of ['defaultTransform', 'sceneStyle'] as const) if (typeof previous[key] === 'string') next[key] = previous[key].replace(SCENE_ROTATION, pose.rotation);
    document.camera = next;
  }
  if (sun && scene.sun && typeof scene.sun === 'object') document.sun = { ...scene.sun, localDirection: sun.localDirection, referenceViewDirection: sun.referenceViewDirection };
  return document;
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
    sources.get('terrestrial')?.kind === 'solid-observation-body' || sources.get('paged-ellipsoid')?.schema === 'cssearth-paged-ellipsoid@1';
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

/** The least surface arc, seen from a paged body's centre, that one CSS pixel may show: its texture levels' own sharpness
 * target (`textureLevels.texelsPerCssPixel`) times one texel of the sharpest level. The canonical atlas carries
 * `atlas.density` texels per column of its `atlas.sourceWidth` grid around the equator (paged-ellipsoid surface-raster). */
function pagedSurfaceArcPerCssPixel(paged: Input | undefined): number | undefined {
  if (paged?.schema !== 'cssearth-paged-ellipsoid@1') return undefined;
  const { sourceWidth, density } = paged.atlas ?? {}, texelsPerCssPixel = paged.textureLevels?.texelsPerCssPixel;
  if (!(Number.isInteger(sourceWidth) && sourceWidth > 0 && Number.isInteger(density) && density > 0 && texelsPerCssPixel >= 1)) {
    throw new TypeError(`${String(paged.namespace)}: paged ellipsoid zoom limit needs atlas.sourceWidth, atlas.density and textureLevels.texelsPerCssPixel; found ${String(sourceWidth)}, ${String(density)} and ${String(texelsPerCssPixel)}.`);
  }
  return texelsPerCssPixel * 2 * Math.PI / (sourceWidth * density);
}

function physicalCamera(camera: Input, projection: Input, surfaceArcPerCssPixelRadians: number | undefined): Input {
  const hadPerspective = camera.projection?.model === 'css-perspective-shared-with-sky';
  return { ...camera,
    projection: hadPerspective ? camera.projection : { model: 'css-perspective-shared-with-sky', ...projection,
      cssPerspective: projection.cssPerspective, eyeOnCameraRootAxis: true, nearPlaneClipping: 'javascript-before-publication' },
    dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .006, minimumDistanceRadii: 1.2,
      maximumDistanceOverOrbitExtent: 1, zoomIsSilhouetteFraming: true, ...camera.dolly,
      ...(surfaceArcPerCssPixelRadians === undefined ? {} : { surfaceArcPerCssPixelRadians }) },
    levelOfDetail: camera.levelOfDetail ?? { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
    orbitLineFade: camera.orbitLineFade ?? { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 },
    drag: camera.drag ?? { model: 'screen-axis-tumble' } };
}
function matrixCss(m: Matrix3): string {
  return `matrix3d(${[m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1].map(value => Math.abs(value) < 1e-15 ? 0 : value).join(',')})`;
}

export async function writeWorldNavigationArtifacts(outputDirectory: string, result: Awaited<ReturnType<typeof prepareWorldNavigationDefinition>>, scene?: Input): Promise<Input | undefined> {
  await mkdir(outputDirectory, { recursive: true });
  const oriented = scene ? replaceSystemTransform(scene, result.systemTransform ?? { from: '', to: '' }) : undefined;
  const nextScene: Record<string, unknown> | undefined = oriented ? { ...(result.defaultCamera ? poseSceneDocument(oriented, result.definition.camera, result.definition.sun ?? null, result.defaultCamera.transform) : oriented), worldFrame: result.frame } : undefined;
  // These documents are consumed again by later preparation. Keep their numeric
  // registration and light vectors aligned with the runtime even for typed lanes
  // that retain their authored default camera (for example Jupiter and Saturn).
  for (const name of ['sky', 'sun'] as const) {
    const canonical = result.definition[name];
    if (!canonical) continue;
    // The chain names the registration model in words; without it here, every bake dropped the line from sky.json.
    const keys = name === 'sky' ? ['sceneRegistration', 'sceneRegistrationModel', 'sceneRegistrationChain', 'sceneRegistrationEpoch', 'cameraContract']
      : ['localDirection', 'referenceViewDirection'];
    const registration = Object.fromEntries(keys.filter(key => canonical[key] !== undefined).map(key => [key, canonical[key]]));
    const existing = nextScene?.[name];
    if (nextScene && existing && typeof existing === 'object' && !Array.isArray(existing)) nextScene[name] = { ...existing, ...registration };
    const path = resolve(outputDirectory, `${name}.json`);
    const document = await readFile(path, 'utf8').then(JSON.parse, () => null);
    if (document) await writeFile(path, `${JSON.stringify({ ...document, ...registration })}\n`);
  }
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
  const { writeObjectJson } = await import(pathToFileURL(resolve(objectDirectory, '../../../tools/prepare/prepare-object-json.mts')).href);
  console.log(JSON.stringify(await writeObjectJson(descriptor.id, result.definition)));
}
