import type { PositionM } from '@cssearth/engine';
import { parsePreparedOrbitCenters } from '../universe/prepared-orbit-centers.js';
import type { PreparedOrbitCenter } from '../universe/prepared-orbit-centers.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { array, finite, numbers, positive, record, text, unique } from '../validation/guards.js';
import type { PreparedWorldCameraFrame } from '../navigation/world-camera.js';
import { cssViewFromOrientation, validateWorldRotation } from '../navigation/world-camera-math.js';
import type { LevelOfDetailPlan, OrbitLineFade } from '../navigation/types.js';
import type { PreparedOrbitStrokes } from '../solar-system/prepared-orbit-strokes.js';

export interface PreparedContextPoint {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly positionM: PositionM;
  readonly radiusM: number;
}
export interface PreparedContextPointSource {
  readonly absoluteMagnitude: number;
  readonly color: string;
  readonly proximityEnhancement?: {
    readonly fullDistanceM: number;
    readonly fadeOutDistanceM: number;
    readonly radiusMultiplier: number;
    readonly brightnessMultiplier: number;
  };
}
export interface PreparedContextFocus extends PreparedContextPoint {
  readonly pointSource?: PreparedContextPointSource;
  readonly systemView?: PreparedContextBody['systemView'];
}
export interface PreparedContextBody extends PreparedContextPoint {
  readonly placement?: 'approximate';
  /** Drawn from its astronomy record around a packaged host; it has no object page to open. */
  readonly unpackaged?: true;
  /** A host's authored presentation range: the camera distance up to which its system draws every member's orbit. */
  readonly orbitsWithinM?: number;
  /** Caption the body over its middle instead of below it. */
  readonly labelPlacement?: 'centre';
  /** A placed star measured to be bound to another with no measured orbit: its host and the pair's centre of mass. */
  readonly boundTo?: { readonly hostId: string; readonly centerM: PositionM };
  /** The members a system overview frames. The full context also carries its camera candidates; the browser's summary
   * does not, and reads them from `world-system-views.json` (`parsePreparedSystemViews`) when navigation needs them. */
  readonly systemView?: { readonly memberIds: readonly string[]; readonly memberRadiiM: readonly number[];
    readonly candidates?: readonly PreparedSystemViewCandidate[] };
  readonly orbit?: PreparedContextOrbit;
}
/** What the main thread knows about an orbit: its parent, extent and size. The
 * planner worker alone reads the path itself (`PreparedContextOrbitGeometry`). */
export interface PreparedContextOrbit {
  readonly centerBodyId: string; readonly centerPositionM: PositionM;
  /** Path vertex count; the retained stroke pool holds two segments per vertex. */
  readonly vertexCount: number;
  /** Every trail weight is 1: the whole path draws at full strength. */
  readonly fullTrail: boolean;
  readonly bounds?: { readonly centerM: PositionM; readonly radiusM: number };
  readonly lod?: { readonly bounds: { readonly centerM: PositionM; readonly radiusM: number } };
  readonly closed?: false; readonly displayExtentAu?: number;
}
/** An orbit's path as typed arrays: the planner worker reads them straight from the binary orbit bank. */
export interface PreparedContextOrbitGeometry extends PreparedContextOrbit {
  /** Vertices as consecutive x, y, z metres. */
  readonly verticesM: Float64Array; readonly trail: Float64Array;
  readonly activeChords?: Uint32Array; readonly extentChords?: Uint32Array; readonly lod?: PreparedOrbitLod;
  readonly bodyVertexIndex?: number; readonly trailModel?: 'finite-open-trajectory-constant-weight'; readonly strokes?: PreparedOrbitStrokes;
}
export interface PreparedContextGeometryBody extends PreparedContextBody {
  readonly orbit?: PreparedContextOrbitGeometry;
}
/** Prepared coarser chord banks: vertex selections of the full path, each with
 * its own trail weights and its largest distance from the full path. */
export interface PreparedOrbitLod {
  readonly bounds: { readonly centerM: PositionM; readonly radiusM: number };
  readonly levels: readonly { readonly vertexIndices: Uint32Array; readonly trail: Float64Array;
    readonly activeChords: Uint32Array; readonly deviationM: number }[];
}
export interface PreparedContextCameraPresentation {
  readonly projection: { readonly model: 'css-perspective-shared-with-sky'; readonly cssPerspective: string };
  readonly dolly: { readonly model: 'multiplicative-wheel-distance'; readonly wheelStepPerDelta: number; readonly minimumDistanceRadii: number; readonly maximumDistanceOverOrbitExtent: number };
  readonly levelOfDetail: LevelOfDetailPlan;
  readonly orbitLineFade: OrbitLineFade;
  readonly drag: { readonly model: 'screen-axis-tumble' };
}
export interface PreparedVolumeOpacityProfile {
  readonly model: 'logarithmic-distance';
  readonly nearOpacity: number;
  readonly fullOpacity: number;
  readonly fadeStartDistanceM: number;
  readonly fullDistanceM: number;
}
/** The world context the main thread holds: every body, placement and camera
 * fact, with each orbit reduced to `PreparedContextOrbit`. */
export interface PreparedWorldContext {
  readonly schema: 'cssearth-world-context@1' | 'cssearth-world-context-summary@1';
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: PreparedContextFocus;
  readonly bodies: readonly PreparedContextBody[];
  readonly orbitCenters?: Readonly<Record<string, PreparedOrbitCenter>>;
  /** The summary pins the binary orbit bank that holds its orbits' paths (`decodeWorldOrbits`). */
  readonly orbitBank?: { readonly byteLength: number };
  readonly camera: { readonly minimumDistanceM: number; readonly maximumDistanceM: number; readonly framingReferenceZoom: number;
    readonly presentation: PreparedContextCameraPresentation };
  readonly volume: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number;
    readonly opacityProfile?: PreparedVolumeOpacityProfile;
    /** Display attenuation of the completed volume image over black; not physical exposure. */
    readonly brightnessProfile?: PreparedVolumeOpacityProfile };
  readonly stars: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number };
  readonly system: { readonly fadeOutStartDistanceM: number; readonly hiddenDistanceM: number };
  readonly sky: { readonly sceneRegistration: string };
}
/** The full prepared file: orbit paths and detail levels for the planner worker and build tools. */
export interface PreparedWorldContextGeometry extends PreparedWorldContext {
  readonly schema: 'cssearth-world-context@1';
  readonly bodies: readonly PreparedContextGeometryBody[];
  /** Each classification framed by its members' prepared positions. */
  readonly classificationViews?: Readonly<Record<string, NonNullable<PreparedContextBody['systemView']>>>;
}

