import { PREPARED_WORLD_CONTEXT_SCHEMA, PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA } from './world-schemas.js';
import { parsePresentation } from './world-camera.js';
import type { WorldPosition as PositionM } from './world-frame.js';
import { parsePreparedOrbitCenters } from './prepared-orbit-centers.js';
import type { PreparedOrbitCenter } from './prepared-orbit-centers.js';
import { parsePreparedWorldCameraFrame } from './world-frame.js';
import { array, finite, numbers, positive, record, text, unique } from './world-guards.js';
import type { PreparedWorldCameraFrame } from './world-frame.js';
import { validateWorldRotation } from '../registry/world-rotation.js';
import type { LevelOfDetailPlan, OrbitLineFade } from './world-presentation.js';
import type { PreparedOrbitStrokes } from './prepared-orbit-strokes.js';
import { expandWorldContextSummary, expandWorldSystem } from './world-context-summary.js';
import { parseClassificationViews, parseSystemView } from './world-system-view.js';
import type { PreparedSystemViewCandidate } from './world-system-view.js';

export interface PreparedContextPoint {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  /** The color its marker, orbit and caption take in the world, prepared from its swatch or catalogue color; absent, the
   * world's default. Set inline on its elements, so no page carries a stylesheet rule per body. */
  readonly contextColor?: string;
  /** A star, black hole or planet: its caption is in capitals. */
  readonly labelCase?: 'upper';
  /** A packaged body's catalogue classification and system name, so a page knows its systems without the object registry. */
  readonly classification?: string;
  readonly systemName?: string;
  /** Its catalogue discovery record, which the application reads for world visibility; opaque to the renderer. */
  readonly discovery?: Readonly<Record<string, unknown>>;
  /** Its arrival photograph, which the world draws once the body is large enough: the summary keeps this, not the arrival view. */
  readonly billboard?: Readonly<{ url: string; size: number; focalPixels: number; distanceM: number }>;
  /** Not a map target: drawn as a plain dot, its path in its own bank (packages/bake/src/world-context/spatial-context.ts). */
  readonly plainDot?: true;
  /** A star's dot color: its color dimmed by its luminosity, prepared from its package's cited radius and effective
   * temperature (site/build/prepare/prepare-spatial-context.ts). Absent, the dot takes `color`. */
  readonly dotColor?: string;
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
   * does not, and reads a system's from `system-views/<id>.json` (`parsePreparedSystemView`) when navigation frames it. */
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
  readonly schema: typeof PREPARED_WORLD_CONTEXT_SCHEMA | typeof PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA;
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: PreparedContextFocus;
  readonly bodies: readonly PreparedContextBody[];
  readonly orbitCenters?: Readonly<Record<string, PreparedOrbitCenter>>;
  /** The summary pins each orbit centre's binary orbit bank by byte length (`decodeWorldOrbitBank`); an orbit's bank is its
   * `centerBodyId`. */
  readonly orbitBanks?: Readonly<Record<string, number>>;
  readonly camera: { readonly minimumDistanceM: number; readonly maximumDistanceM: number; readonly framingReferenceZoom: number;
    readonly presentation: PreparedContextCameraPresentation };
  readonly volume: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number;
    /** The galaxy disc's half-height: how far from the body it looks at the camera is still inside it (galaxyOutsideFade). */
    readonly discHalfHeightM?: number;
    readonly opacityProfile?: PreparedVolumeOpacityProfile };
  readonly stars: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number };
  readonly system: { readonly fadeOutStartDistanceM: number; readonly hiddenDistanceM: number };
  readonly sky: { readonly sceneRegistration: string };
  /** How many bodies the whole world holds, read or not: what stacking and ordering count on. */
  readonly worldBodyCount?: number;
  /** The dot banks the bake wrote for the stars the summary only lists (plain-star-dots.ts in @cssearth/bake), by id. */
  readonly dotBanks?: readonly string[];
}
/** The build's table of the world (`world-index.json`, never served): every body in the full context's order, every object
 * with a file of world bodies from the root of the tree down, and the row of each plain-dot star nothing orbits, which its
 * object entry carries. A page finds a body through the object tree and the body's own entry instead. */
export interface PreparedWorldIndex {
  readonly order: readonly string[]; readonly files: readonly string[]; readonly rows: Readonly<Record<string, unknown>>;
}
/** One object's file of world bodies, named orbit centres and orbit bank pins (`parsePreparedWorldSystem`). `anywhere`: every
 * page reads it at startup (its bodies are drawn from anywhere, or it has places); `places`: the object has a `places.json`
 * of its children's files read on approach. */
