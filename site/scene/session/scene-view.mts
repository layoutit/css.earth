import { formatSharedView, parseSharedView } from '@cssearth/renderer/navigation';
import type { BrowserWindow } from '../../browser/browser-types.mts';
import { withSceneDataset } from '../../model/dataset-url.mts';
import type { createNavigationHistory } from '../../navigation/navigation-history.mts';
import { replaceNavigationUrl, navigationHref } from '../../navigation/navigation-history.mts';
import type { NavigationLifecycle, NavigationRequest } from '../../navigation/navigation-lifecycle.mts';
import type { SceneSession, SceneSessions } from './scene-session.mts';
import type { WorldContextMount } from './scene-world.mts';
import { bindViewUrl } from '../../navigation/view-url-runtime.mts';

interface SceneViewOptions {
  windowTarget: BrowserWindow;
  scenes: SceneSessions;
  requests: NavigationLifecycle;
  getHistory(): ReturnType<typeof createNavigationHistory> | null;
  getWorld(): WorldContextMount | null;
  getMotion(): boolean;
  setMotion(enabled: boolean): void;
  onError(error: unknown): void;
}
export type SceneView = ReturnType<typeof createSceneView>;

/** Installs session-owned URL writers and commits only the request that still owns navigation. */
export function createSceneView({ windowTarget, scenes, requests, getHistory, getWorld,
  getMotion, setMotion, onError }: SceneViewOptions) {
  function capture(href?: string) {
    if (!windowTarget.location?.href) return null;
    const url = new URL(href ?? scenes.current?.url ?? navigationHref(windowTarget), navigationHref(windowTarget));
    const session = scenes.current;
    const saved = session?.viewUrl ? null : session?.mount?.sharedView?.capture(getMotion());
    const token = session?.viewUrl?.capture() ?? (saved ? new URLSearchParams(formatSharedView(saved)).get('v') : null);
    if (token) url.searchParams.set('v', token); else if (href) url.searchParams.delete('v');
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

  // The requests whose entry was written at their hand-over: landing, they keep that entry.
  const ahead = new WeakSet<NavigationRequest>();
  /** Writes a flight's entry at its hand-over, before its scene mounts (navigation-history.mts). */
  function commitAhead(request: NavigationRequest) {
    const history = getHistory();
    if (!history || request.history.history !== 'push' || ahead.has(request)) return;
    ahead.add(request);
    history.commit(request.url, request.history, true);
  }

  function commit(request: NavigationRequest, session: SceneSession) {
    return requests.commit(request, () => {
      session.url = request.url;
      getHistory()?.commit(request.url, ahead.has(request) ? { history: 'replace' } : request.history);
    });
  }

  function syncDataset(session: SceneSession) {
    const datasets = session.mount?.datasets;
    if (!datasets || !session.url || !scenes.isCurrent(session)) return;
    const id = datasets.current();
    if (id === null) return;
    const url = withSceneDataset(new URL(capture() ?? session.url, navigationHref(windowTarget)), session.objectId, id === datasets.defaultId ? null : id);
    replace(session, url.href);
    session.shell?.setDatasetNotice?.(null);
  }

  /** One arrival path for initial mounts, replacement scenes, retained scenes and recovery. */
  async function arrive(session: SceneSession, { request, interrupted = false }: {
    request?: NavigationRequest; interrupted?: boolean;
  } = {}) {
    const owns = () => scenes.isCurrent(session) && (request ? requests.owns(request) : !requests.current);
    if (!owns()) return false;
    if (request) {
      if (!requests.advance(request, 'committing')) return false;
      // Saved history publishes before flight.
      if (request.scene === 'replace' || request.camera.kind !== 'restore') {
        if (!commit(request, session)) return false;
      }
    }
    const href = session.url ?? windowTarget.location?.href;
    if (!href || !windowTarget.location?.href) return true;
    // A failed history restoration keeps its incoming URL for diagnosis.
    // The departed scene must not install a writer for that other route.
    if (new URL(href).pathname !== new URL(navigationHref(windowTarget)).pathname) return true;
    const shared = session.mount?.sharedView;
    const restore = !interrupted && (!request || request.scene === 'replace' || request.camera.kind === 'restore');
    const owner = shared ? bindViewUrl({ windowTarget, view: shared, getMotion,
      // Disposal can flush after the session has stopped accepting changes.
      replace: url => { if (session.viewUrl === owner) publish(session, url); }, onError,
    }) : null;
    session.setViewUrl(owner);
    const current = () => owns() && session.viewUrl === owner;
    const wait = request?.lifetime.wait ?? session.wait;
    let incoming: string | null = null;
    if (restore && shared) {
      try {
        const query = new URL(href).searchParams;
        if (query.getAll('v').length > 1) throw new TypeError('This URL contains more than one saved view.');
        const token = query.get('v');
        const saved = token !== null ? parseSharedView(`v=${token}`) : null;
        if (saved) {
          const applied = await wait(shared.restore(saved));
          if (applied.cancelled || !current()) return false;
          if (applied.value) {
            incoming = token;
            setMotion(saved.playback.motionRequested);
          }
        }
      } catch (error) { if (current()) onError(error); }
    }
    if (!current()) return false;
    if (!current()) return false;
    owner?.start(incoming);
    return true;
  }

  return { capture, commit, commitAhead, wroteAhead: (request: NavigationRequest) => ahead.has(request), replace, syncDataset, arrive };
}
