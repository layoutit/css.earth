import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { createPreparedUniverse } from '../src/renderers/css/universe/prepared-universe-runtime.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import { presentWorldCamera } from '../src/renderers/css/dist/navigation.js';
import { record } from './browser-types.mts';
import { withPreparedFocus } from './navigation-scope.mts';
import { acquirePreparedFocusTarget } from './prepared-focus-target.mts';
import type { PreparedFocusTarget, PreparedFocusPolicy } from './prepared-focus-target.mts';
import type { PreparedFocusDatasets } from '../src/renderers/css/universe/prepared-focus-bank.js';

type PreparedContextLayer = Pick<ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>, 'resolveGalaxy' | 'focusBank' | 'selectGalaxy'>;
export type PreparedFocusPresentation = PreparedFocusDatasets & {
  selectLens(lensId: string): void;
};
export interface FocusCallbacks {
  onFocusChange?(url: string): void;
  onFlightStart?(): void;
  onFocusContentChange?(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null): void;
}
interface ContextNavigationOptions {
  layer: PreparedContextLayer;
  presentation: PreparedFocusPolicy;
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
  let unsubscribe: (() => void) | null = null;
  let target: PreparedFocusTarget | null = null;
  let selected: string | null = null, ready = false, flight: AbortController | null = null;
  let notify: NonNullable<FocusCallbacks['onFocusChange']> = () => {};
  let beforeFlight: NonNullable<FocusCallbacks['onFlightStart']> = () => {};
  let notifyContent: NonNullable<FocusCallbacks['onFocusContentChange']> = () => {};
  const currentSources = () => typeof sources === 'function' ? sources() : sources;
  const useTarget = (id: string | null) => {
    if (id === (target?.id ?? null)) return target;
    const next = id ? acquirePreparedFocusTarget(id, { layer, policy: presentation, sources: currentSources, unavailableObjectIds,
      onChange: () => { if (target?.id === id) publishLens(); }, onError }) : null;
    const previous = target;
    target = next;
    previous?.release();
    return target;
  };
  const writeSelectionUrl = (id: string | null) => {
    const url = withPreparedFocus(new URL(windowTarget.location.href), id, target?.datasets?.selectedLens ?? null);
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
  const publishContent = () => {
    const active = target, state = active?.datasets;
    const controls = active && state ? { ...state,
      selectLens(lens: string) {
        if (ready && target === active && navigation?.preparedFocus?.()?.id === active.id && selected === active.id) active.selectLens(lens);
      },
    } : null;
    notifyContent(active?.record ?? null, active?.citations ?? [], controls);
  };
  const publishLens = () => {
    if (!ready || !selected || target?.id !== selected) return;
    publishContent();
    writeSelectionUrl(selected);
  };
  const publishSelection = () => {
    if (!ready || !navigation) return;
    const focus = navigation.preparedFocus?.() ?? null, next = focus?.id ?? null;
    layer.selectGalaxy(next, focus);
    if (next === selected) return;
    selected = next; useTarget(next);
    publishContent();
    writeSelectionUrl(next);
  };
  return Object.freeze({
    connect(owner: ObjectWorldNavigation, { onFocusChange = () => {}, onFlightStart = () => {}, onFocusContentChange = () => {} }: FocusCallbacks = {}) {
      unsubscribe?.(); useTarget(null); flight?.abort();
      navigation = owner; ready = false; notify = onFocusChange; beforeFlight = onFlightStart; notifyContent = onFocusContentChange;
      unsubscribe = owner.subscribe(publishSelection);
      return () => {
        if (navigation !== owner) return;
        unsubscribe?.(); unsubscribe = null; useTarget(null);
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
        layer.selectGalaxy(selected, owner.preparedFocus?.() ?? null); useTarget(selected);
        publishContent();
        onError(error);
      };
      const apply = () => {
        if (!current()) return;
        const id = query.get('focus'), focus = target?.focus ?? null, state = target?.datasets;
        const lens = target?.resolveLens(query.get('focusLens'));
        owner.setPreparedFocus!(focus);
        if (lens !== undefined) target!.selectLens(lens);
        selected = id; layer.selectGalaxy(id, focus);
        publishContent();
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
        const loading = useTarget(query.get('focus'))?.prepare();
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
        const destination = useTarget(object.id)!;
        const loading = destination.prepare({ preload: true });
        if (loading) await loading;
        if (!current()) return;
        const focus = destination.focus;
        beforeFlight();
        if (!current()) return;
        ready = true;
        await owner.flyToPreparedFocus(focus, { signal: controller.signal,
          reducedMotion: windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true });
        if (current()) publishSelection();
      } catch (error) {
        if (current()) {
          useTarget(owner.preparedFocus?.()?.id ?? null);
          if (!record(error) || error.name !== 'AbortError') onError(error);
        }
      } finally { if (current()) { ready = true; flight = null; } }
    },
    destroy() { ready = false; flight?.abort(); unsubscribe?.(); useTarget(null); navigation = null; },
  });
}