export interface PreparedWorldSystem {
  readonly id: string; readonly bodies: readonly PreparedContextBody[];
  readonly orbitCenters: Readonly<Record<string, unknown>>; readonly orbitBanks: Readonly<Record<string, number>>;
  readonly anywhere: boolean; readonly places: boolean;
}
/** The full prepared file: orbit paths and detail levels for the planner worker and build tools. */
export interface PreparedWorldContextGeometry extends PreparedWorldContext {
  readonly schema: typeof PREPARED_WORLD_CONTEXT_SCHEMA;
  readonly bodies: readonly PreparedContextGeometryBody[];
  /** Each classification framed by its members' prepared positions. */
  readonly classificationViews?: Readonly<Record<string, NonNullable<PreparedContextBody['systemView']>>>;
}

export function vector(value: unknown, label: string): PositionM {
  const values = numbers(value, label, 3);
  return Object.freeze([values[0], values[1], values[2]]);
}
function point(value: unknown, fields: readonly string[] = ['id', 'name', 'color', 'positionM', 'radiusM']): PreparedContextPoint {
  const input = record(value, 'context point', fields);
  const id = text(input.id, 'point identity'), color = text(input.color, 'point color');
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^#[a-f0-9]{6}$/i.test(color)) throw new TypeError('Invalid context point identity or color.');
  return Object.freeze({ id, color, name: text(input.name, 'point name'),
    // A body drawn from its astronomy record may have no measured radius: 0, drawn as its circle only.
    positionM: vector(input.positionM, 'point position'), radiusM: input.unpackaged === true && input.radiusM === 0 ? 0 : positive(input.radiusM, `point ${id} radius`),
    ...(input.contextColor === undefined ? {} : { contextColor: (() => {
      const hex = text(input.contextColor, `point ${id} context color`);
      if (!/^#[a-f0-9]{6}$/i.test(hex)) throw new TypeError(`Context point ${id} color ${hex} is not #rrggbb.`);
      return hex;
    })() }),
    ...(input.labelCase === undefined ? {} : input.labelCase === 'upper' ? { labelCase: 'upper' as const }
      : (() => { throw new TypeError(`Context point ${id} label case is ${String(input.labelCase)}, not upper.`); })()),
    ...(input.classification === undefined ? {} : { classification: (() => {
      const value = text(input.classification, `point ${id} classification`);
      if (!/^[a-z][a-z-]*$/.test(value)) throw new TypeError(`Context point ${id} classification ${value} is invalid.`);
      return value;
    })() }),
    ...(input.systemName === undefined ? {} : { systemName: text(input.systemName, `point ${id} system name`) }),
    ...(input.discovery === undefined ? {} : { discovery: Object.freeze({ ...record(input.discovery, `point ${id} discovery`) }) }),
    ...(input.billboard === undefined ? {} : { billboard: (() => {
      const billboard = record(input.billboard, `point ${id} billboard`, ['url', 'size', 'focalPixels', 'distanceM']);
      return Object.freeze({ url: text(billboard.url, `point ${id} billboard url`), size: positive(billboard.size, `point ${id} billboard size`),
        focalPixels: positive(billboard.focalPixels, `point ${id} billboard focal length`), distanceM: positive(billboard.distanceM, `point ${id} billboard distance`) });
    })() }),
    ...(input.plainDot === undefined ? {} : input.plainDot === true ? { plainDot: true as const }
      : (() => { throw new TypeError(`Context point ${id} plain dot is ${String(input.plainDot)}, not true.`); })()),
    ...(input.dotColor === undefined ? {} : { dotColor: (() => {
      const hex = text(input.dotColor, `point ${id} dot color`);
      if (!/^#[a-f0-9]{6}$/i.test(hex)) throw new TypeError(`Context point ${id} dot color ${hex} is not #rrggbb.`);
      return hex;
    })() }) });
}
function focusPoint(value: unknown, withCandidates: boolean): PreparedContextFocus {
  const input = record(value, 'context focus', ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView', 'contextColor', 'labelCase', 'classification', 'systemName', 'discovery', 'billboard', 'plainDot']);
  const raw = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView', 'contextColor', 'labelCase', 'classification', 'systemName', 'discovery', 'billboard', 'plainDot']);
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
  return parseContext(value, schema === PREPARED_WORLD_CONTEXT_SCHEMA);
}
/** A plan whose orbits carry their paths, for the synchronous planner. */
export function worldContextGeometry(plan: PreparedWorldContext): PreparedWorldContextGeometry {
  if (plan.schema !== PREPARED_WORLD_CONTEXT_SCHEMA) throw new TypeError('Planning orbits requires the full prepared world context.');
  return plan as PreparedWorldContextGeometry;
}
export type OrbitGeometryCandidate = Omit<PreparedContextOrbitGeometry, 'vertexCount' | 'fullTrail' | 'trailModel'> & { readonly trailModel?: unknown };
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
export function validateOrbitGeometry(orbit: OrbitGeometryCandidate, bodyPositionM: PositionM, focusId: string, renderedIds: ReadonlySet<string>, bodyId = 'orbit'): PreparedContextOrbitGeometry {
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
const BODY_FIELDS = ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit', 'systemView', 'placement', 'boundTo', 'unpackaged', 'orbitsWithinM', 'labelPlacement', 'contextColor', 'labelCase', 'classification', 'systemName', 'discovery', 'billboard', 'plainDot', 'dotColor'];
function parseBody(value: unknown, geometry: boolean, focusId: string, renderedIds: ReadonlySet<string>): PreparedContextGeometryBody | PreparedContextBody {
  const input = record(value, 'context body', BODY_FIELDS);
  const rawBody = point(input, BODY_FIELDS);
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
  return Object.freeze({ ...body, orbit: validateOrbitGeometry(jsonOrbitGeometry(input.orbit), body.positionM, focusId, renderedIds, body.id) });
}
function parseOrbitBanks(value: unknown): Readonly<Record<string, number>> | undefined {
  return value === undefined ? undefined : Object.freeze(Object.fromEntries(Object.entries(record(value, 'orbit banks')).map(([id, input]) => {
    const byteLength = positive(input, `orbit bank ${id} byte length`);
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !Number.isSafeInteger(byteLength)) throw new TypeError(`Orbit bank ${id} is invalid.`);
    return [id, byteLength] as const;
  })));
}
/** The checks a world's bodies pass together: unique identities, orbit centres, system view members and orbit bank pins.
 * In a `partial` world (a summary, with or without other holders) a system view member that is not held is in a holder
 * not read yet, and is checked when that holder is. */
function checkBodies(focus: PreparedContextFocus, bodies: readonly PreparedContextBody[], orbitCentersInput: unknown,
  orbitBanks: Readonly<Record<string, number>> | undefined, partial = false) {
  // The summary lists no body but the focus: every other is in the file of the object it is inside.
  if (bodies.length === 0 && !partial) throw new TypeError('World context requires bodies.');
  unique([focus.id, ...bodies.map(body => body.id)], 'context body identities');
  const orbitCenters = parsePreparedOrbitCenters(orbitCentersInput, focus, bodies);
  // A member orbits its system's parent, or a named centre placed off it (a circumbinary planet's barycentre).
  // Identities are unique (checked above), so one index answers each member in constant time.
  const bodyById = new Map(bodies.map(body => [body.id, body] as const));
  for (const body of [focus, ...bodies]) for (const [index, id] of (body.systemView?.memberIds ?? []).entries()) {
    const moon = bodyById.get(id), centre = moon?.orbit?.centerBodyId;
    if (!moon && partial) continue;
    if (!moon || centre === undefined || (centre !== body.id && orbitCenters?.[centre]?.centerBodyId !== body.id)) {
      throw new TypeError(`System view member ${id} of ${body.id} must orbit ${body.id} or a centre placed off it.`);
    }
    if (moon.radiusM !== body.systemView!.memberRadiiM[index]) throw new TypeError('System view radii must match their prepared members.');
  }
  // Every orbit's bank is pinned, and every pin holds an orbit.
  if (orbitBanks) {
    const banks = new Set(bodies.flatMap(body => body.orbit ? [body.id] : []));
    for (const bank of banks) if (orbitBanks[bank] === undefined) throw new TypeError(`The world context summary pins no orbit bank ${bank}.`);
    for (const id of Object.keys(orbitBanks)) if (!banks.has(id)) throw new TypeError(`Orbit bank ${id} holds no orbit.`);
  }
  return orbitCenters;
}
/** A holder's `src/objects/<holder>/prepared/members.json`: one holder's bodies, with its named orbit centres and orbit bank pins, checked as
 * the summary's own bodies are. */
export function parsePreparedWorldSystem(value: unknown, plan: PreparedWorldContext, id: string): PreparedWorldSystem {
  const placed = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body.positionM] as const));
  const input = record(expandWorldSystem(value, body => placed.get(body) ?? plan.orbitCenters?.[body]?.positionM), `world system ${id}`,
    ['schema', 'id', 'orbitCenters', 'orbitBanks', 'bodies', 'anywhere', 'places']);
  if (input.id !== id) throw new TypeError(`Prepared world system ${id} names ${String(input.id)}.`);
  const ids = array(input.bodies, `world system ${id} bodies`).map(body => text(record(body, `world system ${id} body`).id, `world system ${id} body id`));
  for (const flag of ['anywhere', 'places'] as const) if (input[flag] !== undefined && input[flag] !== true) throw new TypeError(`Prepared world system ${id} ${flag} is true or absent, not ${JSON.stringify(input[flag])}.`);
  // Only an object with places may list no body of its own: it is read for them.
  if (!ids.length && input.places !== true) throw new TypeError(`Prepared world system ${id} holds no body and no places.`);
  const rendered = new Set([...plan.bodies.map(body => body.id), ...ids]);
  return Object.freeze({ id, bodies: Object.freeze(array(input.bodies, `world system ${id} bodies`).map(body => parseBody(body, false, plan.focus.id, rendered))),
    orbitCenters: Object.freeze({ ...(input.orbitCenters === undefined ? {} : record(input.orbitCenters, `world system ${id} orbitCenters`)) }),
    orbitBanks: parseOrbitBanks(input.orbitBanks) ?? Object.freeze({}), anywhere: input.anywhere === true, places: input.places === true });
}
/** A summary plan with more holders' bodies, checked as a whole. `order` puts every body at its place in the full context
 * (the build's index), for a plan that is being built whole; a mounted plan keeps its bodies' indices and adds the new
 * ones after. */
