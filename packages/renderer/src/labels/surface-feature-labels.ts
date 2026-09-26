import type { SceneLifetime } from '@cssearth/engine';
import { surfaceFeatureBankIndex } from './surface-feature-banks.js';
import { requirePhysicalProjection } from '../prepared-data/physical-projection.js';
import { screenPicking } from '../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';
import { orbitSegmentTransform } from '../solar-system/orbit-segment-presentation.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import type { LabelScreenRect } from './screen-label-layout.js';
import { labelOcclusionFor } from './label-occlusion.js';
import { admitSurfaceFeatureLabels, passesZoomGate, projectSurfaceFeature, projectSurfaceOutline, zoomShare, POINT_LABEL_GAP_PX } from './surface-feature-layout.js';
import type { SurfaceLabelCandidate } from './surface-feature-layout.js';
import { loadPreparedSurfaceFeatureBank, loadPreparedSurfaceFeatureCatalog } from './surface-feature-catalog.js';
import { flyToSurfaceDirection } from './surface-feature-flight.js';
import type { SurfaceFlightHandle } from './surface-feature-flight.js';
import { rotateWorldPosition } from '../navigation/world-camera-math.js';
import type { ObjectWorldNavigation } from '../runtime/world-navigation-types.js';
import type { PreparedSurfaceFeature, PreparedSurfaceFeatureCatalog, PreparedSurfaceFeaturePlan, SurfaceFeatureLayerRuntime, SurfaceFeatureLayerStats } from './surface-feature-types.js';
import { surfaceFeatureCaption } from './surface-feature-caption.js';

const LABEL_FADE_MS = 200;
/** Surface labels paint above the detailed body and any context sprite behind it. */
const SURFACE_PICK_RANK = 1_000_000;

export interface SurfaceFeatureMountOptions {
  readonly host: HTMLElement; readonly plan: PreparedSurfaceFeaturePlan; readonly objectId: string;
  /** The prepared mesh node the anchors belong to, and the scene root that bounds its transform chain. */
  readonly target: HTMLElement; readonly scene: HTMLElement;
  /** The camera's current zoom range; the prepared policy gates labels on its logarithmic share. */
  readonly zoomRange: () => { readonly minimum: number; readonly maximum: number };
  /** The shared world camera: selection flies the observer over the feature. */
  readonly navigation: ObjectWorldNavigation;
  readonly flightLimits: () => { readonly minimumDistanceM: number };
  /** Called before a flight starts, so the owner can stop prepared motion. */
  readonly onFlight?: () => void;
  readonly onSelect?: (id: string) => void;
  readonly lifetime: SceneLifetime; readonly pickingHost: HTMLElement;
  /** The shared input surface: a plain click on it that picks no label clears the selection. */
  readonly inputSurface: HTMLElement;
  readonly onError: (error: unknown) => void;
  readonly transport?: Parameters<typeof loadPreparedSurfaceFeatureCatalog>[3];
}

interface Entry {
  readonly element: HTMLElement; feature: PreparedSurfaceFeature | null; width: number; height: number; measured: boolean;
  targetOpacity: number; hideTimer: ReturnType<typeof setTimeout> | null; x: number; y: number;
}

function format(value: number): string { return Math.abs(value) < 1e-9 ? '0' : Number(value.toFixed(2)).toString(); }

/** Retained nomenclature labels for one prepared body. The outline/caption pool mounts with the
 * scene; the default-map label pool and catalogue stay absent until the first interaction.
 * Search-only features load one small bank when selected. Hover and activation use the shared picker. */
/** Feature framing on arrival: the published diameter spans this share of the shorter viewport side. */
const ARRIVAL_DIAMETER_SHARE = 0.45;
const MINIMUM_FRAMED_RADIUS_M = 25_000;

const CLICK_SLOP_PIXELS = 5;
/** Catalogue names are written and measured in batches. All 2,000 names of a body at once took
 * one 56-70 ms task in the middle of the arrival flight. */
const LABELS_PER_FRAME = 128;

