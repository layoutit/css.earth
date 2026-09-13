import type { SceneLifetime } from '@cssearth/engine';
import { requirePhysicalProjection } from '../rendering/physical-projection.js';
import { screenPicking } from '../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';
import { orbitSegmentTransform } from '../solar-system/orbit-segment-presentation.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import type { LabelScreenRect } from './screen-label-layout.js';
import { admitSurfaceFeatureLabels, passesZoomGate, projectSurfaceFeature, projectSurfaceOutline, zoomShare, POINT_LABEL_GAP_PX } from './surface-feature-layout.js';
import type { SurfaceLabelCandidate } from './surface-feature-layout.js';
import { loadPreparedSurfaceFeatureCatalog } from './surface-feature-catalog.js';
import { flyToSurfaceDirection } from './surface-feature-flight.js';
import type { SurfaceFlightHandle } from './surface-feature-flight.js';
import { rotateWorldPosition } from '../navigation/world-camera-math.js';
import type { ObjectWorldNavigation } from '../runtime/world-navigation-types.js';
import type { PreparedSurfaceFeature, PreparedSurfaceFeatureCatalog, PreparedSurfaceFeaturePlan, SurfaceFeatureLayerRuntime, SurfaceFeatureLayerStats } from './surface-feature-types.js';

const LABEL_FADE_MS = 200;
/** Surface labels paint above the detailed body and any context sprite behind it. */
const SURFACE_PICK_RANK = 1_000_000;

export interface SurfaceFeatureMountOptions {
  readonly host: HTMLElement; readonly plan: PreparedSurfaceFeaturePlan; readonly objectId: string;
  /** The prepared mesh node the anchors belong to, and the scene root that bounds its transform chain. */
  readonly target: HTMLElement; readonly scene: HTMLElement;
  /** The camera's current zoom range; the prepared policy gates labels on its logarithmic share. */
  readonly zoomRange: () => { readonly minimum: number; readonly maximum: number };
  /** The shared world camera, when the object has a prepared frame: selection flies the observer over the feature. */
  readonly navigation?: ObjectWorldNavigation;
  readonly flightLimits?: () => { readonly minimumDistanceM: number };
  /** Called before a flight starts, so the owner can stop prepared motion. */
  readonly onFlight?: () => void;
  readonly lifetime: SceneLifetime; readonly pickingHost?: HTMLElement;
  /** The shared input surface: a plain click on it that picks no label clears the selection. */
  readonly inputSurface?: HTMLElement;
  readonly onError: (error: unknown) => void;
  readonly transport?: Parameters<typeof loadPreparedSurfaceFeatureCatalog>[3];
}

interface Entry {
  readonly element: HTMLElement; feature: PreparedSurfaceFeature | null; width: number; height: number;
  targetOpacity: number; hideTimer: ReturnType<typeof setTimeout> | null; x: number; y: number;
}

function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(2)).toString(); }
const kilometres = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** Retained nomenclature labels for one prepared body. The DOM pool (labels, caption card and
 * outline chords) is sized by the plan at mount; catalogue text arrives later without adding
 * nodes. Hover and activation come from the shared input surface through the screen-picking
 * registry; the layer owns no pointer listeners. */
/** Feature framing on arrival: the published diameter spans this share of the shorter viewport side. */
const ARRIVAL_DIAMETER_SHARE = 0.45;
/** Spacecraft sites and traverses have no size to report. */
const SITE_CODES = new Set(['LS', 'IM', 'SS', 'RT']);
const MINIMUM_FRAMED_RADIUS_M = 25_000;

const CLICK_SLOP_PIXELS = 5;
/** Catalogue names are written and measured in batches. All 2,000 names of a body at once took
 * one 56-70 ms task in the middle of the arrival flight. */
const LABELS_PER_FRAME = 128;

