import { presentPhysicalPoseInVolume, selectVisiblePreparedStars } from '@cssearth/engine';
import type { PreparedPointFieldInput, PointReference, PreparedPointFieldSelection } from '@cssearth/engine';
import { transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssPointField, PointFieldVector as Vector3 } from './types.js';
import { mountPointFieldLabels } from './point-field-labels.js';
import type { StarLabelCandidate } from './point-field-labels.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createOpacityFader } from './opacity-fader.js';

type Slot = { element: HTMLElement; reference: PointReference | null; entering: boolean };
type Publication = { world: WorldCameraPose; viewport: WorldCameraViewport };
type Matrix3 = PreparedPointFieldInput['viewRotation'];
const key = (reference: PointReference) => `${reference.kind}:${reference.index}`;

/** Projects prepared points/proxies only. The fixed pools never manufacture catalogue data or imagery. */
export function mountPreparedCssPointField({ host, before, payload, resolveResource, occluder }: {
  host: HTMLElement; before: Element; payload: PreparedCssPointField; resolveResource(path: string): string;
  occluder?: { positionM: Vector3; radiusM: number };
}) {
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-point-field';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;visibility:hidden';
  root.ariaHidden = 'true';
  root.dataset.catalogueCount = String(payload.stars.length);
  const starLayer = host.ownerDocument.createElement('div');
  starLayer.className = 'prepared-point-field-stars';
  starLayer.style.cssText = 'position:absolute;inset:0';
  root.appendChild(starLayer);
  const atlasUrl = resolveResource(payload.atlas.path);
  const makeSlots = (count: number): Slot[] => Array.from({ length: count }, () => {
    const element = host.ownerDocument.createElement('s');
    element.dataset.starSlot = '';
    element.style.cssText = `position:absolute;left:50%;top:50%;width:${payload.atlas.tileSize}px;height:${payload.atlas.tileSize}px;background-repeat:no-repeat;text-decoration:none;transform-origin:0 0;visibility:hidden`;
    element.style.backgroundImage = `url(${JSON.stringify(atlasUrl)})`;
    starLayer.appendChild(element);
    return { element, reference: null, entering: false };
  });
  const outgoing = makeSlots(payload.policy.transitionSlots);
  const active = makeSlots(payload.policy.activeSlots);
  const fader = createOpacityFader(host.ownerDocument.defaultView!);
  const labels = mountPointFieldLabels(root, payload.labels);
  const coverageAnchorIndices = payload.stars.flatMap((star, index) => star.coverageAnchor ? [index] : []);
  let occluderLocal = occluder && presentPhysicalPoseInVolume({ positionM: occluder.positionM,
    orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
  host.insertBefore(root, before);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: Publication | null = null;
  let destroyed = false, initialized = false;

  function select(publication: Publication): PreparedPointFieldSelection {
    const { local, rotation } = camera(publication, payload);
    const [ox, oy] = publication.viewport.principalOffsetPixels;
    return selectVisiblePreparedStars({ stars: payload.stars, nodes: payload.nodes,
      eyeUnits: local.positionUnits, viewRotation: rotation, focalPx: publication.viewport.focalPixels,
      viewportHalfWidthPx: host.clientWidth / 2 + Math.abs(ox),
      viewportHalfHeightPx: host.clientHeight / 2 + Math.abs(oy),
      maxRepresentatives: payload.policy.activeSlots, targetErrorPx: payload.policy.maxErrorPx,
      limitingMagnitude: payload.photometry.limitingMagnitude,
      distanceScalePc: payload.frame.metersPerUnit / 3.085677581491367e16, coverageAnchorIndices });
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
    root.dataset.coveredCount = String(selection.coveredCount);
    root.dataset.consideredCount = String(selection.consideredCount);
    root.dataset.drawnCount = String(selection.drawnCount);
    root.dataset.representatives = String(selection.representatives.length);
    root.dataset.maxProjectedErrorPx = String(selection.maxProjectedErrorPx);
    root.dataset.budgetLimited = String(selection.budgetLimited);
    if (initialized && (removed > 0 || added > 0)) {
      // Surviving identities stay opaque. Only replaced hierarchy members fade.
      timer = setTimeout(finishTransition, payload.policy.transitionMs);
    }
    initialized = true;
  }

  function finishTransition() {
    timer = null;
    for (const slot of outgoing) { slot.reference = null; slot.element.style.visibility = 'hidden'; fader.cancel(slot.element); }
    for (const slot of active) slot.entering = false;
    if (latest && !destroyed) { assign(select(latest)); render(latest); }
  }

  function render(publication: Publication) {
    const { local, rotation } = camera(publication, payload);
    const { focalPixels: focal, principalOffsetPixels: [ox, oy] } = publication.viewport;
    const halfWidth = host.clientWidth / 2, halfHeight = host.clientHeight / 2;
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
      if (!reference) { element.style.visibility = 'hidden'; return; }
      const point = reference.kind === 'star' ? payload.stars[reference.index] : payload.nodes[reference.index];
      const projection = projectPreparedPoint(point.positionUnits, local.positionUnits, rotation, focal, ox, oy);
      const light = pointPhotometry(payload, point.absoluteMagnitude, projection.distanceUnits,
        reference.kind === 'star' && payload.stars[reference.index].coverageAnchor);
      const size = light.radiusPx * 2 * payload.atlas.haloRadii;
      const shown = projection.depth > 0 && light.luminance > 0 && !occluded(point.positionUnits) && Math.abs(projection.x) < halfWidth + size && Math.abs(projection.y) < halfHeight + size;
      element.style.visibility = shown ? '' : 'hidden';
      if (!shown) return;
      if (!departing) { visible++; if (reference.kind === 'star') individual++; }
      if (!departing && reference.kind === 'star') { const candidate = label(reference.index); if (candidate) candidates.push(candidate); }
      element.dataset.starReference = key(reference);
      element.style.backgroundPosition = `${-(point.colorIndex % payload.atlas.columns) * payload.atlas.tileSize}px ${-Math.floor(point.colorIndex / payload.atlas.columns) * payload.atlas.tileSize}px`;
      element.style.transform = `translate(${projection.x - size / 2}px,${projection.y - size / 2}px) scale(${size / payload.atlas.tileSize})`;
      fader.set(element, departing ? 0 : light.luminance,
        slot.entering || departing ? payload.policy.transitionMs : 0, true);
    };
    for (const slot of outgoing) write(slot, true);
    for (const slot of active) write(slot, false);
    root.dataset.visiblePoints = String(visible); root.dataset.individualPoints = String(individual);
    labels.publish(candidates, label);
  }

  return Object.freeze({ root,
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
      if (timer === null) assign(select(latest));
      render(latest);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      if (timer !== null) clearTimeout(timer);
      fader.destroy();
      labels.destroy();
      root.remove();
    },
  });
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
