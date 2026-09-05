import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { createPlanetFeatureControls } from "../../../platform/planet-feature-controls.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from
  "../../../platform/prepared-planar-rotation.mjs";
import { PREPARED_URANUS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "./preparedSceneRuntime.mjs";
import { PREPARED_URANUS_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_URANUS_STARFIELD } from "./preparedStarfield.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { createPreparedImageStore } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { createUranusMaterialNeighborhoodCache } from "./material-neighborhood-cache.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const lensOwners = new WeakMap();
const URANUS_CUBIC_CAMERA = Object.freeze({
  cameraModel: "accumulated-matrix3d",
  minimumControlPitchDegrees: 0,
  maximumControlPitchDegrees: 89,
  defaultControlPitchDegrees: 34.230769230769226,
  defaultControlYawDegrees: -105,
  materialReferenceControlPitchDegrees: 34.230769230769226,
  materialReferenceControlYawDegrees: 0,
  initialScenePitchDegrees: 40,
  maximumScenePitchDegrees: 65,
  minimumZoom: 0.42,
  maximumZoom: 4,
  defaultZoom: 1.1,
  sceneScale: 0.022,
  logicalBodyDiameter: 460,
  pitchBounded: false,
  yawBounded: false,
  responsiveFit: Object.freeze({
    model: "continuous-aspect-smoothstep",
    portraitBaseWidthShare: 0.34,
    narrowPortraitWidthShareGain: 0.08,
    landscapeWidthShareGain: 0.02,
    narrowPortraitAspectRatio: 0.46,
    portraitAspectRatio: 0.75,
    squareAspectRatio: 1,
    maximumHeightShare: 0.61,
    maximumMobilePreviewShare: 0.925,
    minimumZoom: 0.42,
    maximumZoom: 2,
  }),
});

export function mountUranusClient(stage, { onError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Uranus requires onError.");
  const lifetime = createSceneLifetime();
  const inputSurface = document.querySelector(".uranus-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Uranus input surface is missing.");
  }
  const imageStore = createPreparedImageStore();
  lifetime.onDispose(imageStore.destroy);
  const materialCache = createUranusMaterialNeighborhoodCache();
  lifetime.onDispose(materialCache.destroy);
  const decode = imageStore.load;
  let shouldPlay = false;
  let mounted = null;
  let cameraControls = null;
  let featureControls = null;
  let lensControls = null;
  let animations = Object.freeze([]);
  let ready;
  let diagnostics = null;
  lifetime.onDispose(() => { if (window.__uranus === diagnostics) delete window.__uranus; });

  disableLensButtons(true);
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
      for (const animation of animations) animation.play();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Uranus cleanup failed.");
    },
  });
  ready = lifetime.wait(start()).then((result) => result.value).catch((error) => {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    throw error;
  });
  return controller;

  async function start() {
    try {
      featureControls = createPlanetFeatureControls({
        stage, lifetime, onError,
        classes: Object.freeze({ rings: "uranus-hide-rings", shadows: "uranus-hide-shadows" }),
        onShadowsVisibilityChange: (visible) => cameraControls?.setShadowsEnabled(visible),
      });
      const assets = selectedAssets();
      const initialMaterialRow = materialRowIndexForPitch(
        PREPARED_URANUS_RUNTIME_SCENE.camera.defaultPitch,
      );
      await Promise.all([
        ...assets.starfieldFaces.map(decode),
        decode(assets.skySun),
        decode(assets.surface),
        decode(assets.poles),
        decode(assets.defaultMaterial),
        decode(assets.shadowlessMaterial),
        materialCache.warm(assets.materialRows, initialMaterialRow),
        decode(assets.ring),
        decode(assets.ringShadow),
      ]);
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage, assets, lifetime);
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.pause();
        animation.currentTime = 0;
      }
      cameraControls = createUranusCubicCamera({
        stage,
        inputSurface,
        mounted,
        defaultMaterial: assets.defaultMaterial,
        shadowlessMaterial: assets.shadowlessMaterial,
        materialRows: assets.materialRows,
        onError,
        onMaterialRowChange(rowIndex, rows) {
          void materialCache.warm(rows, rowIndex).catch((error) => {
            if (lifetime.disposed) return;
            if (error instanceof AggregateError) onError(error);
            else console.error(error);
          });
        },
      });
      lifetime.onDispose(cameraControls.destroy);
      featureControls.bindRuntime({ animations });
      if (lifetime.disposed) return;
      if (shouldPlay) for (const animation of animations) animation.play();
      lensControls = bindUranusLensControls({
        stage,
        surfaceRoots: mounted.bodyBands.map(({ element }) => element),
        cameraControls,
        decode,
        prepareMaterialRows: materialCache.prepare,
        lifetime, onError,
      });
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      disableLensButtons(false);
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (lifetime.disposed) return;
      throw error;
    }
  }

  function publishDiagnostics() {
    diagnostics = Object.freeze({
      ready: true,
      renderStats: Object.freeze({
        textureStats: Object.freeze({
          selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
          get retainedInteractiveImageCount() {
            const material = materialCache.stats();
            return imageStore.stats().retainedCount + material.retainedCount + material.pendingCount;
          },
        }),
      }),
      dom: mounted.domStats,
      stableNodes: mounted.stableNodes,
      assertStableDomIdentity: mounted.assertStableDomIdentity,
      camera: Object.freeze({
        state: cameraControls.state,
        setState: cameraControls.setState,
        stats: cameraControls.stats,
      }),
      animation: Object.freeze({ stats: cameraControls.stats }),
      features: Object.freeze({ state: featureControls.state }),
      options: Object.freeze({ state: featureControls.optionsState }),
      lenses: Object.freeze({
        state: lensControls.state,
        select: lensControls.select,
      }),
    });
    window.__uranus = diagnostics;
  }
}

