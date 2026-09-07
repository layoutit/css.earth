import type { PositionM } from '@cssearth/engine';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { array, finite, numbers, positive, record, text, unique } from '../validation/guards.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, validateWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { levelOfDetailFor, orbitLineOpacity } from '../navigation/perspective-dolly.js';
import type { LevelOfDetailPlan, OrbitLineFade } from '../navigation/types.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPreparedRingProjector } from '../solar-system/prepared-ring-projection.js';
import { applySprite, writePieces } from '../solar-system/heliocentric-sprites.js';
import { bindObjectNavigationTarget } from '../solar-system/heliocentric-navigation.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';

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
}
export interface PreparedContextBody extends PreparedContextPoint {
  readonly orbit?: { readonly centerBodyId: string; readonly centerPositionM: PositionM; readonly verticesM: readonly PositionM[]; readonly trail: readonly number[] };
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
function focusPoint(value: unknown): PreparedContextFocus {
  const input = record(value, 'context focus', ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource']);
  const base = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'pointSource']);
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
  const input = record(value, 'world context', ['schema', 'frame', 'focus', 'bodies', 'camera', 'volume', 'stars', 'system', 'sky']);
  if (input.schema !== 'cssearth-world-context@1') throw new TypeError('Unsupported prepared world context.');
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World context requires its prepared frame.');
  const focus = focusPoint(input.focus);
  if (!equalPosition(focus.positionM, frame.originM)) throw new TypeError('World context focus must be at its frame origin.');
  const bodies = array(input.bodies, 'context bodies').map<PreparedContextBody>(value => {
    const input = record(value, 'context body', ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit']);
    const body = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit']);
    if (input.orbit === undefined) return body;
    const orbit = record(input.orbit, 'body orbit', ['centerBodyId', 'centerPositionM', 'verticesM', 'trail']);
    const centerBodyId = text(orbit.centerBodyId, 'orbit parent identity'), centerPositionM = vector(orbit.centerPositionM, 'orbit centre position');
    const verticesM = array(orbit.verticesM, 'orbit vertices').map(value => vector(value, 'orbit vertex'));
    const trail = numbers(orbit.trail, 'orbit trail');
    if (verticesM.length < 8 || trail.length !== verticesM.length || trail.some(value => value < 0 || value > 1) || !equalPosition(body.positionM, verticesM[0]!)) {
      throw new TypeError('Context orbit must align with its body and carry matching prepared trail weights.');
    }
    return Object.freeze({ ...body, orbit: Object.freeze({ centerBodyId, centerPositionM, verticesM: Object.freeze(verticesM), trail: Object.freeze(trail) }) });
  });
  if (bodies.length === 0) throw new TypeError('World context requires bodies.');
  unique([focus.id, ...bodies.map(body => body.id)], 'context body identities');
  const parents = new Map<string, PreparedContextBody>(bodies.map(body => [body.id, body]));
  for (const body of bodies) {
    if (!body.orbit) continue;
    const parent = body.orbit.centerBodyId === focus.id ? focus : parents.get(body.orbit.centerBodyId);
    if (!parent || parent.id === body.id || !equalPosition(parent.positionM, body.orbit.centerPositionM)) {
      throw new TypeError('Context orbit centre must match a prepared parent body.');
    }
    const ancestors = new Set([body.id]);
    for (let id: string | undefined = body.orbit.centerBodyId; id !== undefined && id !== focus.id; id = parents.get(id)?.orbit?.centerBodyId) {
      if (ancestors.has(id) || !parents.has(id)) throw new TypeError('Context orbit parent hierarchy must terminate at a prepared point.');
      ancestors.add(id);
    }
  }
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
export function mountPreparedWorldContext({ host, before, plan, sprites }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; sprites: Readonly<Record<string, SpriteWithUrl>>;
}) {
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-world-context';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
  root.dataset.worldContext = plan.focus.id;
  host.insertBefore(root, before);
  const points = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  const bodies = [plan.focus, ...plan.bodies].map(body => {
    const sprite = sprites[body.id];
    if (!sprite) { root.remove(); throw new TypeError(`Missing prepared navigation sprite ${body.id}.`); }
    const marker = host.ownerDocument.createElement('s');
    marker.dataset.contextBody = body.id;
    marker.style.cssText = 'position:absolute;left:50%;top:50%;background-repeat:no-repeat;text-decoration:none;transform-origin:center;visibility:hidden';
    applySprite(marker, sprite);
    const label = host.ownerDocument.createElement('span');
    label.dataset.contextLabel = body.id;
    label.textContent = body.name;
    label.style.cssText = 'position:absolute;left:50%;top:50%;font:11px system-ui;color:#c2ccd8;white-space:nowrap;visibility:hidden';
    const pieces: HTMLElement[] = [];
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    if (orbit) for (let i = 0; i < orbit.verticesM.length * 2; i++) {
      const piece = host.ownerDocument.createElement('s');
      piece.style.visibility = 'hidden';
      root.appendChild(piece); pieces.push(piece);
    }
    root.append(marker, label);
    const navigation = bindObjectNavigationTarget(marker, host);
    const labelNavigation = bindObjectNavigationTarget(label, host, { activation: 'dblclick' });
    return { body, sprite, marker, label, orbit, parent: orbit ? points.get(orbit.centerBodyId)! : null, pieces, navigation, labelNavigation, previousCount: 0 };
  });
  let destroyed = false;
  let selectedId = plan.focus.id;
  return Object.freeze({ root,
    inspect() {
      return Object.freeze(bodies.map(({ body, marker, label, pieces }) => Object.freeze({
        id: body.id, marker, label, orbit: Object.freeze([...pieces]),
      })));
    },
    selectObject(id: string) {
      if (!bodies.some(entry => entry.body.id === id)) throw new TypeError('Selected context body is unavailable.');
      selectedId = id;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
      if (destroyed) return;
      if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt) {
        throw new TypeError('Context and camera reference frames differ.');
      }
      const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
      const opacity = 1 - logarithmicFade(distanceM, plan.system.fadeOutStartDistanceM, plan.system.hiddenDistanceM);
      root.style.opacity = String(opacity);
      root.hidden = opacity === 0;
      if (opacity === 0) return;
      const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
      const toEye = (position: readonly number[]): PositionM => rotateWorldPosition(rotation, [
        position[0] - world.pose.positionM[0], position[1] - world.pose.positionM[1], position[2] - world.pose.positionM[2]]);
      const [ox, oy] = viewport.principalOffsetPixels;
      const focal = viewport.focalPixels, width = host.clientWidth, height = host.clientHeight;
      const project = (eye: readonly number[]): readonly number[] => [ox + focal * eye[0] / -eye[2], oy + focal * eye[1] / -eye[2]];
      const focusEye = toEye(plan.focus.positionM);
      const selected = bodies.find(entry => entry.body.id === selectedId)!.body;
      const selectedEye = toEye(selected.positionM);
      const hidden = (eye: readonly number[], id?: string) =>
        (id !== plan.focus.id && rayHitsSphereBefore(eye, focusEye, plan.focus.radiusM)) ||
        (id !== selected.id && rayHitsSphereBefore(eye, selectedEye, selected.radiusM));
      const near = Math.max(1, Math.min(...bodies.map(entry => Math.hypot(...toEye(entry.body.positionM)))) * 0.01);
      const focusDiameter = selectedEye[2] < -selected.radiusM
        ? 2 * focal * selected.radiusM / Math.sqrt(selectedEye[2] ** 2 - selected.radiusM ** 2) : Number.POSITIVE_INFINITY;
      const lod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, focusDiameter);
      const orbitOpacity = orbitLineOpacity(plan.camera.presentation.orbitLineFade, focusDiameter / height);
      for (const entry of bodies) {
        const { body, marker, label } = entry;
        const eye = toEye(body.positionM), depth = -eye[2];
        const parentEye = entry.parent ? toEye(entry.parent.positionM) : null;
        const parentHidden = (position: readonly number[]) => parentEye !== null && rayHitsSphereBefore(position, parentEye, entry.parent!.radiusM);
        const [x, y] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isSelected = body.id === selectedId;
        const visible = depth > body.radiusM && Math.abs(x) < width / 2 && Math.abs(y) < height / 2 && !hidden(eye, body.id) && !parentHidden(eye);
        const markerOpacity = isSelected ? lod.billboardOpacity : 1;
        const pointSource = body.id === plan.focus.id && plan.focus.pointSource !== undefined;
        marker.style.visibility = visible && markerOpacity > 0 && !pointSource ? '' : 'hidden';
        entry.navigation.update(visible && markerOpacity > 0.1 && !pointSource ? body.id : null, body.name);
        label.style.visibility = visible && markerOpacity > 0.5 ? '' : 'hidden';
        entry.labelNavigation.update(visible && markerOpacity > 0.5 ? body.id : null, body.name);
        if (visible) {
          marker.style.opacity = String(markerOpacity);
          marker.style.transform = `translate(${x}px,${y}px) scale(${Math.max(2.4, diameter) / entry.sprite.size})`;
          label.style.transform = `translate(${x + Math.max(5, diameter / 2) + 4}px,${y - 7}px)`;
          label.style.opacity = String(markerOpacity);
        }
        if (entry.orbit) {
          const ring = createPreparedRingProjector({ toEye, project, hidden: eye => hidden(eye) || parentHidden(eye),
            near, clipX: width / 2, clipY: height / 2 });
          const segments = ring(entry.orbit.verticesM, entry.orbit.trail.map(weight => weight * orbitOpacity));
          const update = writePieces(entry.pieces, segments, entry.previousCount);
          if (update.overflowed) throw new Error('Prepared context line pool overflowed.');
          entry.previousCount = update.count;
        }
      }
    },
    destroy() { if (!destroyed) { destroyed = true; for (const entry of bodies) { entry.navigation.destroy(); entry.labelNavigation.destroy(); } root.remove(); } },
  });
}
