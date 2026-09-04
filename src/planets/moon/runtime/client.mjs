import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { PLANET_SPEED_STATES } from
  "../../../platform/planet-feature-controls.mjs";
import { PREPARED_MOON_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MOON_SCENE } from "./preparedScene.mjs";
import { PREPARED_MOON_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_MOON_STARFIELD } from "./preparedStarfield.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountMoonClient(stage) {
  const inputSurface = document.querySelector(".moon-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Moon input surface is missing.");
  }
  const retainedImages = new Map();
  const pendingImages = new Map();
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let orbit = null;
  let lenses = null;
  let speedControls = null;
  let animations = Object.freeze([]);
  let ready = null;

  const controller = Object.freeze({
    get ready() { return ready; },
    pause() {
      if (destroyed) return;
      shouldPlay = false;
      document.documentElement.dataset.playing = "false";
      for (const animation of animations) animation.pause();
    },
    resume() {
      if (destroyed) return;
      shouldPlay = true;
      if (!mounted) return;
      document.documentElement.dataset.playing = "true";
      for (const animation of animations) animation.play();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      lenses?.destroy();
      speedControls?.destroy();
      orbit?.destroy();
      mounted?.skySun.destroy();
      mounted?.cubicSky.destroy();
      mounted?.materialRoot.remove();
      mounted?.camera.remove();
      for (const image of retainedImages.values()) image.src = "";
      retainedImages.clear();
      pendingImages.clear();
      stage.replaceChildren();
      delete stage.dataset.lens;
      delete document.documentElement.dataset.playing;
      if (DEVELOPMENT_DIAGNOSTICS && window.__moon) delete window.__moon;
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      validatePreparedCubicSky(PREPARED_MOON_STARFIELD, { requireSun: false });
      lenses = createMoonLensControls({
        stage,
        decodePreparedImage: decodePair,
      });
      speedControls = createMoonSpeedControls();
      await Promise.all([
        decodePair(PREPARED_MOON_SCENE.body.assets.surface),
        decodePair(PREPARED_MOON_SCENE.body.assets.poles),
        decodePair(PREPARED_MOON_LENSES.material),
        ...PREPARED_MOON_STARFIELD.faces.flatMap((face) => [
          decodePair({ one: face.url, two: face.url2x }),
          decodePair({
            one: face.highContrastUrl,
            two: face.highContrastUrl2x,
          }),
        ]),
        decodePair(PREPARED_MOON_SKY_SUN.asset),
      ]);
      if (destroyed) return;
      mounted = mountPreparedMoon(stage);
      await lenses.bindRuntime(mounted);
      if (destroyed) return;
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      speedControls.bindRuntime({ animations });
      orbit = createRetainedCubicSkyOrbit({
        stage,
        inputSurface,
        cameraElement: mounted.camera,
        sceneElement: mounted.scene,
        cubicSky: mounted.cubicSky,
        skyPlan: PREPARED_MOON_STARFIELD,
        directionalSun: mounted.skySun,
        directionalSunPlan: PREPARED_MOON_SKY_SUN,
        cameraPlan: PREPARED_MOON_SCENE.camera,
        objectId: "moon",
        mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
        onPublish({ zoom }) {
          const zoomScale = zoom / PREPARED_MOON_SCENE.camera.defaultZoom;
          mounted.materialRoot.style.scale =
            "calc(var(--moon-shell-scale) / (" +
            `var(--planet-viewport-zoom-divisor) / ${zoomScale}))`;
        },
      });
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await waitForPaint();
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (destroyed) return;
      controller.destroy();
      throw error;
    }
  }

  function decodePair(pair) {
    const one = pair.one ?? pair.url;
    const two = pair.two ?? pair.url2x;
    const url = two || one;
    const retained = retainedImages.get(url);
    if (retained) return Promise.resolve(retained);
    let promise = pendingImages.get(url);
    if (!promise) {
      promise = decodeImage(url).then((image) => {
        pendingImages.delete(url);
        if (!destroyed) retainedImages.set(url, image);
        return image;
      }, (error) => {
        pendingImages.delete(url);
        throw error;
      });
      pendingImages.set(url, promise);
    }
    return promise;
  }

  async function decodeImage(url) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(`Prepared Moon image did not decode: ${url}.`);
    }
    return image;
  }

  function publishDiagnostics() {
    window.__moon = Object.freeze({
      ready: true,
      pause: controller.pause,
      camera: Object.freeze({
        state: orbit.state,
        setState: orbit.setState,
        stats: orbit.stats,
      }),
      sky: Object.freeze({ state: orbit.skyState }),
      lenses: Object.freeze({ state: lenses.state, select: lenses.select }),
      options: Object.freeze({ state: speedControls.state }),
      renderStats: Object.freeze({
        textureStats: Object.freeze({
          selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
          get retainedInteractiveImageCount() { return retainedImages.size; },
          get pendingInteractiveImageCount() { return pendingImages.size; },
        }),
      }),
      dom: mounted.domStats,
      stableNodes: mounted.stableNodes,
      assertStableDomIdentity: mounted.assertStableDomIdentity,
    });
  }
}

