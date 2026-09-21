import { isPreparedCluster, isPreparedNebula, resolveSpatialCitation } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { createPreparedUniverse } from '../src/renderers/css/universe/prepared-universe-runtime.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import { record } from './browser-types.mts';

type PreparedContextLayer = ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>;
type VolumeLensState = NonNullable<ReturnType<PreparedContextLayer['volumeLensState']>>;
export type PreparedFocusPresentation = VolumeLensState & {
  selectLens(lensId: string): void;
  setStarsVisible?(enabled: boolean): void;
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
    const url = new URL(windowTarget.location.href), state = lensState(id);
    if (id) url.searchParams.set('focus', id); else url.searchParams.delete('focus');
    if (state) url.searchParams.set('focusLens', state.selectedLens); else url.searchParams.delete('focusLens');
    if (url.href === windowTarget.location.href) return;
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
      ...(!layer.imageLayerFrames?.[state?.objectId ?? ''] && layer.setVolumeStarsVisible ? { setStarsVisible(enabled: boolean) {
        if (!canSelect()) return;
        layer.setVolumeStarsVisible(state.objectId, enabled);
        if (!unsubscribeLens) publishLens();
      } } : {}),
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
    const next = navigation.preparedFocus?.()?.id ?? null;
    layer.selectGalaxy(next);
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
      if (!navigation?.setPreparedFocus) return;
      ready = false;
      const query = new URL(url, windowTarget.location.href).searchParams;
      try {
        if (query.getAll('focus').length > 1) throw new TypeError('A saved view may have only one prepared focus.');
        if (query.getAll('focusLens').length > 1) throw new TypeError('A saved view may have only one prepared focus lens.');
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
        navigation.setPreparedFocus(focus);
        if (!unavailable && lensId !== undefined && selectableVolumeId) layer.selectVolumeLens(selectableVolumeId, lensId);
        selected = id; layer.selectGalaxy(id); observeLens(id);
        publishContent(id);
        if (!id || (state && !query.has('focusLens'))) writeSelectionUrl(id);
        // A focus-only link is a destination. Saved camera links retain their
        // exact observer pose; changing the pivot alone must not reframe them.
        if (focus && !query.has('v')) {
          flight?.abort();
          const controller = new AbortController(); flight = controller;
          beforeFlight();
          void navigation.flyToPreparedFocus(focus, { signal: controller.signal, reducedMotion: true })
            .catch(error => { if (!controller.signal.aborted) onError(error); })
            .finally(() => { if (flight === controller) flight = null; });
        }
      } catch (error) {
        selected = navigation.preparedFocus?.()?.id ?? null;
        layer.selectGalaxy(selected); observeLens(selected);
        publishContent(selected);
        onError(error);
      }
      finally { ready = true; }
    },
    async select(object: Pick<PreparedCatalogObject, 'id'>) {
      if (!navigation?.flyToPreparedFocus) return;
      flight?.abort(); const controller = new AbortController(); flight = controller;
      try {
        const focus = resolve(object.id);
        beforeFlight();
        ready = true;
        await navigation.flyToPreparedFocus(focus, { signal: controller.signal,
          reducedMotion: windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true });
        publishSelection();
      } catch (error) { if (!record(error) || error.name !== 'AbortError') onError(error); }
      finally { if (flight === controller) flight = null; }
    },
    destroy() { flight?.abort(); unsubscribe?.(); unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null; navigation = null; ready = false; },
  });
}
