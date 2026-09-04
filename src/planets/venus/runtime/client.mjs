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

export function mountVenusClient(stage) {
  const inputSurface = document.querySelector(".venus-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Venus input surface is missing.");
  }
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let orbitCamera = null;
  let featureControls = null;
  let lensControls = null;
  let sceneAnimations = Object.freeze([]);
  let resourcesReleased = false;
  let ready;
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
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
      if (DEVELOPMENT_DIAGNOSTICS && window.__venus) delete window.__venus;
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      featureControls = createVenusFeatureControls({
        stage,
        onShadowsVisibilityChange(visible) {
          mounted?.setShadowsEnabled(visible);
          orbitCamera?.refresh();
        },
      });
      lensControls = createVenusLensControls({ stage });
      await Promise.all([
        lensControls.prepare(PREPARED_VENUS_LENSES.defaultLens),
        decodeImage(
          PREPARED_VENUS_SCENE.material.lightingUrl,
          PREPARED_VENUS_SCENE.material.lighting2xUrl,
        ),
        ...PREPARED_VENUS_SCENE.starfield.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodeImage(url, url2x),
          decodeImage(highContrastUrl, highContrastUrl2x),
        ]),
        decodeImage(
          PREPARED_VENUS_SKY_SUN.asset.url,
          PREPARED_VENUS_SKY_SUN.asset.url2x,
        ),
      ]);
      if (destroyed) return;
      mounted = mountPreparedScene(stage, PREPARED_VENUS_SCENE);
      sceneAnimations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of sceneAnimations) {
        animation.currentTime = 0;
        if (shouldPlay) animation.play();
        else animation.pause();
      }
      orbitCamera = createVenusOrbitControls({
        inputSurface,
        mounted,
        plan: PREPARED_VENUS_SCENE.camera,
      });
      orbitCamera.setState({ zoom: orbitCamera.initialResponsiveZoom() });
      lensControls.bindRuntime();
      featureControls.bindRuntime({ animations: sceneAnimations });
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await waitForPaint();
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        window.__venus = Object.freeze({
          ready: true,
          pause: controller.pause,
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
    orbitCamera?.destroy();
    orbitCamera = null;
    lensControls?.destroy();
    lensControls = null;
    featureControls?.destroy();
    featureControls = null;
    mounted?.destroy();
    mounted = null;
    sceneAnimations = Object.freeze([]);
    stage.replaceChildren();
    stage.classList.remove("venus-hide-atmosphere", "venus-hide-stars");
    delete stage.dataset.lens;
    delete stage.dataset.view;
  }
}

