import {
  PREPARED_SATURN_RUNTIME_SCENE as PREPARED_SATURN_SCENE,
} from "./preparedSceneRuntime.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PREPARED_SATURN_LENSES } from "./preparedLenses.mjs";
import { PREPARED_SATURN_VIEWS } from "./preparedViews.mjs";
import { PREPARED_SATURN_STARFIELD } from "./preparedStarfield.mjs";
import { PREPARED_SATURN_SKY_SUN } from "./preparedSkySun.mjs";
import { OBJECT_BEHAVIOR } from "../../../../site/scene-contract.mjs";
import {
  CANONICAL_PREPARED_IMAGE_DENSITY,
} from "../../../../site/runtime-policy.mjs";
import {
  createRetainedCubicSkyOrbit,
  mountRetainedCubicSky,
} from "../../../platform/cubic-sky-runtime.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";

import { createSceneLifetime, waitForSceneDocument, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";
import { createPreparedImageStore, decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

const PLANET_SURFACE_TEXTURE_URL = "/scenes/saturn/saturn-surface-body.jpg";
const PLANET_POLAR_TEXTURE_URL = "/scenes/saturn/saturn-poles.webp";
const PLANET_WEATHER_TEXTURE_URL = "/scenes/saturn/saturn-weather.webp";
const RING_TEXTURE_URL = "/scenes/saturn/saturn-rings.webp";
const RING_TEXTURE_2X_URL = "/scenes/saturn/saturn-rings@2x.webp";
const RING_SHADOW_TEXTURE_URL = "/scenes/saturn/saturn-ring-shadow.webp";
const SATURN_CUBIC_CAMERA = Object.freeze({
  cameraModel: "accumulated-matrix3d",
  minimumControlPitchDegrees: 0,
  maximumControlPitchDegrees: 89,
  defaultControlPitchDegrees: 34.230769230769226,
  defaultControlYawDegrees: 0,
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

export function mountSaturnClient(stage, { onError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Saturn requires a fatal-error handler.");
  const inputSurface = document.querySelector(".saturn-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Saturn input surface is missing.");
  }
  const lifetime = createSceneLifetime();
  let shouldPlay = false;
  let mounted = null;
  let ready = null;
  let orbitCamera = null;
  let featureControls = null;
  let lensControls = null;
  let sceneAnimations = Object.freeze([]);
  let playbackClock = null;
  let orbitMaterialCache = null;
  let interiorAtmosphereCache = null;
  let diagnostic = null;
  lifetime.onDispose(() => {
    mounted = null;
    orbitCamera = null;
    featureControls = null;
    lensControls = null;
    playbackClock = null;
    orbitMaterialCache = null;
    interiorAtmosphereCache = null;
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
    if (errors.length) throw new AggregateError(errors, "Saturn startup image cleanup failed.");
  });
  lifetime.onDispose(() => {
    if (DEVELOPMENT_DIAGNOSTICS && window.__saturn === diagnostic) delete window.__saturn;
  });
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
    pause() {
      if (lifetime.disposed) return;
      shouldPlay = false;
      playbackClock?.pause();
    },
    resume() {
      if (lifetime.disposed) return;
      shouldPlay = true;
      if (!mounted) return;
      playbackClock?.resume();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Saturn cleanup failed.");
    },
  });
  ready = lifetime.wait(start()).then(({ value }) => value).catch((error) => {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    throw error;
  });
  return controller;

  async function start() {
    try {
      await waitForSceneDocument(lifetime);
      if (lifetime.disposed) return;
      featureControls = createSaturnFeatureControls({ stage, lifetime, onError });
      lensControls = createSaturnLensControls({ stage, lifetime, onError, featureControls });
      orbitMaterialCache = createPreparedOrbitMaterialCache(
        PREPARED_SATURN_SCENE.preparedLighting.orbitAtlas,
      );
      lifetime.onDispose(orbitMaterialCache.destroy);
      interiorAtmosphereCache = createPreparedVariantAtlasCache(
        PREPARED_SATURN_SCENE.interior.atmosphere.runtimeShards,
        "interior atmosphere",
      );
      lifetime.onDispose(interiorAtmosphereCache.destroy);
      await Promise.all([
        orbitMaterialCache.prepareInitial(),
        Promise.all([
          decodeImage(PLANET_SURFACE_TEXTURE_URL),
          decodeImage(PLANET_POLAR_TEXTURE_URL),
          decodeImage(PLANET_WEATHER_TEXTURE_URL),
          decodeImage(RING_TEXTURE_URL, RING_TEXTURE_2X_URL),
          decodeImage(RING_SHADOW_TEXTURE_URL),
          ...PREPARED_SATURN_STARFIELD.faces.flatMap(({
            url,
            url2x,
            highContrastUrl,
            highContrastUrl2x,
          }) => [
            decodeImage(url, url2x),
            decodeImage(
              highContrastUrl,
              highContrastUrl2x,
            ),
          ]),
          decodeImage(
            PREPARED_SATURN_SKY_SUN.asset.url,
            PREPARED_SATURN_SKY_SUN.asset.url2x,
          ),
          ...PREPARED_SATURN_SCENE.ringMotionPlates.map((plate) => decodeImage(
            plate.textureUrl,
            plate.texture2xUrl,
          )),
        ]),
      ]);
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage, PREPARED_SATURN_SCENE, lifetime);
      warmImages.clear();
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of sceneAnimations) lifetime.onDispose(() => animation.cancel());
      playbackClock = createPreparedPlaybackClock(sceneAnimations);
      lifetime.onDispose(playbackClock.destroy);
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      orbitCamera = createSaturnCubicOrbitControls({
        stage,
        lifetime,
        onError,
        inputSurface,
        mounted,
        cameraState: PREPARED_SATURN_SCENE.camera.state,
        interactionFrames: PREPARED_SATURN_SCENE.interactionFrames,
        materialOrbitAtlas:
          PREPARED_SATURN_SCENE.preparedLighting.orbitAtlas,
        orbitMaterialCache,
        interiorAtmosphereCache,
        interiorAtmosphereAtlas:
          PREPARED_SATURN_SCENE.interior.atmosphere,
        orbitPlayback: PREPARED_SATURN_SCENE.camera.orbitPlayback,
        systemTiltDegrees:
          -PREPARED_SATURN_SCENE.preparedRingSource.shadowModel.systemTiltDegrees,
      });
      lifetime.onDispose(orbitCamera.destroy);
      await lensControls.bindRuntime({
        viewBank: mounted.viewBank,
        camera: orbitCamera,
      });
      if (lifetime.disposed) return;
      featureControls.bindRuntime({
        playback: playbackClock,
      });
      if (shouldPlay) playbackClock.resume();
      if (DEVELOPMENT_DIAGNOSTICS) {
        diagnostic = Object.freeze({
          ready: true,
          renderStats: Object.freeze({
            textureStats: Object.freeze({
              selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
              get retainedInteractiveImageCount() {
                return orbitMaterialCache.stats().retainedImageCount +
                  interiorAtmosphereCache.stats().retainedImageCount;
              },
              get orbitMaterialCache() {
                return orbitMaterialCache.stats();
              },
              get interiorAtmosphereCache() {
                return interiorAtmosphereCache.stats();
              },
            }),
          }),
          dom: mounted.domStats,
          animation: Object.freeze({
            stats: orbitCamera.stats,
            playback: Object.freeze({ stats: playbackClock.stats }),
          }),
          camera: Object.freeze({
            state: orbitCamera.state,
            setState: orbitCamera.setState,
            stats: orbitCamera.stats,
          }),
          features: Object.freeze({ state: featureControls.state }),
          options: Object.freeze({ state: featureControls.optionsState }),
          lenses: Object.freeze({
            state: lensControls.state,
            select: lensControls.select,
          }),
          preparedBanks: Object.freeze({
            state() {
              return Object.freeze({
                interior: mounted.viewBank.state(),
              });
            },
          }),
          stableNodes: mounted.stableNodes,
          assertStableDomIdentity: mounted.assertStableDomIdentity,
        });
        window.__saturn = diagnostic;
      }
    } catch (error) {
      if (lifetime.disposed) return;
      throw error;
    }
  }

  function decodeImage(url, url2x = "") {
    if (lifetime.disposed) return Promise.resolve(null);
    const image = new Image();
    image.decoding = "sync";
    warmImages.add(image);
    return decodePreparedImage(image, url2x || url);
  }
}

