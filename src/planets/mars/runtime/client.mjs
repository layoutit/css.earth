import { PREPARED_MARS_SCENE } from "./preparedScene.mjs";
import { createPreparedProjectiveTextureLeaf } from
  "../../../platform/prepared-projective-texture-leaf.mjs";
import { PREPARED_MARS_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_MARS_LENSES } from "./preparedLenses.mjs";
import { PREPARED_MARS_SKY_SUN } from "./preparedSkySun.mjs";
import { createRowShardCache } from "./preparedRowCache.mjs";
import { PLANET_SPEED_STATES } from "../../../platform/planet-feature-controls.mjs";
import {
  createPolyCamera,
  createPolyOrbitControls,
} from "@layoutit/polycss";
import {
  createCubicSkyCameraOrientation,
  createUnboundedMatrixDragControls,
  measureRetainedPlanetFlyToDisc,
  measureRetainedPlanetTrackball,
  mountRetainedCubicSky,
  preparedScenePitch,
  selectPreparedResponsiveZoom,
} from "../../../platform/cubic-sky-runtime.mjs";
import { googleEarthDirectAngularDegreesPerTrackballRadius } from
  "../../../platform/google-earth-drag-inertia.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { mountRetainedDirectionalSun } from
  "../../../platform/directional-sun-runtime.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import { registerBodyDependentLayers } from
  "../../../platform/body-layer-registration.mjs";
