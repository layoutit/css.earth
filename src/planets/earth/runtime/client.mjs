import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PREPARED_EARTH_LENSES } from "./preparedLenses.mjs";
import { PREPARED_EARTH_SCENE } from "./preparedScene.mjs";
import { PREPARED_EARTH_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_EARTH_STARFIELD } from "./preparedStarfield.mjs";
import { createEarthRowShardCache } from "./preparedRowCache.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { createPreparedPlanarRotationPublisher } from
  "../../../platform/prepared-planar-rotation.mjs";
import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { createPreparedImageStore } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";
import {
  createEarthSurfaceImageBanks,
  publishEarthSurfacePages,
  requireEarthSurfacePages,
} from "./surface-image-banks.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const lensOwners = new WeakMap();
const EARTH_CUBIC_CAMERA = Object.freeze({
  cameraModel: "accumulated-matrix3d",
  minimumControlPitchDegrees: 0,
  maximumControlPitchDegrees: 89,
  defaultControlPitchDegrees: 34.230769230769226,
  defaultControlYawDegrees: -105,
  materialReferenceControlPitchDegrees: 34.230769230769226,
  materialReferenceControlYawDegrees: 0,
  initialScenePitchDegrees: 40,
  maximumScenePitchDegrees: 65,
  minimumZoom: PREPARED_EARTH_SCENE.camera.minimumZoom,
  maximumZoom: PREPARED_EARTH_SCENE.camera.maximumZoom,
  defaultZoom: PREPARED_EARTH_SCENE.camera.defaultZoom,
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

export function mountEarthClient(stage, { onError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Earth requires onError.");
  const lifetime = createSceneLifetime();
  const inputSurface = document.querySelector(".earth-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Earth input surface is missing.");
  }
  const lighting = createEarthRowShardCache(
    PREPARED_EARTH_SCENE.material.lighting,
    { enabled: false, onError },
  );
  lifetime.onDispose(lighting.destroy);
  const atmosphere = createEarthRowShardCache(
    PREPARED_EARTH_SCENE.material.atmosphere,
    { onError },
  );
  lifetime.onDispose(atmosphere.destroy);
  const materialCaches = Object.freeze({ lighting, atmosphere });
  const imageStore = createPreparedImageStore();
  lifetime.onDispose(imageStore.destroy);
  let surfaceBanks = null;
  lifetime.onDispose(() => surfaceBanks?.destroy());
  let shouldPlay = false;
  let mounted = null;
  let camera = null;
  let features = null;
  let lenses = null;
  let animations = Object.freeze([]);
  let ready = null;
  let diagnostics = null;
  lifetime.onDispose(() => {
    if (window.__earth === diagnostics) delete window.__earth;
  });
  const controller = Object.freeze({
    get ready() { return ready; },
    pause() {
      if (lifetime.disposed) return;
      shouldPlay = false;
      features?.applyPlayback(false);
    },
    resume() {
      if (lifetime.disposed) return;
      shouldPlay = true;
      if (!mounted) return;
      features?.applyPlayback(true);
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Earth cleanup failed.");
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
      surfaceBanks = createEarthSurfaceImageBanks({
        imageStore,
        banks: earthSurfaceBankInventory(),
      });
      features = createEarthFeatureControls(stage, lifetime, onError);
      lenses = createEarthLensControls({
        stage,
        decodePreparedImage,
        surfaceBanks,
        lifetime,
        onError,
      });
      const initialFeatures = features.state();
      materialCaches.lighting.setEnabled(initialFeatures.shadows);
      materialCaches.atmosphere.setEnabled(initialFeatures.atmosphere);
      await Promise.all([
        decodeInitialPreparedImages(),
        materialCaches.lighting.prepareInitial(),
        materialCaches.atmosphere.prepareInitial(),
      ]);
      if (lifetime.disposed) return;
      mounted = mountPreparedEarth(stage, lifetime);
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.pause();
        animation.currentTime = 0;
      }
      camera = createEarthVerticalOrbitControls({
        stage,
        inputSurface,
        mounted,
        materialCaches,
        onError,
      });
      lifetime.onDispose(camera.destroy);
      camera.refresh();
      await lenses.bindRuntime(mounted, {
        onLensChange: camera.setLens,
      });
      if (lifetime.disposed) return;
      features.bindRuntime({
        animations,
        onAtmosphereVisibilityChange: camera.setAtmosphereEnabled,
        onShadowsVisibilityChange: camera.setShadowsEnabled,
      });
      features.applyPlayback(shouldPlay);
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (lifetime.disposed) return;
      throw error;
    }
  }

  async function decodeInitialPreparedImages() {
    const plan = PREPARED_EARTH_SCENE;
    const initial = surfaceBanks.request(PREPARED_EARTH_LENSES.defaultLens);
    const decoded = await initial.ready;
    if (lifetime.disposed) return;
    if (!decoded) throw new Error("Earth initial surface bank was retired.");
    surfaceBanks.commit(initial);
    for (const pair of [
      plan.body.assets.poles,
      ...PREPARED_EARTH_STARFIELD.faces.flatMap(({
        url,
        url2x,
        highContrastUrl,
        highContrastUrl2x,
      }) => [{ one: url, two: url2x }, {
        one: highContrastUrl,
        two: highContrastUrl2x,
      }]),
      {
        one: PREPARED_EARTH_SKY_SUN.asset.url,
        two: PREPARED_EARTH_SKY_SUN.asset.url2x,
      },
      plan.material.lighting.shadowlessAssets,
    ]) {
      if (lifetime.disposed) return;
      await decodePreparedImage(pair);
    }
  }

  function decodePreparedImage(pair) {
    return imageStore.load(canonicalPreparedUrl(pair));
  }

  function publishDiagnostics() {
    diagnostics = Object.freeze({
      ready: true,
      camera: Object.freeze({
        state: camera.state,
        setState: camera.setState,
        stats: camera.stats,
      }),
      lenses: Object.freeze({ state: lenses.state, select: lenses.select }),
      features: Object.freeze({ state: features.state }),
      options: Object.freeze({ state: features.optionsState }),
      renderStats: Object.freeze({
        textureStats: Object.freeze({
          selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
          get retainedInteractiveImageCount() {
            return imageStore.stats().retainedCount +
              materialCaches.lighting.stats().retainedImageCount +
              materialCaches.atmosphere.stats().retainedImageCount;
          },
          get pendingInteractiveImageCount() {
            return imageStore.stats().pendingCount;
          },
          surfaceBanks: surfaceBanks.stats,
          materialCaches: Object.freeze({
            lighting: materialCaches.lighting.stats,
            atmosphere: materialCaches.atmosphere.stats,
          }),
        }),
      }),
      dom: mounted.domStats,
      viewBank: Object.freeze({ state: mounted.viewBank.state }),
      stableNodes: mounted.stableNodes,
      assertStableDomIdentity: mounted.assertStableDomIdentity,
      animation: Object.freeze({ stats: camera.stats }),
    });
    window.__earth = diagnostics;
  }
}

function mountPreparedEarth(host, lifetime) {
  const plan = PREPARED_EARTH_SCENE;
  if (plan.schema !== "cssearth-prepared-retained-scene@6" ||
      plan.interior?.schema !== "cssearth-prepared-cutaway@2") {
    throw new TypeError("Earth retained scene plan is incompatible.");
  }
  const camera = document.createElement("div");
  lifetime.onDispose(() => camera.remove());
  lifetime.onDispose(() => {
    if (camera.parentNode !== host) return;
    delete host.dataset.lens;
    delete host.dataset.view;
    host.classList.remove("earth-hide-atmosphere");
  });
  delete host.dataset.view;
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = document.createElement("div");
  scene.className = "polycss-scene";
  scene.style.cssText = plan.camera.sceneStyle;
  camera.appendChild(scene);
  const system = createMesh("earth-system", plan.earth.systemTransform);
  scene.appendChild(system);

  const bodyCarriers = mountPreparedSphereBands({
    system,
    bands: plan.body.bands,
    meshTransform: plan.earth.meshTransform,
    className: "earth-body",
    polarClassName: "earth-body-polar",
    textureUrls: Object.freeze({
      surface: requireEarthSurfacePages(plan.body.assets.surface.urls),
      poles: canonicalPreparedUrl(plan.body.assets.poles),
    }),
    surfacePageCount: plan.body.assets.surface.urls.length,
  });

  const presentation = plan.interior.presentationLock;
  if (presentation?.schema !==
        "cssearth-prepared-interior-presentation-lock@1" ||
      typeof presentation.transform !== "string") {
    throw new Error("Earth prepared interior presentation is incompatible.");
  }
  const interiorMount = createPreparedInterior(plan);
  const cutaway = interiorMount.root;
  let cutawayCounter = createMesh("earth-cutaway-counter", "");
  const presentationRoot = createMesh(
    "earth-cutaway-presentation",
    presentation.transform,
  );
  const cutawaySystem = createMesh(
    "earth-system earth-cutaway-system",
    plan.earth.systemTransform,
  );
  cutawaySystem.appendChild(cutaway);
  presentationRoot.appendChild(cutawaySystem);
  cutawayCounter.appendChild(presentationRoot);
  scene.appendChild(cutawayCounter);

  let destroyedViewBank = false;
  const viewBank = Object.freeze({
    mountInterior() {
      if (destroyedViewBank) {
        throw new Error("Earth prepared view bank is destroyed.");
      }
      return false;
    },
    publishSurfacePages(urls) {
      if (destroyedViewBank) throw new Error("Earth prepared view bank is destroyed.");
      publishEarthSurfacePages(interiorMount.carriers.surface, urls,
        plan.interior.outerAssets.surface.twoUrls.length);
    },
    clearSurfacePages() {
      publishEarthSurfacePages(interiorMount.carriers.surface, [],
        plan.interior.outerAssets.surface.twoUrls.length);
    },
    syncCounterRotation(counterRotation) {
      if (cutawayCounter) cutawayCounter.style.transform = counterRotation;
    },
    state() {
      return Object.freeze({
        interiorMounted: Boolean(cutaway),
        interiorLeafCount:
          cutaway?.querySelectorAll("b, s, u").length ?? 0,
      });
    },
    destroy() {
      if (destroyedViewBank) return;
      destroyedViewBank = true;
      cutawayCounter?.remove();
      cutawayCounter = null;
    },
  });
  lifetime.onDispose(viewBank.destroy);

  const materialSystem = createMesh("earth-system", plan.earth.systemTransform);
  const materialMesh = createMesh("earth-material", plan.material.transform);
  const lightingLeaf = createTextureLeaf(plan.material.lighting.leaf);
  const atmosphereLeaf = createTextureLeaf(plan.material.atmosphere.leaf);
  applyPreparedDefaultMaterial(plan.material.lighting, lightingLeaf);
  applyPreparedDefaultMaterial(plan.material.atmosphere, atmosphereLeaf);
  materialMesh.append(lightingLeaf, atmosphereLeaf);
  materialSystem.appendChild(materialMesh);
  const materialCounter = createMesh("earth-material-counter", "");
  materialCounter.appendChild(materialSystem);
  scene.appendChild(materialCounter);

  host.replaceChildren(camera);
  const cubicSky = mountRetainedCubicSky({
    host,
    plan: PREPARED_EARTH_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "earth",
    requireSun: false,
  });
  lifetime.onDispose(cubicSky.destroy);
  const skySun = mountRetainedDirectionalSun({
    host,
    plan: PREPARED_EARTH_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "earth",
    before: camera,
  });
  lifetime.onDispose(skySun.destroy);
  const layerRegistration = registerBodyDependentLayers({
    objectId: "earth",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [materialCounter],
  });
  host.dataset.lens = "normal";
  const stableNodes = Object.freeze([
    ...host.querySelectorAll("*"),
  ]);
  const stableParents = stableNodes.map((node) => node.parentNode);
  const initialLeaves = Object.freeze([...host.querySelectorAll("b, s, u")]);
  const domStats = Object.freeze({
    mode: "semantic-transform-groups-with-bare-leaves-and-retained-view-bank",
    retainedInitialNodeCount: stableNodes.length,
    retainedLeafCount: initialLeaves.length,
    maximumRetainedLeafCount: plan.counts.maximumRetainedLeafCount,
    onDemandPreparedLeafCount: 0,
    onDemandPreparedInteriorLeafCount: 0,
    retainedTransformGroupCount:
      host.querySelectorAll(".polycss-mesh").length,
    runtimeDomGrowth: false,
    runtimeDomGrowthPolicy: "none",
  });
  return Object.freeze({
    camera,
    scene,
    system,
    cubicSky,
    skySun,
    materialCounter,
    materialSystem,
    lightingLeaf,
    atmosphereLeaf,
    bodyCarriers,
    viewBank,
    stableNodes,
    domStats,
    assertStableDomIdentity() {
      for (let index = 0; index < stableNodes.length; index += 1) {
        if (!stableNodes[index].isConnected ||
            stableNodes[index].parentNode !== stableParents[index]) {
          throw new Error(
            `Earth retained DOM identity changed at node ${index}.`,
          );
        }
      }
      layerRegistration.assertRegistered();
      return true;
    },
  });
}

function createPreparedInterior(plan) {
  const cutaway = createMesh("earth-cutaway", "");
  const carriers = mountPreparedSphereBands({
    system: cutaway,
    bands: plan.interior.outerBodyBands,
    meshTransform: plan.earth.meshTransform,
    className: "earth-cutaway-body",
    polarClassName: "earth-cutaway-body-polar",
    polarLeafClassMarker: "earth-interior-outer-polar",
    textureUrls: Object.freeze({
      // Retain the cutaway nodes without referencing its large hidden atlas.
      surface: [],
      poles: canonicalPreparedUrl(plan.interior.outerAssets.poles),
    }),
    surfacePageCount: plan.interior.outerAssets.surface.twoUrls.length,
  });
  for (const shell of plan.interior.shells) {
    const shellMesh = createMesh(
      `earth-interior-shell ${shell.className}`,
      plan.earth.meshTransform,
    );
    const fragment = document.createDocumentFragment();
    for (const leaf of shell.leaves) {
      const element = createTextureLeaf(leaf);
      element.style.backgroundImage =
        `url("${canonicalPreparedUrl(leaf.asset)}")`;
      fragment.appendChild(element);
    }
    shellMesh.appendChild(fragment);
    cutaway.appendChild(shellMesh);
  }
  const sections = createMesh(
    "earth-interior-sections",
    plan.earth.meshTransform,
  );
  const sectionFragment = document.createDocumentFragment();
  for (const leaf of plan.interior.sectionLeaves) {
    const element = createTextureLeaf(leaf);
    element.style.backgroundImage =
      `url("${canonicalPreparedUrl(leaf.asset)}")`;
    if (leaf.backfaceVisible) element.style.backfaceVisibility = "visible";
    sectionFragment.appendChild(element);
  }
  sections.appendChild(sectionFragment);
  cutaway.appendChild(sections);
  return Object.freeze({ root: cutaway, carriers });
}

function mountPreparedSphereBands({
  system,
  bands,
  meshTransform,
  className,
  polarClassName,
  polarLeafClassMarker = "earth-polar",
  textureUrls,
  surfacePageCount,
}) {
  const carriers = new Map();
  const surface = [];
  const polarCarriers = [];
  for (const band of bands) {
    if (band.leaves.length === 0) continue;
    const polar = band.leaves.some(({ className: leafClassName }) =>
      leafClassName?.includes(polarLeafClassMarker));
    const key = `${polar ? "polar" : "body"}:${band.visualRotationSeconds}`;
    let carrier = carriers.get(key);
    if (!carrier) {
      carrier = createMesh(
        polar ? `${className} ${polarClassName}` : className,
        `${meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      carriers.set(key, carrier);
      if (polar) polarCarriers.push(carrier);
      else surface.push(carrier);
      system.appendChild(carrier);
      if (polar) {
        carrier.style.setProperty("--earth-poles-texture", `url("${textureUrls.poles}")`);
      } else {
        publishEarthSurfacePages([carrier], textureUrls.surface, surfacePageCount);
      }
    }
    const fragment = document.createDocumentFragment();
    for (const leaf of band.leaves) fragment.appendChild(createTextureLeaf(leaf));
    carrier.appendChild(fragment);
  }
  return Object.freeze({
    surface: Object.freeze(surface),
    polar: Object.freeze(polarCarriers),
    all: Object.freeze([...surface, ...polarCarriers]),
  });
}

function createTextureLeaf(prepared) {
  return createPreparedProjectiveTextureLeaf(prepared);
}

function createEarthVerticalOrbitControls({
  stage,
  inputSurface,
  mounted,
  materialCaches,
  onError,
}) {
  let orbit = null;
  let baseLightAzimuthDegrees = null;
  let materialAddressWrites = 0;
  let atmosphereEnabled = true;
  let exteriorEnabled = true;
  let lightingLensEnabled = true;
  let shadowsEnabled = false;
  const publishLightingRoll = createPreparedPlanarRotationPublisher({
    element: mounted.lightingLeaf,
    width: PREPARED_EARTH_SCENE.material.lighting.presentationTileSize,
  });
  const publishAtmosphereRoll = createPreparedPlanarRotationPublisher({
    element: mounted.atmosphereLeaf,
    width: PREPARED_EARTH_SCENE.material.atmosphere.presentationTileSize,
  });
  const publishMaterialDirection = ({
    sunViewDirection,
    counterRotation,
    controlPitch,
  }) => {
    mounted.materialCounter.style.transform = counterRotation;
    mounted.viewBank.syncCounterRotation(counterRotation);
    const frameCount = PREPARED_EARTH_SCENE.material.lighting.frameCount;
    const frameIndex = Math.round(clamp(
      (sunViewDirection[2] + 1) / 2,
      0,
      1,
    ) * (frameCount - 1));
    const scenePitchDegrees = 65 - frameIndex / (frameCount - 1) * 65;
    const lightingPlan = PREPARED_EARTH_SCENE.material.lighting;
    materialAddressWrites += shadowsEnabled
      ? publishPreparedMaterial(
        lightingPlan,
        mounted.lightingLeaf,
        materialCaches.lighting,
        scenePitchDegrees,
        frameIndex,
      )
      : publishPreparedShadowlessMaterial(
        lightingPlan,
        mounted.lightingLeaf,
      );
    const atmospherePlan = PREPARED_EARTH_SCENE.material.atmosphere;
    materialAddressWrites += publishPreparedMaterial(
      atmospherePlan,
      mounted.atmosphereLeaf,
      materialCaches.atmosphere,
      scenePitchDegrees,
      frameIndex,
    );
    const azimuth = Math.atan2(
      sunViewDirection[1],
      sunViewDirection[0],
    ) * 180 / Math.PI;
    baseLightAzimuthDegrees ??= azimuth;
    const directionalRoll = normalizeDegrees(azimuth - baseLightAzimuthDegrees);
    publishLightingRoll(shadowsEnabled ? directionalRoll : 0);
    publishAtmosphereRoll(directionalRoll);
  };
  materialCaches.lighting.onReady(() => orbit?.refresh());
  materialCaches.atmosphere.onReady(() => orbit?.refresh());
  orbit = createRetainedCubicSkyOrbit({
    stage,
    inputSurface,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_EARTH_STARFIELD,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_EARTH_SKY_SUN,
    cameraPlan: EARTH_CUBIC_CAMERA,
    objectId: "earth",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onPublish: publishMaterialDirection,
    onError,
  });
  return Object.freeze({
    mobilePageFlow: orbit.mobilePageFlow,
    refresh: orbit.refresh,
    setState: orbit.setState,
    state: orbit.state,
    setAtmosphereEnabled(visible) {
      atmosphereEnabled = Boolean(visible);
      syncMaterialCacheVisibility();
      orbit.refresh();
    },
    setLens(lens) {
      exteriorEnabled = lens?.view !== "interior";
      lightingLensEnabled = lens?.id !== "night-lights";
      syncMaterialCacheVisibility();
      orbit.refresh();
    },
    setShadowsEnabled(visible) {
      shadowsEnabled = Boolean(visible);
      syncMaterialCacheVisibility();
      orbit.refresh();
    },
    stats() {
      return Object.freeze({
        ...orbit.stats(),
        materialAddressWrites,
      });
    },
    destroy() {
      materialCaches.lighting.onReady(null);
      materialCaches.atmosphere.onReady(null);
      orbit.destroy();
    },
  });

  function syncMaterialCacheVisibility() {
    materialCaches.lighting.setEnabled(
      exteriorEnabled && lightingLensEnabled && shadowsEnabled,
    );
    materialCaches.atmosphere.setEnabled(
      exteriorEnabled && atmosphereEnabled,
    );
  }
}

function applyPreparedDefaultMaterial(plan, leaf) {
  const frame = plan.defaultPresentation;
  let writes = 0;
  writes += setStyle(leaf, "transform", frame.transform);
  const assetUrl = canonicalPreparedUrl(frame.assets);
  writes += setStyle(leaf, "backgroundImage", `url("${assetUrl}")`);
  writes += setStyle(leaf, "backgroundPosition", frame.backgroundPosition);
  writes += setStyle(leaf, "backgroundSize", frame.backgroundSize);
  leaf.dataset.materialFrame = "default";
  return writes;
}

function publishPreparedMaterial(plan, leaf, cache, scenePitchDegrees,
  frameIndex) {
  if (Math.abs(scenePitchDegrees - plan.defaultScenePitchDegrees) < 0.01) {
    if (leaf.dataset.materialFrame === "default") return 0;
    const frame = plan.defaultPresentation;
    let writes = 0;
    writes += setStyle(
      leaf,
      "backgroundImage",
      `url("${canonicalPreparedUrl(frame.assets)}")`,
    );
    writes += setStyle(leaf, "backgroundPosition", frame.backgroundPosition);
    writes += setStyle(leaf, "backgroundSize", frame.backgroundSize);
    leaf.dataset.materialFrame = "default";
    return writes;
  }
  const selectedFrame = clamp(frameIndex, 0, plan.frameCount - 1);
  const presentation = cache.presentation(selectedFrame);
  if (!presentation ||
      leaf.dataset.materialFrame === String(selectedFrame)) return 0;
  let writes = 0;
  writes += setStyle(leaf, "backgroundImage", `url("${presentation.url}")`);
  writes += setStyle(
    leaf,
    "backgroundPosition",
    presentation.backgroundPosition,
  );
  writes += setStyle(leaf, "backgroundSize", presentation.backgroundSize);
  leaf.dataset.materialFrame = String(selectedFrame);
  return writes;
}

function publishPreparedShadowlessMaterial(plan, leaf) {
  if (leaf.dataset.materialFrame === "shadowless") return 0;
  const presentation = plan.shadowlessPresentation;
  let writes = 0;
  writes += setStyle(
    leaf,
    "backgroundImage",
    `url("${canonicalPreparedUrl(presentation.assets)}")`,
  );
  writes += setStyle(
    leaf,
    "backgroundPosition",
    presentation.backgroundPosition,
  );
  writes += setStyle(leaf, "backgroundSize", presentation.backgroundSize);
  leaf.dataset.materialFrame = "shadowless";
  return writes;
}

function setStyle(element, property, value) {
  if (element.style[property] === value) return 0;
  element.style[property] = value;
  return 1;
}

export function createEarthLensControls({
  stage,
  decodePreparedImage,
  surfaceBanks,
  lifetime,
  onError,
}) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Earth lens selector is missing.");
  }
  const controls = new Map(PREPARED_EARTH_LENSES.controls.map((lens) =>
    [lens.id, lens]));
  const buttonList = [...root.querySelectorAll('button[name="lens"]')];
  const buttons = new Map(buttonList
    .map((button) => [button.value, button]));
  if (buttons.size !== controls.size || buttonList.length !== buttons.size ||
      controls.size !== PREPARED_EARTH_LENSES.controls.length ||
      [...controls.keys()].some((id) => !buttons.has(id))) {
    throw new Error("Earth lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  const owner = {};
  lensOwners.set(root, owner);
  let active = PREPARED_EARTH_LENSES.defaultLens;
  let bound = false;
  let busy = false;
  let mounted = null;
  let onLensChange = null;
  const selection = createLatestSelection({
    lifetime,
    onFatalError: onError,
    onBusyChange(value) {
      busy = value;
      root.classList.toggle("is-loading", value);
      root.setAttribute("aria-busy", String(value));
    },
  });
  lifetime.onDispose(() => {
    bound = false;
    events.abort();
    mounted = null;
    onLensChange = null;
    if (lensOwners.get(root) !== owner) return;
    lensOwners.delete(root);
    root.classList.remove("is-loading");
    root.setAttribute("aria-busy", "false");
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
    state: () => Object.freeze({ id: active, ready: bound && !busy && !lifetime.disposed }),
    select,
    async bindRuntime(nextMounted, runtime = {}) {
      if (lifetime.disposed) return false;
      mounted = nextMounted;
      onLensChange = runtime.onLensChange ?? null;
      bound = true;
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
      onLensChange?.(controls.get(active));
      return true;
    },
  });

  async function select(id) {
    const lens = controls.get(id);
    if (!lens) throw new RangeError(`Unknown Earth lens: ${id}.`);
    if (!bound || lifetime.disposed) return false;
    let ticket;
    return selection.run({
      prepare: async ({ isCurrent }) => {
        ticket = surfaceBanks.request(id);
        const decoded = await ticket.ready;
        if (!isCurrent()) return ticket;
        if (!decoded) throw new Error("Earth requested surface bank was retired.");
        if (lens.view === "interior") await warmInterior(isCurrent);
        else await decodePreparedImage(lens.polesUrl);
        return ticket;
      },
      commit(prepared) {
        if (!mounted) throw new Error("Earth presentation is unavailable.");
        if (lens.view === "interior") {
          mounted.viewBank.mountInterior();
          mounted.viewBank.publishSurfacePages(prepared.urls);
          stage.dataset.view = "interior";
          delete stage.dataset.lens;
          publishEarthSurfacePages(mounted.bodyCarriers.surface, [],
            PREPARED_EARTH_SCENE.body.assets.surface.urls.length);
        } else {
          publishBodyTexture(lens);
          delete stage.dataset.view;
          stage.dataset.lens = lens.id;
          mounted.viewBank.clearSurfacePages();
        }
        onLensChange?.(lens);
        active = lens.id;
        publish();
        surfaceBanks.commit(prepared);
      },
      discard: (prepared) => surfaceBanks.discard(prepared),
      onCurrentFailure() {
        surfaceBanks.discard(ticket);
        publish();
      },
    });
  }

  async function warmInterior(isCurrent) {
    const pairs = [];
    const seen = new Set();
    const add = (pair) => {
      const url = canonicalPreparedUrl(pair);
      if (!seen.has(url)) {
        seen.add(url);
        pairs.push(pair);
      }
    };
    add(PREPARED_EARTH_SCENE.interior.outerAssets.poles);
    for (const shell of PREPARED_EARTH_SCENE.interior.shells) {
      for (const leaf of shell.leaves) add(leaf.asset);
    }
    for (const leaf of PREPARED_EARTH_SCENE.interior.sectionLeaves) {
      add(leaf.asset);
    }
    for (const pair of pairs) {
      if (!isCurrent()) return;
      await decodePreparedImage(pair);
    }
  }

  function publishBodyTexture(lens) {
    const polesUrl = lens.polesUrl;
    publishEarthSurfacePages(mounted.bodyCarriers.surface, lens.surfaceUrls,
      PREPARED_EARTH_SCENE.body.assets.surface.urls.length);
    for (const carrier of mounted.bodyCarriers.polar) {
      carrier.style.setProperty("--earth-poles-texture", `url("${polesUrl}")`);
    }
  }

  function publish() {
    for (const [id, button] of buttons) {
      button.setAttribute("aria-pressed", String(id === active));
    }
  }
}

function earthSurfaceBankInventory() {
  const body = PREPARED_EARTH_SCENE.body.assets.surface;
  const bodyPages = requireEarthSurfacePages(body.urls, "Earth default surface");
  const outer = PREPARED_EARTH_SCENE.interior.outerAssets.surface;
  const outerOne = requireEarthSurfacePages(outer.oneUrls, "Earth interior source surface");
  const outerTwo = requireEarthSurfacePages(outer.twoUrls, "Earth canonical interior surface");
  if (outer.one !== outerOne[0] || outer.two !== outerTwo[0] ||
      outerOne.length !== bodyPages.length || outerTwo.length !== bodyPages.length ||
      body.url !== bodyPages[0]) {
    throw new TypeError("Earth prepared surface page metadata is inconsistent.");
  }
  const banks = PREPARED_EARTH_LENSES.controls.map((lens) => {
    const urls = lens.view === "interior" ? outerTwo
      : requireEarthSurfacePages(lens.surfaceUrls, `Earth ${lens.id} surface`);
    if (urls.length !== bodyPages.length || lens.view !== "interior" && lens.surfaceUrl !== urls[0]) {
      throw new TypeError("Earth lens surface page metadata is inconsistent.");
    }
    if (lens.id === PREPARED_EARTH_LENSES.defaultLens &&
        JSON.stringify(urls) !== JSON.stringify(bodyPages)) {
      throw new TypeError("Earth default lens does not match its prepared surface pages.");
    }
    return Object.freeze({ id: lens.id, urls });
  });
  return Object.freeze(banks);
}

function canonicalPreparedUrl(asset) {
  if (typeof asset === "string") return asset;
  return asset.url || asset.two || asset.one;
}

function createEarthFeatureControls(stage, lifetime, onError) {
  const root = document.querySelector(".planet-settings");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Earth options block is missing.");
  }
  const speed = root.querySelector('input[name="speed"][type="range"]');
  const toggles = new Map(["atmosphere", "shadows"].map((name) =>
    [name, root.querySelector(`input[name="${name}"][type="checkbox"]`)]));
  if (!(speed instanceof HTMLInputElement) ||
      [...toggles.values()].some((input) =>
        !(input instanceof HTMLInputElement))) {
    throw new Error("Earth feature controls are incomplete.");
  }
  const events = new AbortController();
  const classes = Object.freeze({
    atmosphere: "earth-hide-atmosphere",
  });
  let animations = Object.freeze([]);
  let shouldPlay = false;
  let rate = 1;
  let onAtmosphereVisibilityChange = null;
  let onShadowsVisibilityChange = null;
  const speedControl = bindSpeedControl({
    input: speed, lifetime, onError,
    onChange(nextRate) { rate = nextRate; applyPlayback(shouldPlay); },
  });
  lifetime.onDispose(() => {
    events.abort();
    animations = Object.freeze([]);
    onAtmosphereVisibilityChange = null;
    onShadowsVisibilityChange = null;
  });
  for (const [name, input] of toggles) {
    const className = classes[name];
    if (className) stage.classList.toggle(className, !input.checked);
    input.addEventListener("change", () => {
      if (lifetime.disposed) return;
      try {
        if (className) stage.classList.toggle(className, !input.checked);
        if (name === "atmosphere") onAtmosphereVisibilityChange?.(input.checked);
        if (name === "shadows") onShadowsVisibilityChange?.(input.checked);
      } catch (error) { onError(error); }
    }, { signal: events.signal });
  }
  return Object.freeze({
    bindRuntime(runtime) {
      animations = Object.freeze(runtime.animations);
      onAtmosphereVisibilityChange =
        runtime.onAtmosphereVisibilityChange ?? null;
      onShadowsVisibilityChange =
        runtime.onShadowsVisibilityChange ?? null;
      onAtmosphereVisibilityChange?.(toggles.get("atmosphere").checked);
      onShadowsVisibilityChange?.(toggles.get("shadows").checked);
      applyPlayback(shouldPlay);
      speedControl.setEnabled(true);
    },
    applyPlayback,
    state: () => Object.freeze({
      atmosphere: toggles.get("atmosphere").checked,
      shadows: toggles.get("shadows").checked,
    }),
    optionsState: () => Object.freeze({ speed: speedControl.state().speed }),
  });

  function applyPlayback(nextShouldPlay) {
    shouldPlay = nextShouldPlay;
    for (const animation of animations) {
      animation.playbackRate = rate || 1;
      if (shouldPlay && rate > 0) animation.play();
      else animation.pause();
    }
  }
}

function createMesh(className, style) {
  const element = document.createElement("div");
  element.className = className.includes("polycss-mesh")
    ? className
    : `polycss-mesh ${className}`;
  if (style) element.style.cssText = style;
  return element;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}
