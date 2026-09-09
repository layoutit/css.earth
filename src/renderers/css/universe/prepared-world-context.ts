import { parsePreparedOrbitCenters } from './prepared-orbit-centers.js';
import type { PreparedOrbitCenter } from './prepared-orbit-centers.js';
import { createRetainedLeafPool } from '../rendering/retained-leaf-pool.js';
import { screenPicking } from '../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';
import type { PositionM } from '@cssearth/engine';
import { createLabelDeclutter } from '@cssearth/engine';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { array, finite, numbers, positive, record, text, unique } from '../validation/guards.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, validateWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { levelOfDetailFor, orbitLineOpacity } from '../navigation/perspective-dolly.js';
import type { LevelOfDetailPlan, OrbitLineFade } from '../navigation/types.js';
import { clipSegmentToRectangle, rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPreparedRingProjector, createSphereChordTest, orbitBoundsMayContribute } from '../solar-system/prepared-ring-projection.js';
import { applySprite, writePieces } from '../solar-system/heliocentric-sprites.js';
import { bindObjectNavigationTarget } from '../solar-system/heliocentric-navigation.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import type { OrbitSegment } from '../solar-system/heliocentric-view.js';

const BODY_INDICATOR_DIAMETER = 16;
const CONTEXT_LINE_WIDTH = 1;
const ORBIT_FADE_START_PIXELS = 12;

function orbitPresentation(segments: readonly OrbitSegment[]) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of segments) {
    left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
    top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
  }
  const extent = Math.max(1, right - left, bottom - top);
  const opacity = logarithmicFade(extent, ORBIT_FADE_START_PIXELS, 48);
  // Every orbit and its unresolved body annotation share one zoom fade.
  return { width: CONTEXT_LINE_WIDTH, opacity };
}

function orbitOverlapsLabel(orbits: readonly { segments: readonly OrbitSegment[]; orbitVisibility: number; lineWidth: number }[], x: number, y: number, width: number, height: number): boolean {
  const cx = x + width / 2, cy = y + height / 2;
  return orbits.some(({ segments, orbitVisibility, lineWidth }) => {
    // Reserve the visible stroke plus one pixel. Faded geometry cannot hide text.
    const clearance = lineWidth / 2 + 1, rx = width / 2 + clearance, ry = height / 2 + clearance;
    return segments.some(([x0, y0, x1, y1, weight]) => {
      if (orbitVisibility * weight <= 0.1) return false;
      if (Math.max(x0, x1) < cx - rx || Math.min(x0, x1) > cx + rx ||
          Math.max(y0, y1) < cy - ry || Math.min(y0, y1) > cy + ry) return false;
      return clipSegmentToRectangle([x0 - cx, y0 - cy], [x1 - cx, y1 - cy], rx, ry) !== null;
    });
  });
}

// Clip already-projected chords at the UI marker, preserving the prepared orbit.
function orbitOutsideMarker(segments: readonly OrbitSegment[], x: number, y: number, radius: number): readonly OrbitSegment[] {
  const radiusSquared = radius ** 2;
  const result: OrbitSegment[] = [];
  for (const segment of segments) {
    const [x0, y0, x1, y1, weight] = segment;
    const dx = x1 - x0, dy = y1 - y0, sx = x0 - x, sy = y0 - y;
    const a = dx * dx + dy * dy, b = sx * dx + sy * dy;
    const discriminant = b * b - a * (sx * sx + sy * sy - radiusSquared);
    if (discriminant <= 0) { result.push(segment); continue; }
    const root = Math.sqrt(discriminant);
    const enter = Math.max(0, (-b - root) / a), leave = Math.min(1, (-b + root) / a);
    if (enter >= leave) { result.push(segment); continue; }
    if (enter * Math.sqrt(a) >= 0.05) result.push([x0, y0, x0 + dx * enter, y0 + dy * enter, weight]);
    if ((1 - leave) * Math.sqrt(a) >= 0.05) result.push([x0 + dx * leave, y0 + dy * leave, x1, y1, weight]);
  }
  return result;
}
import { compactOrbitFootprint } from './context-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';

