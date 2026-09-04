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
import { PLANET_SPEED_STATES } from "../../../platform/planet-feature-controls.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { createMercuryRowShardCache } from "./preparedRowCache.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "./preparedSkySun.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function mountMercuryClient(stage) {
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
  const materialCache = createMercuryRowShardCache(materialBank);
  let destroyed = false;
  let shouldPlay = true;
  let mounted = null;
  let orbit = null;
  let lensControls = null;
  let settingControls = null;
  let animations = Object.freeze([]);
  let ready = null;
  let resourcesReleased = false;
  let shadowsEnabled = false;

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
      for (const animation of animations) animation.play();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shouldPlay = false;
      releaseResources();
      delete document.documentElement.dataset.playing;
      if (DEVELOPMENT_DIAGNOSTICS && window.__mercury) delete window.__mercury;
    },
  });
  ready = start();
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
      if (destroyed) return;
      mounted = mountPreparedScene(stage);
      animations = Object.freeze(stage.getAnimations({ subtree: true }));
      for (const animation of animations) {
        animation.currentTime = 0;
        if (!shouldPlay) animation.pause();
      }
      orbit = createVerticalOrbit();
      lensControls.bind();
      settingControls.bind();
      orbit.setState({ zoom: orbit.initialResponsiveZoom() });
      await waitForPreparedScenePaint();
      if (destroyed) return;
      document.documentElement.dataset.playing = shouldPlay ? "true" : "false";
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
    } catch (error) {
      if (destroyed) return;
      releaseResources();
      throw error;
    }
  }

  function canonicalPreparedUrl(url, url2x = "") {
    return url2x || url;
  }

  async function decodePrepared(url, url2x = "") {
    const selected = canonicalPreparedUrl(url, url2x);
    const image = new Image();
    image.decoding = "sync";
    image.src = selected;
    try {
      await image.decode();
    } catch (error) {
      throw new Error(`Prepared Mercury image decode failed: ${selected}`, {
        cause: error,
      });
    }
    return image;
  }

  function releaseResources() {
    if (resourcesReleased) return;
    resourcesReleased = true;
    lensControls?.destroy();
    lensControls = null;
    settingControls?.destroy();
    settingControls = null;
    orbit?.destroy();
    orbit = null;
    materialCache.destroy();
    mounted?.viewBank.destroy();
    mounted?.roots.forEach((root) => root.remove());
    mounted = null;
    animations = Object.freeze([]);
    delete stage.dataset.lens;
    delete stage.dataset.view;
  }

  function mountPreparedScene(host) {
    const normal = lensById("normal");
    delete stage.dataset.lens;
    delete stage.dataset.view;
    const cameraRoot = document.createElement("div");
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
    sceneRoot.appendChild(system);
    cameraRoot.appendChild(sceneRoot);

    const materialRoot = document.createElement("div");
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
    host.append(cameraRoot, materialRoot);
    const skySun = mountRetainedDirectionalSun({
      host,
      plan: PREPARED_MERCURY_SKY_SUN,
      imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
      objectId: "mercury",
      before: cameraRoot,
    });
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
    let skySunViewDirection = PREPARED_MERCURY_SKY_SUN.referenceViewDirection;
    let sunViewDirection = viewSunDirectionToPreparedLightDirection(
      skySunViewDirection,
    );
    let materialFrame = PREPARED_MERCURY_SCENE.material.defaultFrame;
    let materialLightRollDegrees = 0;
    const publish = () => {
      if (destroyedOrbit || !mounted) return;
      const controlPitch = safeCamera.state.rotX;
      mounted.sceneRoot.style.transform =
        `scale(${plan.sceneScale}) ${orientation.scene()}`;
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
      const zoomScale = safeCamera.state.zoom / plan.state.zoom;
      mounted.cameraRoot.style.scale =
        "calc(var(--mercury-shell-scale) / (" +
        `var(--planet-viewport-zoom-divisor) / ${zoomScale}))`;
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
      inputSurface,
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
    });
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
    const handleViewportResize = () => {
      responsiveFit = selectPreparedResponsiveZoom({
        stage,
        cameraElement: mounted.cameraRoot,
        plan,
        mobile: policy.mobile,
        mobilePreviewElement:
          stage.ownerDocument.querySelector(".planet-sidebar"),
      });
      publish();
    };
    windowTarget?.addEventListener("resize", handleViewportResize, {
      passive: true,
    });
    materialCache.onReady(publish);
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
      refresh() {
        publish();
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
    const buttons = new Map([...root.querySelectorAll('button[name="lens"]')].map(
      (button) => [button.value, button],
    ));
    if (buttons.size !== lenses.size) {
      throw new Error("Mercury lens selector does not match prepared lenses.");
    }
    const events = new AbortController();
    const decoded = new Map();
    let activeLens = PREPARED_MERCURY_LENSES.defaultLens;
    let request = 0;
    let bound = false;
    let destroyedLenses = false;
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
        return Object.freeze({ id: activeLens, ready: bound && !destroyedLenses });
      },
      bind() {
        if (destroyedLenses) return;
        bound = true;
        root.classList.remove("is-loading");
        for (const button of buttons.values()) button.disabled = false;
      },
      select,
      destroy() {
        if (destroyedLenses) return;
        destroyedLenses = true;
        bound = false;
        request += 1;
        events.abort();
        root.classList.remove("is-loading");
        for (const button of buttons.values()) button.disabled = true;
        for (const [id, entry] of decoded) releaseLensDecode(id, entry);
        decoded.clear();
        delete stage.dataset.lens;
        delete stage.dataset.view;
      },
      retainedImageCount() {
        return [...decoded.values()].reduce(
          (count, entry) => count + (entry.images?.length ?? 0),
          0,
        );
      },
    });

    async function select(id) {
      const lens = lenses.get(id);
      if (!lens) throw new RangeError(`Unknown Mercury lens: ${id}.`);
      if (destroyedLenses || !bound) return false;
      const selectionRequest = ++request;
      root.classList.add("is-loading");
      try {
        await prepareLens(lens);
        if (destroyed || destroyedLenses || selectionRequest !== request ||
            !mounted) {
          return false;
        }
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
        releaseInactiveLensImages(id);
        return true;
      } finally {
        if (selectionRequest === request) root.classList.remove("is-loading");
      }
    }

    function prepareLens(lens) {
      if (lens.id === PREPARED_MERCURY_LENSES.defaultLens) {
        return Promise.resolve(Object.freeze([]));
      }
      let entry = decoded.get(lens.id);
      if (!entry) {
        entry = {
          images: null,
          promise: null,
          released: false,
          wanted: true,
        };
        const requests = lens.view === "interior"
          ? preparedInteriorDecodeRequests()
          : [decodePrepared(lens.surfaceUrl, lens.surface2xUrl)];
        entry.promise = Promise.all(requests).then((images) => {
          entry.images = images;
          if (!entry.wanted) releaseLensDecode(lens.id, entry);
          return images;
        }, (error) => {
          if (decoded.get(lens.id) === entry) decoded.delete(lens.id);
          throw error;
        });
        decoded.set(lens.id, entry);
      }
      entry.wanted = true;
      return entry.promise;
    }

    function preparedInteriorDecodeRequests() {
      return [
        decodePrepared(
          PREPARED_MERCURY_ASSETS.interior.outerSurfaceUrl,
          PREPARED_MERCURY_ASSETS.interior.outerSurface2xUrl,
        ),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
          PREPARED_MERCURY_ASSETS.interior.outerPoles2xUrl,
        ),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.interior.coreUrl,
          PREPARED_MERCURY_ASSETS.interior.core2xUrl,
        ),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.interior.corePolesUrl,
          PREPARED_MERCURY_ASSETS.interior.corePoles2xUrl,
        ),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.interior.sectionUrl,
          PREPARED_MERCURY_ASSETS.interior.section2xUrl,
        ),
      ];
    }

    function releaseInactiveLensImages(selectedId) {
      for (const [id, entry] of decoded) {
        if (id === selectedId) continue;
        releaseLensDecode(id, entry);
      }
    }

    function releaseLensDecode(id, entry) {
      entry.wanted = false;
      if (!entry.images || entry.released) return;
      entry.released = true;
      entry.images.forEach(releaseDecodedImage);
      if (decoded.get(id) === entry) decoded.delete(id);
      entry.images = null;
      entry.promise = null;
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
    let speedIndex = PLANET_SPEED_STATES.findIndex(({ value }) => value === 1);
    let bound = false;
    speed.dataset.state = "normal";
    speed.setAttribute("aria-label", "Speed: normal");
    shadows.checked = false;
    const onSpeed = () => {
      speedIndex = (speedIndex + 1) % PLANET_SPEED_STATES.length;
      publishSpeed();
    };
    const onShadows = () => {
      shadowsEnabled = shadows.checked;
      stage.classList.toggle("mercury-hide-shadows", !shadows.checked);
      orbit?.refresh();
    };
    return Object.freeze({
      bind() {
        if (bound) return;
        bound = true;
        speed.addEventListener("click", onSpeed, { signal: events.signal });
        shadows.addEventListener("change", onShadows, { signal: events.signal });
        publishSpeed();
        onShadows();
      },
      destroy() {
        if (!bound) return;
        bound = false;
        events.abort();
        shadowsEnabled = false;
        for (const animation of animations) animation.playbackRate = 1;
        stage.classList.remove("mercury-hide-shadows");
      },
    });

    function publishSpeed() {
      const state = PLANET_SPEED_STATES[speedIndex];
      speed.dataset.state = state.label;
      speed.setAttribute("aria-label", `Speed: ${state.label}`);
      for (const animation of animations) animation.playbackRate = state.value;
    }
  }

  function lensById(id) {
    const lens = PREPARED_MERCURY_LENSES.controls.find((item) => item.id === id);
    if (!lens) throw new RangeError(`Unknown Mercury lens: ${id}.`);
    return lens;
  }

  function publishDiagnostics() {
    window.__mercury = Object.freeze({
      ready: true,
      pause: controller.pause,
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

function waitForPreparedScenePaint() {
  return new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)));
}

function releaseDecodedImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  image.removeAttribute("src");
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
