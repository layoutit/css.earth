import { prepareGroupView, prepareSystemView } from './system-view.js';
import type { PreparedSystemView, SystemViewPolicy } from './system-view.js';
import { M_PER_AU } from '@cssearth/astronomy';
import { prepareHyperbolicPath } from '../platform/prepare-hyperbolic-path.mts';

export type Vector3 = readonly [number, number, number];

export interface PreparedWorldCameraFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: Vector3;
  readonly presentationToReference: readonly [number, number, number, number, number, number, number, number, number];
  readonly metersPerUnit: number;
  readonly bodyRadiusM: number;
}
export interface WorldContextCameraPresentation {
  readonly projection: { readonly model: 'css-perspective-shared-with-sky'; readonly cssPerspective: string };
  readonly dolly: { readonly model: 'multiplicative-wheel-distance'; readonly wheelStepPerDelta: number; readonly minimumDistanceRadii: number; readonly maximumDistanceOverOrbitExtent: number };
  readonly levelOfDetail: { readonly model: 'silhouette-diameter-crossfade'; readonly billboardFadeStartDiscPixels: number; readonly billboardFullDiscPixels: number; readonly markerFadeStartDiscPixels: number; readonly markerFullDiscPixels: number };
  readonly orbitLineFade: { readonly visibleBelowDiscHeightShare: number; readonly hiddenAboveDiscHeightShare: number };
  readonly drag: { readonly model: 'screen-axis-tumble' };
}
export interface SkyBaseline {
  readonly scenePitchDegrees: number; readonly sceneYawDegrees: number;
  readonly skyPitchDegrees: number; readonly skyYawDegrees: number; readonly skyRollDegrees: number;
  readonly source: string;
}
export interface WorldContextPointSource {
  readonly absoluteMagnitude: number;
  readonly color: string;
  readonly proximityEnhancement?: {
    readonly fullDistanceM: number;
    readonly fadeOutDistanceM: number;
    readonly radiusMultiplier: number;
    readonly brightnessMultiplier: number;
  };
}
type WorldContextFocus = { readonly id: string; readonly name: string; readonly color: string; readonly pointSource?: WorldContextPointSource };
export interface VolumeOpacityProfile {
  readonly model: 'logarithmic-distance';
  readonly nearOpacity: number;
  readonly fullOpacity: number;
  readonly fadeStartDistanceM: number;
  readonly fullDistanceM: number;
}
export interface WorldContextSource {
  readonly schema: 'cssearth-world-context-source@1';
  readonly sky: SkyBaseline;
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: WorldContextFocus;
  /** `unpackaged`: drawn from its astronomy record around a packaged host, with no object page (the S-stars around Sgr A*).
   * `orbitsWithinM`: a host's authored presentation range, the camera distance up to which its system draws every orbit. */
  readonly bodies: readonly { readonly id: string; readonly name: string; readonly color: string; readonly placement?: 'approximate'; readonly unpackaged?: true; readonly orbitsWithinM?: number; readonly labelPlacement?: 'centre' }[];
  /** Preparation resolves catalogue membership before computing the context. */
  readonly bodySelection?: "catalog";
  readonly orbit: { readonly segments: number; readonly trail: { readonly solidTurns: number; readonly fadeTurns: number } };
  readonly camera: { readonly minimumDistanceM: number; readonly maximumDistanceM: number; readonly framingReferenceZoom: number; readonly presentation: WorldContextCameraPresentation };
  readonly system: { readonly fadeOutStartDistanceM: number; readonly hiddenDistanceM: number };
  readonly volume: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number;
    readonly opacityProfile?: VolumeOpacityProfile;
    /** Display attenuation of the completed volume image over black; not physical exposure. */
    readonly brightnessProfile?: VolumeOpacityProfile };
  readonly stars: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number };
}
export interface OrbitalState {
  readonly positionM: Vector3;
  readonly centerBodyId: string;
  readonly centerPositionM: Vector3;
  readonly normal: Vector3;
  readonly perihelionDirection: Vector3;
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly trueAnomalyRadians: number;
}
/** `none`: a body placed by its astrometry rather than an orbit, such as a star; it is listed with its position and radius only.
 * `boundTo`: a placed star measured to be bound to another with no measured orbit (a wide binary companion), with the pair's
 * centre of mass. The pair is one system, framed and aimed at that centre. */
export interface WorldContextBodyFact { readonly radiusM: number; readonly orbitStyle?: 'closed' | 'trail' | 'none'; readonly classification?: string;
  readonly boundTo?: { readonly hostId: string; readonly centerM: Vector3 }; }