function vector(value: unknown, label: string): PositionM {
  const values = numbers(value, label, 3);
  return Object.freeze([values[0], values[1], values[2]]);
}
function point(value: unknown, fields: readonly string[] = ['id', 'name', 'color', 'positionM', 'radiusM']): PreparedContextPoint {
  const input = record(value, 'context point', fields);
  const id = text(input.id, 'point identity'), color = text(input.color, 'point color');
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^#[a-f0-9]{6}$/i.test(color)) throw new TypeError('Invalid context point identity or color.');
  return Object.freeze({ id, color, name: text(input.name, 'point name'),
    // A body drawn from its astronomy record may have no measured radius: 0, drawn as its circle only.
    positionM: vector(input.positionM, 'point position'), radiusM: input.unpackaged === true && input.radiusM === 0 ? 0 : positive(input.radiusM, `point ${id} radius`) });
}
export interface PreparedSystemViewCandidate { readonly cameraToReference: readonly number[];
  readonly minimumM: PositionM; readonly maximumM: PositionM; readonly memberPositionsM: readonly PositionM[] }
function parseSystemViewCandidates(value: unknown, memberCount: number, id: string): readonly PreparedSystemViewCandidate[] {
  const candidates = array(value, `system view ${id} candidates`).map(value => {
    const candidate = record(value, 'system view candidate', ['cameraToReference', 'minimumM', 'maximumM', 'memberPositionsM']);
    const cameraToReference = numbers(candidate.cameraToReference, 'system view rotation');
    validateWorldRotation(cameraToReference);
    const minimumM = vector(candidate.minimumM, 'system view minimum'), maximumM = vector(candidate.maximumM, 'system view maximum');
    if (minimumM.some((value, axis) => value >= maximumM[axis]!)) throw new TypeError(`System view ${id} bounds must have positive extent.`);
    const memberPositionsM = array(candidate.memberPositionsM, 'system member positions').map(value => vector(value, 'system member position'));
    if (memberPositionsM.length !== memberCount) throw new TypeError(`System view ${id} has ${memberPositionsM.length} member positions for ${memberCount} members.`);
    return Object.freeze({ cameraToReference: Object.freeze(cameraToReference), minimumM, maximumM, memberPositionsM: Object.freeze(memberPositionsM) });
  });
  if (!candidates.length) throw new TypeError(`System view ${id} must include candidate views.`);
  return Object.freeze(candidates);
}
/** The full context's views carry their camera candidates; the summary's name their members only. */
function parseSystemView(value: unknown, withCandidates = true): PreparedContextBody['systemView'] {
  if (value === undefined) return undefined;
  const view = record(value, 'system view', withCandidates ? ['memberIds', 'memberRadiiM', 'candidates'] : ['memberIds', 'memberRadiiM']);
  const memberIds = array(view.memberIds, 'system members').map(id => text(id, 'system member id'));
  if (!memberIds.length) throw new TypeError('System view must include members.');
  unique(memberIds, 'system member ids');
  // Zero is a member drawn from its record with no measured radius; each radius is checked against its body below.
  const memberRadiiM = array(view.memberRadiiM, 'system member radii').map((value, index) => value === 0 ? 0 : positive(value, `system member ${memberIds[index]} radius`));
  if (memberRadiiM.length !== memberIds.length) throw new TypeError('System view needs one radius per member.');
  const members = { memberIds: Object.freeze(memberIds), memberRadiiM: Object.freeze(memberRadiiM) };
  return Object.freeze(withCandidates ? { ...members, candidates: parseSystemViewCandidates(view.candidates, memberIds.length, memberIds.join(',')) } : members);
}
/** `world-system-views.json`: each summary system view's camera candidates, by host id. */
export function parsePreparedSystemViews(value: unknown, plan: Pick<PreparedWorldContext, 'focus' | 'bodies'>): ReadonlyMap<string, { readonly candidates: readonly PreparedSystemViewCandidate[] }> {
  const input = record(value, 'system views', ['schema', 'views']);
  if (input.schema !== 'cssearth-world-system-views@1') throw new TypeError(`Unsupported prepared system views: ${String(input.schema)}.`);
  const views = record(input.views, 'system views by host');
  const hosts = new Map([plan.focus, ...plan.bodies].flatMap(body => body.systemView ? [[body.id, body.systemView] as const] : []));
  if (Object.keys(views).length !== hosts.size) throw new TypeError(`Prepared system views name ${Object.keys(views).length} hosts; the world context has ${hosts.size}.`);
  return new Map([...hosts].map(([id, view]) => {
    if (!Object.hasOwn(views, id)) throw new TypeError(`Prepared system views lack ${id}.`);
    return [id, Object.freeze({ candidates: parseSystemViewCandidates(views[id], view.memberIds.length, id) })] as const;
  }));
}
/** Classification views frame prepared bodies by position; members must match those bodies. */
function parseClassificationViews(value: unknown, bodies: readonly PreparedContextBody[]) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Classification views must be a record.');
  const byId = new Map(bodies.map(body => [body.id, body]));
  const entries = Object.entries(value).map(([classification, input]) => {
    const view = parseSystemView(input);
    if (!/^[a-z][a-z0-9-]*$/.test(classification) || !view) throw new TypeError('Invalid classification view.');
    for (const [index, id] of view.memberIds.entries()) {
      if (byId.get(id)?.radiusM !== view.memberRadiiM[index]) throw new TypeError('Classification view members must match their prepared bodies.');
    }
    return [classification, view] as const;
  });
  if (!entries.length) throw new TypeError('Classification views must name a classification.');
  return Object.freeze(Object.fromEntries(entries));
}
function focusPoint(value: unknown, withCandidates: boolean): PreparedContextFocus {
  const input = record(value, 'context focus', ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView']);
  const raw = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView']);
  const systemView = parseSystemView(input.systemView, withCandidates);
  const base = systemView ? Object.freeze({ ...raw, systemView }) : raw;
  if (input.pointSource === undefined) return base;
  const pointSource = record(input.pointSource, 'context focus point source', ['absoluteMagnitude', 'color', 'proximityEnhancement']);
  const absoluteMagnitude = finite(pointSource.absoluteMagnitude, 'context focus absolute magnitude');
  const color = text(pointSource.color, 'context focus point color');
  if (!/^#[a-f0-9]{6}$/i.test(color)) throw new TypeError('Invalid context focus point color.');
  if (pointSource.proximityEnhancement === undefined) return Object.freeze({ ...base, pointSource: Object.freeze({ absoluteMagnitude, color }) });
  const enhancement = record(pointSource.proximityEnhancement, 'context focus proximity enhancement', ['fullDistanceM', 'fadeOutDistanceM', 'radiusMultiplier', 'brightnessMultiplier']);
  const fullDistanceM = positive(enhancement.fullDistanceM, 'context focus proximity full distance');
  const fadeOutDistanceM = positive(enhancement.fadeOutDistanceM, 'context focus proximity fade-out distance');
  const radiusMultiplier = positive(enhancement.radiusMultiplier, 'context focus proximity radius multiplier');
  const brightnessMultiplier = positive(enhancement.brightnessMultiplier, 'context focus proximity brightness multiplier');
  if (!(fadeOutDistanceM > fullDistanceM && radiusMultiplier >= 1 && brightnessMultiplier >= 1)) throw new TypeError('Invalid context focus proximity enhancement.');
  return Object.freeze({ ...base, pointSource: Object.freeze({ absoluteMagnitude, color,
    proximityEnhancement: Object.freeze({ fullDistanceM, fadeOutDistanceM, radiusMultiplier, brightnessMultiplier }) }) });
}
/** Two positions are the same place when they agree to double precision.
 *
 * A body's position and the orbit vertex pinned to it are computed by different runs, and doubles at solar
 * system scale carry their last digit at tenths of a millimetre: Neptune's own vertex and body position differ
 * by 0.5 mm at 30 au, a relative 2e-15. Exact equality makes that a failure while the orbit is pinned to the
 * body exactly as intended. The bound sits fifty times above that roundoff and, at Neptune's distance, still
 * refuses anything beyond a few metres, so an orbit on the wrong body or the wrong vertex cannot pass. */
const POSITION_TOLERANCE = 1e-12;
function equalPosition(a: PositionM, b: PositionM): boolean {
  return a.every((value, index) => {
    const other = b[index]!;
    return Number.isFinite(value) && Number.isFinite(other)
      && Math.abs(value - other) <= POSITION_TOLERANCE * Math.max(1, Math.abs(value), Math.abs(other));
  });
}
function parseSky(value: unknown): PreparedWorldContext['sky'] {
  const input = record(value, 'context sky', ['sceneRegistration']);
  const sceneRegistration = text(input.sceneRegistration, 'context sky registration');
  const match = /^matrix3d\(([^)]+)\)$/u.exec(sceneRegistration);
  if (!match) throw new TypeError('Context sky registration requires matrix3d.');
  const matrix = match[1].split(',').map(value => Number(value.trim()));
  if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value)) || matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[12] !== 0 || matrix[13] !== 0 || matrix[14] !== 0 || matrix[15] !== 1) {
    throw new TypeError('Context sky registration must be a pure matrix3d rotation.');
  }
  validateWorldRotation([matrix[0]!, matrix[4]!, matrix[8]!, matrix[1]!, matrix[5]!, matrix[9]!, matrix[2]!, matrix[6]!, matrix[10]!]);
  return Object.freeze({ sceneRegistration });
}
function parsePresentation(value: unknown): PreparedContextCameraPresentation {
  const input = record(value, 'context camera presentation', ['projection', 'dolly', 'levelOfDetail', 'orbitLineFade', 'drag']);
  const projection = record(input.projection, 'context projection', ['model', 'cssPerspective']);
  if (projection.model !== 'css-perspective-shared-with-sky') throw new TypeError('Unsupported context projection.');
  const dolly = record(input.dolly, 'context dolly', ['model', 'wheelStepPerDelta', 'minimumDistanceRadii', 'maximumDistanceOverOrbitExtent']);
  if (dolly.model !== 'multiplicative-wheel-distance') throw new TypeError('Unsupported context dolly.');
  const minimumDistanceRadii = positive(dolly.minimumDistanceRadii, 'context minimum dolly distance');
  if (!(minimumDistanceRadii > 1)) throw new TypeError('Context camera must remain outside the focus.');
  const levelOfDetail = record(input.levelOfDetail, 'context level of detail', ['model', 'billboardFadeStartDiscPixels', 'billboardFullDiscPixels', 'markerFadeStartDiscPixels', 'markerFullDiscPixels']);
  if (levelOfDetail.model !== 'silhouette-diameter-crossfade') throw new TypeError('Unsupported context level of detail.');
  const billboardFadeStartDiscPixels = positive(levelOfDetail.billboardFadeStartDiscPixels, 'context billboard fade start');
  const billboardFullDiscPixels = positive(levelOfDetail.billboardFullDiscPixels, 'context billboard full');
  const markerFadeStartDiscPixels = positive(levelOfDetail.markerFadeStartDiscPixels, 'context marker fade start');
  const markerFullDiscPixels = positive(levelOfDetail.markerFullDiscPixels, 'context marker full');
  if (!(billboardFadeStartDiscPixels > billboardFullDiscPixels && billboardFullDiscPixels > markerFadeStartDiscPixels && markerFadeStartDiscPixels > markerFullDiscPixels)) throw new TypeError('Context level-of-detail thresholds must descend.');
  const orbitLineFade = record(input.orbitLineFade, 'context orbit-line fade', ['visibleBelowDiscHeightShare', 'hiddenAboveDiscHeightShare']);
  const visibleBelowDiscHeightShare = finite(orbitLineFade.visibleBelowDiscHeightShare, 'context orbit visible threshold');
  const hiddenAboveDiscHeightShare = finite(orbitLineFade.hiddenAboveDiscHeightShare, 'context orbit hidden threshold');
  if (!(hiddenAboveDiscHeightShare > visibleBelowDiscHeightShare)) throw new TypeError('Context orbit fade bounds are invalid.');
  const drag = record(input.drag, 'context drag', ['model']);
  if (drag.model !== 'screen-axis-tumble') throw new TypeError('Unsupported context drag.');
  return Object.freeze({ projection: Object.freeze({ model: projection.model, cssPerspective: text(projection.cssPerspective, 'context CSS perspective') }),
    dolly: Object.freeze({ model: dolly.model, wheelStepPerDelta: positive(dolly.wheelStepPerDelta, 'context wheel step'), minimumDistanceRadii, maximumDistanceOverOrbitExtent: positive(dolly.maximumDistanceOverOrbitExtent, 'context orbit extent') }),
    levelOfDetail: Object.freeze({ model: levelOfDetail.model, billboardFadeStartDiscPixels, billboardFullDiscPixels, markerFadeStartDiscPixels, markerFullDiscPixels }),
    orbitLineFade: Object.freeze({ visibleBelowDiscHeightShare, hiddenAboveDiscHeightShare }), drag: Object.freeze({ model: drag.model }) });
}
// Only our immutable validated outputs are reusable. Mutable transport inputs
// always cross validation, including callers that modify and submit them again.
const validatedContexts = new WeakSet<object>();
/** The full prepared file, orbit paths included: the planner worker and build tools read this. */
export function parsePreparedWorldContext(value: unknown): PreparedWorldContextGeometry {
  return parseContext(value, true) as PreparedWorldContextGeometry;
}
/** What a mounted body reads from the world: the shared frame, the focus body's identity and the camera. Each page
 * embeds it (`cssearth-world-camera@1`), so a body mounts before the world summary has downloaded. */
