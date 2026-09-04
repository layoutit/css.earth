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

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
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

export function mountEarthClient(stage) {
  const inputSurface = document.querySelector(".earth-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Earth input surface is missing.");
  }
  const materialCaches = Object.freeze({
    lighting: createEarthRowShardCache(
      PREPARED_EARTH_SCENE.material.lighting,
      { enabled: false },
    ),
    atmosphere: createEarthRowShardCache(
      PREPARED_EARTH_SCENE.material.atmosphere,
    ),
  });
  const retainedImages = new Map();
  const pendingImages = new Map();
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let camera = null;
  let features = null;
  let lenses = null;
  let animations = Object.freeze([]);
  let ready = null;
  const controller = Object.freeze({
    get ready() { return ready; },
    pause() {
      if (destroyed) return;
      shouldPlay = false;
      document.documentElement.dataset.playing = "false";
      features?.applyPlayback(false);
    },
    resume() {
      if (destroyed) return;
      shouldPlay = true;
      if (!mounted) return;
      document.documentElement.dataset.playing = "true";
      features?.applyPlayback(true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      lenses?.destroy();
      features?.destroy();
      camera?.destroy();
      mounted?.viewBank.destroy();
      mounted?.skySun.destroy();
      mounted?.cubicSky.destroy();
      mounted?.camera.remove();
      materialCaches.lighting.destroy();
      materialCaches.atmosphere.destroy();
      for (const image of retainedImages.values()) image.src = "";
      retainedImages.clear();
      pendingImages.clear();
      stage.classList.remove("earth-hide-atmosphere");
      delete stage.dataset.lens;
      delete stage.dataset.view;
      delete document.documentElement.dataset.playing;
      if (DEVELOPMENT_DIAGNOSTICS && window.__earth) delete window.__earth;
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      features = createEarthFeatureControls(stage);
      lenses = createEarthLensControls({
        stage,
        decodePreparedImage,
      });
      const initialFeatures = features.state();
      materialCaches.lighting.setEnabled(initialFeatures.shadows);
      materialCaches.atmosphere.setEnabled(initialFeatures.atmosphere);
      await Promise.all([
        decodeInitialPreparedImages(),
        materialCaches.lighting.prepareInitial(),
        materialCaches.atmosphere.prepareInitial(),
      ]);
      if (destroyed) return;
      mounted = mountPreparedEarth(stage);
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) animation.currentTime = 0;
      camera = createEarthVerticalOrbitControls({
        stage,
        inputSurface,
        mounted,
        materialCaches,
      });
      camera.refresh();
      await lenses.bindRuntime(mounted, {
        onLensChange: camera.setLens,
      });
      if (destroyed) return;
      features.bindRuntime({
        animations,
        onAtmosphereVisibilityChange: camera.setAtmosphereEnabled,
        onShadowsVisibilityChange: camera.setShadowsEnabled,
      });
      features.applyPlayback(shouldPlay);
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await waitForPreparedScenePaint();
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (destroyed) return;
      controller.destroy();
      throw error;
    }
  }

  async function decodeInitialPreparedImages() {
    const plan = PREPARED_EARTH_SCENE;
    for (const pair of [
      plan.body.assets.surface,
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
    ]) await decodePreparedImage(pair);
  }

  function decodePreparedImage(pair) {
    const url = canonicalPreparedUrl(pair);
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

  function publishDiagnostics() {
    window.__earth = Object.freeze({
      ready: true,
      pause: controller.pause,
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
            return retainedImages.size +
              materialCaches.lighting.stats().retainedImageCount +
              materialCaches.atmosphere.stats().retainedImageCount;
          },
          get pendingInteractiveImageCount() {
            return pendingImages.size;
          },
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
  }
}

function mountPreparedEarth(host) {
  const plan = PREPARED_EARTH_SCENE;
  if (plan.schema !== "cssearth-prepared-retained-scene@6" ||
      plan.interior?.schema !== "cssearth-prepared-cutaway@2") {
    throw new TypeError("Earth retained scene plan is incompatible.");
  }
  const camera = document.createElement("div");
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
      surface: canonicalPreparedUrl(plan.body.assets.surface),
      poles: canonicalPreparedUrl(plan.body.assets.poles),
    }),
  });

  const presentation = plan.interior.presentationLock;
  if (presentation?.schema !==
        "cssearth-prepared-interior-presentation-lock@1" ||
      typeof presentation.transform !== "string") {
    throw new Error("Earth prepared interior presentation is incompatible.");
  }
  const cutaway = createPreparedInterior(plan);
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
  const skySun = mountRetainedDirectionalSun({
    host,
    plan: PREPARED_EARTH_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "earth",
    before: camera,
  });
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
  mountPreparedSphereBands({
    system: cutaway,
    bands: plan.interior.outerBodyBands,
    meshTransform: plan.earth.meshTransform,
    className: "earth-cutaway-body",
    polarClassName: "earth-cutaway-body-polar",
    polarLeafClassMarker: "earth-interior-outer-polar",
    textureUrls: Object.freeze({
      surface: canonicalPreparedUrl(plan.interior.outerAssets.surface),
      poles: canonicalPreparedUrl(plan.interior.outerAssets.poles),
    }),
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
  return cutaway;
}

function mountPreparedSphereBands({
  system,
  bands,
  meshTransform,
  className,
  polarClassName,
  polarLeafClassMarker = "earth-polar",
  textureUrls,
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
    }
    carrier.style.setProperty(
      polar ? "--earth-poles-texture" : "--earth-surface-texture",
      `url("${textureUrls[polar ? "poles" : "surface"]}")`,
    );
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

function createEarthLensControls({
  stage,
  decodePreparedImage,
}) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Earth lens selector is missing.");
  }
  const controls = new Map(PREPARED_EARTH_LENSES.controls.map((lens) =>
    [lens.id, lens]));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')]
    .map((button) => [button.value, button]));
  if (buttons.size !== controls.size) {
    throw new Error("Earth lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  let active = PREPARED_EARTH_LENSES.defaultLens;
  let request = 0;
  let bound = false;
  let destroyed = false;
  let mounted = null;
  let onLensChange = null;
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
    async bindRuntime(nextMounted, runtime = {}) {
      if (destroyed) return false;
      mounted = nextMounted;
      onLensChange = runtime.onLensChange ?? null;
      bound = true;
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
      onLensChange?.(controls.get(active));
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
      onLensChange = null;
    },
  });

  async function select(id) {
    const lens = controls.get(id);
    if (!lens) throw new RangeError(`Unknown Earth lens: ${id}.`);
    if (!bound || destroyed) return false;
    const selection = ++request;
    if (lens.view === "interior") {
      await warmInterior();
    } else {
      await decodePreparedImage(lens.surfaceUrl);
      await decodePreparedImage(lens.polesUrl);
    }
    if (destroyed || selection !== request) return false;
    if (lens.view === "interior") {
      mounted.viewBank.mountInterior();
      stage.dataset.view = "interior";
      delete stage.dataset.lens;
    } else {
      publishBodyTexture(lens);
      delete stage.dataset.view;
      stage.dataset.lens = lens.id;
    }
    active = lens.id;
    publish();
    onLensChange?.(lens);
    return true;
  }

  async function warmInterior() {
    const pairs = [];
    const seen = new Set();
    const add = (pair) => {
      const url = canonicalPreparedUrl(pair);
      if (!seen.has(url)) {
        seen.add(url);
        pairs.push(pair);
      }
    };
    add(PREPARED_EARTH_SCENE.interior.outerAssets.surface);
    add(PREPARED_EARTH_SCENE.interior.outerAssets.poles);
    for (const shell of PREPARED_EARTH_SCENE.interior.shells) {
      for (const leaf of shell.leaves) add(leaf.asset);
    }
    for (const leaf of PREPARED_EARTH_SCENE.interior.sectionLeaves) {
      add(leaf.asset);
    }
    for (const pair of pairs) await decodePreparedImage(pair);
  }

  function publishBodyTexture(lens) {
    const surfaceUrl = lens.surfaceUrl;
    const polesUrl = lens.polesUrl;
    for (const carrier of mounted.bodyCarriers.surface) {
      carrier.style.setProperty("--earth-surface-texture", `url("${surfaceUrl}")`);
    }
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

function canonicalPreparedUrl(asset) {
  if (typeof asset === "string") return asset;
  return asset.url || asset.two || asset.one;
}

function createEarthFeatureControls(stage) {
  const root = document.querySelector(".planet-settings");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Earth options block is missing.");
  }
  const speed = root.querySelector('button[name="speed"]');
  const toggles = new Map(["atmosphere", "shadows"].map((name) =>
    [name, root.querySelector(`input[name="${name}"][type="checkbox"]`)]));
  if (!(speed instanceof HTMLButtonElement) ||
      [...toggles.values()].some((input) =>
        !(input instanceof HTMLInputElement))) {
    throw new Error("Earth feature controls are incomplete.");
  }
  const events = new AbortController();
  const rates = Object.freeze([
    Object.freeze({ label: "off", value: 0 }),
    Object.freeze({ label: "normal", value: 1 }),
    Object.freeze({ label: "fast", value: 2 }),
    Object.freeze({ label: "fastest", value: 3 }),
    Object.freeze({ label: "superfast", value: 4 }),
  ]);
  const classes = Object.freeze({
    atmosphere: "earth-hide-atmosphere",
  });
  let rateIndex = 1;
  let animations = Object.freeze([]);
  let shouldPlay = true;
  let onAtmosphereVisibilityChange = null;
  let onShadowsVisibilityChange = null;
  speed.addEventListener("click", () => {
    rateIndex = (rateIndex + 1) % rates.length;
    publishSpeed();
    applyPlayback(shouldPlay);
  }, { signal: events.signal });
  for (const [name, input] of toggles) {
    const className = classes[name];
    if (className) stage.classList.toggle(className, !input.checked);
    input.addEventListener("change", () => {
      if (className) stage.classList.toggle(className, !input.checked);
      if (name === "atmosphere") {
        onAtmosphereVisibilityChange?.(input.checked);
      }
      if (name === "shadows") {
        onShadowsVisibilityChange?.(input.checked);
      }
    }, { signal: events.signal });
  }
  publishSpeed();
  return Object.freeze({
    bindRuntime(runtime) {
      animations = Object.freeze(runtime.animations);
      onAtmosphereVisibilityChange =
        runtime.onAtmosphereVisibilityChange ?? null;
      onShadowsVisibilityChange =
        runtime.onShadowsVisibilityChange ?? null;
      onAtmosphereVisibilityChange?.(toggles.get("atmosphere").checked);
      onShadowsVisibilityChange?.(toggles.get("shadows").checked);
    },
    applyPlayback,
    state: () => Object.freeze({
      atmosphere: toggles.get("atmosphere").checked,
      shadows: toggles.get("shadows").checked,
    }),
    optionsState: () => Object.freeze({ speed: rates[rateIndex].value }),
    destroy() {
      for (const className of Object.values(classes)) {
        stage.classList.remove(className);
      }
      for (const animation of animations) animation.playbackRate = 1;
      events.abort();
      animations = Object.freeze([]);
      onAtmosphereVisibilityChange = null;
      onShadowsVisibilityChange = null;
    },
  });

  function publishSpeed() {
    const rate = rates[rateIndex];
    speed.dataset.state = rate.label;
    speed.setAttribute("aria-label", `Speed: ${rate.label}`);
  }

  function applyPlayback(nextShouldPlay) {
    shouldPlay = nextShouldPlay;
    const rate = rates[rateIndex].value;
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

function decodeImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image.decode().then(() => image);
}

function waitForPreparedScenePaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}