function mountPreparedScene(stage, plan) {
  if (plan.schema !== "cssvenus-prepared-runtime-scene@1" ||
      plan.runtimeGeometry !== false || plan.runtimeRasterization !== false) {
    throw new TypeError("Venus retained scene plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  const camera = createPolyCamera(plan.camera.state);
  const scene = createPolyScene(stage, { camera });
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
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_VENUS_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "venus",
    before: scene.cameraEl,
  });
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

function createVenusOrbitControls({ inputSurface, mounted, plan }) {
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
  const controlScene = Object.freeze({
    host: inputSurface,
    cameraEl: mounted.scene.cameraEl,
    sceneElement: mounted.scene.sceneElement,
    camera: safeCamera,
    applyCamera() {
      mounted.camera.update({
        rotX: preparedScenePitch(safeCamera.state.rotX, plan),
        rotY: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      });
      mounted.scene.applyCamera();
      mounted.scene.sceneElement.style.transform =
        `scale(${safeCamera.state.zoom / BASE_TILE}) ${orientation.scene()}`;
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
  const wheelControls = createPolyOrbitControls(controlScene, {
    drag: false,
    wheel: !mediaQuery.matches,
    minZoom: minimumZoom,
    maxZoom: maximumZoom,
  });
  const dragControls = createUnboundedMatrixDragControls({
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
    },
  });
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
    controls,
    inputSurface,
    mediaQuery,
  });
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
    responsiveFit = selectPreparedResponsiveZoom({
      stage: mounted.scene.cameraEl.closest(".planet-stage"),
      cameraElement: mounted.scene.cameraEl,
      plan,
      mobile: mediaQuery.matches,
      mobilePreviewElement:
        inputSurface.ownerDocument.querySelector(".planet-sidebar"),
    });
    controlScene.applyCamera();
  };
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

function createVenusLensControls({ stage }) {
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
  if (buttons.size !== controlsById.size) {
    throw new Error("Venus lens selector does not match prepared lenses.");
  }
  root.classList.add("is-loading");
  for (const button of buttons.values()) button.disabled = true;
  const cache = new Map();
  const events = new AbortController();
  let activeId = PREPARED_VENUS_LENSES.defaultLens;
  let activeReady = false;
  let request = 0;
  let destroyed = false;
  for (const [id, button] of buttons) {
    button.addEventListener("click", () => void select(id).catch((error) => {
      console.error(error);
    }), { signal: events.signal });
  }
  return Object.freeze({
    prepare,
    select,
    bindRuntime() {
      if (destroyed) return;
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
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeReady = false;
      request += 1;
      events.abort();
      root.classList.remove("is-loading");
      for (const button of buttons.values()) button.disabled = true;
      for (const [id, entry] of cache) releaseLensDecode(id, entry);
      cache.clear();
      delete stage.dataset.lens;
      delete stage.dataset.view;
    },
  });

  async function select(id) {
    if (!controlsById.has(id)) {
      throw new RangeError(`Unknown Venus lens: ${id}.`);
    }
    if (!activeReady || destroyed) return false;
    const selectionRequest = ++request;
    root.classList.add("is-loading");
    for (const [cachedId, entry] of cache) {
      if (cachedId !== id && cachedId !== activeId) entry.wanted = false;
    }
    try {
      await prepare(id);
      if (destroyed || selectionRequest !== request) return false;
      activeId = id;
      publish(id);
      releaseInactiveLensImages(id);
      return true;
    } finally {
      if (selectionRequest === request) root.classList.remove("is-loading");
    }
  }

  function prepare(id) {
    const lens = controlsById.get(id);
    if (!lens) throw new RangeError(`Unknown Venus lens: ${id}.`);
    const existing = cache.get(id);
    if (existing) {
      existing.wanted = true;
      return existing.promise;
    }
    const entry = { images: null, promise: null, released: false, wanted: true };
    entry.promise = Promise.all([
      decodeImage(lens.surfaceUrl, lens.surface2xUrl),
      decodeImage(lens.polesUrl, lens.poles2xUrl),
      decodeImage(lens.materialUrl, lens.material2xUrl),
    ]).then((images) => {
      entry.images = images;
      if (!entry.wanted || destroyed) releaseLensDecode(id, entry);
      return images;
    }).catch((error) => {
      if (cache.get(id) === entry) cache.delete(id);
      throw error;
    });
    cache.set(id, entry);
    return entry.promise;
  }

  function releaseInactiveLensImages(selectedId) {
    for (const [id, entry] of cache) {
      if (id === selectedId) continue;
      releaseLensDecode(id, entry);
    }
  }

  function releaseLensDecode(id, entry) {
    entry.wanted = false;
    if (!entry.images || entry.released) return;
    entry.released = true;
    entry.images.forEach(releaseDecodedImage);
    entry.images = null;
    entry.promise = null;
    if (cache.get(id) === entry) cache.delete(id);
  }

  function publish(id) {
    stage.dataset.lens = id;
    delete stage.dataset.view;
    for (const button of buttons.values()) {
      button.setAttribute("aria-pressed", button.value === id ? "true" : "false");
    }
  }
}

function releaseDecodedImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  image.removeAttribute("src");
}

async function decodeImage(url, url2x) {
  const selected = url2x || url;
  const image = new Image();
  image.decoding = "async";
  image.src = selected;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(`Prepared Venus image did not decode: ${selected}.`);
  }
  return image;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
