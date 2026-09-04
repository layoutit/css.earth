import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PLANET_SPEED_STATES } from "../../../platform/planet-feature-controls.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { PREPARED_SUN_LENSES } from "./preparedLenses.mjs";
import { PREPARED_SUN_SCENE } from "./preparedScene.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountSunClient(stage) {
  const inputSurface = document.querySelector(".sun-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Sun input surface is missing.");
  }
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let orbitCamera = null;
  let lensControls = null;
  let speedControls = null;
  let sceneAnimations = Object.freeze([]);
  let resourcesReleased = false;
  let ready;
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
    pause() {
      if (destroyed) return;
      shouldPlay = false;
      document.documentElement.dataset.playing = "false";
      for (const animation of sceneAnimations) animation.pause();
    },
    resume() {
      if (destroyed) return;
      shouldPlay = true;
      if (!mounted) return;
      document.documentElement.dataset.playing = "true";
      for (const animation of sceneAnimations) animation.play();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      releaseResources();
      delete document.documentElement.dataset.playing;
      if (DEVELOPMENT_DIAGNOSTICS && window.__sun) delete window.__sun;
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      speedControls = createSunSpeedControls();
      lensControls = createSunLensControls({ stage });
      await Promise.all([
        lensControls.prepare(PREPARED_SUN_LENSES.defaultLens),
        ...PREPARED_SUN_SCENE.starfield.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodeImage(url, url2x),
          decodeImage(highContrastUrl, highContrastUrl2x),
        ]),
      ]);
      if (destroyed) return;
      mounted = mountPreparedScene(stage, PREPARED_SUN_SCENE);
      lensControls.bindRuntime(mounted);
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      speedControls.bindRuntime({ animations: sceneAnimations });
      for (const animation of sceneAnimations) {
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      orbitCamera = createRetainedCubicSkyOrbit({
        stage,
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
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await waitForPaint();
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        window.__sun = Object.freeze({
        ready: true,
        pause: controller.pause,
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
      }
    } catch (error) {
      if (destroyed) return;
      releaseResources();
      throw error;
    }
  }

  function releaseResources() {
    if (resourcesReleased) return;
    resourcesReleased = true;
    orbitCamera?.destroy();
    orbitCamera = null;
    lensControls?.destroy();
    lensControls = null;
    speedControls?.destroy();
    speedControls = null;
    mounted?.destroy();
    mounted = null;
    sceneAnimations = Object.freeze([]);
    stage.replaceChildren();
    delete stage.dataset.lens;
  }
}

function mountPreparedScene(stage, plan) {
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

function createSunLensControls({ stage }) {
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
  if (buttons.size !== controlsById.size) {
    throw new Error("Sun lens selector does not match prepared lenses.");
  }
  for (const button of buttons.values()) button.disabled = true;
  const cache = new Map();
  const events = new AbortController();
  let mounted = null;
  let activeId = PREPARED_SUN_LENSES.defaultLens;
  let activeReady = false;
  let request = 0;
  let destroyed = false;
  root.classList.add("is-loading");
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => void select(id).catch((error) => {
      console.error(error);
    }), { signal: events.signal });
  }
  return Object.freeze({
    prepare,
    select,
    bindRuntime(nextMounted) {
      if (destroyed) return;
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
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeReady = false;
      request += 1;
      events.abort();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = true;
      for (const [id, entry] of cache) releaseEntry(id, entry);
      cache.clear();
      mounted = null;
      delete stage.dataset.lens;
    },
  });

  async function select(id) {
    if (!controlsById.has(id)) throw new RangeError(`Unknown Sun lens: ${id}.`);
    if (destroyed || !mounted) return false;
    const selectionRequest = ++request;
    root.classList.add("is-loading");
    try {
      await prepare(id);
      if (destroyed || selectionRequest !== request) return false;
      activeId = id;
      activeReady = true;
      publish(id);
      releaseInactiveEntries(id);
      return true;
    } finally {
      if (selectionRequest === request) root.classList.remove("is-loading");
    }
  }

  function prepare(id) {
    const existing = cache.get(id);
    if (existing) return existing.promise;
    const lens = controlsById.get(id);
    const entry = { images: null, promise: null, wanted: true, released: false };
    entry.promise = Promise.all([
      decodeImage(lens.surfaceUrl, lens.surface2xUrl),
      decodeImage(lens.polesUrl, lens.poles2xUrl),
      decodeImage(lens.coronaUrl, lens.corona2xUrl),
      decodeImage(lens.limbUrl, lens.limb2xUrl),
    ]).then((images) => {
      entry.images = images;
      if (!entry.wanted) releaseEntry(id, entry);
      return images;
    }).catch((error) => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, entry);
    return entry.promise;
  }

  function releaseInactiveEntries(selectedId) {
    for (const [id, entry] of cache) {
      if (id !== selectedId) releaseEntry(id, entry);
    }
  }

  function releaseEntry(id, entry) {
    entry.wanted = false;
    if (!entry.images || entry.released) return;
    entry.released = true;
    entry.images.forEach(releaseDecodedImage);
    if (cache.get(id) === entry) cache.delete(id);
    entry.images = null;
    entry.promise = null;
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

function createSunSpeedControls() {
  const button = document.querySelector('button[name="speed"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Sun speed control is missing.");
  }
  const events = new AbortController();
  let animations = Object.freeze([]);
  let stateIndex = PLANET_SPEED_STATES.findIndex(({ value }) => value === 1);
  let bound = false;
  button.addEventListener("click", () => {
    if (!bound) return;
    stateIndex = (stateIndex + 1) % PLANET_SPEED_STATES.length;
    publish();
  }, { signal: events.signal });
  return Object.freeze({
    bindRuntime({ animations: nextAnimations }) {
      animations = Object.freeze([...nextAnimations]);
      bound = true;
      publish();
    },
    state() {
      return Object.freeze({ speed: PLANET_SPEED_STATES[stateIndex].value });
    },
    destroy() {
      bound = false;
      events.abort();
      for (const animation of animations) animation.playbackRate = 1;
      animations = Object.freeze([]);
    },
  });

  function publish() {
    const state = PLANET_SPEED_STATES[stateIndex];
    button.dataset.state = state.label;
    button.setAttribute("aria-label", `Speed: ${state.label}`);
    for (const animation of animations) animation.playbackRate = state.value;
  }
}

async function decodeImage(url, url2x) {
  const selected = canonicalPreparedUrl(url, url2x);
  const image = new Image();
  image.decoding = "async";
  image.src = selected;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(`Prepared Sun image did not decode: ${selected}.`);
  }
  return image;
}

function releaseDecodedImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  image.removeAttribute("src");
}

function canonicalPreparedUrl(url, url2x) {
  return url2x || url;
}

function cssUrl(url) {
  return `url(${JSON.stringify(url)})`;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
}
