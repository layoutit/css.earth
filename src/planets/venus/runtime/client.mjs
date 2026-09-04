import { createPreparedCameraPublisher } from
  "../../../platform/prepared-camera-runtime.mjs";
import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import {
  BASE_TILE,
  createPolyCamera,
  createPolyOrbitControls,
  createPolyScene,
} from "@layoutit/polycss";

import {
  bindResponsiveOrbitPolicy,
  CANONICAL_PREPARED_IMAGE_DENSITY,
  MOBILE_VIEWPORT_QUERY,
} from "../../../../site/runtime-policy.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import {
  createCubicSkyCameraOrientation,
  createUnboundedMatrixDragControls,
  measureRetainedPlanetTrackball,
  mountRetainedCubicSky,
  preparedScenePitch,
  selectPreparedResponsiveZoom,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { createVenusFeatureControls } from "./feature-controls.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import { PREPARED_VENUS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_VENUS_SCENE } from "./preparedScene.mjs";
import { PREPARED_VENUS_SKY_SUN } from "./preparedSkySun.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountVenusClient(stage, { onError }) {
  if (typeof onError !== "function") throw new TypeError("Venus requires onError.");
  const lifetime = createSceneLifetime();
  const warmImages = new Set();
  lifetime.onDispose(() => {
    releaseImageGroup(warmImages);
  });
  const decodeWarm = (url, url2x) => decodeImage(url, url2x, warmImages);
  const inputSurface = document.querySelector(".venus-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Venus input surface is missing.");
  }
  let shouldPlay = false;
  let mounted = null;
  let orbitCamera = null;
  let featureControls = null;
  let lensControls = null;
  let sceneAnimations = Object.freeze([]);
  let ready;
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
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
      if (errors.length) throw new AggregateError(errors, "Venus cleanup failed.");
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      featureControls = createVenusFeatureControls({
        stage, lifetime, onError,
        onShadowsVisibilityChange(visible) {
          mounted?.setShadowsEnabled(visible);
          orbitCamera?.refresh();
        },
      });
      lensControls = createVenusLensControls({ stage, lifetime, onError });
      await lifetime.wait(Promise.all([
        lensControls.prepare(PREPARED_VENUS_LENSES.defaultLens),
        decodeWarm(
          PREPARED_VENUS_SCENE.material.lightingUrl,
          PREPARED_VENUS_SCENE.material.lighting2xUrl,
        ),
        ...PREPARED_VENUS_SCENE.starfield.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodeWarm(url, url2x),
          decodeWarm(highContrastUrl, highContrastUrl2x),
        ]),
        decodeWarm(
          PREPARED_VENUS_SKY_SUN.asset.url,
          PREPARED_VENUS_SKY_SUN.asset.url2x,
        ),
      ]));
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage, PREPARED_VENUS_SCENE, lifetime);
      warmImages.clear();
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of sceneAnimations) {
        lifetime.onDispose(() => animation.cancel());
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      orbitCamera = createVenusOrbitControls({
        inputSurface,
        mounted,
        plan: PREPARED_VENUS_SCENE.camera,
        lifetime,
        onError,
      });
      orbitCamera.setState({ zoom: orbitCamera.initialResponsiveZoom() });
      lensControls.bindRuntime();
      featureControls.bindRuntime({ animations: sceneAnimations });

      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        const diagnostics = window.__venus = Object.freeze({
          ready: true,

          renderStats: Object.freeze({
            textureStats: Object.freeze({
              selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
              get retainedInteractiveImageCount() {
                return lensControls.retainedImageCount();
              },
            }),
          }),
          dom: mounted.domStats,
          camera: Object.freeze({
            state: orbitCamera.state,
            setState: orbitCamera.setState,
            stats: orbitCamera.stats,
          }),
          material: Object.freeze({ state: mounted.materialState }),
          features: Object.freeze({ state: featureControls.state }),
          options: Object.freeze({ state: featureControls.optionsState }),
          lenses: Object.freeze({
            state: lensControls.state,
            select: lensControls.select,
          }),
          stableNodes: mounted.stableNodes,
          assertStableDomIdentity: mounted.assertStableDomIdentity,
        });
        lifetime.onDispose(() => { if (window.__venus === diagnostics) delete window.__venus; });
      }
    } catch (error) {
      if (lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Venus startup failed.", { cause: error });
      throw error;
    }
  }

}