/** A source-backed coordinate origin with no rendered body, surface or marker. */
export interface WorldContextOrbitCenter { readonly positionM: Vector3; readonly centerBodyId: string; }
export interface PreparedWorldContext {
  readonly schema: 'cssearth-world-context@1';
  readonly orbitCenters?: Readonly<Record<string, WorldContextOrbitCenter>>;
  readonly sky: { readonly sceneRegistration: string };
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: WorldContextFocus & { readonly positionM: Vector3; readonly radiusM: number; readonly systemView?: PreparedSystemView };
  /** Each classification framed by its members' prepared positions, keyed by classification. */
  readonly classificationViews?: Readonly<Record<string, PreparedSystemView>>;
  readonly bodies: readonly { readonly id: string; readonly name: string; readonly color: string; readonly positionM: Vector3; readonly radiusM: number;
    readonly systemView?: PreparedSystemView;
    readonly placement?: 'approximate';
    readonly unpackaged?: true;
    readonly orbitsWithinM?: number;
    /** Caption the body over its middle instead of below it. */
    readonly labelPlacement?: 'centre';
    /** A placed star bound to another with no measured orbit: its host and the pair's centre of mass. */
    readonly boundTo?: { readonly hostId: string; readonly centerM: Vector3 };
    /** Absent for a placed body, which has a position but no orbit to draw. */
    readonly orbit?: { readonly centerBodyId: string; readonly centerPositionM: Vector3; readonly verticesM: readonly Vector3[]; readonly trail: readonly number[];
      readonly bounds: { readonly centerM: Vector3; readonly radiusM: number }; readonly activeChords: readonly number[];
      readonly extentChords: readonly number[]; readonly lod: PreparedOrbitLod;
      /** Open trajectories carry N-1 chords, an explicit epoch vertex and a finite display window. */
      readonly closed?: false; readonly bodyVertexIndex?: number; readonly displayExtentAu?: number;
      readonly trailModel?: 'finite-open-trajectory-constant-weight' } }[];
  readonly camera: WorldContextSource['camera'];
  readonly system: WorldContextSource['system'];
  readonly volume: WorldContextSource['volume'];
  readonly stars: WorldContextSource['stars'];
}

/** Validates authored numeric data without binding it to an ephemeris or renderer. */
export function parseWorldContextSource(value: unknown): WorldContextSource {
  const input = record(value, 'world context'); keys(input, ['schema', 'frame', 'focus', 'bodies', 'orbit', 'camera', 'system', 'volume', 'sky', 'stars'], 'world context');
  if (input.schema !== 'cssearth-world-context-source@1') throw new TypeError('Unsupported world context source schema.');
  const frame = parseFrame(input.frame);
  const focusInput = record(input.focus, 'world context focus'); keys(focusInput, ['id', 'name', 'color', 'pointSource'], 'world context focus');
  const focus = freeze({ id: identifier(focusInput.id, 'World context focus id'), name: text(focusInput.name, 'World context focus name'), color: color(focusInput.color),
    ...(focusInput.pointSource === undefined ? {} : { pointSource: parsePointSource(focusInput.pointSource) }) });
  const fromCatalog = input.bodies === 'catalog';
  if (!fromCatalog && (!Array.isArray(input.bodies) || input.bodies.length === 0)) throw new TypeError('World context bodies must be nonempty.');
  const bodies = (fromCatalog ? [] : input.bodies as unknown[]).map((value, index) => {
    const body = record(value, `world context body ${index}`); keys(body, ['id', 'name', 'color', 'placement', 'unpackaged', 'orbitsWithinM', 'labelPlacement'], `world context body ${index}`);
    if (body.labelPlacement !== undefined && body.labelPlacement !== 'centre') throw new TypeError(`World context body ${index} label placement is ${String(body.labelPlacement)}, not centre.`);
    if (body.placement !== undefined && body.placement !== 'approximate') throw new TypeError('Unsupported orbital placement qualification.');
    if (body.unpackaged !== undefined && body.unpackaged !== true) throw new TypeError('World context unpackaged is true or absent.');
    return freeze({ ...(body.labelPlacement === 'centre' ? { labelPlacement: 'centre' as const } : {}), ...(body.placement === 'approximate' ? { placement: 'approximate' as const } : {}), ...(body.unpackaged === true ? { unpackaged: true as const } : {}), ...(body.orbitsWithinM === undefined ? {} : { orbitsWithinM: positive(body.orbitsWithinM, `world context body ${index} orbit range`) }), id: identifier(body.id, `world context body ${index} id`), name: text(body.name, `world context body ${index} name`), color: color(body.color) });
  });
  if (new Set(bodies.map(body => body.id)).size !== bodies.length || bodies.some(body => body.id === focus.id)) throw new TypeError('World context body ids must be unique and exclude the focus.');
  const orbit = record(input.orbit, 'world context orbit'); keys(orbit, ['segments', 'trail'], 'world context orbit');
  const trail = record(orbit.trail, 'world context orbit trail'); keys(trail, ['solidTurns', 'fadeTurns'], 'world context orbit trail');
  const segments = integer(orbit.segments, 'World context orbit segments');
  const solidTurns = nonnegative(trail.solidTurns, 'World context trail solid turns'), fadeTurns = positive(trail.fadeTurns, 'World context trail fade turns');
  if (segments < 8 || solidTurns + fadeTurns >= 1) throw new TypeError('World context orbit trail is invalid.');
  const camera = parseCamera(input.camera), volume = record(input.volume, 'World context volume');
  const system = parseSystem(input.system);
  keys(volume, ['objectId', 'fadeStartDistanceM', 'fullDistanceM', 'opacityProfile', 'brightnessProfile'], 'World context volume');
  const fadeStartDistanceM = positive(volume.fadeStartDistanceM, 'Volume fade start'), fullDistanceM = positive(volume.fullDistanceM, 'Volume full distance');
  if (!(fadeStartDistanceM < fullDistanceM && fullDistanceM <= camera.maximumDistanceM)) throw new TypeError('Volume distance range is invalid.');
  const stars = parseStars(input.stars, fadeStartDistanceM);
  return freeze({ schema: input.schema, sky: parseSkyBaseline(input.sky), frame, focus, bodies: freeze(bodies), ...(fromCatalog ? { bodySelection: 'catalog' as const } : {}), orbit: freeze({ segments, trail: freeze({ solidTurns, fadeTurns }) }), camera, system, stars,
    volume: freeze({ objectId: identifier(volume.objectId, 'Volume object id'), fadeStartDistanceM, fullDistanceM,
      ...(volume.opacityProfile === undefined ? {} : { opacityProfile: parseVolumeOpacityProfile(volume.opacityProfile) }),
      ...(volume.brightnessProfile === undefined ? {} : { brightnessProfile: parseVolumeOpacityProfile(volume.brightnessProfile) }) }) });
}

