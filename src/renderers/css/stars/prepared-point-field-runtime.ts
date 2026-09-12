import type { OpacityClock } from './opacity-clock.js';
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
import { createPointSample, pointLuminanceVisible, samplePreparedPoint } from './point-field-projection.js';
import { createRetainedLeafPool } from '../rendering/retained-leaf-pool.js';
export { pointPhotometry, projectPreparedPoint } from './point-field-projection.js';
import { createPointFieldSelectionClient, samePointFieldView } from './point-field-selection-client.js';
import type { PointFieldView } from './point-field-selection.js';
import { createPointFrameReceiver, pointId } from './point-field-frame.js';
import type { PreparedPointFrame, PointFrameState } from './point-field-frame.js';

type Slot = { sample: ReturnType<typeof createPointSample>; element: HTMLElement; setVisible(shown: boolean): void; reference: PointReference | null; entering: boolean;
  identity: string | null; shown: boolean; transform: string; x: number; y: number; size: number };
type Publication = { world: WorldCameraPose; viewport: WorldCameraViewport; labelExclusionRects: readonly LabelScreenRect[] };
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
type Matrix3 = PreparedPointFieldInput['viewRotation'];
const key = (reference: PointReference) => `${reference.kind}:${reference.index}`;
// About half a second of frames: stars crossing a block boundary keep its leaf boxes.
const RETAIN_EMPTY_BLOCK_COMMITS = 30;