export function extendWorldContext(plan: PreparedWorldContext, systems: readonly PreparedWorldSystem[], order?: readonly string[]): PreparedWorldContext {
  if (plan.schema !== PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA || !validatedContexts.has(plan)) throw new TypeError('Only a validated world context summary takes other systems.');
  const held = new Set(plan.bodies.map(body => body.id));
  const added = systems.filter(system => !system.bodies.some(body => held.has(body.id)));
  if (!added.length) return plan;
  const joined = [...plan.bodies, ...added.flatMap(system => system.bodies)];
  const placeOf = order && new Map(order.map((id, index) => [id, index] as const));
  if (placeOf) for (const body of joined) if (!placeOf.has(body.id)) throw new TypeError(`The world index gives ${body.id} no place among the world's ${order.length} bodies.`);
  const bodies = placeOf ? [...joined].sort((a, b) => placeOf.get(a.id)! - placeOf.get(b.id)!) : joined;
  const orbitBanks = Object.freeze(Object.assign({}, plan.orbitBanks, ...added.map(system => system.orbitBanks)) as Record<string, number>);
  const orbitCentersInput = Object.assign({}, plan.orbitCenters, ...added.map(system => system.orbitCenters)) as Record<string, unknown>;
  // Whole only when it holds every body the index places: until then a system view member may be in a holder not read.
  const orbitCenters = checkBodies(plan.focus, bodies, orbitCentersInput, orbitBanks, order === undefined || bodies.length < order.length);
  const result: PreparedWorldContext = Object.freeze({ ...plan, bodies: Object.freeze(bodies), orbitBanks,
    ...(Object.keys(orbitCenters).length ? { orbitCenters } : {}) });
  validatedContexts.add(result);
  return result;
}
/** The build's index of the world's bodies (`world-index.json`), checked. */
export function parsePreparedWorldIndex(value: unknown): PreparedWorldIndex {
  const input = record(value, 'world index', ['order', 'files', 'rows']);
  const order = array(input.order, 'world index order').map((id, index) => text(id, `world index order[${index}]`));
  unique(order, 'world index order');
  const files = array(input.files, 'world index files').map((id, index) => text(id, `world index files[${index}]`));
  unique(files, 'world index files');
  const places = new Set(order);
  const rows = record(input.rows, 'world index rows');
  for (const id of Object.keys(rows)) if (!places.has(id)) throw new TypeError(`The world index holds a row for ${id}, which has no place in its order.`);
  return Object.freeze({ order: Object.freeze(order), files: Object.freeze(files), rows: Object.freeze({ ...rows }) });
}
/** The whole world, every file read, in the full context's order: for build tools and tests. The index names every object
 * with a `members.json`, which `read` gives, from the root of the tree down, so an orbit's parent is placed before it; a
 * plain-dot star with nothing round it has its row in the index instead. */
