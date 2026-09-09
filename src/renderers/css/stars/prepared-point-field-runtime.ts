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
import { createPointSample, samplePreparedPoint } from './point-field-projection.js';
import { createRetainedLeafPool } from '../rendering/retained-leaf-pool.js';
export { pointPhotometry, projectPreparedPoint } from './point-field-projection.js';
import { createPointFieldSelectionClient, samePointFieldView } from './point-field-selection-client.js';
import type { PointFieldView } from './point-field-selection.js';

type Slot = { sample: ReturnType<typeof createPointSample>; element: HTMLElement; setVisible(shown: boolean): void; reference: PointReference | null; entering: boolean;
  identity: string | null; shown: boolean; x: number; y: number; size: number };
type Publication = { world: WorldCameraPose; viewport: WorldCameraViewport; labelExclusionRects: readonly LabelScreenRect[] };
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
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
  const makeSlots = (count: number): Slot[] => {
    const pool = createRetainedLeafPool(starLayer, count, 'prepared-point-field-block');
    return pool.elements.map((element, index) => ({ element, setVisible: shown => pool.setVisible(index, shown),
      sample: createPointSample(), reference: null, entering: false, identity: null, shown: false, x: NaN, y: NaN, size: NaN }));
  };
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
  let pointRevision = 0, renderedRevision = -1, renderPasses = 0, projectedPoints = 0;
  let renderedView: PointFieldView | null = null;
  let renderedOffset: readonly number[] = [];
  let candidates: StarLabelCandidate[] = [];
  const labelSample = createPointSample();

  let pendingSelection: PreparedPointFieldSelection | null = null;
  let selectionViewCompleted: PointFieldView | null = null;
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
    if (!initialized || (!selector && (!selectionViewCompleted || !samePointFieldView(selectionViewCompleted, view)))) {
      assign(selectInitial(view)); selectionViewCompleted = view;
    }
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
    // Worker diagnostics may change without changing any retained identity.
    // Only membership changes invalidate the already projected point image.
    if (!initialized || removed > 0 || added > 0) pointRevision++;
    selected = selection;
    if (initialized && (removed > 0 || added > 0)) {
      // Surviving identities stay opaque. Only replaced hierarchy members fade.
      timer = setTimeout(finishTransition, payload.policy.transitionMs);
    }
    initialized = true;
  }

  function finishTransition() {
    timer = null;
    pointRevision++;
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
    const view = { eyeUnits: local.positionUnits, viewRotation: rotation, focalPx: focal,
      viewportHalfWidthPx: halfWidth, viewportHalfHeightPx: halfHeight };
    const occluderRelative = occluderLocal && [occluderLocal[0] - local.positionUnits[0],
      occluderLocal[1] - local.positionUnits[1], occluderLocal[2] - local.positionUnits[2]] as Vector3;
    const occluderRadius = (occluder?.radiusM ?? 0) / payload.frame.metersPerUnit;
    const occluded = (sample: ReturnType<typeof createPointSample>) => occluderRelative &&
      rayHitsSphereBefore(sample.relative, occluderRelative, occluderRadius);
    const label = (index: number, existing?: ReturnType<typeof createPointSample>): StarLabelCandidate | null => {
      const star = payload.stars[index];
      if (!star.name) return null;
      const p = existing ?? samplePreparedPoint(labelSample, star, payload, local.positionUnits, rotation, focal, ox, oy);
      if (occluded(p) || p.depth <= 0 || Math.abs(p.x) >= halfWidth - 30 || Math.abs(p.y) >= halfHeight - 30 ||
          p.light.magnitude > payload.photometry.hintsLimitMagnitude) return null;
      return { index, name: star.name, x: p.x, y: p.y, ...p.light };
    };
    if (renderedRevision === pointRevision && renderedView && samePointFieldView(renderedView, view) &&
        renderedOffset[0] === ox && renderedOffset[1] === oy) {
      // Foreground label exclusions can change with the same camera.
      labels?.publish(candidates, label, publication.labelExclusionRects);
      return;
    }
    renderedView = view; renderedOffset = [ox, oy]; renderedRevision = pointRevision;
    renderPasses++; candidates = [];
    const write = (slot: Slot, departing: boolean) => {
      const reference = slot.reference, element = slot.element;
      if (!reference) { setShown(slot, false); return; }
      const point = reference.kind === 'star' ? payload.stars[reference.index] : payload.nodes[reference.index];
      const projection = samplePreparedPoint(slot.sample, point, payload, local.positionUnits, rotation, focal, ox, oy);
      const { light, size } = projection;
      projectedPoints++;
      const shown = projection.depth > 0 && light.luminance > 0 && !occluded(projection) && Math.abs(projection.x) < halfWidth + size && Math.abs(projection.y) < halfHeight + size;
      setShown(slot, shown);
      if (!shown) return;
      if (!departing) { visible++; if (reference.kind === 'star') individual++; }
      if (labels && !departing && reference.kind === 'star') { const candidate = label(reference.index, projection); if (candidate) candidates.push(candidate); }
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
    labels?.publish(candidates, label, publication.labelExclusionRects);
  }

  return Object.freeze({ root,
    // Allocate diagnostics only when requested; render leaves stay anonymous.
    inspect() {
      return Object.freeze({ catalogueCount: payload.stars.length,
        coveredCount: selected?.coveredCount ?? 0, consideredCount: selected?.consideredCount ?? 0,
        drawnCount: selected?.drawnCount ?? 0, representatives: selected?.representatives.length ?? 0,
        maxProjectedErrorPx: selected?.maxProjectedErrorPx ?? 0, budgetLimited: selected?.budgetLimited ?? false,
        visiblePoints, individualPoints, renderPasses, projectedPoints,
        points: Object.freeze([...outgoing, ...active].map(slot => Object.freeze({ element: slot.element,
          reference: slot.reference === null ? null : key(slot.reference) }))),
      });
    },
    setOccluder(body: { positionM: Vector3; radiusM: number }) {
      if (occluder && occluder.radiusM === body.radiusM && occluder.positionM.every((value, axis) => value === body.positionM[axis])) return;
      pointRevision++;
      occluder = body;
      occluderLocal = presentPhysicalPoseInVolume({ positionM: body.positionM,
        orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number,
      labelExclusionRects: readonly LabelScreenRect[] = []) {
      if (destroyed) return;
      root.style.opacity = String(opacity); root.style.visibility = opacity > 0 ? '' : 'hidden';
      if (opacity <= 0) { latest = null; return; }
      latest = { world, viewport, labelExclusionRects };
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
  slot.setVisible(shown);
}

function camera(publication: Publication, payload: PreparedCssPointField) {
  if (publication.world.referenceFrame !== payload.frame.referenceFrame || publication.world.epochJdTt !== payload.frame.epochJdTt) {
    throw new TypeError('Prepared stars and camera must share a reference frame and epoch.');
  }
  const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw)) as Matrix3;
  return { local, rotation };
}
