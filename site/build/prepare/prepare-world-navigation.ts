import { parsePreparedObjectRuntime, validatePreparedCubicSky, validateDirectionalSunPlan } from '@cssearth/objects';
import { parseObjectDescriptor } from '@cssearth/objects';
import { parseSolarSceneSource, parsePagedRecipe, OBJECT_RUNTIME_SCHEMA, WORLD_NAVIGATION_PREPARATION_SCHEMA, SOLAR_SYSTEM_PREPARATION_SCHEMA, PAGED_ELLIPSOID_SCHEMA, type WorldNavigationPreparationReceipt } from '@cssearth/objects';

import { HOSTED_PLANET_IDS, STAR_IDS } from '@cssearth/astronomy';
import { buildPolyCameraSceneTransform } from '@layoutit/polycss';
import { preparedControlPitch } from '@cssearth/engine';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readAuthoredSources, verifiedSource } from '@cssearth/bake/objects/sources';
import { parseWorldContextSource } from '@cssearth/bake/world-context';
import { SHAPE_MODEL_SCHEMA, authoredPresentationBasis, POLYCSS_SURFACE_PLACEMENT, renderedBodyToPresentation, solveSystemTransform, type SurfaceMapPlacement, LIT_DEFAULT_VIEW, MINIMUM_COVERED_SHARE, openingDirection, photographDirections, prepareDefaultCameraAngles, prepareEclipticPresentationFrame, preparePhysicalWorldFrame, prepareSunReferenceViewDirection, transform, transpose, type Matrix3, type SolarGeometry, type Vector3, preparePhysicalMaterialTracks } from '@cssearth/bake/objects/scene';
import { readDefaultDatasetCoverage, coverageDirection, coveredShare, visibleCoverageShare, faceDatasetData, readDatasetCoverages, authoredFocusDatasets, bodyFixedCoverage } from '@cssearth/bake/objects/default-view';

type Input = Record<string, any>;
export interface WorldNavigationOptions { readonly objectDirectory: string; readonly definition: Input; readonly projectRoot?: string; }

