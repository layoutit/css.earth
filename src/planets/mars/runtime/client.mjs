import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { PREPARED_MARS_SCENE } from "./preparedScene.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PREPARED_MARS_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_MARS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MARS_SKY_SUN } from "./preparedSkySun.mjs";
import { createRowShardCache } from "./preparedRowCache.mjs";
import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import {
  CANONICAL_PREPARED_IMAGE_DENSITY,
} from "../../../../site/runtime-policy.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountMarsClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Mars requires onError.");
  const lifetime = createSceneLifetime();
  const warmImages = new Set();
  lifetime.onDispose(() => {
    releaseImageGroup(warmImages);
  });
  if (!(stage instanceof HTMLElement)) {
    throw new TypeError("Mars stage must be an HTML element.");
  }
  const materialBank = PREPARED_MARS_LIGHTING.banks[
    String(CANONICAL_PREPARED_IMAGE_DENSITY)
  ];
  if (materialBank?.schema !== "cssmars-prepared-lighting-bank@1") {
    throw new Error(
      `Mars has no prepared DPR ${CANONICAL_PREPARED_IMAGE_DENSITY} ` +
        "material bank.",
    );
  }
  const assets = Object.freeze([
    "/scenes/mars/mars-surface@2x.webp",
    "/scenes/mars/mars-poles@2x.webp",
    ...PREPARED_MARS_SCENE.starfield.faces.flatMap(({
      url,
      url2x,
      highContrastUrl,
      highContrastUrl2x,
    }) => [url2x || url, highContrastUrl2x || highContrastUrl]),
    PREPARED_MARS_SKY_SUN.asset.url2x || PREPARED_MARS_SKY_SUN.asset.url,
  ]);
  let shouldPlay = false;
  let animations = Object.freeze([]);
  let mounted = null;
  let orbit = null;
  let panelControls = null;
  let activeLens = PREPARED_MARS_LENSES.defaultLens;
  const lensDecodePromises = new Map();
  let playbackRate = 1;
  let shadowsEnabled = false;
  const materialCache = createRowShardCache(materialBank);
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
    onBusyChange(busy) { panelControls?.setBusy(busy); },
  });
  let ready = null;
  stage.classList.add("mars-stage");
  lifetime.onDispose(() => stage.classList.remove("mars-stage"));
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

      if (playbackRate > 0) {
        for (const animation of animations) animation.play();
      }
    },
    setView(state) {
      if (!orbit) throw new Error("Mars camera is not ready.");
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
      if (errors.length) throw new AggregateError(errors, "Mars cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      panelControls = createMarsPanelControls({
        stage, lifetime, onError,
        selectLens,
        setShadows(visible) {
          shadowsEnabled = visible;
          orbit?.refresh();
        },
        setSpeed(nextRate) {
          playbackRate = nextRate;
          for (const animation of animations) {
            if (nextRate === 0) {
              animation.pause();
              continue;
            }
            animation.playbackRate = nextRate;
            if (shouldPlay) animation.play();
          }
        },
      });

      await lifetime.wait(Promise.all([
        Promise.all(assets.map((url) => decodeImage(url, warmImages))),
        materialCache.prepareInitial(),
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedBody(stage, PREPARED_MARS_SCENE, lifetime);
      warmImages.clear();
      orbit = createMarsOrbit(
        stage,
        mounted,
        materialCache,
        () => shadowsEnabled,
        lifetime,
        onError,
      );
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.currentTime = 0;
        animation.playbackRate = playbackRate;
        if (shouldPlay && playbackRate > 0) animation.play();
        else animation.pause();
      }
      panelControls.bindReady();
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        const diagnostics = window.__mars = Object.freeze({
          ready: true,
          setView: controller.setView,
          view: controller.view,
          selectLens: controller.selectLens,
          lens: controller.lens,

          stableNodes: mounted.stableNodes,
          assertStableDomIdentity: mounted.assertStableDomIdentity,
          dom: Object.freeze({
            retainedInitialNodeCount: mounted.stableNodes.length,
            retainedLeafCount: PREPARED_MARS_SCENE.leaves.length + 2,
            retainedSkyboxFaceCount: mounted.cubicSky.faceCount,
            retainedSunBillboardCount: 1,
            retainedSunCubemapBakeCount: 0,
            runtimeDomGrowthPolicy: "fixed-single-object-scene",
          }),
          camera: Object.freeze({
            state: orbit.state,
            setState: orbit.setState,
            stats: orbit.stats,
          }),
          sky: Object.freeze({ state: orbit.skyState }),
          renderStats: Object.freeze({
            selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
            visibleAssetsDecodedBeforeMount:
              assets.length +
              materialBank.transport.initialWarmRows.length,
            idleJavaScriptLoops: 0,
            materialCache: materialCache.stats,
          }),
        });
        lifetime.onDispose(() => { if (window.__mars === diagnostics) delete window.__mars; });
      }
    } catch (error) {
      if (lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Mars startup failed.", { cause: error });
      throw error;
    }
  }

  async function selectLens(id) {
    const lens = PREPARED_MARS_LENSES.controls.find((entry) => entry.id === id);
    if (!lens) throw new RangeError(`Unknown Mars lens: ${id}.`);
    if (lifetime.disposed || !mounted) return lensState();
    desiredLens = id;
    await selection.run({
      prepare: async () => {
        if (id === PREPARED_MARS_LENSES.defaultLens) return null;
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
        if (id === PREPARED_MARS_LENSES.defaultLens) delete stage.dataset.lens;
        else stage.dataset.lens = id;
        activeLens = id;
        panelControls?.publishLens(id);
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

function createMarsPanelControls({ stage, selectLens, setShadows, setSpeed, lifetime, onError }) {
  const lensRoot = document.querySelector(".planet-drawer-content .planet-lenses");
  const settingsRoot = document.querySelector(".planet-settings-panel .planet-settings");
  const speedButton = settingsRoot?.querySelector('button[name="speed"]');
  const shadows = settingsRoot?.querySelector('input[name="shadows"]');
  if (!(lensRoot instanceof HTMLElement) || !(settingsRoot instanceof HTMLElement) ||
      !(speedButton instanceof HTMLButtonElement) || !(shadows instanceof HTMLInputElement)) {
    throw new Error("Mars panel controls are incomplete.");
  }
  const lensButtons = [...lensRoot.querySelectorAll('button[name="lens"]')];
  const ids = new Set(lensButtons.map((button) => button.value));
  if (ids.size !== lensButtons.length || ids.size !== PREPARED_MARS_LENSES.controls.length ||
      PREPARED_MARS_LENSES.controls.some(({ id }) => !ids.has(id))) {
    throw new Error("Mars lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let ready = false;
  lifetime.onDispose(() => {
    ready = false;
    lensRoot.classList.remove("is-loading");
    for (const button of lensButtons) button.disabled = true;
  });
  const speed = bindSpeedControl({ button: speedButton, lifetime, onError, onChange: setSpeed });
  lensRoot.classList.add("is-loading");
  for (const button of lensButtons) {
    button.disabled = true;
    button.addEventListener("click", () => {
      if (ready && !lifetime.disposed) void selectLens(button.value).catch(console.error);
    }, { signal: events.signal });
  }
  shadows.addEventListener("change", () => {
    if (lifetime.disposed) return;
    try { setShadows(shadows.checked); } catch (error) { onError(error); }
  }, { signal: events.signal });
  setShadows(shadows.checked);
  return Object.freeze({
    publishLens,
    setBusy(busy) { lensRoot.classList.toggle("is-loading", busy); },
    bindReady() {
      if (lifetime.disposed) return;
      ready = true;
      speed.setEnabled(true);
      lensRoot.classList.remove("is-loading");
      for (const button of lensButtons) button.disabled = false;
    },
  });
  function publishLens(id) {
    if (lifetime.disposed) return;
    for (const button of lensButtons) button.setAttribute("aria-pressed", String(button.value === id));
  }
}

function mountPreparedBody(stage, plan, lifetime) {
  if (plan.schema !== "cssmars-prepared-retained-body@1") {
    throw new TypeError("Mars retained body plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  if (plan.starfield.cameraContract !==
      "google-earth-pro-inverse-unbounded-matrix3d") {
    throw new TypeError("Mars cubic-sky camera binding is incompatible.");
  }
  const camera = createMesh(
    "polycss-camera mars-camera planet-render-root",
    "perspective:1000000px",
  );
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
  const scene = createMesh("polycss-scene", "");
  const system = createMesh("mars-system", plan.systemTransform);
  const body = createMesh("mars-body", plan.bodyTransform);
  const leaves = document.createDocumentFragment();
  for (const leaf of plan.leaves) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(leaves);
  system.appendChild(body);
  scene.appendChild(system);
  const materialCounter = createMesh("mars-material-counter", "");
  const materialSystem = createMesh(
    "mars-system mars-material-system",
    plan.systemTransform,
  );
  const material = document.createElement("div");
  material.className = "polycss-mesh mars-material";
  material.style.cssText = plan.bodyTransform;
  const materialPlane = createMesh(
    "mars-material-plane",
    `transform:${PREPARED_MARS_CAMERA.materialDepthContract.planeTransform}`,
  );
  const materialLeaf = document.createElement("s");
  materialPlane.appendChild(materialLeaf);
  material.appendChild(materialPlane);
  materialSystem.appendChild(material);
  materialCounter.appendChild(materialSystem);
  scene.appendChild(materialCounter);
  camera.appendChild(scene);
  stage.replaceChildren(camera);
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: plan.starfield,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "mars",
    requireSun: false,
  });
  lifetime.onDispose(() => cubicSky.destroy());
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_MARS_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "mars",
    before: camera,
  });
  lifetime.onDispose(() => skySun.destroy());
  const layerRegistration = registerBodyDependentLayers({
    objectId: "mars",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [materialCounter],
  });
  const stableNodes = Object.freeze([...stage.querySelectorAll("*")]);
  const stableParents = new Map(stableNodes.map((node) =>
    [node, node.parentNode]));
  return Object.freeze({
    camera,
    scene,
    system,
    body,
    material,
    materialPlane,
    materialSystem,
    materialCounter,
    materialLeaf,
    cubicSky,
    skySun,
    stableNodes,
    assertStableDomIdentity() {
      const stable = stableNodes.every((node) =>
        node.isConnected && node.parentNode === stableParents.get(node));
      return stable && layerRegistration.assertRegistered();
    },
  });
}

function createMarsOrbit(stage, mounted, materialCache, shadowsVisible, lifetime, onError) {
  const lighting = PREPARED_MARS_LIGHTING;
  let sunViewDirection;
  let materialFrame = lighting.defaultFrame;
  let materialLightRollDegrees = 0;
  let lastMaterialPresentation = "";
  const camera = createRetainedCubicSkyOrbit({
    stage, inputSurface: stage,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_MARS_SCENE.starfield,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_MARS_SKY_SUN,
    cameraPlan: PREPARED_MARS_CAMERA,
    objectId: "mars",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onError,
    onPublish(state) {
      sunViewDirection = state.skySunViewDirection;
      mounted.materialCounter.style.transform = state.counterRotation;
      publishMaterialDirection(sunViewDirection);
    },
  });
  lifetime.onDispose(camera.destroy);
  lifetime.onDispose(() => materialCache.onReady(null));
  materialCache.onReady(camera.invalidate);
  return Object.freeze({
    ...camera,
    skyState() {
      return Object.freeze({
        ...camera.skyState(),
        sunViewDirection: Object.freeze([...sunViewDirection]),
        sunPresentation: mounted.skySun.state(),
        shadowsEnabled: shadowsVisible(),
        materialMode: shadowsVisible()
          ? "directional-terminator-and-atmosphere" : "full-phase-atmosphere",
        materialFrame,
        materialLightRollDegrees,
      });
    },
  });

  function publishMaterialDirection(direction) {
    const materialDirection =
      viewSunDirectionToPreparedLightDirection(direction);
    const frame = shadowsVisible()
      ? Math.round(clamp(
        (materialDirection[2] - lighting.minimumLightViewZ) /
          (lighting.maximumLightViewZ - lighting.minimumLightViewZ),
        0,
        1,
      ) * (lighting.frameCount - 1))
      : lighting.frameCount - 1;
    const presentation = materialCache.presentation(frame);
    if (presentation) {
      const presentationKey = `${presentation.url}|` +
        `${presentation.backgroundPosition}|${presentation.backgroundSize}`;
      if (presentationKey !== lastMaterialPresentation) {
        mounted.materialLeaf.style.backgroundImage =
          `url("${presentation.url}")`;
        mounted.materialLeaf.style.backgroundPosition =
          presentation.backgroundPosition;
        mounted.materialLeaf.style.backgroundSize = presentation.backgroundSize;
        lastMaterialPresentation = presentationKey;
      }
    }
    materialFrame = frame;
    if (!shadowsVisible() ||
        Math.hypot(materialDirection[0], materialDirection[1]) < 1e-9) {
      mounted.materialLeaf.style.rotate = "0deg";
      materialLightRollDegrees = 0;
      return;
    }
    const roll = normalizeDegrees(
      Math.atan2(materialDirection[1], materialDirection[0]) * 180 / Math.PI -
        lighting.baseLightAzimuthDegrees,
    );
    mounted.materialLeaf.style.rotate = `${roll}deg`;
    materialLightRollDegrees = roll;
  }
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