function createPreparedPlaybackClock(animations) {
  let destroyed = false;
  let playing = false;
  let running = false;
  let speed = 1;
  let currentTimeWrites = 0;
  let nativePlaybackStarts = 0;

  for (const animation of animations) {
    animation.currentTime = 0;
    currentTimeWrites += 1;
    animation.pause();
  }

  return Object.freeze({
    pause() {
      if (destroyed || !playing) return;
      playing = false;
      stop();
    },
    resume() {
      if (destroyed || playing) return;
      playing = true;
      if (speed > 0) start();
    },
    setSpeed(nextSpeed) {
      if (destroyed || !Number.isFinite(nextSpeed) || nextSpeed < 0) return;
      if (nextSpeed === speed) return;
      speed = nextSpeed;
      for (const animation of animations) animation.playbackRate = speed;
      if (speed === 0) {
        stop();
      } else if (playing && !running) {
        start();
      }
    },
    stats() {
      return Object.freeze({
        animationCount: animations.length,
        currentTimeWrites,
        elapsedMilliseconds: animations[0]?.currentTime ?? 0,
        model: "native-compositor-playback",
        nativePlaybackStarts,
        running,
        speed,
        tickCount: 0,
        timerCallbackCount: 0,
        earlyTimerCallbackCount: 0,
        timerCount: 0,
        updatesPerSecond: 0,
      });
    },
    destroy() {
      if (destroyed) return;
      playing = false;
      stop();
      destroyed = true;
    },
  });

  function start() {
    if (running) return;
    running = true;
    nativePlaybackStarts += 1;
    for (const animation of animations) animation.play();
  }

  function stop() {
    if (!running) return;
    running = false;
    for (const animation of animations) animation.pause();
  }
}

