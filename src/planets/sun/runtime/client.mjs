import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { PREPARED_SUN_LENSES } from "./preparedLenses.mjs";
import { PREPARED_SUN_SCENE } from "./preparedScene.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountSunClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Sun requires onError.");
  const lifetime = createSceneLifetime();
  const warmImages = new Set();
  lifetime.onDispose(() => {
    releaseImageGroup(warmImages);
  });
  const decodeWarm = (url, url2x) => decodeImage(url, url2x, warmImages);
  const inputSurface = document.querySelector(".sun-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Sun input surface is missing.");
  }
  let shouldPlay = false;
  let mounted = null;
  let orbitCamera = null;
  let lensControls = null;
  let speedControls = null;
  let sceneAnimations = Object.freeze([]);
  let ready;
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
    pause() {
      if (lifetime.disposed) return;
      shouldPlay = false;

      for (const animation of sceneAnimations) animation.pause();
    },
    resume() {
      if (lifetime.disposed) return;
      shouldPlay = true;
      if (!mounted) return;

      for (const animation of sceneAnimations) animation.play();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Sun cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      speedControls = createSunSpeedControls({ lifetime, onError });
      lensControls = createSunLensControls({ stage, lifetime, onError });
      await lifetime.wait(Promise.all([
        lensControls.prepare(PREPARED_SUN_LENSES.defaultLens),
        ...PREPARED_SUN_SCENE.starfield.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodeWarm(url, url2x),
          decodeWarm(highContrastUrl, highContrastUrl2x),
        ]),
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage, PREPARED_SUN_SCENE, lifetime);
      warmImages.clear();
      lensControls.bindRuntime(mounted);
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      speedControls.bindRuntime({ animations: sceneAnimations });
      for (const animation of sceneAnimations) {
        lifetime.onDispose(() => animation.cancel());
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      orbitCamera = createRetainedCubicSkyOrbit({
        stage,
        onError,
        inputSurface,
        cameraElement: mounted.camera,
        sceneElement: mounted.scene,
        cubicSky: mounted.cubicSky,
        skyPlan: PREPARED_SUN_SCENE.starfield,
        cameraPlan: PREPARED_SUN_SCENE.camera,
        objectId: "sun",
        mobilePreviewElement:
          stage.ownerDocument.querySelector(".planet-sidebar"),
        requireSun: false,
        onPublish({ zoom }) {
          mounted.corona.style.setProperty("--sun-camera-zoom", String(zoom));
          mounted.limb.style.setProperty("--sun-camera-zoom", String(zoom));
        },
      });

      lifetime.onDispose(() => orbitCamera.destroy());
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        const diagnostics = window.__sun = Object.freeze({
        ready: true,

        renderStats: Object.freeze({
          textureStats: Object.freeze({
            selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
            get retainedInteractiveImageCount() {
              return lensControls.retainedImageCount();
            },
          }),
        }),
        dom: mounted.domStats,
        camera: Object.freeze({
          state: orbitCamera.state,
          setState: orbitCamera.setState,
          stats: orbitCamera.stats,
        }),
        sky: Object.freeze({ state: orbitCamera.skyState }),
        lenses: Object.freeze({
          state: lensControls.state,
          select: lensControls.select,
        }),
        settings: Object.freeze({ state: speedControls.state }),
        stableNodes: mounted.stableNodes,
        assertStableDomIdentity: mounted.assertStableDomIdentity,
        });
        lifetime.onDispose(() => { if (window.__sun === diagnostics) delete window.__sun; });
      }
    } catch (error) {
      if (lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Sun startup failed.", { cause: error });
      throw error;
    }
  }

}

