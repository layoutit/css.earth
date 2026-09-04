import { requireSceneLifecycle } from "./scene-contract.mjs";
import { objectAdapter } from "./object-adapter.mjs";
import { mountPlanetShell } from "./planet-shell-client.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function createSceneRouter({
  stage,
  objectId,
  loadObject = objectAdapter.load,
  documentTarget = document,
  windowTarget = window,
  mountShell = mountPlanetShell,
}) {
  let activeMount = null;
  let activeShell = null;
  let mountTask = null;
  let motionEnabled = false;
  let scenePaused = false;
  let sceneError = null;
  let sceneGeneration = 0;
  let sceneState = "loading";

  documentTarget.addEventListener("visibilitychange", syncVisibility);
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);

  mountTask = mountApplication();

  return Object.freeze({
    get settled() {
      return mountTask;
    },
    state: readSceneState,
  });

  async function mountApplication() {
    const generation = ++sceneGeneration;
    let mount = null;
    let shell = null;
    sceneError = null;
    sceneState = "loading";
    publishSceneState();

    try {
      if (activeMount || activeShell) {
        throw new Error("cssEarth attempted to mount more than one object.");
      }
      shell = mountShell({
        objectId,
        documentTarget,
        windowTarget,
        motionEnabled,
        onMotionChange: setMotionEnabled,
      });
      if (generation !== sceneGeneration) {
        shell.destroy();
        return;
      }
      activeShell = shell;
      const mountScene = await loadObject(objectId);
      if (generation !== sceneGeneration) {
        if (activeShell === shell) {
          shell.destroy();
          activeShell = null;
        }
        return;
      }
      mount = requireSceneLifecycle(mountScene(stage), objectId);
      if (generation !== sceneGeneration) {
        mount.destroy();
        return;
      }
      activeMount = mount;
      scenePaused = false;
      syncPlayback();
      await mount.ready;
      if (generation !== sceneGeneration || activeMount !== mount) return;
      sceneState = "ready";
      publishSceneState();
    } catch (error) {
      if (generation !== sceneGeneration) {
        mount?.destroy?.();
        return;
      }
      mount?.destroy?.();
      if (activeMount === mount) activeMount = null;
      shell?.destroy?.();
      if (activeShell === shell) activeShell = null;
      scenePaused = false;
      sceneError = error;
      sceneState = "error";
      publishSceneState();
      console.error(error);
    }
  }

  function readSceneState() {
    const lifecycle = sceneState === "ready" && scenePaused
      ? "paused"
      : sceneState === "ready"
        ? "mounted"
        : sceneState;
    return Object.freeze({
      activeObjectId: objectId,
      error: sceneError instanceof Error ? sceneError.message : null,
      lifecycle,
      mountedObjectCount: activeMount ? 1 : 0,
      ready: sceneState === "ready",
    });
  }

  function publishSceneState() {
    publishShellState();
    if (!DEVELOPMENT_DIAGNOSTICS) return;
    windowTarget.__cssEarth = Object.freeze({
      activeObjectId: objectId,
      get mountedObjectCount() {
        return activeMount ? 1 : 0;
      },
      get ready() {
        return sceneState === "ready";
      },
      get error() {
        return sceneError instanceof Error ? sceneError.message : null;
      },
      get lifecycle() {
        return readSceneState().lifecycle;
      },
    });
  }

  function publishShellState() {
    const lifecycle = readSceneState().lifecycle;
    const root = documentTarget.documentElement;
    const body = documentTarget.body;
    body.classList.remove("loading", "ready", "paused", "error");
    if (lifecycle === "loading") {
      root.dataset.ready = "loading";
      body.classList.add("loading");
      stage.ariaBusy = "true";
      return;
    }
    if (lifecycle === "mounted" || lifecycle === "paused") {
      root.dataset.ready = "true";
      body.classList.add("ready");
      if (lifecycle === "paused") body.classList.add("paused");
      stage.ariaBusy = "false";
      return;
    }
    if (lifecycle === "error") {
      root.dataset.ready = "error";
      body.classList.add("error");
      stage.ariaBusy = "false";
      return;
    }
    delete root.dataset.ready;
    stage.ariaBusy = "false";
  }

  function destroyActiveScene() {
    sceneGeneration += 1;
    activeShell?.destroy();
    activeShell = null;
    activeMount?.destroy();
    activeMount = null;
    scenePaused = false;
    sceneError = null;
    sceneState = "destroyed";
    publishSceneState();
  }

  function restoreCachedScene(event) {
    if (!event.persisted || activeMount || sceneState === "loading") return;
    mountTask = mountApplication();
  }

  function syncVisibility() {
    syncPlayback();
  }

  function setMotionEnabled(next) {
    motionEnabled = next === true;
    syncPlayback();
  }

  function syncPlayback() {
    if (!activeMount) return;
    const nextPaused = !motionEnabled || documentTarget.hidden;
    if (scenePaused === nextPaused) return;
    scenePaused = nextPaused;
    if (scenePaused) activeMount.pause();
    else activeMount.resume();
    publishSceneState();
  }
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".planet-stage");
  if (!(stage instanceof HTMLElement)) {
    throw new Error("Missing cssEarth planet stage.");
  }
  createSceneRouter({ stage, objectId: stage.dataset.objectId });
}
