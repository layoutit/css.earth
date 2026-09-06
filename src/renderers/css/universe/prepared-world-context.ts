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
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';

export interface PreparedContextPoint {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly positionM: PositionM;
  readonly radiusM: number;
}
export interface PreparedContextBody extends PreparedContextPoint {
  readonly orbit: { readonly verticesM: readonly PositionM[]; readonly trail: readonly number[] };
}
export interface PreparedContextCameraPresentation {
  readonly projection: { readonly model: 'css-perspective-shared-with-sky'; readonly cssPerspective: string };
  readonly dolly: { readonly model: 'multiplicative-wheel-distance'; readonly wheelStepPerDelta: number; readonly minimumDistanceRadii: number; readonly maximumDistanceOverOrbitExtent: number };
  readonly levelOfDetail: LevelOfDetailPlan;
  readonly orbitLineFade: OrbitLineFade;
  readonly drag: { readonly model: 'screen-axis-tumble' };
}
export interface PreparedWorldContext {
  readonly schema: 'cssearth-world-context@1';
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: PreparedContextPoint;
  readonly bodies: readonly PreparedContextBody[];
  readonly camera: { readonly minimumDistanceM: number; readonly maximumDistanceM: number; readonly framingReferenceZoom: number;
    readonly presentation: PreparedContextCameraPresentation };
  readonly volume: { readonly objectId: string; readonly fadeStartDistanceM: number; readonly fullDistanceM: number };
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
  const focus = point(input.focus);
  if (!equalPosition(focus.positionM, frame.originM)) throw new TypeError('World context focus must be at its frame origin.');
  const bodies = array(input.bodies, 'context bodies').map(value => {
    const input = record(value, 'context body', ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit']);
    const body = point(input, ['id', 'name', 'color', 'positionM', 'radiusM', 'orbit']), orbit = record(input.orbit, 'body orbit', ['verticesM', 'trail']);
    const verticesM = array(orbit.verticesM, 'orbit vertices').map(value => vector(value, 'orbit vertex'));
    const trail = numbers(orbit.trail, 'orbit trail');
    if (verticesM.length < 8 || trail.length !== verticesM.length || trail.some(value => value < 0 || value > 1) || !equalPosition(body.positionM, verticesM[0]!)) {
      throw new TypeError('Context orbit must align with its body and carry matching prepared trail weights.');
    }
    return Object.freeze({ ...body, orbit: Object.freeze({ verticesM: Object.freeze(verticesM), trail: Object.freeze(trail) }) });
  });
  if (bodies.length === 0) throw new TypeError('World context requires bodies.');
  unique([focus.id, ...bodies.map(body => body.id)], 'context body identities');
  const camera = record(input.camera, 'context camera', ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation']);
  const volume = record(input.volume, 'context volume', ['objectId', 'fadeStartDistanceM', 'fullDistanceM']);
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
    volume: Object.freeze({ objectId, fadeStartDistanceM, fullDistanceM }),
    stars: Object.freeze({ objectId: starId, fadeStartDistanceM: starStart, fullDistanceM: starFull }),
    system: Object.freeze({ fadeOutStartDistanceM, hiddenDistanceM }), sky });
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
  const bodies = [plan.focus, ...plan.bodies].map(body => {
    const sprite = sprites[body.id];
    if (!sprite) { root.remove(); throw new TypeError(`Missing prepared navigation sprite ${body.id}.`); }
    const marker = host.ownerDocument.createElement('s');
    marker.dataset.contextBody = body.id;
    marker.style.cssText = 'position:absolute;left:50%;top:50%;background-repeat:no-repeat;text-decoration:none;transform-origin:center;visibility:hidden';
    applySprite(marker, sprite);
    const label = host.ownerDocument.createElement('span');
    label.textContent = body.name;
    label.style.cssText = 'position:absolute;left:50%;top:50%;font:11px system-ui;color:#c2ccd8;white-space:nowrap;visibility:hidden';
    const pieces: HTMLElement[] = [];
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    if (orbit) for (let i = 0; i < orbit.verticesM.length * 2; i++) {
      const piece = host.ownerDocument.createElement('s');
      piece.dataset.contextOrbit = body.id;
      piece.style.cssText = 'position:absolute;left:50%;top:50%;width:1px;height:1px;background:#768394;transform-origin:0 0;visibility:hidden';
      root.appendChild(piece); pieces.push(piece);
    }
    root.append(marker, label);
    return { body, sprite, marker, label, orbit, pieces, previousCount: 0 };
  });
  let destroyed = false;
  return Object.freeze({ root,
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
      const hidden = (eye: readonly number[]) => rayHitsSphereBefore(eye, focusEye, plan.focus.radiusM);
      const ring = createPreparedRingProjector({ toEye, project, hidden,
        near: Math.max(1, distanceM * 0.01), clipX: width / 2, clipY: height / 2 });
      const focusDiameter = focusEye[2] < -plan.focus.radiusM
        ? 2 * focal * plan.focus.radiusM / Math.sqrt(focusEye[2] ** 2 - plan.focus.radiusM ** 2) : Number.POSITIVE_INFINITY;
      const lod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, focusDiameter);
      const orbitOpacity = orbitLineOpacity(plan.camera.presentation.orbitLineFade, focusDiameter / height);
      for (const entry of bodies) {
        const { body, marker, label } = entry;
        const eye = toEye(body.positionM), depth = -eye[2];
        const [x, y] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isFocus = body.id === plan.focus.id;
        const visible = depth > body.radiusM && Math.abs(x) < width / 2 && Math.abs(y) < height / 2 && (isFocus || !hidden(eye));
        const markerOpacity = isFocus ? lod.markerOpacity : 1;
        marker.style.visibility = visible && markerOpacity > 0 ? '' : 'hidden';
        label.style.visibility = visible && markerOpacity > 0.5 ? '' : 'hidden';
        if (visible) {
          marker.style.opacity = String(markerOpacity);
          marker.style.transform = `translate(${x}px,${y}px) scale(${Math.max(2.4, diameter) / entry.sprite.size})`;
          label.style.transform = `translate(${x + Math.max(5, diameter / 2) + 4}px,${y - 7}px)`;
          label.style.opacity = String(markerOpacity);
        }
        if (entry.orbit) {
          const segments = ring(entry.orbit.verticesM, entry.orbit.trail.map(weight => weight * orbitOpacity));
          const update = writePieces(entry.pieces, segments, entry.previousCount);
          if (update.overflowed) throw new Error('Prepared context line pool overflowed.');
          entry.previousCount = update.count;
        }
      }
    },
    destroy() { if (!destroyed) { destroyed = true; root.remove(); } },
  });
}
