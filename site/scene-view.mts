import { formatSharedView } from '../src/renderers/css/dist/navigation.js';
import { errorMessage, type BrowserWindow } from './browser-types.mts';
import { withDataset } from './dataset-url.mts';
import type { createNavigationHistory, NavigationOptions } from './navigation-history.mts';
import { replaceNavigationUrl } from './navigation-history.mts';
import type { NavigationLifecycle, NavigationRequest } from './navigation-lifecycle.mts';
import type { SceneSession, SceneSessions } from './scene-session.mts';
import type { WorldContextMount } from './scene-world.mts';
import { bindViewUrl } from './view-url-runtime.mts';

interface SceneViewOptions {
  windowTarget: BrowserWindow;
  scenes: SceneSessions;
  requests: NavigationLifecycle;
  listenToPopState: boolean;
  getHistory(): ReturnType<typeof createNavigationHistory> | null;
  getWorld(): WorldContextMount | null;
  getMotion(): boolean;
  setMotion(enabled: boolean): void;
  onError(error: unknown): void;
}
export type SceneView = ReturnType<typeof createSceneView>;

/** Installs session-owned URL writers and commits only the request that still owns navigation. */
export function createSceneView({ windowTarget, scenes, requests, listenToPopState, getHistory, getWorld,
  getMotion, setMotion, onError }: SceneViewOptions) {
  function capture() {
    if (!windowTarget.location?.href) return null;
    const url = new URL(scenes.current?.url ?? windowTarget.location.href);
    const session = scenes.current;
    const saved = session?.viewUrl ? null : session?.mount?.sharedView?.capture(getMotion());
    const token = session?.viewUrl?.capture() ?? (saved ? new URLSearchParams(formatSharedView(saved)).get('v') : null);
    if (token) url.searchParams.set('v', token);
    return url.pathname + url.search + url.hash;
  }

  function publish(session: SceneSession, url: string) {
    session.url = url;
    const history = getHistory();
    if (history) history.commit(url, { history: 'replace' });
    else replaceNavigationUrl(windowTarget, url);
  }

  function replace(session: SceneSession, url: string) {
    if (scenes.isCurrent(session)) publish(session, url);
  }

  function commit(request: NavigationRequest, session: SceneSession, options: NavigationOptions = request.options) {
    return requests.commit(request, () => {
      session.url = request.url;
      getHistory()?.commit(request.url, options);
    });
  }

  function syncDataset(session: SceneSession) {
    const datasets = session.mount?.datasets;
    if (!datasets || !session.url || !scenes.isCurrent(session)) return;
    const id = datasets.current();
    if (id === null) return;
    const url = withDataset(new URL(capture() ?? session.url, windowTarget.location.href), id === datasets.defaultId ? null : id);
    replace(session, url.href);
    session.shell?.setDatasetNotice?.(null);
  }

  function install(session: SceneSession, initial: boolean) {
    const view = session.mount?.sharedView;
    if (!view) return null;
    const owner = bindViewUrl({ windowTarget, view, listenToPopState, getMotion,
      // The installed owner may flush once during disposal, after the session
      // stops accepting focus changes and before its bindings are destroyed.
      replace: url => { if (session.viewUrl === owner) publish(session, url); },
      restoreFocus: url => {
        if (scenes.isCurrent(session)) return getWorld()?.restoreFocus?.(url);
      },
      setMotion(next) {
        session.shell?.setMotionEnabled?.(next);
        if (initial && !scenes.isCurrent(session)) return;
        setMotion(next);
        if (initial) session.viewUrl?.schedule();
      },
      onError: initial ? error => console.warn(errorMessage(error)) : onError,
    });
    session.setViewUrl(owner);
    return owner;
  }

  async function bindInitial(session: SceneSession, { restore = true } = {}) {
    if (session.mount?.sharedView && windowTarget.location?.href) {
      const owner = install(session, true)!;
      if (restore) await session.wait(owner.restore());
      if (!scenes.isCurrent(session)) return;
    }
    if (!restore || !session.mount?.sharedView) await getWorld()?.restoreFocus?.(session.url ?? windowTarget.location.href);
  }

  async function bind(session: SceneSession, { restore = true, request }: { restore?: boolean; request?: NavigationRequest } = {}) {
    if ((request && !requests.owns(request)) || !scenes.isCurrent(session) || !session.mount?.sharedView || !windowTarget.location?.href || !session.url) return;
    // A failed history restoration keeps its incoming URL for diagnosis.
    // The departed scene must not install a writer for that other route.
    if (new URL(session.url).pathname !== windowTarget.location.pathname) return;
    getWorld()?.suspendFocus?.();
    const owner = install(session, false)!;
    if (restore) await (request?.lifetime.wait ?? session.wait)(owner.restore());
    if (!restore && (!request || requests.owns(request)) && scenes.isCurrent(session)) await getWorld()?.restoreFocus?.(session.url);
  }

  return { capture, commit, replace, syncDataset, bindInitial, bind };
}