/** Projects prepared points/proxies only. The fixed pools never manufacture catalogue data or imagery. */
export function mountPreparedCssPointField({ host, before, payload, resolveResource, occluder, showLabels = true,
  framePlanned = false, requestPublication, opacityClock }: {
  host: HTMLElement; before: Element; payload: PreparedCssPointField; resolveResource(path: string): string;
  occluder?: { positionM: Vector3; radiusM: number };
  showLabels?: boolean;
  framePlanned?: boolean;
  requestPublication?: () => boolean;
  opacityClock?: OpacityClock;
}) {
  if (framePlanned && showLabels) throw new TypeError('World-planned points use the shared world labels.');
  const root = host.ownerDocument.createElement('div');
  root.className = 'prepared-point-field';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;visibility:hidden';
  root.ariaHidden = 'true';
  const starLayer = host.ownerDocument.createElement('div');
  starLayer.className = 'prepared-point-field-stars';
  starLayer.style.cssText = 'position:absolute;inset:0';
  root.appendChild(starLayer);
  const atlasUrl = resolveResource(payload.atlas.path);
  const tileSize = `${payload.atlas.tileSize}px`;
  const atlasImage = `url(${JSON.stringify(atlasUrl)})`;
  const pools: ReturnType<typeof createRetainedLeafPool>[] = [];
  const makeSlots = (count: number): Slot[] => {
    const pool = createRetainedLeafPool(starLayer, count, 'prepared-point-field-block', { retainCommits: RETAIN_EMPTY_BLOCK_COMMITS });
    for (const element of pool.elements) {
      // The atlas is immutable after mount. Publish it on each retained leaf
      // once instead of making every star resolve a shared custom property.
      element.style.width = tileSize;
      element.style.height = tileSize;
      element.style.backgroundImage = atlasImage;
    }
    pools.push(pool);
    return pool.elements.map((element, index) => ({ element, setVisible: shown => pool.setVisible(index, shown),
      sample: createPointSample(), reference: null, entering: false, identity: null, shown: false, transform: '', x: NaN, y: NaN, size: NaN }));
  };
  const outgoing = makeSlots(payload.policy.transitionSlots);
  const active = makeSlots(payload.policy.activeSlots);
  let activeIds = new Uint32Array(), outgoingIds = new Uint32Array();
  const fader = createOpacityFader(host.ownerDocument.defaultView!, opacityClock);
  const labels = showLabels ? mountPointFieldLabels(root, payload.labels, opacityClock) : null;
  const selectInitial = createPointFieldSelection(payload);
  let occluderLocal = occluder && presentPhysicalPoseInVolume({ positionM: occluder.positionM,
    orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
  host.insertBefore(root, before);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const setShown = (slot: Slot, shown: boolean) => {
    fader.visible(slot.element, shown);
    if (slot.shown === shown) return;
    slot.shown = shown; slot.setVisible(shown);
  };
  let latest: Publication | null = null;
  let destroyed = false, initialized = false, selectionHeld = false;
  let heldView: PointFieldView | null = null;
  let selected: PreparedPointFieldSelection | null = null;
  let visiblePoints = 0, individualPoints = 0;
  let pointRevision = 0, frameRevision = 0, renderedRevision = -1, renderPasses = 0, projectedPoints = 0;
  let renderedView: PointFieldView | null = null;
  let renderedOffset: readonly number[] = [];
  let candidates: StarLabelCandidate[] = [];
  const labelSample = createPointSample();
  const pointFrames = createPointFrameReceiver();
  let workerProjectedPoints = 0, workerPointUpdates = 0, workerPublications = 0;

  let pendingSelection: PreparedPointFieldSelection | null = null;
  let selectionViewCompleted: PointFieldView | null = null;
  let adoptionFrame: number | null = null;
  const windowTarget = host.ownerDocument.defaultView!;
  const selector = framePlanned || typeof Worker === 'undefined' ? null : createPointFieldSelectionClient(payload, selection => {
    if (destroyed) return;
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

  // A held cut still covers the view until it has turned by this share of the
  // view's own half-angle. Below it the retained stars are the same ones the
  // camera would select; beyond it the sky would empty out as they leave frame.
  const HELD_VIEW_TURN_SHARE = .25;
  function heldViewOutgrown() {
    if (!heldView || !latest) return true;
    const view = selectionView(latest);
    // Both view directions in the prepared frame: the rotation's third row.
    const turned = Math.acos(Math.min(1, Math.max(-1,
      heldView.viewRotation[6]! * view.viewRotation[6]! +
      heldView.viewRotation[7]! * view.viewRotation[7]! +
      heldView.viewRotation[8]! * view.viewRotation[8]!)));
    return turned > HELD_VIEW_TURN_SHARE * Math.atan(view.viewportHalfWidthPx / view.focalPx);
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
    if (timer === null && !selectionHeld) selector?.request(view);
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
      fader.set(departure.element, fader.current(slot.element), 0);
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
    if (!initialized || removed > 0 || added > 0) {
      pointRevision++; frameRevision++;
      const ids = (slots: Slot[]) => Uint32Array.from(slots.flatMap(slot => slot.reference ? [pointId(slot.reference)] : []));
      activeIds = ids(active); outgoingIds = ids(outgoing);
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
    outgoingIds = new Uint32Array();
    pointRevision++;
    for (const slot of outgoing) {
      slot.reference = null;
      setShown(slot, false);
      fader.cancel(slot.element);
    }
    for (const slot of active) slot.entering = false;
    for (const pool of pools) pool.commitVisibility();
    if (latest && !destroyed && !(framePlanned && requestPublication?.())) {
      pointFrames.invalidate(); updateSelection(latest); render(latest);
    }
  }

  function render(publication: Publication, plannedFrame?: PreparedPointFrame) {
    if (plannedFrame) {
      let visible = 0, individual = 0;
      for (const [slots, departing] of [[outgoing, true], [active, false]] as const) for (const slot of slots) {
        const reference = slot.reference;
        if (!reference) { setShown(slot, false); continue; }
        const value = pointFrames.get(pointId(reference));
        if (!value) throw new Error('Planned point frame is missing a retained identity.');
        setShown(slot, value.shown);
        if (!value.shown) continue;
        if (!departing) { visible++; if (reference.kind === 'star') individual++; }
        publishIdentity(slot, reference);
        if (slot.transform !== value.transform) {
          slot.element.style.transform = value.transform; slot.transform = value.transform;
          slot.x = slot.y = slot.size = NaN;
        }
        fader.set(slot.element, departing ? 0 : value.alpha,
          slot.entering || departing ? payload.policy.transitionMs : 0, true);
      }
      for (const pool of pools) pool.commitVisibility();
      visiblePoints = visible; individualPoints = individual;
      workerProjectedPoints += plannedFrame.projectedCount; workerPointUpdates += plannedFrame.indices.length;
      workerPublications++; renderPasses++;
      renderedRevision = -1; // A synchronous initial/recovery publication must calculate its own view.
      // Expiring outgoing leaves does not stale the still-valid active point
      // projection. If planning began during that fade, request the now-eligible
      // selection after publishing this frame instead of discarding the camera.
      if (timer === null && !plannedFrame.selectionEvaluated) requestPublication?.();
      return;
    }
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
      const shown = projection.depth > 0 && pointLuminanceVisible(light.luminance, 'coverageAnchor' in point && point.coverageAnchor) && !occluded(projection) && Math.abs(projection.x) < halfWidth + size && Math.abs(projection.y) < halfHeight + size;
      setShown(slot, shown);
      if (!shown) return;
      if (!departing) { visible++; if (reference.kind === 'star') individual++; }
      if (labels && !departing && reference.kind === 'star') { const candidate = label(reference.index, projection); if (candidate) candidates.push(candidate); }
      publishIdentity(slot, reference);
      // Bound publication rounding to 0.0005 CSS px per coordinate/size and
      // 0.0000005 opacity. Keep the physical camera math exact and compare
      // numeric state before serializing CSS, rather than rewriting floating
      // point noise for every star as the physical observer travels.
      const x = Math.round((projection.x - size / 2) * 1000) / 1000;
      const y = Math.round((projection.y - size / 2) * 1000) / 1000;
      const drawnSize = Math.round(size * 1000) / 1000;
      if (slot.x !== x || slot.y !== y || slot.size !== drawnSize) {
        slot.x = x; slot.y = y; slot.size = drawnSize;
        const transform = `translate(${x}px,${y}px) scale(${drawnSize / payload.atlas.tileSize})`;
        if (slot.transform !== transform) { element.style.transform = transform; slot.transform = transform; }
      }
      fader.set(element, departing ? 0 : Math.round(light.luminance * 1e6) / 1e6,
        slot.entering || departing ? payload.policy.transitionMs : 0, true);
    };
    for (const slot of outgoing) write(slot, true);
    for (const slot of active) write(slot, false);
    for (const pool of pools) pool.commitVisibility();
    visiblePoints = visible; individualPoints = individual;
    labels?.publish(candidates, label, publication.labelExclusionRects);
  }

  function publishIdentity(slot: Slot, reference: PointReference) {
    const identity = key(reference);
    if (slot.identity === identity) return;
    slot.identity = identity;
    const point = reference.kind === 'star' ? payload.stars[reference.index] : payload.nodes[reference.index];
    slot.element.style.backgroundPosition = `${-(point.colorIndex % payload.atlas.columns) * payload.atlas.tileSize}px ${-Math.floor(point.colorIndex / payload.atlas.columns) * payload.atlas.tileSize}px`;
  }

  return Object.freeze({ root,
    /** Keep the current star selection while the view rotates: retained stars keep
     * moving, and nothing is selected, faded in or retired until the committed cut
     * no longer covers the view. A rotation carries its stars off screen, so the
     * hold is reviewed by how far the view has turned, not at every frame. */
    holdSelection(held: boolean) {
      if (destroyed || selectionHeld === held) return;
      selectionHeld = held;
      heldView = held && latest ? selectionView(latest) : null;
      if (!held) requestPublication?.();
    },
    captureFrame() {
      const revision = frameRevision;
      // Membership is encoded only when it changes. Each request transfers its
      // own copy; detaching a message cannot corrupt retained slot ownership.
      const select = timer === null && (!selectionHeld || heldViewOutgrown());
      if (select && selectionHeld && latest) heldView = selectionView(latest);
      const state: PointFrameState = { committedId: pointFrames.committedId, active: activeIds.slice(), outgoing: outgoingIds.slice(), select };
      return { state, current: () => !destroyed && revision === frameRevision };
    },
    // Allocate diagnostics only when requested; render leaves stay anonymous.
    inspect() {
      return Object.freeze({ catalogueCount: payload.stars.length,
        coveredCount: selected?.coveredCount ?? 0, consideredCount: selected?.consideredCount ?? 0,
        drawnCount: selected?.drawnCount ?? 0, representatives: selected?.representatives.length ?? 0,
        maxProjectedErrorPx: selected?.maxProjectedErrorPx ?? 0, budgetLimited: selected?.budgetLimited ?? false,
        visiblePoints, individualPoints, renderPasses, projectedPoints, workerProjectedPoints, workerPointUpdates, workerPublications,
        visibilityPools: pools.map(pool => pool.stats()),
        points: Object.freeze([...outgoing, ...active].map(slot => Object.freeze({ element: slot.element,
          reference: slot.reference === null ? null : key(slot.reference) }))),
      });
    },
    setOccluder(body: { positionM: Vector3; radiusM: number }) {
      if (occluder && occluder.radiusM === body.radiusM && occluder.positionM.every((value, axis) => value === body.positionM[axis])) return;
      pointRevision++; frameRevision++;
      occluder = body;
      occluderLocal = presentPhysicalPoseInVolume({ positionM: body.positionM,
        orientationXyzw: [0, 0, 0, 1] }, payload.frame).positionUnits;
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number,
      labelExclusionRects: readonly LabelScreenRect[] = [], plannedFrame?: PreparedPointFrame) {
      if (destroyed) return;
      fader.batch(() => {
      root.style.opacity = String(opacity); root.style.visibility = opacity > 0 ? '' : 'hidden';
      if (opacity <= 0) { latest = null; for (const slot of [...active, ...outgoing]) fader.visible(slot.element, false); return; }
      latest = { world, viewport, labelExclusionRects };
      if (plannedFrame) {
        pointFrames.accept(plannedFrame);
        if (plannedFrame.selection) assign(plannedFrame.selection);
      } else {
        pointFrames.invalidate();
        if (timer === null) updateSelection(latest);
      }
      render(latest, plannedFrame);
      });
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

function camera(publication: Publication, payload: PreparedCssPointField) {
  if (publication.world.referenceFrame !== payload.frame.referenceFrame || publication.world.epochJdTt !== payload.frame.epochJdTt) {
    throw new TypeError('Prepared stars and camera must share a reference frame and epoch.');
  }
  const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw)) as Matrix3;
  return { local, rotation };
}
