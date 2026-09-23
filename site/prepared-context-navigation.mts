import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { createPreparedUniverse } from '../src/renderers/css/universe/prepared-universe-runtime.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import { presentWorldCamera } from '../src/renderers/css/dist/navigation.js';
import { readPreparedFocusSelection, withPreparedFocus } from './navigation-scope.mts';
import { acquirePreparedFocusTarget } from './prepared-focus-target.mts';
import type { PreparedFocusTarget } from './prepared-focus-target.mts';
import type { PreparedFocusPolicy, PreparedFocusPresentation } from './prepared-focus.mts';

type PreparedContextLayer = Pick<ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>, 'resolveGalaxy' | 'ensureGalaxyCatalog' | 'focusBank' | 'selectGalaxy'>;
export interface FocusCallbacks {
  onFocusChange?(url: string): void;
  canPublish(): boolean;
  onFocusContentChange?(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null): void;
}
export interface FocusOperation {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  readonly frame: boolean;
  readonly reducedMotion: boolean;
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
  let selected: string | null = null;
  let canPublish = () => false;
  let notify: NonNullable<FocusCallbacks['onFocusChange']> = () => {};
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
    notify(url.href);
  };
  const clearSavedCameraUrl = () => {
    const url = new URL(windowTarget.location.href);
    if (!url.searchParams.has('v')) return;
    url.searchParams.delete('v');
    notify(url.href);
  };
  const publishContent = () => {
    const active = target, state = active?.datasets;
    const controls = active && state ? { ...state,
      selectLens(lens: string) {
        if (canPublish() && target === active && navigation?.preparedFocus?.()?.id === active.id && selected === active.id) active.selectLens(lens);
      },
    } : null;
    notifyContent(active?.record ?? null, active?.citations ?? [], controls);
  };
  const publishLens = () => {
    if (!canPublish() || !selected || target?.id !== selected) return;
    publishContent();
    writeSelectionUrl(selected);
  };
  const publishSelection = (force = false) => {
    if (!navigation) return;
    const focus = navigation.preparedFocus?.() ?? null, next = focus?.id ?? null;
    layer.selectGalaxy(next, focus);
    if (!force && next === selected) return;
    selected = next; useTarget(next);
    publishContent();
    writeSelectionUrl(next);
  };
  /** The application request/session owns cancellation; this executor owns only the prepared target. */
  function apply(url: string | URL, operation: FocusOperation): void | Promise<void> {
    const owner = navigation;
    const current = () => navigation === owner && !operation.signal.aborted && operation.isCurrent();
    if (!owner || !current()) return;
    const query = new URL(url, windowTarget.location.href).searchParams;
    const recover = (error: unknown): never => {
      if (current()) {
        const focus = owner.preparedFocus();
        selected = focus?.id ?? null;
        layer.selectGalaxy(selected, focus); useTarget(selected); publishContent();
      }
      throw error;
    };
    let selection: ReturnType<typeof readPreparedFocusSelection>;
    try { selection = readPreparedFocusSelection(query); } catch (error) { return recover(error); }
    const activate = () => {
      if (!current()) return;
      const focus = target?.focus ?? null;
      if (!operation.frame) {
        const id = selection?.id ?? null, state = target?.datasets;
        const lens = target?.resolveLens(selection?.lens ?? null);
        owner.setPreparedFocus(focus);
        if (lens !== undefined) target!.selectLens(lens);
        selected = id; layer.selectGalaxy(id, focus); publishContent();
        if (!id || (state && !query.has('focusLens'))) writeSelectionUrl(id);
        // Preserve an incoming composition while it still contains its named focus.
        if (!focus || (query.has('v') && savedCameraShowsFocus(owner, focus))) return;
        if (query.has('v')) clearSavedCameraUrl();
      }
      if (!focus) return;
      const flight = owner.flyToPreparedFocus(focus, { signal: operation.signal, reducedMotion: operation.reducedMotion });
      publishSelection(true);
      return flight.then(() => { if (current()) publishSelection(); });
    };
    const prepare = () => {
      if (!current()) return;
      const loading = useTarget(selection?.id ?? null)?.prepare({ preload: operation.frame });
      return loading ? loading.then(activate) : activate();
    };
    try {
      const pending = selection && !layer.resolveGalaxy(selection.id) ? layer.ensureGalaxyCatalog().then(prepare) : prepare();
      return pending?.catch(recover);
    } catch (error) { return recover(error); }
  }

  return Object.freeze({
    connect(owner: ObjectWorldNavigation, { onFocusChange = () => {}, canPublish: available, onFocusContentChange = () => {} }: FocusCallbacks) {
      unsubscribe?.(); useTarget(null); selected = null;
      navigation = owner; notify = onFocusChange; canPublish = available; notifyContent = onFocusContentChange;
      unsubscribe = owner.subscribe(() => { if (canPublish()) publishSelection(); });
      return () => {
        if (navigation !== owner) return;
        unsubscribe?.(); unsubscribe = null; useTarget(null); navigation = null; canPublish = () => false;
      };
    },
    apply,
    destroy() { unsubscribe?.(); unsubscribe = null; useTarget(null); navigation = null; canPublish = () => false; },
  });
}