export interface PreparedWorldCamera { readonly frame: PreparedWorldContext['frame']; readonly focusId: string; readonly camera: PreparedWorldContext['camera']; }
export const PREPARED_WORLD_CAMERA_SCHEMA = 'cssearth-world-camera@1';
/** The world camera from its embedded record, or from a world context or summary. */
export function parsePreparedWorldCamera(value: unknown): PreparedWorldCamera {
  const schema = value && typeof value === 'object' ? (value as { schema?: unknown }).schema : undefined;
  if (schema !== PREPARED_WORLD_CAMERA_SCHEMA) {
    const plan = parsePreparedWorldContextPlan(value);
    return Object.freeze({ frame: plan.frame, focusId: plan.focus.id, camera: plan.camera });
  }
  const input = record(value, 'world camera', ['schema', 'frame', 'focusId', 'camera']);
  const camera = record(input.camera, 'world camera', ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation']);
  const minimumDistanceM = positive(camera.minimumDistanceM, 'minimum camera distance');
  const maximumDistanceM = positive(camera.maximumDistanceM, 'maximum camera distance');
  if (!(maximumDistanceM > minimumDistanceM)) throw new TypeError('World camera distance interval is invalid.');
  const focusId = text(input.focusId, 'world camera focus');
  if (!/^[a-z][a-z0-9-]*$/.test(focusId)) throw new TypeError('Invalid world camera focus identity.');
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World camera requires its prepared frame.');
  return Object.freeze({ frame, focusId,
    camera: Object.freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom: positive(camera.framingReferenceZoom, 'framing reference zoom'),
      presentation: parsePresentation(camera.presentation) }) });
}
/** The main thread's copy: `world-context-summary.json`, whose orbits carry no paths. */
export function parsePreparedWorldContextSummary(value: unknown): PreparedWorldContext {
  return parseContext(value, false);
}
/** Either file, by its schema: runtimes that hold the plan accept the summary or the full context. */
export function parsePreparedWorldContextPlan(value: unknown): PreparedWorldContext {
  const schema = value && typeof value === 'object' ? (value as { schema?: unknown }).schema : undefined;
  return parseContext(value, schema === 'cssearth-world-context@1');
}
/** A plan whose orbits carry their paths, for the synchronous planner. */
export function worldContextGeometry(plan: PreparedWorldContext): PreparedWorldContextGeometry {
  if (plan.schema !== 'cssearth-world-context@1') throw new TypeError('Planning orbits requires the full prepared world context.');
  return plan as PreparedWorldContextGeometry;
}
type OrbitGeometryCandidate = Omit<PreparedContextOrbitGeometry, 'vertexCount' | 'fullTrail' | 'trailModel'> & { readonly trailModel?: unknown };
// A parsed plan carries typed arrays; a structured clone of it (the worker transport) keeps them typed.
const numberList = (value: unknown, label: string) => ArrayBuffer.isView(value) && !(value instanceof DataView)
  ? numbers(Array.from(value as unknown as ArrayLike<number>), label) : numbers(value, label);