function mountPreparedScene(stage, plan, lifetime) {
  if (plan.schema !== "cssvenus-prepared-runtime-scene@1" ||
      plan.runtimeGeometry !== false || plan.runtimeRasterization !== false) {
    throw new TypeError("Venus retained scene plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  const camera = createPolyCamera(plan.camera.state);
  const scene = createPolyScene(stage, { camera });
  lifetime.onDispose(() => scene.destroy());
  lifetime.onDispose(() => {
    if (scene.cameraEl.parentNode === stage) delete stage.dataset.lens;
  });
  scene.cameraEl.classList.add("planet-render-root");
  const system = createMesh(
    "venus-system",
    `transform:rotateY(${-plan.body.axialTiltDegrees}deg)`,
  );
  const body = createMesh("venus-body", "");
  const fragment = document.createDocumentFragment();
  for (const leaf of plan.body.leaves) {
    fragment.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(fragment);
  system.appendChild(body);
  scene.sceneElement.appendChild(system);

  const materialComposite = document.createElement("div");
  lifetime.onDispose(() => materialComposite.remove());
  materialComposite.className = "venus-material-composite planet-render-root";
  materialComposite.ariaHidden = "true";
  materialComposite.style.setProperty("--venus-camera-zoom", String(camera.state.zoom));
  const material = document.createElement("s");
  material.className = "venus-fixed-material";
  material.style.backgroundSize = plan.material.backgroundSize;
  material.style.backgroundPosition =
    plan.material.backgroundPositions[plan.material.defaultFrame];
  materialComposite.appendChild(material);
  stage.appendChild(materialComposite);
  const cubicSky = mountRetainedCubicSky({
    host: stage,
    plan: plan.starfield,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "venus",
    requireSun: false,
  });
  lifetime.onDispose(() => cubicSky.destroy());
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_VENUS_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "venus",
    before: scene.cameraEl,
  });
  lifetime.onDispose(() => skySun.destroy());
  const skybox = cubicSky.root;
  const skyboxCube = cubicSky.cube;
  const layerRegistration = registerBodyDependentLayers({
    objectId: "venus",
    sceneElement: scene.sceneElement,
    bodySystem: system,
    lightingOverlays: [material],
  });
  let materialFrame = plan.material.defaultFrame;
  let materialLightRollDegrees = 0;
  let skySunViewDirection = PREPARED_VENUS_SKY_SUN.referenceViewDirection;
  let sunViewDirection = viewSunDirectionToPreparedLightDirection(
    skySunViewDirection,
  );
  let shadowsEnabled = false;

  const stableNodes = Object.freeze([...stage.querySelectorAll("*")]);
  const stableParents = stableNodes.map((node) => node.parentNode);
  const domStats = Object.freeze({
    mode: "prepared-retained-texture-leaves-with-fixed-material-and-sky-cube",
    retainedInitialNodeCount: stableNodes.length,
    retainedCameraRootCount: 1,
    retainedMaterialCompositeRootCount: 1,
    retainedCameraMaterialCount: 0,
    retainedSkyboxRootCount: 1,
    retainedSkyboxFaceCount:
      cubicSky.faceCount,
    retainedSunBillboardCount: 1,
    retainedSunLayerCount: 1,
    retainedSunCubemapBakeCount: 0,
    retainedSceneRootCount: 1,
    retainedLeafCount: stage.querySelectorAll(".polycss-scene s").length,
    runtimeDomGrowth: false,
  });
  return Object.freeze({
    camera,
    scene,
    system,
    body,
    materialComposite,
    material,
    skybox,
    skyboxCube,
    skySun,
    stableNodes,
    domStats,
    setMaterialFrame(frame) {
      if (frame === materialFrame) return false;
      const position = plan.material.backgroundPositions[frame];
      if (typeof position !== "string") {
        throw new RangeError(`Venus prepared material frame is invalid: ${frame}.`);
      }
      material.style.backgroundPosition = position;
      materialFrame = frame;
      return true;
    },
    setMaterialDirection(direction) {
      if (!shadowsEnabled) {
        const frameChanged = this.setMaterialFrame(plan.material.frameCount - 1);
        material.style.setProperty("--venus-light-roll", "0deg");
        materialLightRollDegrees = 0;
        return frameChanged;
      }
      const frameChanged = this.setMaterialFrame(
        preparedMaterialFrame(
          presentationLightViewZ(direction[2], plan.material),
          plan.material,
        ),
      );
      const projectedLength = Math.hypot(direction[0], direction[1]);
      if (projectedLength < 1e-9) return frameChanged;
      const nextRoll = normalizeDegrees(
        Math.atan2(direction[1], direction[0]) * 180 / Math.PI -
          plan.material.baseLightAzimuthDegrees,
      );
      if (Math.abs(nextRoll - materialLightRollDegrees) < 1e-9) {
        return frameChanged;
      }
      material.style.setProperty("--venus-light-roll", `${nextRoll}deg`);
      materialLightRollDegrees = nextRoll;
      return true;
    },
    setShadowsEnabled(visible) {
      shadowsEnabled = Boolean(visible);
      return true;
    },
    materialState() {
      return Object.freeze({
        frame: materialFrame,
        lightRollDegrees: materialLightRollDegrees,
        sunViewDirection,
        shadowsEnabled,
      });
    },
    setSkyboxOrientation(orientation, zoom) {
      cubicSky.setOrientation({
        matrix: orientation.matrix,
        zoom,
        defaultZoom: plan.camera.defaultZoom,
      });
      skySunViewDirection = orientation.sunViewDirection;
      skySun.setViewDirection(skySunViewDirection);
      sunViewDirection = viewSunDirectionToPreparedLightDirection(
        skySunViewDirection,
      );
      return sunViewDirection;
    },
    assertStableDomIdentity() {
      for (let index = 0; index < stableNodes.length; index += 1) {
        if (!stableNodes[index].isConnected ||
            stableNodes[index].parentNode !== stableParents[index]) {
          throw new Error(`Venus retained DOM identity changed at node ${index}.`);
        }
      }
      layerRegistration.assertRegistered();
      return true;
    },
    destroy() {
      scene.destroy();
      skySun.destroy();
      cubicSky.destroy();
    },
  });
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  mesh.style.cssText = style;
  return mesh;
}

function createVenusOrbitControls({ inputSurface, mounted, plan, lifetime, onError }) {
  const referenceMinimumPitch = plan.minimumControlPitchDegrees;
  const referenceMaximumPitch = plan.maximumControlPitchDegrees;
  const minimumZoom = plan.minimumZoom;
  const maximumZoom = plan.maximumZoom;
  const controlCamera = createPolyCamera({
    ...plan.state,
    rotX: plan.defaultControlPitchDegrees,
  });
  const orientation = createCubicSkyCameraOrientation({
    controlPitch: controlCamera.state.rotX,
    controlYaw: controlCamera.state.rotY,
    cameraPlan: plan,
    skyPlan: PREPARED_VENUS_SCENE.starfield,
    requireSun: false,
    sunDirection: PREPARED_VENUS_SKY_SUN.localDirection,
    sunReferenceViewDirection: PREPARED_VENUS_SKY_SUN.referenceViewDirection,
  });
  const safeCamera = Object.freeze({
    get state() {
      return controlCamera.state;
    },
    update(partial) {
      controlCamera.update({
        ...partial,
        ...(partial.zoom === undefined ? {} : {
          zoom: clamp(partial.zoom, minimumZoom, maximumZoom),
        }),
        ...(partial.rotY === undefined ? {} : { rotY: partial.rotY }),
      });
    },
  });
  const sceneScale = plan.defaultZoom / BASE_TILE;
  const publishCamera = createPreparedCameraPublisher({
    cameraElement: mounted.scene.cameraEl,
    sceneElement: mounted.scene.sceneElement,
    objectId: "venus",
    defaultZoom: plan.defaultZoom,
    sceneScale,
  });
  const controlScene = Object.freeze({
    host: inputSurface,
    cameraEl: mounted.scene.cameraEl,
    sceneElement: mounted.scene.sceneElement,
    camera: safeCamera,
    applyCamera() {
      // Keep PolyCSS camera state available to object diagnostics; the shared
      // publisher owns the retained DOM transform and zoom.
      mounted.camera.update({
        rotX: preparedScenePitch(safeCamera.state.rotX, plan),
        rotY: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      });
      publishCamera({ sceneMatrix: orientation.scene(), zoom: safeCamera.state.zoom });
      mounted.scene.cameraEl.dataset.polycssCameraRotX = String(mounted.camera.state.rotX);
      mounted.scene.cameraEl.dataset.polycssCameraRotY = String(mounted.camera.state.rotY);
      mounted.scene.cameraEl.dataset.polycssCameraZoom = String(safeCamera.state.zoom);
      mounted.scene.cameraEl.dataset.venusCameraMatrix = orientation.scene();
      mounted.materialComposite.style.setProperty(
        "--venus-camera-zoom",
        String(safeCamera.state.zoom),
      );
      const skyboxOrientation = orientation.skybox();
      const materialSunViewDirection = mounted.setSkyboxOrientation(
        skyboxOrientation,
        safeCamera.state.zoom,
      );
      mounted.setMaterialDirection(materialSunViewDirection);
    },
  });
  const mediaQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
  const wheelControls = createPolyOrbitControls({
    ...controlScene,
    applyCamera: () => handleRuntimeEvent(() => controlScene.applyCamera()),
  }, {
    drag: false,
    wheel: !mediaQuery.matches,
    minZoom: minimumZoom,
    maxZoom: maximumZoom,
  });
  lifetime.onDispose(() => wheelControls.destroy());
  const dragControls = createUnboundedMatrixDragControls({
    onError,
    inputSurface,
    trackballMetrics: () => measureRetainedPlanetTrackball({
      stage: mounted.scene.cameraEl.closest(".planet-stage"),
      cameraElement: mounted.scene.cameraEl,
      logicalBodyDiameter: plan.logicalBodyDiameter,
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: safeCamera.state.zoom,
      minimumZoom,
      maximumZoom,
    }),
    rotate({ controlPitchDelta, controlYawDelta, zoom }) {
      handleRuntimeEvent(() => {
        const previousPitch = safeCamera.state.rotX;
        safeCamera.update({
          rotX: previousPitch + controlPitchDelta,
          rotY: safeCamera.state.rotY + controlYawDelta,
          ...(zoom === undefined ? {} : { zoom }),
        });
        orientation.rotate({
          renderedPitchDelta: preparedScenePitch(safeCamera.state.rotX, plan) -
            preparedScenePitch(previousPitch, plan),
          yawDelta: controlYawDelta,
        });
        controlScene.applyCamera();
      });
    },
  });
  lifetime.onDispose(() => dragControls.destroy());
  const controls = Object.freeze({
    update(options) {
      wheelControls.update(options);
      dragControls.update(options);
    },
    destroy() {
      dragControls.destroy();
      wheelControls.destroy();
    },
  });
  const inputPolicy = bindResponsiveOrbitPolicy({
    onError,
    controls,
    inputSurface,
    mediaQuery,
  });
  lifetime.onDispose(() => inputPolicy.destroy());
  const windowTarget = inputSurface.ownerDocument.defaultView;
  let responsiveFit = selectPreparedResponsiveZoom({
    stage: mounted.scene.cameraEl.closest(".planet-stage"),
    cameraElement: mounted.scene.cameraEl,
    plan,
    mobile: mediaQuery.matches,
    mobilePreviewElement:
      inputSurface.ownerDocument.querySelector(".planet-sidebar"),
  });
  safeCamera.update({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
  const handleViewportResize = () => {
    handleRuntimeEvent(() => {
      responsiveFit = selectPreparedResponsiveZoom({
        stage: mounted.scene.cameraEl.closest(".planet-stage"),
        cameraElement: mounted.scene.cameraEl,
        plan,
        mobile: mediaQuery.matches,
        mobilePreviewElement:
          inputSurface.ownerDocument.querySelector(".planet-sidebar"),
      });
      controlScene.applyCamera();
    });
  };
  lifetime.onDispose(() => windowTarget?.removeEventListener("resize", handleViewportResize));
  windowTarget?.addEventListener("resize", handleViewportResize, {
    passive: true,
  });
  return Object.freeze({
    initialResponsiveZoom() {
      return initialResponsiveZoom;
    },
    refresh() {
      controlScene.applyCamera();
    },
    setState({ controlPitch, controlYaw, zoom } = {}) {
      dragControls.stop();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      safeCamera.update({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(zoom === undefined ? {} : { zoom }),
      });
      if (resetsOrientation) {
        orientation.reset({
          controlPitch: safeCamera.state.rotX,
          controlYaw: safeCamera.state.rotY,
        });
      }
      controlScene.applyCamera();
      return this.state();
    },
    state() {
      return Object.freeze({
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      });
    },
    stats() {
      return Object.freeze({
        minimumPitchDegrees: referenceMinimumPitch,
        maximumPitchDegrees: referenceMaximumPitch,
        defaultControlPitchDegrees: plan.defaultControlPitchDegrees,
        defaultControlYawDegrees: plan.defaultControlYawDegrees,
        pitchBounded: plan.pitchBounded,
        yawBounded: plan.yawBounded,
        cameraModel: plan.cameraModel,
        responsiveFitModel: responsiveFit.model,
        responsiveWidthShare: responsiveFit.widthShare,
        responsiveBaseZoom: responsiveFit.zoom,
        dragInertia: dragControls.stats(),
      });
    },
    destroy() {
      windowTarget?.removeEventListener("resize", handleViewportResize);
      inputPolicy.destroy();
      controls.destroy();
    },
  });

  function handleRuntimeEvent(callback) {
    if (lifetime.disposed) return;
    try { callback(); } catch (error) { onError(error); }
  }
}

function preparedMaterialFrame(lightViewZ, material) {
  const amount = clamp(
    (lightViewZ - material.minimumLightViewZ) /
      (material.maximumLightViewZ - material.minimumLightViewZ),
    0,
    1,
  );
  return Math.round(amount * (material.directionalFrameCount - 1));
}

function presentationLightViewZ(lightViewZ, material) {
  const remap = material.lightingModel.presentationPhaseRemap;
  const [lowerStart, lowerEnd] = remap.lowerTransition;
  const [plateauStart, plateauEnd] = remap.plateau;
  const [upperStart, upperEnd] = remap.upperTransition;
  if (lightViewZ <= lowerStart || lightViewZ >= upperEnd) return lightViewZ;
  if (lightViewZ < lowerEnd) {
    const amount = (lightViewZ - lowerStart) / (lowerEnd - lowerStart);
    return lightViewZ * (1 - amount) + remap.plateauViewZ * amount;
  }
  if (lightViewZ <= plateauEnd && lightViewZ >= plateauStart) {
    return remap.plateauViewZ;
  }
  const amount = (lightViewZ - upperStart) / (upperEnd - upperStart);
  return remap.plateauViewZ * (1 - amount) + lightViewZ * amount;
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}

function createVenusLensControls({ stage, lifetime, onError }) {
  if (PREPARED_VENUS_LENSES.schema !== "cssvenus-prepared-lenses@1") {
    throw new TypeError("Venus lens plan is incompatible.");
  }
  const root = document.querySelector(".planet-lenses");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Venus lens selector is missing.");
  }
  const controlsById = new Map(PREPARED_VENUS_LENSES.controls.map(
    (lens) => [lens.id, lens],
  ));
  const buttons = new Map([...root.querySelectorAll('button[name="lens"]')].map(
    (button) => [button.value, button],
  ));
  if (buttons.size !== controlsById.size || controlsById.size !== PREPARED_VENUS_LENSES.controls.length ||
      buttons.size !== root.querySelectorAll('button[name="lens"]').length ||
      [...buttons.keys()].some((id) => !controlsById.has(id))) {
    throw new Error("Venus lens selector does not match prepared lenses.");
  }
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  const cache = new Map();
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let activeId = PREPARED_VENUS_LENSES.defaultLens;
  let activeReady = false;
  let desiredId = activeId;
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => void select(id).catch((error) => {
      console.error(error);
    }), { signal: events.signal });
  }
  const selection = createLatestSelection({
    lifetime, onFatalError: onError,
    onBusyChange(busy) { root.classList.toggle("is-loading", busy); },
  });
  lifetime.onDispose(() => {
    activeReady = false;
    root.classList.remove("is-loading");
    for (const button of buttons.values()) button.disabled = true;
  });
  lifetime.onDispose(() => {
    const errors = [];
    for (const [id, entry] of cache) {
      try { releaseLensDecode(id, entry); } catch (error) { errors.push(error); }
    }
    cache.clear();
    if (errors.length) throw new AggregateError(errors, "Lens cleanup failed.");
  });
  return Object.freeze({
    prepare,
    select,
    bindRuntime() {
      if (lifetime.disposed) return;
      activeReady = true;
      publish(activeId);
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = false;
    },
    state() {
      return Object.freeze({ id: activeId, ready: activeReady });
    },
    retainedImageCount() {
      return [...cache.values()].reduce((count, entry) =>
        count + (entry.images?.length ?? 0), 0);
    },

  });

  async function select(id) {
    if (!controlsById.has(id)) throw new RangeError(`Unknown Venus lens: ${id}.`);
    if (lifetime.disposed || !activeReady) return false;
    desiredId = id;
    return selection.run({
      prepare: () => prepare(id),
      commit() {
        publish(id);
        activeId = id;
        releaseInactiveLensImages(id);
      },
      onCurrentFailure() { desiredId = activeId; },
      discard() {
        const entry = cache.get(id);
        if (entry && id !== activeId && id !== desiredId) releaseLensDecode(id, entry);
      },
    });
  }

  function prepare(id) {
    if (lifetime.disposed) return Promise.resolve(null);
    const lens = controlsById.get(id);
    if (!lens) throw new RangeError(`Unknown Venus lens: ${id}.`);
    const existing = cache.get(id);
    if (existing) return existing.promise;
    const urls = [lens.surface2xUrl || lens.surfaceUrl, lens.poles2xUrl || lens.polesUrl, lens.material2xUrl || lens.materialUrl];
    const entry = { images: urls.map(() => Object.assign(new Image(), { decoding: "async" })), promise: null, released: false };
    cache.set(id, entry);
    entry.promise = Promise.all(entry.images.map((image, index) =>
      decodePreparedImage(image, urls[index]))).then((images) =>
      entry.released ? null : images, (error) => {
        if (entry.released) return null;
        releaseLensDecode(id, entry);
        throw error;
      });
    return entry.promise;
  }

  function releaseInactiveLensImages(selectedId) {
    for (const [id, entry] of cache) {
      if (id === selectedId) continue;
      releaseLensDecode(id, entry);
    }
  }

  function releaseLensDecode(id, entry) {
    if (entry.released) return;
    entry.released = true;
    if (cache.get(id) === entry) cache.delete(id);
    const images = entry.images;
    entry.images = [];
    releaseImageGroup(images);
  }

  function publish(id) {
    stage.dataset.lens = id;
    delete stage.dataset.view;
    for (const button of buttons.values()) {
      button.setAttribute("aria-pressed", button.value === id ? "true" : "false");
    }
  }
}

function decodeImage(url, url2x, owner) {
  const image = Object.assign(new Image(), { decoding: "async" });
  owner.add(image);
  return decodePreparedImage(image, url2x || url);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
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
