import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { PreparedPointFieldInput, PointReference, PreparedPointFieldSelection } from '@cssearth/engine';
import { transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssPointField, PointFieldVector as Vector3 } from './types.js';
import { mountPointFieldLabels } from './point-field-labels.js';
import type { StarLabelCandidate } from './point-field-labels.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createOpacityFader } from './opacity-fader.js';
import { createPointFieldSelection } from './point-field-selection.js';
import { createPointFieldSelectionClient } from './point-field-selection-client.js';
import type { PointFieldView } from './point-field-selection.js';

type Slot = { element: HTMLElement; reference: PointReference | null; entering: boolean;
  identity: string | null; shown: boolean; x: number; y: number; size: number };
type Publication = { world: WorldCameraPose; viewport: WorldCameraViewport };
type Matrix3 = PreparedPointFieldInput['viewRotation'];
const key = (reference: PointReference) => `${reference.kind}:${reference.index}`;

/** Projects prepared points/proxies only. The fixed pools never manufacture catalogue data or imagery. */
export function mountPreparedCssPointField({ host, before, payload, resolveResource, occluder, showLabels = true }: {
  host: HTMLElement; before: Element; payload: PreparedCssPointField; resolveResource(path: string): string;
  occluder?: { positionM: Vector3; radiusM: number };
  showLabels?: boolean;
}) {
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-point-field';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;visibility:hidden';
  root.ariaHidden = 'true';
  const starLayer = host.ownerDocument.createElement('div');
  starLayer.className = 'prepared-point-field-stars';
  starLayer.style.cssText = 'position:absolute;inset:0';
  root.appendChild(starLayer);
  const atlasUrl = resolveResource(payload.atlas.path);
  starLayer.style.setProperty('--point-atlas', `url(${JSON.stringify(atlasUrl)})`);
  starLayer.style.setProperty('--point-tile-size', `${payload.atlas.tileSize}px`);
  const makeSlots = (count: number): Slot[] => Array.from({ length: count }, () => {
    const element = host.ownerDocument.createElement('s');
    element.style.visibility = 'hidden';
    starLayer.appendChild(element);
    return { element, reference: null, entering: false, identity: null, shown: false, x: NaN, y: NaN, size: NaN };
  });
  const outgoing = makeSlots(payload.policy.transitionSlots);
  const active = makeSlots(payload.policy.activeSlots);
  const fader = createOpacityFader(host.ownerDocument.defaultView!);
  const labels = showLabels ? mountPointFieldLabels(root, payload.labels) : null;
  const selectInitial = createPointFieldSelection(payload);
  let occluderLocal = occluder && presentPhysicalPoseInVolume({ positionM: occluder.positionM,
    orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
  host.insertBefore(root, before);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: Publication | null = null;
  let destroyed = false, initialized = false;
  let selected: PreparedPointFieldSelection | null = null;
  let visiblePoints = 0, individualPoints = 0;

  let pendingSelection: PreparedPointFieldSelection | null = null;
  let adoptionFrame: number | null = null;
  const windowTarget = host.ownerDocument.defaultView!;
  const selector = typeof Worker === 'undefined' ? null : createPointFieldSelectionClient(payload, selection => {
    pendingSelection = selection;
    // A regular camera publication consumes this first. If the camera has stopped,
    // publish the completed cut on the next frame using the latest observer pose.
    if (adoptionFrame === null && timer === null) adoptionFrame = windowTarget.requestAnimationFrame(() => {
      adoptionFrame = null;
      if (!destroyed && latest) { updateSelection(latest); render(latest); }
    });
  }, error => { throw error; });

  function selectionView(publication: Publication): PointFieldView {
    const { local, rotation } = camera(publication, payload);
    const [ox, oy] = publication.viewport.principalOffsetPixels;
    return { eyeUnits: local.positionUnits, viewRotation: rotation, focalPx: publication.viewport.focalPixels,
      viewportHalfWidthPx: (publication.viewport.widthPixels ?? host.clientWidth) / 2 + Math.abs(ox),
      viewportHalfHeightPx: (publication.viewport.heightPixels ?? host.clientHeight) / 2 + Math.abs(oy) };
  }

  function updateSelection(publication: Publication) {
    if (adoptionFrame !== null) { windowTarget.cancelAnimationFrame(adoptionFrame); adoptionFrame = null; }
    const view = selectionView(publication);
    // Seed the first view synchronously: the ready scene never flashes an empty sky.
    // All subsequent browser selection belongs to the application-lifetime worker.
    if (!initialized || !selector) assign(selectInitial(view));
    else if (pendingSelection) { const next = pendingSelection; pendingSelection = null; assign(next); }
    if (timer === null) selector?.request(view);
  }

  function assign(selection: PreparedPointFieldSelection) {
    const next = new Map(selection.representatives.map(reference => [key(reference), reference]));
    const survivors = new Set<string>();
    let removed = 0;
    for (const slot of active) {
      if (!slot.reference) continue;
      if (next.has(key(slot.reference))) { survivors.add(key(slot.reference)); continue; }
      const departure = outgoing[removed++];
      departure.reference = slot.reference;
      fader.set(departure.element, Number(slot.element.style.opacity), 0);
      fader.cancel(slot.element);
      slot.reference = null;
    }
    const free = active.filter(slot => slot.reference === null);
    let added = 0;
    for (const reference of selection.representatives) {
      if (survivors.has(key(reference))) continue;
      const slot = free[added++]; slot.reference = reference; slot.entering = initialized;
      if (initialized) fader.set(slot.element, 0, 0);
    }
    selected = selection;
    if (initialized && (removed > 0 || added > 0)) {
      // Surviving identities stay opaque. Only replaced hierarchy members fade.
      timer = setTimeout(finishTransition, payload.policy.transitionMs);
    }
    initialized = true;
  }

  function finishTransition() {
    timer = null;
    for (const slot of outgoing) {
      slot.reference = null;
      setShown(slot, false);
      fader.cancel(slot.element);
    }
    for (const slot of active) slot.entering = false;
    if (latest && !destroyed) { updateSelection(latest); render(latest); }
  }

  function render(publication: Publication) {
    const { local, rotation } = camera(publication, payload);
    const { focalPixels: focal, principalOffsetPixels: [ox, oy] } = publication.viewport;
    const halfWidth = (publication.viewport.widthPixels ?? host.clientWidth) / 2;
    const halfHeight = (publication.viewport.heightPixels ?? host.clientHeight) / 2;
    let visible = 0, individual = 0;
    const candidates: StarLabelCandidate[] = [];
    const occluded = (position: Vector3) => occluderLocal && rayHitsSphereBefore(
      position.map((value, axis) => value - local.positionUnits[axis]) as unknown as Vector3,
      occluderLocal.map((value, axis) => value - local.positionUnits[axis]) as unknown as Vector3,
      occluder!.radiusM / payload.frame.metersPerUnit);
    const label = (index: number): StarLabelCandidate | null => {
      const star = payload.stars[index];
      if (!star.name || occluded(star.positionUnits)) return null;
      const p = projectPreparedPoint(star.positionUnits, local.positionUnits, rotation, focal, ox, oy);
      const light = pointPhotometry(payload, star.absoluteMagnitude, p.distanceUnits, star.coverageAnchor);
      if (p.depth <= 0 || Math.abs(p.x) >= halfWidth - 30 || Math.abs(p.y) >= halfHeight - 30 ||
          light.magnitude > payload.photometry.hintsLimitMagnitude) return null;
      return { index, name: star.name, x: p.x, y: p.y, ...light };
    };
    const write = (slot: Slot, departing: boolean) => {
      const reference = slot.reference, element = slot.element;
      if (!reference) { setShown(slot, false); return; }
      const point = reference.kind === 'star' ? payload.stars[reference.index] : payload.nodes[reference.index];
      const projection = projectPreparedPoint(point.positionUnits, local.positionUnits, rotation, focal, ox, oy);
      const light = pointPhotometry(payload, point.absoluteMagnitude, projection.distanceUnits,
        reference.kind === 'star' && payload.stars[reference.index].coverageAnchor);
      const size = light.radiusPx * 2 * payload.atlas.haloRadii;
      const shown = projection.depth > 0 && light.luminance > 0 && !occluded(point.positionUnits) && Math.abs(projection.x) < halfWidth + size && Math.abs(projection.y) < halfHeight + size;
      setShown(slot, shown);
      if (!shown) return;
      if (!departing) { visible++; if (reference.kind === 'star') individual++; }
      if (labels && !departing && reference.kind === 'star') { const candidate = label(reference.index); if (candidate) candidates.push(candidate); }
      const identity = key(reference);
      if (slot.identity !== identity) {
        slot.identity = identity;
        element.style.backgroundPosition = `${-(point.colorIndex % payload.atlas.columns) * payload.atlas.tileSize}px ${-Math.floor(point.colorIndex / payload.atlas.columns) * payload.atlas.tileSize}px`;
      }
      // Bound publication rounding to 0.0005 CSS px per coordinate/size and
      // 0.0000005 opacity. Keep the physical camera math exact and compare
      // numeric state before serializing CSS, rather than rewriting floating
      // point noise for every star as the physical observer travels.
      const x = Math.round((projection.x - size / 2) * 1000) / 1000;
      const y = Math.round((projection.y - size / 2) * 1000) / 1000;
      const drawnSize = Math.round(size * 1000) / 1000;
      if (slot.x !== x || slot.y !== y || slot.size !== drawnSize) {
        slot.x = x; slot.y = y; slot.size = drawnSize;
        element.style.transform = `translate(${x}px,${y}px) scale(${drawnSize / payload.atlas.tileSize})`;
      }
      fader.set(element, departing ? 0 : Math.round(light.luminance * 1e6) / 1e6,
        slot.entering || departing ? payload.policy.transitionMs : 0, true);
    };
    for (const slot of outgoing) write(slot, true);
    for (const slot of active) write(slot, false);
    visiblePoints = visible; individualPoints = individual;
    labels?.publish(candidates, label);
  }

  return Object.freeze({ root,
    // Allocate diagnostics only when requested; render leaves stay anonymous.
    inspect() {
      return Object.freeze({ catalogueCount: payload.stars.length,
        coveredCount: selected?.coveredCount ?? 0, consideredCount: selected?.consideredCount ?? 0,
        drawnCount: selected?.drawnCount ?? 0, representatives: selected?.representatives.length ?? 0,
        maxProjectedErrorPx: selected?.maxProjectedErrorPx ?? 0, budgetLimited: selected?.budgetLimited ?? false,
        visiblePoints, individualPoints,
        points: Object.freeze([...outgoing, ...active].map(slot => Object.freeze({ element: slot.element,
          reference: slot.reference === null ? null : key(slot.reference) }))),
      });
    },
    setOccluder(body: { positionM: Vector3; radiusM: number }) {
      occluder = body;
      occluderLocal = presentPhysicalPoseInVolume({ positionM: body.positionM,
        orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number) {
      if (destroyed) return;
      root.style.opacity = String(opacity); root.style.visibility = opacity > 0 ? '' : 'hidden';
      if (opacity <= 0) { latest = null; return; }
      latest = { world, viewport };
      if (timer === null) updateSelection(latest);
      render(latest);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      if (timer !== null) clearTimeout(timer);
      selector?.destroy();
      if (adoptionFrame !== null) windowTarget.cancelAnimationFrame(adoptionFrame);
      pendingSelection = null;
      fader.destroy();
      labels?.destroy();
      root.remove();
    },
  });
}

function setShown(slot: Slot, shown: boolean) {
  if (slot.shown === shown) return;
  slot.shown = shown;
  slot.element.style.visibility = shown ? '' : 'hidden';
}

function camera(publication: Publication, payload: PreparedCssPointField) {
  if (publication.world.referenceFrame !== payload.frame.referenceFrame || publication.world.epochJdTt !== payload.frame.epochJdTt) {
    throw new TypeError('Prepared stars and camera must share a reference frame and epoch.');
  }
  const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw)) as Matrix3;
  return { local, rotation };
}

export function projectPreparedPoint(position: Vector3, eye: Vector3, rotation: Matrix3, focal: number, ox = 0, oy = 0) {
  const x = position[0] - eye[0], y = position[1] - eye[1], z = position[2] - eye[2];
  const depth = -(rotation[6] * x + rotation[7] * y + rotation[8] * z);
  return { x: ox + focal * (rotation[0] * x + rotation[1] * y + rotation[2] * z) / depth,
    y: oy + focal * (rotation[3] * x + rotation[4] * y + rotation[5] * z) / depth,
    depth, distanceUnits: Math.hypot(x, y, z) };
}

/** Apparent magnitude selects/interpolates prepared exposure samples, not source imagery. */
export function pointPhotometry(payload: PreparedCssPointField, absoluteMagnitude: number, distanceUnits: number, coverageAnchor = false) {
  const distancePc = distanceUnits * payload.frame.metersPerUnit / 3.085677581491367e16;
  const magnitude = absoluteMagnitude + 5 * Math.log10(Math.max(distancePc, Number.MIN_VALUE)) - 5;
  const table = payload.photometry;
  const coordinate = Math.max(0, Math.min(table.samples.length - 1, (magnitude - table.minimumMagnitude) / table.step));
  const index = Math.floor(coordinate), t = coordinate - index;
  const a = table.samples[index], b = table.samples[Math.min(index + 1, table.samples.length - 1)];
  return { magnitude, radiusPx: Math.max(coverageAnchor ? table.minimumRadiusPx : 0, a.radiusPx + (b.radiusPx - a.radiusPx) * t),
    luminance: Math.max(coverageAnchor ? table.floor : 0, a.luminance + (b.luminance - a.luminance) * t) };
}
