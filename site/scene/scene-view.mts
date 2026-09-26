import { formatSharedView, parseSharedView } from '@cssearth/renderer/navigation';
import type { BrowserWindow } from '../browser-types.mts';
import { withDataset } from '../dataset-url.mts';
import type { createNavigationHistory } from '../navigation/navigation-history.mts';
import { replaceNavigationUrl } from '../navigation/navigation-history.mts';
import type { NavigationLifecycle, NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import type { SceneSession, SceneSessions } from './scene-session.mts';
import type { WorldContextMount } from './scene-world.mts';
import { bindViewUrl } from '../view-url-runtime.mts';

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
    const url = new URL(href ?? scenes.current?.url ?? windowTarget.location.href, windowTarget.location.href);
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

  function commit(request: NavigationRequest, session: SceneSession) {
    return requests.commit(request, () => {
      session.url = request.url;
      getHistory()?.commit(request.url, request.history);
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

  function applyFocus(session: SceneSession, url: string, request?: NavigationRequest, frame = false) {
    const binding = session.viewUrl;
    const isCurrent = () => scenes.isCurrent(session) && session.viewUrl === binding && (request ? requests.owns(request) : !requests.current);
    if (!isCurrent()) return;
    const world = getWorld();
    if (!world) return;
    return world.applyFocus(url, {
      signal: request ? AbortSignal.any([session.signal, request.signal]) : session.signal,
      isCurrent, frame, reducedMotion: !frame || windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    });
  }

  /** One arrival path for initial mounts, replacement scenes, retained scenes and recovery. */
  async function arrive(session: SceneSession, { request, interrupted = false }: {
    request?: NavigationRequest; interrupted?: boolean;
  } = {}) {
    const owns = () => scenes.isCurrent(session) && (request ? requests.owns(request) : !requests.current);
    if (!owns()) return false;
    if (request) {
      if (!requests.advance(request, 'committing')) return false;
      // Saved history and explicit focus publish before flight. Their native
      // focus/lens result may already have updated the committed URL.
      if (request.scene === 'replace' || (request.camera.kind !== 'restore' && request.camera.kind !== 'focus')) {
        if (!commit(request, session)) return false;
      }
    }
    const href = session.url ?? windowTarget.location?.href;
    if (!href || !windowTarget.location?.href) return true;
    // A failed history restoration keeps its incoming URL for diagnosis.
    // The departed scene must not install a writer for that other route.
    if (new URL(href).pathname !== windowTarget.location.pathname) return true;
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
    // An explicit focus request has already flown and published its native result.
    if (request?.camera.kind !== 'focus') {
      try {
        const focused = await wait(applyFocus(session, href, request));
        if (focused.cancelled || !current()) return false;
      } catch (error) {
        if (!restore) throw error;
        if (current()) onError(error);
      }
    }
    if (!current()) return false;
    owner?.start(incoming);
    return true;
  }

  return { capture, commit, replace, syncDataset, arrive,
    focus: (session: SceneSession, request: NavigationRequest) => applyFocus(session, request.url, request, true) };
}