/** Final preparation stage, shared by isolated authored builds and canonical JSON publication. */
export async function prepareWorldNavigationDefinition({ objectDirectory, definition, projectRoot = resolve(objectDirectory, '../../..') }: WorldNavigationOptions) {
  const bound = await readAuthoredSources(objectDirectory), descriptor = bound.descriptor;
  // The receipt names the manifest pins each source had, so a later reader can tell which inputs this frame came from.
  const sources = new Map<string, Input>([...bound.sources].map(([id, entry]) => [id, entry.value as Input]));
  if (definition.id !== descriptor.id || definition.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError('Physical navigation runtime identity differs.');
  const contextSource = sources.get('world-context');
  if (contextSource) {
    const context = parseWorldContextSource(contextSource);
    if (context.focus.id !== descriptor.id) throw new TypeError('Authored context focus differs.');
    return { definition, frame: context.frame, systemTransform: null, defaultCamera: null, receipt: { schema: WORLD_NAVIGATION_PREPARATION_SCHEMA, id: descriptor.id,
      frame: context.frame, model: 'authored-context-focus' } satisfies WorldNavigationPreparationReceipt };
  }
  const solar = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href) as Input;
  // The generated module satisfies the frame preparers' contract as it is; typing it by the module keeps drift a type error.
  const geometry: SolarGeometry = solar as typeof import('../../../src/platform/solar-geometry.mts');
  const ecliptic = prepareEclipticPresentationFrame(geometry, descriptor.id);
  if (!descriptor.recipe.surfaces.length) {
    // No surface to orient: the scene stands in the ecliptic presentation frame at the object's place, framed at the
    // radius its solar-system source authors, and the sky rides that frame.
    const bodyToReference = solar.requireBodyFixedToIcrf(descriptor.id) as Matrix3;
    const distanceM = solar.requireBodyOrbit(descriptor.id).heliocentricDistanceAu * solar.ASTRONOMICAL_UNIT_KILOMETERS * 1000;
    const authored = parseSolarSceneSource(sources.get('solar-system'), 'units');
    const renderedRadiusUnits = authored.bodyRadiusUnits * (authored.geometryScale ?? 1);
    const frame = preparePhysicalWorldFrame({ referenceFrame: 'sun-icrf', epochJdTt: solar.SOLAR_GEOMETRY_EPOCH_JD_TT,
      originM: transform(bodyToReference, solar.requireBodyFixedSunDirection(descriptor.id) as Vector3).map(component => -component * distanceM) as unknown as Vector3,
      bodyToReference, bodyToPresentation: ecliptic.basis.flat() as unknown as Matrix3,
      orbitUpReference: transform(bodyToReference, solar.requireBodyFixedEclipticNorth(descriptor.id)),
      physicalRadiusM: descriptor.recipe.shape.radiusKm * 1000, renderedRadiusUnits });
    const sky = { ...definition.sky, sceneRegistration: matrixCss(transpose(frame.presentationToReference)),
      sceneRegistrationModel: 'icrf-in-authored-presentation-frame', sceneRegistrationEpoch: solar.SOLAR_GEOMETRY_EPOCH_LABEL };
    return { definition: { ...definition, sky } as Input, frame, systemTransform: null, defaultCamera: null, receipt: { schema: WORLD_NAVIGATION_PREPARATION_SCHEMA, id: descriptor.id,
      frame, renderedRadiusUnits, model: 'ecliptic-presentation-frame', ephemerisSource: 'src/platform/solar-geometry.mts' } satisfies WorldNavigationPreparationReceipt };
  }
  const intended = ecliptic.basis.flat() as unknown as Matrix3, placement = await surfacePlacement(objectDirectory, bound, sources.get('features'));
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
  const alreadyPhysical = sources.has('shape-model') || sources.get('solar-system')?.schema === SOLAR_SYSTEM_PREPARATION_SCHEMA ||
    sources.get('terrestrial')?.kind === 'solid-observation-body';
  const paged = sources.get('paged-ellipsoid');
  const physical = alreadyPhysical ? oriented.camera : physicalCamera(oriented.camera, oriented.sky.projection, pagedSurfaceArcPerCssPixel(paged),
    pagedDrag(paged));
  // The default camera has one owner: this stage derives it and rewrites every prepared value computed from it, so a rule change
  // re-runs this stage, not the lanes.
  const surfacesReport = await readFile(resolve(objectDirectory, 'prepared/surfaces.json'), 'utf8').then(JSON.parse, () => null);
  const terrestrial = sources.get('terrestrial');
  // A flyby body without photograph frames faces the side its spacecraft approached (@cssearth/spice `spacecraftApproach`),
  // found in the recipe's kernels from their shared bank (`@cssearth/bake/objects/cameras`).
  const approachSource = sources.get('approach');
  const approachDirection = async () => {
    const spice = await import('@cssearth/spice'), { loadKernelSet } = await import('@cssearth/spice/node');
    const banks = await import('@cssearth/bake/objects/cameras');
    const recipe = spice.parseApproachRecipe(approachSource, `${descriptor.id} approach`);
    return spice.spacecraftApproach(await loadKernelSet(await banks.kernelBankPaths(recipe.kernelSet, recipe.kernels)), recipe).direction;
  };
  const observation = terrestrial ? photographDirections(descriptor.id, terrestrial, surfacesReport)
    : approachSource ? [await approachDirection()] : undefined;
  const light = (STAR_IDS as readonly string[]).includes(descriptor.id) ? 'self' : (HOSTED_PLANET_IDS as readonly string[]).includes(descriptor.id) ? 'host' : 'sun';
  // A lit body without photograph frames opens on the side of its default map that has data.
  // A map with next to no data (a shape-only body's empty model map) has no side to face.
  const read = !observation?.length && light === 'sun' ? await readDefaultDatasetCoverage(objectDirectory, placement.mapLeftEdgeLongitudeDeg) : undefined;
  const coverage = read && coveredShare(read) >= MINIMUM_COVERED_SHARE ? read : undefined;
  // The minimap step records the default dataset's coverage from its exact mask; a minimap from before that record is read back.
  const datasetCoverages = await readDatasetCoverages(objectDirectory), recorded = coverage && datasetCoverages.get(coverage.dataset);
  const angles = prepareDefaultCameraAngles(geometry, descriptor.id, { observation, light,
    coverage: recorded ? bodyFixedCoverage(recorded, placement.mapLeftEdgeLongitudeDeg) : coverage && coverageDirection(coverage) });
  if (coverage && !recorded) {
    const shown = visibleCoverageShare(coverage, openingDirection(geometry, descriptor.id, angles));
    const design = visibleCoverageShare(coverage, openingDirection(geometry, descriptor.id, LIT_DEFAULT_VIEW));
    if (shown < design) throw new Error(`${descriptor.id}: the default camera (yaw ${angles.defaultControlYawDegrees.toFixed(1)}) shows ${(shown * 100).toFixed(1)}% of the ${coverage.dataset} map's data, less than the design pose's ${(design * 100).toFixed(1)}%.`);
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
    referenceViewDirection: prepareSunReferenceViewDirection(geometry, { bodyId: descriptor.id,
      initialScenePitchDegrees: camera.initialScenePitchDegrees, defaultControlYawDegrees: camera.defaultControlYawDegrees, sceneDirection: localDirection }) } : definition.sun;
  const tracked = preparePhysicalMaterialTracks({ definition: { ...(posed?.definition ?? oriented), camera, sky, sun }, ...authored, sources, refreshPhysical: solved !== null,
    physicalShape: { equatorialRadiusM: bodyRadiusM, polarRadiusM: (descriptor.recipe.shape.polarRadiusKm ?? descriptor.recipe.shape.radiusKm) * 1000 } });
  // A partial map turns the camera toward its data when a reader picks it, by the rule the default camera follows; like the
  // default pose, only a solved lane takes it. A paged globe's dataset cameras are its recipe's own (Earth's cross-sections).
  const prepared = solved && !sources.has('paged-ellipsoid') ? faceDatasetData(tracked, { geometry, bodyId: descriptor.id,
    mapLeftEdgeLongitudeDeg: placement.mapLeftEdgeLongitudeDeg, camera, coverages: datasetCoverages,
    authored: authoredFocusDatasets(sources.get('terrestrial'), sources.get('presentation')) }) : tracked;
  return { definition: prepared, frame, systemTransform: solved, defaultCamera: posed ? { angles, transform: posed.transform } : null,
    receipt: { schema: WORLD_NAVIGATION_PREPARATION_SCHEMA, id: descriptor.id,
      frame, bodyToPresentation, sourceRadiusUnits: authored.sourceRadiusUnits,
      tilePixels: authored.tilePixels, sceneScale: camera.sceneScale, renderedRadiusUnits, ...(posed ? { defaultCamera: angles } : {}),
      sourceGeometryConvention: solved
        ? 'ecliptic presentation frame, drawn by solving the outermost mesh node; body as drawn: retained node chain at the first spin keyframe, then the surface map axes and left edge the feature labels use; PolyCSS writes world X/Y as CSS Y/X'
        : 'body as drawn: retained node chain at the first spin keyframe, then the surface map axes and left edge the feature labels use; PolyCSS writes world X/Y as CSS Y/X',
      ephemerisSource: 'src/platform/solar-geometry.mts' } satisfies WorldNavigationPreparationReceipt };
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

/** A dataset raster that states where its longitudes start must start where the surface map places them, or it draws turned. */
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
  return sources.get('shape-model')?.schema === SHAPE_MODEL_SCHEMA || sources.get('solar-system')?.schema === SOLAR_SYSTEM_PREPARATION_SCHEMA ||
    sources.get('terrestrial')?.kind === 'solid-observation-body' || sources.get('paged-ellipsoid')?.schema === PAGED_ELLIPSOID_SCHEMA;
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
  const fields = parsePagedRecipe(paged, 'surface-arc');
  return fields === undefined ? undefined : fields.texelsPerCssPixel * 2 * Math.PI / (fields.sourceWidth * fields.density);
}

