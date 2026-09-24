import { ContextChange, createWorldContextFrameReceiver } from './world-context/world-context-frame.js';
import { createContextSelectionPolicy } from './context-presentation-policy.js';
import type { WorldContextPublication } from './world-context/world-context-frame.js';
import type { WorldContextView } from './world-context/world-context-planner.js';
import { parsePreparedOrbitCenters } from './prepared-orbit-centers.js';
import { createSystemFade, createWorldContextPlanner, logarithmicFade, BODY_INDICATOR_DIAMETER, CONTEXT_LINE_WIDTH } from './world-context/world-context-planner.js';
export { logarithmicFade } from './world-context/world-context-planner.js';
import type { PreparedOrbitCenter } from './prepared-orbit-centers.js';
import { screenPicking } from '../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';
import type { PositionM } from '@cssearth/engine';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { array, finite, numbers, positive, record, text, unique } from '../validation/guards.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssViewFromOrientation, validateWorldRotation } from '../navigation/world-camera-math.js';
import type { LevelOfDetailPlan, OrbitLineFade } from '../navigation/types.js';
import { applySpriteImage, MINIMUM_BODY_MARKER_DIAMETER_PIXELS } from '../solar-system/heliocentric-sprites.js';
import { mountPreparedOrbitLines, ORBIT_RENDERER_LOD_PIXELS, type OrbitRenderer } from '../solar-system/prepared-orbit-lines.js';
import type { PreparedOrbitStrokes } from '../solar-system/prepared-orbit-strokes.js';
import { orbitProjectionCapacity } from '../solar-system/prepared-ring-projection.js';
import { bindObjectNavigationTarget } from '../solar-system/heliocentric-navigation.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import type { OrbitSegment } from '../solar-system/types.js';

import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { OpacityClock } from '../stars/opacity-clock.js';

// A fixed leaf carries the prepared image and its two screen-sized pseudos.
// Camera movement writes one transform; the inverse scale only compensates
// those two pseudos when the projected image diameter changes.
const BILLBOARD_SIZE = BODY_INDICATOR_DIAMETER;
// A marker keeps its large image until it shrinks below this share of the
// switch diameter, so a body at the boundary never alternates images.
const SPRITE_DETAIL_RETURN = .75;

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

/** Applies prepared grading by common-focus distance, independently of camera angle or selected detail. */
export function preparedVolumeOpacity(distanceM: number, profile?: PreparedVolumeOpacityProfile): number {
  if (!profile) return 1;
  const fade = logarithmicFade(distanceM, profile.fadeStartDistanceM, profile.fullDistanceM);
  return profile.nearOpacity + (profile.fullOpacity - profile.nearOpacity) * fade;
}