function parseVolumeOpacityProfile(value: unknown): VolumeOpacityProfile {
  const input = record(value, 'Volume opacity profile');
  keys(input, ['model', 'nearOpacity', 'fullOpacity', 'fadeStartDistanceM', 'fullDistanceM'], 'Volume opacity profile');
  if (input.model !== 'logarithmic-distance') throw new TypeError('Volume opacity profile model is unsupported.');
  const nearOpacity = finite(input.nearOpacity, 'Volume near opacity'), fullOpacity = finite(input.fullOpacity, 'Volume full opacity');
  const fadeStartDistanceM = positive(input.fadeStartDistanceM, 'Volume opacity fade start'), fullDistanceM = positive(input.fullDistanceM, 'Volume opacity full distance');
  if (nearOpacity < 0 || nearOpacity > 1 || fullOpacity < 0 || fullOpacity > 1 || !(fadeStartDistanceM < fullDistanceM)) throw new TypeError('Volume opacity profile is invalid.');
  return freeze({ model: input.model, nearOpacity, fullOpacity, fadeStartDistanceM, fullDistanceM });
}

/** Builds static conic vertices in physical metres from a same-epoch ephemeris adapter. */
export function prepareWorldContext(source: WorldContextSource, facts: Readonly<Record<string, WorldContextBodyFact>>,
  states: Readonly<Record<string, OrbitalState>>,
  orbitCenters: Readonly<Record<string, WorldContextOrbitCenter>> = {},
  systemViewPolicy?: SystemViewPolicy): PreparedWorldContext {
  for (const [id, center] of Object.entries(orbitCenters)) {
    identifier(id, 'Orbit center id'); identifier(center.centerBodyId, `${id} orbit center parent`);
    if (!Array.isArray(center.positionM) || center.positionM.length !== 3 || center.positionM.some(value => !Number.isFinite(value))) {
      throw new TypeError(`${id} orbit center must have a finite position.`);
    }
    if (states[id] || id === source.focus.id) throw new TypeError(`${id} orbit center duplicates a prepared body.`);
  }
  if (source.bodySelection) throw new TypeError('Resolve catalogue membership before preparing the context.');
  const visibleIds = new Set(source.bodies.map(body => body.id));
  const centerState = (id: string) => visibleIds.has(id) ? states[id] : orbitCenters[id];
  for (const id of Object.keys(orbitCenters)) {
    const ancestors = new Set<string>();
    for (let parentId = id; parentId !== source.focus.id; parentId = centerState(parentId)!.centerBodyId) {
      if (ancestors.has(parentId) || !centerState(parentId)) throw new TypeError(`${id} orbit center hierarchy is invalid.`);
      ancestors.add(parentId);
    }
  }
  const bodies = source.bodies.map(body => {
    const fact = facts[body.id], state = states[body.id];
    // A body drawn from its record may have no measured radius (0): it is drawn as its circle only.
    const sized = body.unpackaged === true ? Number.isFinite(fact?.radiusM) && fact!.radiusM >= 0 : fact !== undefined && positive(fact.radiusM, `${body.id} radius`);
    if (!fact || !state || !sized) throw new TypeError(`Missing physical facts for ${body.id}: radius ${String(fact?.radiusM)}.`);
    validateState(state, body.id);
    if (fact.boundTo) {
      const hostPositionM = fact.boundTo.hostId === source.focus.id ? source.frame.originM : states[fact.boundTo.hostId]?.positionM;
      const centre = fact.boundTo.centerM;
      if (!hostPositionM || fact.orbitStyle !== 'none' || fact.boundTo.hostId === body.id) throw new TypeError(`${body.id} must be a placed body bound to another prepared body.`);
      // The centre of mass lies on the line between the pair: its two distances add up to their separation.
      const separation = Math.hypot(...hostPositionM.map((value, axis) => value - state.positionM[axis]!));
      const split = Math.hypot(...hostPositionM.map((value, axis) => value - centre[axis]!)) + Math.hypot(...centre.map((value, axis) => value - state.positionM[axis]!));
      if (!(separation > 0) || Math.abs(split - separation) > separation * 1e-9) throw new TypeError(`${body.id} centre of mass must lie between it and ${fact.boundTo.hostId}.`);
    }
    const parent = state.centerBodyId === source.focus.id ? source.frame.originM : centerState(state.centerBodyId)?.positionM;
    if (!parent || state.centerBodyId === body.id || !source.bodies.some(body => body.id === state.centerBodyId) && !orbitCenters[state.centerBodyId] && state.centerBodyId !== source.focus.id ||
        Math.hypot(...parent.map((value, axis) => value - state.centerPositionM[axis]!)) > .001) {
      throw new TypeError(`${body.id} orbit centre must match its prepared parent.`);
    }
    const ancestors = new Set([body.id]);
    for (let parentId = state.centerBodyId; parentId !== source.focus.id; parentId = centerState(parentId)!.centerBodyId) {
      if (ancestors.has(parentId) || !centerState(parentId)) throw new TypeError(`${body.id} orbit parent hierarchy is invalid.`);
      ancestors.add(parentId);
    }
    if (fact.orbitStyle === 'none') return freeze({ ...body, positionM: copy(state.positionM), radiusM: fact.radiusM,
      ...(fact.boundTo ? { boundTo: freeze({ hostId: fact.boundTo.hostId, centerM: copy(fact.boundTo.centerM) }) } : {}) });
    const motion = unit(cross(state.normal, state.perihelionDirection));
    const path = state.eccentricity > 1 ? prepareHyperbolicPath({
      semiMajorAxisUnits: state.semiMajorAxisM, eccentricity: state.eccentricity, trueAnomalyRad: state.trueAnomalyRadians,
      unitsPerAu: M_PER_AU, heliocentricDistanceAu: Math.hypot(...state.positionM) / M_PER_AU,
      focus: add(state.centerPositionM, scale(state.positionM, -1)), perihelionDirection: state.perihelionDirection,
      perihelionMotion: motion, segments: source.orbit.segments,
    }) : undefined;
    let verticesM: readonly Vector3[], trail: readonly number[];
    if (path) {
      verticesM = freeze(path.vertices.map((vertex, index) => index === path.bodyVertexIndex
        ? copy(state.positionM) : copy(add(state.positionM, vertex))));
      trail = path.trail;
    } else {
      const minor = state.semiMajorAxisM * Math.sqrt(1 - state.eccentricity ** 2), centre = add(state.centerPositionM, scale(state.perihelionDirection, -state.semiMajorAxisM * state.eccentricity));
      const eccentric = 2 * Math.atan2(Math.sqrt(1 - state.eccentricity) * Math.sin(state.trueAnomalyRadians / 2),
        Math.sqrt(1 + state.eccentricity) * Math.cos(state.trueAnomalyRadians / 2));
      verticesM = freeze(Array.from({ length: source.orbit.segments }, (_, index) => index === 0 ? copy(state.positionM) : ellipse(centre, state.perihelionDirection, motion, state.semiMajorAxisM, minor,
        eccentric + index * 2 * Math.PI / source.orbit.segments)));
      trail = fact.orbitStyle === 'closed' ? freeze(Array.from({ length: source.orbit.segments }, () => 1))
        : trailWeights(source.orbit.segments, source.orbit.trail);
    }
    const activeChords = freeze(trail.flatMap((weight, index) => weight > 0 ? [index] : []));
    const extentChords = prepareExtentChords(activeChords);
    // Enclose the actual authored trail, including the pinned ephemeris vertex.
    // A sphere containing its endpoints also contains every active chord.
    const endpoints = activeChords.length ? activeChords.flatMap(index => [verticesM[index]!, verticesM[(index + 1) % verticesM.length]!]) : verticesM;
    const centerM = [0, 1, 2].map(axis => (Math.min(...endpoints.map(v => v[axis]!)) + Math.max(...endpoints.map(v => v[axis]!))) / 2) as unknown as Vector3;
    const bounds = freeze({ centerM: copy(centerM), radiusM: Math.max(...endpoints.map(vertex =>
      Math.hypot(...vertex.map((value, axis) => value - centerM[axis]!)))) * (1 + 8 * Number.EPSILON) });
    const lod = prepareOrbitLod(verticesM, trail, path ? path.closed !== false : true, path?.bodyVertexIndex ?? 0);
    return freeze({ ...body, positionM: copy(state.positionM), radiusM: fact.radiusM,
      orbit: freeze({ centerBodyId: state.centerBodyId, centerPositionM: copy(state.centerPositionM), verticesM, bounds, trail, activeChords, extentChords, lod,
        ...(path ? { closed: path.closed, bodyVertexIndex: path.bodyVertexIndex, displayExtentAu: path.displayExtentAu, trailModel: path.trailModel } : {}) }) });
  });
  const focus = { ...source.focus, positionM: copy(source.frame.originM), radiusM: source.frame.bodyRadiusM };
  // The root system frames its major planets, including the smaller terrestrial planets.
  const planets = bodies.filter(body => facts[body.id]?.classification === 'planet');
  const focusView = systemViewPolicy === undefined ? undefined : prepareSystemView(focus, planets, states,
    { ...systemViewPolicy, minimumRadiusShare: 0 });
  // Each classification frames the nearest 90% of its members from the root system's candidate
  // angles, so a few distant outliers cannot shrink the rest. Every member is still highlighted.
  const framedShare = .9, distance = (body: (typeof bodies)[number]) =>
    Math.hypot(...body.positionM.map((value, axis) => value - focus.positionM[axis]!));
  const classifications = [...new Set(bodies.flatMap(body => facts[body.id]?.classification ?? []))].sort();
  const classificationViews = systemViewPolicy === undefined ? {} : Object.fromEntries(classifications.flatMap(classification => {
    const members = bodies.filter(body => facts[body.id]?.classification === classification)
      .sort((a, b) => distance(a) - distance(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const view = prepareGroupView(focus, planets, members.slice(0, Math.ceil(members.length * framedShare)), states,
      { ...systemViewPolicy, minimumRadiusShare: 0 });
    return view ? [[classification, view] as const] : [];
  }));
  return freeze({ schema: 'cssearth-world-context@1',
    ...(Object.keys(orbitCenters).length ? { orbitCenters: freeze(Object.fromEntries(Object.entries(orbitCenters).map(([id, center]) =>
      [id, freeze({ positionM: copy(center.positionM), centerBodyId: center.centerBodyId })]))) } : {}),
    sky: prepareSkyRegistration(source.sky), frame: source.frame, focus: freeze({ ...focus, ...(focusView ? { systemView: focusView } : {}) }),
    ...(Object.keys(classificationViews).length ? { classificationViews: freeze(classificationViews) } : {}),
    bodies: freeze(bodies.map(body => {
      const systemView = systemViewPolicy === undefined ? undefined : prepareSystemView(body, bodies, states, systemViewPolicy, orbitCenters);
      return systemView ? freeze({ ...body, systemView }) : body;
    })), camera: source.camera, system: source.system, volume: source.volume, stars: source.stars });
}

/** The browser's copy of a prepared world context. Orbit paths and detail levels go to the planner worker as the
 * binary orbit bank (`encodeWorldOrbits`), which this summary pins; each orbit here keeps its parent, bounds and
 * size. Classification views are build-time only. */
export function summarizeWorldContext(prepared: PreparedWorldContext, orbitBank: { readonly byteLength: number }) {
  const { classificationViews: _views, ...rest } = prepared;
  return freeze({ ...rest, schema: 'cssearth-world-context-summary@1' as const, orbitBank: freeze({ ...orbitBank }), bodies: freeze(prepared.bodies.map(body => {
    if (!body.orbit) return body;
    const { centerBodyId, centerPositionM, verticesM, trail, bounds, lod, closed, displayExtentAu } = body.orbit;
    return freeze({ ...body, orbit: freeze({ centerBodyId, centerPositionM, vertexCount: verticesM.length, fullTrail: trail.every(weight => weight === 1),
      bounds, lod: freeze({ bounds: lod.bounds }), ...(closed === false ? { closed, displayExtentAu } : {}) }) });
  })) });
}

/** The orbit bank's layout: `CSWO`, format version, header byte length (little-endian u32s), the UTF-8 JSON
 * header, then 8-byte-aligned sections. The header names each orbit's sections as [byteOffset, count] from the
 * start of the bank: vertices as Float64 x,y,z triples, trail weights as Float64, chord and vertex indices as
 * Uint32. The planner worker reads them as typed-array views; nothing is parsed into objects. */
export const WORLD_ORBITS_MAGIC = 0x4f575343; // 'CSWO'
export const WORLD_ORBITS_VERSION = 1;
export function encodeWorldOrbits(prepared: PreparedWorldContext): Uint8Array {
  const sections: (Float64Array | Uint32Array)[] = [];
  let offset = 0;
  const section = (values: Float64Array | Uint32Array) => { const at = offset; sections.push(values); offset += values.byteLength; offset += (8 - offset % 8) % 8; return [at, values.length] as const; };
  const f64 = (values: readonly number[]) => section(Float64Array.from(values));
  const u32 = (values: readonly number[]) => {
    if (values.some(value => !Number.isSafeInteger(value) || value < 0 || value > 0xffffffff)) throw new TypeError('Orbit bank indices must be unsigned 32-bit integers.');
    return section(Uint32Array.from(values));
  };
  const bodies = prepared.bodies.flatMap(body => {
    const orbit = body.orbit;
    if (!orbit) return [];
    return [{ id: body.id, vertices: f64(orbit.verticesM.flat()), trail: f64(orbit.trail), activeChords: u32(orbit.activeChords),
      extentChords: u32(orbit.extentChords),
      ...(orbit.closed === false ? { bodyVertexIndex: orbit.bodyVertexIndex, trailModel: orbit.trailModel } : {}),
      levels: orbit.lod.levels.map(level => ({ vertexIndices: u32(level.vertexIndices), trail: f64(level.trail),
        activeChords: u32(level.activeChords), deviationM: level.deviationM })) }];
  });
  const header = new TextEncoder().encode(JSON.stringify({ schema: 'cssearth-world-orbits@1', bodies }));
  const dataStart = 12 + header.byteLength + (8 - (12 + header.byteLength) % 8) % 8;
  const bytes = new Uint8Array(dataStart + offset);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, WORLD_ORBITS_MAGIC, true); view.setUint32(4, WORLD_ORBITS_VERSION, true); view.setUint32(8, header.byteLength, true);
  bytes.set(header, 12);
  // Section offsets in the header are relative to the data start, which follows the padded header.
  let at = dataStart;
  for (const values of sections) {
    bytes.set(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), at);
    at += values.byteLength; at += (8 - (at - dataStart) % 8) % 8;
  }
  return bytes;
}
export interface PreparedOrbitLodLevel {
  readonly vertexIndices: readonly number[]; readonly trail: readonly number[];
  readonly activeChords: readonly number[]; readonly deviationM: number;
}
export interface PreparedOrbitLod {
  readonly bounds: { readonly centerM: Vector3; readonly radiusM: number };
  readonly levels: readonly PreparedOrbitLodLevel[];
}

