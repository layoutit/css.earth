import { isPreparedCluster, isPreparedNebula, resolveSpatialCitation } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { createPreparedUniverse } from '../src/renderers/css/universe/prepared-universe-runtime.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import { presentWorldCamera } from '../src/renderers/css/dist/navigation.js';
import { record } from './browser-types.mts';
import { withPreparedFocus } from './navigation-scope.mts';

type PreparedContextLayer = ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>;
type VolumeLensState = NonNullable<ReturnType<PreparedContextLayer['volumeLensState']>>;
export type PreparedFocusPresentation = VolumeLensState & {
  selectLens(lensId: string): void;
};
export interface FocusCallbacks {
  onFocusChange?(url: string): void;
  onFlightStart?(): void;
  onFocusContentChange?(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null): void;
}
interface ContextNavigationOptions {
  layer: PreparedContextLayer;
  presentation: { metersPerParsec: number; defaultFocusRadiusM: number; minimumDistanceRadii: number; maximumDistanceM: number };
  sources?: readonly SpatialCatalogSource[] | (() => readonly SpatialCatalogSource[]);
  windowTarget: Window;
  onError?(error: unknown): void;
  unavailableObjectIds?: readonly string[];
}

/** A saved focus camera is authoritative only while its named subject still intersects the stage. */
function savedCameraShowsFocus(navigation: ObjectWorldNavigation, focus: PreparedNavigationFocus) {
  const optics = navigation.optics();
  const view = presentWorldCamera(navigation.capture(), { ...navigation.frame,
    originM: focus.positionM, bodyRadiusM: focus.framingRadiusM }, optics);
  // A camera inside a prepared volume can validly look away from its centre while the volume surrounds it.
  if (view.distanceM <= focus.framingRadiusM) return true;
  const ellipse = view.silhouette;
  if (!ellipse) return false;
  const width = optics.widthPixels ?? optics.framingRadiusPixels * 2;
  const height = optics.heightPixels ?? optics.framingRadiusPixels * 2;
  const rect = optics.visibleRect ?? { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
  // The ellipse can be rotated. Its largest semi-axis is a conservative intersection bound:
  // false means certainly off-screen, while an edge-on saved composition remains untouched.
  const radius = Math.max(ellipse.radialSemiAxis, ellipse.tangentialSemiAxis);
  const [x, y] = ellipse.centre;
  return x + radius >= rect.left && x - radius <= rect.right &&
    y + radius >= rect.top && y - radius <= rect.bottom;
}

/** Catalogue focus on the current detailed scene's shared camera owner. */
export function createPreparedContextNavigation({ layer, presentation, sources = [], windowTarget, onError = console.error, unavailableObjectIds = [] }: ContextNavigationOptions) {
  let navigation: ObjectWorldNavigation | null = null;
  let unsubscribe: (() => void) | null = null, unsubscribeLens: (() => void) | null = null;
  let lensObjectId: string | null = null, selected: string | null = null, ready = false, flight: AbortController | null = null;
  let notify: NonNullable<FocusCallbacks['onFocusChange']> = () => {};
  let beforeFlight: NonNullable<FocusCallbacks['onFlightStart']> = () => {};
  let notifyContent: NonNullable<FocusCallbacks['onFocusContentChange']> = () => {};
  const currentSources = () => typeof sources === 'function' ? sources() : sources;
  const lensState = (id: string | null) => {
    const object = id ? layer.resolveGalaxy(id) : null;
    const objectId = object && !isPreparedCluster(object) ? object.detailedObjectId : null;
    if (!objectId) return null;
    const volume = layer.volumeLensState?.(objectId);
    if (volume) return volume;
    return layer.imageLayerFrames?.[objectId] ? { objectId, id: 'optical', defaultLens: 'optical', selectedLens: 'optical', starsVisible: false,
      lenses: [{id:'optical', label:'Optical', title:'Visible-light observation', description:'Prepared image layers', sourceUrl:''}] } : null;
  };
  const writeSelectionUrl = (id: string | null) => {
    const url = withPreparedFocus(new URL(windowTarget.location.href), id, lensState(id)?.selectedLens ?? null);
    if (url.href === windowTarget.location.href) return;
    windowTarget.history.replaceState(windowTarget.history.state, '', url.pathname + url.search + url.hash);
    notify(url.href);
  };
  const clearSavedCameraUrl = () => {
    const url = new URL(windowTarget.location.href);
    if (!url.searchParams.has('v')) return;
    url.searchParams.delete('v');
    windowTarget.history.replaceState(windowTarget.history.state, '', url.pathname + url.search + url.hash);
    notify(url.href);
  };
  const publishContent = (id: string | null) => {
    const record = id ? layer.resolveGalaxy(id) : null;
    const references = record ? [record.skyPosition.sourceRef, record.distance.sourceRef, (isPreparedCluster(record) || isPreparedNebula(record) ? record.classification.sourceRef : record.membership.sourceRef)].filter((reference): reference is string => Boolean(reference)) : [];
    const state = lensState(id);
    const canSelect = () => ready && navigation?.preparedFocus?.()?.id === id && selected === id;
    const controls = state ? { ...state,
      selectLens(lensId: string) {
        if (!canSelect()) return;
        if (layer.imageLayerFrames?.[state.objectId]) {
          if (lensId !== 'optical') throw new TypeError('Unknown image-layer dataset.');
          return;
        }
        layer.selectVolumeLens(state.objectId, lensId);
        if (!unsubscribeLens) publishLens();
      },
    } : null;
    const citations = references.map(reference => {
      const citation = resolveSpatialCitation(reference, currentSources());
      if (!citation) throw new TypeError(`Unresolved prepared focus reference: ${reference}`);
      return citation;
    });
    notifyContent(record, [...new Map(citations.map(citation => [citation.id, citation])).values()], controls);
  };
  const publishLens = () => {
    if (!ready || !selected) return;
    publishContent(selected);
    writeSelectionUrl(selected);
  };
  const observeLens = (id: string | null) => {
    // Identity comes from the catalogue record and declared frames, not from lensState(id): a volume
    // lens bank's payload can still be loading, in which case lensState returns null even though the
    // object is exactly a bank whose subscription should kick off and then observe that load.
    const object = id ? layer.resolveGalaxy(id) : null;
    const candidateId = object && !isPreparedCluster(object) ? object.detailedObjectId ?? null : null;
    const objectId = candidateId && (layer.imageLayerFrames?.[candidateId] !== undefined || layer.volumeLensFrames?.[candidateId] !== undefined)
      ? candidateId : null;
    if (objectId === lensObjectId) return;
    unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = objectId;
    if (objectId && !layer.imageLayerFrames?.[objectId]) unsubscribeLens = layer.subscribeVolumeLens?.(objectId, publishLens) ?? null;
  };
  const prepareFocus = (id: string | null): Promise<void> | undefined => {
    const object = id ? layer.resolveGalaxy(id) : null;
    if (id && !object) throw new TypeError(`Unknown prepared galaxy focus: ${id}`);
    const objectId = object && !isPreparedCluster(object) ? object.detailedObjectId : undefined;
    if (!objectId || unavailableObjectIds.includes(objectId) || layer.imageLayerFrames?.[objectId] ||
        !layer.volumeLensFrames?.[objectId] || layer.volumeLensState(objectId)) return;
    // The subscription pins the bank while loading; otherwise warm-residency trimming could evict it
    // before the focus consumer reads its authored radius. Await the same load, including its errors.
    observeLens(id);
    return layer.ensureVolumeLens(objectId).then(() => {
      if (!layer.volumeLensState(objectId)) throw new TypeError(`Prepared volume lens bank did not become ready: ${objectId}`);
    });
  };
  const resolve = (id: string): PreparedNavigationFocus => {
    const object = layer.resolveGalaxy(id);
    if (!object) throw new TypeError(`Unknown prepared galaxy focus: ${id}`);
    const detailedObjectId = !isPreparedCluster(object) ? object.detailedObjectId : undefined;
    const volume = detailedObjectId ? layer.volumeLensFrames?.[detailedObjectId] : null;
    const frame = volume?.frame ?? (detailedObjectId ? layer.imageLayerFrames?.[detailedObjectId] : null);
    const radius = object.presentation?.focusRadiusM ?? (volume ? volume.framingRadiusUnits * volume.frame.metersPerUnit : frame
      ? Math.max(...frame.boundsUnits.max.map((value, axis) => Math.abs(value - frame.boundsUnits.min[axis]) / 2)) * frame.metersPerUnit
      : (!isPreparedCluster(object) && !isPreparedNebula(object) && object.halfLightRadius ? object.halfLightRadius.valuePc * presentation.metersPerParsec * 3 : presentation.defaultFocusRadiusM));
    return { id, positionM: object.positionM, framingRadiusM: radius,
      limits: { minimumDistanceM: radius * presentation.minimumDistanceRadii, maximumDistanceM: presentation.maximumDistanceM } };
  };
  const publishSelection = () => {
    if (!ready || !navigation) return;
    const focus = navigation.preparedFocus?.() ?? null, next = focus?.id ?? null;
    layer.selectGalaxy(next, focus);
    if (next === selected) return;
    selected = next; observeLens(next);
    publishContent(next);
    writeSelectionUrl(next);
  };
  return Object.freeze({
    connect(owner: ObjectWorldNavigation, { onFocusChange = () => {}, onFlightStart = () => {}, onFocusContentChange = () => {} }: FocusCallbacks = {}) {
      unsubscribe?.(); unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null; flight?.abort();
      navigation = owner; ready = false; notify = onFocusChange; beforeFlight = onFlightStart; notifyContent = onFocusContentChange;
      unsubscribe = owner.subscribe(publishSelection);
      return () => {
        if (navigation !== owner) return;
        unsubscribe?.(); unsubscribe = null; unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null;
        flight?.abort(); navigation = null; ready = false;
      };
    },
    suspend() { ready = false; flight?.abort(); },
    restore(url: string | URL) {
      const owner = navigation;
      if (!owner?.setPreparedFocus) return;
      flight?.abort(); const controller = new AbortController(); flight = controller;
      const current = () => navigation === owner && flight === controller && !controller.signal.aborted;
      ready = false;
      const query = new URL(url, windowTarget.location.href).searchParams;
      const finish = () => { if (current()) { ready = true; flight = null; } };
      const fail = (error: unknown) => {
        if (!current()) return;
        selected = owner.preparedFocus?.()?.id ?? null;
        layer.selectGalaxy(selected, owner.preparedFocus?.() ?? null); observeLens(selected);
        publishContent(selected);
        onError(error);
      };
      const apply = () => {
        if (!current()) return;
        const id = query.get('focus'), focus = id ? resolve(id) : null, state = lensState(id);
        const lensId = query.get('focusLens') ?? state?.defaultLens;
        const object = id ? layer.resolveGalaxy(id) : null;
        const detailedObjectId = object && !isPreparedCluster(object) ? object.detailedObjectId : undefined;
        const declaredVolume = detailedObjectId ? layer.volumeLensFrames?.[detailedObjectId] : undefined;
        const selectableVolumeId = declaredVolume && detailedObjectId ? detailedObjectId
          : state && !layer.imageLayerFrames?.[state.objectId] ? state.objectId : null;
        const unavailable = object && !isPreparedCluster(object) && object.detailedObjectId && unavailableObjectIds.includes(object.detailedObjectId);
        if (id && !unavailable && lensId !== undefined && state && !state.lenses.some(lens => lens.id === lensId)) {
          throw new TypeError(`Unknown prepared focus lens: ${lensId}`);
        }
        owner.setPreparedFocus!(focus);
        if (!unavailable && lensId !== undefined && selectableVolumeId) layer.selectVolumeLens(selectableVolumeId, lensId);
        selected = id; layer.selectGalaxy(id, focus); observeLens(id);
        publishContent(id);
        if (!id || (state && !query.has('focusLens'))) writeSelectionUrl(id);
        ready = true;
        // A focus-only link is a destination. A saved camera remains exact while it still shows
        // the named focus; a stale focus+camera pairing must not strand the user in empty space.
        const savedCameraIsCompatible = focus && query.has('v') ? savedCameraShowsFocus(owner, focus) : false;
        if (focus && (!query.has('v') || !savedCameraIsCompatible)) {
          if (query.has('v')) clearSavedCameraUrl();
          beforeFlight();
          if (current()) return owner.flyToPreparedFocus(focus, { signal: controller.signal, reducedMotion: true });
        }
      };
      try {
        if (query.getAll('focus').length > 1) throw new TypeError('A saved view may have only one prepared focus.');
        if (query.getAll('focusLens').length > 1) throw new TypeError('A saved view may have only one prepared focus lens.');
        const loading = prepareFocus(query.get('focus'));
        if (loading) return loading.then(apply).catch(fail).finally(finish);
        const flying = apply();
        if (flying) return flying.catch(fail).finally(finish);
      } catch (error) { fail(error); }
      finish();
    },
    async select(object: Pick<PreparedCatalogObject, 'id'>) {
      const owner = navigation;
      if (!owner?.flyToPreparedFocus) return;
      flight?.abort(); const controller = new AbortController(); flight = controller;
      const current = () => navigation === owner && flight === controller && !controller.signal.aborted;
      try {
        ready = false;
        const loading = prepareFocus(object.id);
        if (loading) await loading;
        if (!current()) return;
        const focus = resolve(object.id);
        beforeFlight();
        if (!current()) return;
        ready = true;
        await owner.flyToPreparedFocus(focus, { signal: controller.signal,
          reducedMotion: windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true });
        if (current()) publishSelection();
      } catch (error) {
        if (current()) {
          observeLens(owner.preparedFocus?.()?.id ?? null);
          if (!record(error) || error.name !== 'AbortError') onError(error);
        }
      } finally { if (current()) { ready = true; flight = null; } }
    },
    destroy() { flight?.abort(); unsubscribe?.(); unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null; navigation = null; ready = false; },
  });
}