function pagedDrag(paged: Input | undefined): Input | undefined {
  return parsePagedRecipe(paged, 'drag');
}

function physicalCamera(camera: Input, projection: Input, surfaceArcPerCssPixelRadians: number | undefined, recipeDrag?: Input): Input {
  const hadPerspective = camera.projection?.model === 'css-perspective-shared-with-sky';
  return { ...camera,
    projection: hadPerspective ? camera.projection : { model: 'css-perspective-shared-with-sky', ...projection,
      cssPerspective: projection.cssPerspective, eyeOnCameraRootAxis: true, nearPlaneClipping: 'javascript-before-publication' },
    dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .006, minimumDistanceRadii: 1.2,
      maximumDistanceOverOrbitExtent: 1, zoomIsSilhouetteFraming: true, ...camera.dolly,
      ...(surfaceArcPerCssPixelRadians === undefined ? {} : { surfaceArcPerCssPixelRadians }) },
    levelOfDetail: camera.levelOfDetail ?? { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
    orbitLineFade: camera.orbitLineFade ?? { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 },
    drag: recipeDrag ?? camera.drag ?? { model: 'screen-axis-tumble' } };
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
    const document = await readFile(path, 'utf8').then(text => name === 'sky'
      ? validatePreparedCubicSky(JSON.parse(text)) : validateDirectionalSunPlan(JSON.parse(text)), () => null);
    if (document) await writeFile(path, `${JSON.stringify({ ...document, ...registration })}\n`);
  }
  // The scene carries the same frame the descriptor does, so a re-derived frame rewrites it too.
  const outputs = { runtime: result.definition, 'world-navigation': result.receipt, ...(nextScene ? { scene: nextScene } : {}) };
  for (const [name, value] of Object.entries(outputs)) await writeFile(resolve(outputDirectory, `${name}.json`), `${JSON.stringify(value)}\n`);
  return nextScene;
}

const invoked = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  const [directory] = process.argv.slice(2);
  if (!directory || process.argv.length !== 3) throw new TypeError('Usage: prepare-world-navigation <object-directory>');
  const objectDirectory = resolve(directory), outputDirectory = resolve(objectDirectory, 'prepared');
  const definition = parsePreparedObjectRuntime(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), { parsedJson: true });
  const scene = JSON.parse(await readFile(resolve(outputDirectory, 'scene.json'), 'utf8'));
  const result = await prepareWorldNavigationDefinition({ objectDirectory, definition });
  await writeWorldNavigationArtifacts(outputDirectory, result, scene);
  const descriptorPath = resolve(objectDirectory, 'object.json'), descriptor = parseObjectDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')));
  await writeFile(descriptorPath, `${JSON.stringify({ ...descriptor, properties: { ...descriptor.properties, worldFrame: result.frame } }, null, 2)}\n`);
  const { writeObjectJson } = await import(pathToFileURL(resolve(objectDirectory, '../../../site/build/prepare/prepare-object-json.mts')).href);
  console.log(JSON.stringify(await writeObjectJson(descriptor.id, result.definition)));
}