export function createSaturnLensControls({ stage, lifetime, onError, featureControls }) {
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) throw new Error("Saturn lens selector is missing.");
  const controls = PREPARED_SATURN_LENSES.controls;
  const lenses = new Map(controls.map((lens) => [lens.id, lens]));
  const buttonList = [...root.querySelectorAll('button[name="lens"]')];
  const buttons = new Map(buttonList.map((button) => [button.value, button]));
  if (lenses.size !== controls.length || buttons.size !== buttonList.length ||
      buttons.size !== lenses.size || [...buttons.keys()].some((id) => !lenses.has(id))) {
    throw new Error("Saturn lens selector does not match prepared lenses.");
  }
  const events = new AbortController();
  const decoded = new Map();
  let committed = Object.freeze({
    lensId: PREPARED_SATURN_LENSES.defaultLens, interior: false, rings: true, shadows: false,
  });
  let desired = committed;
  let viewBank = null;
  let camera = null;
  let bound = false;
  const selection = createLatestSelection({
    lifetime,
    onBusyChange(busy) {
      root.classList.toggle("is-loading", busy);
      root.setAttribute("aria-busy", String(busy));
      featureControls.setBusy(busy);
    },
    onFatalError: onError,
  });
  lifetime.onDispose(() => {
    bound = false;
    events.abort();
    root.classList.remove("is-loading");
    root.removeAttribute("aria-busy");
    for (const button of buttons.values()) button.disabled = true;
    camera = null;
    viewBank = null;
  });
  lifetime.onDispose(() => releaseUnusedImages(true));
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  for (const [id, button] of buttons) {
    button.addEventListener("click",
      () => void select(id).catch((error) => { if (!lifetime.disposed) console.error(error); }),
      { signal: events.signal });
  }
  featureControls.bindPresentation((patch) => {
    desired = Object.freeze({ ...desired, ...patch });
    featureControls.project(desired);
    return bound ? submit(desired) : Promise.resolve(false);
  });
  publishSelection();
  return Object.freeze({
    state() {
      return Object.freeze({ id: committed.lensId, interior: committed.interior, ready: bound && !lifetime.disposed });
    },
    select,
    async bindRuntime(runtime) {
      if (lifetime.disposed) return false;
      if (typeof runtime.camera?.preparePresentation !== "function" ||
          typeof runtime.camera?.commitPresentation !== "function" ||
          typeof runtime.camera?.releaseUnused !== "function" ||
          typeof runtime.viewBank?.mountInterior !== "function") {
        throw new TypeError("Saturn lens runtime is incomplete.");
      }
      camera = runtime.camera;
      viewBank = runtime.viewBank;
      await submit(desired);
      if (lifetime.disposed) return false;
      bound = true;
      for (const button of buttons.values()) button.disabled = false;
      return true;
    },
  });

  function select(id) {
    const lens = lenses.get(id);
    if (!lens) throw new RangeError(`Unknown Saturn lens: ${id}.`);
    if (!bound || lifetime.disposed) return Promise.resolve(false);
    desired = Object.freeze(lens.view === "interior"
      ? { ...desired, interior: !desired.interior }
      : { ...desired, lensId: id });
    return submit(desired);
  }

  function submit(snapshot) {
    return selection.run({
      prepare: async ({ isCurrent }) => {
        await Promise.all([
          prepareLens(lenses.get(snapshot.lensId)),
          ...(snapshot.interior
            ? controls.filter((lens) => lens.view === "interior").map(prepareLens)
            : []),
        ]);
        if (!isCurrent()) return;
        return camera.preparePresentation({
          ...snapshot, lensId: preparedMaterialLensId(lenses.get(snapshot.lensId)),
        }, { isCurrent });
      },
      commit: (material) => {
        if (!camera || !viewBank) throw new Error("Saturn presentation runtime was released.");
        // Validate and publish the prepared material synchronously. The camera
        // reads the current pose, never a pose captured by the async request.
        camera.validatePresentation(material);
        if (snapshot.interior) {
          viewBank.mountInterior();
          stage.dataset.view = "interior";
        } else {
          delete stage.dataset.view;
        }
        featureControls.project(snapshot, { committed: true });
        camera.commitPresentation(material);
        if (lifetime.disposed) return;
        committed = snapshot;
        const activeLens = committed.lensId;
        if (activeLens === PREPARED_SATURN_LENSES.defaultLens) delete stage.dataset.lens;
        else stage.dataset.lens = activeLens;
        publishSelection();
        releaseUnusedImages();
        camera.releaseUnused();
      },
      onCurrentFailure() {
        desired = committed;
        featureControls.project(committed);
        releaseUnusedImages();
        camera?.releaseUnused();
      },
      discard() {
        if (lifetime.disposed) return;
        releaseUnusedImages();
        camera?.releaseUnused(desired);
      },
    });
  }

  function prepareLens(lens) {
    if (lifetime.disposed || lens.id === PREPARED_SATURN_LENSES.defaultLens) return Promise.resolve(null);
    let entry = decoded.get(lens.id);
    if (!entry) {
      const store = createPreparedImageStore({ decoding: "sync" });
      entry = { store, promise: null };
      decoded.set(lens.id, entry);
      const urls = lens.view === "interior" ? preparedInteriorDecodeRequests() : [
        lens.surface2xUrl || lens.surfaceUrl,
        lens.polesUrl,
        lens.ring2xUrl || lens.ringUrl,
        ...(PREPARED_SATURN_VIEWS.assets.outerPoles[lens.id]
          ? [preparedViewAssetUrl(PREPARED_SATURN_VIEWS.assets.outerPoles[lens.id])] : []),
      ];
      // The store owns every allocation before Promise.all can reject.
      entry.promise = Promise.all(urls.map((url) => store.load(url))).catch((error) => {
        if (decoded.get(lens.id) === entry) decoded.delete(lens.id);
        try { store.destroy(); } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], error.message, { cause: error });
        }
        throw error;
      });
    }
    return entry.promise;
  }

  function publishSelection() {
    for (const [id, button] of buttons) {
      button.setAttribute("aria-pressed", String(lenses.get(id).view === "interior"
        ? committed.interior : id === committed.lensId));
    }
  }

  function releaseUnusedImages(all = false) {
    const errors = [];
    for (const [id, entry] of decoded) {
      if (!all && (id === committed.lensId || id === desired.lensId ||
          ((committed.interior || desired.interior) && lenses.get(id)?.view === "interior"))) continue;
      decoded.delete(id);
      try { entry.store.destroy(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Saturn lens group cleanup failed.");
  }
}

function preparedMaterialLensId(lens) {
  if (typeof lens?.materialLens !== "string") throw new Error("Saturn prepared material lens identity is missing.");
  return lens.materialLens;
}

function preparedInteriorDecodeRequests() {
  const plan = PREPARED_SATURN_VIEWS.interiorLenses.normal;
  if (!plan) throw new Error("Saturn normal cross-section plan is missing.");
  return [
    ...Object.values(plan.assets).map(preparedViewAssetUrl),
    ...(PREPARED_SATURN_VIEWS.assets.outerPoles.normal
      ? [preparedViewAssetUrl(PREPARED_SATURN_VIEWS.assets.outerPoles.normal)] : []),
  ];
}

function preparedViewAssetUrl(asset) { return asset.url2x || asset.url; }

export function createSaturnFeatureControls({ stage, lifetime, onError }) {
  const root = document.querySelector(".planet-settings");
  if (!(root instanceof HTMLElement)) throw new Error("Saturn options block is missing.");
  const inputs = new Map(["rings", "shadows"].map((name) => {
    const input = root.querySelector(`input[name="${name}"][type="checkbox"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Saturn ${name} control is missing.`);
    return [name, input];
  }));
  const input = root.querySelector('input[name="speed"][type="range"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("Saturn speed control is missing.");
  const events = new AbortController();
  let settings = Object.freeze({ rings: true, shadows: false });
  let playback = null;
  let onPresentationChange = null;
  lifetime.onDispose(() => {
    events.abort();
    for (const input of inputs.values()) input.disabled = true;
    root.classList.remove("is-loading");
    root.removeAttribute("aria-busy");
    stage.classList.remove("saturn-hide-rings", "saturn-hide-shadows");
    playback = null;
    onPresentationChange = null;
  });
  const speed = bindSpeedControl({
    input, lifetime, onError,
    onChange(value) { playback?.setSpeed(value); },
  });
  for (const [name, input] of inputs) {
    input.disabled = true;
    input.addEventListener("change", () => {
      if (lifetime.disposed || input.disabled) return;
      try {
        void onPresentationChange?.({ [name]: input.checked }).catch((error) => {
          if (!lifetime.disposed) console.error(error);
        });
      } catch (error) {
        if (!lifetime.disposed) onError(error);
      }
    }, { signal: events.signal });
  }
  project(settings, { committed: true });
  return Object.freeze({
    state: () => settings,
    optionsState: speed.state,
    project,
    setBusy(busy) {
      root.classList.toggle("is-loading", busy);
      root.setAttribute("aria-busy", String(busy));
    },
    bindPresentation(callback) { onPresentationChange = callback; },
    bindRuntime({ playback: clock }) {
      if (lifetime.disposed) return;
      playback = clock;
      playback.setSpeed(speed.state().speed);
      for (const input of inputs.values()) input.disabled = false;
      speed.setEnabled(true);
    },
  });

  function project(snapshot, { committed = false } = {}) {
    for (const [name, input] of inputs) input.checked = snapshot[name];
    if (!committed) return;
    settings = Object.freeze({ rings: snapshot.rings, shadows: snapshot.shadows });
    for (const name of inputs.keys()) stage.classList.toggle(`saturn-hide-${name}`, !snapshot[name]);
  }
}

function createPreparedOrbitMaterialCache(atlas) {
  const plan = atlas?.runtimeShards;
  if (plan?.model !== "prepared-variant-single-atlas" ||
      typeof plan.defaultVariant !== "string" ||
      !plan.variants?.[plan.defaultVariant] ||
      Object.values(plan.variants).some((variant) =>
        !variant.runtimeAtlas?.assetUrl ||
        variant.presentations?.length !== atlas.frameCount)) {
    throw new Error("Saturn orbit material runtime atlas is invalid.");
  }
  return createPreparedRowCache({
    label: "orbit material",
    plan,
    variants: plan.variants,
    defaultVariant: plan.defaultVariant,
  });
}

function createPreparedVariantAtlasCache(plan, label) {
  if (plan?.model !== "prepared-variant-single-atlas" ||
      !plan.variants?.[plan.defaultVariant]) {
    throw new Error(`Saturn ${label} runtime atlas is invalid.`);
  }
  return createPreparedRowCache({
    label,
    plan,
    variants: plan.variants,
    defaultVariant: plan.defaultVariant,
  });
}

export function createPreparedRowCache({
  label,
  plan,
  variants,
  defaultVariant,
  canonicalHighDensity = false,
}) {
  for (const [id, variant] of Object.entries(variants)) {
    if (!variant.runtimeAtlas?.assetUrl ||
        !Array.isArray(variant.presentations) ||
        variant.presentations.length === 0) {
      throw new Error(`Saturn ${label} variant is invalid: ${id}.`);
    }
  }
  const states = new Map(Object.keys(variants).map((id) => [id, {
    defaultImage: null,
    residentImages: Object.freeze([]),
    residentReady: false,
    pendingResident: null,
    pendingImage: null,
    desiredRow: null,
    appliedRow: null,
    defaultReady: false,
    pendingDefault: null,
    active: false,
    generation: 0,
  }]));
  let destroyed = false;
  let activeVariant = defaultVariant;
  let decodeCount = 0;
  let startupDecodeCount = 0;
  let runtimeDecodeCount = 0;
  let preparingStartup = false;
  let residentReleaseCount = 0;
  let residentStartupImageAllocations = 0;
  let residentRuntimeImageAllocations = 0;

  return Object.freeze({
    async prepareInitial() {
      preparingStartup = true;
      try {
        await prepareVariant(defaultVariant);
        if (!destroyed && states.get(defaultVariant).residentReady) {
          setActiveVariant(defaultVariant);
        }
      } finally {
        preparingStartup = false;
      }
    },
    prepareVariant,
    isPrepared(variantId) {
      return !destroyed && states.get(variantId)?.residentReady === true;
    },
    releaseUnused(keepVariant = null) {
      const errors = [];
      for (const [id, state] of states) {
        if (state.active || id === keepVariant) continue;
        try { releaseState(state); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, `Saturn ${label} inactive atlas cleanup failed.`);
    },
    async preparePresentation(frameIndex, variantId = activeVariant) {
      const variant = requireVariant(variantId);
      const state = states.get(variantId);
      const prepared = variant.presentations[frameIndex];
      if (!prepared) {
        throw new RangeError(`Unprepared Saturn ${label} frame: ${frameIndex}.`);
      }
      await prepareVariant(variantId);
      if (!state.residentReady) return null;
      state.desiredRow = prepared.rowIndex;
      state.appliedRow = prepared.rowIndex;
      return prepared;
    },
    async prepareDefault(variantId = activeVariant) {
      const variant = requireVariant(variantId);
      if (!variant.defaultPresentation) return null;
      await prepareVariant(variantId);
      return variant.defaultPresentation;
    },
    presentation(frameIndex, variantId = activeVariant) {
      const variant = requireVariant(variantId);
      const state = states.get(variantId);
      const prepared = variant.presentations[frameIndex];
      if (!prepared) {
        throw new RangeError(`Unprepared Saturn ${label} frame: ${frameIndex}.`);
      }
      if (!state.residentReady) return null;
      setActiveVariant(variantId);
      state.desiredRow = prepared.rowIndex;
      state.appliedRow = prepared.rowIndex;
      return prepared;
    },
    defaultPresentation(variantId = activeVariant) {
      const variant = requireVariant(variantId);
      const state = states.get(variantId);
      if (!variant.defaultPresentation) return null;
      if (!state.defaultReady || !state.residentReady) return null;
      setActiveVariant(variantId);
      return variant.defaultPresentation;
    },
    release() {
      if (destroyed) return false;
      const state = states.get(activeVariant);
      const wasActive = state.active;
      releaseState(state);
      return wasActive;
    },
    releaseVariant(variantId) {
      const state = states.get(variantId);
      if (!state || (variantId === activeVariant && state.active)) return false;
      releaseState(state);
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors = [];
      for (const state of states.values()) {
        try { releaseState(state); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, `Saturn ${label} atlas cleanup failed.`);
    },
    stats() {
      const activeState = states.get(activeVariant);
      const residentRowCount = activeState.residentImages.length;
      const decodedWorkingSetBytes = typeof plan.fullAtlasDecodedRgbaBytes ===
          "number"
        ? plan.fullAtlasDecodedRgbaBytes
        : plan.fullAtlasDecodedRgbaBytes?.dpr2 ?? null;
      return Object.freeze({
        model: "prepared-single-address-atlas-residency",
        sourceModel: plan.model,
        activeVariant,
        active: activeState.active,
        retainedImageCount:
          residentRowCount +
          Number(activeState.defaultImage !== null),
        retainedRowCount: residentRowCount,
        pendingRowCount:
          Number(activeState.pendingResident !== null) +
          Number(activeState.pendingDefault !== null),
        maximumRetainedAtlasCount: 1,
        retainedAtlasCount: residentRowCount,
        residentRowCount,
        residentReady: activeState.residentReady,
        requestedRows: Object.freeze(activeState.desiredRow === null
          ? []
          : [activeState.desiredRow]),
        preparedRowCount: residentRowCount,
        decodeCount,
        releaseCount: residentReleaseCount,
        startupDecodeCount,
        runtimeDecodeCount,
        startupImageAllocations: residentStartupImageAllocations,
        runtimeImageAllocations: residentRuntimeImageAllocations,
        initialDecodedWorkingSetBytes: decodedWorkingSetBytes,
        maximumDecodedWorkingSetBytes: decodedWorkingSetBytes,
        fullAtlasDecodedRgbaBytes: plan.fullAtlasDecodedRgbaBytes,
      });
    },
  });

  async function prepareVariant(variantId) {
    if (destroyed) return false;
    const variant = requireVariant(variantId);
    const state = states.get(variantId);
    await warmResidentRows(state, variant);
    if (variant.defaultPresentation && state.residentReady) {
      state.defaultImage = state.residentImages[0];
      state.defaultReady = true;
    }
  }

  function setActiveVariant(variantId) {
    const nextState = states.get(variantId);
    if (variantId === activeVariant) {
      nextState.active = true;
      return;
    }
    const previousState = states.get(activeVariant);
    releaseState(previousState);
    activeVariant = variantId;
    nextState.active = true;
  }

  function warmDefault(variantId) {
    const variant = variants[variantId];
    const state = states.get(variantId);
    if (state.defaultReady) return Promise.resolve(true);
    if (state.pendingDefault) return state.pendingDefault;
    let request;
    request = warmResidentRows(state, variant).then((ready) => {
      if (state.pendingDefault === request) state.pendingDefault = null;
      if (!ready || !state.residentReady) return false;
      state.defaultImage = state.residentImages[0];
      state.defaultReady = true;
      return true;
    }, (error) => {
      if (state.pendingDefault === request) state.pendingDefault = null;
      throw error;
    });
    state.pendingDefault = request;
    return request;
  }

  function warmResidentRows(state, variant) {
    if (destroyed) return Promise.resolve(false);
    if (state.residentReady) return Promise.resolve(true);
    if (state.pendingResident) return state.pendingResident;
    const generation = state.generation;
    const preparingAtRequest = preparingStartup;
    const image = new Image();
    image.decoding = "sync";
    state.pendingImage = image;
    const request = decodePreparedImage(image,
      (canonicalHighDensity && variant.runtimeAtlas.asset2xUrl) || variant.runtimeAtlas.assetUrl,
    ).then(() => {
      if (state.pendingResident === request) state.pendingResident = null;
      if (state.pendingImage === image) state.pendingImage = null;
      if (destroyed || state.generation !== generation) {
        return false;
      }
      state.residentImages = Object.freeze([image]);
      state.residentReady = true;
      if (preparingAtRequest) {
        residentStartupImageAllocations += 1;
      } else {
        residentRuntimeImageAllocations += 1;
      }
      noteDecode();
      return true;
    }, (error) => {
      if (destroyed || state.generation !== generation) return false;
      if (state.pendingResident === request) state.pendingResident = null;
      if (state.pendingImage === image) state.pendingImage = null;
      try { releasePreparedImage(image); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], error.message, { cause: error });
      }
      throw error;
    });
    state.pendingResident = request;
    return request;
  }

  function noteDecode() {
    decodeCount += 1;
    if (preparingStartup) startupDecodeCount += 1;
    else runtimeDecodeCount += 1;
  }

  function requireVariant(variantId) {
    const variant = variants[variantId];
    if (!variant) {
      throw new RangeError(`Unknown Saturn ${label} variant: ${variantId}.`);
    }
    return variant;
  }

  function releaseState(state) {
    const images = new Set([state.pendingImage, ...state.residentImages]);
    images.delete(null);
    residentReleaseCount += state.residentImages.length;
    state.generation += 1;
    state.active = false;
    state.appliedRow = null;
    state.desiredRow = null;
    state.defaultReady = false;
    state.pendingDefault = null;
    state.pendingResident = null;
    state.pendingImage = null;
    state.residentImages = Object.freeze([]);
    state.residentReady = false;
    state.defaultImage = null;
    const errors = [];
    for (const image of images) {
      try { releasePreparedImage(image); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, `Saturn ${label} image cleanup failed.`);
  }
}

function mountPreparedScene(host, plan, lifetime) {
  if (plan.schema !== "csssaturn-prepared-runtime-scene@1" ||
      plan.interior?.schema !== "csssaturn-prepared-cutaway@1") {
    throw new TypeError("Saturn retained scene plan is incompatible.");
  }
  const camera = document.createElement("div");
  lifetime.onDispose(() => camera.remove());
  ownSaturnPresentationCleanup(host, camera, lifetime);
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = document.createElement("div");
  scene.className = "polycss-scene";
  scene.ariaHidden = "true";
  scene.style.cssText = plan.camera.sceneStyle;
  camera.appendChild(scene);

  const system = createMesh(
    "saturn-system",
    plan.systemTransform,
  );
  scene.appendChild(system);

  const ringMesh = createMesh(
    "saturn-ring-orbit saturn-ring-plane",
    plan.meshTransform,
  );
  const ringLeaf = createTextureLeaf(plan.ringPlane);
  ringMesh.appendChild(ringLeaf);
  system.appendChild(ringMesh);

  const ringMotionMeshes = new Map();
  for (const plate of plan.ringMotionPlates) {
    const classes = ["saturn-ring-orbit"];
    if (plate.compositeMode === "flat") classes.push("saturn-ring-flat");
    const mesh = createMesh(
      classes.join(" "),
      `${plan.meshTransform};animation-duration:${plate.durationSeconds}s`,
    );
    const leaf = createTextureLeaf(plate.leaf);
    mesh.appendChild(leaf);
    system.appendChild(mesh);
    ringMotionMeshes.set(plate.population, mesh);
  }

  const ringShadowMesh = createMesh(
    "saturn-ring-shadow",
    plan.meshTransform,
  );
  const ringShadowLeaf = createTextureLeaf(plan.ringShadowPlane);
  ringShadowMesh.appendChild(ringShadowLeaf);
  system.appendChild(ringShadowMesh);

  for (const group of plan.ringPointGroups) {
    const classes = [`saturn-ring-${group.pointMode}`];
    if (group.animated) classes.unshift("saturn-ring-orbit");
    if (group.compositeMode === "flat") classes.push("saturn-ring-flat");
    const mesh = createMesh(
      classes.join(" "),
      group.animated
        ? `${plan.meshTransform};animation-duration:${group.durationSeconds}s`
        : plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of group.leaves) {
      const point = document.createElement("b");
      point.style.cssText = leaf.style;
      leaves.appendChild(point);
    }
    mesh.appendChild(leaves);
    system.appendChild(mesh);
  }

  const bodyBandCarriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("saturn-polar"));
    const carrierKey = `${polar ? "polar" : "body"}:` +
      band.visualRotationSeconds;
    let carrier = bodyBandCarriers.get(carrierKey);
    if (!carrier) {
      const element = createMesh(
        polar
          ? "saturn-body saturn-body-polar"
          : "saturn-body",
        `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      carrier = Object.freeze({
        element,
        durationSeconds: band.visualRotationSeconds,
      });
      bodyBandCarriers.set(carrierKey, carrier);
      system.appendChild(element);
    }
    const bodyLeaves = document.createDocumentFragment();
    for (const leaf of band.leaves) {
      const element = leaf.tag === "s"
        ? createTextureLeaf(leaf)
        : document.createElement(leaf.tag);
      if (leaf.tag !== "s") element.style.cssText = leaf.style;
      bodyLeaves.appendChild(element);
    }
    carrier.element.appendChild(bodyLeaves);
  }
  const bodyBands = Object.freeze([...bodyBandCarriers.values()]);
  const cutaway = createPreparedInterior(plan);
  system.appendChild(cutaway);
  const viewBank = Object.freeze({
    mountInterior() {
      return false;
    },
    state() {
      return Object.freeze({
        interiorMounted: true,
        interiorLeafCount: cutaway.querySelectorAll("b, s, u").length,
      });
    },
  });

  const fixedMaterialMesh = createMesh(
    "saturn-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialCounter = createMesh(
    "saturn-fixed-material-counter",
    "",
  );
  const fixedMaterialLeaf = createTextureLeaf(plan.fixedMaterialPlane.leaf);
  fixedMaterialLeaf.classList.add("saturn-exterior-material");
  const interiorAtmosphereLeaf = createTextureLeaf(
    plan.interior.atmosphere.leaf,
  );
  interiorAtmosphereLeaf.style.backgroundImage = "none";
  interiorAtmosphereLeaf.classList.add("saturn-interior-material");
  fixedMaterialMesh.append(fixedMaterialLeaf, interiorAtmosphereLeaf);
  const materialSystem = createMesh(
    "saturn-system",
    plan.systemTransform,
  );
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  materialSystem.appendChild(fixedMaterialCounter);
  scene.appendChild(materialSystem);

  host.replaceChildren(camera);
  const cubicSky = mountRetainedCubicSky({
    host,
    plan: PREPARED_SATURN_STARFIELD,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "saturn",
    requireSun: false,
  });
  lifetime.onDispose(cubicSky.destroy);
  const skySun = mountRetainedDirectionalSun({
    host,
    plan: PREPARED_SATURN_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "saturn",
    before: camera,
  });
  lifetime.onDispose(skySun.destroy);
  const layerRegistration = registerBodyDependentLayers({
    objectId: "saturn",
    sceneElement: scene,
    bodySystem: system,
    lightingOverlays: [materialSystem],
  });
  const stableNodes = Object.freeze([...host.querySelectorAll("*")]);
  const stableParents = stableNodes.map((node) => node.parentNode);
  const retainedLeaves = Object.freeze([
    ...host.querySelectorAll(".polycss-scene b, .polycss-scene s, .polycss-scene u"),
  ]);
  const retainedGroups = Object.freeze([
    ...host.querySelectorAll(".polycss-scene div"),
  ]);
  const sceneNodes = [
    scene,
    ...scene.querySelectorAll("*"),
  ];
  const sceneDataAttributeCount = sceneNodes.reduce(
    (count, element) => count + [...element.attributes]
      .filter(({ name }) => name.startsWith("data-")).length,
    0,
  );
  const maximumSceneDepth = Math.max(...retainedLeaves.map((leaf) => {
    let depth = 0;
    for (let node = leaf;
      node && !node.classList.contains("polycss-scene");
      node = node.parentElement) depth += 1;
    return depth;
  }));
  const domStats = Object.freeze({
    mode: "semantic-transform-groups-with-bare-leaves-and-retained-banks",
    retainedInitialNodeCount: stableNodes.length,
    retainedCameraRootCount: 1,
    retainedMaterialCompositeRootCount: 0,
    retainedSceneRootCount: 1,
    retainedCubicSkyFaceCount: cubicSky.faceCount,
    retainedTransformGroupCount: retainedGroups.length,
    retainedLeafCount: retainedLeaves.length,
    retainedLeafClassCount: retainedLeaves.filter(({ className }) => className).length,
    retainedSceneDataAttributeCount: sceneDataAttributeCount,
    maximumSceneDepth,
    maximumRetainedLeafCount: retainedLeaves.length,
    onDemandPreparedLeafCount: 0,
    onDemandPreparedInteriorLeafCount: 0,
    onDemandPreparedMinorMoonLeafCount: 0,
    runtimeDomGrowth: false,
    runtimeDomGrowthPolicy: "none-retained-scene-complete-at-mount",
  });
  return Object.freeze({
    stableNodes,
    camera,
    scene,
    system,
    materialSystem,
    cubicSky,
    skySun,
    fixedMaterialCounter,
    fixedMaterialMesh,
    fixedMaterialLeaf,
    interiorAtmosphereLeaf,
    viewBank,
    bodyBands,
    domStats,
    polygonLeafCount: retainedLeaves.length,
    textureLeafCount: retainedLeaves.filter(({ localName }) => localName === "s").length,
    assertStableDomIdentity() {
      for (let index = 0; index < stableNodes.length; index += 1) {
        if (!stableNodes[index].isConnected ||
            stableNodes[index].parentNode !== stableParents[index]) {
          throw new Error(`Saturn retained DOM identity changed at node ${index}.`);
        }
      }
      layerRegistration.assertRegistered();
      return true;
    },
  });
}

export function ownSaturnPresentationCleanup(stage, camera, lifetime) {
  lifetime.onDispose(() => {
    if (camera.parentNode !== stage) return;
    delete stage.dataset.lens;
    delete stage.dataset.view;
  });
}

function createPreparedInterior(plan) {
  const cutaway = createMesh("saturn-cutaway", "");
  for (const band of plan.interior.outerBodyBands) {
    if (band.leaves.length === 0) continue;
    const polar = band.leaves.some(({ className }) =>
      className?.includes("saturn-cutaway-outer-pole"));
    const bodyMesh = createMesh(
      polar
        ? "saturn-body saturn-cutaway-body saturn-cutaway-polar-band"
        : "saturn-body saturn-cutaway-body",
      plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of band.leaves) leaves.appendChild(createTextureLeaf(leaf));
    bodyMesh.appendChild(leaves);
    cutaway.appendChild(bodyMesh);
  }
  for (const shell of plan.interior.shells) {
    const shellMesh = createMesh(
      `saturn-interior-shell ${shell.className}`,
      plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of shell.leaves) {
      const element = createTextureLeaf(leaf);
      if (leaf.className) element.className = leaf.className;
      leaves.appendChild(element);
    }
    shellMesh.appendChild(leaves);
    cutaway.appendChild(shellMesh);
  }
  const sectionMesh = createMesh(
    "saturn-interior-sections",
    plan.meshTransform,
  );
  const sectionLeaves = document.createDocumentFragment();
  for (const leaf of plan.interior.sectionLeaves) {
    const element = createTextureLeaf(leaf);
    if (leaf.className) element.className = leaf.className;
    sectionLeaves.appendChild(element);
  }
  sectionMesh.appendChild(sectionLeaves);
  cutaway.appendChild(sectionMesh);
  return cutaway;
}

function createSaturnCubicOrbitControls({
  stage,
  lifetime,
  onError,
  inputSurface,
  mounted,
  interactionFrames,
  materialOrbitAtlas,
  orbitMaterialCache,
  interiorAtmosphereCache,
  interiorAtmosphereAtlas,
}) {
  if (interactionFrames?.schema !==
      "csssaturn-prepared-interaction-frames@1" ||
      interactionFrames.frameCount !== materialOrbitAtlas.frameCount ||
      interactionFrames.frames.length !== interactionFrames.frameCount) {
    throw new Error("Saturn prepared interaction frame bank drifted.");
  }
  const materialLensById = new Map(PREPARED_SATURN_LENSES.controls.map(
    (lens) => [lens.id, lens],
  ));
  const materialVariantId = (lensId, mode) =>
    mode === "full" ? lensId : `${lensId}-${mode}`;
  let orbit = null;
  let activeMaterialLens = PREPARED_SATURN_LENSES.defaultLens;
  let activeMaterialMode = "full";
  let materialFrame = interactionFrames.defaultFrame.frameIndex;
  let lastMaterialPresentationKey = null;
  let lastInteriorPresentationKey = null;
  let baseSunViewZ = null;
  let baseLightAzimuthDegrees = null;
  let transformWrites = 0;
  let materialAddressWrites = 0;
  let interiorAddressWrites = 0;
  const publishExteriorMaterial = createEllipsoidMaterialPublisher({
    element: mounted.fixedMaterialLeaf,
    bodySystem: mounted.system,
    bodyMesh: mounted.bodyBands[0].element,
    materialSystem: mounted.materialSystem,
    materialCounter: mounted.fixedMaterialCounter,
    materialMesh: mounted.fixedMaterialMesh,
    projection: PREPARED_SATURN_SCENE.fixedMaterialPlane
      .interactionProjection,
    width: 1024,
  });
  const publishInteriorMaterial = createEllipsoidMaterialPublisher({
    element: mounted.interiorAtmosphereLeaf,
    bodySystem: mounted.system,
    bodyMesh: mounted.bodyBands[0].element,
    materialSystem: mounted.materialSystem,
    materialCounter: mounted.fixedMaterialCounter,
    materialMesh: mounted.fixedMaterialMesh,
    projection: PREPARED_SATURN_SCENE.fixedMaterialPlane
      .interactionProjection,
    width: 1024,
  });

  const publish = ({
    sunViewDirection,
    sceneMatrix,
    counterRotationFor,
    controlPitch,
    controlYaw,
  }) => {
    if (lifetime.disposed) return;
    const localCounter = counterRotationFor(
      mounted.materialSystem.style.transform,
    );
    if (mounted.fixedMaterialCounter.style.transform !== localCounter) {
      mounted.fixedMaterialCounter.style.transform = localCounter;
      transformWrites += 1;
    }
    const defaultFrame = Math.round(clamp(
      (
        materialOrbitAtlas.maximumScenePitchDegrees -
          SATURN_CUBIC_CAMERA.initialScenePitchDegrees
      ) / (
        materialOrbitAtlas.maximumScenePitchDegrees -
          materialOrbitAtlas.minimumScenePitchDegrees
      ) * (materialOrbitAtlas.frameCount - 1),
      0,
      materialOrbitAtlas.frameCount - 1,
    ));
    baseSunViewZ ??= sunViewDirection[2];
    materialFrame = Math.round(clamp(
      defaultFrame + (baseSunViewZ - sunViewDirection[2]) *
        ((materialOrbitAtlas.frameCount - 1) / 2),
      0,
      materialOrbitAtlas.frameCount - 1,
    ));
    const useDefault = Math.abs(
      controlPitch - SATURN_CUBIC_CAMERA.defaultControlPitchDegrees,
    ) < 0.01 && Math.abs(
      controlYaw - SATURN_CUBIC_CAMERA.defaultControlYawDegrees,
    ) < 0.01;
    const activeVariant = materialVariantId(
      activeMaterialLens,
      activeMaterialMode,
    );
    const materialPresentation = useDefault
      ? orbitMaterialCache.defaultPresentation(activeVariant)
      : orbitMaterialCache.presentation(materialFrame, activeVariant);
    const materialKey = `${activeVariant}:${useDefault ? -1 : materialFrame}`;
    if (materialPresentation && materialKey !== lastMaterialPresentationKey) {
      materialAddressWrites += publishAtlasPresentation(
        mounted.fixedMaterialLeaf,
        materialPresentation,
      );
      lastMaterialPresentationKey = materialKey;
    }
    const azimuth = Math.atan2(
      sunViewDirection[1],
      sunViewDirection[0],
    ) * 180 / Math.PI;
    baseLightAzimuthDegrees ??= azimuth;
    const materialRoll = normalizeDegrees(azimuth - baseLightAzimuthDegrees);
    transformWrites += Number(publishExteriorMaterial({
      degrees: materialRoll,
      sceneMatrix,
      preserveApprovedDefault: useDefault,
    }));

    const normalizedShadowFrame = materialFrame /
      Math.max(1, materialOrbitAtlas.frameCount - 1);
    if (stage.dataset.view === "interior") {
      const interiorFrame = Math.round(normalizedShadowFrame *
        (interiorAtmosphereAtlas.frameCount - 1));
      const interiorPresentation = useDefault
        ? interiorAtmosphereCache.defaultPresentation(activeVariant)
        : interiorAtmosphereCache.presentation(interiorFrame, activeVariant);
      const interiorKey = `${activeVariant}:${useDefault ? -1 : interiorFrame}`;
      if (interiorPresentation && interiorKey !== lastInteriorPresentationKey) {
        interiorAddressWrites += publishAtlasPresentation(
          mounted.interiorAtmosphereLeaf,
          interiorPresentation,
        );
        lastInteriorPresentationKey = interiorKey;
      }
      transformWrites += Number(publishInteriorMaterial({
        degrees: materialRoll,
        sceneMatrix,
        preserveApprovedDefault: useDefault,
      }));
    }

  };
  orbit = createRetainedCubicSkyOrbit({
    stage,
    inputSurface,
    cameraElement: mounted.camera,
    sceneElement: mounted.scene,
    cubicSky: mounted.cubicSky,
    skyPlan: PREPARED_SATURN_STARFIELD,
    directionalSun: mounted.skySun,
    directionalSunPlan: PREPARED_SATURN_SKY_SUN,
    cameraPlan: SATURN_CUBIC_CAMERA,
    objectId: "saturn",
    mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    onPublish: publish,
    onError,
  });
  const modeFor = ({ rings, shadows }) => !rings
    ? shadows ? "ringless" : "ringless-no-shadows"
    : shadows ? "full" : "no-shadows";

  const validatePresentation = (prepared) => {
    if (!prepared || !orbitMaterialCache.isPrepared(prepared.variantId) ||
        (prepared.interior && !interiorAtmosphereCache.isPrepared(prepared.variantId))) {
      throw new Error("Saturn presentation assets are not ready.");
    }
  };
  return Object.freeze({
    mobilePageFlow: orbit.mobilePageFlow,
    refresh: orbit.refresh,
    setState: orbit.setState,
    state: orbit.state,
    async preparePresentation({ lensId, rings, shadows, interior }, { isCurrent }) {
      if (!materialLensById.has(lensId)) throw new RangeError(`Unknown Saturn material lens: ${lensId}.`);
      if (!isCurrent()) return null;
      const mode = modeFor({ rings, shadows });
      const variantId = materialVariantId(lensId, mode);
      // An entire prepared atlas covers every current camera pose. Preparation
      // changes cache residency only; activation belongs to the winning commit.
      await orbitMaterialCache.prepareVariant(variantId);
      if (!isCurrent()) return null;
      if (interior) await interiorAtmosphereCache.prepareVariant(variantId);
      if (!isCurrent()) return null;
      return Object.freeze({ lensId, mode, variantId, interior });
    },
    validatePresentation,
    commitPresentation(prepared) {
      validatePresentation(prepared);
      activeMaterialLens = prepared.lensId;
      activeMaterialMode = prepared.mode;
      lastMaterialPresentationKey = null;
      lastInteriorPresentationKey = null;
      if (!prepared.interior) {
        interiorAtmosphereCache.release();
        mounted.interiorAtmosphereLeaf.style.backgroundImage = "none";
      }
      orbit.refresh();
    },
    releaseUnused(desired = null) {
      const variant = desired ? materialVariantId(desired.lensId, modeFor(desired)) : null;
      orbitMaterialCache.releaseUnused(variant);
      interiorAtmosphereCache.releaseUnused(desired?.interior ? variant : null);
    },
    stats() {
      return Object.freeze({
        ...orbit.stats(),
        materialFrame,
        transformWrites,
        materialAddressWrites,
        interiorAddressWrites,
      });
    },
    destroy() {
      orbit.destroy();
    },
  });
}

function publishAtlasPresentation(
  leaf,
  presentation,
  canonicalHighDensity = false,
) {
  let writes = 0;
  const imageValue = canonicalHighDensity
    ? `url("${presentation.asset2xUrl || presentation.assetUrl}")`
    : `url("${presentation.assetUrl}")`;
  for (const [property, value] of [
    ["backgroundImage", imageValue],
    ["backgroundPosition", presentation.backgroundPosition],
    ["backgroundSize", presentation.backgroundSize],
  ]) {
    if (leaf.style[property] === value) continue;
    leaf.style[property] = value;
    writes += 1;
  }
  return writes;
}

function createEllipsoidMaterialPublisher({
  element,
  bodySystem,
  bodyMesh,
  materialSystem,
  materialCounter,
  materialMesh,
  projection,
  width,
  height = width,
}) {
  if (!(element instanceof HTMLElement) ||
      !(bodySystem instanceof HTMLElement) ||
      !(bodyMesh instanceof HTMLElement) ||
      !(materialSystem instanceof HTMLElement) ||
      !(materialCounter instanceof HTMLElement) ||
      !(materialMesh instanceof HTMLElement) ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(projection?.equatorialRadius) ||
      !Number.isFinite(projection?.polarRadius) ||
      !Number.isFinite(projection?.tileSize)) {
    throw new TypeError("Saturn ellipsoid material projection is invalid.");
  }
  const baseProjection = parseTransformMatrix(element.style.transform);
  const equatorialRadius = projection.equatorialRadius * projection.tileSize;
  const polarRadius = projection.polarRadius * projection.tileSize;
  const coverageScale = projection.coverageScale ?? 1;
  let publishedTransform = null;

  return ({ degrees, sceneMatrix, preserveApprovedDefault = false }) => {
    if (!Number.isFinite(degrees) || typeof sceneMatrix !== "string") {
      throw new TypeError("Saturn material presentation must be finite.");
    }
    const localRotation = multiplyMatrix4(
      translationMatrix(width / 2, height / 2),
      multiplyMatrix4(
        rotationMatrix("z", degrees),
        translationMatrix(-width / 2, -height / 2),
      ),
    );
    const uncorrectedProjection = multiplyMatrix4(
      baseProjection,
      localRotation,
    );
    const nextProjection = preserveApprovedDefault
      ? uncorrectedProjection
      : correctEllipsoidMaterialProjection({
        sceneMatrix: parseTransformMatrix(sceneMatrix),
        bodySystemMatrix: parseTransformMatrix(bodySystem.style.transform),
        bodyMeshMatrix: parseTransformMatrix(bodyMesh.style.transform),
        materialSystemMatrix: parseTransformMatrix(
          materialSystem.style.transform,
        ),
        materialCounterMatrix: parseTransformMatrix(
          materialCounter.style.transform,
        ),
        materialMeshMatrix: parseTransformMatrix(
          materialMesh.style.transform,
        ),
        materialProjection: uncorrectedProjection,
        equatorialRadius: equatorialRadius * coverageScale,
        polarRadius: polarRadius * coverageScale,
        width,
        height,
      });
    const transform = serializeMatrix4(nextProjection);
    if (transform === publishedTransform &&
        element.style.transform === transform) return false;
    element.style.removeProperty("rotate");
    element.style.transform = transform;
    publishedTransform = transform;
    return true;
  };
}

function correctEllipsoidMaterialProjection({
  sceneMatrix,
  bodySystemMatrix,
  bodyMeshMatrix,
  materialSystemMatrix,
  materialCounterMatrix,
  materialMeshMatrix,
  materialProjection,
  equatorialRadius,
  polarRadius,
  width,
  height,
}) {
  const bodyMatrix = multiplyMatrix4(
    multiplyMatrix4(sceneMatrix, bodySystemMatrix),
    bodyMeshMatrix,
  );
  const materialParentMatrix = multiplyMatrix4(
    multiplyMatrix4(
      multiplyMatrix4(sceneMatrix, materialSystemMatrix),
      materialCounterMatrix,
    ),
    materialMeshMatrix,
  );
  const materialMatrix = multiplyMatrix4(
    materialParentMatrix,
    materialProjection,
  );
  const bodyDirections = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map(([x, y, z]) => transformPoint(bodyMatrix, x, y, z, 0));
  const bodyCovariance = ellipseCovariance(
    bodyDirections,
    [equatorialRadius, equatorialRadius, polarRadius],
  );
  const materialDirections = [
    transformPoint(materialMatrix, 1, 0, 0, 0),
    transformPoint(materialMatrix, 0, 1, 0, 0),
  ];
  const materialCovariance = ellipseCovariance(
    materialDirections,
    [width / 2, height / 2],
  );
  const correction = covarianceCorrection(
    bodyCovariance,
    materialCovariance,
  );
  const materialCenter = transformPoint(
    materialMatrix,
    width / 2,
    height / 2,
    0,
    1,
  );
  const bodyCenter = transformPoint(bodyMatrix, 0, 0, 0, 1);
  const translateX = bodyCenter.x -
    correction[0][0] * materialCenter.x -
    correction[0][1] * materialCenter.y;
  const translateY = bodyCenter.y -
    correction[1][0] * materialCenter.x -
    correction[1][1] * materialCenter.y;
  const screenCorrection = [
    correction[0][0], correction[1][0], 0, 0,
    correction[0][1], correction[1][1], 0, 0,
    0, 0, 1, 0,
    translateX, translateY, 0, 1,
  ];
  return multiplyMatrix4(
    multiplyMatrix4(invertAffineMatrix4(materialParentMatrix), screenCorrection),
    materialMatrix,
  );
}

function parseTransformMatrix(value) {
  const transform = value.trim();
  if (!transform || transform === "none") return identityMatrix4();
  const matrixMatch = transform.match(/^matrix3d\(([^)]+)\)$/u);
  if (matrixMatch) {
    const values = matrixMatch[1].split(",").map(Number);
    if (values.length === 16 && values.every(Number.isFinite)) return values;
    throw new TypeError("Saturn matrix3d transform is invalid.");
  }

  const operationPattern = /rotate([XYZ])\((-?[\d.]+)deg\)/gu;
  let matrix = identityMatrix4();
  let remainder = transform;
  for (const match of transform.matchAll(operationPattern)) {
    matrix = multiplyMatrix4(
      matrix,
      rotationMatrix(match[1].toLowerCase(), Number(match[2])),
    );
    remainder = remainder.replace(match[0], "");
  }
  if (remainder.trim()) {
    throw new TypeError(`Unsupported Saturn transform: ${value}`);
  }
  return matrix;
}

function identityMatrix4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function translationMatrix(x, y, z = 0) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function rotationMatrix(axis, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  if (axis === "x") {
    return [
      1, 0, 0, 0,
      0, cosine, sine, 0,
      0, -sine, cosine, 0,
      0, 0, 0, 1,
    ];
  }
  if (axis === "y") {
    return [
      cosine, 0, -sine, 0,
      0, 1, 0, 0,
      sine, 0, cosine, 0,
      0, 0, 0, 1,
    ];
  }
  return [
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function multiplyMatrix4(left, right) {
  const product = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        product[column * 4 + row] +=
          left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return product;
}

function invertAffineMatrix4(matrix) {
  const [a, d, g, , b, e, h, , c, f, i] = matrix;
  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new RangeError("Saturn material parent transform became singular.");
  }
  const inverse = [
    (e * i - f * h) / determinant,
    (f * g - d * i) / determinant,
    (d * h - e * g) / determinant,
    0,
    (c * h - b * i) / determinant,
    (a * i - c * g) / determinant,
    (b * g - a * h) / determinant,
    0,
    (b * f - c * e) / determinant,
    (c * d - a * f) / determinant,
    (a * e - b * d) / determinant,
    0,
    0, 0, 0, 1,
  ];
  const translation = transformPoint(
    inverse,
    matrix[12],
    matrix[13],
    matrix[14],
    0,
  );
  inverse[12] = -translation.x;
  inverse[13] = -translation.y;
  inverse[14] = -translation.z;
  return inverse;
}

function transformPoint(matrix, x, y, z, w) {
  return Object.freeze({
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
  });
}

function serializeMatrix4(matrix) {
  return `matrix3d(${matrix.map((value) =>
    Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))
  ).join(",")})`;
}

function ellipseCovariance(directions, radii) {
  return Object.freeze({
    xx: directions.reduce(
      (sum, direction, index) =>
        sum + (direction.x * radii[index]) ** 2,
      0,
    ),
    xy: directions.reduce(
      (sum, direction, index) =>
        sum + direction.x * direction.y * radii[index] ** 2,
      0,
    ),
    yy: directions.reduce(
      (sum, direction, index) =>
        sum + (direction.y * radii[index]) ** 2,
      0,
    ),
  });
}

function covarianceCorrection(target, source) {
  const targetRoot = covarianceSquareRoot(target);
  const sourceRootInverse = invertMatrix2(covarianceSquareRoot(source));
  return multiplyMatrix2(targetRoot, sourceRootInverse);
}

function covarianceSquareRoot(matrix) {
  const determinantRoot = Math.sqrt(Math.max(
    0,
    matrix.xx * matrix.yy - matrix.xy ** 2,
  ));
  const divisor = Math.sqrt(Math.max(
    Number.EPSILON,
    matrix.xx + matrix.yy + 2 * determinantRoot,
  ));
  return [
    [(matrix.xx + determinantRoot) / divisor, matrix.xy / divisor],
    [matrix.xy / divisor, (matrix.yy + determinantRoot) / divisor],
  ];
}

function invertMatrix2(matrix) {
  const determinant =
    matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new RangeError("Saturn material projection became singular.");
  }
  return [
    [matrix[1][1] / determinant, -matrix[0][1] / determinant],
    [-matrix[1][0] / determinant, matrix[0][0] / determinant],
  ];
}

function multiplyMatrix2(left, right) {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
    ],
  ];
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  if (style) mesh.style.cssText = style;
  return mesh;
}

function createTextureLeaf(leaf) {
  return createPreparedProjectiveTextureLeaf(leaf);
}