export async function parseCompleteWorldContext(summary: unknown, read: (id: string) => Promise<unknown>, indexInput: unknown): Promise<PreparedWorldContext> {
  const index = parsePreparedWorldIndex(indexInput), files = index.files;
  let whole = parsePreparedWorldContextSummary(summary);
  const values = await Promise.all(files.map(read));
  const held = new Set<string>();
  const add = (id: string, value: unknown) => {
    const system = parsePreparedWorldSystem(value, whole, id);
    for (const body of system.bodies) {
      if (held.has(body.id)) throw new TypeError(`Prepared world file ${id} holds ${body.id}, which another file holds too.`);
      held.add(body.id);
    }
    whole = extendWorldContext(whole, [system], index.order);
  };
  files.forEach((id, at) => add(id, values[at]));
  for (const [id, row] of Object.entries(index.rows)) add(id, row);
  if (whole.bodies.length !== index.order.length) throw new TypeError(`The summary and its ${files.length} files hold ${whole.bodies.length} bodies, not the index's ${index.order.length}.`);
  return whole;
}
function parseContext(value: unknown, geometry: boolean): PreparedWorldContext {
  if (value && typeof value === 'object' && validatedContexts.has(value) &&
      (!geometry || (value as PreparedWorldContext).schema === PREPARED_WORLD_CONTEXT_SCHEMA)) return value as PreparedWorldContext;
  const input = record(geometry ? value : expandWorldContextSummary(value), 'world context', ['schema', 'frame', 'focus', 'bodies', 'orbitCenters', 'classificationViews', 'orbitBanks', 'camera', 'volume', 'stars', 'system', 'sky', 'worldBodyCount', 'dotBanks']);
  const schema = geometry ? PREPARED_WORLD_CONTEXT_SCHEMA : PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA;
  if (input.schema !== schema) throw new TypeError(`Unsupported prepared world context: ${String(input.schema)}, not ${schema}.`);
  if (!geometry && input.classificationViews !== undefined) throw new TypeError('The world context summary carries no classification views.');
  if (geometry && [input.orbitBanks, input.worldBodyCount].some(field => field !== undefined)) {
    throw new TypeError('The full world context carries every body and its orbit paths, not bank pins or a body count.');
  }
  const orbitBanks = parseOrbitBanks(input.orbitBanks);
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World context requires its prepared frame.');
  const focus = focusPoint(input.focus, geometry);
  if (!equalPosition(focus.positionM, frame.originM)) throw new TypeError('World context focus must be at its frame origin.');
  const renderedIds = new Set(array(input.bodies, 'context bodies').map(value => text(record(value, 'context body').id, 'context body id')));
  const bodies = array(input.bodies, 'context bodies').map(value => parseBody(value, geometry, focus.id, renderedIds));
  const worldBodyCount = input.worldBodyCount === undefined ? undefined : finite(input.worldBodyCount, 'world body count');
  if (worldBodyCount !== undefined && (!Number.isSafeInteger(worldBodyCount) || worldBodyCount < bodies.length)) throw new TypeError(`World body count ${worldBodyCount} is fewer than the summary's ${bodies.length} bodies.`);
  const dotBanks = input.dotBanks === undefined ? undefined : Object.freeze(array(input.dotBanks, 'world dot banks').map((id, index) => {
    const bank = text(id, `world dot bank ${index}`);
    if (!/^[a-z][a-z0-9-]*$/.test(bank)) throw new TypeError(`World dot bank ${index} is ${JSON.stringify(bank)}, not a bank id.`);
    return bank;
  }));
  if (geometry && dotBanks) throw new TypeError('Only the world context summary names dot banks.');
  const orbitCenters = checkBodies(focus, bodies, input.orbitCenters, orbitBanks, !geometry);
  const classificationViews = geometry ? parseClassificationViews(input.classificationViews, bodies) : undefined;
  const camera = record(input.camera, 'context camera', ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation']);
  const volume = record(input.volume, 'context volume', ['objectId', 'fadeStartDistanceM', 'fullDistanceM', 'discHalfHeightM', 'opacityProfile']);
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
    ...(worldBodyCount === undefined ? {} : { worldBodyCount }), ...(dotBanks ? { dotBanks } : {}),
    ...(input.orbitCenters === undefined ? {} : { orbitCenters }),
    ...(classificationViews ? { classificationViews } : {}), ...(orbitBanks ? { orbitBanks } : {}),
    camera: Object.freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom, presentation }),
    volume: Object.freeze({ objectId, fadeStartDistanceM, fullDistanceM,
      ...(volume.discHalfHeightM === undefined ? {} : { discHalfHeightM: positive(volume.discHalfHeightM, 'volume disc half-height') }),
      ...(volume.opacityProfile === undefined ? {} : { opacityProfile: parseVolumeOpacityProfile(volume.opacityProfile) }) }),
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