const LABEL_FADE_MS = 200;
interface LabelFadeState { element: HTMLElement; target: number; hideTimer: number | null; }

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
  readonly systemView?: { readonly memberIds: readonly string[]; readonly memberRadiiM: readonly number[];
    readonly candidates: readonly { readonly cameraToReference: readonly number[];
      readonly minimumM: PositionM; readonly maximumM: PositionM; readonly memberPositionsM: readonly PositionM[] }[] };
  readonly orbit?: { readonly centerBodyId: string; readonly centerPositionM: PositionM; readonly verticesM: readonly PositionM[]; readonly trail: readonly number[];
    readonly bounds?: { readonly centerM: PositionM; readonly radiusM: number }; readonly activeChords?: readonly number[] };
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
export interface PreparedWorldContext {
  readonly schema: 'cssearth-world-context@1';
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: PreparedContextFocus;
  readonly bodies: readonly PreparedContextBody[];
  readonly orbitCenters?: Readonly<Record<string, PreparedOrbitCenter>>;
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

function vector(value: unknown, label: string): PositionM {
  const values = numbers(value, label, 3);
  return Object.freeze([values[0], values[1], values[2]]);
}
function point(value: unknown, fields: readonly string[] = ['id', 'name', 'color', 'positionM', 'radiusM']): PreparedContextPoint {
  const input = record(value, 'context point', fields);
  const id = text(input.id, 'point identity'), color = text(input.color, 'point color');
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^#[a-f0-9]{6}$/i.test(color)) throw new TypeError('Invalid context point identity or color.');
  return Object.freeze({ id, color, name: text(input.name, 'point name'),
    positionM: vector(input.positionM, 'point position'), radiusM: positive(input.radiusM, 'point radius') });
}
function parseSystemView(value: unknown): PreparedContextBody['systemView'] {
  if (value === undefined) return undefined;
  const view = record(value, 'system view', ['memberIds', 'memberRadiiM', 'candidates']);
  const memberIds = array(view.memberIds, 'system members').map(id => text(id, 'system member id'));
  if (!memberIds.length) throw new TypeError('System view must include members.');
  unique(memberIds, 'system member ids');
  const memberRadiiM = array(view.memberRadiiM, 'system member radii').map(value => positive(value, 'system member radius'));
  if (memberRadiiM.length !== memberIds.length) throw new TypeError('System view needs one radius per member.');
  const candidates = array(view.candidates, 'system view candidates').map(value => {
    const candidate = record(value, 'system view candidate', ['cameraToReference', 'minimumM', 'maximumM', 'memberPositionsM']);
    const cameraToReference = numbers(candidate.cameraToReference, 'system view rotation');
    validateWorldRotation(cameraToReference);
    const minimumM = vector(candidate.minimumM, 'system view minimum'), maximumM = vector(candidate.maximumM, 'system view maximum');
    if (minimumM.some((value, axis) => value >= maximumM[axis]!)) throw new TypeError('System view bounds must have positive extent.');
    const memberPositionsM = array(candidate.memberPositionsM, 'system member positions').map(value => vector(value, 'system member position'));
    if (memberPositionsM.length !== memberIds.length) throw new TypeError('System view needs one position per member.');
    return Object.freeze({ cameraToReference: Object.freeze(cameraToReference), minimumM, maximumM, memberPositionsM: Object.freeze(memberPositionsM) });
  });
  if (!candidates.length) throw new TypeError('System view must include candidate views.');
  return Object.freeze({ memberIds: Object.freeze(memberIds), memberRadiiM: Object.freeze(memberRadiiM), candidates: Object.freeze(candidates) });
}
function focusPoint(value: unknown): PreparedContextFocus {
  const input = record(value, 'context focus', ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView']);
  const raw = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource', 'systemView']);
  const systemView = parseSystemView(input.systemView);
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
function equalPosition(a: PositionM, b: PositionM): boolean { return a.every((value, index) => value === b[index]); }
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
export function parsePreparedWorldContext(value: unknown): PreparedWorldContext {
  const input = record(value, 'world context', ['schema', 'frame', 'focus', 'bodies', 'orbitCenters', 'camera', 'volume', 'stars', 'system', 'sky']);
  if (input.schema !== 'cssearth-world-context@1') throw new TypeError('Unsupported prepared world context.');
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World context requires its prepared frame.');
  const focus = focusPoint(input.focus);
  if (!equalPosition(focus.positionM, frame.originM)) throw new TypeError('World context focus must be at its frame origin.');
  const bodies = array(input.bodies, 'context bodies').map<PreparedContextBody>(value => {
    const input = record(value, 'context body', ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit', 'systemView']);
    const rawBody = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit', 'systemView']);
    const systemView = parseSystemView(input.systemView);
    const body = systemView ? { ...rawBody, systemView } : rawBody;
    if (input.orbit === undefined) return body;
    const orbit = record(input.orbit, 'body orbit', ['centerBodyId', 'centerPositionM', 'verticesM', 'trail', 'bounds', 'activeChords']);
    const centerBodyId = text(orbit.centerBodyId, 'orbit parent identity'), centerPositionM = vector(orbit.centerPositionM, 'orbit centre position');
    const verticesM = array(orbit.verticesM, 'orbit vertices').map(value => vector(value, 'orbit vertex'));
    const trail = numbers(orbit.trail, 'orbit trail');
    if (verticesM.length < 8 || trail.length !== verticesM.length || trail.some(value => value < 0 || value > 1) || !equalPosition(body.positionM, verticesM[0]!)) {
      throw new TypeError('Context orbit must align with its body and carry matching prepared trail weights.');
    }
    const activeChords = orbit.activeChords === undefined ? undefined : numbers(orbit.activeChords, 'active orbit chords');
    if (activeChords) {
      const expected = trail.flatMap((weight, index) => weight > 0 ? [index] : []);
      if (activeChords.length !== expected.length || activeChords.some((index, ordinal) => index !== expected[ordinal])) {
        throw new TypeError('Prepared active chords must match every positive trail weight in order.');
      }
    }
    let bounds: { readonly centerM: PositionM; readonly radiusM: number } | undefined;
    if (orbit.bounds !== undefined) {
      const input = record(orbit.bounds, 'orbit bounds', ['centerM', 'radiusM']);
      const centerM = vector(input.centerM, 'orbit bounds centre'), radiusM = positive(input.radiusM, 'orbit bounds radius');
      if (verticesM.some((vertex, index) => (trail[index] > 0 || trail[(index + trail.length - 1) % trail.length] > 0) &&
        Math.hypot(...vertex.map((value, axis) => value - centerM[axis])) > radiusM)) {
        throw new TypeError('Prepared orbit bounds must contain every active chord endpoint.');
      }
      bounds = Object.freeze({ centerM, radiusM });
    }
    // Older prepared banks retain the exact projection path; no runtime bounds bake.
    return Object.freeze({ ...body, orbit: Object.freeze({ centerBodyId, centerPositionM, verticesM: Object.freeze(verticesM), trail: Object.freeze(trail),
      ...(bounds ? { bounds } : {}), ...(activeChords ? { activeChords: Object.freeze(activeChords) } : {}) }) });
  });
  if (bodies.length === 0) throw new TypeError('World context requires bodies.');
  unique([focus.id, ...bodies.map(body => body.id)], 'context body identities');
  for (const body of [focus, ...bodies]) for (const [index, id] of (body.systemView?.memberIds ?? []).entries()) {
    const moon = bodies.find(moon => moon.id === id && moon.orbit?.centerBodyId === body.id);
    if (!moon) {
      throw new TypeError('System view members must orbit their prepared parent.');
    }
    if (moon.radiusM !== body.systemView!.memberRadiiM[index]) throw new TypeError('System view radii must match their prepared members.');
  }
  const orbitCenters = parsePreparedOrbitCenters(input.orbitCenters, focus, bodies);
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
  return Object.freeze({ schema: 'cssearth-world-context@1', frame, focus, bodies: Object.freeze(bodies),
    ...(input.orbitCenters === undefined ? {} : { orbitCenters }),
    camera: Object.freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom, presentation }),
    volume: Object.freeze({ objectId, fadeStartDistanceM, fullDistanceM,
      ...(volume.opacityProfile === undefined ? {} : { opacityProfile: parseVolumeOpacityProfile(volume.opacityProfile) }),
      ...(volume.brightnessProfile === undefined ? {} : { brightnessProfile: parseVolumeOpacityProfile(volume.brightnessProfile) }) }),
    stars: Object.freeze({ objectId: starId, fadeStartDistanceM: starStart, fullDistanceM: starFull }),
    system: Object.freeze({ fadeOutStartDistanceM, hiddenDistanceM }), sky });
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

export function logarithmicFade(distanceM: number, startM: number, endM: number): number {
  const t = Math.max(0, Math.min(1, (Math.log(distanceM) - Math.log(startM)) / (Math.log(endM) - Math.log(startM))));
  return t * t * (3 - 2 * t);
}

/** Existing retained segment/sprite rendering, driven by the same observer as the detailed body. */
export function mountPreparedWorldContext({ host, before, plan, sprites, annotationPriorities = {} }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; sprites: Readonly<Record<string, SpriteWithUrl>>;
  annotationPriorities?: Readonly<Record<string, number>>;
}) {
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-world-context';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.dataset.worldContext = plan.focus.id;
  host.insertBefore(root, before);
  const picking = screenPicking(host);
  let pickTargets: ScreenPickTarget[] = [];
  const points = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  const bodies = [plan.focus, ...plan.bodies].map(body => {
    const sprite = sprites[body.id];
    if (!sprite) { root.remove(); throw new TypeError(`Missing prepared navigation sprite ${body.id}.`); }
    const group = host.ownerDocument.createElement('div');
    group.dataset.contextGroup = body.id;
    group.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    root.appendChild(group);
    const marker = host.ownerDocument.createElement('s');
    marker.dataset.contextBody = body.id;
    marker.style.cssText = 'position:absolute;left:50%;top:50%;background-repeat:no-repeat;text-decoration:none;transform-origin:center;visibility:hidden';
    applySprite(marker, sprite);
    const indicator = host.ownerDocument.createElement('i');
    indicator.dataset.contextIndicator = body.id;
    indicator.style.width = indicator.style.height = `${BODY_INDICATOR_DIAMETER}px`;
    indicator.style.visibility = 'hidden';
    indicator.style.setProperty('--context-line-width', `${CONTEXT_LINE_WIDTH}px`);
    const anchorCorners = host.ownerDocument.createElement('span');
    anchorCorners.className = 'context-anchor-corners';
    anchorCorners.setAttribute('aria-hidden', 'true');
    indicator.appendChild(anchorCorners);
    const label = host.ownerDocument.createElement('span');
    label.dataset.contextLabel = body.id;
    label.textContent = body.name;
    label.style.cssText = 'position:absolute;left:50%;top:50%;white-space:nowrap;visibility:hidden';
    label.style.opacity = 'calc(var(--context-label-alpha, 0) * var(--context-label-opacity, 1))';
    label.style.setProperty('--context-label-alpha', '0');
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    const orbitRoot = host.ownerDocument.createElement('div');
    orbitRoot.className = 'context-orbit';
    orbitRoot.dataset.contextOrbit = body.id;
    orbitRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    orbitRoot.style.setProperty('--context-line-width', `${CONTEXT_LINE_WIDTH}px`);
    orbitRoot.style.setProperty('--context-orbit-pointer-events', 'none');
    if (orbit) group.appendChild(orbitRoot);
    const piecePool = createRetainedLeafPool(orbitRoot, orbit ? orbit.verticesM.length * 2 : 0, 'context-orbit-block');
    const pieces = piecePool.elements;
    group.append(marker, indicator, label);
    const navigation = bindObjectNavigationTarget(marker, host);
    const indicatorNavigation = bindObjectNavigationTarget(indicator, host);
    const labelNavigation = bindObjectNavigationTarget(label, host);
    const orbitNavigation = orbit ? bindObjectNavigationTarget(orbitRoot, host) : null;
    return { body, group, sprite, marker, indicator, label, orbit, orbitRoot, parent: orbit ? points.get(orbit.centerBodyId) ?? null : null, pieces, piecePool, navigation, indicatorNavigation, labelNavigation, orbitNavigation,
      closedOrbit: orbit?.trail.every(weight => weight === 1) === true,
      indicatorRadius: BODY_INDICATOR_DIAMETER / 2,
      orbitPick: null as ScreenPickTarget | null,
      indicatorPick: null as ScreenPickTarget | null,
      orbitAppearance: { width: CONTEXT_LINE_WIDTH, opacity: 1 },
      orbitNavigable: false,
      orbitHidden: false, labelHidden: false,
      orbitClip: null as { segments: readonly OrbitSegment[]; x: number; y: number } | null,
      labelSize: { width: 0, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorCutout: false, previousCount: 0,
      fade: { element: label, target: 0, hideTimer: null } as LabelFadeState };
  });
  // CSS owns the ring size. Observe its border box only when it changes, and
  // reclip the cached screen-space chords without republishing the scene.
  const markerEntries = new Map(bodies.map(entry => [entry.indicator, entry]));
  const markerResize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(changes => {
    if (destroyed) return;
    for (const change of changes) {
      const entry = markerEntries.get(change.target as HTMLElement);
      const box = change.borderBoxSize[0];
      if (!entry || !box) continue;
      const radius = Math.max(box.inlineSize, box.blockSize) / 2;
      if (!(radius > 0) || radius === entry.indicatorRadius) continue;
      entry.indicatorRadius = radius;
      if (entry.indicatorPick?.shape.kind === 'circle') entry.indicatorPick.shape.radius = radius + 5;
      const clip = entry.orbitClip;
      if (!clip) continue;
      const segments = entry.indicatorCutout
        ? orbitOutsideMarker(clip.segments, clip.x, clip.y, radius) : clip.segments;
      const update = writePieces(entry.pieces, segments, entry.previousCount, entry.piecePool.setVisible);
      if (update.overflowed) throw new Error('Prepared context line pool overflowed.');
      entry.previousCount = update.count;
      if (entry.orbitPick) entry.orbitPick.shape = { kind: 'segments', segments, halfWidth: entry.orbitAppearance.width / 2 + 7 };
    }
    picking.publish(root, navigationInFlight ? [] : pickTargets);
  });
  for (const entry of bodies) markerResize?.observe(entry.indicator, { box: 'border-box' });
  const labels = createLabelDeclutter({ capacity: bodies.length, spacingPixels: 4 });
  const indicators = createLabelDeclutter({ capacity: bodies.length, spacingPixels: 2 });
  const windowTarget = host.ownerDocument.defaultView!;
  const fader = createOpacityFader(windowTarget, '--context-label-alpha');
  const clearHide = (state: LabelFadeState) => {
    if (state.hideTimer !== null) windowTarget.clearTimeout(state.hideTimer);
    state.hideTimer = null;
  };
  const fade = (state: LabelFadeState, target: number, cull: boolean) => {
    state.target = target;
    if (cull || (target === 0 && Number(state.element.style.getPropertyValue('--context-label-alpha')) === 0)) {
      clearHide(state); fader.set(state.element, 0); state.element.style.visibility = 'hidden';
    } else if (target > 0) {
      clearHide(state); state.element.style.visibility = ''; fader.set(state.element, target, LABEL_FADE_MS);
    } else {
      fader.set(state.element, 0, LABEL_FADE_MS);
      if (state.hideTimer === null) state.hideTimer = windowTarget.setTimeout(() => {
        state.hideTimer = null;
        if (state.target === 0) { fader.set(state.element, 0); state.element.style.visibility = 'hidden'; }
      }, LABEL_FADE_MS);
    }
  };
  let labelExclusions: readonly LabelScreenRect[] = [];
  let backgroundExclusions: readonly LabelScreenRect[] = [];
  let destroyed = false;
  let selectedId = plan.focus.id;
  let selectedEntry = bodies[0]!;
  const anchorOnly = [bodies[0]!];
  let systemRetired = false;
  let depthOrientation: readonly number[] | null = null;
  let depthSelection: string | null = null;
  let depthOrder = bodies;
  let pickRanks = new Map<(typeof bodies)[number], number>();
  let overview = false;
  let selectionPreview: string | null | undefined;
  let navigationInFlight = false;
  let latest: { world: WorldCameraPose; viewport: WorldCameraViewport } | null = null;
  const invalidateLabelSizes = () => { for (const entry of bodies) entry.labelSize.width = 0; };
  const fonts = host.ownerDocument.fonts;
  fonts?.addEventListener('loadingdone', invalidateLabelSizes);
  let annotationFrame: number | null = null;
  const refreshAnnotations = () => {
    if (destroyed || annotationFrame !== null) return;
    annotationFrame = windowTarget.requestAnimationFrame(() => {
      annotationFrame = null;
      if (!destroyed && latest) layer.publish(latest.world, latest.viewport);
    });
  };
  const layer = Object.freeze({ root,
    labelExclusionRects: () => labelExclusions,
    backgroundExclusionRects: () => backgroundExclusions,
    setNavigationInFlight(active: boolean) {
      if (destroyed || active === navigationInFlight) return;
      navigationInFlight = active;
      systemRetired = false;
      if (latest) this.publish(latest.world, latest.viewport);
    },
    previewSelection(id?: string | null) {
      if (destroyed) return;
      selectionPreview = id;
      if (latest) this.publish(latest.world, latest.viewport);
    },
    setOverview(enabled: boolean) {
      if (overview === enabled || destroyed) return;
      overview = enabled;
      if (latest) this.publish(latest.world, latest.viewport);
    },
    setHiddenOrbits(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.orbitHidden !== next) { entry.orbitHidden = next; changed = true; }
      }
      if (changed && latest) this.publish(latest.world, latest.viewport);
    },
    setHiddenLabels(ids: readonly string[]) {
      if (destroyed) return;
      const hidden = new Set(ids);
      let changed = false;
      for (const entry of bodies) {
        const next = hidden.has(entry.body.id);
        if (entry.labelHidden !== next) { entry.labelHidden = next; changed = true; }
      }
      if (changed && latest) this.publish(latest.world, latest.viewport);
    },
    inspect() {
      return Object.freeze(bodies.map(({ body, marker, indicator, label, pieces }) => Object.freeze({
        id: body.id, marker, indicator, label, orbit: Object.freeze([...pieces]),
      })));
    },
    selectObject(id: string) {
      const entry = bodies.find(entry => entry.body.id === id);
      if (!entry) throw new TypeError('Selected context body is unavailable.');
      selectedId = id;
      selectedEntry = entry;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
      if (destroyed) return;
      if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt) {
        throw new TypeError('Context and camera reference frames differ.');
      }
      latest = { world, viewport };
      const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
      const opacity = 1 - logarithmicFade(distanceM, plan.system.fadeOutStartDistanceM, plan.system.hiddenDistanceM);
      // Publish the first zero-opacity frame normally to retire picking and
      // start existing label fades. Later frames need only the anchor locator;
      // its siblings keep their prepared DOM and finish their owned fades.
      const publishingBodies = opacity === 0 && systemRetired ? anchorOnly : bodies;
      systemRetired = opacity === 0;
      // Cache the retained UI text bounds before any projection writes.
      for (const entry of publishingBodies) if (entry.labelSize.width === 0) {
        const bounds = entry.label.getBoundingClientRect();
        entry.labelSize = { width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
      }
      labels.reset();
      indicators.reset();
      const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
      // Camera translation adds the same depth offset to every prepared body.
      // Only orientation changes their order; selection changes where the
      // retained detail layers (0..3) sit within that order.
      if (!depthOrientation || depthOrientation.some((value, axis) => value !== world.pose.orientationXyzw[axis])) {
        depthOrientation = [...world.pose.orientationXyzw];
        const depth = (entry: (typeof bodies)[number]) => -(
          rotation[6]! * entry.body.positionM[0] + rotation[7]! * entry.body.positionM[1] + rotation[8]! * entry.body.positionM[2]);
        depthOrder = [...bodies].sort((a, b) => depth(b) - depth(a));
        pickRanks = new Map(depthOrder.map((entry, index) => [entry, index * 4]));
        depthSelection = null;
      }
      if (depthSelection !== selectedId) {
        depthSelection = selectedId;
        const selectedIndex = depthOrder.indexOf(selectedEntry);
        for (const [index, entry] of depthOrder.entries()) {
          const relativeDepth = index - selectedIndex;
          const zIndex = String(relativeDepth > 0 ? relativeDepth + 3 : relativeDepth);
          if (entry.group.style.zIndex !== zIndex) entry.group.style.zIndex = zIndex;
        }
      }
      const toEye = (position: readonly number[]): PositionM => rotateWorldPosition(rotation, [
        position[0] - world.pose.positionM[0], position[1] - world.pose.positionM[1], position[2] - world.pose.positionM[2]]);
      const emphasizedId = selectionPreview === undefined ? (overview ? null : selectedId) : selectionPreview;
      const [ox, oy] = viewport.principalOffsetPixels;
      const focal = viewport.focalPixels;
      // Publication shares the camera owner's resize snapshot. Reading layout
      // here would flush the preceding sky/shell writes on every flight frame.
      const width = viewport.widthPixels ?? host.clientWidth;
      const height = viewport.heightPixels ?? host.clientHeight;
      const project = (eye: readonly number[]): readonly number[] => [ox + focal * eye[0] / -eye[2], oy + focal * eye[1] / -eye[2]];
      const focusEye = toEye(plan.focus.positionM);
      const selected = selectedEntry.body;
      const selectedEye = toEye(selected.positionM);
      const focusMayOcclude = createSphereChordTest(focusEye, plan.focus.radiusM, project);
      const selectedMayOcclude = selected.id === plan.focus.id ? focusMayOcclude
        : createSphereChordTest(selectedEye, selected.radiusM, project);
      const hidden = (eye: readonly number[], id?: string) =>
        (id !== plan.focus.id && rayHitsSphereBefore(eye, focusEye, plan.focus.radiusM)) ||
        (id !== selected.id && rayHitsSphereBefore(eye, selectedEye, selected.radiusM));
      const focusDiameter = selectedEye[2] < -selected.radiusM
        ? 2 * focal * selected.radiusM / Math.sqrt(selectedEye[2] ** 2 - selected.radiusM ** 2) : Number.POSITIVE_INFINITY;
      const lod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, focusDiameter);
      const orbitOpacity = orbitLineOpacity(plan.camera.presentation.orbitLineFade, focusDiameter / height);
      const near = opacity > 0 && orbitOpacity > 0
        ? Math.max(1, Math.min(...bodies.map(entry => Math.hypot(...toEye(entry.body.positionM)))) * 0.01) : 1;
      let anchorLineWidth = CONTEXT_LINE_WIDTH;
      // Declutter annotations without changing physical bodies or projected orbits.
      const projectedBodies: { entry: (typeof bodies)[number]; x: number; y: number; depth: number; diameter: number; markerOpacity: number; indicatorOpacity: number; visible: boolean; annotationVisible: boolean; hovered: boolean; inFrame: boolean; priority: number; lineWidth: number; orbitVisibility: number; segments: readonly OrbitSegment[]; labelPosition?: readonly number[] }[] = [];
      for (const entry of publishingBodies) {
        const { body, marker, indicator, label } = entry;
        const eye = toEye(body.positionM), depth = -eye[2];
        const parentEye = entry.parent ? toEye(entry.parent.positionM) : null;
        const parentHidden = (position: readonly number[]) => parentEye !== null && rayHitsSphereBefore(position, parentEye, entry.parent!.radiusM);
        const parentMayOcclude = entry.parent === null ? null : entry.parent.id === plan.focus.id ? focusMayOcclude
          : entry.parent.id === selected.id ? selectedMayOcclude : createSphereChordTest(parentEye!, entry.parent.radiusM, project);
        const [x, y] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isSelected = body.id === selectedId;
        entry.group.dataset.contextSelected = emphasizedId === null ? "overview" : String(body.id === emphasizedId);
        const isAnchor = body.id === plan.focus.id;
        const inFrame = depth > body.radiusM && Math.abs(x) < width / 2 && Math.abs(y) < height / 2;
        const visible = inFrame && !hidden(eye, body.id) && !parentHidden(eye);
        // The one retained anchor indicator is also the galactic locator.
        // Unresolved foreground points cannot occlude this annotation; physical sprites keep exact occlusion.
        const annotationVisible = isAnchor ? inFrame && !(selectedId !== body.id &&
          focusDiameter >= plan.camera.presentation.levelOfDetail.markerFullDiscPixels &&
          rayHitsSphereBefore(eye, selectedEye, selected.radiusM)) : visible;
        const hovered = entry.group.dataset.objectHovered === 'true' || label.dataset.objectHovered === 'true' || marker.dataset.objectHovered === 'true' || indicator.dataset.objectHovered === 'true' || host.ownerDocument.activeElement === label || host.ownerDocument.activeElement === indicator;
        // Satellites always use every prepared chord at uniform trail weight.
        // Selection and hover must not switch their paths back to partial trails.
        const satellite = entry.parent !== null && entry.parent.id !== plan.focus.id;
        const fullOrbit = satellite || hovered;
        // Prepared bounds enclose the faded trail, not necessarily the complete orbit.
        const bounds = fullOrbit ? undefined : entry.orbit?.bounds;
        const segments = entry.orbit && opacity > 0 && orbitOpacity > 0 &&
          (!bounds || orbitBoundsMayContribute(toEye(bounds.centerM), bounds.radiusM, focal, [ox, oy], near, width / 2, height / 2, ORBIT_FADE_START_PIXELS)) ? createPreparedRingProjector({ toEye, project, hidden: eye => hidden(eye) || parentHidden(eye),
          mayOcclude: (a, b) => focusMayOcclude(a, b) || selectedMayOcclude(a, b) || Boolean(parentMayOcclude?.(a, b)),
          near, clipX: width / 2, clipY: height / 2 })(entry.orbit.verticesM, entry.orbit.trail, entry.orbit.activeChords, fullOrbit) : [];
        if (entry.orbit) entry.orbitAppearance = orbitPresentation(segments);
        const appearance = entry.orbitAppearance;
        const bodyLod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, diameter);
        const proxyOpacity = 1 - bodyLod.markerOpacity * (1 - appearance.opacity);
        const markerOpacity = (isSelected ? lod.billboardOpacity : 1) *
          (isAnchor ? 1 : opacity * (isSelected ? 1 : proxyOpacity));
        const orbitVisibility = entry.orbitHidden && !hovered ? 0 : appearance.opacity * orbitOpacity * opacity;
        if (entry.orbit && orbitVisibility > 0) anchorLineWidth = Math.max(anchorLineWidth, appearance.width);
        const indicatorOpacity = isAnchor && overview ? 1 :
          bodyLod.markerOpacity * (isAnchor ? 1 : entry.orbitHidden || !entry.orbit ? opacity : orbitVisibility);
        const primary = !entry.orbit || entry.orbit.centerBodyId === plan.focus.id;
        // Class priority outranks the small stability bonus; explicit interaction outranks class.
        const priority = (isAnchor ? 4e6 : 0) + (hovered ? 16e6 : 0) + (body.id === emphasizedId ? 6e6 : isSelected ? 1e6 : 0) +
          (annotationPriorities[body.id] ?? 0) * 1e4 + (primary ? 1000 : 0) + Math.min(99, diameter);
        if (annotationVisible && indicatorOpacity > 0) {
          const radius = BODY_INDICATOR_DIAMETER / 2, padding = entry.indicatorShown ? 0 : 2;
          indicators.add({ owner: 0, id: body.id, priority: priority + (entry.indicatorShown ? 100 : 0),
            anchor: [x, y], widthPx: BODY_INDICATOR_DIAMETER + padding * 2,
            bottomOffsetPx: -radius - padding, topOffsetPx: radius + padding });
        }
        projectedBodies.push({ entry, x, y, depth, diameter, markerOpacity, indicatorOpacity, visible, annotationVisible, hovered, inFrame, priority, lineWidth: appearance.width, orbitVisibility, segments });
      }
      // An orbitless anchor uses the same stroke as the visible system, then thins as it recedes.
      projectedBodies[0].lineWidth = anchorLineWidth;
      indicators.resolve();
      for (const projected of projectedBodies) {
        const { entry, x, y, segments } = projected;
        entry.indicatorShown = indicators.accepted(0, entry.body.id);
        const orbitVisibility = projected.orbitVisibility;
        if (!entry.orbit) continue;
        entry.orbitClip = { segments: orbitVisibility > 0 ? segments : [], x, y };
        entry.indicatorCutout = entry.indicatorShown && (!navigationInFlight || emphasizedId === null || entry.body.id === emphasizedId || entry.parent?.id === emphasizedId);
        const clipped = entry.indicatorCutout
          ? orbitOutsideMarker(entry.orbitClip.segments, x, y, entry.indicatorRadius) : entry.orbitClip.segments;
        projected.segments = clipped;
      }
      const placedLabels: LabelScreenRect[] = [];
      const labelPriority = (body: (typeof projectedBodies)[number]) => body.priority + (body.entry.labelShown ? 100 : 0);
      // Reserve higher-priority text first so every later label can try another
      // side, instead of submitting one position and disappearing on collision.
      for (const projected of [...projectedBodies].sort((a, b) => labelPriority(b) - labelPriority(a))) {
        const { entry, x, y, diameter, markerOpacity, indicatorOpacity, annotationVisible, hovered, priority, orbitVisibility } = projected;
        const { body, labelSize: size } = entry;
        const satellite = entry.parent !== null && entry.parent.id !== plan.focus.id;
        const resolvedDisc = diameter >= plan.camera.presentation.levelOfDetail.markerFadeStartDiscPixels;
        const labelOpacity = hovered ? 1 : entry.orbitHidden ? opacity * (body.id === selectedId ? lod.billboardOpacity : 1) : markerOpacity;
        if (!annotationVisible || size.width === 0 || (!hovered &&
            ((entry.labelHidden && body.id !== emphasizedId) || labelOpacity <= 0.5 ||
            (!resolvedDisc && body.id !== emphasizedId && entry.orbit && !entry.orbitHidden && orbitVisibility <= 0.5) ||
            (indicatorOpacity > 0 && !entry.indicatorShown)))) continue;
        const gap = Math.max(5, diameter / 2, entry.indicatorShown ? BODY_INDICATOR_DIAMETER / 2 : 0) + 4;
        const positions = [[x + gap, y - size.height / 2], [x - gap - size.width, y - size.height / 2],
          [x - size.width / 2, y - gap - size.height], [x - size.width / 2, y + gap]];
        const padding = entry.labelShown ? 0 : 2;
        const labelRect = (lx: number, ly: number) => ({ left: lx - padding, top: ly - padding,
          right: lx + size.width + padding, bottom: ly + size.height + padding });
        // Keep a clear placement stable; try other sides before hiding a label.
        const placements = body.id === plan.focus.id ? [3] :
          diameter >= plan.camera.presentation.levelOfDetail.billboardFullDiscPixels ? [3, 2, 0, 1] :
          [entry.labelPlacement, ...[0, 1, 2, 3].filter(index => index !== entry.labelPlacement)];
        const withinViewport = (index: number) => {
          const [lx, ly] = positions[index];
          return lx >= -width / 2 + 4 && lx + size.width <= width / 2 - 4 &&
            ly >= -height / 2 + 4 && ly + size.height <= height / 2 - 4;
        };
        const placement = placements.find(index => {
          const [lx, ly] = positions[index];
          return withinViewport(index) &&
            !placedLabels.some(other => {
              const rect = labelRect(lx, ly);
              return rect.left < other.right + 4 && rect.right + 4 > other.left &&
                rect.top < other.bottom + 4 && rect.bottom + 4 > other.top;
            }) &&
            !projectedBodies.some(other => {
              if (other.entry === entry || other.entry.orbitHidden || !other.entry.indicatorShown || other.indicatorOpacity <= 0.1) return false;
              const nearestX = Math.max(lx, Math.min(lx + size.width, other.x));
              const nearestY = Math.max(ly, Math.min(ly + size.height, other.y));
              return Math.hypot(nearestX - other.x, nearestY - other.y) < BODY_INDICATOR_DIAMETER / 2 + 4;
            }) && (hovered || body.id === emphasizedId || entry.closedOrbit || satellite || body.id === plan.focus.id ||
              !orbitOverlapsLabel(projectedBodies, lx, ly, size.width, size.height));
        }) ?? (hovered ? placements.find(withinViewport) ?? placements[0] : undefined);
        if (placement === undefined) continue;
        entry.labelPlacement = placement;
        let [labelX, labelY] = positions[placement];
        if (hovered) {
          labelX = Math.max(-width / 2 + 4, Math.min(labelX, width / 2 - size.width - 4));
          labelY = Math.max(-height / 2 + 4, Math.min(labelY, height / 2 - size.height - 4));
        }
        placedLabels.push(labelRect(labelX, labelY));
        labels.add({ owner: 0, id: body.id, priority: priority + (entry.labelShown ? 100 : 0),
          anchor: [labelX + size.width / 2, labelY + size.height + padding],
          widthPx: size.width + padding * 2, bottomOffsetPx: 0, topOffsetPx: size.height + padding * 2 });
        projected.labelPosition = [labelX, labelY];
      }
      labels.resolve();
      const acceptedRects: LabelScreenRect[] = [];
      pickTargets = [];
      const orbitBounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      // Only the resolved presentation owns DOM visibility and hit targets.
      for (const { entry, x, y, diameter, markerOpacity, indicatorOpacity, visible, annotationVisible, hovered, inFrame, lineWidth, orbitVisibility, segments, labelPosition } of projectedBodies) {
        const { body, marker, indicator, label } = entry;
        // An overview flight selects the whole system, so its annotations stay
        // visible. Only a flight to a specific body fades unrelated annotations.
        const annotationsVisible = !navigationInFlight || emphasizedId === null || body.id === emphasizedId || entry.parent?.id === emphasizedId;
        label.style.opacity = annotationsVisible ? 'calc(var(--context-label-alpha, 0) * var(--context-label-opacity, 1))' : '0';
        const pointSource = body.id === plan.focus.id && plan.focus.pointSource !== undefined;
        marker.style.visibility = visible && markerOpacity > 0 && !pointSource ? '' : 'hidden';
        entry.navigation.update(!navigationInFlight && visible && markerOpacity > 0.1 && !pointSource ? body.id : null, body.name);
        if (visible) {
          marker.style.opacity = String(markerOpacity * (emphasizedId !== null && body.id !== emphasizedId && entry.group.dataset.objectHovered !== "true" ? .75 : 1));
          marker.style.transform = `translate(${x}px,${y}px) scale(${Math.max(2.4, diameter) / entry.sprite.size})`;
        }
        const rank = pickRanks.get(entry)!;
        if (visible && markerOpacity > .1 && !pointSource) {
          const radius = Math.max(2.4, diameter) / 2;
          // The sprite's transparent square corners are not body pixels. A
          // large background planet must not steal a foreground surface click
          // through that empty part of its projected rectangle.
          pickTargets.push({ element: marker, rank, shape: { kind: 'circle', x, y, radius } });
        }
        entry.labelShown = labels.accepted(0, entry.body.id);
        const indicatorShown = entry.indicatorShown;
        indicator.style.visibility = indicatorShown ? '' : 'hidden';
        entry.indicatorNavigation.update(!navigationInFlight && indicatorShown && indicatorOpacity > 0.1 ? body.id : null, body.name);
        entry.indicatorPick = indicatorShown && indicatorOpacity > .1 ? { element: indicator, rank: rank + 2,
          shape: { kind: 'circle', x, y, radius: entry.indicatorRadius + 5 } } : null;
        if (entry.indicatorPick) pickTargets.push(entry.indicatorPick);
        if (annotationVisible) {
          indicator.style.opacity = `calc(${annotationsVisible ? indicatorOpacity : 0} * var(--context-line-opacity, 1))`;
          indicator.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        }
        if (entry.orbit) {
          if (entry.orbit.centerBodyId === plan.focus.id && orbitVisibility > .1) for (const [x0, y0, x1, y1] of segments) {
            orbitBounds.left = Math.min(orbitBounds.left, x0, x1); orbitBounds.right = Math.max(orbitBounds.right, x0, x1);
            orbitBounds.top = Math.min(orbitBounds.top, y0, y1); orbitBounds.bottom = Math.max(orbitBounds.bottom, y0, y1);
          }
          const navigable = !navigationInFlight && orbitVisibility > 0.1 && !entry.orbitHidden;
          if (entry.orbitNavigable !== navigable) {
            entry.orbitNavigable = navigable;
            entry.orbitNavigation!.update(navigable ? body.id : null, body.name);
            // Only the painted chords are hit targets, never the full-stage group.
            entry.orbitRoot.style.pointerEvents = 'none';
            entry.orbitRoot.tabIndex = -1;
            entry.orbitRoot.style.setProperty('--context-orbit-pointer-events', navigable ? 'auto' : 'none');
          }
          entry.orbitRoot.style.opacity = `calc(${orbitVisibility} * var(--context-line-opacity, 1))`;
          const update = writePieces(entry.pieces, segments, entry.previousCount, entry.piecePool.setVisible);
          if (update.overflowed) throw new Error('Prepared context line pool overflowed.');
          entry.previousCount = update.count;
          entry.orbitPick = orbitVisibility > .1 && !entry.orbitHidden ? { element: entry.orbitRoot, rank,
            shape: { kind: 'segments', segments, halfWidth: lineWidth / 2 + 7 } } : null;
          if (entry.orbitPick) pickTargets.push(entry.orbitPick);
        }
        const labelOpacity = hovered ? 1 : entry.orbitHidden ? opacity * (body.id === selectedId ? lod.billboardOpacity : 1) : markerOpacity;
        fade(entry.fade, entry.labelShown ? labelOpacity : 0, !inFrame || !annotationVisible);
        entry.labelNavigation.update(!navigationInFlight && entry.labelShown ? body.id : null, body.name);
        if (entry.labelShown && labelPosition) {
          label.style.transform = `translate(${labelPosition[0]}px,${labelPosition[1]}px)`;
          acceptedRects.push({ left: labelPosition[0], top: labelPosition[1],
            right: labelPosition[0] + entry.labelSize.width, bottom: labelPosition[1] + entry.labelSize.height });
          pickTargets.push({ element: label, rank: rank + 1, shape: { kind: 'rect', ...acceptedRects[acceptedRects.length - 1] } });
        }
      }
      labelExclusions = acceptedRects;
      const footprint = compactOrbitFootprint(orbitBounds, width, height);
      backgroundExclusions = footprint ? [...acceptedRects, footprint] : acceptedRects;
      picking.publish(root, navigationInFlight ? [] : pickTargets);
    },
    destroy() { if (!destroyed) { destroyed = true; picking.remove(root);
      if (annotationFrame !== null) windowTarget.cancelAnimationFrame(annotationFrame);
      for (const event of ['objecthoverchange', 'focusin', 'focusout']) host.removeEventListener(event, refreshAnnotations);
      markerResize?.disconnect(); fader.destroy(); fonts?.removeEventListener('loadingdone', invalidateLabelSizes); labelExclusions = []; backgroundExclusions = []; for (const entry of bodies) { clearHide(entry.fade); entry.navigation.destroy(); entry.indicatorNavigation.destroy(); entry.labelNavigation.destroy(); entry.orbitNavigation?.destroy(); } root.remove(); } },
  });
  for (const event of ['objecthoverchange', 'focusin', 'focusout']) host.addEventListener(event, refreshAnnotations);
  return layer;
}
