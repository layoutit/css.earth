import { PREPARED_JUPITER_SCENE } from "./preparedScene.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PREPARED_JUPITER_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_JUPITER_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_JUPITER_RINGS } from "./preparedRings.mjs";
import { PREPARED_JUPITER_LENSES } from "./preparedLenses.mjs";
import { PREPARED_JUPITER_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_JUPITER_STARFIELD } from "./preparedStarfield.mjs";
import { createRowShardCache } from "./preparedRowCache.mjs";
import { createPlanetFeatureControls } from "../../../platform/planet-feature-controls.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from
  "../../../platform/prepared-planar-rotation.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
  preparedScenePitch,
} from "../../../platform/cubic-sky-runtime.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const JUPITER_CUBIC_CAMERA = PREPARED_JUPITER_CAMERA;

export function mountJupiterClient(stage) {
  if (!(stage instanceof HTMLElement)) {
    throw new TypeError("Jupiter stage must be an HTML element.");
  }
  let destroyed = false;
  const assets = Object.freeze([
    ...PREPARED_JUPITER_STARFIELD.faces.flatMap(({
      url,
      url2x,
      highContrastUrl,
      highContrastUrl2x,
    }) => [url2x || url, highContrastUrl2x || highContrastUrl]),
    PREPARED_JUPITER_SKY_SUN.asset.url2x ||
      PREPARED_JUPITER_SKY_SUN.asset.url,
    "/scenes/jupiter/jupiter-surface@2x.webp",
    "/scenes/jupiter/jupiter-poles@2x.webp",
    ...Object.values(PREPARED_JUPITER_RINGS.assets).map((asset) =>
      asset.url2x || asset.url),
    PREPARED_JUPITER_LIGHTING.shadowless.url,
  ]);
  let shouldPlay = true;
  let animations = Object.freeze([]);
  let mounted = null;
  let orbit = null;
  let featureControls = null;
  let lensControls = null;
  let activeLens = PREPARED_JUPITER_LENSES.defaultLens;
  let lensRequest = 0;
  let resourcesReleased = false;
  const lensDecodePromises = new Map();
  const materialCache = createRowShardCache(PREPARED_JUPITER_LIGHTING);
  let ready = null;
  stage.classList.add("jupiter-stage");
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
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
    setView(state) {
      if (!orbit) throw new Error("Jupiter camera is not ready.");
      return orbit.setState(state);
    },
    view() {
      return orbit?.state() ?? null;
    },
    async selectLens(id) {
      return selectLens(id);
    },
    lens() {
      return lensState();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      lensRequest += 1;
      releaseScene();
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      featureControls = createPlanetFeatureControls({
        stage,
        classes: Object.freeze({
          rings: "jupiter-hide-rings",
          shadows: "jupiter-hide-shadows",
        }),
        onShadowsVisibilityChange(visible) {
          orbit?.setShadowsEnabled(visible);
        },
      });
      lensControls = createJupiterLensControls({ selectLens });
      await Promise.all([
        Promise.all(assets.map(decodeImage)),
        materialCache.prepareInitial(),
      ]);
      if (destroyed) return;
      mounted = mountPreparedBody(stage, PREPARED_JUPITER_SCENE);
      orbit = createJupiterOrbit(
        stage,
        mounted,
        materialCache,
      );
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        animation.currentTime = 0;
        if (!shouldPlay) animation.pause();
      }
      featureControls.bindRuntime({ animations });
      lensControls.bindReady();
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await new Promise((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(resolve)));
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        window.__jupiter = Object.freeze({
          ready: true,
          setView: controller.setView,
          view: controller.view,
          selectLens: controller.selectLens,
          lens: controller.lens,
          pause: controller.pause,
          resume: controller.resume,
          destroy: controller.destroy,
          stableNodes: mounted.stableNodes,
          assertStableDomIdentity: mounted.assertStableDomIdentity,
          dom: Object.freeze({
            retainedInitialNodeCount: mounted.stableNodes.length,
            retainedLeafCount: PREPARED_JUPITER_SCENE.leaves.length +
              PREPARED_JUPITER_RINGS.retainedDom.leafCount + 1,
            runtimeDomGrowthPolicy: "none",
          }),
          camera: Object.freeze({
            state: orbit.state,
            setState: orbit.setState,
            stats: orbit.stats,
          }),
          renderStats: Object.freeze({
            selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
            visibleAssetsDecodedBeforeMount:
              assets.length +
              PREPARED_JUPITER_LIGHTING.transport.initialWarmRows.length,
            idleJavaScriptLoops: 0,
            materialCache: materialCache.stats,
          }),
        });
      }
    } catch (error) {
      if (destroyed) return;
      releaseScene();
      throw error;
    }
  }

  async function selectLens(id) {
    const lens = PREPARED_JUPITER_LENSES.controls.find((entry) => entry.id === id);
    if (!lens) throw new RangeError(`Unknown Jupiter lens: ${id}.`);
    if (destroyed || !mounted) return lensState();
    const request = ++lensRequest;
    let decoding = Promise.resolve();
    if (lens.id !== PREPARED_JUPITER_LENSES.defaultLens) {
      decoding = lensDecodePromises.get(lens.id);
      if (!decoding) {
        decoding = decodeLens(lens).catch((error) => {
          lensDecodePromises.delete(lens.id);
          throw error;
        });
        lensDecodePromises.set(lens.id, decoding);
      }
    }
    await decoding;
    if (destroyed || request !== lensRequest) return lensState();
    if (lens.id === PREPARED_JUPITER_LENSES.defaultLens) {
      delete stage.dataset.lens;
    } else {
      stage.dataset.lens = lens.id;
    }
    activeLens = lens.id;
    lensControls?.publishLens(activeLens);
    return lensState();
  }

  function lensState() {
    return Object.freeze({
      id: activeLens,
      ready: mounted !== null && !destroyed,
    });
  }

  function releaseScene() {
    if (resourcesReleased) return;
    resourcesReleased = true;
    featureControls?.destroy();
    featureControls = null;
    lensControls?.destroy();
    lensControls = null;
    orbit?.destroy();
    orbit = null;
    materialCache.destroy();
    mounted?.skySun.destroy();
    mounted?.cubicSky.destroy();
    lensDecodePromises.clear();
    mounted = null;
    animations = Object.freeze([]);
    delete stage.dataset.lens;
    stage.classList.remove("jupiter-stage");
    delete document.documentElement.dataset.playing;
    stage.replaceChildren();
    if (DEVELOPMENT_DIAGNOSTICS && window.__jupiter) delete window.__jupiter;
  }
}