import {
  bindResponsiveOrbitPolicy,
  CANONICAL_PREPARED_IMAGE_DENSITY,
  MOBILE_VIEWPORT_QUERY,
} from "../../../../site/runtime-policy.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountMarsClient(stage) {
  if (!(stage instanceof HTMLElement)) {
    throw new TypeError("Mars stage must be an HTML element.");
  }
  let destroyed = false;
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
  let shouldPlay = true;
  let animations = Object.freeze([]);
  let mounted = null;
  let orbit = null;
  let panelControls = null;
  let activeLens = PREPARED_MARS_LENSES.defaultLens;
  let lensRequest = 0;
  let resourcesReleased = false;
  const lensDecodePromises = new Map();
  let playbackRate = 1;
  let shadowsEnabled = false;
  const materialCache = createRowShardCache(materialBank);
  let ready = null;
  stage.classList.add("mars-stage");
  const controller = Object.freeze({
    get ready() {
      return ready;
    },
    pause() {
      if (destroyed) return;
      shouldPlay = false;
      document.documentElement.dataset.playing = "false";
      for (const animation of animations) animation.pause();
    },
    resume() {
      if (destroyed) return;
      shouldPlay = true;
      if (!mounted) return;
      document.documentElement.dataset.playing = "true";
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
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      lensRequest += 1;
      releaseScene();
    },
  });
  ready = start();
  return controller;

  async function start() {
    try {
      await Promise.all([
        Promise.all(assets.map(decodeImage)),
        materialCache.prepareInitial(),
      ]);
      if (destroyed) return;
      mounted = mountPreparedBody(stage, PREPARED_MARS_SCENE);
      orbit = createMarsOrbit(
        stage,
        mounted,
        materialCache,
        () => shadowsEnabled,
      );
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        animation.currentTime = 0;
        animation.playbackRate = playbackRate;
        if (!shouldPlay) animation.pause();
      }
      panelControls = createMarsPanelControls({
        stage,
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
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      await new Promise((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(resolve)));
      if (destroyed) return;
      if (DEVELOPMENT_DIAGNOSTICS) {
        window.__mars = Object.freeze({
          ready: true,
          setView: controller.setView,
          view: controller.view,
          selectLens: controller.selectLens,
          lens: controller.lens,
          pause: controller.pause,
          resume: controller.resume,
          destroy: controller.destroy,
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
      }
    } catch (error) {
      if (destroyed) return;
      releaseScene();
      throw error;
    }
  }

  async function selectLens(id) {
    const lens = PREPARED_MARS_LENSES.controls.find((entry) => entry.id === id);
    if (!lens) throw new RangeError(`Unknown Mars lens: ${id}.`);
    if (destroyed || !mounted) return lensState();
    const request = ++lensRequest;
    let decoding = Promise.resolve();
    if (lens.id !== PREPARED_MARS_LENSES.defaultLens) {
      decoding = lensDecodePromises.get(lens.id);
      if (!decoding) {
        decoding = decodeLens(lens).catch((error) => {
          lensDecodePromises.delete(lens.id);
          throw error;
        });
        lensDecodePromises.set(lens.id, decoding);
      }
    }
    await decoding;
    if (destroyed || request !== lensRequest) return lensState();
    if (lens.id === PREPARED_MARS_LENSES.defaultLens) {
      delete stage.dataset.lens;
    } else {
      stage.dataset.lens = lens.id;
    }
    activeLens = lens.id;
    panelControls?.publishLens(activeLens);
    return lensState();
  }

  function lensState() {
    return Object.freeze({
      id: activeLens,
      ready: mounted !== null && !destroyed,
    });
  }

  function releaseScene() {
    if (resourcesReleased) return;
    resourcesReleased = true;
    panelControls?.destroy();
    panelControls = null;
    orbit?.destroy();
    orbit = null;
    materialCache.destroy();
    lensDecodePromises.clear();
    mounted = null;
    animations = Object.freeze([]);
    delete stage.dataset.lens;
    stage.classList.remove("mars-stage");
    delete document.documentElement.dataset.playing;
    stage.replaceChildren();
    if (DEVELOPMENT_DIAGNOSTICS && window.__mars) delete window.__mars;
  }
}

function createMarsPanelControls({
  stage,
  selectLens,
  setShadows,
  setSpeed,
}) {
  const lensRoot = document.querySelector(
    ".planet-drawer-content .planet-lenses",
  );
  const settingsRoot = document.querySelector(
    ".planet-settings-panel .planet-settings",
  );
  const speedButton = settingsRoot?.querySelector('button[name="speed"]');
  const shadows = settingsRoot?.querySelector('input[name="shadows"]');
  if (!(lensRoot instanceof HTMLElement) ||
      !(settingsRoot instanceof HTMLElement) ||
      !(speedButton instanceof HTMLButtonElement) ||
      !(shadows instanceof HTMLInputElement)) {
    throw new Error("Mars panel controls are incomplete.");
  }
  const events = new AbortController();
  let destroyed = false;
  let controlRequest = 0;
  const lensButtons = [...(lensRoot?.querySelectorAll('button[name="lens"]') ?? [])];
  for (const button of lensButtons) {
    button.addEventListener("click", () => void applyLens(button), {
      signal: events.signal,
    });
  }
  const speedStates = PLANET_SPEED_STATES;
  speedButton.addEventListener("click", () => {
    const index = speedStates.findIndex(({ label }) =>
      label === speedButton.dataset.state);
    const next = speedStates[(index + 1) % speedStates.length];
    speedButton.dataset.state = next.label;
    speedButton.setAttribute("aria-label", `Speed: ${next.label}`);
    setSpeed(next.value);
  }, { signal: events.signal });
  shadows.addEventListener("change", () => setShadows(shadows.checked), {
    signal: events.signal,
  });
  setShadows(shadows.checked);
  return Object.freeze({
    publishLens,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controlRequest += 1;
      events.abort();
      lensRoot?.classList.remove("is-loading");
      for (const button of lensButtons) button.disabled = true;
    },
  });

  async function applyLens(button) {
    const request = ++controlRequest;
    lensRoot?.classList.add("is-loading");
    try {
      const state = await selectLens(button.value);
      if (!destroyed) publishLens(state.id);
    } catch (error) {
      console.error(error);
    } finally {
      if (!destroyed && request === controlRequest) {
        lensRoot?.classList.remove("is-loading");
      }
    }
  }

  function publishLens(id) {
    if (destroyed) return;
    for (const candidate of lensButtons) {
      candidate.setAttribute("aria-pressed", String(candidate.value === id));
    }
  }
}

function mountPreparedBody(stage, plan) {
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
  const skySun = mountRetainedDirectionalSun({
    host: stage,
    plan: PREPARED_MARS_SKY_SUN,
    imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
    objectId: "mars",
    before: camera,
  });
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

function createMarsOrbit(stage, mounted, materialCache, shadowsVisible) {
  const plan = PREPARED_MARS_CAMERA;
  const lighting = PREPARED_MARS_LIGHTING;
  if (plan.schema !== "cssmars-prepared-camera@2" ||
      lighting.schema !== "cssmars-prepared-lighting@5" ||
      plan.cameraModel !== "accumulated-matrix3d" ||
      plan.horizontalOrbit !== true || plan.pitchBounded !== false ||
      plan.yawBounded !== false || !Number.isFinite(plan.sceneScale) ||
      typeof shadowsVisible !== "function") {
    throw new TypeError("Mars shared cubic-sky camera contract drifted.");
  }
  const camera = createPolyCamera(plan.state);
  const orientation = createCubicSkyCameraOrientation({
    controlPitch: camera.state.rotX,
    controlYaw: camera.state.rotY,
    cameraPlan: plan,
    skyPlan: PREPARED_MARS_SCENE.starfield,
    requireSun: false,
    sunDirection: PREPARED_MARS_SKY_SUN.localDirection,
    sunReferenceViewDirection:
      PREPARED_MARS_SKY_SUN.referenceViewDirection,
  });
  const safeCamera = Object.freeze({
    get state() {
      return camera.state;
    },
    update(partial) {
      camera.update({
        ...partial,
        ...(partial.zoom === undefined ? {} : {
          zoom: clamp(partial.zoom, plan.minimumZoom, plan.maximumZoom),
        }),
      });
    },
  });
  let interactionStarts = 0;
  let interactionEnds = 0;
  let publications = 0;
  let destroyedOrbit = false;
  let sunViewDirection = PREPARED_MARS_SKY_SUN.localDirection;
  let materialFrame = lighting.defaultFrame;
  let materialLightRollDegrees = 0;
  let lastMaterialPresentation = "";
  let responsiveFit = null;

  const publish = () => {
    if (destroyedOrbit) return;
    mounted.scene.style.transform =
      `scale(${plan.sceneScale}) ${orientation.scene()}`;
    const skyboxOrientation = orientation.skybox();
    mounted.cubicSky.setOrientation({
      matrix: skyboxOrientation.matrix,
      zoom: safeCamera.state.zoom,
      defaultZoom: plan.defaultZoom,
    });
    sunViewDirection = skyboxOrientation.sunViewDirection;
    mounted.skySun.setViewDirection(sunViewDirection);
    mounted.materialCounter.style.transform = orientation.counterRotation();
    const zoomScale = safeCamera.state.zoom / plan.defaultZoom;
    mounted.camera.style.scale =
      "calc(var(--mars-shell-scale) / (" +
      `var(--planet-viewport-zoom-divisor) / ${zoomScale}))`;
    publishMaterialDirection(skyboxOrientation.sunViewDirection);
    publications += 1;
  };
  const schedule = () => requestAnimationFrame(publish);
  materialCache.onReady(schedule);
  const scene = Object.freeze({
    host: stage,
    cameraEl: mounted.camera,
    sceneElement: mounted.scene,
    camera: safeCamera,
    applyCamera: publish,
  });
  const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
  const wheelControls = createPolyOrbitControls(scene, {
    drag: false,
    wheel: !mobileQuery.matches,
    minZoom: plan.minimumZoom,
    maxZoom: plan.maximumZoom,
  });
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface: stage,
    trackballMetrics: () => Object.freeze({
      ...measureRetainedPlanetTrackball({
        stage,
        cameraElement: mounted.camera,
        logicalBodyDiameter: plan.logicalBodyDiameter,
      }),
      angularDegreesPerTrackballRadius:
        googleEarthDirectAngularDegreesPerTrackballRadius(
          safeCamera.state.zoom,
        ),
    }),
    flyToTrackballMetrics: () => measureRetainedPlanetFlyToDisc({
      stage,
      cameraElement: mounted.camera,
      logicalBodyDiameter: plan.logicalBodyDiameter,
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: safeCamera.state.zoom,
      minimumZoom: plan.minimumZoom,
      maximumZoom: plan.maximumZoom,
    }),
    onStart() {
      interactionStarts += 1;
    },
    onEnd() {
      interactionEnds += 1;
    },
    rotate({ controlPitchDelta, controlYawDelta, zoom }) {
      const previousPitch = safeCamera.state.rotX;
      safeCamera.update({
        rotX: previousPitch + controlPitchDelta,
        rotY: safeCamera.state.rotY + controlYawDelta,
        ...(zoom === undefined ? {} : { zoom }),
      });
      orientation.rotate({
        renderedPitchDelta:
          preparedScenePitch(safeCamera.state.rotX, plan) -
            preparedScenePitch(previousPitch, plan),
        yawDelta: controlYawDelta,
      });
      publish();
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
    inputSurface: stage,
    mediaQuery: mobileQuery,
  });
  const windowTarget = stage.ownerDocument.defaultView;
  responsiveFit = selectPreparedResponsiveZoom({
    stage,
    cameraElement: mounted.camera,
    plan,
    mobile: inputPolicy.mobile,
    mobilePreviewElement:
      stage.ownerDocument.querySelector(".planet-sidebar"),
  });
  safeCamera.update({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
  const handleViewportResize = () => {
    responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement: mounted.camera,
      plan,
      mobile: inputPolicy.mobile,
      mobilePreviewElement:
        stage.ownerDocument.querySelector(".planet-sidebar"),
    });
    publish();
  };
  windowTarget?.addEventListener("resize", handleViewportResize, {
    passive: true,
  });
  publish();

  return Object.freeze({
    initialResponsiveZoom() {
      return initialResponsiveZoom;
    },
    refresh() {
      publish();
    },
    setState({
      pitch,
      controlPitch = pitch,
      controlYaw,
      zoom,
    } = {}) {
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
      publish();
      return this.state();
    },
    state() {
      return Object.freeze({
        pitch: safeCamera.state.rotX,
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
      });
    },
    skyState() {
      const sunPresentation = mounted.skySun.state();
      return Object.freeze({
        sunViewDirection: Object.freeze([...sunViewDirection]),
        sunVisible: sunPresentation.visible,
        sunPresentation,
        shadowsEnabled: shadowsVisible(),
        materialMode: shadowsVisible()
          ? "directional-terminator-and-atmosphere"
          : "full-phase-atmosphere",
        materialFrame,
        materialLightRollDegrees,
      });
    },
    stats() {
      return Object.freeze({
        minimumPitchDegrees: plan.minimumControlPitchDegrees,
        maximumPitchDegrees: plan.maximumControlPitchDegrees,
        defaultControlPitchDegrees: plan.defaultControlPitchDegrees,
        defaultControlYawDegrees: plan.defaultControlYawDegrees,
        pitchBounded: plan.pitchBounded,
        yawBounded: plan.yawBounded,
        cameraModel: plan.cameraModel,
        responsiveFitModel: responsiveFit.model,
        responsiveWidthShare: responsiveFit.widthShare,
        responsiveBaseZoom: responsiveFit.zoom,
        interactionStarts,
        interactionEnds,
        publications,
        dragInertia: dragControls.stats(),
      });
    },
    destroy() {
      if (destroyedOrbit) return;
      destroyedOrbit = true;
      windowTarget?.removeEventListener("resize", handleViewportResize);
      materialCache.onReady(null);
      inputPolicy.destroy();
      controls.destroy();
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

function decodeImage(source) {
  const image = new Image();
  image.decoding = "sync";
  image.src = source;
  return image.decode();
}

function decodeLens(lens) {
  return Promise.all([
    decodeImage(lens.surface2xUrl || lens.surfaceUrl),
    decodeImage(lens.poles2xUrl || lens.polesUrl),
  ]);
}