function mountPreparedScene(stage, plan, lifetime) {
  if (plan.schema !== "csssun-prepared-runtime-scene@2" ||
      plan.runtimeGeometry !== false || plan.runtimeRasterization !== false) {
    throw new TypeError("Sun retained scene plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  if (plan.starfield.sun !== undefined ||
      plan.camera.cameraModel !== "accumulated-matrix3d" ||
      plan.camera.pitchBounded !== false || plan.camera.yawBounded !== false) {
    throw new TypeError("Sun self-luminous cubic-sky contract is incompatible.");
  }
  const camera = createMesh(
    "polycss-camera sun-camera planet-render-root",
    "perspective:1000000px",
  );
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
  const scene = createMesh("polycss-scene", "");
  const system = createMesh(
    "sun-system",
    `transform:rotateY(${-plan.body.axialTiltDegrees}deg)`,
  );
  const body = createMesh("sun-body", "");
  const fragment = document.createDocumentFragment();
  for (const leaf of plan.body.leaves) {
    fragment.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(fragment);
  system.appendChild(body);
  scene.appendChild(system);
  camera.appendChild(scene);
  stage.replaceChildren(camera);

  const corona = document.createElement("div");
  lifetime.onDispose(() => corona.remove());
  corona.className = "sun-corona-layer planet-render-root";
  corona.ariaHidden = "true";
  corona.style.setProperty(
    "--sun-corona-image",
    cssUrl(canonicalPreparedUrl(
      plan.offLimbContext.defaultUrl,
      plan.offLimbContext.defaultUrl2x,
    )),
  );
  corona.style.setProperty(
    "--sun-camera-zoom",
    String(plan.camera.defaultZoom),
  );
  stage.appendChild(corona);

  const limb = document.createElement("div");
  lifetime.onDispose(() => limb.remove());
  limb.className = "sun-limb-layer planet-render-root";
  limb.ariaHidden = "true";
  limb.style.setProperty(
    "--sun-limb-image",
    cssUrl(canonicalPreparedUrl(
      plan.limbMaterial.defaultUrl,
      plan.limbMaterial.defaultUrl2x,
    )),
  );
  limb.style.setProperty(
    "--sun-camera-zoom",
    String(plan.camera.defaultZoom),
  );
  stage.appendChild(limb);
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: plan.starfield,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "sun",
    requireSun: false,
  });

  lifetime.onDispose(() => cubicSky.destroy());
  const stableNodes = Object.freeze([...stage.querySelectorAll("*")]);
  const stableParents = stableNodes.map((node) => node.parentNode);
  const domStats = Object.freeze({
    mode: "source-backed-global-material-on-visible-retained-projective-solar-leaves",
    retainedInitialNodeCount: stableNodes.length,
    retainedCameraRootCount: 1,
    retainedOffLimbContextRootCount: 1,
    retainedLimbMaterialRootCount: 1,
    retainedSkyboxRootCount: 1,
    retainedSkyboxFaceCount: cubicSky.faceCount,
    retainedSunCubemapBakeCount: 0,
    retainedLeafCount: plan.body.leaves.length,
    runtimeDomGrowth: false,
  });
  return Object.freeze({
    camera,
    scene,
    system,
    body,
    corona,
    limb,
    cubicSky,
    stableNodes,
    domStats,
    assertStableDomIdentity() {
      for (let index = 0; index < stableNodes.length; index += 1) {
        if (!stableNodes[index].isConnected ||
            stableNodes[index].parentNode !== stableParents[index]) {
          throw new Error(`Sun retained DOM identity changed at node ${index}.`);
        }
      }
      return true;
    },
    destroy() {
      cubicSky.destroy();
    },
  });
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  mesh.style.cssText = style;
  return mesh;
}