function createJupiterLensControls({ selectLens }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Jupiter lens selector is missing.");
  }
  const events = new AbortController();
  let destroyed = false;
  let ready = false;
  let controlRequest = 0;
  const lensButtons = [...root.querySelectorAll('button[name="lens"]')];
  if (lensButtons.length !== PREPARED_JUPITER_LENSES.controls.length) {
    throw new Error("Jupiter lens selector does not match prepared lenses.");
  }
  root.classList.add("is-loading");
  for (const button of lensButtons) button.disabled = true;
  for (const button of lensButtons) {
    button.addEventListener("click", () => void applyLens(button), {
      signal: events.signal,
    });
  }
  publishLens(PREPARED_JUPITER_LENSES.defaultLens);
  return Object.freeze({
    publishLens,
    bindReady() {
      if (destroyed) return false;
      ready = true;
      root.classList.remove("is-loading");
      for (const button of lensButtons) button.disabled = false;
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ready = false;
      controlRequest += 1;
      events.abort();
      root.classList.remove("is-loading");
      for (const button of lensButtons) button.disabled = true;
    },
  });

  async function applyLens(button) {
    if (!ready || destroyed) return;
    const request = ++controlRequest;
    root.classList.add("is-loading");
    try {
      const state = await selectLens(button.value);
      if (!destroyed) publishLens(state.id);
    } catch (error) {
      console.error(error);
    } finally {
      if (!destroyed && request === controlRequest) {
        root.classList.remove("is-loading");
      }
    }
  }

  function publishLens(id) {
    if (destroyed) return;
    for (const candidate of lensButtons) {
      candidate.setAttribute("aria-pressed", String(candidate.value === id));
    }
  }
}

function mountPreparedBody(stage, plan) {
  if (plan.schema !== "cssjupiter-prepared-retained-body@1") {
    throw new TypeError("Jupiter retained body plan is incompatible.");
  }
  const camera = createMesh("polycss-camera planet-render-root", plan.camera.style);
  const scene = createMesh("polycss-scene", plan.camera.sceneStyle);
  const system = createMesh("jupiter-system", plan.systemTransform);
  const body = createMesh("jupiter-body", plan.bodyTransform);
  const leaves = document.createDocumentFragment();
  for (const leaf of plan.leaves) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(leaves);
  if (PREPARED_JUPITER_RINGS.schema !== "cssjupiter-prepared-rings@2") {
    throw new TypeError("Jupiter ring plan is incompatible.");
  }
  const rings = createMesh("jupiter-rings", "");
  const ringLeaves = document.createDocumentFragment();
  for (const leaf of PREPARED_JUPITER_RINGS.leaves) {
    const element = document.createElement("s");
    element.className = leaf.className;
    element.style.cssText = leaf.style;
    ringLeaves.appendChild(element);
  }
  rings.appendChild(ringLeaves);
  system.append(rings, body);
  const materialSystem = createMesh(
    "jupiter-material-system",
    PREPARED_JUPITER_CAMERA.materialDepthPresentation
      .materialSystemTransform,
  );
  const materialCounter = createMesh(
    "jupiter-fixed-material-counter",
    "",
  );
  const material = createMesh(
    "jupiter-material",
    PREPARED_JUPITER_CAMERA.materialDepthPresentation.materialMeshTransform,
  );
  const materialLeaf = document.createElement("s");
  materialLeaf.style.transform =
    PREPARED_JUPITER_CAMERA.materialDepthPresentation.leafTransform;
  material.appendChild(materialLeaf);
  materialCounter.appendChild(material);
  materialSystem.appendChild(materialCounter);
  scene.appendChild(materialSystem);
  scene.appendChild(system);
  camera.appendChild(scene);
  stage.replaceChildren(camera);
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: PREPARED_JUPITER_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "jupiter",
    requireSun: false,
  });
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_JUPITER_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "jupiter",
    before: camera,
  });
  const layerRegistration = registerBodyDependentLayers({
    objectId: "jupiter",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [materialSystem],
  });
  const stableNodes = Object.freeze([
    ...stage.querySelectorAll("*"),
  ]);
  const stableParents = new Map(stableNodes.map((node) =>
    [node, node.parentNode]));
  return Object.freeze({
    camera,
    scene,
    system,
    body,
    cubicSky,
    skySun,
    rings,
    materialSystem,
    materialCounter,
    material,
    materialLeaf,
    stableNodes,
    assertStableDomIdentity() {
      const stable = stableNodes.every((node) =>
        node.isConnected && node.parentNode === stableParents.get(node));
      return stable && layerRegistration.assertRegistered();
    },
  });
}