function materialRowIndexForPitch(controlPitch) {
  const frameCount = PREPARED_URANUS_RUNTIME_SCENE.preparedLighting.frameCount;
  const frameIndex = Math.round(
    clamp(controlPitch, 0, URANUS_CUBIC_CAMERA.maximumControlPitchDegrees) /
      URANUS_CUBIC_CAMERA.maximumControlPitchDegrees *
      (frameCount - 1),
  );
  return PREPARED_URANUS_RUNTIME_SCENE.preparedLighting
    .presentations[frameIndex].rowIndex;
}

function selectedAssets() {
  const scene = PREPARED_URANUS_RUNTIME_SCENE.assets;
  const suffix = String(CANONICAL_PREPARED_IMAGE_DENSITY);
  const normal = scene.surfaces.normal[suffix];
  const materialRows = scene.materialViewBank.normal[suffix].rows;
  return Object.freeze({
    starfieldFaces: PREPARED_URANUS_STARFIELD.faces.flatMap(({
      url,
      url2x,
      highContrastUrl,
      highContrastUrl2x,
    }) => [url2x || url, highContrastUrl2x || highContrastUrl]),
    skySun: PREPARED_URANUS_SKY_SUN.asset.url2x ||
      PREPARED_URANUS_SKY_SUN.asset.url,
    surface: normal.surface,
    poles: normal.poles,
    material: materialRows[0],
    defaultMaterial: scene.fixedMaterial.normal[suffix],
    shadowlessMaterial: scene.shadowlessMaterial.normal[suffix],
    materialRows,
    ring: scene.rings[suffix],
    ringShadow: scene.rings.shadow[suffix],
  });
}