export function mountSurfaceFeatureLabels({ host, plan, objectId, target, scene, zoomRange, navigation, flightLimits, onFlight, onSelect, lifetime, pickingHost, inputSurface, onError, transport }: SurfaceFeatureMountOptions): SurfaceFeatureLayerRuntime {
  if (!host?.ownerDocument || !target || !scene.contains(target)) throw new TypeError('Surface feature labels need a host and a mesh target inside the scene.');
  const document = host.ownerDocument, windowTarget = document.defaultView;
  if (!windowTarget) throw new TypeError('Surface feature labels require a mounted window.');
  const root = host.querySelector<HTMLElement>(':scope > .prepared-surface-features') ?? document.createElement('div');
  if (root.dataset.surfaceFeatures && root.dataset.surfaceFeatures !== objectId) throw new TypeError('Prepared feature caption belongs to another object.');
  root.className = 'prepared-surface-features';
  root.dataset.surfaceFeatures = objectId;
  // A zero-size root at the stage centre, children placed from it: the root composites above the globe, and a full-screen
  // box made that layer the whole stage (9 MB at 3x) for a few captions.
  root.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;z-index:1;pointer-events:none';
  // The outline chords paint beneath the labels; both are screen-space children of one root.
  const outline: HTMLElement[] = [];
  for (let index = 0; index < plan.outline.pieces; index++) {
    const piece = document.createElement('s');
    piece.dataset.featureOutlinePiece = '';
    piece.style.cssText = 'position:absolute;left:0;top:0;width:1px;transform-origin:0 50%;visibility:hidden;pointer-events:none';
    root.appendChild(piece);
    outline.push(piece);
  }
  const entries: Entry[] = [];
  const caption = surfaceFeatureCaption(root), tooltip = caption.element;
  host.appendChild(root);
  const picking = screenPicking(pickingHost);
  const fader = createOpacityFader(windowTarget);
  const controller = new AbortController();
  const labelsEnabled = () => document.body.dataset.surfaceLabels === 'on';
  let destroyed = false, playing = false, enabled = false, frames = 0, zoomGate = false, outlinePieces = 0;
  /** The default catalogue: requested (or held until a flight lands), fetched, written into the labels in batches, then loaded. */
  let load: { readonly kind: 'idle' } | { readonly kind: 'held' } | { readonly kind: 'fetching' }
    | { readonly kind: 'populating'; readonly catalog: PreparedSurfaceFeatureCatalog; frame: number | null }
    | { readonly kind: 'loaded'; readonly catalog: PreparedSurfaceFeatureCatalog }
    | { readonly kind: 'failed'; readonly error: string } = { kind: 'idle' };
  let view: Parameters<SurfaceFeatureLayerRuntime['publish']>[0] | null = null;
  let matrix: Float64Array | null = null, local: DOMMatrix | null = null, flight: SurfaceFlightHandle | null = null;
  let resolveLoaded!: (catalog: PreparedSurfaceFeatureCatalog) => void, rejectLoaded!: (error: unknown) => void;
  const loadedCatalog = new Promise<PreparedSurfaceFeatureCatalog>((resolve, reject) => { resolveLoaded = resolve; rejectLoaded = reject; });
  loadedCatalog.catch(() => {});
  const selectionBanks = new Map<string, Promise<PreparedSurfaceFeatureCatalog>>();
  let pendingFrame: number | null = null, loopFrame: number | null = null;
  let visible = new Set<number>(), rects = new Map<string, LabelScreenRect>(), eligible = 0;
  let hoveredIndex: number | null = null, pinnedIndex: number | null = null, shownIndex: number | null = null;
  // A font change invalidates every measured name; each is measured again when it next competes for a place.
  const measure = () => {
    if (destroyed || load.kind !== 'loaded') return;
    for (const entry of entries) entry.measured = false;
    schedule();
  };
  const fonts = document.fonts;
  fonts?.addEventListener('loadingdone', measure);
  void fonts?.ready.then(measure);
  const onHover = () => {
    if (!labelsEnabled()) { hoveredIndex = null; presentCaption(); return; }
    const index = entries.findIndex(entry => entry.element.dataset.objectHovered === 'true');
    hoveredIndex = index >= 0 ? index : null;
    presentCaption();
  };
  pickingHost.addEventListener('objecthoverchange', onHover);
  const activations: ((event: Event) => void)[] = [];
  const createEntry = () => {
    const index = entries.length;
    const element = document.createElement('span');
    element.dataset.featureLabel = '';
    element.dataset.surfacePick = 'true';
    element.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;visibility:hidden;opacity:0;pointer-events:none';
    element.ariaHidden = 'true';
    root.appendChild(element);
    const entry: Entry = { element, feature: null, width: 0, height: 0, measured: false, targetOpacity: 0, hideTimer: null, x: 0, y: 0 };
    const activate = (event: Event) => {
      if (!labelsEnabled() || !visible.has(index)) return;
      event.preventDefault();
      if (pinnedIndex === index) { clearSelection(); return; }
      if (onSelect) onSelect(entries[index]!.feature!.id);
      else void selectIndex(index);
    };
    element.addEventListener('click', activate);
    entries.push(entry); activations.push(activate);
    return entry;
  };
  const createEntries = () => {
    if (entries.length) return;
    for (let index = 0; index < plan.catalog.count; index++) createEntry();
  };
  // Label picks are consumed by the shared picker before they bubble, so a click that
  // reaches the window from the input surface picked nothing: it clears the selection.
  let press: { x: number; y: number } | null = null;
  const onPress = (event: PointerEvent) => { if (labelsEnabled()) requestLoading(); press = event.target === inputSurface && event.isPrimary ? { x: event.clientX, y: event.clientY } : null; };
  const onWheel = () => { if (labelsEnabled()) requestLoading(); };
  const onSurfaceClick = (event: MouseEvent) => {
    if (pinnedIndex === null || event.target !== inputSurface || event.button !== 0) return;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PIXELS) return;
    clearSelection();
  };
  const onKey = (event: KeyboardEvent) => { if (labelsEnabled()) requestLoading(); if (event.key === 'Escape' && pinnedIndex !== null) clearSelection(); };
  windowTarget.addEventListener('pointerdown', onPress, { capture: true });
  inputSurface.addEventListener('wheel', onWheel, { passive: true });
  windowTarget.addEventListener('click', onSurfaceClick);
  windowTarget.addEventListener('keydown', onKey);
  lifetime.onDispose(destroy);
  const occlusion = labelOcclusionFor(host.ownerDocument);
  lifetime.onDispose(occlusion.subscribe(() => refresh()));
  // The catalogue (5.9 MB for Mars) loads on the first interaction, and typing the next search while a flight passes
  // this body counts as one. A flight's destination mounts before the camera arrives, so while the flight is under way
  // the load is held. It runs when the flight ends with this body on screen (it landed, or the visitor stopped it here);
  // a flight another navigation replaces drops it, so a body the camera only passes never fetches it. Explicit requests
  // (search, selection) load at once.
  let navigationInFlight = false;
  function requestLoading() {
    if (!navigationInFlight) startLoading();
    else if (load.kind === 'idle') load = { kind: 'held' };
  }
  function startLoading() {
    if (destroyed || (load.kind !== 'idle' && load.kind !== 'held')) return;
    load = { kind: 'fetching' };
    void loadPreparedSurfaceFeatureCatalog(plan, objectId, controller.signal, transport).then(catalog => {
      if (destroyed) return;
      createEntries();
      catalog.features.forEach((feature, index) => { entries[index]!.feature = feature; });
      load = { kind: 'populating', catalog, frame: null };
      populate(0);
    }, failure => {
      if (destroyed || controller.signal.aborted) { rejectLoaded(failure); return; }
      load = { kind: 'failed', error: failure instanceof Error ? failure.message : String(failure) };
      rejectLoaded(failure);
      onError(failure);
    });
  }
  function schedule() {
    if (destroyed || pendingFrame !== null) return;
    pendingFrame = windowTarget!.requestAnimationFrame(() => { pendingFrame = null; refresh(); });
  }
  function populate(start: number) {
    const populating = load;
    if (destroyed || populating.kind !== 'populating') return;
    populating.frame = null;
    const { catalog } = populating, end = Math.min(catalog.features.length, start + LABELS_PER_FRAME);
    for (let index = start; index < end; index++) {
      const entry = entries[index]!, feature = entry.feature!;
      populateEntry(entry, feature);
    }
    if (end < catalog.features.length) {
      populating.frame = windowTarget!.requestAnimationFrame(() => populate(end));
      return;
    }
    load = { kind: 'loaded', catalog };
    schedule();
    resolveLoaded(catalog);
  }
  function populateEntry(entry: Entry, feature: PreparedSurfaceFeature) {
    entry.feature = feature;
    entry.element.dataset.featureLabel = feature.id;
    entry.element.dataset.featureKind = feature.kind;
    entry.element.textContent = feature.name;
  }
  async function selectionFeature(id: string): Promise<PreparedSurfaceFeature | null> {
    const resident = entries.find(entry => entry.feature?.id === id)?.feature;
    if (resident) return resident;
    if (!plan.selection) return null;
    const descriptor = plan.selection.banks[surfaceFeatureBankIndex(id, plan.selection.banks.length)];
    if (!descriptor) return null;
    let pending = selectionBanks.get(descriptor.url);
    if (!pending) {
      pending = loadPreparedSurfaceFeatureBank(plan, objectId, id, controller.signal, transport).then(value => {
        if (!value) throw new Error('Prepared feature selection bank is unavailable.');
        return value;
      }).catch(failure => {
        selectionBanks.delete(descriptor.url);
        throw failure;
      });
      selectionBanks.set(descriptor.url, pending);
    }
    return (await pending).features.find(feature => feature.id === id) ?? null;
  }
  // Labels follow a playing scene every frame. They are off by default; with them off there is nothing to follow.
  const following = () => !destroyed && playing && labelsEnabled();
  function loop() {
    loopFrame = null;
    if (!following()) return;
    refresh();
    loopFrame = windowTarget!.requestAnimationFrame(loop);
  }
  function syncLoop() {
    if (following() && loopFrame === null) loopFrame = windowTarget!.requestAnimationFrame(loop);
    if (!following() && loopFrame !== null) { windowTarget!.cancelAnimationFrame(loopFrame); loopFrame = null; }
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
  const onLabelsChange = () => {
    if (labelsEnabled()) { requestLoading(); schedule(); } else { hoveredIndex = null; hideAll(); }
    syncLoop();
  };
  document.body.addEventListener('objectsurfacelabelschange', onLabelsChange);
  function refresh() {
    if (destroyed) return;
    frames++;
    const projection = view?.projection;
    const range = zoomRange();
    zoomGate = passesZoomGate(view?.zoom, range.minimum, range.maximum, plan.policy);
    // Each name carries its own discovery tier; names whose tier lies beyond the current zoom share wait for the camera.
    const currentShare = view?.zoom === undefined ? 0 : zoomShare(view.zoom, range.minimum, range.maximum);
    // The selected feature stays labelled at any zoom; the density gate applies to the rest.
    if (!labelsEnabled() || load.kind !== 'loaded' || !enabled || !projection || (!zoomGate && pinnedIndex === null) || (view !== null && view.levelOfDetail.stage !== 'geometry')) { hideAll(); return; }
    requirePhysicalProjection(projection);
    // Retained mesh ancestors use zero transform origins; their current matrices
    // carry the body spin exactly as painted. Camera transforms are already in
    // the published eye matrix, so the chain stops at the scene root.
    local = readLocal();
    matrix = new windowTarget!.DOMMatrix(Array.from(projection.eyeFromScene)).multiply(local).toFloat64Array();
    const width = host.clientWidth, height = host.clientHeight;
    const projectedEntries: { index: number; kind: PreparedSurfaceFeature['kind']; projected: NonNullable<ReturnType<typeof projectSurfaceFeature>> }[] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!, feature = entry.feature;
      // A search-only name labels the map only while it is the selected feature.
      if (!feature || ((!zoomGate || feature.searchOnly || feature.minimumZoomShare > currentShare + 1e-6) && index !== pinnedIndex)) continue;
      const projected = projectSurfaceFeature(feature, matrix, projection.focalPixels, projection.principalOffsetPixels);
      if (!projected) continue;
      entry.x = projected.x; entry.y = projected.y;
      projectedEntries.push({ index, kind: feature.kind, projected });
    }
    // A name is measured when it first competes for a place, all in one read. Measuring every name of a body on
    // arrival forced a layout per batch across thousands of names that never reach the screen.
    for (const { index } of projectedEntries) {
      const entry = entries[index]!;
      if (entry.measured) continue;
      entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight; entry.measured = true;
    }
    const candidates: SurfaceLabelCandidate[] = projectedEntries.map(({ index, kind, projected }) =>
      ({ index, kind, projected, width: entries[index]!.width, height: entries[index]!.height }));
    // The label budget grows with the zoom: a whole body carries a third of the prepared maximum, the closest view all of it.
    const budget = { ...plan.policy, maximumVisible: Math.max(4, Math.round(plan.policy.maximumVisible * (0.3 + 0.7 * currentShare))) };
    const admitted = admitSurfaceFeatureLabels(candidates, budget, { width, height }, visible, occlusion.read(), pinnedIndex);
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
    const index = !labelsEnabled() ? null : pinnedIndex !== null && visible.has(pinnedIndex) ? pinnedIndex : hoveredIndex !== null && visible.has(hoveredIndex) ? hoveredIndex : null;
    if (index === null) {
      if (shownIndex !== null) { tooltip.hidden = true; delete tooltip.dataset.featureTooltipFor; delete root.dataset.featureOutlineFor; hideOutline(); shownIndex = null; }
      return;
    }
    const entry = entries[index]!, feature = entry.feature!;
    if (shownIndex !== index) {
      caption.show(feature);
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
  async function selectIndex(index: number, signal?: AbortSignal): Promise<{ completed: boolean }> {
    const feature = entries[index]?.feature;
    if (!feature || destroyed || signal?.aborted) return { completed: false };
    pinnedIndex = index;
    flight?.cancel(); flight = null;
    schedule();
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
    const minimumM = flightLimits().minimumDistanceM;
    // Never fly away from the surface: arrive at the framing distance or stay as close as the observer already is.
    const distanceM = Math.max(minimumM, Math.min(currentDistanceM, fitDistanceM));
    onFlight?.();
    const reducedMotion = typeof windowTarget!.matchMedia === 'function' && windowTarget!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flight = flyToSurfaceDirection(navigation, { directionWorld, distanceM, reducedMotion, signal, windowTarget: windowTarget! });
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
    if (load.kind === 'idle' || load.kind === 'held') rejectLoaded(new DOMException('Surface feature loading was cancelled.', 'AbortError'));
    controller.abort();
    flight?.cancel(); flight = null;
    if (pendingFrame !== null) windowTarget!.cancelAnimationFrame(pendingFrame);
    if (loopFrame !== null) windowTarget!.cancelAnimationFrame(loopFrame);
    if (load.kind === 'populating' && load.frame !== null) windowTarget!.cancelAnimationFrame(load.frame);
    fonts?.removeEventListener('loadingdone', measure);
    pickingHost.removeEventListener('objecthoverchange', onHover);
    document.body.removeEventListener('objectsurfacelabelschange', onLabelsChange);
    windowTarget!.removeEventListener('pointerdown', onPress, { capture: true });
    inputSurface.removeEventListener('wheel', onWheel);
    windowTarget!.removeEventListener('click', onSurfaceClick);
    windowTarget!.removeEventListener('keydown', onKey);
    entries.forEach((entry, index) => { entry.element.removeEventListener('click', activations[index]!); if (entry.hideTimer !== null) clearTimeout(entry.hideTimer); });
    picking.remove(root);
    fader.destroy();
    root.remove();
  }
  return Object.freeze({
    root, lensIds: plan.lensIds,
    publish(next: Parameters<SurfaceFeatureLayerRuntime['publish']>[0]) { if (destroyed) return; view = next; schedule(); },
    setLens({ id }: { readonly id: string | null }) { if (destroyed) return; enabled = id !== null && plan.lensIds.includes(id); schedule(); },
    setPlaying(value: boolean) {
      if (destroyed || playing === value) return;
      playing = value;
      syncLoop();
    },
    stats(): SurfaceFeatureLayerStats {
      return Object.freeze({ loaded: load.kind === 'loaded', count: plan.catalog.count + (plan.selection?.count ?? 0), visible: visible.size, eligible, enabled, playing, frames, error: load.kind === 'failed' ? load.error : null, zoomGate, outlinePieces, flying: flight !== null,
        hovered: hoveredIndex === null ? null : entries[hoveredIndex]!.feature?.id ?? null, pinned: pinnedIndex === null ? null : entries[pinnedIndex]!.feature?.id ?? null });
    },
    inspect() {
      return Object.freeze({ labels: Object.freeze(Object.fromEntries(entries.filter(entry => entry.feature).map(entry => [entry.feature!.id, entry.element]))), tooltip, outline: Object.freeze([...outline]), rects });
    },
    catalog: () => load.kind === 'populating' || load.kind === 'loaded' ? load.catalog : null,
    loaded: () => { startLoading(); return loadedCatalog; },
    setNavigationInFlight(active: boolean, landed = true) {
      navigationInFlight = active;
      if (active || load.kind !== 'held') return;
      // A replaced flight only passed this body: its held request is dropped.
      if (landed) startLoading(); else load = { kind: 'idle' };
    },
    async select(id: string, { signal }: { signal?: AbortSignal } = {}) {
      if (signal?.aborted) return { completed: false };
      startLoading(); await loadedCatalog;
      if (destroyed || signal?.aborted) return { completed: false };
      let index = entries.findIndex(entry => entry.feature?.id === id);
      if (index < 0) {
        const feature = await selectionFeature(id);
        if (!feature || destroyed || signal?.aborted) return { completed: false };
        const entry = createEntry();
        populateEntry(entry, feature);
        entry.width = entry.element.offsetWidth; entry.height = entry.element.offsetHeight; entry.measured = true;
        index = entries.length - 1;
      }
      return selectIndex(index, signal);
    },
    selected: () => pinnedIndex === null ? null : entries[pinnedIndex]!.feature?.id ?? null,
    clear: clearSelection,
    destroy,
  });
}
