import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
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

export function mountJupiterClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Jupiter requires onError.");
  const lifetime = createSceneLifetime();
  const warmImages = new Set();
  lifetime.onDispose(() => {
    releaseImageGroup(warmImages);
  });
  if (!(stage instanceof HTMLElement)) {
    throw new TypeError("Jupiter stage must be an HTML element.");
  }
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
  let shouldPlay = false;
  let animations = Object.freeze([]);
  let mounted = null;
  let orbit = null;
  let featureControls = null;
  let lensControls = null;
  let activeLens = PREPARED_JUPITER_LENSES.defaultLens;
  const lensDecodePromises = new Map();
  const materialCache = createRowShardCache(PREPARED_JUPITER_LIGHTING);
  lifetime.onDispose(() => materialCache.destroy());
  lifetime.onDispose(() => {
    const errors = [];
    for (const entry of lensDecodePromises.values()) {
      try { releaseLensEntry(entry); } catch (error) { errors.push(error); }
    }
    lensDecodePromises.clear();
    if (errors.length) throw new AggregateError(errors, "Lens cleanup failed.");
  });
  let desiredLens = activeLens;
  const selection = createLatestSelection({
    lifetime, onFatalError: onError,
    onBusyChange(busy) { lensControls?.setBusy(busy); },
  });
  let ready = null;
  stage.classList.add("jupiter-stage");
  lifetime.onDispose(() => stage.classList.remove("jupiter-stage"));
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
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
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Jupiter cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      featureControls = createPlanetFeatureControls({
        stage, lifetime, onError,
        classes: Object.freeze({
          rings: "jupiter-hide-rings",
          shadows: "jupiter-hide-shadows",
        }),
        onShadowsVisibilityChange(visible) {
          orbit?.setShadowsEnabled(visible);
        },
      });
      lensControls = createJupiterLensControls({ selectLens, lifetime });
      await lifetime.wait(Promise.all([
        Promise.all(assets.map((url) => decodeImage(url, warmImages))),
        materialCache.prepareInitial(),
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedBody(stage, PREPARED_JUPITER_SCENE, lifetime);
      warmImages.clear();
      orbit = createJupiterOrbit(
        stage,
        mounted,
        materialCache,
        lifetime,
        onError,
      );
      lifetime.onDispose(() => orbit.destroy());
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      featureControls.bindRuntime({ animations });
      lensControls.bindReady();

      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        const diagnostics = window.__jupiter = Object.freeze({
          ready: true,
          setView: controller.setView,
          view: controller.view,
          selectLens: controller.selectLens,
          lens: controller.lens,

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
        lifetime.onDispose(() => { if (window.__jupiter === diagnostics) delete window.__jupiter; });
      }
    } catch (error) {
      if (lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Jupiter startup failed.", { cause: error });
      throw error;
    }
  }

  async function selectLens(id) {
    const lens = PREPARED_JUPITER_LENSES.controls.find((entry) => entry.id === id);
    if (!lens) throw new RangeError(`Unknown Jupiter lens: ${id}.`);
    if (lifetime.disposed || !mounted) return lensState();
    desiredLens = id;
    await selection.run({
      prepare: async () => {
        if (id === PREPARED_JUPITER_LENSES.defaultLens) return null;
        let entry = lensDecodePromises.get(id);
        if (!entry) {
          entry = { images: new Set(), promise: null, released: false };
          lensDecodePromises.set(id, entry);
          entry.promise = Promise.all([
            decodeImage(lens.surface2xUrl || lens.surfaceUrl, entry.images),
            decodeImage(lens.poles2xUrl || lens.polesUrl, entry.images),
          ]).then(() => undefined, (error) => {
            if (entry.released) return;
            if (lensDecodePromises.get(id) === entry) lensDecodePromises.delete(id);
            releaseLensEntry(entry);
            throw error;
          });
        }
        await entry.promise;
        return entry;
      },
      commit(entry) {
        if (id === PREPARED_JUPITER_LENSES.defaultLens) delete stage.dataset.lens;
        else stage.dataset.lens = id;
        activeLens = id;
        lensControls?.publishLens(id);
        // The retained CSS presentation now owns the warmed URLs.
        entry?.images.clear();
      },
      onCurrentFailure() { desiredLens = activeLens; },
      discard(entry) {
        if (entry && id !== activeLens && id !== desiredLens) {
          if (lensDecodePromises.get(id) === entry) lensDecodePromises.delete(id);
          releaseLensEntry(entry);
        }
      },
    });
    return lensState();
  }

  function releaseLensEntry(entry) {
    if (entry.released) return;
    entry.released = true;
    releaseImageGroup(entry.images);
  }

  function lensState() {
    return Object.freeze({
      id: activeLens,
      ready: mounted !== null && !lifetime.disposed,
    });
  }

}

function createJupiterLensControls({ selectLens, lifetime }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) throw new Error("Jupiter lens selector is missing.");
  const lensButtons = [...root.querySelectorAll('button[name="lens"]')];
  const ids = new Set(lensButtons.map((button) => button.value));
  if (ids.size !== lensButtons.length || ids.size !== PREPARED_JUPITER_LENSES.controls.length ||
      PREPARED_JUPITER_LENSES.controls.some(({ id }) => !ids.has(id))) {
    throw new Error("Jupiter lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let ready = false;
  lifetime.onDispose(() => {
    ready = false;
    root.classList.remove("is-loading");
    for (const button of lensButtons) button.disabled = true;
  });
  root.classList.add("is-loading");
  for (const button of lensButtons) {
    button.disabled = true;
    button.addEventListener("click", () => {
      if (ready && !lifetime.disposed) void selectLens(button.value).catch(console.error);
    }, { signal: events.signal });
  }
  publishLens(PREPARED_JUPITER_LENSES.defaultLens);
  return Object.freeze({
    publishLens,
    setBusy(busy) { root.classList.toggle("is-loading", busy); },
    bindReady() {
      if (lifetime.disposed) return false;
      ready = true;
      root.classList.remove("is-loading");
      for (const button of lensButtons) button.disabled = false;
      return true;
    },
  });
  function publishLens(id) {
    if (lifetime.disposed) return;
    for (const button of lensButtons) button.setAttribute("aria-pressed", String(button.value === id));
  }
}

function mountPreparedBody(stage, plan, lifetime) {
  if (plan.schema !== "cssjupiter-prepared-retained-body@1") {
    throw new TypeError("Jupiter retained body plan is incompatible.");
  }
  const camera = createMesh("polycss-camera planet-render-root", plan.camera.style);
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
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
  lifetime.onDispose(() => cubicSky.destroy());
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_JUPITER_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "jupiter",
    before: camera,
  });
  lifetime.onDispose(() => skySun.destroy());
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

function createJupiterOrbit(stage, mounted, materialCache, lifetime, onError) {
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
  materialCache.onReady(() => {
    if (lifetime.disposed) return;
    try { orbit?.refresh(); } catch (error) { onError(error); }
  });
  lifetime.onDispose(() => materialCache.onReady(null));
  orbit = createRetainedCubicSkyOrbit({
    stage,
    onError,
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

function decodeImage(source, owner) {
  const image = Object.assign(new Image(), { decoding: "sync" });
  owner.add(image);
  return decodePreparedImage(image, source);
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
