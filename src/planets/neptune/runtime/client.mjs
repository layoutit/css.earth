import { createPlanetFeatureControls } from "../../../platform/planet-feature-controls.mjs";
import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { createPreparedImageStore, decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
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

export function mountNeptuneClient(stage, { onError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Neptune requires a fatal-error handler.");
  const inputSurface = document.querySelector(".neptune-input-surface");
  if (!(inputSurface instanceof HTMLElement)) throw new Error("Neptune input surface is missing.");
  const lifetime = createSceneLifetime();
  let shouldPlay = false;
  let mounted = null;
  let orbitCamera = null;
  let orbitMaterialCache = null;
  let featureControls = null;
  let lensControls = null;
  let sceneAnimations = Object.freeze([]);
  let diagnostic = null;
  lifetime.onDispose(() => {
    mounted = null;
    orbitCamera = null;
    orbitMaterialCache = null;
    featureControls = null;
    lensControls = null;
    sceneAnimations = Object.freeze([]);
  });
  const warmImages = new Set();
  lifetime.onDispose(() => {
    const images = [...warmImages];
    warmImages.clear();
    const errors = [];
    for (const image of images) {
      try { releasePreparedImage(image); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Neptune startup image cleanup failed.");
  });
  lifetime.onDispose(() => {
    if (DEVELOPMENT_DIAGNOSTICS && window.__neptune === diagnostic) delete window.__neptune;
  });
  const controller = Object.freeze({
    get ready() { return ready; },
    pause() {
      if (lifetime.disposed) return;
      shouldPlay = false;
      for (const animation of sceneAnimations) animation.pause();
    },
    resume() {
      if (lifetime.disposed) return;
      shouldPlay = true;
      if (!mounted) return;
      for (const animation of sceneAnimations) animation.play();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Neptune cleanup failed.");
    },
  });
  const ready = lifetime.wait(start()).then(({ value }) => value).catch((error) => {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    throw error;
  });
  return controller;

  async function start() {
    try {
      featureControls = createPlanetFeatureControls({
        stage,
        lifetime,
        onError,
        classes: Object.freeze({
          rings: "neptune-hide-rings",
          shadows: "neptune-hide-shadows",
        }),
        onShadowsVisibilityChange(visible) {
          orbitCamera?.setShadowsEnabled(visible);
        },
      });
      lensControls = createLensControls({ stage, lifetime, onError });
      orbitMaterialCache = createPreparedOrbitMaterialCache(
        PREPARED_NEPTUNE_LENSES,
        { onError },
      );
      lifetime.onDispose(orbitMaterialCache.destroy);
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
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage, PREPARED_NEPTUNE_SCENE, lifetime);
      warmImages.clear();
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of sceneAnimations) lifetime.onDispose(() => animation.cancel());
      for (const animation of sceneAnimations) {
        animation.currentTime = 0;
        animation.pause();
      }
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      orbitCamera = createNeptuneCubicOrbit({
        stage,
        onError,
        inputSurface,
        mounted,
        orbitMaterialCache,
        initialLens: PREPARED_NEPTUNE_LENSES.defaultLens,
      });
      lifetime.onDispose(orbitCamera.destroy);
      mounted.ringLeaf.style.backgroundImage = `url("${RING_2X_URL}")`;
      lensControls.bindRuntime({
        materialLeaf: mounted.fixedMaterialLeaf,
        orbitCamera,
      });
      featureControls.bindRuntime({ animations: sceneAnimations });
      if (shouldPlay) for (const animation of sceneAnimations) animation.play();
      if (DEVELOPMENT_DIAGNOSTICS) {
        diagnostic = Object.freeze({
        ready: true,
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
        window.__neptune = diagnostic;
      }
    } catch (error) {
      if (lifetime.disposed) return;
      throw error;
    }
  }

  function decodeImage(url, url2x = "") {
    if (lifetime.disposed) return Promise.resolve(null);
    const image = new Image();
    warmImages.add(image);
    return decodePreparedImage(image, url2x || url);
  }
}

function mountPreparedScene(host, plan, lifetime) {
  if (plan.schema !== "cssneptune-prepared-runtime-scene@1") throw new TypeError("Neptune retained scene plan is incompatible.");
  const camera = document.createElement("div");
  lifetime.onDispose(() => camera.remove());
  ownNeptunePresentationCleanup(host, camera, lifetime);
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
  lifetime.onDispose(cubicSky.destroy);
  const skySun = mountRetainedDirectionalSun({
    host,
    plan: PREPARED_NEPTUNE_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "neptune",
    before: camera,
  });
  lifetime.onDispose(skySun.destroy);
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
  onError,
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
    onError,
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
    prepareLens(id, { isCurrent }) {
      orbitMaterialCache.clearSelection();
      return prepareCurrentNeptuneMaterial({
        id, isCurrent, cache: orbitMaterialCache,
        readState: () => ({
          frame: materialFrame,
          useDefault: Math.abs(orbit.state().controlPitch -
            NEPTUNE_CUBIC_CAMERA.defaultControlPitchDegrees) < 0.01,
        }),
      });
    },
    commitLens(id) {
      activeLens = id;
      lastMaterialPresentationKey = null;
      orbit.refresh();
      orbitMaterialCache.clearSelection();
      return true;
    },
    cancelLensPreparation: orbitMaterialCache.clearSelection,
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

export function createLensControls({ stage, lifetime, onError }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) throw new Error("Neptune lens selector is missing.");
  const controls = PREPARED_NEPTUNE_LENSES.controls;
  const lenses = new Map(controls.map((lens) => [lens.id, lens]));
  const buttonList = [...root.querySelectorAll('button[name="lens"]')];
  const buttons = new Map(buttonList.map((button) => [button.value, button]));
  if (lenses.size !== controls.length || buttons.size !== buttonList.length ||
      buttons.size !== lenses.size || [...buttons.keys()].some((id) => !lenses.has(id))) {
    throw new Error("Neptune lens selector does not match prepared lenses.");
  }
  const decoded = new Map();
  const events = new AbortController();
  let active = PREPARED_NEPTUNE_LENSES.defaultLens;
  let desired = active;
  let ready = false;
  let materialLeaf = null;
  let orbitCamera = null;
  const selection = createLatestSelection({
    lifetime,
    onBusyChange: (busy) => root.classList.toggle("is-loading", busy),
    onFatalError: onError,
  });
  lifetime.onDispose(() => {
    ready = false;
    events.abort();
    root.classList.remove("is-loading");
    for (const button of buttons.values()) button.disabled = true;
    materialLeaf = null;
    orbitCamera = null;
  });
  lifetime.onDispose(() => releaseLensImages());
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  for (const [id, button] of buttons) button.addEventListener("click",
    () => void select(id).catch((error) => { if (!lifetime.disposed) console.error(error); }),
    { signal: events.signal });
  publish();
  return Object.freeze({
    state() { return Object.freeze({ id: active, ready: ready && !lifetime.disposed }); },
    prepare,
    select,
    bindRuntime(runtime) {
      if (lifetime.disposed) return;
      if (!(runtime?.materialLeaf instanceof HTMLElement) ||
          typeof runtime.orbitCamera?.prepareLens !== "function" ||
          typeof runtime.orbitCamera?.commitLens !== "function") {
        throw new TypeError("Neptune material binding is incomplete.");
      }
      materialLeaf = runtime.materialLeaf;
      orbitCamera = runtime.orbitCamera;
      applyPreparedLens(lenses.get(active));
      ready = true;
      publish();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
    },
  });

  function prepare(id) {
    const lens = lenses.get(id);
    if (!lens) throw new RangeError(`Unknown Neptune lens: ${id}.`);
    if (lifetime.disposed) return Promise.resolve(null);
    let entry = decoded.get(id);
    if (!entry) {
      const store = createPreparedImageStore();
      entry = { store, promise: null };
      decoded.set(id, entry);
      entry.promise = Promise.all([
        lens.surface2xUrl || lens.surfaceUrl,
        lens.polesUrl,
        lens.materialUrl,
        lens.shadowlessMaterialUrl,
      ].map((url) => store.load(url))).catch((error) => {
        if (decoded.get(id) === entry) decoded.delete(id);
        try { store.destroy(); } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], error.message, { cause: error });
        }
        throw error;
      });
    }
    return entry.promise;
  }
  function select(id) {
    if (!lenses.has(id)) throw new RangeError(`Unknown Neptune lens: ${id}.`);
    if (!ready || lifetime.disposed) return Promise.resolve(false);
    desired = id;
    return selection.run({
      prepare: async ({ isCurrent }) => {
        releaseLensImages(new Set([active, desired]));
        await prepare(id);
        if (!isCurrent()) return;
        await orbitCamera.prepareLens(id, { isCurrent });
      },
      commit: () => {
        if (!materialLeaf || !orbitCamera) throw new Error("Neptune runtime was released.");
        orbitCamera.commitLens(id);
        if (lifetime.disposed) return;
        applyPreparedLens(lenses.get(id));
        active = id;
        publish();
        releaseLensImages(new Set([active, desired]));
      },
      onCurrentFailure() {
        desired = active;
        releaseLensImages(new Set([active]));
        orbitCamera?.cancelLensPreparation?.();
      },
      discard() {
        if (!lifetime.disposed) releaseLensImages(new Set([active, desired]));
      },
    });
  }
  function applyPreparedLens(lens) {
    stage.style.setProperty("--neptune-surface-image", `url("${lens.surface2xUrl || lens.surfaceUrl}")`);
    stage.style.setProperty("--neptune-poles-image", `url("${lens.polesUrl}")`);
  }
  function releaseLensImages(keepIds = new Set()) {
    const errors = [];
    for (const [id, entry] of decoded) {
      if (keepIds.has(id)) continue;
      decoded.delete(id);
      try { entry.store.destroy(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Neptune lens group cleanup failed.");
  }
  function publish() {
    if (ready) stage.dataset.lens = active;
    for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(id === active));
  }
}

export function ownNeptunePresentationCleanup(stage, camera, lifetime) {
  lifetime.onDispose(() => {
    if (camera.parentNode !== stage) return;
    stage.style.removeProperty("--neptune-surface-image");
    stage.style.removeProperty("--neptune-poles-image");
    delete stage.dataset.lens;
  });
}

export function createPreparedOrbitMaterialCache(lensPlan, { onError = reportPreparedDecodeError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Neptune row cache requires a publication-error handler.");
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
  let appliedKey = null;
  let selectionKey = null;

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
    async preparePresentation(frameIndex, id, { protect = false } = {}) {
      const presentation = requirePresentation(frameIndex, id);
      if (protect && !destroyed) selectionKey = rowKey(id, presentation.rowIndex);
      await prepareRow(id, presentation.rowIndex);
      return presentation;
    },
    clearSelection() { selectionKey = null; },
    hasPresentation(frameIndex, id) {
      return retained.has(rowKey(id, requirePresentation(frameIndex, id).rowIndex));
    },
    presentation(frameIndex, id) {
      const presentation = requirePresentation(frameIndex, id);
      const key = rowKey(id, presentation.rowIndex);
      const entry = retained.get(key);
      if (entry) {
        entry.used = ++clock;
        appliedKey = key;
        return presentation;
      }
      void prepareRow(id, presentation.rowIndex).then(() => {
        if (destroyed) return;
        try { readyCallback?.(); } catch (error) { onError(error); }
      }, reportPreparedDecodeError);
      return null;
    },
    defaultPresentation(id) {
      appliedKey = null;
      const lens = requireLens(id);
      return Object.freeze({
        assetUrl: lens.materialUrl,
        backgroundPosition: "0px 0px",
        backgroundSize: "1024px 1024px",
      });
    },
    shadowlessPresentation(id) {
      appliedKey = null;
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
      appliedKey = null;
      selectionKey = null;
      const images = new Set([...retained.values(), ...pending.values()].map(({ image }) => image));
      retained.clear();
      pending.clear();
      const errors = [];
      for (const image of images) {
        releaseCount += 1;
        try { releasePreparedImage(image); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Neptune row image cleanup failed.");
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
    if (existing) return existing.promise;
    const row = requireLens(id).orbitMaterial.rows[rowIndex];
    if (!row) throw new RangeError(`Unprepared Neptune orbit row: ${key}.`);
    const image = new Image();
    const entry = { image, promise: null };
    pending.set(key, entry);
    entry.promise = decodePreparedImage(image, row.assetUrl).then(() => {
      if (destroyed || pending.get(key) !== entry) {
        return false;
      }
      pending.delete(key);
      retained.set(key, { image, used: ++clock });
      decodeCount += 1;
      evictRows(key);
      return true;
    }, (error) => {
      if (destroyed || pending.get(key) !== entry) return false;
      pending.delete(key);
      try { releasePreparedImage(image); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], error.message, { cause: error });
      }
      throw error;
    });
    return entry.promise;
  }

  function evictRows(protectedKey) {
    while (retained.size > maximumRetainedRowCount) {
      const candidates = [...retained.entries()]
        .filter(([key]) => key !== protectedKey && key !== appliedKey && key !== selectionKey)
        .sort((left, right) => left[1].used - right[1].used);
      const candidate = candidates[0];
      if (!candidate) return;
      retained.delete(candidate[0]);
      releaseCount += 1;
      releasePreparedImage(candidate[1].image);
    }
  }
}

export async function prepareCurrentNeptuneMaterial({ id, isCurrent, cache, readState }) {
  while (isCurrent()) {
    const needed = readState();
    if (needed.useDefault) return;
    await cache.preparePresentation(needed.frame, id, { protect: true });
    if (!isCurrent()) return;
    const latest = readState();
    if (latest.useDefault || cache.hasPresentation(latest.frame, id)) return;
    // Camera events remain independent. If the pose crossed a prepared row
    // during decode, warm that current row before the synchronous lens commit.
  }
}

function preparedOrbitMaterialFrame(cache, scenePitchDegrees) {
  return cache.frameIndex(scenePitchDegrees);
}

function reportPreparedDecodeError(error) {
  console.error(error);
}

function createMesh(className, style) { const mesh = document.createElement("div"); mesh.className = className.includes("polycss-") ? className : `polycss-mesh ${className}`; if (style) mesh.style.cssText = style; return mesh; }
function createTextureLeaf(leaf) { return createPreparedProjectiveTextureLeaf(leaf); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