function mountPreparedMoon(stage) {
  const plan = PREPARED_MOON_SCENE;
  if (plan.schema !== "cssmoon-prepared-retained-scene@1" ||
      plan.counts.runtimeGeometryPreparation !== false ||
      plan.counts.runtimeRasterization !== false) {
    throw new TypeError("Moon retained scene plan is incompatible.");
  }
  const selected = (pair) => pair.two || pair.one;
  const camera = createMesh(
    "polycss-camera moon-camera planet-render-root",
    plan.camera.style,
  );
  const scene = createMesh("polycss-scene", plan.camera.sceneStyle);
  const system = createMesh("moon-system", plan.body.systemTransform);
  scene.appendChild(system);
  camera.appendChild(scene);
  const surfaceCarriers = [];
  const polarCarriers = [];
  for (const band of plan.body.bands) {
    const polar = band.latitudeIndex === 0 ||
      band.latitudeIndex === plan.body.latitudeSegments - 1;
    const carrier = createMesh(
      polar ? "moon-body moon-body-polar" : "moon-body",
      `${plan.body.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
    );
    (polar ? polarCarriers : surfaceCarriers).push(carrier);
    carrier.style.setProperty(
      "--moon-surface-texture",
      `url("${selected(plan.body.assets.surface)}")`,
    );
    carrier.style.setProperty(
      "--moon-poles-texture",
      `url("${selected(plan.body.assets.poles)}")`,
    );
    for (const leafPlan of band.leaves) {
      carrier.appendChild(createPreparedProjectiveTextureLeaf(leafPlan));
    }
    system.appendChild(carrier);
  }
  const materialRoot = createMesh("moon-material-root planet-render-root");
  const materialLeaf = document.createElement("s");
  materialLeaf.className = "moon-material";
  materialLeaf.style.backgroundImage =
    `url("${selected(PREPARED_MOON_LENSES.material)}")`;
  materialRoot.appendChild(materialLeaf);
  stage.replaceChildren(camera, materialRoot);
  stage.dataset.lens = PREPARED_MOON_LENSES.defaultLens;
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: PREPARED_MOON_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "moon",
    requireSun: false,
  });
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_MOON_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "moon",
    before: camera,
  });
  const stableNodes = Object.freeze([...stage.querySelectorAll("*")]);
  const stableParents = stableNodes.map((node) => node.parentNode);
  const domStats = Object.freeze({
    mode: "prepared-projective-sphere-with-retained-cubic-sky",
    retainedInitialNodeCount: stableNodes.length,
    retainedLeafCount: stage.querySelectorAll("b, s, u").length,
    maximumRetainedLeafCount: plan.counts.retainedLeafCount,
    retainedSkyboxFaceCount: cubicSky.faceCount,
    runtimeDomGrowth: false,
    runtimeDomGrowthPolicy: "none",
  });
  return Object.freeze({
    camera,
    scene,
    cubicSky,
    skySun,
    materialRoot,
    materialLeaf,
    bodyCarriers: Object.freeze({
      surface: Object.freeze(surfaceCarriers),
      polar: Object.freeze(polarCarriers),
    }),
    stableNodes,
    domStats,
    assertStableDomIdentity() {
      for (let index = 0; index < stableNodes.length; index += 1) {
        if (!stableNodes[index].isConnected ||
            stableNodes[index].parentNode !== stableParents[index]) {
          throw new Error(`Moon retained DOM identity changed at node ${index}.`);
        }
      }
      return true;
    },
  });
}

function createMoonLensControls({ stage, decodePreparedImage }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Moon lens selector is missing.");
  }
  const controls = new Map(PREPARED_MOON_LENSES.controls.map((lens) =>
    [lens.id, lens]));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')]
    .map((button) => [button.value, button]));
  if (buttons.size !== controls.size) {
    throw new Error("Moon lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  let active = PREPARED_MOON_LENSES.defaultLens;
  let request = 0;
  let bound = false;
  let destroyed = false;
  let mounted = null;
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => {
      void select(id).catch((error) => console.error(error));
    }, { signal: events.signal });
  }
  publish();
  return Object.freeze({
    state: () => Object.freeze({ id: active, ready: bound && !destroyed }),
    select,
    async bindRuntime(nextMounted) {
      if (destroyed) return false;
      mounted = nextMounted;
      bound = true;
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      bound = false;
      request += 1;
      events.abort();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = true;
      mounted = null;
    },
  });

  async function select(id) {
    const lens = controls.get(id);
    if (!lens) throw new RangeError(`Unknown Moon lens: ${id}.`);
    if (!bound || destroyed) return false;
    const selection = ++request;
    await Promise.all([
      decodePreparedImage({ one: lens.surfaceUrl, two: lens.surface2xUrl }),
      decodePreparedImage({ one: lens.polesUrl, two: lens.poles2xUrl }),
    ]);
    if (destroyed || selection !== request) return false;
    const surfaceUrl = lens.surface2xUrl || lens.surfaceUrl;
    const polesUrl = lens.poles2xUrl || lens.polesUrl;
    for (const carrier of mounted.bodyCarriers.surface) {
      carrier.style.setProperty(
        "--moon-surface-texture",
        `url("${surfaceUrl}")`,
      );
    }
    for (const carrier of mounted.bodyCarriers.polar) {
      carrier.style.setProperty("--moon-poles-texture", `url("${polesUrl}")`);
    }
    stage.dataset.lens = lens.id;
    active = lens.id;
    publish();
    return true;
  }

  function publish() {
    for (const [id, button] of buttons) {
      button.setAttribute("aria-pressed", String(id === active));
    }
  }
}

function createMoonSpeedControls() {
  const button = document.querySelector('button[name="speed"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Moon speed control is missing.");
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

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  if (style) mesh.style.cssText = style;
  return mesh;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
}
