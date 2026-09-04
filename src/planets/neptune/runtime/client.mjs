import { createPlanetFeatureControls } from "../../../platform/planet-feature-controls.mjs";
import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from
  "../../../platform/prepared-planar-rotation.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { PREPARED_NEPTUNE_LENSES } from "./preparedLenses.mjs";
import { PREPARED_NEPTUNE_SCENE } from "./preparedScene.mjs";
import { PREPARED_NEPTUNE_SKY_SUN } from "./preparedSkySun.mjs";
import { PREPARED_NEPTUNE_STARFIELD } from "./preparedStarfield.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const RING_2X_URL = "/scenes/neptune/neptune-rings@2x.webp";
const NEPTUNE_CUBIC_CAMERA = Object.freeze({
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

export function mountNeptuneClient(stage) {
  const inputSurface = document.querySelector(".neptune-input-surface");
  if (!(inputSurface instanceof HTMLElement)) throw new Error("Neptune input surface is missing.");
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let orbitCamera = null;
  let orbitMaterialCache = null;
  let featureControls = null;
  let lensControls = null;
  let sceneAnimations = Object.freeze([]);
  let resourcesReleased = false;
  const controller = Object.freeze({
    get ready() { return ready; },
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
      if (DEVELOPMENT_DIAGNOSTICS && window.__neptune) delete window.__neptune;
    },
  });
  const ready = start();
  return controller;

  async function start() {
    try {
      featureControls = createPlanetFeatureControls({
        stage,
        classes: Object.freeze({
          rings: "neptune-hide-rings",
          shadows: "neptune-hide-shadows",
        }),
        onShadowsVisibilityChange(visible) {
          orbitCamera?.setShadowsEnabled(visible);
        },
      });
      lensControls = createLensControls({ stage });
      orbitMaterialCache = createPreparedOrbitMaterialCache(
        PREPARED_NEPTUNE_LENSES,
      );
      const normal = PREPARED_NEPTUNE_LENSES.controls.find(({ id }) => id === PREPARED_NEPTUNE_LENSES.defaultLens);
      await Promise.all([
        lensControls.prepare(normal.id),
        decodeImage(RING_2X_URL),
        ...PREPARED_NEPTUNE_STARFIELD.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodeImage(url, url2x),
          decodeImage(highContrastUrl, highContrastUrl2x),
        ]),
        decodeImage(
          PREPARED_NEPTUNE_SKY_SUN.asset.url,
          PREPARED_NEPTUNE_SKY_SUN.asset.url2x,
        ),
        orbitMaterialCache.prepareInitial(
          PREPARED_NEPTUNE_SCENE.camera.orbitPlayback.initialScenePitchDegrees,
        ),
      ]);
      if (destroyed) return;
      mounted = mountPreparedScene(stage, PREPARED_NEPTUNE_SCENE);
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of sceneAnimations) {
        animation.currentTime = 0;
        if (!shouldPlay) animation.pause();
      }
      await nextPaint();
      if (destroyed) return;
      orbitCamera = createNeptuneCubicOrbit({
        stage,
        inputSurface,
        mounted,
        orbitMaterialCache,
        initialLens: PREPARED_NEPTUNE_LENSES.defaultLens,
      });
      mounted.ringLeaf.style.backgroundImage = `url("${RING_2X_URL}")`;
      lensControls.bindRuntime({
        materialLeaf: mounted.fixedMaterialLeaf,
        orbitCamera,
      });
      featureControls.bindRuntime({ animations: sceneAnimations });
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      if (DEVELOPMENT_DIAGNOSTICS) {
        window.__neptune = Object.freeze({
        ready: true,
        pause: controller.pause,
        camera: Object.freeze({ state: orbitCamera.state, setState: orbitCamera.setState, stats: orbitCamera.stats }),
        features: Object.freeze({ state: featureControls.state }),
        options: Object.freeze({ state: featureControls.optionsState }),
        lenses: Object.freeze({ state: lensControls.state, select: lensControls.select }),
        renderStats: Object.freeze({
          textureStats: Object.freeze({
            selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
            get retainedInteractiveImageCount() {
              return orbitMaterialCache?.stats().retainedRowCount ?? 0;
            },
          }),
        }),
        dom: mounted.domStats,
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
    featureControls?.destroy();
    featureControls = null;
    lensControls?.destroy();
    lensControls = null;
    orbitCamera?.destroy();
    orbitCamera = null;
    orbitMaterialCache?.destroy();
    orbitMaterialCache = null;
    mounted?.skySun.destroy();
    mounted?.cubicSky.destroy();
    mounted?.camera.remove();
    mounted = null;
    sceneAnimations = Object.freeze([]);
    delete stage.dataset.lens;
    stage.style.removeProperty("--neptune-surface-image");
    stage.style.removeProperty("--neptune-poles-image");
  }
}

function mountPreparedScene(host, plan) {
  if (plan.schema !== "cssneptune-prepared-runtime-scene@1") throw new TypeError("Neptune retained scene plan is incompatible.");
  const camera = document.createElement("div");
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = createMesh("polycss-scene", plan.camera.initialTransform);
  scene.ariaHidden = "true";
  const system = createMesh("neptune-system", plan.systemTransform);
  const ring = createMesh("neptune-ring-plane", plan.meshTransform);
  const ringLeaf = createTextureLeaf(plan.ring.leaf);
  ring.appendChild(ringLeaf);
  system.appendChild(ring);
  const bodyCarrierMap = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("neptune-polar"));
    const key = polar ? "polar" : "body";
    let body = bodyCarrierMap.get(key);
    if (!body) {
      body = createMesh(
        polar ? "neptune-body neptune-body-polar" : "neptune-body",
        `${plan.meshTransform};animation-duration:${plan.motion.bodyVisualRotationSeconds}s`,
      );
      bodyCarrierMap.set(key, body);
      system.appendChild(body);
    }
    const leaves = document.createDocumentFragment();
    for (const leaf of band.leaves) leaves.appendChild(createTextureLeaf(leaf));
    body.appendChild(leaves);
  }
  scene.appendChild(system);
  camera.appendChild(scene);

  const fixedMaterialCounter = createMesh(
    "neptune-fixed-material-counter",
    "",
  );
  const fixedMaterialMesh = createMesh(
    "neptune-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialLeaf = createTextureLeaf(plan.fixedMaterialPlane.leaf);
  fixedMaterialLeaf.classList.add("neptune-exterior-material");
  fixedMaterialMesh.appendChild(fixedMaterialLeaf);
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  system.appendChild(fixedMaterialCounter);

  host.replaceChildren(camera);
  const cubicSky = mountRetainedCubicSky({
    host,
    plan: PREPARED_NEPTUNE_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "neptune",
    requireSun: false,
  });
  const skySun = mountRetainedDirectionalSun({
    host,
    plan: PREPARED_NEPTUNE_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "neptune",
    before: camera,
  });
  const layerRegistration = registerBodyDependentLayers({
    objectId: "neptune",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [fixedMaterialCounter],
  });
  const stableNodes = Object.freeze([...host.querySelectorAll("*")]);
  const stableParents = Object.freeze(stableNodes.map((node) => node.parentNode));
  const retainedLeaves = Object.freeze([
    ...host.querySelectorAll(".polycss-scene b, .polycss-scene s, .polycss-scene u"),
  ]);
  const domStats = Object.freeze({
    mode: "semantic-transform-groups-with-bare-leaves",
    retainedInitialNodeCount: stableNodes.length,
    retainedCameraRootCount: 1,
    retainedMaterialCompositeRootCount: 0,
    retainedSceneRootCount: 1,
    retainedLeafCount: retainedLeaves.length,
    retainedCubicSkyFaceCount: cubicSky.faceCount,
  });
  return Object.freeze({
    camera,
    scene,
    system,
    cubicSky,
    skySun,
    fixedMaterialCounter,
    fixedMaterialMesh,
    fixedMaterialLeaf,
    ringLeaf,
    bodyCarriers: Object.freeze([...bodyCarrierMap.values()]),
    stableNodes,
    domStats,
    assertStableDomIdentity() {
      const stable = stableNodes.length === host.querySelectorAll("*").length &&
        stableNodes.every((node, index) =>
          node.isConnected && node.parentNode === stableParents[index]);
      return stable && layerRegistration.assertRegistered();
    },
  });
}

async function loadPreparedOrbitBank(descriptor, cameraPlan) {
  const sceneVariableMatrixIndexes = Object.freeze([
    0, 1, 2,
    4, 5, 6,
    8, 9, 10,
  ]);
  const materialVariableMatrixIndexes = Object.freeze([
    0, 1, 2,
    4, 5, 6,
    8, 9, 10,
    12, 13, 14,
  ]);
  if (descriptor?.schema !== "cssneptune-prepared-orbit-bank@3" ||
      descriptor.encoding !==
        "gzip-float64-le-column-major-variable-matrix-coefficients" ||
      descriptor.asset?.url !==
        "/scenes/neptune/neptune-orbit-bank.f64z" ||
      !Number.isSafeInteger(descriptor.asset.byteLength) ||
      descriptor.asset.byteLength <= 0 ||
      descriptor.stateCount !== cameraPlan.stateCount ||
      descriptor.stateStepDegrees !== cameraPlan.stateStepDegrees ||
      descriptor.minimumControlPitchDegrees !==
        cameraPlan.minimumControlPitchDegrees ||
      descriptor.maximumControlPitchDegrees !==
        cameraPlan.maximumControlPitchDegrees ||
      descriptor.materialStateCount !== 256 ||
      descriptor.materialMinimumScenePitchDegrees !== 0 ||
      descriptor.materialMaximumScenePitchDegrees !== 65 ||
      descriptor.sceneVariableMatrixIndexes?.join(",") !==
        sceneVariableMatrixIndexes.join(",") ||
      descriptor.materialVariableMatrixIndexes?.join(",") !==
        materialVariableMatrixIndexes.join(",") ||
      descriptor.sceneConstantMatrix?.length !== 16 ||
      descriptor.materialConstantMatrix?.length !== 16 ||
      descriptor.valueCount !==
        descriptor.stateCount * sceneVariableMatrixIndexes.length +
          descriptor.materialStateCount *
            materialVariableMatrixIndexes.length ||
      descriptor.decodedByteLength !==
        descriptor.valueCount * Float64Array.BYTES_PER_ELEMENT ||
      descriptor.runtimeInterpolation !== false ||
      descriptor.runtimeMatrixConstructionForPitch !== false ||
      descriptor.runtimeMatrixConstructionForZoom !== true ||
      descriptor.runtimeMaterialMatrixConstructionForPitch !== false) {
    throw new Error("Neptune prepared orbit transport descriptor drifted.");
  }
  const response = await fetch(descriptor.asset.url);
  if (!response.ok) {
    throw new Error(
      `Neptune prepared orbit transport failed with ${response.status}.`,
    );
  }
  const encoded = await response.arrayBuffer();
  if (encoded.byteLength !== descriptor.asset.byteLength) {
    throw new Error("Neptune prepared orbit encoded byte length drifted.");
  }
  const decoded = await new Response(
    new Blob([encoded]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  if (decoded.byteLength !== descriptor.decodedByteLength) {
    throw new Error("Neptune prepared orbit decoded byte length drifted.");
  }
  const values = float64LittleEndianValues(decoded, descriptor.valueCount);
  const sceneColumns = sceneVariableMatrixIndexes.map((_, columnIndex) =>
    values.subarray(
      columnIndex * descriptor.stateCount,
      (columnIndex + 1) * descriptor.stateCount,
    ));
  const materialValueOffset = descriptor.stateCount *
    sceneVariableMatrixIndexes.length;
  const materialColumns = materialVariableMatrixIndexes.map(
    (_, columnIndex) => values.subarray(
      materialValueOffset + columnIndex * descriptor.materialStateCount,
      materialValueOffset +
        (columnIndex + 1) * descriptor.materialStateCount,
    ),
  );
  const sceneConstant = descriptor.sceneConstantMatrix;
  const materialConstant = descriptor.materialConstantMatrix;
  return Object.freeze({
    sceneStateCount: descriptor.stateCount,
    materialStateCount: descriptor.materialStateCount,
    sceneTransform(stateIndex) {
      if (!Number.isSafeInteger(stateIndex) || stateIndex < 0 ||
          stateIndex >= descriptor.stateCount) {
        throw new RangeError("Neptune prepared scene matrix address drifted.");
      }
      if (stateIndex === descriptor.defaultStateIndex) {
        return cameraPlan.initialTransform;
      }
      const value = (columnIndex) => sceneColumns[columnIndex][stateIndex];
      return `matrix3d(${value(0)}, ${value(1)}, ${value(2)}, ${sceneConstant[3]}, ` +
        `${value(3)}, ${value(4)}, ${value(5)}, ${sceneConstant[7]}, ` +
        `${value(6)}, ${value(7)}, ${value(8)}, ${sceneConstant[11]}, ` +
        `${sceneConstant[12]}, ${sceneConstant[13]}, ${sceneConstant[14]}, ` +
        `${sceneConstant[15]})`;
    },
    materialTransform(stateIndex) {
      if (!Number.isSafeInteger(stateIndex) || stateIndex < 0 ||
          stateIndex >= descriptor.materialStateCount) {
        throw new RangeError(
          "Neptune prepared material matrix address drifted.",
        );
      }
      const value = (columnIndex) =>
        materialColumns[columnIndex][stateIndex];
      return `matrix3d(${value(0)},${value(1)},${value(2)},${materialConstant[3]},` +
        `${value(3)},${value(4)},${value(5)},${materialConstant[7]},` +
        `${value(6)},${value(7)},${value(8)},${materialConstant[11]},` +
        `${value(9)},${value(10)},${value(11)},${materialConstant[15]})`;
    },
  });
}

function float64LittleEndianValues(buffer, expectedCount) {
  const nativeLittleEndian =
    new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  if (nativeLittleEndian) return new Float64Array(buffer);
  const source = new DataView(buffer);
  const values = new Float64Array(expectedCount);
  for (let index = 0; index < expectedCount; index += 1) {
    values[index] = source.getFloat64(
      index * Float64Array.BYTES_PER_ELEMENT,
      true,
    );
  }
  return values;
}

function createNeptuneCubicOrbit({
  stage,
  inputSurface,
  mounted,
  orbitMaterialCache,
  initialLens,
}) {
  let orbit = null;
  let activeLens = initialLens;
  let lastMaterialPresentationKey = null;
  let baseSunViewZ = null;
  let baseLightAzimuthDegrees = null;
  let shadowsEnabled = false;
  let materialFrame = orbitMaterialCache.frameIndex(
    NEPTUNE_CUBIC_CAMERA.initialScenePitchDegrees,
  );
  let transformWrites = 0;
  let materialAddressWrites = 0;
  const publishMaterialRoll = createPreparedPlanarRotationPublisher({
    element: mounted.fixedMaterialLeaf,
    width: 1024,
  });

  const publish = ({
    sunViewDirection,
    counterRotationFor,
    controlPitch,
  }) => {
    const localCounter = counterRotationFor(mounted.system.style.transform);
    if (mounted.fixedMaterialCounter.style.transform !== localCounter) {
      mounted.fixedMaterialCounter.style.transform = localCounter;
      transformWrites += 1;
    }
    baseSunViewZ ??= sunViewDirection[2];
    const defaultFrame = orbitMaterialCache.frameIndex(
      NEPTUNE_CUBIC_CAMERA.initialScenePitchDegrees,
    );
    materialFrame = Math.round(clamp(
      defaultFrame + (baseSunViewZ - sunViewDirection[2]) * 127.5,
      0,
      255,
    ));
    const useDefault = Math.abs(
      controlPitch - NEPTUNE_CUBIC_CAMERA.defaultControlPitchDegrees,
    ) < 0.01;
    const materialPresentation = !shadowsEnabled
      ? orbitMaterialCache.shadowlessPresentation(activeLens)
      : useDefault
        ? orbitMaterialCache.defaultPresentation(activeLens)
        : orbitMaterialCache.presentation(materialFrame, activeLens);
    const materialPresentationKey = !shadowsEnabled
      ? `${activeLens}:shadowless`
      : useDefault
        ? `${activeLens}:default`
        : `${activeLens}:${materialFrame}`;
    if (materialPresentation &&
        materialPresentationKey !== lastMaterialPresentationKey) {
      for (const [property, value] of [
        ["backgroundImage", `url("${materialPresentation.assetUrl}")`],
        ["backgroundPosition", materialPresentation.backgroundPosition],
        ["backgroundSize", materialPresentation.backgroundSize],
      ]) {
        if (mounted.fixedMaterialLeaf.style[property] === value) continue;
        mounted.fixedMaterialLeaf.style[property] = value;
        materialAddressWrites += 1;
      }
      lastMaterialPresentationKey = materialPresentationKey;
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
  orbitMaterialCache.onReady(() => orbit?.refresh());
  orbit = createRetainedCubicSkyOrbit({
    stage,
    inputSurface,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_NEPTUNE_STARFIELD,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_NEPTUNE_SKY_SUN,
    cameraPlan: NEPTUNE_CUBIC_CAMERA,
    objectId: "neptune",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onPublish: publish,
  });
  return Object.freeze({
    mobilePageFlow: orbit.mobilePageFlow,
    refresh: orbit.refresh,
    state: orbit.state,
    setState: orbit.setState,
    setShadowsEnabled(visible) {
      const enabled = Boolean(visible);
      if (enabled === shadowsEnabled) return false;
      shadowsEnabled = enabled;
      orbit.refresh();
      return true;
    },
    async setLens(id) {
      const state = orbit.state();
      const useDefault = Math.abs(
        state.controlPitch - NEPTUNE_CUBIC_CAMERA.defaultControlPitchDegrees,
      ) < 0.01;
      if (!useDefault) {
        await orbitMaterialCache.preparePresentation(materialFrame, id);
      }
      activeLens = id;
      lastMaterialPresentationKey = null;
      orbit.refresh();
      return true;
    },
    stats() {
      return Object.freeze({
        ...orbit.stats(),
        transformWrites,
        materialAddressWrites,
        materialFrame,
        orbitMaterialCache: orbitMaterialCache.stats(),
      });
    },
    destroy() {
      orbitMaterialCache.onReady(null);
      orbit.destroy();
    },
  });
}

function createLensControls({ stage }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) throw new Error("Neptune lens selector is missing.");
  const lenses = new Map(PREPARED_NEPTUNE_LENSES.controls.map((lens) => [lens.id, lens]));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')].map((button) => [button.value, button]));
  if (buttons.size !== lenses.size) throw new Error("Neptune lens selector does not match prepared lenses.");
  const decoded = new Map();
  const events = new AbortController();
  let active = PREPARED_NEPTUNE_LENSES.defaultLens;
  let request = 0;
  let ready = false;
  let destroyed = false;
  let materialLeaf = null;
  let orbitCamera = null;
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  for (const [id, button] of buttons) button.addEventListener("click", () => void select(id).catch(console.error), { signal: events.signal });
  publish();
  return Object.freeze({
    state() { return Object.freeze({ id: active, ready: ready && !destroyed }); },
    prepare,
    select,
    bindRuntime(runtime) {
      if (destroyed) return;
      if (!(runtime?.materialLeaf instanceof HTMLElement)) {
        throw new TypeError("Neptune material leaf binding is missing.");
      }
      if (typeof runtime.orbitCamera?.setLens !== "function") {
        throw new TypeError("Neptune orbit-material binding is missing.");
      }
      materialLeaf = runtime.materialLeaf;
      orbitCamera = runtime.orbitCamera;
      applyPreparedLens(lenses.get(active), { material: false });
      ready = true;
      publish();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ready = false;
      request += 1;
      events.abort();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = true;
      for (const [id, entry] of decoded) releaseEntry(id, entry);
      decoded.clear();
      materialLeaf = null;
      orbitCamera = null;
      stage.style.removeProperty("--neptune-surface-image");
      stage.style.removeProperty("--neptune-poles-image");
      delete stage.dataset.lens;
    },
  });

  function prepare(id) {
    const lens = lenses.get(id);
    if (!lens) throw new RangeError(`Unknown Neptune lens: ${id}.`);
    let entry = decoded.get(id);
    if (!entry) {
      entry = { images: null, promise: null, wanted: true, released: false };
      entry.promise = Promise.all([
        decodeImage(lens.surfaceUrl, lens.surface2xUrl),
        decodeImage(lens.polesUrl),
        decodeImage(lens.materialUrl),
        decodeImage(lens.shadowlessMaterialUrl),
      ]).then((images) => {
        entry.images = images;
        if (!entry.wanted) releaseEntry(id, entry);
        return images;
      }, (error) => {
        if (decoded.get(id) === entry) decoded.delete(id);
        throw error;
      });
      decoded.set(id, entry);
    }
    entry.wanted = true;
    return entry.promise;
  }
  async function select(id) {
    if (!lenses.has(id)) throw new RangeError(`Unknown Neptune lens: ${id}.`);
    if (!ready || destroyed) return false;
    const selection = ++request;
    root.classList.add("is-loading");
    try {
      await prepare(id);
      if (destroyed || selection !== request) return false;
      await orbitCamera.setLens(id);
      if (destroyed || selection !== request) return false;
      active = id;
      applyPreparedLens(lenses.get(id), { material: false });
      publish();
      releaseInactiveEntries(id);
      return true;
    } finally {
      if (selection === request) root.classList.remove("is-loading");
    }
  }
  function releaseInactiveEntries(selectedId) {
    for (const [id, entry] of decoded) {
      if (id !== selectedId) releaseEntry(id, entry);
    }
  }
  function releaseEntry(id, entry) {
    entry.wanted = false;
    if (!entry.images || entry.released) return;
    entry.released = true;
    entry.images.forEach(releaseDecodedImage);
    if (decoded.get(id) === entry) decoded.delete(id);
    entry.images = null;
    entry.promise = null;
  }
  function applyPreparedLens(lens, { material = true } = {}) {
    stage.style.setProperty(
      "--neptune-surface-image",
      `url("${lens.surface2xUrl || lens.surfaceUrl}")`,
    );
    stage.style.setProperty(
      "--neptune-poles-image",
      `url("${lens.polesUrl}")`,
    );
    if (material) {
      materialLeaf.style.backgroundImage = `url("${lens.materialUrl}")`;
      materialLeaf.style.backgroundPosition = "0px 0px";
      materialLeaf.style.backgroundSize = "1024px 1024px";
    }
  }
  function publish() {
    stage.dataset.lens = active;
    for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(id === active));
  }
}

function createPreparedOrbitMaterialCache(lensPlan) {
  const variants = new Map(lensPlan.controls.map((lens) => [lens.id, lens]));
  for (const lens of variants.values()) {
    const orbit = lens.orbitMaterial;
    if (orbit?.schema !== "cssneptune-prepared-orbit-material@1" ||
        orbit.frameCount !== 256 || orbit.frameColumns !== 16 ||
        orbit.frameRows !== 16 || orbit.rows?.length !== 16 ||
        orbit.presentations?.length !== 256 ||
        orbit.runtimeRasterization !== false) {
      throw new Error(`Neptune orbit material drifted: ${lens.id}.`);
    }
  }
  const maximumRetainedRowCount = 3;
  const retained = new Map();
  const pending = new Map();
  let readyCallback = null;
  let destroyed = false;
  let clock = 0;
  let decodeCount = 0;
  let releaseCount = 0;

  return Object.freeze({
    async prepareInitial() {
      const frameIndex = this.frameIndex(40);
      const rowIndex = Math.floor(frameIndex / 16);
      await Promise.all([rowIndex - 1, rowIndex, rowIndex + 1]
        .filter((row) => row >= 0 && row < 16)
        .map((row) => prepareRow(lensPlan.defaultLens, row)));
    },
    frameIndex(scenePitchDegrees) {
      const orbit = requireLens(lensPlan.defaultLens).orbitMaterial;
      const normalized = (
        orbit.maximumScenePitchDegrees - scenePitchDegrees
      ) / (
        orbit.maximumScenePitchDegrees - orbit.minimumScenePitchDegrees
      );
      return Math.round(clamp(normalized, 0, 1) *
        (orbit.frameCount - 1));
    },
    async preparePresentation(frameIndex, id) {
      const presentation = requirePresentation(frameIndex, id);
      await prepareRow(id, presentation.rowIndex);
      return presentation;
    },
    presentation(frameIndex, id) {
      const presentation = requirePresentation(frameIndex, id);
      const key = rowKey(id, presentation.rowIndex);
      const entry = retained.get(key);
      if (entry) {
        entry.used = ++clock;
        return presentation;
      }
      void prepareRow(id, presentation.rowIndex).then(() => {
        if (!destroyed) readyCallback?.();
      }, reportPreparedDecodeError);
      return null;
    },
    defaultPresentation(id) {
      const lens = requireLens(id);
      return Object.freeze({
        assetUrl: lens.materialUrl,
        backgroundPosition: "0px 0px",
        backgroundSize: "1024px 1024px",
      });
    },
    shadowlessPresentation(id) {
      const lens = requireLens(id);
      return Object.freeze({
        assetUrl: lens.shadowlessMaterialUrl,
        backgroundPosition: "0px 0px",
        backgroundSize: "1024px 1024px",
      });
    },
    onReady(callback) {
      readyCallback = callback;
    },
    stats() {
      return Object.freeze({
        model: "prepared-row-shards-bounded-neighborhood",
        retainedRowCount: retained.size,
        pendingRowCount: pending.size,
        maximumRetainedRowCount,
        decodeCount,
        releaseCount,
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      readyCallback = null;
      for (const { image } of retained.values()) image.src = "";
      retained.clear();
      pending.clear();
    },
  });

  function requireLens(id) {
    const lens = variants.get(id);
    if (!lens) throw new RangeError(`Unknown Neptune orbit lens: ${id}.`);
    return lens;
  }

  function requirePresentation(frameIndex, id) {
    const presentation = requireLens(id).orbitMaterial
      .presentations[frameIndex];
    if (!presentation) {
      throw new RangeError(`Unprepared Neptune orbit frame: ${frameIndex}.`);
    }
    return presentation;
  }

  function rowKey(id, rowIndex) {
    return `${id}:${rowIndex}`;
  }

  function prepareRow(id, rowIndex) {
    if (destroyed) return Promise.resolve(false);
    const key = rowKey(id, rowIndex);
    const ready = retained.get(key);
    if (ready) {
      ready.used = ++clock;
      return Promise.resolve(true);
    }
    const existing = pending.get(key);
    if (existing) return existing;
    const row = requireLens(id).orbitMaterial.rows[rowIndex];
    if (!row) throw new RangeError(`Unprepared Neptune orbit row: ${key}.`);
    const promise = decodeImage(row.assetUrl, "", 1).then((image) => {
      pending.delete(key);
      if (destroyed) {
        image.src = "";
        return false;
      }
      retained.set(key, { image, used: ++clock });
      decodeCount += 1;
      evictRows(key);
      return true;
    }, (error) => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, promise);
    return promise;
  }

  function evictRows(protectedKey) {
    while (retained.size > maximumRetainedRowCount) {
      const candidates = [...retained.entries()]
        .filter(([key]) => key !== protectedKey)
        .sort((left, right) => left[1].used - right[1].used);
      const candidate = candidates[0];
      if (!candidate) return;
      candidate[1].image.src = "";
      retained.delete(candidate[0]);
      releaseCount += 1;
    }
  }
}

function preparedOrbitMaterialFrame(cache, scenePitchDegrees) {
  return cache.frameIndex(scenePitchDegrees);
}

function reportPreparedDecodeError(error) {
  console.error(error);
}

async function decodeImage(url, url2x) {
  const image = new Image();
  image.src = url2x || url;
  await image.decode();
  return image;
}

function releaseDecodedImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  image.removeAttribute("src");
}

function createMesh(className, style) { const mesh = document.createElement("div"); mesh.className = className.includes("polycss-") ? className : `polycss-mesh ${className}`; if (style) mesh.style.cssText = style; return mesh; }
function createTextureLeaf(leaf) { return createPreparedProjectiveTextureLeaf(leaf); }
function nextPaint() { return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