const indices = (value: unknown, label: string) => {
  const values = numberList(value, label);
  if (values.some(index => !Number.isSafeInteger(index) || index < 0 || index > 0xffffffff)) throw new TypeError(`${label} must be unsigned 32-bit integers.`);
  return Uint32Array.from(values);
};
const sphere = (input: unknown, label: string) => {
  const bounds = record(input, label, ['centerM', 'radiusM']);
  return Object.freeze({ centerM: vector(bounds.centerM, `${label} centre`), radiusM: positive(bounds.radiusM, `${label} radius`) });
};
/** A JSON orbit (the full prepared file, read by build tools and tests) packed into the typed arrays the planner uses. */
function jsonOrbitGeometry(value: unknown): OrbitGeometryCandidate {
  const orbit = record(value, 'body orbit', ['centerBodyId', 'centerPositionM', 'verticesM', 'trail', 'bounds', 'activeChords', 'extentChords',
    'closed', 'bodyVertexIndex', 'displayExtentAu', 'trailModel', 'strokes', 'lod',
    // A parsed copy carries these; both are derived again from the path.
    'vertexCount', 'fullTrail']);
  let strokes: PreparedOrbitStrokes | undefined;
  if (orbit.strokes !== undefined) {
    const input = record(orbit.strokes, 'orbit stroke bank', ['weights', 'segmentCapacity']);
    strokes = Object.freeze({ weights: Object.freeze(numbers(input.weights, 'orbit stroke materials')), segmentCapacity: finite(input.segmentCapacity, 'orbit stroke capacity') });
  }
  const lod = orbit.lod === undefined ? undefined : (() => {
    const input = record(orbit.lod, 'orbit detail levels', ['bounds', 'levels']);
    return { bounds: sphere(input.bounds, 'orbit detail bounds'), levels: array(input.levels, 'orbit detail levels').map(value => {
      const level = record(value, 'orbit detail level', ['vertexIndices', 'trail', 'activeChords', 'deviationM']);
      return { vertexIndices: indices(level.vertexIndices, 'orbit detail vertices'), trail: Float64Array.from(numberList(level.trail, 'orbit detail trail')),
        activeChords: indices(level.activeChords, 'orbit detail active chords'), deviationM: finite(level.deviationM, 'orbit detail deviation') };
    }) };
  })();
  return { centerBodyId: text(orbit.centerBodyId, 'orbit parent identity'), centerPositionM: vector(orbit.centerPositionM, 'orbit centre position'),
    verticesM: orbit.verticesM instanceof Float64Array ? Float64Array.from(numberList(orbit.verticesM, 'orbit vertices'))
      : Float64Array.from(array(orbit.verticesM, 'orbit vertices').flatMap(value => vector(value, 'orbit vertex'))),
    trail: Float64Array.from(numberList(orbit.trail, 'orbit trail')),
    ...(orbit.bounds === undefined ? {} : { bounds: sphere(orbit.bounds, 'orbit bounds') }),
    ...(orbit.activeChords === undefined ? {} : { activeChords: indices(orbit.activeChords, 'active orbit chords') }),
    ...(orbit.extentChords === undefined ? {} : { extentChords: indices(orbit.extentChords, 'extent orbit chords') }),
    ...(orbit.closed === undefined ? {} : { closed: orbit.closed as false }),
    ...(orbit.bodyVertexIndex === undefined ? {} : { bodyVertexIndex: finite(orbit.bodyVertexIndex, 'orbit epoch vertex') }),
    ...(orbit.displayExtentAu === undefined ? {} : { displayExtentAu: finite(orbit.displayExtentAu, 'Open trajectory display extent') }),
    ...(orbit.trailModel === undefined ? {} : { trailModel: orbit.trailModel }),
    ...(strokes ? { strokes } : {}), ...(lod ? { lod } : {}) };
}
/** Every prepared orbit path, whether it came from JSON or the binary bank, passes the same checks. */
function validateOrbitGeometry(orbit: OrbitGeometryCandidate, bodyPositionM: PositionM, focusId: string, renderedIds: ReadonlySet<string>, bodyId = 'orbit'): PreparedContextOrbitGeometry {
  const { centerBodyId, verticesM, trail } = orbit;
  const count = verticesM.length / 3;
  const distance = (index: number, centerM: PositionM) =>
    Math.hypot(verticesM[index * 3]! - centerM[0], verticesM[index * 3 + 1]! - centerM[1], verticesM[index * 3 + 2]! - centerM[2]);
  const open = orbit.closed === false;
  if (orbit.closed !== undefined && !open) throw new TypeError('Open trajectory metadata requires closed: false.');
  if (open) {
    const bodyVertexIndex = orbit.bodyVertexIndex;
    if (typeof bodyVertexIndex !== 'number' || !Number.isSafeInteger(bodyVertexIndex) || bodyVertexIndex < 0 || bodyVertexIndex >= count ||
        orbit.trailModel !== 'finite-open-trajectory-constant-weight' || trail.some(weight => weight !== 1)) {
      throw new TypeError('Open context trajectory must identify its epoch vertex and constant finite-path weights.');
    }
    positive(orbit.displayExtentAu, 'Open trajectory display extent');
  } else if ([orbit.bodyVertexIndex, orbit.displayExtentAu, orbit.trailModel].some(value => value !== undefined)) {
    throw new TypeError('Open trajectory metadata requires closed: false.');
  }
  const pinned = open ? orbit.bodyVertexIndex! : 0;
  if (!Number.isInteger(count) || count < 8 || trail.length !== count - (open ? 1 : 0) || trail.some(value => !(value >= 0 && value <= 1)) ||
      !equalPosition(bodyPositionM, [verticesM[pinned * 3]!, verticesM[pinned * 3 + 1]!, verticesM[pinned * 3 + 2]!]) || !verticesM.every(Number.isFinite)) {
    // One context holds hundreds of orbits; the body and the part that disagrees are what make a failure actionable.
    const pinnedM: PositionM = [verticesM[pinned * 3]!, verticesM[pinned * 3 + 1]!, verticesM[pinned * 3 + 2]!];
    const said = !Number.isInteger(count) || count < 8 ? `it has ${count} vertices`
      : trail.length !== count - (open ? 1 : 0) ? `it carries ${trail.length} trail weights for ${count} vertices`
      : trail.some(value => !(value >= 0 && value <= 1)) ? 'a trail weight lies outside 0 to 1'
      : !verticesM.every(Number.isFinite) ? 'a vertex is not finite'
      : `its vertex ${pinned} is at ${pinnedM.join(', ')} and the body at ${bodyPositionM.join(', ')}`;
    throw new TypeError(`${bodyId}: context orbit must align with its body and carry matching prepared trail weights: ${said}.`);
  }
  const drawnChords = trail.reduce((sum, weight) => sum + (weight > 0 ? 1 : 0), 0);
  if (orbit.activeChords) {
    let ordinal = 0;
    for (let index = 0; index < trail.length; index++) if (trail[index]! > 0 && orbit.activeChords[ordinal++] !== index) ordinal = -Infinity;
    if (ordinal !== orbit.activeChords.length) throw new TypeError('Prepared active chords must match every positive trail weight in order.');
  }
  if (orbit.extentChords && (orbit.extentChords.length !== drawnChords || new Set(orbit.extentChords).size !== orbit.extentChords.length ||
      orbit.extentChords.some(index => !(trail[index]! > 0)))) {
    throw new TypeError('Prepared extent chords must visit every positive trail weight exactly once.');
  }
  if (orbit.bounds) {
    for (let index = 0; index < count; index++) {
      const drawn = trail[index]! > 0 || (index > 0 ? trail[index - 1]! : open ? 0 : trail[trail.length - 1]!) > 0;
      if (drawn && distance(index, orbit.bounds.centerM) > orbit.bounds.radiusM) throw new TypeError('Prepared orbit bounds must contain every active chord endpoint.');
    }
  }
  if (orbit.strokes) {
    const drawn = [...new Set([...trail].filter(weight => weight > 0))];
    const expected = centerBodyId !== focusId && renderedIds.has(centerBodyId) ? [1] : [...new Set([...drawn, 1])];
    if (orbit.strokes.segmentCapacity !== count * 2 || orbit.strokes.weights.length !== expected.length || orbit.strokes.weights.some((weight, index) => weight !== expected[index])) {
      throw new TypeError('Prepared orbit strokes must cover every authored trail material and full-orbit hover.');
    }
  }
  if (orbit.lod) {
    for (let index = 0; index < count; index++) {
      if (distance(index, orbit.lod.bounds.centerM) > orbit.lod.bounds.radiusM) throw new TypeError('Prepared orbit detail bounds must contain every vertex.');
    }
    for (const level of orbit.lod.levels) {
      const { vertexIndices, trail: levelTrail, activeChords: levelActive } = level;
      let ordinal = 0;
      for (let index = 0; index < levelTrail.length; index++) if (levelTrail[index]! > 0 && levelActive[ordinal++] !== index) ordinal = -Infinity;
      if (vertexIndices.length < 3 || vertexIndices[0] !== 0 || !vertexIndices.includes(pinned) || (open && vertexIndices.at(-1) !== count - 1) ||
          vertexIndices.some((index, position) => index >= count || (position > 0 && index <= vertexIndices[position - 1]!)) ||
          levelTrail.length !== vertexIndices.length - (open ? 1 : 0) || levelTrail.some(weight => !(weight >= 0 && weight <= 1)) ||
          ordinal !== levelActive.length || !(level.deviationM >= 0)) {
        throw new TypeError('Prepared orbit detail levels must keep the body vertex and carry matching trail weights.');
      }
    }
  }
  const lod = orbit.lod && Object.freeze({ bounds: orbit.lod.bounds, levels: Object.freeze(orbit.lod.levels.map(level => Object.freeze({ ...level }))) });
  // The open-trajectory checks above admit only the one trail model.
  return Object.freeze({ ...orbit, ...(lod ? { lod } : {}), vertexCount: count, fullTrail: trail.every(weight => weight === 1) }) as PreparedContextOrbitGeometry;
}
/** An orbit's vertices as points, for build tools and tests that walk the path. */
export function orbitVertices(orbit: Pick<PreparedContextOrbitGeometry, 'verticesM'>): PositionM[] {
  return Array.from({ length: orbit.verticesM.length / 3 }, (_, index) =>
    [orbit.verticesM[index * 3]!, orbit.verticesM[index * 3 + 1]!, orbit.verticesM[index * 3 + 2]!] as PositionM);
}
const WORLD_ORBITS_MAGIC = 0x4f575343, WORLD_ORBITS_VERSION = 1;
/** The planner's full context from the summary plan and its pinned binary orbit bank. The bank's sections become
 * typed-array views over the transferred bytes; each orbit passes the same checks as the JSON file. */