// Coarser chord banks for small projections. Each level keeps every step-th
// prepared vertex plus the body's own vertex (and an open path's end), averages
// the trail weights it spans, and records its largest distance from the full
// path. The runtime selects a level by projected error; it never derives one.
const ORBIT_LOD_STEPS = [2, 4, 8] as const;
function prepareOrbitLod(verticesM: readonly Vector3[], trail: readonly number[], closed: boolean, pinned: number): PreparedOrbitLod {
  const count = verticesM.length;
  const centerM = [0, 1, 2].map(axis => (Math.min(...verticesM.map(v => v[axis]!)) + Math.max(...verticesM.map(v => v[axis]!))) / 2) as unknown as Vector3;
  const radiusM = Math.max(...verticesM.map(vertex => Math.hypot(...vertex.map((value, axis) => value - centerM[axis]!)))) * (1 + 8 * Number.EPSILON);
  const levels = ORBIT_LOD_STEPS.map(step => {
    const keep = new Set([0, pinned]);
    for (let index = 0; index < count; index += step) keep.add(index);
    if (!closed) keep.add(count - 1);
    const vertexIndices = [...keep].sort((a, b) => a - b);
    const chords = closed ? vertexIndices.length : vertexIndices.length - 1;
    const weights: number[] = [];
    let deviationM = 0;
    for (let chord = 0; chord < chords; chord++) {
      const from = vertexIndices[chord]!, to = chord + 1 < vertexIndices.length ? vertexIndices[chord + 1]! : count;
      let sum = 0;
      for (let index = from; index < to; index++) sum += trail[index]!;
      weights.push(sum / (to - from));
      const a = verticesM[from]!, b = verticesM[to % count]!;
      for (let index = from + 1; index < to; index++) deviationM = Math.max(deviationM, distanceToSegment(verticesM[index]!, a, b));
    }
    return freeze({ vertexIndices: freeze(vertexIndices), trail: freeze(weights),
      activeChords: freeze(weights.flatMap((weight, index) => weight > 0 ? [index] : [])), deviationM });
  });
  return freeze({ bounds: freeze({ centerM: copy(centerM), radiusM }), levels: freeze(levels) });
}
function distanceToSegment(point: Vector3, a: Vector3, b: Vector3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [point[0] - a[0], point[1] - a[1], point[2] - a[2]];
  const length = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
  const t = length > 0 ? Math.max(0, Math.min(1, (ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / length)) : 0;
  return Math.hypot(ap[0]! - t * ab[0]!, ap[1]! - t * ab[1]!, ap[2]! - t * ab[2]!);
}

// Measurement can stop when the existing fade saturates. Visit separated
// parts of the authored trail first, then fill every gap breadth-first. This
// permutation never changes drawing order or omits a positive-weight chord.
function prepareExtentChords(active: readonly number[]): readonly number[] {
  if (active.length === 0) return freeze([]);
  const order = [active[0]!], ranges: [number, number][] = [[1, active.length]];
  for (let index = 0; index < ranges.length; index++) {
    const [start, end] = ranges[index]!;
    if (start >= end) continue;
    const middle = Math.floor((start + end) / 2);
    order.push(active[middle]!);
    ranges.push([start, middle], [middle + 1, end]);
  }
  return freeze(order);
}

function parseStars(value: unknown, volumeFadeStartDistanceM: number): WorldContextSource['stars'] {
  const input = record(value, 'World context stars'); keys(input, ['objectId','fadeStartDistanceM','fullDistanceM'], 'World context stars');
  const fadeStartDistanceM = positive(input.fadeStartDistanceM, 'Stars fade start'), fullDistanceM = positive(input.fullDistanceM, 'Stars full distance');
  if (!(fadeStartDistanceM < fullDistanceM && fullDistanceM <= volumeFadeStartDistanceM)) throw new TypeError('Stars distance range is invalid.');
  return freeze({ objectId:identifier(input.objectId,'Stars object id'),fadeStartDistanceM,fullDistanceM });
}

function parsePointSource(value: unknown): WorldContextPointSource {
  const input = record(value, 'World context focus point source'); keys(input, ['absoluteMagnitude', 'color', 'proximityEnhancement'], 'World context focus point source');
  const absoluteMagnitude = finite(input.absoluteMagnitude, 'Focus point absolute magnitude'), sourceColor = color(input.color);
  if (input.proximityEnhancement === undefined) return freeze({ absoluteMagnitude, color: sourceColor });
  const enhancement = record(input.proximityEnhancement, 'World context focus proximity enhancement');
  keys(enhancement, ['fullDistanceM', 'fadeOutDistanceM', 'radiusMultiplier', 'brightnessMultiplier'], 'World context focus proximity enhancement');
  const fullDistanceM = positive(enhancement.fullDistanceM, 'Focus proximity full distance');
  const fadeOutDistanceM = positive(enhancement.fadeOutDistanceM, 'Focus proximity fade-out distance');
  const radiusMultiplier = positive(enhancement.radiusMultiplier, 'Focus proximity radius multiplier');
  const brightnessMultiplier = positive(enhancement.brightnessMultiplier, 'Focus proximity brightness multiplier');
  if (!(fadeOutDistanceM > fullDistanceM && radiusMultiplier >= 1 && brightnessMultiplier >= 1)) throw new TypeError('Focus proximity enhancement is invalid.');
  return freeze({ absoluteMagnitude, color: sourceColor, proximityEnhancement: freeze({ fullDistanceM, fadeOutDistanceM, radiusMultiplier, brightnessMultiplier }) });
}

function parseFrame(value: unknown): PreparedWorldCameraFrame {
  const frame = record(value, 'world context frame'); keys(frame, ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM', 'orientationSource', 'presentationRadiusDerivation'], 'world context frame');
  const presentation = tuple(frame.presentationToReference, 9, 'World context frame rotation') as PreparedWorldCameraFrame['presentationToReference'];
  if (typeof frame.orientationSource !== 'string' || !frame.orientationSource) throw new TypeError('World context frame must document its orientation source.');
  const derivation = record(frame.presentationRadiusDerivation, 'World context radius derivation'); keys(derivation, ['sourceRadius', 'polycssTilePixels', 'sceneScale', 'visibleRadiusUnits'], 'World context radius derivation');
  const visibleRadius = positive(derivation.visibleRadiusUnits, 'World context visible radius');
  if (Math.abs(positive(derivation.sourceRadius, 'World context source radius') * positive(derivation.polycssTilePixels, 'World context tile size') * positive(derivation.sceneScale, 'World context scene scale') - visibleRadius) > 1e-9) throw new TypeError('World context radius derivation is inconsistent.');
  const result = freeze({ referenceFrame: text(frame.referenceFrame, 'World context reference frame'), epochJdTt: finite(frame.epochJdTt, 'World context epoch'), originM: tuple(frame.originM, 3, 'World context origin') as Vector3,
    presentationToReference: presentation, metersPerUnit: positive(frame.metersPerUnit, 'World context metres per unit'), bodyRadiusM: positive(frame.bodyRadiusM, 'World context body radius') });
  if (Math.abs(result.bodyRadiusM / visibleRadius - result.metersPerUnit) > 1e-9 * result.metersPerUnit) throw new TypeError('World context metres per unit is inconsistent with the prepared radius.');
  return result;
}
function parseCamera(value: unknown): WorldContextSource['camera'] {
  const input = record(value, 'World context camera');
  keys(input, ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation'], 'World context camera');
  const minimumDistanceM = positive(input.minimumDistanceM, 'World context camera minimum');
  const maximumDistanceM = positive(input.maximumDistanceM, 'World context camera maximum');
  if (!(minimumDistanceM < maximumDistanceM)) throw new TypeError('World context camera range is invalid.');
  return freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom: positive(input.framingReferenceZoom, 'World context framing zoom'), presentation: parsePresentation(input.presentation) });
}
function parseSystem(value: unknown): WorldContextSource['system'] {
  const input = record(value, 'World context system'); keys(input, ['fadeOutStartDistanceM', 'hiddenDistanceM'], 'World context system');
  const fadeOutStartDistanceM = positive(input.fadeOutStartDistanceM, 'World context system fade start');
  const hiddenDistanceM = positive(input.hiddenDistanceM, 'World context system hidden distance');
  if (!(fadeOutStartDistanceM < hiddenDistanceM)) throw new TypeError('World context system range is invalid.');
  return freeze({ fadeOutStartDistanceM, hiddenDistanceM });
}
function parsePresentation(value: unknown): WorldContextCameraPresentation {
  const input = record(value, 'World context camera presentation'); keys(input, ['projection', 'dolly', 'levelOfDetail', 'orbitLineFade', 'drag'], 'World context camera presentation');
  const projection = record(input.projection, 'World context projection'); keys(projection, ['model', 'cssPerspective'], 'World context projection');
  if (projection.model !== 'css-perspective-shared-with-sky') throw new TypeError('World context projection model is unsupported.');
  const dolly = record(input.dolly, 'World context dolly'); keys(dolly, ['model', 'wheelStepPerDelta', 'minimumDistanceRadii', 'maximumDistanceOverOrbitExtent'], 'World context dolly');
  if (dolly.model !== 'multiplicative-wheel-distance') throw new TypeError('World context dolly model is unsupported.');
  const levelOfDetail = record(input.levelOfDetail, 'World context level of detail'); keys(levelOfDetail, ['model', 'billboardFadeStartDiscPixels', 'billboardFullDiscPixels', 'markerFadeStartDiscPixels', 'markerFullDiscPixels'], 'World context level of detail');
  if (levelOfDetail.model !== 'silhouette-diameter-crossfade') throw new TypeError('World context level-of-detail model is unsupported.');
  const orbitLineFade = record(input.orbitLineFade, 'World context orbit-line fade'); keys(orbitLineFade, ['visibleBelowDiscHeightShare', 'hiddenAboveDiscHeightShare'], 'World context orbit-line fade');
  const drag = record(input.drag, 'World context drag'); keys(drag, ['model'], 'World context drag');
  if (drag.model !== 'screen-axis-tumble') throw new TypeError('World context drag model is unsupported.');
  const billboardFadeStartDiscPixels = positive(levelOfDetail.billboardFadeStartDiscPixels, 'World context billboard fade start');
  const billboardFullDiscPixels = positive(levelOfDetail.billboardFullDiscPixels, 'World context billboard full');
  const markerFadeStartDiscPixels = positive(levelOfDetail.markerFadeStartDiscPixels, 'World context marker fade start');
  const markerFullDiscPixels = positive(levelOfDetail.markerFullDiscPixels, 'World context marker full');
  const visibleBelowDiscHeightShare = positive(orbitLineFade.visibleBelowDiscHeightShare, 'World context orbit visible share');
  const hiddenAboveDiscHeightShare = positive(orbitLineFade.hiddenAboveDiscHeightShare, 'World context orbit hidden share');
  if (!(billboardFadeStartDiscPixels > billboardFullDiscPixels && markerFadeStartDiscPixels > markerFullDiscPixels && hiddenAboveDiscHeightShare > visibleBelowDiscHeightShare)) throw new TypeError('World context presentation thresholds are invalid.');
  return freeze({ projection: freeze({ model: projection.model, cssPerspective: text(projection.cssPerspective, 'World context CSS perspective') }),
    dolly: freeze({ model: dolly.model, wheelStepPerDelta: positive(dolly.wheelStepPerDelta, 'World context wheel step'), minimumDistanceRadii: positive(dolly.minimumDistanceRadii, 'World context minimum radii'), maximumDistanceOverOrbitExtent: positive(dolly.maximumDistanceOverOrbitExtent, 'World context orbit extent') }),
    levelOfDetail: freeze({ model: levelOfDetail.model, billboardFadeStartDiscPixels, billboardFullDiscPixels, markerFadeStartDiscPixels, markerFullDiscPixels }),
    orbitLineFade: freeze({ visibleBelowDiscHeightShare, hiddenAboveDiscHeightShare }), drag: freeze({ model: drag.model }) });
}
function validateState(state: OrbitalState, id: string): void {
  identifier(state.centerBodyId, `${id} orbit parent`);
  [state.positionM, state.centerPositionM, state.normal, state.perihelionDirection].forEach((value, index) => { if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new TypeError(`${id} vector ${index} is invalid.`); });
  const axis = finite(state.semiMajorAxisM, `${id} semi-major axis`), eccentricity = state.eccentricity;
  if (!(Number.isFinite(eccentricity) && eccentricity >= 0 && eccentricity !== 1 &&
      (eccentricity < 1 ? axis > 0 : axis < 0)) || !Number.isFinite(state.trueAnomalyRadians) ||
      1 + eccentricity * Math.cos(state.trueAnomalyRadians) <= 0 || Math.abs(dot(state.normal, state.perihelionDirection)) > 1e-8) {
    throw new TypeError(`${id} orbit is invalid.`);
  }
}
function ellipse(centre: Vector3, perihelion: Vector3, motion: Vector3, major: number, minor: number, anomaly: number): Vector3 { return add(centre, add(scale(perihelion, major * Math.cos(anomaly)), scale(motion, minor * Math.sin(anomaly)))); }
function trailWeights(segments: number, trail: WorldContextSource['orbit']['trail']): readonly number[] { return freeze(Array.from({ length: segments }, (_, index) => { const behind = (segments - index - .5) / segments; return Number((behind <= trail.solidTurns ? 1 : Math.max(0, 1 - (behind - trail.solidTurns) / trail.fadeTurns)).toFixed(6)); })); }
function record(value: unknown, name: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`); return value as Record<string, unknown>; }
function keys(value: Record<string, unknown>, allowed: readonly string[], name: string): void { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${name}.${key} is not supported.`); }
function text(value: unknown, name: string): string { if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be text.`); return value; }
function identifier(value: unknown, name: string): string { const result = text(value, name); if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new TypeError(`${name} must be an identifier.`); return result; }
function color(value: unknown): string { const result = text(value, 'World context color'); if (!/^#[a-f0-9]{6}$/i.test(result)) throw new TypeError('World context color must be hex RGB.'); return result; }
function finite(value: unknown, name: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite.`); return value; }
function positive(value: unknown, name: string): number { const result = finite(value, name); if (!(result > 0)) throw new TypeError(`${name} must be positive.`); return result; }
function nonnegative(value: unknown, name: string): number { const result = finite(value, name); if (result < 0) throw new TypeError(`${name} must be nonnegative.`); return result; }
function integer(value: unknown, name: string): number { const result = positive(value, name); if (!Number.isInteger(result)) throw new TypeError(`${name} must be an integer.`); return result; }
function tuple(value: unknown, size: number, name: string): readonly number[] { if (!Array.isArray(value) || value.length !== size || value.some(item => typeof item !== 'number' || !Number.isFinite(item))) throw new TypeError(`${name} must contain ${size} finite numbers.`); return Object.freeze([...value]); }
function freeze<T>(value: T): T { return Object.freeze(value); }
function copy(value: Vector3): Vector3 { return Object.freeze([value[0], value[1], value[2]]); }
function scale(value: Vector3, scalar: number): Vector3 { return [value[0] * scalar, value[1] * scalar, value[2] * scalar]; }
function add(a: Vector3, b: Vector3): Vector3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function cross(a: Vector3, b: Vector3): Vector3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a: Vector3, b: Vector3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function unit(value: Vector3): Vector3 { const length = Math.hypot(...value); if (!(length > 0)) throw new TypeError('Orbit direction is undefined.'); return scale(value, 1 / length); }

