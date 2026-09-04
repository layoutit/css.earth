import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { createPreparedImageStore } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
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
import { bindSpeedControl } from
  "../../../platform/planet-feature-controls.mjs";
import { PREPARED_MOON_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MOON_SCENE } from "./preparedScene.mjs";
import { PREPARED_MOON_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_MOON_STARFIELD } from "./preparedStarfield.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountMoonClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Moon requires onError.");
  const lifetime = createSceneLifetime();
  const inputSurface = document.querySelector(".moon-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Moon input surface is missing.");
  }
  const images = createPreparedImageStore();
  lifetime.onDispose(() => images.destroy());
  let shouldPlay = false;
  let mounted = null;
  let orbit = null;
  let lenses = null;
  let speedControls = null;
  let animations = Object.freeze([]);
  let ready = null;

  const controller = Object.freeze({
    get ready() { return ready; },
    pause() {
      if (lifetime.disposed) return;
      shouldPlay = false;

      for (const animation of animations) animation.pause();
    },
    resume() {
      if (lifetime.disposed) return;
      shouldPlay = true;
      if (!mounted) return;

      for (const animation of animations) animation.play();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Moon cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      validatePreparedCubicSky(PREPARED_MOON_STARFIELD, { requireSun: false });
      lenses = createMoonLensControls({
        stage,
        lifetime,
        onError,
        decodePreparedImage: decodePair,
      });
      speedControls = createMoonSpeedControls({ lifetime, onError });
      await lifetime.wait(Promise.all([
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
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedMoon(stage, lifetime);
      await lenses.bindRuntime(mounted);
      if (lifetime.disposed) return;
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      speedControls.bindRuntime({ animations });
      orbit = createRetainedCubicSkyOrbit({
        stage,
        onError,
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

      lifetime.onDispose(() => orbit.destroy());
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Moon startup failed.", { cause: error });
      throw error;
    }
  }

  function decodePair(pair) {
    return images.load(pair.two || pair.url2x || pair.one || pair.url);
  }

  function publishDiagnostics() {
    lifetime.onDispose(() => { if (window.__moon === diagnostics) delete window.__moon; });
    const diagnostics = window.__moon = Object.freeze({
      ready: true,
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
          get retainedInteractiveImageCount() { return images.stats().retainedCount; },
          get pendingInteractiveImageCount() { return images.stats().pendingCount; },
        }),
      }),
      dom: mounted.domStats,
      stableNodes: mounted.stableNodes,
      assertStableDomIdentity: mounted.assertStableDomIdentity,
    });
  }
}

function mountPreparedMoon(stage, lifetime) {
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
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
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
  lifetime.onDispose(() => materialRoot.remove());
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
  lifetime.onDispose(() => cubicSky.destroy());
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_MOON_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "moon",
    before: camera,
  });
  lifetime.onDispose(() => skySun.destroy());
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

function createMoonLensControls({ stage, decodePreparedImage, lifetime, onError }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Moon lens selector is missing.");
  }
  const controls = new Map(PREPARED_MOON_LENSES.controls.map((lens) =>
    [lens.id, lens]));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')]
    .map((button) => [button.value, button]));
  if (buttons.size !== controls.size || controls.size !== PREPARED_MOON_LENSES.controls.length ||
      buttons.size !== root.querySelectorAll('button[name="lens"]').length ||
      [...buttons.keys()].some((id) => !controls.has(id))) {
    throw new Error("Moon lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let active = PREPARED_MOON_LENSES.defaultLens;
  let bound = false;
  let mounted = null;
  const selection = createLatestSelection({
    lifetime, onFatalError: onError,
    onBusyChange(busy) { root.classList.toggle("is-loading", busy); },
  });
  lifetime.onDispose(() => {
    bound = false;
    mounted = null;
    root.classList.remove("is-loading");
    for (const button of buttons.values()) button.disabled = true;
  });
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => {
      void select(id).catch((error) => console.error(error));
    }, { signal: events.signal });
  }
  publish();
  return Object.freeze({
    state: () => Object.freeze({ id: active, ready: bound && !lifetime.disposed }),
    select,
    async bindRuntime(nextMounted) {
      if (lifetime.disposed) return false;
      mounted = nextMounted;
      bound = true;
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
      return true;
    },

  });

  async function select(id) {
    const lens = controls.get(id);
    if (!lens) throw new RangeError(`Unknown Moon lens: ${id}.`);
    if (!bound || lifetime.disposed) return false;
    return selection.run({
      prepare: () => Promise.all([
        decodePreparedImage({ one: lens.surfaceUrl, two: lens.surface2xUrl }),
        decodePreparedImage({ one: lens.polesUrl, two: lens.poles2xUrl }),
      ]),
      commit() {
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
      },
    });
  }

  function publish() {
    for (const [id, button] of buttons) {
      button.setAttribute("aria-pressed", String(id === active));
    }
  }
}

function createMoonSpeedControls({ lifetime, onError }) {
  const button = document.querySelector('button[name="speed"]');
  let animations = Object.freeze([]);
  const speed = bindSpeedControl({
    button, lifetime, onError,
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

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  if (style) mesh.style.cssText = style;
  return mesh;
}
