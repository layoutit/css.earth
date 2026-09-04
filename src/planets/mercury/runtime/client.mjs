import { createPreparedCameraPublisher } from
  "../../../platform/prepared-camera-runtime.mjs";
import { createPolyCamera, createPolyOrbitControls } from "@layoutit/polycss";

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
import { bindSpeedControl } from "../../../platform/planet-feature-controls.mjs";
import { createSceneLifetime, waitForScenePaint } from "../../../platform/scene-lifetime.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { createMercuryRowShardCache } from "./preparedRowCache.mjs";
import { createMercuryLensImageGroups } from "./lens-image-groups.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "./preparedSkySun.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const lensOwners = new WeakMap();

export function mountMercuryClient(stage, { onError } = {}) {
  if (typeof onError !== "function") throw new TypeError("Mercury requires onError.");
  const lifetime = createSceneLifetime();
  const inputSurface = document.querySelector(".mercury-input-surface");
  if (!(inputSurface instanceof HTMLElement)) {
    throw new Error("Mercury input surface is missing.");
  }
  const materialBank = PREPARED_MERCURY_ASSETS.lighting.banks[
    String(CANONICAL_PREPARED_IMAGE_DENSITY)
  ];
  if (materialBank?.schema !== "cssmercury-prepared-lighting-bank@1") {
    throw new Error(
      `Mercury has no prepared DPR ${CANONICAL_PREPARED_IMAGE_DENSITY} ` +
        "lighting bank.",
    );
  }
  const shadowlessPresentation = materialBank.presentations.at(-1);
  if (shadowlessPresentation?.frameIndex !==
      PREPARED_MERCURY_ASSETS.lighting.frameCount - 1) {
    throw new Error("Mercury has no prepared full-phase curvature frame.");
  }
  const materialCache = createMercuryRowShardCache(materialBank, { onError });
  lifetime.onDispose(materialCache.destroy);
  const warmImages = new Set();
  lifetime.onDispose(() => {
    const owned = [...warmImages];
    warmImages.clear();
    const errors = [];
    for (const image of owned) {
      try { releasePreparedImage(image); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Mercury warm image cleanup failed.");
  });
  let shouldPlay = false;
  let mounted = null;
  let orbit = null;
  let lensControls = null;
  let settingControls = null;
  let animations = Object.freeze([]);
  let ready = null;
  let shadowsEnabled = false;
  let diagnostics = null;
  lifetime.onDispose(() => {
    if (window.__mercury === diagnostics) delete window.__mercury;
  });

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
      for (const animation of animations) animation.play();
    },
    destroy() {
      shouldPlay = false;
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Mercury cleanup failed.");
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
      lensControls = createLensControls();
      settingControls = createSettingControls();
      const normal = lensById("normal");
      validatePreparedStarfield();
      await Promise.all([
        decodePrepared(normal.surfaceUrl, normal.surface2xUrl),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.poles.url,
          PREPARED_MERCURY_ASSETS.poles.url2x,
        ),
        materialCache.prepareInitial(),
        decodePrepared(shadowlessPresentation.url),
        ...PREPARED_MERCURY_SCENE.starfield.faces.flatMap(({
          url,
          url2x,
          highContrastUrl,
          highContrastUrl2x,
        }) => [
          decodePrepared(url, url2x),
          decodePrepared(highContrastUrl, highContrastUrl2x),
        ]),
        decodePrepared(
          PREPARED_MERCURY_SKY_SUN.asset.url,
          PREPARED_MERCURY_SKY_SUN.asset.url2x,
        ),
      ]);
      if (lifetime.disposed) return;
      mounted = mountPreparedScene(stage);
      // Warm-only handles are no longer needed once retained leaves own URLs.
      warmImages.clear();
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        lifetime.onDispose(() => animation.cancel());
        animation.pause();
        animation.currentTime = 0;
      }
      orbit = createVerticalOrbit();
      lensControls.bind();
      settingControls.bind();
      if (lifetime.disposed) return;
      if (shouldPlay) for (const animation of animations) animation.play();
      orbit.setState({ zoom: orbit.initialResponsiveZoom() });
      await waitForScenePaint(lifetime);
      if (lifetime.disposed) return;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (lifetime.disposed) return;
      throw error;
    }
  }

  function canonicalPreparedUrl(url, url2x = "") {
    return url2x || url;
  }

  async function decodePrepared(url, url2x = "", owner = warmImages) {
    if (lifetime.disposed) return null;
    const selected = canonicalPreparedUrl(url, url2x);
    const image = new Image();
    owner.add(image);
    image.decoding = "sync";
    try {
      await decodePreparedImage(image, selected);
    } catch (error) {
      if (owner.delete(image)) {
        try { releasePreparedImage(image); } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], error.message, { cause: error });
        }
      }
      if (lifetime.disposed) return null;
      throw error;
    }
    return image;
  }

  function mountPreparedScene(host) {
    const normal = lensById("normal");
    delete stage.dataset.lens;
    delete stage.dataset.view;
    const cameraRoot = document.createElement("div");
    lifetime.onDispose(() => cameraRoot.remove());
    lifetime.onDispose(() => {
      if (cameraRoot.parentNode !== host) return;
      delete host.dataset.lens;
      delete host.dataset.view;
      host.classList.remove("mercury-hide-shadows");
    });
    cameraRoot.className = "polycss-camera mercury-camera planet-render-root";
    cameraRoot.style.perspective = "1000000px";

    const sceneRoot = document.createElement("div");
    sceneRoot.className = "polycss-scene mercury-scene";
    sceneRoot.style.transform = PREPARED_MERCURY_SCENE.camera.defaultTransform;

    const system = document.createElement("div");
    system.className = "polycss-mesh mercury-system";
    system.style.transform = PREPARED_MERCURY_SCENE.systemTransform;

    const body = document.createElement("div");
    body.className = "polycss-mesh mercury-body";
    body.style.transform = PREPARED_MERCURY_SCENE.bodyTransform;
    body.style.setProperty(
      "--mercury-surface-image",
      `url("${canonicalPreparedUrl(normal.surfaceUrl, normal.surface2xUrl)}")`,
    );
    body.style.setProperty(
      "--mercury-poles-image",
      `url("${canonicalPreparedUrl(
        PREPARED_MERCURY_ASSETS.poles.url,
        PREPARED_MERCURY_ASSETS.poles.url2x,
      )}")`,
    );
    body.append(...PREPARED_MERCURY_SCENE.bodyLeaves.map(createLeaf));
    system.appendChild(body);
    const viewBank = createPreparedViewBank(system, normal);
    lifetime.onDispose(viewBank.destroy);
    sceneRoot.appendChild(system);
    cameraRoot.appendChild(sceneRoot);

    const materialRoot = document.createElement("div");
    lifetime.onDispose(() => materialRoot.remove());
    materialRoot.className = "mercury-material-root planet-render-root";
    const materialLeaf = document.createElement("s");
    materialLeaf.className = "mercury-material";
    publishMaterialFrame(materialLeaf, PREPARED_MERCURY_SCENE.material.defaultFrame);
    materialRoot.appendChild(materialLeaf);

    const cubicSky = mountRetainedCubicSky({
      host,
      plan: PREPARED_MERCURY_SCENE.starfield,
      imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
      objectId: "mercury",
      requireSun: false,
    });
    lifetime.onDispose(cubicSky.destroy);
    host.append(cameraRoot, materialRoot);
    const skySun = mountRetainedDirectionalSun({
      host,
      plan: PREPARED_MERCURY_SKY_SUN,
      imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
      objectId: "mercury",
      before: cameraRoot,
    });
    lifetime.onDispose(skySun.destroy);
    const stableNodes = Object.freeze([...host.querySelectorAll("*")]);
    const stableParents = Object.freeze(stableNodes.map((node) => node.parentNode));
    return Object.freeze({
      roots: Object.freeze([
        cubicSky.root,
        skySun.root,
        cameraRoot,
        materialRoot,
      ]),
      cubicSky,
      skySun,
      skybox: cubicSky.root,
      skyboxCube: cubicSky.cube,
      skyboxOrientation: cubicSky.orientation,
      cameraRoot,
      sceneRoot,
      body,
      viewBank,
      materialRoot,
      materialLeaf,
      stableNodes,
      retainedInitialNodeCount: stableNodes.length,
      retainedSkyboxFaceCount:
        cubicSky.faceCount,
      retainedSunCount: 1,
      retainedSunBillboardCount: 1,
      retainedSunCubemapBakeCount: 0,
      assertStableDomIdentity() {
        for (let index = 0; index < stableNodes.length; index += 1) {
          if (!stableNodes[index].isConnected ||
              stableNodes[index].parentNode !== stableParents[index]) {
            throw new Error(`Mercury retained DOM identity changed at node ${index}.`);
          }
        }
        return viewBank.assertStableDomIdentity();
      },
    });
  }

  function createPreparedViewBank(system, normal) {
    const presentation = PREPARED_MERCURY_SCENE.interior.presentationOrbit;
    if (presentation?.schema !==
          "cssmercury-prepared-interior-presentation-orbit@1" ||
        !Array.isArray(presentation.keyframes) ||
        presentation.keyframes.length !== 3 ||
        !Number.isFinite(presentation.durationMilliseconds) ||
        !Number.isFinite(presentation.millisecondsPerControlDegree)) {
      throw new Error("Mercury prepared interior presentation is incompatible.");
    }
    let interior = null;
    let stableNodes = Object.freeze([]);
    let stableParents = Object.freeze([]);
    let presentationAnimation = null;
    let controlPitch = PREPARED_MERCURY_SCENE.camera.defaultControlPitchDegrees;
    let destroyedViewBank = false;

    const bank = Object.freeze({
      mountInterior() {
        if (destroyedViewBank) {
          throw new Error("Mercury prepared view bank is destroyed.");
        }
        if (interior) return interior;
        const cutaway = document.createElement("div");
        cutaway.className = "polycss-mesh mercury-cutaway";
        const cutawayBody = document.createElement("div");
        cutawayBody.className = "polycss-mesh mercury-cutaway-body";
        cutawayBody.style.transform =
          PREPARED_MERCURY_SCENE.interior.bodyTransform;
        cutawayBody.style.setProperty(
          "--mercury-surface-image",
          `url("${canonicalPreparedUrl(normal.surfaceUrl, normal.surface2xUrl)}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-poles-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.poles.url,
            PREPARED_MERCURY_ASSETS.poles.url2x,
          )}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-interior-outer-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.interior.outerSurfaceUrl,
            PREPARED_MERCURY_ASSETS.interior.outerSurface2xUrl,
          )}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-interior-outer-poles-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
            PREPARED_MERCURY_ASSETS.interior.outerPoles2xUrl,
          )}")`,
        );
        cutawayBody.append(
          ...PREPARED_MERCURY_SCENE.interior.outerBodyLeaves.map(createLeaf),
        );
        const core = document.createElement("div");
        core.className = "polycss-mesh mercury-interior-core";
        core.style.transform = PREPARED_MERCURY_SCENE.interior.bodyTransform;
        core.append(
          ...PREPARED_MERCURY_SCENE.interior.coreLeaves.map(createLeaf),
        );
        const sections = document.createElement("div");
        sections.className = "polycss-mesh mercury-interior-sections";
        sections.style.transform = PREPARED_MERCURY_SCENE.interior.bodyTransform;
        sections.append(
          ...PREPARED_MERCURY_SCENE.interior.sectionLeaves.map(createLeaf),
        );
        cutaway.append(cutawayBody, core, sections);
        system.appendChild(cutaway);
        presentationAnimation = cutaway.animate(presentation.keyframes, {
          duration: presentation.durationMilliseconds,
          easing: "linear",
          fill: "both",
        });
        presentationAnimation.id = "mercury-interior-presentation-orbit";
        presentationAnimation.pause();
        syncPresentationPitch();
        stableNodes = Object.freeze([cutaway, ...cutaway.querySelectorAll("*")]);
        stableParents = Object.freeze(stableNodes.map((node) => node.parentNode));
        interior = Object.freeze({ cutaway, cutawayBody, core, sections });
        return interior;
      },
      current() {
        return interior;
      },
      syncPitch(nextControlPitch) {
        controlPitch = nextControlPitch;
        syncPresentationPitch();
      },
      state() {
        return Object.freeze({
          interiorMounted: interior !== null,
          retainedInteriorNodeCount: stableNodes.length,
        });
      },
      assertStableDomIdentity() {
        for (let index = 0; index < stableNodes.length; index += 1) {
          if (!stableNodes[index].isConnected ||
              stableNodes[index].parentNode !== stableParents[index]) {
            throw new Error(
              `Mercury retained interior identity changed at node ${index}.`,
            );
          }
        }
        return true;
      },
      destroy() {
        if (destroyedViewBank) return;
        destroyedViewBank = true;
        presentationAnimation?.cancel();
        presentationAnimation = null;
      },
    });
    bank.mountInterior();
    return bank;

    function syncPresentationPitch() {
      if (!presentationAnimation) return;
      presentationAnimation.currentTime = Math.max(0, Math.min(
        presentation.durationMilliseconds,
        (controlPitch - PREPARED_MERCURY_SCENE.camera
          .minimumControlPitchDegrees) *
          presentation.millisecondsPerControlDegree,
      ));
    }
  }

  function createLeaf(leaf) {
    return createPreparedProjectiveTextureLeaf(leaf);
  }

  function createVerticalOrbit() {
    const plan = PREPARED_MERCURY_SCENE.camera;
    if (plan.cameraModel !== "accumulated-matrix3d" ||
        plan.horizontalOrbit !== true || plan.pitchBounded !== false ||
        plan.yawBounded !== false || !Number.isFinite(plan.sceneScale)) {
      throw new Error("Mercury Venus-compatible camera contract drifted.");
    }
    const camera = createPolyCamera({
      ...plan.state,
      rotX: plan.defaultControlPitchDegrees,
      rotY: plan.defaultControlYawDegrees,
    });
    const orientation = createCubicSkyCameraOrientation({
      controlPitch: camera.state.rotX,
      controlYaw: camera.state.rotY,
      cameraPlan: plan,
      skyPlan: PREPARED_MERCURY_SCENE.starfield,
      requireSun: false,
      sunDirection: PREPARED_MERCURY_SKY_SUN.localDirection,
      sunReferenceViewDirection:
        PREPARED_MERCURY_SKY_SUN.referenceViewDirection,
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
    const retireFailure = (error) => {
      if (destroyedOrbit || lifetime.disposed) return;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], error.message, { cause: error })
        : error);
    };
    const guardNative = (callback) => (...args) => {
      if (destroyedOrbit || lifetime.disposed) return;
      try { return callback(...args); } catch (error) { retireFailure(error); }
    };
    let skySunViewDirection = PREPARED_MERCURY_SKY_SUN.referenceViewDirection;
    let sunViewDirection = viewSunDirectionToPreparedLightDirection(
      skySunViewDirection,
    );
    let materialFrame = PREPARED_MERCURY_SCENE.material.defaultFrame;
    let materialLightRollDegrees = 0;
    const publishCamera = createPreparedCameraPublisher({
      cameraElement: mounted.cameraRoot,
      sceneElement: mounted.sceneRoot,
      objectId: "mercury",
      defaultZoom: plan.defaultZoom,
      sceneScale: plan.sceneScale,
    });
    const publish = () => {
      if (destroyedOrbit || lifetime.disposed || !mounted) return;
      const controlPitch = safeCamera.state.rotX;
      publishCamera({ sceneMatrix: orientation.scene(), zoom: safeCamera.state.zoom });
      const skyboxOrientation = orientation.skybox();
      mounted.cubicSky.setOrientation({
        matrix: skyboxOrientation.matrix,
        zoom: safeCamera.state.zoom,
        defaultZoom: plan.defaultZoom,
      });
      skySunViewDirection = skyboxOrientation.sunViewDirection;
      sunViewDirection = viewSunDirectionToPreparedLightDirection(
        skySunViewDirection,
      );
      mounted.skySun.setViewDirection(skySunViewDirection);
      mounted.viewBank.syncPitch(controlPitch);
      mounted.materialRoot.style.scale =
        "calc(var(--mercury-shell-scale) / (" +
        `var(--planet-viewport-zoom-divisor) / ${safeCamera.state.zoom}))`;
      publishMaterialDirection(sunViewDirection);
      publications += 1;
    };
    const scene = Object.freeze({
      host: inputSurface,
      cameraEl: mounted.cameraRoot,
      sceneElement: mounted.sceneRoot,
      camera: safeCamera,
      applyCamera: guardNative(publish),
    });
    const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
    const wheelControls = createPolyOrbitControls(scene, {
      drag: false,
      wheel: !mobileQuery.matches,
      minZoom: plan.minimumZoom,
      maxZoom: plan.maximumZoom,
    });
    lifetime.onDispose(wheelControls.destroy);
    const dragControls = createUnboundedMatrixDragControls({
      inputSurface,
      onError: retireFailure,
      trackballMetrics: () => measureRetainedPlanetTrackball({
        stage,
        cameraElement: mounted.cameraRoot,
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
    lifetime.onDispose(dragControls.destroy);
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
    const policy = bindResponsiveOrbitPolicy({
      controls,
      inputSurface,
      mediaQuery: mobileQuery,
      onError: retireFailure,
    });
    lifetime.onDispose(policy.destroy);
    const windowTarget = inputSurface.ownerDocument.defaultView;
    let responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement: mounted.cameraRoot,
      plan,
      mobile: policy.mobile,
      mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"),
    });
    safeCamera.update({ zoom: responsiveFit.zoom });
    const initialResponsiveZoom = responsiveFit.zoom;
    const handleViewportResize = guardNative(() => {
      responsiveFit = selectPreparedResponsiveZoom({
        stage,
        cameraElement: mounted.cameraRoot,
        plan,
        mobile: policy.mobile,
        mobilePreviewElement:
          stage.ownerDocument.querySelector(".planet-sidebar"),
      });
      publish();
    });
    windowTarget?.addEventListener("resize", handleViewportResize, {
      passive: true,
    });
    lifetime.onDispose(() => windowTarget?.removeEventListener("resize", handleViewportResize));
    lifetime.onDispose(() => { destroyedOrbit = true; materialCache.onReady(null); });
    materialCache.onReady(guardNative(publish));
    return Object.freeze({
      initialResponsiveZoom() {
        return initialResponsiveZoom;
      },
      mobilePageFlow() {
        return policy.mobile;
      },
      state() {
        return Object.freeze({
          controlPitch: safeCamera.state.rotX,
          controlYaw: safeCamera.state.rotY,
          zoom: safeCamera.state.zoom,
        });
      },
      skyState() {
        return Object.freeze({
          sunViewDirection: Object.freeze([...sunViewDirection]),
          skySunViewDirection: Object.freeze([...skySunViewDirection]),
          sunVisible: mounted.skySun.state().visible,
          sunClassification: mounted.skySun.state().classification,
          shadowsEnabled,
          materialMode: shadowsEnabled
            ? "directional-terminator"
            : "full-phase-curvature",
          materialFrame,
          materialLightRollDegrees,
        });
      },
      setState({ controlPitch, controlYaw, zoom } = {}) {
        if (destroyedOrbit || lifetime.disposed) return this.state();
        try {
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
        } catch (error) { retireFailure(error); throw error; }
        return this.state();
      },
      refresh() {
        if (destroyedOrbit || lifetime.disposed) return;
        try { publish(); } catch (error) { retireFailure(error); throw error; }
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
          runtimeTransformStringWrites: publications * 2,
        });
      },
      destroy() {
        if (destroyedOrbit) return;
        destroyedOrbit = true;
        windowTarget?.removeEventListener("resize", handleViewportResize);
        controls.destroy();
        policy.destroy();
        materialCache.onReady(null);
      },
    });

    function publishMaterialDirection(direction) {
      const lighting = PREPARED_MERCURY_ASSETS.lighting;
      if (!shadowsEnabled) {
        publishShadowlessMaterial(
          mounted.materialLeaf,
          shadowlessPresentation,
        );
        materialFrame = shadowlessPresentation.frameIndex;
        materialLightRollDegrees = 0;
        return;
      }
      const amount = clamp(
        (direction[2] - lighting.minimumLightViewZ) /
          (lighting.maximumLightViewZ - lighting.minimumLightViewZ),
        0,
        1,
      );
      const frame = Math.round(
        amount * (PREPARED_MERCURY_SCENE.material.frameCount - 1),
      );
      publishMaterialFrame(mounted.materialLeaf, frame);
      materialFrame = frame;
      if (Math.hypot(direction[0], direction[1]) < 1e-9) return;
      const roll = normalizeDegrees(
        Math.atan2(direction[1], direction[0]) * 180 / Math.PI -
          lighting.baseLightAzimuthDegrees,
      );
      mounted.materialLeaf.style.setProperty(
        "--mercury-light-roll",
        `${roll}deg`,
      );
      materialLightRollDegrees = roll;
    }
  }

  function publishMaterialFrame(leaf, frameIndex) {
    const presentation = materialCache.presentation(frameIndex);
    if (!presentation || leaf.dataset.materialFrame === String(frameIndex)) {
      return;
    }
    delete leaf.dataset.materialMode;
    leaf.dataset.materialFrame = String(frameIndex);
    leaf.style.backgroundImage = `url("${presentation.url}")`;
    leaf.style.backgroundPosition = presentation.backgroundPosition;
    leaf.style.backgroundSize = presentation.backgroundSize;
  }

  function publishShadowlessMaterial(leaf, presentation) {
    if (leaf.dataset.materialMode === "full-phase-curvature") return;
    leaf.dataset.materialMode = "full-phase-curvature";
    delete leaf.dataset.materialFrame;
    leaf.style.backgroundImage = `url("${presentation.url}")`;
    leaf.style.backgroundPosition = presentation.backgroundPosition;
    leaf.style.backgroundSize = presentation.backgroundSize;
    leaf.style.setProperty("--mercury-light-roll", "0deg");
  }

  function createLensControls() {
    const root = document.querySelector(".planet-lenses");
    if (!(root instanceof HTMLElement)) {
      throw new Error("Mercury lens selector is missing.");
    }
    const lenses = new Map(PREPARED_MERCURY_LENSES.controls.map((lens) =>
      [lens.id, lens]));
    const buttonList = [...root.querySelectorAll('button[name="lens"]')];
    const buttons = new Map(buttonList.map(
      (button) => [button.value, button],
    ));
    if (buttons.size !== lenses.size || buttonList.length !== buttons.size ||
        lenses.size !== PREPARED_MERCURY_LENSES.controls.length ||
        [...lenses.keys()].some((id) => !buttons.has(id))) {
      throw new Error("Mercury lens selector does not match prepared lenses.");
    }
    const events = new AbortController();
    const owner = {};
    lensOwners.set(root, owner);
    const images = createMercuryLensImageGroups();
    lifetime.onDispose(images.destroy);
    let activeLens = PREPARED_MERCURY_LENSES.defaultLens;
    let desiredLens = activeLens;
    let bound = false;
    let busy = false;
    const selection = createLatestSelection({
      lifetime, onFatalError: onError,
      onBusyChange(value) {
        busy = value;
        root.classList.toggle("is-loading", value);
        root.setAttribute("aria-busy", String(value));
      },
    });
    lifetime.onDispose(() => {
      bound = false;
      events.abort();
      if (lensOwners.get(root) !== owner) return;
      lensOwners.delete(root);
      root.classList.remove("is-loading");
      root.setAttribute("aria-busy", "false");
      for (const button of buttons.values()) button.disabled = true;
    });
    root.classList.add("is-loading");
    for (const button of buttons.values()) button.disabled = true;
    for (const [id, button] of buttons) {
      button.addEventListener("click", () => void select(id).catch(console.error), {
        signal: events.signal,
      });
    }
    publishSelection();
    return Object.freeze({
      state() {
        return Object.freeze({ id: activeLens, ready: bound && !busy && !lifetime.disposed });
      },
      bind() {
        if (lifetime.disposed) return;
        bound = true;
        root.classList.remove("is-loading");
        for (const button of buttons.values()) button.disabled = false;
      },
      select,
      retainedImageCount() {
        return images.stats().retainedImageCount;
      },
    });

    async function select(id) {
      const lens = lenses.get(id);
      if (!lens) throw new RangeError(`Unknown Mercury lens: ${id}.`);
      if (lifetime.disposed || !bound) return false;
      desiredLens = id;
      return selection.run({
        prepare: () => prepareLens(lens),
        commit() {
        if (!mounted) throw new Error("Mercury presentation is unavailable.");
        if (lens.view === "exterior") {
          const surfaceUrl = canonicalPreparedUrl(
            lens.surfaceUrl,
            lens.surface2xUrl,
          );
          mounted.body.style.setProperty(
            "--mercury-surface-image",
            `url("${surfaceUrl}")`,
          );
          mounted.viewBank.current()?.cutawayBody.style.setProperty(
            "--mercury-surface-image",
            `url("${surfaceUrl}")`,
          );
          delete stage.dataset.view;
          if (id === PREPARED_MERCURY_LENSES.defaultLens) {
            delete stage.dataset.lens;
          } else {
            stage.dataset.lens = id;
          }
        } else {
          const normal = lensById("normal");
          const interior = mounted.viewBank.mountInterior();
          interior.cutawayBody.style.setProperty(
            "--mercury-surface-image",
            `url("${canonicalPreparedUrl(normal.surfaceUrl, normal.surface2xUrl)}")`,
          );
          interior.cutawayBody.style.setProperty(
            "--mercury-poles-image",
            `url("${canonicalPreparedUrl(
              PREPARED_MERCURY_ASSETS.poles.url,
              PREPARED_MERCURY_ASSETS.poles.url2x,
            )}")`,
          );
          stage.dataset.view = "interior";
          delete stage.dataset.lens;
        }
        activeLens = id;
        publishSelection();
        images.retainOnly([id]);
        },
        onCurrentFailure() {
          desiredLens = activeLens;
          images.retainOnly([activeLens]);
          publishSelection();
        },
        discard() { images.retainOnly([activeLens, desiredLens]); },
      });
    }

    function prepareLens(lens) {
      if (lens.id === PREPARED_MERCURY_LENSES.defaultLens) {
        return Promise.resolve(Object.freeze([]));
      }
      return images.load(lens.id, lens.view === "interior"
        ? preparedInteriorDecodeRequests()
        : [canonicalPreparedUrl(lens.surfaceUrl, lens.surface2xUrl)]);
    }

    function preparedInteriorDecodeRequests() {
      return [
        canonicalPreparedUrl(
          PREPARED_MERCURY_ASSETS.interior.outerSurfaceUrl,
          PREPARED_MERCURY_ASSETS.interior.outerSurface2xUrl,
        ),
        canonicalPreparedUrl(
          PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
          PREPARED_MERCURY_ASSETS.interior.outerPoles2xUrl,
        ),
        canonicalPreparedUrl(
          PREPARED_MERCURY_ASSETS.interior.coreUrl,
          PREPARED_MERCURY_ASSETS.interior.core2xUrl,
        ),
        canonicalPreparedUrl(
          PREPARED_MERCURY_ASSETS.interior.corePolesUrl,
          PREPARED_MERCURY_ASSETS.interior.corePoles2xUrl,
        ),
        canonicalPreparedUrl(
          PREPARED_MERCURY_ASSETS.interior.sectionUrl,
          PREPARED_MERCURY_ASSETS.interior.section2xUrl,
        ),
      ];
    }

    function publishSelection() {
      for (const [id, button] of buttons) {
        button.setAttribute("aria-pressed", id === activeLens ? "true" : "false");
      }
    }
  }

  function createSettingControls() {
    const speed = document.querySelector('button[name="speed"]');
    const shadows = document.querySelector('input[name="shadows"]');
    if (!(speed instanceof HTMLButtonElement) ||
        !(shadows instanceof HTMLInputElement)) {
      throw new Error("Mercury settings controls are incomplete.");
    }
    const events = new AbortController();
    let bound = false;
    shadows.checked = false;
    const speedControl = bindSpeedControl({
      button: speed, lifetime, onError,
      onChange(rate) { for (const animation of animations) animation.playbackRate = rate; },
    });
    lifetime.onDispose(() => { bound = false; events.abort(); });
    const onShadows = () => {
      if (lifetime.disposed) return;
      try {
        shadowsEnabled = shadows.checked;
        stage.classList.toggle("mercury-hide-shadows", !shadows.checked);
        orbit?.refresh();
      } catch (error) { onError(error); }
    };
    return Object.freeze({
      bind() {
        if (bound) return;
        bound = true;
        shadows.addEventListener("change", onShadows, { signal: events.signal });
        for (const animation of animations) animation.playbackRate = speedControl.state().speed;
        speedControl.setEnabled(true);
        onShadows();
      },
    });
  }

  function lensById(id) {
    const lens = PREPARED_MERCURY_LENSES.controls.find((item) => item.id === id);
    if (!lens) throw new RangeError(`Unknown Mercury lens: ${id}.`);
    return lens;
  }

  function publishDiagnostics() {
    diagnostics = Object.freeze({
      ready: true,
      camera: Object.freeze({
        state: orbit.state,
        setState: orbit.setState,
        stats: orbit.stats,
      }),
      sky: Object.freeze({ state: orbit.skyState }),
      lenses: Object.freeze({
        state: lensControls.state,
        select: lensControls.select,
      }),
      renderStats: Object.freeze({
        textureStats: Object.freeze({
          selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
          get retainedInteractiveImageCount() {
            return lensControls.retainedImageCount() +
              materialCache.stats().retainedImageCount;
          },
          materialCache: materialCache.stats,
        }),
      }),
      dom: Object.freeze({
        retainedInitialNodeCount: mounted.retainedInitialNodeCount,
        retainedSkyboxFaceCount: mounted.retainedSkyboxFaceCount,
        retainedSunCount: mounted.retainedSunCount,
        retainedSunBillboardCount: mounted.retainedSunBillboardCount,
        retainedSunCubemapBakeCount: mounted.retainedSunCubemapBakeCount,
        runtimeDomGrowthPolicy: "none",
        viewBank: mounted.viewBank.state,
      }),
      stableNodes: mounted.stableNodes,
      assertStableDomIdentity: mounted.assertStableDomIdentity,
    });
    window.__mercury = diagnostics;
  }
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}

function validatePreparedStarfield() {
  validatePreparedCubicSky(PREPARED_MERCURY_SCENE.starfield, {
    requireSun: false,
  });
  if (PREPARED_MERCURY_SCENE.starfield.cameraContract !==
      "inverse-unbounded-accumulated-matrix3d") {
    throw new TypeError("Mercury cubic-sky camera binding is incompatible.");
  }
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