function parseSkyBaseline(value: unknown): SkyBaseline {
  const input = record(value, 'World context sky baseline');
  keys(input, ['scenePitchDegrees', 'sceneYawDegrees', 'skyPitchDegrees', 'skyYawDegrees', 'skyRollDegrees', 'source'], 'World context sky baseline');
  return freeze({ scenePitchDegrees: finite(input.scenePitchDegrees, 'Sky baseline scene pitch'), sceneYawDegrees: finite(input.sceneYawDegrees, 'Sky baseline scene yaw'),
    skyPitchDegrees: finite(input.skyPitchDegrees, 'Sky baseline pitch'), skyYawDegrees: finite(input.skyYawDegrees, 'Sky baseline yaw'), skyRollDegrees: finite(input.skyRollDegrees, 'Sky baseline roll'),
    source: text(input.source, 'Sky baseline source') });
}
/** R = inverse(scene baseline) × legacy sky baseline. Runtime only multiplies its observer rotation by R. */
function prepareSkyRegistration(baseline: SkyBaseline): { readonly sceneRegistration: string } {
  const rotation = (axis: 'x' | 'y' | 'z', degrees: number): readonly number[] => {
    const radians = degrees * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
    return axis === 'x' ? [1,0,0,0,c,-s,0,s,c] : axis === 'y' ? [c,0,s,0,1,0,-s,0,c] : [c,-s,0,s,c,0,0,0,1];
  };
  const multiply = (a: readonly number[], b: readonly number[]) => Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3), column = index % 3;
    return a[row*3]! * b[column]! + a[row*3+1]! * b[column+3]! + a[row*3+2]! * b[column+6]!;
  });
  const inverseScene = multiply(rotation('y', -baseline.sceneYawDegrees), rotation('x', -baseline.scenePitchDegrees));
  const sky = multiply(multiply(rotation('y', baseline.skyYawDegrees), rotation('x', baseline.skyPitchDegrees)), rotation('z', baseline.skyRollDegrees));
  const r = multiply(inverseScene, sky);
  const css = [r[0]!,r[3]!,r[6]!,0,r[1]!,r[4]!,r[7]!,0,r[2]!,r[5]!,r[8]!,0,0,0,0,1];
  return freeze({ sceneRegistration: `matrix3d(${css.map(value => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(',')})` });
}