function createJupiterOrbit(stage, mounted, materialCache) {
  if (PREPARED_JUPITER_LIGHTING.schema !==
      "cssjupiter-prepared-lighting@3") {
    throw new TypeError("Jupiter prepared lighting plan is incompatible.");
  }
  let orbit = null;
  let lastMaterialPresentation = "";
  let baseLightAzimuthDegrees = null;
  let materialFrame = 0;
  let shadowsEnabled = false;
  const publishMaterialRoll = createPreparedPlanarRotationPublisher({
    element: mounted.materialLeaf,
    width: PREPARED_JUPITER_LIGHTING.presentationFrameSize,
  });
  const publish = ({
    sunViewDirection,
    counterRotationFor,
    controlPitch,
  }) => {
    const materialCounter = counterRotationFor(
      mounted.materialSystem.style.transform,
    );
    if (mounted.materialCounter.style.transform !== materialCounter) {
      mounted.materialCounter.style.transform = materialCounter;
    }
    const scenePitch = preparedScenePitch(
      controlPitch,
      JUPITER_CUBIC_CAMERA,
    );
    materialFrame = Math.round(clamp(
      (scenePitch - PREPARED_JUPITER_LIGHTING.minimumPitchDegrees) /
        PREPARED_JUPITER_LIGHTING.pitchStepDegrees,
      0,
      PREPARED_JUPITER_LIGHTING.frameCount - 1,
    ));
    const preparedMaterial = shadowsEnabled
      ? materialCache.presentation(materialFrame)
      : PREPARED_JUPITER_LIGHTING.shadowless;
    if (preparedMaterial) {
      const key = `${preparedMaterial.url}|` +
        `${preparedMaterial.backgroundPosition}|` +
        preparedMaterial.backgroundSize;
      if (key !== lastMaterialPresentation) {
        mounted.materialLeaf.style.backgroundImage =
          `url("${preparedMaterial.url}")`;
        mounted.materialLeaf.style.backgroundPosition =
          preparedMaterial.backgroundPosition;
        mounted.materialLeaf.style.backgroundSize =
          preparedMaterial.backgroundSize;
        lastMaterialPresentation = key;
      }
    }
    const azimuth = Math.atan2(
      sunViewDirection[1],
      sunViewDirection[0],
    ) * 180 / Math.PI;
    baseLightAzimuthDegrees ??= azimuth;
    publishMaterialRoll(shadowsEnabled
      ? normalizeDegrees(azimuth - baseLightAzimuthDegrees)
      : 0);
  };
  materialCache.onReady(() => orbit?.refresh());
  orbit = createRetainedCubicSkyOrbit({
    stage,
    inputSurface: stage,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_JUPITER_STARFIELD,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_JUPITER_SKY_SUN,
    cameraPlan: JUPITER_CUBIC_CAMERA,
    objectId: "jupiter",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onPublish: publish,
  });
  return Object.freeze({
    setState: orbit.setState,
    state: orbit.state,
    setShadowsEnabled(visible) {
      const enabled = Boolean(visible);
      if (enabled === shadowsEnabled) return false;
      shadowsEnabled = enabled;
      orbit.refresh();
      return true;
    },
    skyState: orbit.skyState,
    stats() {
      return Object.freeze({ ...orbit.stats(), materialFrame });
    },
    destroy() {
      materialCache.onReady(null);
      orbit.destroy();
    },
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}

function createMesh(className, style) {
  const element = document.createElement("div");
  element.className = className.startsWith("polycss-")
    ? className
    : `polycss-mesh ${className}`;
  if (style) element.style.cssText = style;
  return element;
}

function decodeImage(source) {
  const image = new Image();
  image.decoding = "sync";
  image.src = source;
  return image.decode();
}

function decodeLens(lens) {
  return Promise.all([
    decodeImage(lens.surface2xUrl || lens.surfaceUrl),
    decodeImage(lens.poles2xUrl || lens.polesUrl),
  ]);
}
