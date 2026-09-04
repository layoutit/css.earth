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
import { PREPARED_PLUTO_LENSES } from "./preparedLenses.mjs";
import { PREPARED_PLUTO_SCENE } from "./preparedScene.mjs";
import { PREPARED_PLUTO_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_PLUTO_STARFIELD } from "./preparedStarfield.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountPlutoClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Pluto requires onError.");
  const lifetime = createSceneLifetime();
  const inputSurface = document.querySelector(".pluto-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Pluto input surface is missing.");
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
      if (errors.length) throw new AggregateError(errors, "Pluto cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      validatePreparedCubicSky(PREPARED_PLUTO_STARFIELD, { requireSun: false });
      lenses = createPlutoLensControls({
        stage,
        lifetime,
        onError,
        decodePreparedImage: decodePair,
      });
      speedControls = createPlutoSpeedControls({ lifetime, onError });
      await lifetime.wait(Promise.all([
        decodePair(PREPARED_PLUTO_SCENE.body.assets.surface),
        decodePair(PREPARED_PLUTO_SCENE.body.assets.poles),
        decodePair(PREPARED_PLUTO_LENSES.material),
        ...PREPARED_PLUTO_STARFIELD.faces.flatMap((face) => [
          decodePair({ one: face.url, two: face.url2x }),
          decodePair({
            one: face.highContrastUrl,
            two: face.highContrastUrl2x,
          }),
        ]),
        decodePair(PREPARED_PLUTO_SKY_SUN.asset),
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedPluto(stage, lifetime);
      lifetime.onDispose(() => {
        if (mounted.camera.parentNode === stage) delete stage.dataset.lens;
      });
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
        skyPlan: PREPARED_PLUTO_STARFIELD,
        directionalSun: mounted.skySun,
        directionalSunPlan: PREPARED_PLUTO_SKY_SUN,
        cameraPlan: PREPARED_PLUTO_SCENE.camera,
        objectId: "pluto",
        mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
        onPublish({ zoom }) {
          const zoomScale = zoom / PREPARED_PLUTO_SCENE.camera.defaultZoom;
          mounted.materialRoot.style.scale =
            "calc(var(--pluto-shell-scale) / (" +
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
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Pluto startup failed.", { cause: error });
      throw error;
    }
  }

  function decodePair(pair) {
    return images.load(pair.two || pair.url2x || pair.one || pair.url);
  }

  function publishDiagnostics() {
    lifetime.onDispose(() => { if (window.__pluto === diagnostics) delete window.__pluto; });
    const diagnostics = window.__pluto = Object.freeze({
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

function mountPreparedPluto(stage, lifetime) {
  const plan = PREPARED_PLUTO_SCENE;
  if (plan.schema !== "csspluto-prepared-retained-scene@1" ||
      plan.counts.runtimeGeometryPreparation !== false ||
      plan.counts.runtimeRasterization !== false) {
    throw new TypeError("Pluto retained scene plan is incompatible.");
  }
  const selected = (pair) => pair.two || pair.one;
  const camera = createMesh(
    "polycss-camera pluto-camera planet-render-root",
    plan.camera.style,
  );
  lifetime.onDispose(() => camera.remove());
  const scene = createMesh("polycss-scene", plan.camera.sceneStyle);
  const system = createMesh("pluto-system", plan.body.systemTransform);
  scene.appendChild(system);
  camera.appendChild(scene);
  const surfaceCarriers = [];
  const polarCarriers = [];
  for (const band of plan.body.bands) {
    const polar = band.latitudeIndex === 0 ||
      band.latitudeIndex === plan.body.latitudeSegments - 1;
    const carrier = createMesh(
      polar ? "pluto-body pluto-body-polar" : "pluto-body",
      `${plan.body.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
    );
    (polar ? polarCarriers : surfaceCarriers).push(carrier);
    carrier.style.setProperty(
      "--pluto-surface-texture",
      `url("${selected(plan.body.assets.surface)}")`,
    );
    carrier.style.setProperty(
      "--pluto-poles-texture",
      `url("${selected(plan.body.assets.poles)}")`,
    );
    for (const leafPlan of band.leaves) {
      carrier.appendChild(createPreparedProjectiveTextureLeaf(leafPlan));
    }
    system.appendChild(carrier);
  }
  const materialRoot = createMesh("pluto-material-root planet-render-root");
  lifetime.onDispose(() => materialRoot.remove());
  const materialLeaf = document.createElement("s");
  materialLeaf.className = "pluto-material";
  materialLeaf.style.backgroundImage =
    `url("${selected(PREPARED_PLUTO_LENSES.material)}")`;
  materialRoot.appendChild(materialLeaf);
  stage.replaceChildren(camera, materialRoot);
  stage.dataset.lens = PREPARED_PLUTO_LENSES.defaultLens;
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: PREPARED_PLUTO_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "pluto",
    requireSun: false,
  });
  lifetime.onDispose(() => cubicSky.destroy());
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_PLUTO_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "pluto",
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
          throw new Error(`Pluto retained DOM identity changed at node ${index}.`);
        }
      }
      return true;
    },
  });
}

function createPlutoLensControls({ stage, decodePreparedImage, lifetime, onError }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Pluto lens selector is missing.");
  }
  const controls = new Map(PREPARED_PLUTO_LENSES.controls.map((lens) =>
    [lens.id, lens]));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')]
    .map((button) => [button.value, button]));
  if (buttons.size !== controls.size || controls.size !== PREPARED_PLUTO_LENSES.controls.length ||
      buttons.size !== root.querySelectorAll('button[name="lens"]').length ||
      [...buttons.keys()].some((id) => !controls.has(id))) {
    throw new Error("Pluto lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let active = PREPARED_PLUTO_LENSES.defaultLens;
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
    if (!lens) throw new RangeError(`Unknown Pluto lens: ${id}.`);
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
            "--pluto-surface-texture",
            `url("${surfaceUrl}")`,
          );
        }
        for (const carrier of mounted.bodyCarriers.polar) {
          carrier.style.setProperty("--pluto-poles-texture", `url("${polesUrl}")`);
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

function createPlutoSpeedControls({ lifetime, onError }) {
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
