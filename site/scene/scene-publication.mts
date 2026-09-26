import type { SceneSubject, SelectionTarget } from './scene-selection.mts';
import type { SceneState } from '../shell-contract-types.mts';
import type { SceneSessionState } from './scene-session.mts';
import type { NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import type { ObjectShell } from '../object-shell-types.mts';
import type { WorldContextMount } from './scene-world.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { automaticPlaybackPolicy } from '../runtime-policy.mts';
import { readObjectDiagnostics } from '@cssearth/renderer';
import { DIAGNOSTICS_ENABLED } from '../diagnostics-policy.mts';

interface ScenePublicationInput {
  state: SceneSessionState;
  pending: NavigationRequest | null;
  objectId: string;
  subject: SceneSubject;
  motionEnabled: boolean;
  reducedMotionActive: boolean;
  mountedObjectCount: number;
  playing: boolean;
  hasPresented: boolean;
}

/** One projection feeds playback, DOM state, and diagnostics without writing into scene ownership. */
export function createScenePublication({ stage, documentTarget, windowTarget, read, getShell, getWorld }: {
  stage: HTMLElement;
  documentTarget: Document;
  windowTarget: BrowserWindow;
  read(): ScenePublicationInput;
  getShell(): ObjectShell | null;
  getWorld(): WorldContextMount | null;
}) {
  let publishedBodyState = '';
  function readPublication() {
    const { state, mountedObjectCount, playing, pending, objectId, subject, motionEnabled, reducedMotionActive } = read();
    const sceneState: SceneState = state.kind === 'failed' ? 'error' : state.kind === 'disposed' ? 'destroyed' : state.kind;
    const selected: SelectionTarget = pending?.subject ?? subject;
    const playback = Object.freeze({ motionRequested: motionEnabled, ...automaticPlaybackPolicy({
      sceneState: pending ? 'loading' : sceneState, motionRequested: motionEnabled,
      documentHidden: documentTarget.hidden, reducedMotion: reducedMotionActive,
    }) });
    return { sceneState, playing, playback, scene: Object.freeze({
      activeObjectId: objectId,
      selectedObjectId: selected.kind === 'object' ? selected.objectId : selected.kind === 'focus' ? selected.id : null,
      overview: selected.kind === 'overview',
      error: state.kind === 'failed' ? state.error.message : null,
      lifecycle: sceneState === 'ready' ? (playing ? 'mounted' : 'paused') : sceneState,
      mountedObjectCount,
      ready: sceneState === 'ready' && pending === null,
    }) };
  }
  function readPlayback() { return readPublication().playback; }
  function readSceneState() { return readPublication().scene; }

  function setData(element: HTMLElement, key: string, value: string | null) {
    if (value === null) { if (key in element.dataset) delete element.dataset[key]; }
    else if (element.dataset[key] !== value) element.dataset[key] = value;
  }

  function publishSceneState() {
    const pending = read().pending;
    const inFlight = Boolean(pending && !(pending.scene === 'replace' && pending.camera.kind === 'preserve'));
    getWorld()?.setNavigationInFlight?.(inFlight);
    getShell()?.setNavigationInFlight?.(inFlight);
    const { scene: state, sceneState, playing, playback } = readPublication();
    const root = documentTarget.documentElement;
    const body = documentTarget.body;
    // Scene state is republished at every navigation step. Only changes are written: removing
    // and re-adding an unchanged body class restyled the whole document (2,745 elements).
    setData(root, "scenePresented", String(read().hasPresented));
    setData(root, "ready", sceneState === "loading" ? "loading" : sceneState === "ready" ? "true" : sceneState === "error" ? "error" : null);
    if (sceneState === 'ready' || sceneState === 'error') delete root.dataset.shellContext;
    const bodyState = `${sceneState}:${!playing}`;
    if (bodyState !== publishedBodyState) {
      body.classList.remove("loading", "ready", "paused", "error");
      if (sceneState === "loading") body.classList.add("loading");
      else if (sceneState === "ready") { body.classList.add("ready"); if (!playing) body.classList.add("paused"); }
      else if (sceneState === "error") body.classList.add("error");
      publishedBodyState = bodyState;
    }
    const busy = sceneState === "loading" ? "true" : "false";
    if (stage.ariaBusy !== busy) stage.ariaBusy = busy;
    setData(root, "playing", sceneState === "loading" || sceneState === "ready" ? String(playing) : null);
    getShell()?.setPlaybackState?.(playback);
    if (DIAGNOSTICS_ENABLED) {
      Reflect.set(windowTarget, '__cssEarth', createSceneDiagnostics(windowTarget, state.activeObjectId, readSceneState, readPlayback));
    }
    return state;
  }

  return { state: readSceneState, playback: readPlayback, publish: publishSceneState };
}

function createSceneDiagnostics(windowTarget: Window, objectId: string,
  readSceneState: ReturnType<typeof createScenePublication>['state'],
  readPlayback: ReturnType<typeof createScenePublication>['playback']) {
  return Object.freeze({
    object: (id: string = objectId) => readObjectDiagnostics(windowTarget, id),
    activeObjectId: objectId,
    get selectedObjectId() { return readSceneState().selectedObjectId; },
    get overview() { return readSceneState().overview; },
    get mountedObjectCount() { return readSceneState().mountedObjectCount; },
    get ready() { return readSceneState().ready; },
    get error() { return readSceneState().error; },
    get lifecycle() { return readSceneState().lifecycle; },
    get playback() { return readPlayback(); },
  });
}
export type SceneDiagnostics = ReturnType<typeof createSceneDiagnostics>;