function mountPreparedScene(stage, assets, lifetime) {
  const plan = PREPARED_URANUS_RUNTIME_SCENE;
  if (plan.schema !== "cssuranus-prepared-runtime-scene@1") {
    throw new TypeError("Uranus retained scene plan is incompatible.");
  }
  const camera = element("div", "polycss-camera planet-render-root");
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode !== stage) return;
    delete stage.dataset.lens;
  });
  camera.style.cssText = plan.camera.style;
  const scene = element("div", "polycss-scene");
  scene.style.cssText = plan.camera.sceneStyle;
  const system = mesh("uranus-system", plan.systemTransform);
  const ring = mesh(
    "uranus-ring-orbit uranus-ring-plane",
    `${plan.meshTransform};animation-duration:${
      plan.preparedRingSource.planeVisualOrbitSeconds}s`,
  );
  ring.appendChild(textureLeaf(
    "uranus-rings",
    plan.ringPlane,
    assets.ring,
  ));
  system.appendChild(ring);
  const ringShadow = mesh(
    "uranus-ring-shadow",
    plan.meshTransform,
  );
  ringShadow.appendChild(textureLeaf(
    "uranus-ring-shadow-leaf",
    plan.ringShadowPlane,
    assets.ringShadow,
  ));
  system.appendChild(ringShadow);

  const bodyBandCarriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("uranus-polar"));
    const carrierKey = `${polar ? "polar" : "body"}:${
      band.visualRotationSeconds}`;
    let carrier = bodyBandCarriers.get(carrierKey);
    if (!carrier) {
      const body = mesh(
        polar ? "uranus-body uranus-body-polar" : "uranus-body",
        `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      body.style.setProperty("--uranus-surface-image", `url(${assets.surface})`);
      body.style.setProperty("--uranus-poles-image", `url(${assets.poles})`);
      carrier = Object.freeze({
        element: body,
        durationSeconds: band.visualRotationSeconds,
      });
      bodyBandCarriers.set(carrierKey, carrier);
      system.appendChild(body);
    }
    appendPreparedLeaves(carrier.element, band.leaves);
  }
  const bodyBands = Object.freeze([...bodyBandCarriers.values()]);
  scene.appendChild(system);
  camera.appendChild(scene);

  const fixedMaterialMesh = mesh(
    "uranus-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialCounter = mesh("uranus-fixed-material-counter", "");
  const fixedMaterialLeaf = textureLeaf(
    "uranus-fixed-material-leaf",
    plan.fixedMaterialPlane.leaf,
    assets.defaultMaterial,
  );
  fixedMaterialMesh.appendChild(fixedMaterialLeaf);
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  scene.appendChild(fixedMaterialCounter);

  stage.replaceChildren(camera);
  stage.dataset.lens = "normal";
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: PREPARED_URANUS_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "uranus",
    requireSun: false,
  });
  lifetime.onDispose(cubicSky.destroy);
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_URANUS_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "uranus",
    before: camera,
  });
  lifetime.onDispose(skySun.destroy);
  const layerRegistration = registerBodyDependentLayers({
    objectId: "uranus",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [fixedMaterialCounter],
  });
  const stableNodes = Object.freeze([...stage.querySelectorAll("*")]);
  const stableParents = Object.freeze(stableNodes.map((node) => node.parentNode));
  const initialNodeCount = stableNodes.length;
  const retainedLeaves = Object.freeze([
    ...stage.querySelectorAll(".polycss-scene b, .polycss-scene s"),
  ]);
  return Object.freeze({
    camera,
    scene,
    system,
    ring,
    ringShadow,
    bodyBands,
    fixedMaterialMesh,
    fixedMaterialCounter,
    fixedMaterialLeaf,
    cubicSky,
    skySun,
    stableNodes,
    domStats: Object.freeze({
      mode: "semantic-transform-groups-with-bare-leaves",
      retainedInitialNodeCount: initialNodeCount,
      retainedCameraRootCount: 1,
      retainedMaterialCompositeRootCount: 0,
      retainedSceneRootCount: 1,
      retainedLeafCount: retainedLeaves.length,
      retainedCubicSkyFaceCount: cubicSky.faceCount,
      runtimeDomGrowth: false,
    }),
    assertStableDomIdentity() {
      if (stage.querySelectorAll("*").length !== initialNodeCount ||
          !stableNodes.every((node, index) =>
            node.isConnected && node.parentNode === stableParents[index])) {
        throw new Error("Uranus retained DOM identity changed.");
      }
      return layerRegistration.assertRegistered();
    },
  });
}

function createUranusCubicCamera({
  stage,
  inputSurface,
  mounted,
  defaultMaterial,
  shadowlessMaterial,
  materialRows,
  onMaterialRowChange,
  onError,
}) {
  const lighting = PREPARED_URANUS_RUNTIME_SCENE.preparedLighting;
  if (!Array.isArray(materialRows) || materialRows.length !== lighting.rowCount) {
    throw new TypeError("Uranus prepared material transport is incompatible.");
  }
  let orbit = null;
  let activeDefaultMaterial = defaultMaterial;
  let activeShadowlessMaterial = shadowlessMaterial;
  let activeMaterialRows = Object.freeze([...materialRows]);
  let activeMaterialFrame = -1;
  let activeMaterialRow = -1;
  let activeDefaultPresentation = null;
  let baseSunViewZ = null;
  let baseLightAzimuthDegrees = null;
  let shadowsEnabled = false;
  let transformWrites = 0;
  let materialAddressWrites = 0;
  const publishMaterialRoll = createPreparedPlanarRotationPublisher({
    element: mounted.fixedMaterialLeaf,
    width: lighting.frameSize,
  });

  const publish = ({
    sunViewDirection,
    counterRotation,
    controlPitch,
  }) => {
    if (mounted.fixedMaterialCounter.style.transform !== counterRotation) {
      mounted.fixedMaterialCounter.style.transform = counterRotation;
      transformWrites += 1;
    }
    const defaultFrame = Math.round(
      URANUS_CUBIC_CAMERA.defaultControlPitchDegrees /
        URANUS_CUBIC_CAMERA.maximumControlPitchDegrees *
        (lighting.frameCount - 1),
    );
    baseSunViewZ ??= sunViewDirection[2];
    const frameIndex = Math.round(clamp(
      defaultFrame + (baseSunViewZ - sunViewDirection[2]) *
        ((lighting.frameCount - 1) / 2),
      0,
      lighting.frameCount - 1,
    ));
    const presentation = lighting.presentations[frameIndex];
    const useApprovedDefault = shadowsEnabled && Math.abs(
      controlPitch - URANUS_CUBIC_CAMERA.defaultControlPitchDegrees,
    ) < 0.01;
    const presentationMode = shadowsEnabled
      ? useApprovedDefault ? "default" : "directional"
      : "shadowless";
    const effectiveFrame = shadowsEnabled ? frameIndex : -1;
    if (activeMaterialFrame !== effectiveFrame ||
        activeDefaultPresentation !== presentationMode) {
      const backgroundImage = `url(${presentationMode === "shadowless"
        ? activeShadowlessMaterial
        : useApprovedDefault
          ? activeDefaultMaterial
          : activeMaterialRows[presentation.rowIndex]})`;
      const backgroundPosition = presentationMode !== "directional"
        ? "0px 0px"
        : presentation.backgroundPosition;
      const backgroundSize = presentationMode !== "directional"
        ? `${lighting.frameSize}px ${lighting.frameSize}px`
        : presentation.backgroundSize;
      for (const [property, value] of [
        ["backgroundImage", backgroundImage],
        ["backgroundPosition", backgroundPosition],
        ["backgroundSize", backgroundSize],
      ]) {
        if (mounted.fixedMaterialLeaf.style[property] === value) continue;
        mounted.fixedMaterialLeaf.style[property] = value;
        materialAddressWrites += 1;
      }
      if (activeMaterialRow !== presentation.rowIndex) {
        activeMaterialRow = presentation.rowIndex;
        onMaterialRowChange?.(activeMaterialRow, activeMaterialRows);
      }
      activeMaterialFrame = effectiveFrame;
      activeDefaultPresentation = presentationMode;
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
  orbit = createRetainedCubicSkyOrbit({
    stage,
    inputSurface,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_URANUS_STARFIELD,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_URANUS_SKY_SUN,
    cameraPlan: URANUS_CUBIC_CAMERA,
    objectId: "uranus",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onPublish: publish,
    onError,
  });
  return Object.freeze({
    state: orbit.state,
    setState: orbit.setState,
    setShadowsEnabled(visible) {
      const enabled = Boolean(visible);
      if (enabled === shadowsEnabled) return false;
      shadowsEnabled = enabled;
      orbit.refresh();
      return true;
    },
    setMaterialRows(rows, nextDefaultMaterial, nextShadowlessMaterial) {
      if (!Array.isArray(rows) || rows.length !== activeMaterialRows.length ||
          typeof nextDefaultMaterial !== "string" ||
          typeof nextShadowlessMaterial !== "string") {
        throw new TypeError("Uranus prepared material rows are incompatible.");
      }
      activeDefaultMaterial = nextDefaultMaterial;
      activeShadowlessMaterial = nextShadowlessMaterial;
      activeMaterialRows = Object.freeze([...rows]);
      activeMaterialFrame = -1;
      activeMaterialRow = -1;
      activeDefaultPresentation = null;
      orbit.refresh();
      return true;
    },
    stats() {
      return Object.freeze({
        ...orbit.stats(),
        transformWrites,
        materialAddressWrites,
        activeMaterialRow,
      });
    },
    destroy() {
      orbit.destroy();
    },
  });
}

export function bindUranusLensControls({
  stage,
  surfaceRoots,
  cameraControls,
  decode,
  prepareMaterialRows,
  lifetime,
  onError,
}) {
  const controls = new Map(PREPARED_URANUS_LENSES.controls.map((lens) => [lens.id, lens]));
  const root = document.querySelector(".planet-lenses");
  const buttons = [...document.querySelectorAll('button[name="lens"]')];
  if (!(root instanceof HTMLElement) || controls.size !== PREPARED_URANUS_LENSES.controls.length ||
      buttons.length !== controls.size || new Set(buttons.map((button) => button.value)).size !== buttons.length ||
      buttons.some((button) => !controls.has(button.value))) {
    throw new Error("Uranus lens selector does not match prepared lenses.");
  }
  let activeId = PREPARED_URANUS_LENSES.defaultLens;
  let desiredId = activeId;
  let ready = true;
  const events = new AbortController();
  const owner = {};
  lensOwners.set(root, owner);
  const selection = createLatestSelection({
    lifetime, onFatalError: onError,
    onBusyChange(value) {
      ready = !value;
      root.classList.toggle("is-loading", value);
      root.setAttribute("aria-busy", String(value));
    },
  });
  lifetime.onDispose(() => {
    ready = false;
    events.abort();
    if (lensOwners.get(root) !== owner) return;
    lensOwners.delete(root);
    root.classList.remove("is-loading");
    root.setAttribute("aria-busy", "false");
    for (const button of buttons) button.disabled = true;
  });
  for (const button of buttons) {
    button.addEventListener("click", () => void selectLens(button.value).catch((error) => {
      console.error(error);
    }), { signal: events.signal });
  }
  return Object.freeze({
    state() {
      return Object.freeze({ id: activeId, ready: ready && !lifetime.disposed });
    },
    select: selectLens,
  });

  async function selectLens(id) {
    const lens = controls.get(id);
    if (!lens) throw new RangeError(`Unknown Uranus lens: ${id}.`);
    if (lifetime.disposed) return false;
    desiredId = id;
    const desired = Object.freeze({ id: desiredId });
    const preparedAssets = PREPARED_URANUS_RUNTIME_SCENE.assets;
    const densityKey = String(CANONICAL_PREPARED_IMAGE_DENSITY);
    const selectedSurface = preparedAssets.surfaces[id][densityKey];
    const materialRows = preparedAssets.materialViewBank[id][densityKey].rows;
    const defaultMaterial = preparedAssets.fixedMaterial[id][densityKey];
    const shadowlessMaterial =
      preparedAssets.shadowlessMaterial[id][densityKey];
    const assets = [
      selectedSurface.surface,
      selectedSurface.poles,
      defaultMaterial,
      shadowlessMaterial,
    ];
    return selection.run({
      prepare: async ({ isCurrent }) => {
        await Promise.all(assets.map(decode));
        while (isCurrent()) {
          const materialRow = cameraControls.stats().activeMaterialRow;
          const prepared = await prepareMaterialRows(materialRows, materialRow);
          if (!isCurrent()) { prepared?.discard(); return null; }
          if (cameraControls.stats().activeMaterialRow === materialRow) return prepared;
          prepared?.discard();
        }
        return null;
      },
      commit(prepared) {
        if (!prepared || !surfaceRoots.length) throw new Error("Uranus material preparation is unavailable.");
        prepared.commit();
        for (const surfaceRoot of surfaceRoots) {
          surfaceRoot.style.setProperty("--uranus-surface-image", `url(${assets[0]})`);
          surfaceRoot.style.setProperty("--uranus-poles-image", `url(${assets[1]})`);
        }
        cameraControls.setMaterialRows(materialRows, defaultMaterial, shadowlessMaterial);
        stage.dataset.lens = desired.id;
        activeId = desired.id;
        publish();
      },
      onCurrentFailure() { desiredId = activeId; publish(); },
      discard(prepared) { prepared?.discard(); },
    });
  }

  function publish() {
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.value === activeId));
  }
}

function disableLensButtons(disabled) {
  for (const button of document.querySelectorAll('button[name="lens"]')) {
    button.disabled = disabled;
  }
}

function mesh(className, style) {
  const node = element("div", `polycss-mesh ${className}`);
  if (style) node.style.cssText = style;
  return node;
}

function textureLeaf(className, plan, url) {
  const leaf = element("s", className);
  leaf.style.cssText = plan.style;
  leaf.style.backgroundImage = `url(${url})`;
  return leaf;
}

function appendPreparedLeaves(root, plans) {
  const leaves = document.createDocumentFragment();
  for (const plan of plans) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(plan));
  }
  root.appendChild(leaves);
}

function element(tagName, className) {
  const node = document.createElement(tagName);
  node.className = className;
  node.ariaHidden = "true";
  return node;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