export function mountSurfaceFeatureLabels({ host, plan, objectId, target, scene, zoomRange, navigation, flightLimits, onFlight, lifetime, pickingHost = host, inputSurface, onError, transport }: SurfaceFeatureMountOptions): SurfaceFeatureLayerRuntime {
  if (!host?.ownerDocument || !target || !scene.contains(target)) throw new TypeError('Surface feature labels need a host and a mesh target inside the scene.');
  const document = host.ownerDocument, windowTarget = document.defaultView;
  if (!windowTarget) throw new TypeError('Surface feature labels require a mounted window.');
  const root = document.createElement('div');
  root.className = 'prepared-surface-features';
  root.dataset.surfaceFeatures = objectId;
  root.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
  // The outline chords paint beneath the labels; both are screen-space children of one root.
  const outline: HTMLElement[] = [];
  for (let index = 0; index < plan.outline.pieces; index++) {
    const piece = document.createElement('s');
    piece.dataset.featureOutlinePiece = '';
    piece.style.cssText = 'position:absolute;left:50%;top:50%;width:1px;transform-origin:0 50%;visibility:hidden;pointer-events:none';
    root.appendChild(piece);
    outline.push(piece);
  }
  const entries: Entry[] = [];
  for (let index = 0; index < plan.catalog.count; index++) {
    const element = document.createElement('span');
    element.dataset.featureLabel = '';
    element.dataset.surfacePick = 'true';
    element.style.cssText = 'position:absolute;left:50%;top:50%;white-space:nowrap;visibility:hidden;opacity:0;pointer-events:none';
    element.ariaHidden = 'true';
    root.appendChild(element);
    entries.push({ element, feature: null, width: 0, height: 0, targetOpacity: 0, hideTimer: null, x: 0, y: 0 });
  }
  const tooltip = document.createElement('div');
  tooltip.dataset.featureTooltip = '';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  tooltip.style.cssText = 'position:absolute;left:50%;top:50%;pointer-events:none';
  const tooltipName = document.createElement('b'), tooltipDetail = document.createElement('span'), tooltipOrigin = document.createElement('p'), tooltipNote = document.createElement('p'), tooltipCredit = document.createElement('small');
  tooltipName.dataset.featureTooltipName = ''; tooltipDetail.dataset.featureTooltipDetail = ''; tooltipOrigin.dataset.featureTooltipOrigin = ''; tooltipNote.dataset.featureTooltipNote = ''; tooltipCredit.dataset.featureTooltipCredit = '';
  tooltip.append(tooltipName, tooltipDetail, tooltipOrigin, tooltipNote, tooltipCredit);
  root.appendChild(tooltip);
  host.appendChild(root);
  const picking = screenPicking(pickingHost);
  const fader = createOpacityFader(windowTarget);
  const controller = new AbortController();
  let destroyed = false, loaded = false, error: string | null = null, playing = false, enabled = false, frames = 0, zoomGate = false, outlinePieces = 0;
  let view: Parameters<SurfaceFeatureLayerRuntime['publish']>[0] | null = null;
  let matrix: Float64Array | null = null, local: DOMMatrix | null = null, catalog: PreparedSurfaceFeatureCatalog | null = null, flight: SurfaceFlightHandle | null = null;
  let resolveLoaded!: (catalog: PreparedSurfaceFeatureCatalog) => void, rejectLoaded!: (error: unknown) => void;
  const loadedCatalog = new Promise<PreparedSurfaceFeatureCatalog>((resolve, reject) => { resolveLoaded = resolve; rejectLoaded = reject; });
  loadedCatalog.catch(() => {});
  let pendingFrame: number | null = null, loopFrame: number | null = null, populateFrame: number | null = null;
  let visible = new Set<number>(), rects = new Map<string, LabelScreenRect>(), eligible = 0;
  let hoveredIndex: number | null = null, pinnedIndex: number | null = null, shownIndex: number | null = null;
  const measure = () => {
    if (destroyed || !loaded) return;
    for (const entry of entries) { entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight; }
    schedule();
  };
  const fonts = document.fonts;
  fonts?.addEventListener('loadingdone', measure);
  void fonts?.ready.then(measure);
  const onHover = () => {
    const index = entries.findIndex(entry => entry.element.dataset.objectHovered === 'true');
    hoveredIndex = index >= 0 ? index : null;
    presentCaption();
  };
  pickingHost.addEventListener('objecthoverchange', onHover);
  const activations = entries.map((entry, index) => {
    const activate = (event: Event) => {
      if (!visible.has(index)) return;
      event.preventDefault();
      if (pinnedIndex === index) { clearSelection(); return; }
      void selectIndex(index);
    };
    entry.element.addEventListener('click', activate);
    return activate;
  });
  // Label picks are consumed by the shared picker before they bubble, so a click that
  // reaches the window from the input surface picked nothing: it clears the selection.
  let press: { x: number; y: number } | null = null;
  const onPress = (event: PointerEvent) => { press = event.target === inputSurface && event.isPrimary ? { x: event.clientX, y: event.clientY } : null; };
  const onSurfaceClick = (event: MouseEvent) => {
    if (pinnedIndex === null || event.target !== inputSurface || event.button !== 0) return;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PIXELS) return;
    clearSelection();
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && pinnedIndex !== null) clearSelection(); };
  if (inputSurface) {
    windowTarget.addEventListener('pointerdown', onPress, { capture: true });
    windowTarget.addEventListener('click', onSurfaceClick);
    windowTarget.addEventListener('keydown', onKey);
  }
  lifetime.onDispose(destroy);
  void loadPreparedSurfaceFeatureCatalog(plan, objectId, controller.signal, transport).then(loadedValue => {
    if (destroyed) return;
    catalog = loadedValue;
    catalog.features.forEach((feature, index) => { entries[index]!.feature = feature; });
    populate(loadedValue, 0);
  }, failure => {
    if (destroyed || controller.signal.aborted) { rejectLoaded(failure); return; }
    error = failure instanceof Error ? failure.message : String(failure);
    rejectLoaded(failure);
    onError(failure);
  });
  function schedule() {
    if (destroyed || pendingFrame !== null) return;
    pendingFrame = windowTarget!.requestAnimationFrame(() => { pendingFrame = null; refresh(); });
  }
  function populate(loadedValue: PreparedSurfaceFeatureCatalog, start: number) {
    populateFrame = null;
    if (destroyed) return;
    const end = Math.min(loadedValue.features.length, start + LABELS_PER_FRAME);
    for (let index = start; index < end; index++) {
      const entry = entries[index]!, feature = entry.feature!;
      entry.element.dataset.featureLabel = feature.id;
      entry.element.dataset.featureKind = feature.kind;
      entry.element.textContent = feature.name;
    }
    // Read after this batch's writes, so each forced layout covers the new names, not the whole pool.
    for (let index = start; index < end; index++) {
      const entry = entries[index]!;
      entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight;
    }
    if (end < loadedValue.features.length) {
      populateFrame = windowTarget!.requestAnimationFrame(() => populate(loadedValue, end));
      return;
    }
    loaded = true;
    schedule();
    resolveLoaded(loadedValue);
  }
  function loop() {
    loopFrame = null;
    if (destroyed || !playing) return;
    refresh();
    loopFrame = windowTarget!.requestAnimationFrame(loop);
  }
  /** The mesh node's current transform chain up to the scene root, spin included. */
  function readLocal(): DOMMatrix {
    let chain = new windowTarget!.DOMMatrix();
    for (let node: HTMLElement | null = target; node && node !== scene; node = node.parentElement) {
      chain = new windowTarget!.DOMMatrix(windowTarget!.getComputedStyle(node).transform).multiply(chain);
    }
    return chain;
  }
  function hideAll() {
    for (const entry of entries) hideNow(entry);
    visible = new Set(); rects = new Map(); eligible = 0; matrix = null;
    picking.publish(root, []);
    presentCaption();
  }
  function refresh() {
    if (destroyed) return;
    frames++;
    const projection = view?.projection;
    const range = zoomRange();
    zoomGate = passesZoomGate(view?.zoom, range.minimum, range.maximum, plan.policy);
    // Each name carries its own discovery tier; names whose tier lies beyond the current zoom share wait for the camera.
    const currentShare = view?.zoom === undefined ? 0 : zoomShare(view.zoom, range.minimum, range.maximum);
    // The selected feature stays labelled at any zoom; the density gate applies to the rest.
    if (!loaded || !enabled || !projection || (!zoomGate && pinnedIndex === null) || (view?.levelOfDetail && view.levelOfDetail.stage !== 'geometry')) { hideAll(); return; }
    requirePhysicalProjection(projection);
    // Retained mesh ancestors use zero transform origins; their current matrices
    // carry the body spin exactly as painted. Camera transforms are already in
    // the published eye matrix, so the chain stops at the scene root.
    local = readLocal();
    matrix = new windowTarget!.DOMMatrix(Array.from(projection.eyeFromScene)).multiply(local).toFloat64Array();
    const width = host.clientWidth, height = host.clientHeight;
    const candidates: SurfaceLabelCandidate[] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!, feature = entry.feature;
      if (!feature || ((!zoomGate || feature.minimumZoomShare > currentShare + 1e-6) && index !== pinnedIndex)) continue;
      const projected = projectSurfaceFeature(feature, matrix, projection.focalPixels, projection.principalOffsetPixels);
      if (!projected) continue;
      entry.x = projected.x; entry.y = projected.y;
      candidates.push({ index, kind: feature.kind, projected, width: entry.width, height: entry.height });
    }
    // The label budget grows with the zoom: a whole body carries a third of the prepared maximum, the closest view all of it.
    const budget = { ...plan.policy, maximumVisible: Math.max(4, Math.round(plan.policy.maximumVisible * (0.3 + 0.7 * currentShare))) };
    const admitted = admitSurfaceFeatureLabels(candidates, budget, { width, height }, visible, [], pinnedIndex);
    const next = new Set<number>(), nextRects = new Map<string, LabelScreenRect>(), targets: ScreenPickTarget[] = [];
    for (const { index, rect, opacity } of admitted.accepted) {
      const entry = entries[index]!;
      next.add(index); nextRects.set(entry.feature!.id, rect);
      const anchor = entry.feature!.kind === 'point' ? `translate(${format(entry.x + POINT_LABEL_GAP_PX)}px,${format(entry.y)}px) translate(0,-50%)`
        : `translate(${format(entry.x)}px,${format(entry.y)}px) translate(-50%,-50%)`;
      entry.element.style.transform = anchor;
      fadeTo(entry, opacity);
      targets.push({ element: entry.element, rank: SURFACE_PICK_RANK, shape: { kind: 'rect', ...rect } });
    }
    for (let index = 0; index < entries.length; index++) if (!next.has(index) && (visible.has(index) || entries[index]!.targetOpacity > 0)) fadeTo(entries[index]!, 0);
    visible = next; rects = nextRects; eligible = admitted.eligible;
    picking.publish(root, targets);
    presentCaption();
  }
  function presentCaption() {
    const index = pinnedIndex !== null && visible.has(pinnedIndex) ? pinnedIndex : hoveredIndex !== null && visible.has(hoveredIndex) ? hoveredIndex : null;
    if (index === null) {
      if (shownIndex !== null) { tooltip.hidden = true; delete tooltip.dataset.featureTooltipFor; delete root.dataset.featureOutlineFor; hideOutline(); shownIndex = null; }
      return;
    }
    const entry = entries[index]!, feature = entry.feature!;
    if (shownIndex !== index) {
      tooltipName.textContent = feature.name;
      tooltipDetail.textContent = feature.diameterKm > 0 ? `${feature.type} · ${kilometres.format(feature.diameterKm)} km` : SITE_CODES.has(feature.code) ? feature.type : `${feature.type} · size unpublished`;
      tooltipOrigin.textContent = feature.origin;
      tooltipNote.textContent = feature.note?.text ?? '';
      tooltipCredit.textContent = feature.note?.credit ? `${feature.credit} · ${feature.note.credit}` : feature.credit;
      tooltip.dataset.featureTooltipFor = feature.id;
      root.dataset.featureOutlineFor = feature.id;
      tooltip.hidden = false;
      shownIndex = index;
    }
    tooltip.dataset.featureTooltipPinned = pinnedIndex === index ? 'true' : 'false';
    const rect = rects.get(feature.id)!;
    tooltip.style.transform = `translate(${format((rect.left + rect.right) / 2)}px,${format(rect.top)}px) translate(-50%,-100%)`;
    presentOutline(feature);
  }
  /** The published diameter, traced as retained screen chords like the orbit lines; the stroke
   * is a shell style in CSS pixels, so zooming changes the circle, never its weight. */
  function presentOutline(feature: PreparedSurfaceFeature): void {
    const projection = view?.projection;
    if (!matrix || !projection) { hideOutline(); return; }
    const chords = projectSurfaceOutline(feature.outline, matrix, projection.focalPixels, projection.principalOffsetPixels, outline.length);
    chords.forEach((chord, index) => {
      const piece = outline[index]!;
      piece.style.transform = orbitSegmentTransform(chord);
      piece.style.visibility = '';
    });
    for (let index = chords.length; index < outline.length; index++) outline[index]!.style.visibility = 'hidden';
    outlinePieces = chords.length;
  }
  /** Pin the feature and fly the observer over it, framing its published diameter. */
  async function selectIndex(index: number): Promise<{ completed: boolean }> {
    const feature = entries[index]?.feature;
    if (!feature || destroyed) return { completed: false };
    pinnedIndex = index;
    flight?.cancel(); flight = null;
    schedule();
    if (!navigation) { presentCaption(); return { completed: true }; }
    const frame = navigation.frame;
    const scenePoint = readLocal().transformPoint({ x: feature.normal[0], y: feature.normal[1], z: feature.normal[2], w: 0 });
    const length = Math.hypot(scenePoint.x, scenePoint.y, scenePoint.z);
    if (!(length > 0)) return { completed: false };
    const directionWorld = rotateWorldPosition(frame.presentationToReference, [scenePoint.x / length, scenePoint.y / length, scenePoint.z / length]);
    const optics = navigation.optics(), rect = optics.visibleRect;
    const shortSide = rect ? Math.min(rect.right - rect.left, rect.bottom - rect.top) : Math.min(host.clientWidth, host.clientHeight);
    const featureRadiusM = Math.max(MINIMUM_FRAMED_RADIUS_M, feature.radiusUnits / plan.meshRadiusUnits * frame.bodyRadiusM);
    const current = navigation.capture(), origin = frame.originM;
    const currentDistanceM = Math.hypot(current.pose.positionM[0] - origin[0], current.pose.positionM[1] - origin[1], current.pose.positionM[2] - origin[2]);
    const fitDistanceM = frame.bodyRadiusM + optics.focalPixels * featureRadiusM / (shortSide * ARRIVAL_DIAMETER_SHARE / 2);
    const minimumM = flightLimits?.().minimumDistanceM ?? frame.bodyRadiusM * 1.2;
    // Never fly away from the surface: arrive at the framing distance or stay as close as the observer already is.
    const distanceM = Math.max(minimumM, Math.min(currentDistanceM, fitDistanceM));
    onFlight?.();
    const reducedMotion = typeof windowTarget!.matchMedia === 'function' && windowTarget!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flight = flyToSurfaceDirection(navigation, { directionWorld, distanceM, reducedMotion, windowTarget: windowTarget! });
    const handle = flight;
    const result = await handle.done;
    if (flight === handle) flight = null;
    return result;
  }
  function clearSelection(): void {
    pinnedIndex = null; flight?.cancel(); flight = null; presentCaption(); schedule();
  }
  function hideOutline(): void {
    if (outlinePieces === 0) return;
    for (const piece of outline) piece.style.visibility = 'hidden';
    outlinePieces = 0;
  }
  function fadeTo(entry: Entry, opacity: number): void {
    if (entry.targetOpacity === opacity) { if (opacity > 0) entry.element.style.visibility = ''; fader.set(entry.element, opacity, LABEL_FADE_MS); return; }
    if (entry.hideTimer !== null) { clearTimeout(entry.hideTimer); entry.hideTimer = null; }
    entry.targetOpacity = opacity;
    if (opacity > 0) entry.element.style.visibility = '';
    fader.set(entry.element, opacity, LABEL_FADE_MS);
    if (opacity === 0) entry.hideTimer = setTimeout(() => {
      entry.hideTimer = null;
      if (entry.targetOpacity === 0) entry.element.style.visibility = 'hidden';
    }, LABEL_FADE_MS);
  }
  function hideNow(entry: Entry): void {
    if (entry.hideTimer !== null) clearTimeout(entry.hideTimer);
    entry.hideTimer = null; entry.targetOpacity = 0; fader.set(entry.element, 0); entry.element.style.visibility = 'hidden';
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    controller.abort();
    flight?.cancel(); flight = null;
    if (pendingFrame !== null) windowTarget!.cancelAnimationFrame(pendingFrame);
    if (loopFrame !== null) windowTarget!.cancelAnimationFrame(loopFrame);
    if (populateFrame !== null) windowTarget!.cancelAnimationFrame(populateFrame);
    fonts?.removeEventListener('loadingdone', measure);
    pickingHost.removeEventListener('objecthoverchange', onHover);
    if (inputSurface) { windowTarget!.removeEventListener('pointerdown', onPress, { capture: true }); windowTarget!.removeEventListener('click', onSurfaceClick); windowTarget!.removeEventListener('keydown', onKey); }
    entries.forEach((entry, index) => { entry.element.removeEventListener('click', activations[index]!); if (entry.hideTimer !== null) clearTimeout(entry.hideTimer); });
    picking.remove(root);
    fader.destroy();
    root.remove();
  }
  return Object.freeze({
    root,
    publish(next: Parameters<SurfaceFeatureLayerRuntime['publish']>[0]) { if (destroyed) return; view = next; schedule(); },
    setLens({ id }: { readonly id: string | null }) { if (destroyed) return; enabled = id !== null && plan.lensIds.includes(id); schedule(); },
    setPlaying(value: boolean) {
      if (destroyed || playing === value) return;
      playing = value;
      if (playing && loopFrame === null) loopFrame = windowTarget!.requestAnimationFrame(loop);
      if (!playing && loopFrame !== null) { windowTarget!.cancelAnimationFrame(loopFrame); loopFrame = null; }
    },
    stats(): SurfaceFeatureLayerStats {
      return Object.freeze({ loaded, count: plan.catalog.count, visible: visible.size, eligible, enabled, playing, frames, error, zoomGate, outlinePieces, flying: flight !== null,
        hovered: hoveredIndex === null ? null : entries[hoveredIndex]!.feature?.id ?? null, pinned: pinnedIndex === null ? null : entries[pinnedIndex]!.feature?.id ?? null });
    },
    inspect() {
      return Object.freeze({ labels: Object.freeze(Object.fromEntries(entries.filter(entry => entry.feature).map(entry => [entry.feature!.id, entry.element]))), tooltip, outline: Object.freeze([...outline]), rects });
    },
    catalog: () => catalog,
    loaded: () => loadedCatalog,
    async select(id: string) { await loadedCatalog; if (destroyed) return { completed: false }; const index = entries.findIndex(entry => entry.feature?.id === id); return index < 0 ? { completed: false } : selectIndex(index); },
    selected: () => pinnedIndex === null ? null : entries[pinnedIndex]!.feature?.id ?? null,
    clear: clearSelection,
    destroy,
  });
}