export function decodeWorldOrbits(plan: PreparedWorldContext, bytes: ArrayBuffer): PreparedWorldContextGeometry {
  if (!plan.orbitBank || bytes.byteLength !== plan.orbitBank.byteLength) throw new TypeError(`Orbit bank is ${bytes.byteLength} bytes; its summary says ${plan.orbitBank?.byteLength}.`);
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== WORLD_ORBITS_MAGIC || view.getUint32(4, true) !== WORLD_ORBITS_VERSION) throw new TypeError('Unsupported orbit bank.');
  const headerLength = view.getUint32(8, true), dataStart = 12 + headerLength + (8 - (12 + headerLength) % 8) % 8;
  const header = record(JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 12, headerLength))), 'orbit bank header', ['schema', 'bodies']);
  if (header.schema !== 'cssearth-world-orbits@1') throw new TypeError('Unsupported orbit bank.');
  const section = <T extends Float64Array | Uint32Array>(value: unknown, type: { new(buffer: ArrayBuffer, offset: number, length: number): T; BYTES_PER_ELEMENT: number }, label: string): T => {
    const [offset, length] = numbers(value, label, 2);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset % 8 !== 0 ||
        dataStart + offset + length * type.BYTES_PER_ELEMENT > bytes.byteLength) throw new TypeError(`${label} lies outside the orbit bank.`);
    return new type(bytes, dataStart + offset, length);
  };
  const paths = new Map(array(header.bodies, 'orbit bank bodies').map(value => {
    const body = record(value, 'orbit bank body', ['id', 'vertices', 'trail', 'activeChords', 'extentChords', 'bodyVertexIndex', 'trailModel', 'levels']);
    return [text(body.id, 'orbit bank body id'), body] as const;
  }));
  const renderedIds = new Set(plan.bodies.map(body => body.id));
  const bodies = plan.bodies.map<PreparedContextGeometryBody>(body => {
    if (!body.orbit) return body as PreparedContextGeometryBody;
    const path = paths.get(body.id);
    if (!path) throw new TypeError(`${body.id}: orbit bank lacks its path.`);
    paths.delete(body.id);
    const { orbit } = body;
    const geometry = validateOrbitGeometry({ centerBodyId: orbit.centerBodyId, centerPositionM: orbit.centerPositionM,
      verticesM: section(path.vertices, Float64Array, `${body.id} vertices`), trail: section(path.trail, Float64Array, `${body.id} trail`),
      activeChords: section(path.activeChords, Uint32Array, `${body.id} active chords`), extentChords: section(path.extentChords, Uint32Array, `${body.id} extent chords`),
      ...(orbit.bounds ? { bounds: orbit.bounds } : {}),
      ...(orbit.closed === false ? { closed: false as const, displayExtentAu: orbit.displayExtentAu,
        bodyVertexIndex: finite(path.bodyVertexIndex, `${body.id} epoch vertex`), trailModel: path.trailModel } : {}),
      ...(orbit.lod ? { lod: { bounds: orbit.lod.bounds, levels: array(path.levels, `${body.id} detail levels`).map(value => {
        const level = record(value, 'orbit bank level', ['vertexIndices', 'trail', 'activeChords', 'deviationM']);
        return { vertexIndices: section(level.vertexIndices, Uint32Array, `${body.id} level vertices`), trail: section(level.trail, Float64Array, `${body.id} level trail`),
          activeChords: section(level.activeChords, Uint32Array, `${body.id} level chords`), deviationM: finite(level.deviationM, `${body.id} level deviation`) };
      }) } } : {}) }, body.positionM, plan.focus.id, renderedIds, body.id);
    if (geometry.vertexCount !== orbit.vertexCount || geometry.fullTrail !== orbit.fullTrail) throw new TypeError(`${body.id}: orbit bank differs from its summary.`);
    return Object.freeze({ ...body, orbit: geometry });
  });
  if (paths.size) throw new TypeError('Orbit bank carries paths for bodies without orbits.');
  const { orbitBank: _pin, ...rest } = plan;
  return Object.freeze({ ...rest, schema: 'cssearth-world-context@1', bodies: Object.freeze(bodies) });
}
function parseSummaryOrbit(value: unknown): PreparedContextOrbit {
  const orbit = record(value, 'body orbit', ['centerBodyId', 'centerPositionM', 'vertexCount', 'fullTrail', 'bounds', 'lod', 'closed', 'displayExtentAu']);
  const vertexCount = finite(orbit.vertexCount, 'orbit vertex count');
  if (!Number.isSafeInteger(vertexCount) || vertexCount < 8) throw new TypeError('Context orbit must carry at least eight prepared vertices.');
  if (typeof orbit.fullTrail !== 'boolean') throw new TypeError('Context orbit must state whether its trail is full.');
  if (orbit.closed === undefined ? orbit.displayExtentAu !== undefined : orbit.closed !== false) {
    throw new TypeError('Open trajectory metadata requires closed: false.');
  }
  return Object.freeze({ centerBodyId: text(orbit.centerBodyId, 'orbit parent identity'), centerPositionM: vector(orbit.centerPositionM, 'orbit centre position'),
    vertexCount, fullTrail: orbit.fullTrail,
    ...(orbit.bounds === undefined ? {} : { bounds: sphere(orbit.bounds, 'orbit bounds') }),
    ...(orbit.lod === undefined ? {} : { lod: Object.freeze({ bounds: sphere(record(orbit.lod, 'orbit detail levels', ['bounds']).bounds, 'orbit detail bounds') }) }),
    ...(orbit.closed === false ? { closed: false as const, displayExtentAu: positive(orbit.displayExtentAu, 'Open trajectory display extent') } : {}) });
}
function parseContext(value: unknown, geometry: boolean): PreparedWorldContext {
  if (value && typeof value === 'object' && validatedContexts.has(value) &&
      (!geometry || (value as PreparedWorldContext).schema === 'cssearth-world-context@1')) return value as PreparedWorldContext;
  const input = record(value, 'world context', ['schema', 'frame', 'focus', 'bodies', 'orbitCenters', 'classificationViews', 'orbitBank', 'camera', 'volume', 'stars', 'system', 'sky']);
  const schema = geometry ? 'cssearth-world-context@1' : 'cssearth-world-context-summary@1';
  if (input.schema !== schema) throw new TypeError('Unsupported prepared world context.');
  if (!geometry && input.classificationViews !== undefined) throw new TypeError('The world context summary carries no classification views.');
  if (geometry && input.orbitBank !== undefined) throw new TypeError('The full world context carries its orbit paths, not a bank pin.');
  const orbitBank = input.orbitBank === undefined ? undefined : (() => {
    const bank = record(input.orbitBank, 'orbit bank', ['byteLength']);
    const byteLength = positive(bank.byteLength, 'orbit bank byte length');
    if (!Number.isSafeInteger(byteLength)) throw new TypeError('Orbit bank byte length is invalid.');
    return Object.freeze({ byteLength });
  })();
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World context requires its prepared frame.');
  const focus = focusPoint(input.focus, geometry);
  if (!equalPosition(focus.positionM, frame.originM)) throw new TypeError('World context focus must be at its frame origin.');
  const renderedIds = new Set(array(input.bodies, 'context bodies').map(value => text(record(value, 'context body').id, 'context body id')));
  const bodies = array(input.bodies, 'context bodies').map<PreparedContextGeometryBody | PreparedContextBody>(value => {
    const fields = ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit', 'systemView', 'placement', 'boundTo', 'unpackaged', 'orbitsWithinM', 'labelPlacement'];
    const input = record(value, 'context body', fields);
    const rawBody = point(input, fields);
    const systemView = parseSystemView(input.systemView, geometry);
    if (input.placement !== undefined && input.placement !== 'approximate') throw new TypeError('Unsupported orbital placement qualification.');
    if (input.unpackaged !== undefined && input.unpackaged !== true) throw new TypeError('A context body is unpackaged or not.');
    if (input.labelPlacement !== undefined && input.labelPlacement !== 'centre') throw new TypeError(`Context body ${String(input.id)} label placement is ${String(input.labelPlacement)}, not centre.`);
    // A placed star can name the star it is measured to be bound to, with the pair's centre of mass.
    const bound = input.boundTo === undefined ? undefined : (() => {
      const pair = record(input.boundTo, 'bound companion', ['hostId', 'centerM']);
      return { hostId: text(pair.hostId, 'bound companion host'), centerM: vector(pair.centerM, 'bound companion centre') };
    })();
    const body = { ...rawBody, ...(systemView ? { systemView } : {}), ...(bound ? { boundTo: bound } : {}),
      ...(input.placement === 'approximate' ? { placement: 'approximate' as const } : {}), ...(input.unpackaged === true ? { unpackaged: true as const } : {}),
      ...(input.orbitsWithinM === undefined ? {} : { orbitsWithinM: positive(input.orbitsWithinM, `context body ${String(input.id)} orbit range`) }),
      ...(input.labelPlacement === 'centre' ? { labelPlacement: 'centre' as const } : {}) };
    if (input.orbit === undefined) return Object.freeze(body);
    if (!geometry) return Object.freeze({ ...body, orbit: parseSummaryOrbit(input.orbit) });
    return Object.freeze({ ...body, orbit: validateOrbitGeometry(jsonOrbitGeometry(input.orbit), body.positionM, focus.id, renderedIds, body.id) });
  });
  if (bodies.length === 0) throw new TypeError('World context requires bodies.');
  unique([focus.id, ...bodies.map(body => body.id)], 'context body identities');
  const orbitCenters = parsePreparedOrbitCenters(input.orbitCenters, focus, bodies);
  // A member orbits its system's parent, or a named centre placed off it (a circumbinary planet's barycentre).
  for (const body of [focus, ...bodies]) for (const [index, id] of (body.systemView?.memberIds ?? []).entries()) {
    const moon = bodies.find(moon => moon.id === id && moon.orbit !== undefined &&
      (moon.orbit.centerBodyId === body.id || orbitCenters?.[moon.orbit.centerBodyId]?.centerBodyId === body.id));
    if (!moon) {
      throw new TypeError(`System view member ${id} of ${body.id} must orbit ${body.id} or a centre placed off it.`);
    }
    if (moon.radiusM !== body.systemView!.memberRadiiM[index]) throw new TypeError('System view radii must match their prepared members.');
  }
  const classificationViews = geometry ? parseClassificationViews(input.classificationViews, bodies) : undefined;
  const camera = record(input.camera, 'context camera', ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation']);
  const volume = record(input.volume, 'context volume', ['objectId', 'fadeStartDistanceM', 'fullDistanceM', 'opacityProfile', 'brightnessProfile']);
  const stars = record(input.stars, 'context stars', ['objectId', 'fadeStartDistanceM', 'fullDistanceM']);
  const starId = text(stars.objectId, 'star field identity');
  const starStart = positive(stars.fadeStartDistanceM, 'star field fade start');
  const starFull = positive(stars.fullDistanceM, 'star field full distance');
  const system = record(input.system, 'context system', ['fadeOutStartDistanceM', 'hiddenDistanceM']);
  const sky = parseSky(input.sky);
  const minimumDistanceM = positive(camera.minimumDistanceM, 'minimum camera distance');
  const maximumDistanceM = positive(camera.maximumDistanceM, 'maximum camera distance');
  const framingReferenceZoom = positive(camera.framingReferenceZoom, 'framing reference zoom');
  const presentation = parsePresentation(camera.presentation);
  const fadeStartDistanceM = positive(volume.fadeStartDistanceM, 'volume fade start');
  const fullDistanceM = positive(volume.fullDistanceM, 'volume full distance');
  if (!/^[a-z][a-z0-9-]*$/.test(starId) || !(starStart < starFull && starFull < fadeStartDistanceM)) {
    throw new TypeError('Context star field must resolve before its volume handoff.');
  }
  const fadeOutStartDistanceM = positive(system.fadeOutStartDistanceM, 'context fade start');
  const hiddenDistanceM = positive(system.hiddenDistanceM, 'context hidden distance');
  if (!(maximumDistanceM > fullDistanceM && fullDistanceM > fadeStartDistanceM && hiddenDistanceM > fadeOutStartDistanceM && maximumDistanceM > minimumDistanceM)) {
    throw new TypeError('World context distance intervals are invalid.');
  }
  const objectId = text(volume.objectId, 'volume identity');
  if (!/^[a-z][a-z0-9-]*$/.test(objectId)) throw new TypeError('Invalid context volume identity.');
  const result: PreparedWorldContext = Object.freeze({ schema, frame, focus, bodies: Object.freeze(bodies),
    ...(input.orbitCenters === undefined ? {} : { orbitCenters }),
    ...(classificationViews ? { classificationViews } : {}), ...(orbitBank ? { orbitBank } : {}),
    camera: Object.freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom, presentation }),
    volume: Object.freeze({ objectId, fadeStartDistanceM, fullDistanceM,
      ...(volume.opacityProfile === undefined ? {} : { opacityProfile: parseVolumeOpacityProfile(volume.opacityProfile) }),
      ...(volume.brightnessProfile === undefined ? {} : { brightnessProfile: parseVolumeOpacityProfile(volume.brightnessProfile) }) }),
    stars: Object.freeze({ objectId: starId, fadeStartDistanceM: starStart, fullDistanceM: starFull }),
    system: Object.freeze({ fadeOutStartDistanceM, hiddenDistanceM }), sky });
  validatedContexts.add(result);
  return result;
}

function parseVolumeOpacityProfile(value: unknown): PreparedVolumeOpacityProfile {
  const input = record(value, 'volume opacity profile', ['model', 'nearOpacity', 'fullOpacity', 'fadeStartDistanceM', 'fullDistanceM']);
  if (input.model !== 'logarithmic-distance') throw new TypeError('Unsupported volume opacity profile model.');
  const nearOpacity = finite(input.nearOpacity, 'volume near opacity'), fullOpacity = finite(input.fullOpacity, 'volume full opacity');
  const fadeStartDistanceM = positive(input.fadeStartDistanceM, 'volume opacity fade start'), fullDistanceM = positive(input.fullDistanceM, 'volume opacity full distance');
  if (nearOpacity < 0 || nearOpacity > 1 || fullOpacity < 0 || fullOpacity > 1 || !(fadeStartDistanceM < fullDistanceM)) throw new TypeError('Volume opacity profile is invalid.');
  return Object.freeze({ model: input.model, nearOpacity, fullOpacity, fadeStartDistanceM, fullDistanceM });
}