/** Existing retained segment/sprite rendering, driven by the same observer as the detailed body. */
export function mountPreparedWorldContext({ host, presentationHost = host, before, plan, sprites, requestPublication, annotationPriorities = {}, annotationLandmarks = [], annotationOpacities = {}, distantNavigation, opacityClock, orbitRenderer: initialOrbitRenderer = 'bars' }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; sprites: Readonly<Record<string, SpriteWithUrl>>;
  /** Which retained paint owner draws the prepared orbit lines. */
  /** Presentation may live outside the input host's changing CSS scope. */
  presentationHost?: HTMLElement;
  requestPublication?: () => boolean;
  annotationPriorities?: Readonly<Record<string, number>>;
  annotationLandmarks?: readonly string[];
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  distantNavigation?: { readonly afterDistanceM: number; readonly nonNavigableIds: readonly string[] };
  opacityClock?: OpacityClock;
  orbitRenderer?: OrbitRenderer;
}) {
  if (distantNavigation && (!Number.isFinite(distantNavigation.afterDistanceM) || distantNavigation.afterDistanceM <= 0)) {
    throw new TypeError('Distant navigation requires a positive finite distance.');
  }
  const distantNonNavigableIds = new Set(distantNavigation?.nonNavigableIds ?? []);
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-world-context';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.dataset.worldContext = plan.focus.id;
  presentationHost.insertBefore(root, before);
  const picking = screenPicking(host);
  let presentationRevision = 0, policyRevision = 0, publishedPolicyRevision = -1;
  let distantNavigationActive = false;
  const contextFrames = createWorldContextFrameReceiver();
  let previousHeader: { emphasizedId: string | null; selectionStrength: number; width: number; height: number } | null = null;
  let pickTargets: ScreenPickTarget[] = [];
  const points = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  const selectionPolicy = createContextSelectionPolicy(plan);
  const orbitRenderer: OrbitRenderer = initialOrbitRenderer;
  let publishCount = 0;
  const bodies = [plan.focus, ...plan.bodies].map((body, index) => {
    // A body drawn from its astronomy record has no package, so no prepared sprite and no page: it keeps its ring,
    // name and orbit and is never a navigation target.
    const unpackaged = 'unpackaged' in body && body.unpackaged === true;
    const sprite = sprites[body.id];
    if (!sprite && !unpackaged) { root.remove(); throw new TypeError(`Missing prepared navigation sprite ${body.id}.`); }
    const marker = host.ownerDocument.createElement('s');
    marker.dataset.contextGroup = body.id;
    marker.dataset.contextBody = body.id;
    marker.dataset.contextLabel = body.id;
    marker.dataset.contextName = body.name;
    marker.dataset.contextIndicatorVisible = 'false';
    marker.dataset.contextLabelVisible = 'false';
    marker.dataset.contextAnnotationsAnimate = 'false';
    // Visibility and opacity belong to the mover; the marker and its pseudos inherit them.
    marker.style.cssText = 'position:absolute;inset:0;pointer-events:none;text-decoration:none;transform-origin:0 0';
    // The sprite scales alone. Scaling the marker made its ring and caption pseudos counter-scale through an inherited
    // custom property, which re-resolved the marker and both pseudos for every moving body on every frame.
    const spriteLeaf = host.ownerDocument.createElement('i');
    spriteLeaf.style.cssText = `position:absolute;left:0;top:0;width:${BILLBOARD_SIZE}px;height:${BILLBOARD_SIZE}px;background-repeat:no-repeat;transform-origin:50% 50%;pointer-events:none`;
    if (sprite) applySpriteImage(spriteLeaf, sprite);
    marker.appendChild(spriteLeaf);
    // A packaged body's colour is its swatch stylesheet; a body drawn from its record carries its prepared colour.
    if (unpackaged) marker.style.color = body.color;
    const approximate = 'placement' in body && body.placement === 'approximate';
    if (approximate) {
      marker.dataset.contextPlacement = 'approximate';
      marker.dataset.contextName = `${body.name} (approx)`;
      marker.title = `${body.name} · Approximate orbital placement`;
    }
    marker.style.width = marker.style.height = `${BILLBOARD_SIZE}px`;
    marker.style.margin = '0';
    marker.style.marginLeft = marker.style.marginTop = '0';
    const baseAlpha = annotationOpacities[body.id] ?? { line: .65, label: .65 };
    marker.style.setProperty('--context-line-alpha', String(baseAlpha.line));
    marker.style.setProperty('--context-label-alpha', String(baseAlpha.label));
    // A bare mover carries the per-frame transform and paint order. The marker,
    // with its ring and caption pseudo-elements and attribute rules, keeps a
    // stable style, so motion restyles one plain leaf instead of three nodes.
    const mover = host.ownerDocument.createElement('b');
    // A fixed-size box with layout and size containment is a relayout boundary: a
    // marker's visibility or cue change lays out these three boxes, not the document.
    mover.style.cssText = `position:absolute;left:0;top:0;width:${BILLBOARD_SIZE}px;height:${BILLBOARD_SIZE}px;transform-origin:0 0;pointer-events:none;contain:layout size;visibility:hidden`;
    mover.appendChild(marker);
    root.appendChild(mover);
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    const orbitRoot = host.ownerDocument.createElement('div');
    orbitRoot.className = 'context-orbit';
    orbitRoot.dataset.contextOrbit = body.id;
    // The orbit is an independent retained paint owner, beside the billboard.
    // Bars draw inside the root, which places and orders them. Strokes draw in the shared SVG; a positioned,
    // transformed root would paint nothing yet become its own WebKit layer over the composited sky and globe.
    orbitRoot.style.cssText = orbitRenderer === 'bars' ? 'position:absolute;inset:0;width:0;height:0;pointer-events:none' : 'pointer-events:none';
    if (approximate) orbitRoot.dataset.contextPlacement = 'approximate';
    if (orbit) root.insertBefore(orbitRoot, mover);
    const piecePool = mountPreparedOrbitLines(orbitRoot, { renderer: orbitRenderer, dashed: approximate, capacity: orbitProjectionCapacity(orbit?.vertexCount ?? 0), id: body.id,
      ...(unpackaged ? { color: body.color } : {}) });
    const pieces = piecePool.elements;
    // The stage picker owns every pointer hit: these leaves stay inert and only
    // carry keyboard and accessibility state, never pointer or cursor styles.
    const navigation = bindObjectNavigationTarget(marker, host, { pointerTarget: false });
    const orbitNavigation = orbit ? bindObjectNavigationTarget(orbitRoot, host, { pointerTarget: false }) : null;
    return { index, body, sprite, unpackaged, marker, spriteLeaf, mover, orbit, orbitRoot, parent: orbit ? points.get(orbit.centerBodyId) ?? null : null, pieces, piecePool, navigation, orbitNavigation,
      closedOrbit: orbit?.fullTrail === true,
      indicatorRadius: BODY_INDICATOR_DIAMETER / 2,
      indicatorHovered: false,
      orbitPick: null as ScreenPickTarget | null,
      markerPick: null as ScreenPickTarget | null, labelPick: null as ScreenPickTarget | null,
      // Retained hit targets, updated in place: none are allocated per frame.
      markerPickTarget: null as (ScreenPickTarget & { shape: { kind: 'circle'; x: number; y: number; radius: number } }) | null,
      indicatorPickTarget: null as (ScreenPickTarget & { shape: { kind: 'circle'; x: number; y: number; radius: number } }) | null,
      orbitPickTarget: null as (ScreenPickTarget & { shape: { kind: 'segments'; segments: readonly OrbitSegment[]; bounds: LabelScreenRect | null; halfWidth: number } }) | null,
      labelPickTarget: null as (ScreenPickTarget & { shape: { kind: 'rect'; left: number; top: number; right: number; bottom: number } }) | null,
      labelRectTarget: null as { left: number; top: number; right: number; bottom: number } | null,
      markerShown: undefined as boolean | undefined, markerDiameter: 0, billboardShown: undefined as boolean | undefined, spriteDetail: false,
      center: [0, 0] as [number, number], markerTransform: '', spriteTransform: '', orbitTransform: '', labelOffset: '',
      labelRect: null as LabelScreenRect | null,
      indicatorPick: null as ScreenPickTarget | null,
      orbitAppearance: { width: CONTEXT_LINE_WIDTH, opacity: 1 },
      orbitNavigable: false,
      bodyHidden: false, orbitHidden: false, labelHidden: false, labelSuppressed: false, indicatorHidden: false,
      highlighted: false,
      baseAlpha,
      hovered: false, groupHovered: false,
      labelSize: { width: 0, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorCutout: false, previousCount: 0 };
  });
  // One caption follows the destination through the entire flight. Its preview sprite has a
  // separate lifetime and fades at 14–20px, long before the close-up has arrived.
  const flightCaption = host.ownerDocument.createElement('span');
  flightCaption.className = 'context-flight-caption';
  flightCaption.dataset.contextFlightLabel = '';
  flightCaption.style.visibility = 'hidden';
  flightCaption.setAttribute('aria-hidden', 'true');
  root.appendChild(flightCaption);
  const flightCircle = host.ownerDocument.createElement('span');
  flightCircle.className = 'context-flight-circle';
  flightCircle.dataset.contextFlightCircle = '';
  flightCircle.style.visibility = 'hidden';
  flightCircle.setAttribute('aria-hidden', 'true');
  root.appendChild(flightCircle);
  // The app plans every frame in the worker. Only a caller that publishes without a
  // prepared frame plans here, and that needs the full context with its orbit paths.
  let syncPlanner: ReturnType<typeof createWorldContextPlanner> | undefined;
  const planWorld = (view: WorldContextView) => (syncPlanner ??= createWorldContextPlanner(worldContextGeometry(plan), annotationPriorities, annotationLandmarks))(view);
  const systemFade = createSystemFade(plan);
  const windowTarget = host.ownerDocument.defaultView!;
  const ownClock = opacityClock ?? createOpacityClock(windowTarget);
  const clock = ownClock;
  const fader = createOpacityFader(windowTarget, clock);
  let labelExclusions: readonly LabelScreenRect[] = [];
  let backgroundExclusions: readonly LabelScreenRect[] = [];
  let destroyed = false;
  let selectedId = plan.focus.id;
  let selectedEntry = bodies[0]!;
  // Beyond the system only the locators keep publishing: the anchor and every placed orbitless body.
  const anchorOnly = bodies.filter((entry, index) => index === 0 || !entry.orbit);
  let systemRetired = false;
  let depthOrientation: readonly number[] | null = null;
  let depthSelection: string | null = null;
  let depthBodies = bodies;
  let depthOrder = bodies;
  let pickRanks = new Map<(typeof bodies)[number], number>();
  let overview = false;
  let highlighting = false;
  let selectionPreview: string | null | undefined;
  let navigationInFlight = false;
  let rotationActive = false;
  let preserveReleasedAnnotations = false;
  let labelBlockers: readonly LabelScreenRect[] = [];
  let hoverIntent = false;
  const animatedAnnotations = new Set<(typeof bodies)[number]>();
  // The prepared bank stays mounted. Only owners currently contributing paint
  // participate in camera-depth updates and picking/sprite aggregation.
  const paintedBodies = new Set<(typeof bodies)[number]>();
  let paintedOrder: typeof bodies = [], paintMembershipChanged = false;
  let skippedPublications = 0, bodyPublications = 0, depthPublications = 0;
  const cameraState = new Float64Array(12).fill(NaN);
  const sameCamera = (world: WorldCameraPose, viewport: WorldCameraViewport) =>
    world.pose.positionM.every((value, axis) => value === cameraState[axis]) &&
    world.pose.orientationXyzw.every((value, axis) => value === cameraState[axis + 3]) &&
    viewport.focalPixels === cameraState[7] &&
    (viewport.widthPixels ?? host.clientWidth) === cameraState[8] &&
    (viewport.heightPixels ?? host.clientHeight) === cameraState[9] &&
    viewport.principalOffsetPixels.every((value, axis) => value === cameraState[axis + 10]);
  const settleHover = () => {
    fader.setAnimationEnabled(false);
    for (const entry of animatedAnnotations) {
      entry.marker.dataset.contextAnnotationsAnimate = 'false';
      if (!entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
    }
    animatedAnnotations.clear();
  };
  const beginCameraInput = () => { hoverIntent = false; settleHover(); };
  // The shared input surface is a sibling of the paint host. Match the
  // picking owner's capture boundary so cancellation precedes its hover clear.
  windowTarget.addEventListener('pointerdown', beginCameraInput, { capture: true });
  windowTarget.addEventListener('wheel', beginCameraInput, { capture: true, passive: true });
  let latest: { world: WorldCameraPose; viewport: WorldCameraViewport } | null = null;
  // Without a worker publication, only a layer holding the full context can plan here. A summary-only layer waits for
  // the next worker frame: after an interrupted flight the queue holds no current request, and planning the summary throws.
  const planOnThread = plan.schema === 'cssearth-world-context@1';
  const refresh = () => {
    if (latest && !requestPublication?.() && planOnThread) layer.publish(latest.world, latest.viewport);
  };
  const invalidateLabelSizes = () => { presentationRevision++; policyRevision++; for (const entry of bodies) entry.labelSize.width = 0; };
  const fonts = host.ownerDocument.fonts;
  fonts?.addEventListener('loadingdone', invalidateLabelSizes);
  let annotationFrame: number | null = null;
  let interactionDirty = true;
  const refreshAnnotations = (event?: Event) => {
    if (event?.type === 'focusin' || event?.type === 'focusout' ||
        (event?.type === 'objecthoverchange' && (event as CustomEvent<{ interactive?: boolean }>).detail?.interactive !== false)) hoverIntent = true;
    // Hover and focus decide which annotations show, never where bodies project:
    // the plan in flight stays valid, and the queue replans once it has committed.
    interactionDirty = true;
    if (destroyed || annotationFrame !== null) return;
    annotationFrame = clock.request(() => {
      annotationFrame = null;
      if (!destroyed) refresh();
    });
  };
  const readView = (world: WorldCameraPose, viewport: WorldCameraViewport): WorldContextView => {
      if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt) {
        throw new TypeError('Context and camera reference frames differ.');
      }
      // Hover/focus events own interaction changes. A camera sample consumes
      // their latest state without polling every retained body's DOM again.
      if (interactionDirty) {
        interactionDirty = false;
        const activeElement = host.ownerDocument.activeElement;
        for (const entry of bodies) {
          entry.groupHovered = entry.marker.dataset.objectHovered === 'true' || entry.orbitRoot.dataset.objectHovered === 'true';
          entry.hovered = entry.groupHovered || activeElement === entry.marker;
          // Open the final gap before growth. Keep it open during shrink;
          // transitionend restores the resting radius without a layout read.
          if (entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2 + 2;
          else if (!hoverIntent || rotationActive || navigationInFlight || !sameCamera(world, viewport)) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
        }
      }
      const opacity = systemFade.update(world.pose.positionM);
      // Publish the first zero-opacity frame normally to retire picking and
      // annotations. Later frames need only the anchor locator; its siblings
      // keep their prepared DOM without further visibility work.
      const publishingBodies = opacity === 0 && systemRetired ? anchorOnly : bodies;
      // Cache the retained UI text bounds before any projection writes.
      for (const entry of publishingBodies) if (entry.labelSize.width === 0) {
        const text = windowTarget.getComputedStyle(entry.marker, '::after');
        entry.labelSize = { width: Math.ceil(parseFloat(text.width)), height: Math.ceil(parseFloat(text.height)) };
      }
      return { world, viewport: { ...viewport,
        widthPixels: viewport.widthPixels ?? host.clientWidth, heightPixels: viewport.heightPixels ?? host.clientHeight },
        contextCommittedId: contextFrames.committedId,
        selectedId, overview, selectionPreview, navigationInFlight, rotationActive,
        preserveCommittedAnnotations: preserveReleasedAnnotations, labelBlockers, anchorOnly: publishingBodies === anchorOnly,
        orbitLodPixels: ORBIT_RENDERER_LOD_PIXELS[orbitRenderer],
        bodies: bodies.map(({ hovered, bodyHidden, orbitHidden, labelHidden, labelSuppressed, indicatorHidden, highlighted, labelSize, labelShown, labelPlacement,
          indicatorShown, indicatorRadius, orbitAppearance }) => ({ hovered, bodyHidden, orbitHidden, labelHidden, labelSuppressed, indicatorHidden, highlighted, labelSize,
          labelShown, labelPlacement, indicatorShown, indicatorRadius, orbitAppearance })) };
  };
  const layer = Object.freeze({ root,
    captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport) {
      const view = readView(world, viewport), revision = presentationRevision;
      return { view, current: () => !destroyed && revision === presentationRevision };
    },
    setLabelBlockers(rects: readonly LabelScreenRect[]) {
      labelBlockers = rects; presentationRevision++; policyRevision++; refresh();
    },
    labelExclusionRects: () => labelExclusions,
    backgroundExclusionRects: () => backgroundExclusions,
    setNavigationInFlight(active: boolean) {
      if (destroyed || active === navigationInFlight) return;
      presentationRevision++; policyRevision++;
      navigationInFlight = active;
      if (active) { hoverIntent = false; settleHover(); }
      systemRetired = false;
      // A flight clears the stage picker, which owns every pointer hit. Keyboard
      // and accessibility state stays as it was and catches up once the flight
      // ends: disabling and restoring every body restyled each marker twice.
      if (active) picking.publish(root, []);
      refresh();
    },
    previewSelection(id?: string | null) {
      if (destroyed) return;
      if (selectionPreview !== id) settleHover();
      presentationRevision++; policyRevision++;
      selectionPreview = id;
      refresh();
    },
    setOverview(enabled: boolean) {
      if (overview === enabled || destroyed) return;
      settleHover();
      presentationRevision++; policyRevision++;
      overview = enabled;
      refresh();
    },
    setHiddenBodies(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.bodyHidden !== next) { entry.bodyHidden = next; changed = true; }
      }
      if (changed) {
        depthBodies = bodies.filter(entry => !entry.bodyHidden || entry === selectedEntry);
        depthOrientation = null;
        presentationRevision++; policyRevision++; refresh();
      }
    },
    setHiddenOrbits(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.orbitHidden !== next) { entry.orbitHidden = next; changed = true; }
      }
      if (changed) { presentationRevision++; policyRevision++; refresh(); }
    },
    setHiddenLabels(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.labelHidden !== next) { entry.labelHidden = next; changed = true; }
      }
      if (changed) { presentationRevision++; policyRevision++; refresh(); }
    },
    setSuppressedLabels(ids: readonly string[]) {
      if (destroyed) return;
      const suppressed = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = suppressed.has(entry.body.id);
        if (entry.labelSuppressed !== next) { entry.labelSuppressed = next; changed = true; }
      }
      if (changed) { presentationRevision++; policyRevision++; refresh(); }
    },
    setRotationActive(active: boolean) {
      if (destroyed || rotationActive === active) return;
      preserveReleasedAnnotations = rotationActive && !active;
      rotationActive = active;
      if (active) { hoverIntent = false; settleHover(); }
      // Keep the established system landmarks through the first settled frame.
      // Background annotations continue ordinary admission throughout the drag.
      presentationRevision++;
      if (!active) policyRevision++;
      refresh();
    },
    setHiddenIndicators(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.indicatorHidden !== next) { entry.indicatorHidden = next; changed = true; }
      }
      if (changed) { presentationRevision++; policyRevision++; refresh(); }
    },
    /** Emphasize a set of bodies, such as one classification, on the retained nodes.
     * The marker carries the flag; its ring and caption are its own pseudo-elements. */
    setHighlighted(ids: readonly string[]) {
      if (destroyed) return;
      const highlighted = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = highlighted.has(entry.body.id);
        if (entry.highlighted === next) continue;
        entry.highlighted = next; changed = true;
        if (next) entry.marker.dataset.contextHighlight = 'true'; else delete entry.marker.dataset.contextHighlight;
      }
      highlighting = bodies.some(entry => entry.highlighted);
      if (highlighting) root.dataset.contextHighlighting = 'true'; else delete root.dataset.contextHighlighting;
      if (changed) { presentationRevision++; policyRevision++; refresh(); }
    },
    opacityStats: fader.stats,
    publicationStats: () => ({ skippedPublications, bodyPublications, depthPublications, paintedBodies: paintedBodies.size }),
    inspect() {
      return Object.freeze(bodies.map(entry => Object.freeze({
        id: entry.body.id, billboard: entry.marker, mover: entry.mover,
        get markerShown() { return entry.markerShown; },
        get indicatorShown() { return entry.indicatorShown; },
        get labelShown() { return entry.labelShown; },
        get center() { return entry.center; },
        get labelRect() { return entry.labelRect; },
        // Orbit leaves are built on first use; report the retained leaves now.
        get orbit() { return Object.freeze(entry.pieces.filter((piece): piece is HTMLElement | SVGElement => piece !== undefined)); },
      })));
    },
    selectObject(id: string) {
      const entry = bodies.find(entry => entry.body.id === id);
      if (!entry) throw new TypeError('Selected context body is unavailable.');
      settleHover();
      presentationRevision++; policyRevision++;
      selectedId = id;
      selectedEntry = entry;
      depthBodies = bodies.filter(entry => !entry.bodyHidden || entry === selectedEntry);
      depthOrientation = null;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, preparedFrame?: WorldContextPublication) {
      // A user-timing mark once a second names the orbit renderer inside any performance trace.
      if (publishCount++ % 60 === 0) windowTarget.performance?.mark?.(`cssearth-orbit-renderer:${orbitRenderer}`);
      if (destroyed) return;
      fader.batch(() => {
      const cameraChanged = !sameCamera(world, viewport);
      const nextDistantNavigationActive = distantNavigation !== undefined && Math.hypot(
        world.pose.positionM[0] - plan.focus.positionM[0],
        world.pose.positionM[1] - plan.focus.positionM[1],
        world.pose.positionM[2] - plan.focus.positionM[2],
      ) >= distantNavigation.afterDistanceM;
      const distantNavigationChanged = nextDistantNavigationActive !== distantNavigationActive;
      distantNavigationActive = nextDistantNavigationActive;
      const interactiveHover = hoverIntent && !cameraChanged && !rotationActive && !navigationInFlight;
      if (cameraChanged || rotationActive || navigationInFlight) settleHover();
      const view = preparedFrame ? null : readView(world, viewport);
      hoverIntent = false;
      const opacity = preparedFrame?.opacity ?? systemFade.update(world.pose.positionM);
      const delta = preparedFrame && 'updates' in preparedFrame ? contextFrames.accept(preparedFrame) : null;
      if (!delta) contextFrames.invalidate();
      const frame = delta?.frame ?? (preparedFrame as Exclude<WorldContextPublication, { updates: unknown }> | undefined) ?? planWorld(view!);
      if (!rotationActive) preserveReleasedAnnotations = false;
      latest = { world, viewport }; systemRetired = opacity === 0;
      presentationRevision++;
      let ranksChanged = false;
      const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
      // Camera translation adds the same depth offset to every prepared body.
      // Only orientation changes their order; selection changes where the
      // retained detail layers (0..3) sit within that order.
      // A rotation keeps the committed paint order; it is re-sorted once on release.
      // Re-ranking every frame rewrote dozens of z-indices as one body changed place.
      if (!depthOrientation || (!rotationActive && depthOrientation.some((value, axis) => value !== world.pose.orientationXyzw[axis]))) {
        depthOrientation = [...world.pose.orientationXyzw];
        const depth = (entry: (typeof bodies)[number]) => -(
          rotation[6]! * entry.body.positionM[0] + rotation[7]! * entry.body.positionM[1] + rotation[8]! * entry.body.positionM[2]);
        depthOrder = [...depthBodies].sort((a, b) => depth(b) - depth(a));
        pickRanks = new Map(depthOrder.map((entry, index) => [entry, index * 4]));
        depthSelection = null; ranksChanged = true;
      }
      const depthChanged = ranksChanged || depthSelection !== selectedId;
      depthSelection = selectedId;
      const selectedRank = pickRanks.get(selectedEntry)!;
      const { emphasizedId, width, height } = frame;
      const selectionStrength = selectionPolicy.strengthAt(emphasizedId, world.pose.positionM);
      cameraState.set(world.pose.positionM, 0); cameraState.set(world.pose.orientationXyzw, 3);
      cameraState[7] = viewport.focalPixels; cameraState[8] = width; cameraState[9] = height;
      cameraState.set(viewport.principalOffsetPixels, 10);
      const resized = previousHeader?.width !== width || previousHeader?.height !== height;
      const policyChanged = !delta || resized || distantNavigationChanged || publishedPolicyRevision !== policyRevision || previousHeader?.emphasizedId !== emphasizedId ||
        previousHeader?.selectionStrength !== selectionStrength;
      publishedPolicyRevision = policyRevision;
      previousHeader = { emphasizedId, selectionStrength, width, height };
      if (!cameraChanged && !policyChanged && !depthChanged && !interactiveHover && delta?.changes.size === 0) {
        skippedPublications++;
        return;
      }
      const flightBody = navigationInFlight && emphasizedId !== null
        ? frame.projectedBodies.find(body => bodies[body.index].body.id === emphasizedId)
        : undefined;
      const captionBody = flightBody?.labelShown && flightBody.labelPosition ? flightBody : undefined;
      const circleVisible = flightBody?.indicatorShown && flightBody.annotationVisible;
      const circleVisibility = circleVisible ? '' : 'hidden';
      if (flightCircle.style.visibility !== circleVisibility) flightCircle.style.visibility = circleVisibility;
      if (circleVisible && flightBody) {
        const entry = bodies[flightBody.index];
        if (flightCircle.dataset.contextFlightCircle !== entry.body.id) flightCircle.dataset.contextFlightCircle = entry.body.id;
        const { billboardFadeStartDiscPixels: start, billboardFullDiscPixels: full } = plan.camera.presentation.levelOfDetail;
        const opacity = String(entry.baseAlpha.line * Math.max(0, Math.min(1, (start - flightBody.diameter) / (start - full))));
        if (flightCircle.style.opacity !== opacity) flightCircle.style.opacity = opacity;
        const transform = `translate(${Math.round((width / 2 + flightBody.x) * 1000) / 1000}px, ${Math.round((height / 2 + flightBody.y) * 1000) / 1000}px) translate(-50%, -50%)`;
        if (flightCircle.style.transform !== transform) flightCircle.style.transform = transform;
      }
      const captionVisibility = captionBody ? '' : 'hidden';
      if (flightCaption.style.visibility !== captionVisibility) flightCaption.style.visibility = captionVisibility;
      if (captionBody?.labelPosition) {
        const entry = bodies[captionBody.index];
        if (flightCaption.dataset.contextFlightLabel !== entry.body.id) {
          flightCaption.dataset.contextFlightLabel = entry.body.id;
          flightCaption.textContent = entry.marker.dataset.contextName!;
          flightCaption.style.opacity = String(entry.baseAlpha.label);
        }
        const [x, y] = captionBody.labelPosition;
        const transform = `translate(${Math.round((width / 2 + x) * 1000) / 1000}px, ${Math.round((height / 2 + y) * 1000) / 1000}px)`;
        if (flightCaption.style.transform !== transform) flightCaption.style.transform = transform;
      }
      const candidates = delta && !policyChanged ? delta.changed : frame.projectedBodies;
      const projectedBodies = candidates.map(projected => {
        const entry = bodies[projected.index];
        entry.labelShown = projected.labelShown;
        entry.labelPlacement = projected.labelPlacement;
        entry.indicatorShown = projected.indicatorShown;
        entry.indicatorCutout = projected.indicatorCutout;
        entry.orbitAppearance = projected.orbitAppearance;
        const changed = delta?.changes.get(projected.index) ?? 0;
        const mask = policyChanged ? ContextChange.all : changed;
        return { projected, entry, mask };
      });
      const acceptedRects: LabelScreenRect[] = [];
      pickTargets = [];
      const pickingChanged = policyChanged || ranksChanged || (delta?.changes.size ?? 1) > 0;
      const indicatorRects: LabelScreenRect[] = [];
      // Only the resolved presentation owns DOM visibility and hit targets.
      // A new depth order changes only z-order. It must not re-run the full
      // material/geometry publisher for every hidden or otherwise unchanged body.
      if (depthChanged) for (const entry of paintedOrder) {
        const rank = pickRanks.get(entry);
        if (rank === undefined) continue;
        depthPublications++;
        const relativeDepth = (rank - selectedRank) / 4;
        const zIndex = String(relativeDepth > 0 ? relativeDepth + 3 : relativeDepth);
        if (entry.billboardShown && entry.mover.style.zIndex !== zIndex) entry.mover.style.zIndex = zIndex;
        if (orbitRenderer === 'bars' && entry.previousCount > 0 && entry.orbitRoot.style.zIndex !== zIndex) entry.orbitRoot.style.zIndex = zIndex;
      }
      for (const { projected, entry, mask } of projectedBodies) {
        const { x, y, diameter, markerOpacity, visible, annotationVisible,
          lineWidth, orbitVisibility, segments, labelPosition, index } = projected;
        const { body, marker } = entry;
        const navigationSuppressed = entry.unpackaged || (distantNavigationActive && distantNonNavigableIds.has(body.id));
        if (mask === 0) continue;
        const emphasis = selectionPolicy.opacity(body.id, emphasizedId, entry.hovered, selectionStrength) *
          (highlighting && !entry.highlighted && !entry.hovered ? .3 : 1);
        const pointSource = body.id === plan.focus.id && plan.focus.pointSource !== undefined;
        // All three visual parts share this one zoom/selection alpha and
        // movement transform. The pseudos only own annotation visibility.
        const billboardShown = (visible || (annotationVisible && (entry.indicatorShown || entry.labelShown))) && markerOpacity > 0;
        if (!billboardShown && entry.billboardShown === false && orbitVisibility === 0 && entry.previousCount === 0) continue;
        bodyPublications++;
        const markerShown = visible && markerOpacity > 0 && !pointSource;
        // A twentieth of a pixel is below what a scaled sprite shows. Rotation changes
        // every marker's distance a little each frame; without this step every marker
        // and its ring and caption pseudo-elements would restyle on every frame.
        const markerDiameter = Math.round(Math.max(entry.sprite?.minimumDiameterPixels ?? MINIMUM_BODY_MARKER_DIAMETER_PIXELS, diameter) * 20) / 20;
        const wasShown = entry.billboardShown === true;
        const hoverChanged = entry.indicatorHovered !== entry.hovered;
        const animateHover = interactiveHover && hoverChanged && wasShown && billboardShown;
        // Visibility has its own immediate CSS property. Only deliberate
        // stationary hover arms opacity/transform transitions on this leaf.
        if (animateHover) { animatedAnnotations.add(entry); fader.setAnimationEnabled(true); }
        if (!billboardShown || (hoverChanged && !animateHover)) animatedAnnotations.delete(entry);
        const animateAnnotations = String(animatedAnnotations.has(entry));
        if (marker.dataset.contextAnnotationsAnimate !== animateAnnotations) marker.dataset.contextAnnotationsAnimate = animateAnnotations;
        if (!billboardShown && !entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
        fader.visible(entry.mover, billboardShown);
        // The mover is hidden with its marker: a visible, transformed mover with nothing to draw still becomes a layer.
        if (entry.billboardShown !== billboardShown) marker.style.visibility = entry.mover.style.visibility = billboardShown ? '' : 'hidden';
        entry.billboardShown = billboardShown;
        if (entry.markerShown !== markerShown) marker.dataset.contextBodyVisible = String(markerShown);
        entry.markerShown = markerShown; entry.markerDiameter = markerDiameter;
        const rank = pickRanks.get(entry)!;
        const relativeDepth = (rank - selectedRank) / 4;
        const zIndex = String(relativeDepth > 0 ? relativeDepth + 3 : relativeDepth);
        // Styles distinguish only the emphasized body. Overview shares the unselected
        // value, so a new selection restyles its two owners, not every marker and chord.
        const selection = String(emphasizedId !== null && body.id === emphasizedId);
        if (billboardShown) {
          // Depth and selection are retained per paint owner. Off-screen
          // owners catch up here before reveal, without global restyling.
          // A marker wider than its small prepared tile resolves shows the large
          // prepared image; only then is that image loaded and decoded.
          const detail = entry.sprite?.detail;
          if (detail) {
            const spriteDetail = markerDiameter >= detail.fromDiameterPixels ||
              (entry.spriteDetail && markerDiameter >= detail.fromDiameterPixels * SPRITE_DETAIL_RETURN);
            if (spriteDetail !== entry.spriteDetail) { entry.spriteDetail = spriteDetail; applySpriteImage(entry.spriteLeaf, spriteDetail ? detail : entry.sprite!); }
          }
          if (entry.mover.style.zIndex !== zIndex) entry.mover.style.zIndex = zIndex;
          if (marker.dataset.contextSelected !== selection) marker.dataset.contextSelected = selection;
          if (entry.indicatorHovered !== entry.hovered) {
            entry.indicatorHovered = entry.hovered;
            marker.dataset.contextIndicatorHovered = String(entry.hovered);
          }
          // Opacity lives on the mover, which has no pseudos: WebKit re-resolves an element's ::before and ::after with
          // every restyle of it, so a per-frame opacity on the marker restyled its ring and caption every frame.
          if (policyChanged || !wasShown || hoverChanged) fader.multiply(entry.mover, emphasis, animatedAnnotations.has(entry) ? 120 : 0);
          fader.set(entry.mover, markerOpacity);
          const transform = `translate(${width / 2 + x}px,${height / 2 + y}px) translate(-50%,-50%)`;
          // CSSOM serializes commas/spacing differently from the published
          // string. Compare against our last write, not its browser readback.
          if (entry.markerTransform !== transform) {
            entry.mover.style.transform = transform; entry.markerTransform = transform;
          }
          const spriteTransform = `scale(${markerDiameter / BILLBOARD_SIZE})`;
          if (entry.spriteTransform !== spriteTransform) {
            entry.spriteLeaf.style.transform = spriteTransform; entry.spriteTransform = spriteTransform;
          }
          entry.center = [x, y];
        }
        entry.markerPick = null;
        if (!navigationSuppressed && markerShown && markerOpacity > .1) {
          const radius = entry.indicatorHidden
            ? Math.max(markerDiameter / 2, entry.indicatorRadius + 5) : markerDiameter / 2;
          const target = entry.markerPickTarget ??= { element: marker, rank, shape: { kind: 'circle', x, y, radius } };
          target.rank = rank; target.shape.x = x; target.shape.y = y; target.shape.radius = radius;
          entry.markerPick = target;
        }
        const indicatorVisible = entry.indicatorShown;
        const indicatorState = String(indicatorVisible && !(navigationInFlight && body.id === emphasizedId));
        if (marker.dataset.contextIndicatorVisible !== indicatorState) marker.dataset.contextIndicatorVisible = indicatorState;
        if (!navigationSuppressed && indicatorVisible && markerOpacity > .1) {
          const target = entry.indicatorPickTarget ??= { element: marker, rank: rank + 2, shape: { kind: 'circle', x, y, radius: entry.indicatorRadius + 5 } };
          target.rank = rank + 2; target.shape.x = x; target.shape.y = y; target.shape.radius = entry.indicatorRadius + 5;
          entry.indicatorPick = target;
        } else entry.indicatorPick = null;
        const orbitShown = orbitVisibility > 0 && segments.length > 0;
        const contributesPaint = billboardShown || orbitShown;
        if (paintedBodies.has(entry) !== contributesPaint) {
          if (contributesPaint) paintedBodies.add(entry); else paintedBodies.delete(entry);
          paintMembershipChanged = true;
        }
        // The paint owner names the node that carries the orbit's presentation.
        const orbitPaint = entry.piecePool.presentation;
        if (entry.orbit && orbitShown) {
          if (orbitRenderer === 'bars' && entry.orbitRoot.style.zIndex !== zIndex) entry.orbitRoot.style.zIndex = zIndex;
          if (orbitPaint.dataset.contextSelected !== selection) orbitPaint.dataset.contextSelected = selection;
          fader.multiply(orbitPaint, entry.hovered ? 1 : entry.baseAlpha.line * emphasis, animatedAnnotations.has(entry) && entry.previousCount > 0 ? 120 : 0);
        }
        if (entry.orbit && (mask & ContextChange.orbit)) {
          const orbitTransform = `translate(${width / 2}px,${height / 2}px)`;
          if (orbitRenderer === 'bars' && entry.orbitTransform !== orbitTransform) {
            entry.orbitRoot.style.transform = orbitTransform; entry.orbitTransform = orbitTransform;
          }
          const navigable = !navigationSuppressed && orbitVisibility > 0.1 && !entry.orbitHidden;
          if (!navigationInFlight && !rotationActive && entry.orbitNavigable !== navigable) {
            entry.orbitNavigable = navigable;
            entry.orbitNavigation!.update(navigable ? body.id : null, body.name);
            // The stage picker owns the clipped corridor; paint nodes are inert.
            if (entry.orbitRoot.style.pointerEvents !== 'none') entry.orbitRoot.style.pointerEvents = 'none';
            if (entry.orbitRoot.tabIndex !== -1) entry.orbitRoot.tabIndex = -1;
          }
          fader.visible(orbitPaint, orbitShown);
          fader.set(orbitPaint, orbitVisibility);
          const patch = delta?.orbits.get(index);
          if (!delta || patch) {
            entry.piecePool.publish(segments);
            entry.previousCount = segments.length;
          }
          if (!navigationSuppressed && orbitVisibility > .1 && !entry.orbitHidden) {
            const target = entry.orbitPickTarget ??= { element: entry.orbitRoot, rank, shape: { kind: 'segments', segments, bounds: projected.orbitBounds, halfWidth: lineWidth / 2 + 7 } };
            target.rank = rank; target.shape.segments = segments; target.shape.bounds = projected.orbitBounds; target.shape.halfWidth = lineWidth / 2 + 7;
            entry.orbitPick = target;
          } else entry.orbitPick = null;

        }
        if (mask & (ContextChange.label | ContextChange.marker)) {
          const labelVisible = entry.labelShown;
          const labelState = String(labelVisible && !(navigationInFlight && body.id === emphasizedId));
          if (marker.dataset.contextLabelVisible !== labelState) marker.dataset.contextLabelVisible = labelState;
          entry.labelRect = null; entry.labelPick = null;
          if (labelVisible && labelPosition) {
            const offset = `translate(${Math.round((labelPosition[0] - x) * 1e6) / 1e6}px,${Math.round((labelPosition[1] - y) * 1e6) / 1e6}px)`;
            if (entry.labelOffset !== offset) {
              const [labelX, labelY] = offset.match(/-?[\d.]+/g)!.map(Number);
              marker.style.setProperty('--context-label-x', `${labelX}px`);
              marker.style.setProperty('--context-label-y', `${labelY}px`);
              entry.labelOffset = offset;
            }
            const rect = entry.labelRectTarget ??= { left: 0, top: 0, right: 0, bottom: 0 };
            rect.left = labelPosition[0]; rect.top = labelPosition[1];
            rect.right = labelPosition[0] + entry.labelSize.width; rect.bottom = labelPosition[1] + entry.labelSize.height;
            entry.labelRect = rect;
            const target = entry.labelPickTarget ??= { element: marker, rank: rank + 1, shape: { kind: 'rect', left: 0, top: 0, right: 0, bottom: 0 } };
            target.rank = rank + 1; target.shape.left = rect.left; target.shape.top = rect.top; target.shape.right = rect.right; target.shape.bottom = rect.bottom;
            entry.labelPick = navigationSuppressed ? null : target;
          }
        }
        // Flights and rotations keep keyboard/accessibility targets; they catch up after.
        if (!navigationInFlight && !rotationActive) entry.navigation.update(entry.markerPick || entry.indicatorPick || entry.labelPick ? body.id : null, body.name);
        // Pseudos and the sprite share the stage's precise retained hit shapes.
        if (marker.style.pointerEvents !== 'none') marker.style.pointerEvents = 'none';

      }
      // Aggregate retained picking/exclusion state in the original body order.
      // No segment traversal or style publication is needed for unchanged owners.
      if (paintMembershipChanged) {
        paintedOrder = [...paintedBodies].sort((a, b) => a.index - b.index);
        paintMembershipChanged = false;
      }
      for (const entry of paintedOrder) {
        const rank = pickRanks.get(entry)!;
        if (entry.markerPick) { entry.markerPick.rank = rank; pickTargets.push(entry.markerPick); }
        if (entry.indicatorPick) { entry.indicatorPick.rank = rank + 2; pickTargets.push(entry.indicatorPick); }
        if (entry.orbitPick) { entry.orbitPick.rank = rank; pickTargets.push(entry.orbitPick); }
        if (entry.labelPick) { entry.labelPick.rank = rank + 1; pickTargets.push(entry.labelPick); }
        if (entry.labelRect) acceptedRects.push(entry.labelRect);
        if (entry.indicatorShown && entry.billboardShown) {
          const [x, y] = entry.center, radius = entry.indicatorRadius;
          indicatorRects.push({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
        }
      }
      if (captionBody?.labelPosition) {
        const [left, top] = captionBody.labelPosition, size = bodies[captionBody.index].labelSize;
        acceptedRects.push({ left, top, right: left + size.width, bottom: top + size.height });
      }
      labelExclusions = acceptedRects;
      // Only drawn annotation footprints reserve background label space. An
      // orbit is a line through empty space, never an opaque screen rectangle.
      backgroundExclusions = [...acceptedRects, ...indicatorRects];
      if (pickingChanged) picking.publish(root, navigationInFlight ? [] : pickTargets);
      });
    },
    destroy() { if (!destroyed) { destroyed = true; picking.remove(root);
      if (annotationFrame !== null) clock.cancel(annotationFrame);
      host.removeEventListener('objecthoverchange', refreshAnnotations);
      windowTarget.removeEventListener('pointerdown', beginCameraInput, { capture: true });
      windowTarget.removeEventListener('wheel', beginCameraInput, { capture: true });
      for (const event of ['focusin', 'focusout']) presentationHost.removeEventListener(event, refreshAnnotations);
      root.removeEventListener('transitionend', finishIndicatorShrink); fader.destroy(); fonts?.removeEventListener('loadingdone', invalidateLabelSizes); labelExclusions = []; backgroundExclusions = []; for (const entry of bodies) { entry.navigation.destroy(); entry.orbitNavigation?.destroy(); } root.remove(); } },
  });
  const indicatorTransitions = new Map<Element, (typeof bodies)[number]>(bodies.map(entry => [entry.marker, entry]));
  const finishIndicatorShrink = (event: Event) => {
    if ((event as TransitionEvent).propertyName !== 'transform') return;
    const entry = indicatorTransitions.get(event.target as Element);
    if (!entry || entry.indicatorHovered || entry.indicatorRadius === BODY_INDICATOR_DIAMETER / 2) return;
    entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
    refreshAnnotations();
  };
  root.addEventListener('transitionend', finishIndicatorShrink);
  host.addEventListener('objecthoverchange', refreshAnnotations);
  for (const event of ['focusin', 'focusout']) presentationHost.addEventListener(event, refreshAnnotations);
  return layer;
}
