import { requireSceneLifecycle } from "./scene-contract.mjs";
import { objectAdapter } from "./object-adapter.mjs";
import { mountPlanetShell } from "./planet-shell-client.mjs";
import { automaticPlaybackPolicy } from "./runtime-policy.mjs";
import { createSceneLifetime } from "../src/platform/scene-lifetime.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function createSceneRouter({
  stage,
  objectId,
  loadObject = objectAdapter.load,
  documentTarget = document,
  windowTarget = window,
  mountShell = mountPlanetShell,
  reportError = (error) => console.error(error),
}) {
  let active = null;
  let mountTask = null;
  let motionEnabled = false;
  let scenePaused = true;
  let sceneError = null;
  let sceneState = "loading";
  let destroyed = false;
  let nextGeneration = 0;
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = false;

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  mountTask = mountApplication();

  return Object.freeze({
    get settled() { return mountTask; },
    state: readSceneState,
    playback: readPlayback,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyActiveScene();
      windowTarget.removeEventListener("pagehide", destroyActiveScene);
      windowTarget.removeEventListener("pageshow", restoreCachedScene);
    },
  });

  async function mountApplication() {
    if (destroyed || active) return;
    const session = {
      generation: ++nextGeneration, lifetime: createSceneLifetime(),
      mount: null, shell: null, lastCommand: null,
    };
    active = session;
    sceneError = null;
    sceneState = "loading";
    scenePaused = true;
    try {
      documentTarget.addEventListener("visibilitychange", syncPlayback);
      session.lifetime.onDispose(() =>
        documentTarget.removeEventListener("visibilitychange", syncPlayback));
      reducedMotionActive = reducedMotion?.matches === true;
      reducedMotion?.addEventListener("change", syncReducedMotion);
      session.lifetime.onDispose(() =>
        reducedMotion?.removeEventListener("change", syncReducedMotion));
      publishSceneState();
      const requestMotion = (next) => {
        if (active !== session || session.lifetime.disposed) return;
        motionEnabled = next === true;
        syncPlayback();
      };
      const shell = mountShell({
        objectId, documentTarget, windowTarget, motionEnabled,
        onMotionChange: requestMotion,
      });
      session.shell = shell;
      for (const error of session.lifetime.onDispose(() => shell.destroy())) report(error);
      if (active !== session) return;
      publishSceneState();
      const loaded = await session.lifetime.wait(loadObject(objectId));
      if (loaded.cancelled || active !== session) return;
      // Keep the raw handle even if validation fails.
      let mount;
      mount = loaded.value(stage, {
        onMotionRequest: requestMotion,
        onError(error) {
          if (active === session && session.mount === mount) fail(session, error);
        },
      });
      session.mount = mount;
      for (const error of session.lifetime.onDispose(() => mount?.destroy?.())) report(error);
      // Observe even a malformed handle's ready promise before validation or
      // an initial pause can fail. Cleanup must not leave its rejection unowned.
      const ready = Promise.resolve(mount?.ready);
      ready.catch(() => {});
      requireSceneLifecycle(mount, objectId);
      if (active !== session) return;
      syncPlayback();
      const result = await session.lifetime.wait(ready);
      if (result.cancelled || active !== session) return;
      if (mount.destinations) shell.setDestinations?.({
        ...mount.destinations,
        async select(place) {
          shell.setMotionEnabled?.(false);
          return mount.destinations.select(place);
        },
      });
      sceneState = "ready";
      syncPlayback();
    } catch (error) {
      if (active === session) fail(session, error);
    }
  }

  function readPlayback() {
    return Object.freeze({
      motionRequested: motionEnabled,
      ...automaticPlaybackPolicy({
        sceneState, motionRequested: motionEnabled,
        documentHidden: documentTarget.hidden,
        reducedMotion: reducedMotionActive,
      }),
    });
  }

  function readSceneState() {
    return Object.freeze({
      activeObjectId: objectId,
      error: sceneError instanceof Error ? sceneError.message : null,
      lifecycle: sceneState === "ready" ? (scenePaused ? "paused" : "mounted") : sceneState,
      mountedObjectCount: active?.mount ? 1 : 0,
      ready: sceneState === "ready",
    });
  }

  function syncReducedMotion() {
    // Reading MediaQueryList.matches can update Chrome's change baseline.
    // Sample at notification boundaries, never from diagnostic getters.
    reducedMotionActive = reducedMotion?.matches === true;
    syncPlayback();
  }

  function syncPlayback() {
    const session = active;
    if (!session || session.lifetime.disposed) return;
    try {
      const { allowed } = readPlayback();
      if (session.mount && session.lastCommand !== allowed) {
        if (allowed) session.mount.resume();
        else session.mount.pause();
        if (active !== session) return;
        session.lastCommand = allowed;
      }
      scenePaused = !allowed;
      publishSceneState();
    } catch (error) { fail(session, error); }
  }

  function publishSceneState() {
    const state = readSceneState();
    const root = documentTarget.documentElement;
    const body = documentTarget.body;
    body.classList.remove("loading", "ready", "paused", "error");
    if (sceneState === "loading") {
      root.dataset.ready = "loading";
      body.classList.add("loading");
      stage.ariaBusy = "true";
    } else if (sceneState === "ready") {
      root.dataset.ready = "true";
      body.classList.add("ready");
      if (scenePaused) body.classList.add("paused");
      stage.ariaBusy = "false";
    } else {
      if (sceneState === "error") {
        root.dataset.ready = "error";
        body.classList.add("error");
      } else delete root.dataset.ready;
      stage.ariaBusy = "false";
    }
    if (sceneState === "loading" || sceneState === "ready") {
      root.dataset.playing = String(sceneState === "ready" && !scenePaused);
    } else delete root.dataset.playing;
    active?.shell?.setPlaybackState?.(readPlayback());
    if (DEVELOPMENT_DIAGNOSTICS) {
      windowTarget.__cssEarth = Object.freeze({
        activeObjectId: objectId,
        get mountedObjectCount() { return readSceneState().mountedObjectCount; },
        get ready() { return readSceneState().ready; },
        get error() { return readSceneState().error; },
        get lifecycle() { return readSceneState().lifecycle; },
        get playback() { return readPlayback(); },
      });
    }
    return state;
  }

  function retire(session, error = null) {
    if (active !== session) return;
    // Detach and invalidate before any user cleanup or native wait can finish.
    active = null;
    scenePaused = true;
    sceneError = error;
    sceneState = error ? "error" : "destroyed";
    const cleanupErrors = session.lifetime.destroy();
    publishSceneState();
    for (const failure of cleanupErrors) report(failure);
  }

  function report(error) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function fail(session, error) {
    if (active !== session) return;
    try { retire(session, error instanceof Error ? error : new Error(String(error))); }
    catch (failure) { report(failure); }
    report(error);
  }
  function destroyActiveScene() {
    if (active) {
      try { retire(active); } catch (error) { report(error); }
    }
  }
  function restoreCachedScene(event) {
    if (event.persisted && !active && !destroyed) mountTask = mountApplication();
  }
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".planet-stage");
  if (!(stage instanceof HTMLElement)) throw new Error("Missing cssEarth planet stage.");
  createSceneRouter({ stage, objectId: stage.dataset.objectId });
}
