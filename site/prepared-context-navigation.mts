import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { createPreparedUniverse } from '@cssearth/renderer/universe/prepared-universe-runtime.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { PreparedNavigationFocus } from '@cssearth/renderer/navigation/prepared-focus.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation';
import { readPreparedFocusSelection } from './navigation/navigation-scope.mts';
import { acquirePreparedFocusTarget } from './prepared-focus-target.mts';
import type { PreparedFocusTarget } from './prepared-focus-target.mts';
import type { PreparedFocusPolicy, PreparedFocusPresentation } from './prepared-focus.mts';

type PreparedContextLayer = Pick<ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>, 'resolveGalaxy' | 'ensureGalaxyCatalog' | 'focusBank' | 'selectGalaxy'>;
export interface FocusPublication {
  record: PreparedCatalogObject | null;
  sources: readonly SpatialCitation[];
  presentation: PreparedFocusPresentation | null;
  url: 'preserve' | 'selection' | 'reframe';
}
export interface FocusCallbacks {
  readFocus(): string | null;
  onFocusChange(publication: FocusPublication): void;
  canPublish(): boolean;
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
  /** The detailed scene's camera owner this focus is connected to, with that scene's publication callbacks. */
  let connection: (FocusCallbacks & { readonly owner: ObjectWorldNavigation; unsubscribe(): void }) | null = null;
  let target: PreparedFocusTarget | null = null;
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
  /** The connected scene may publish this target: it can publish, and its camera and committed focus both name it. */
  const owns = (active: PreparedFocusTarget) => {
    const current = connection;
    return current !== null && current.canPublish() && current.owner.preparedFocus?.()?.id === active.id && current.readFocus() === active.id;
  };
  const publishContent = (url: FocusPublication['url'] = 'selection') => {
    const active = target, state = active?.datasets;
    const controls = active && state ? { ...state,
      selectLens(lens: string) { if (target === active && owns(active)) active.selectLens(lens); },
    } : null;
    connection?.onFocusChange({ record: active?.record ?? null, sources: active?.citations ?? [], presentation: controls, url });
  };
  const publishLens = () => { if (target && owns(target)) publishContent(); };
  const publishSelection = (force = false) => {
    const current = connection;
    if (!current) return;
    const focus = current.owner.preparedFocus?.() ?? null, next = focus?.id ?? null;
    layer.selectGalaxy(next, focus);
    if (!force && next === current.readFocus()) return;
    useTarget(next);
    publishContent();
  };
  const disconnect = () => {
    connection?.unsubscribe();
    useTarget(null);
    connection = null;
  };
  /** The application request/session owns cancellation; this executor owns only the prepared target. */
  function apply(url: string | URL, operation: FocusOperation): void | Promise<void> {
    const owner = connection?.owner ?? null;
    const current = () => connection?.owner === owner && !operation.signal.aborted && operation.isCurrent();
    if (!owner || !current()) return;
    const query = new URL(url, windowTarget.location.href).searchParams;
    const recover = (error: unknown): never => {
      if (current()) {
        const focus = owner.preparedFocus();
        const id = focus?.id ?? null;
        layer.selectGalaxy(id, focus); useTarget(id); publishContent('preserve');
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
        layer.selectGalaxy(id, focus);
        // Preserve an incoming composition while it still contains its named focus.
        const reframe = focus !== null && !(query.has('v') && savedCameraShowsFocus(owner, focus));
        publishContent(reframe && query.has('v') ? 'reframe'
          : !id || (state && !query.has('focusLens')) ? 'selection' : 'preserve');
        if (!reframe) return;
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
    connect(owner: ObjectWorldNavigation, { onFocusChange, canPublish, readFocus }: FocusCallbacks) {
      connection?.unsubscribe(); useTarget(null);
      const next = { owner, onFocusChange, canPublish, readFocus, unsubscribe() {} };
      connection = next;
      // A subscription may publish at once, so the connection is in place before it starts.
      next.unsubscribe = owner.subscribe(() => { if (canPublish()) publishSelection(); });
      // An older disconnect still releases a newer connection to the same owner, as before.
      return () => { if (connection?.owner === owner) disconnect(); };
    },
    apply,
    destroy: disconnect,
  });
}