function createSunLensControls({ stage, lifetime, onError }) {
  if (PREPARED_SUN_LENSES.schema !== "csssun-prepared-lenses@2") {
    throw new TypeError("Sun lens plan is incompatible.");
  }
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) throw new Error("Sun lens selector is missing.");
  const controlsById = new Map(PREPARED_SUN_LENSES.controls.map(
    (lens) => [lens.id, lens],
  ));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')].map(
    (button) => [button.value, button],
  ));
  if (buttons.size !== controlsById.size || controlsById.size !== PREPARED_SUN_LENSES.controls.length ||
      buttons.size !== root.querySelectorAll('button[name="lens"]').length ||
      [...buttons.keys()].some((id) => !controlsById.has(id))) {
    throw new Error("Sun lens selector does not match prepared lenses.");
  }
  for (const button of buttons.values()) button.disabled = true;
  const cache = new Map();
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let mounted = null;
  let activeId = PREPARED_SUN_LENSES.defaultLens;
  let activeReady = false;
  let desiredId = activeId;
  root.classList.add("is-loading");
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => void select(id).catch((error) => {
      console.error(error);
    }), { signal: events.signal });
  }
  const selection = createLatestSelection({
    lifetime, onFatalError: onError,
    onBusyChange(busy) { root.classList.toggle("is-loading", busy); },
  });
  lifetime.onDispose(() => {
    activeReady = false;
    root.classList.remove("is-loading");
    for (const button of buttons.values()) button.disabled = true;
  });
  lifetime.onDispose(() => {
    const errors = [];
    for (const [id, entry] of cache) {
      try { releaseEntry(id, entry); } catch (error) { errors.push(error); }
    }
    cache.clear();
    if (errors.length) throw new AggregateError(errors, "Lens cleanup failed.");
  });
  return Object.freeze({
    prepare,
    select,
    bindRuntime(nextMounted) {
      if (lifetime.disposed) return;
      mounted = nextMounted;
      activeReady = true;
      publish(activeId);
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
    },
    state() {
      return Object.freeze({ id: activeId, ready: activeReady });
    },
    retainedImageCount() {
      return [...cache.values()].reduce((count, entry) =>
        count + (entry.images?.length ?? 0), 0);
    },

  });

  async function select(id) {
    if (!controlsById.has(id)) throw new RangeError(`Unknown Sun lens: ${id}.`);
    if (lifetime.disposed || !activeReady) return false;
    desiredId = id;
    return selection.run({
      prepare: () => prepare(id),
      commit() {
        publish(id);
        activeId = id;
        releaseInactiveEntries(id);
      },
      onCurrentFailure() { desiredId = activeId; },
      discard() {
        const entry = cache.get(id);
        if (entry && id !== activeId && id !== desiredId) releaseEntry(id, entry);
      },
    });
  }

  function prepare(id) {
    if (lifetime.disposed) return Promise.resolve(null);
    const lens = controlsById.get(id);
    if (!lens) throw new RangeError(`Unknown Sun lens: ${id}.`);
    const existing = cache.get(id);
    if (existing) return existing.promise;
    const urls = [lens.surface2xUrl || lens.surfaceUrl, lens.poles2xUrl || lens.polesUrl, lens.corona2xUrl || lens.coronaUrl, lens.limb2xUrl || lens.limbUrl];
    const entry = { images: urls.map(() => Object.assign(new Image(), { decoding: "async" })), promise: null, released: false };
    cache.set(id, entry);
    entry.promise = Promise.all(entry.images.map((image, index) =>
      decodePreparedImage(image, urls[index]))).then((images) =>
      entry.released ? null : images, (error) => {
        if (entry.released) return null;
        releaseEntry(id, entry);
        throw error;
      });
    return entry.promise;
  }

  function releaseInactiveEntries(selectedId) {
    for (const [id, entry] of cache) {
      if (id !== selectedId) releaseEntry(id, entry);
    }
  }

  function releaseEntry(id, entry) {
    if (entry.released) return;
    entry.released = true;
    if (cache.get(id) === entry) cache.delete(id);
    const images = entry.images;
    entry.images = [];
    releaseImageGroup(images);
  }

  function publish(id) {
    if (!mounted) return;
    const lens = controlsById.get(id);
    mounted.body.style.setProperty(
      "--sun-surface-image",
      cssUrl(canonicalPreparedUrl(lens.surfaceUrl, lens.surface2xUrl)),
    );
    mounted.body.style.setProperty(
      "--sun-poles-image",
      cssUrl(canonicalPreparedUrl(lens.polesUrl, lens.poles2xUrl)),
    );
    mounted.corona.style.setProperty(
      "--sun-corona-image",
      cssUrl(canonicalPreparedUrl(lens.coronaUrl, lens.corona2xUrl)),
    );
    mounted.limb.style.setProperty(
      "--sun-limb-image",
      cssUrl(canonicalPreparedUrl(lens.limbUrl, lens.limb2xUrl)),
    );
    stage.dataset.lens = id;
    for (const button of buttons.values()) {
      button.setAttribute("aria-pressed", button.value === id ? "true" : "false");
    }
  }
}

function createSunSpeedControls({ lifetime, onError }) {
  const input = document.querySelector('input[name="speed"][type="range"]');
  let animations = Object.freeze([]);
  const speed = bindSpeedControl({
    input, lifetime, onError,
    onChange(value) {
      for (const animation of animations) animation.playbackRate = value;
    },
  });
  lifetime.onDispose(() => { animations = Object.freeze([]); });
  return Object.freeze({
    bindRuntime({ animations: nextAnimations }) {
      animations = Object.freeze([...nextAnimations]);
      for (const animation of animations) animation.playbackRate = speed.state().speed;
      speed.setEnabled(true);
    },
    state: () => Object.freeze({ speed: speed.state().speed }),
  });
}

function decodeImage(url, url2x, owner) {
  const image = Object.assign(new Image(), { decoding: "async" });
  owner.add(image);
  return decodePreparedImage(image, url2x || url);
}

function canonicalPreparedUrl(url, url2x) {
  return url2x || url;
}

function cssUrl(url) {
  return `url(${JSON.stringify(url)})`;
}

function releaseImageGroup(images) {
  const errors = [];
  for (const image of images) {
    try { releasePreparedImage(image); } catch (error) { errors.push(error); }
  }
  if (Array.isArray(images)) images.length = 0;
  else images.clear();
  if (errors.length) throw new AggregateError(errors, "Prepared image cleanup failed.");
}
