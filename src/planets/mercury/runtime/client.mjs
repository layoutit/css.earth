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
  mountRetainedCubicSky,
  preparedScenePitch,
  selectPreparedResponsiveZoom,
} from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from
  "../../../platform/cubic-sky-contract.mjs";
import { viewSunDirectionToPhysicalLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import {
  distanceForSilhouetteRadius,
  rotationFromMatrix3d,
  silhouetteRadiusAtDistance,
  validatePreparedHeliocentricView,
} from "../../../platform/heliocentric-view.mjs";
import { mountRetainedHeliocentricView } from
  "../../../platform/heliocentric-view-runtime.mjs";
import { PLANET_SPEED_STATES } from "../../../platform/planet-feature-controls.mjs";
import { PREPARED_NAVIGATION_MARKERS } from
  "../../../../site/prepared-navigation-markers.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { createMercuryRowShardCache } from "./preparedRowCache.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "./preparedSkySun.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
// The shell's navigation atlas (see site/planet-navigation-marker.css): the
// far-view marker is the header's Mercury sprite, from the same file.
const NAVIGATION_MARKER_ATLAS_URL = "/navigation/planet-markers@2x.webp";

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
  // The far view's lighting: every frame in one small atlas, so the billboard
  // keeps the phase while the row shards stop streaming.
  const billboardLighting = materialBank.billboard;
  if (billboardLighting?.schema !== "cssmercury-prepared-lighting-billboard@1" ||
      billboardLighting.presentations.length !==
        PREPARED_MERCURY_ASSETS.lighting.frameCount) {
    throw new Error("Mercury has no prepared billboard lighting atlas.");
  }
  const navigationMarker = PREPARED_NAVIGATION_MARKERS.mercury;
  if (!navigationMarker || !(navigationMarker.presentation?.size > 0)) {
    throw new Error("Mercury has no prepared navigation marker.");
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
  let orbitEnabled = true;

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
      validatePreparedHeliocentricView(PREPARED_MERCURY_SCENE.heliocentricView);
      await Promise.all([
        decodePrepared(normal.surfaceUrl, normal.surface2xUrl),
        decodePrepared(
          PREPARED_MERCURY_ASSETS.poles.url,
          PREPARED_MERCURY_ASSETS.poles.url2x,
        ),
        materialCache.prepareInitial(),
        decodePrepared(shadowlessPresentation.url),
        decodePrepared(billboardLighting.url),
        decodePrepared(NAVIGATION_MARKER_ATLAS_URL),
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
    delete stage.dataset.lod;
  }

  function mountPreparedScene(host) {
    const normal = lensById("normal");
    delete stage.dataset.lens;
    delete stage.dataset.view;
    // Two perspective roots share one eye (set per layout below): the Sun's,
    // painted first so the body covers it, and the body camera's.
    const sunRoot = document.createElement("div");
    sunRoot.className = "mercury-sun-camera planet-render-root";
    const cameraRoot = document.createElement("div");
    cameraRoot.className = "polycss-camera mercury-camera planet-render-root";

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
    // The billboard: a flat disc of the surface's mean colour fitted to the
    // same silhouette as the overlay above it, which lights it.
    const billboard = document.createElement("s");
    billboard.className = "mercury-billboard";
    materialRoot.style.setProperty("--mercury-billboard-color", normal.billboardColor);
    const materialLeaf = document.createElement("s");
    materialLeaf.className = "mercury-material";
    publishMaterialFrame(materialLeaf, PREPARED_MERCURY_SCENE.material.defaultFrame);
    materialRoot.append(billboard, materialLeaf);

    const cubicSky = mountRetainedCubicSky({
      host,
      plan: PREPARED_MERCURY_SCENE.starfield,
      imageDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
      objectId: "mercury",
      requireSun: false,
    });
    host.append(sunRoot, cameraRoot, materialRoot);
    // The Sun at its true distance in its own perspective root, the orbit as
    // a true ellipse in an overlay sharing the camera root's box.
    const heliocentric = mountRetainedHeliocentricView({
      sunRoot,
      host,
      plan: PREPARED_MERCURY_SCENE.heliocentricView,
      objectId: "mercury",
      sunImageUrl: canonicalPreparedUrl(
        PREPARED_MERCURY_SKY_SUN.asset.url,
        PREPARED_MERCURY_SKY_SUN.asset.url2x,
      ),
      // The shell's own Mercury marker, tile and size, from the shared atlas.
      markerSprite: Object.freeze({
        url: NAVIGATION_MARKER_ATLAS_URL,
        index: navigationMarker.index,
        count: navigationMarker.count,
        size: navigationMarker.presentation.size,
      }),
    });
    const stableNodes = Object.freeze([...host.querySelectorAll("*")]);
    const stableParents = Object.freeze(stableNodes.map((node) => node.parentNode));
    return Object.freeze({
      roots: Object.freeze([
        cubicSky.root,
        sunRoot,
        cameraRoot,
        materialRoot,
        heliocentric.overlay,
      ]),
      cubicSky,
      heliocentric,
      sunRoot,
      skybox: cubicSky.root,
      skyboxCube: cubicSky.cube,
      skyboxOrientation: cubicSky.orientation,
      cameraRoot,
      sceneRoot,
      body,
      viewBank,
      materialRoot,
      materialLeaf,
      billboard,
      stableNodes,
      retainedInitialNodeCount: stableNodes.length,
      retainedSkyboxFaceCount:
        cubicSky.faceCount,
      retainedSunCount: 1,
      retainedSunBillboardCount: 1,
      retainedSunCubemapBakeCount: 0,
      retainedOrbitPieceCount: heliocentric.retainedOrbitPieceCount,
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
    const heliocentricPlan = PREPARED_MERCURY_SCENE.heliocentricView;
    if (plan.cameraModel !== "accumulated-matrix3d" ||
        plan.horizontalOrbit !== true || plan.pitchBounded !== false ||
        plan.yawBounded !== false || !Number.isFinite(plan.sceneScale) ||
        plan.projection?.model !== "css-perspective-shared-with-sky" ||
        plan.dolly?.model !== "multiplicative-wheel-distance" ||
        !Number.isFinite(plan.dolly.wheelStepPerDelta) ||
        !Number.isFinite(plan.dolly.minimumDistanceRadii) ||
        !Number.isFinite(plan.dolly.maximumDistanceOverOrbitExtent) ||
        !Number.isFinite(plan.orbitLineFade?.visibleBelowDiscHeightShare) ||
        !Number.isFinite(plan.orbitLineFade?.hiddenAboveDiscHeightShare) ||
        plan.levelOfDetail?.model !== "silhouette-diameter-crossfade" ||
        !(plan.levelOfDetail.billboardFadeStartDiscPixels >
          plan.levelOfDetail.billboardFullDiscPixels) ||
        !(plan.levelOfDetail.billboardFullDiscPixels >
          plan.levelOfDetail.markerFadeStartDiscPixels) ||
        !(plan.levelOfDetail.markerFadeStartDiscPixels >
          plan.levelOfDetail.markerFullDiscPixels) ||
        !(plan.levelOfDetail.markerFullDiscPixels > 0)) {
      throw new Error("Mercury perspective camera contract drifted.");
    }
    const levelOfDetail = plan.levelOfDetail;
    const bodyRadius = heliocentricPlan.units.bodyRadiusUnits;
    const kilometersPerUnit = heliocentricPlan.units.kilometersPerUnit;
    const maximumDistance = plan.dolly.maximumDistanceOverOrbitExtent *
      heliocentricPlan.orbit.maximumExtentUnits;
    // The camera: a pose (control pitch and yaw, accumulated into the scene
    // matrix by the sky orientation below) and a dolly distance from the
    // body's centre in scene units. The focal length is the camera root's
    // CSS perspective, re-read when the viewport changes.
    const cameraState = {
      rotX: plan.defaultControlPitchDegrees,
      rotY: plan.defaultControlYawDegrees,
      distance: 0,
    };
    let focal = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    // The eye sits at the sky's vanishing point; the shell lays the body's
    // root out beside its chrome, so the body is viewed slightly off-axis.
    // The offset is the principal point relative to the root's centre.
    let principalOffset = Object.freeze([0, 0]);
    const measureViewport = () => {
      const view = mounted.cameraRoot.ownerDocument.defaultView;
      const nextFocal = parseFloat(
        view.getComputedStyle(mounted.cameraRoot).perspective,
      );
      const bounds = mounted.cameraRoot.getBoundingClientRect();
      if (!(nextFocal > 0) || !(bounds.width > 0) || !(bounds.height > 0)) {
        throw new Error("Mercury perspective camera root has no projection.");
      }
      focal = nextFocal;
      viewportWidth = bounds.width;
      viewportHeight = bounds.height;
      const skyBounds = mounted.skybox.getBoundingClientRect();
      const [skyOriginX, skyOriginY] = view.getComputedStyle(mounted.skybox)
        .perspectiveOrigin.split(" ").map(parseFloat);
      principalOffset = Object.freeze([
        skyBounds.x + skyOriginX - (bounds.x + bounds.width / 2),
        skyBounds.y + skyOriginY - (bounds.y + bounds.height / 2),
      ].map((value) => Number.isFinite(value) ? value : 0));
      const origin = `calc(50% + ${formatNumber(principalOffset[0])}px) ` +
        `calc(50% + ${formatNumber(principalOffset[1])}px)`;
      mounted.cameraRoot.style.perspectiveOrigin = origin;
      mounted.sunRoot.style.perspectiveOrigin = origin;
    };
    measureViewport();
    // Zoom stays the framing alias the responsive fit and the material
    // overlay speak: silhouette diameter over the logical body diameter,
    // times the default zoom.
    const zoomToDistance = (zoom) => distanceForSilhouetteRadius(
      bodyRadius,
      focal,
      Math.max(1e-6, zoom / plan.defaultZoom * plan.logicalBodyDiameter / 2),
      principalOffset,
    );
    // The round trip through the distance is exact only to floating point;
    // the alias reports the prepared bound itself at the bound.
    const distanceToZoom = (distance) => {
      const zoom =
        silhouetteRadiusAtDistance(bodyRadius, focal, distance, principalOffset) *
          2 / plan.logicalBodyDiameter * plan.defaultZoom;
      return Math.abs(zoom - plan.maximumZoom) < 1e-9 ? plan.maximumZoom : zoom;
    };
    const minimumDistance = () => Math.max(
      plan.dolly.minimumDistanceRadii * bodyRadius,
      zoomToDistance(plan.maximumZoom),
    );
    const clampDistance = (distance) =>
      clamp(distance, minimumDistance(), maximumDistance);
    const orientation = createCubicSkyCameraOrientation({
      controlPitch: cameraState.rotX,
      controlYaw: cameraState.rotY,
      cameraPlan: plan,
      skyPlan: PREPARED_MERCURY_SCENE.starfield,
      requireSun: false,
      sunDirection: PREPARED_MERCURY_SKY_SUN.localDirection,
      sunReferenceViewDirection:
        PREPARED_MERCURY_SKY_SUN.referenceViewDirection,
      // Mercury's Sun direction is observed, so it stays fixed in the
      // prepared scene frame instead of following the presentation sky, and
      // the overlay below uses the physical light map: a Sun on screen means
      // the camera sees the night side. The stars ride the same scene matrix
      // so they cross the screen exactly like the Sun.
      sunTracksScene: true,
      skyTracksScene: true,
    });
    const safeCamera = Object.freeze({
      get state() {
        return Object.freeze({
          rotX: cameraState.rotX,
          rotY: cameraState.rotY,
          distance: cameraState.distance,
          zoom: distanceToZoom(cameraState.distance),
        });
      },
      update(partial) {
        if (partial.rotX !== undefined) cameraState.rotX = partial.rotX;
        if (partial.rotY !== undefined) cameraState.rotY = partial.rotY;
        if (partial.distance !== undefined) {
          cameraState.distance = clampDistance(partial.distance);
        } else if (partial.zoom !== undefined) {
          cameraState.distance = clampDistance(zoomToDistance(partial.zoom));
        }
      },
    });
    let interactionStarts = 0;
    let interactionEnds = 0;
    let publications = 0;
    let wheelDollies = 0;
    let destroyedOrbit = false;
    let skySunViewDirection = PREPARED_MERCURY_SKY_SUN.referenceViewDirection;
    let sunViewDirection = viewSunDirectionToPhysicalLightDirection(
      skySunViewDirection,
    );
    let materialFrame = PREPARED_MERCURY_SCENE.material.defaultFrame;
    let materialLightRollDegrees = 0;
    let projection = null;
    let lodStage = "geometry";
    let billboardOpacity = 0;
    let markerOpacity = 0;
    let publishedBillboardOpacity = null;
    const publish = () => {
      if (destroyedOrbit || !mounted) return;
      const controlPitch = safeCamera.state.rotX;
      const distance = cameraState.distance;
      // The Sun and the orbit, resolved relative to the camera in float64;
      // the same projection places the body.
      projection = mounted.heliocentric.publish({
        rotation: rotationFromMatrix3d(orientation.sceneMatrix()),
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
      });
      // The body: its centre `distance` from the eye on the line that
      // projects to the root's centre, then the accumulated scene rotation.
      // The scene scale must be uniform in three dimensions: a 2D scale()
      // leaves the body's depth unscaled, which a real perspective camera
      // notices (the near hemisphere would sit behind the eye).
      const [bodyX, bodyY, bodyZ] = projection.body.translate;
      mounted.sceneRoot.style.transform =
        `translate3d(${formatNumber(bodyX)}px, ${formatNumber(bodyY)}px, ` +
        `${formatNumber(bodyZ)}px) ` +
        `scale3d(${plan.sceneScale}, ${plan.sceneScale}, ${plan.sceneScale}) ` +
        orientation.scene();
      const zoom = distanceToZoom(distance);
      const skyboxOrientation = orientation.skybox();
      mounted.cubicSky.setOrientation({
        matrix: skyboxOrientation.matrix,
        zoom,
        defaultZoom: plan.defaultZoom,
      });
      skySunViewDirection = skyboxOrientation.sunViewDirection;
      sunViewDirection = viewSunDirectionToPhysicalLightDirection(
        skySunViewDirection,
      );
      const discHeightShare = projection.body.silhouetteDiameter /
        viewportHeight;
      mounted.heliocentric.setOrbitOpacity(
        (plan.orbitLineFade.hiddenAboveDiscHeightShare - discHeightShare) /
          (plan.orbitLineFade.hiddenAboveDiscHeightShare -
            plan.orbitLineFade.visibleBelowDiscHeightShare),
      );
      mounted.viewBank.syncPitch(controlPitch);
      // The terminator overlay is fitted to the projected silhouette: an
      // ellipse, slightly elongated and shifted outward when off-axis.
      // Fitted to the mathematical silhouette exactly: the prepared lighting
      // frames are registered to that disc, and at a thin crescent even a
      // pixel of inflation moves the overlay's crescent off the painted one.
      const { silhouette } = projection.body;
      const limbCover = 1;
      const unitScale = 2 * plan.defaultZoom / plan.logicalBodyDiameter;
      const radialAngle = Math.atan2(silhouette.radial[1], silhouette.radial[0]) *
        180 / Math.PI;
      mounted.materialRoot.style.transform =
        `translate(${formatNumber(silhouette.centre[0])}px, ` +
        `${formatNumber(silhouette.centre[1])}px) ` +
        `rotate(${formatNumber(radialAngle)}deg) ` +
        `scale(${formatNumber(silhouette.radialSemiAxis * limbCover * unitScale)}, ` +
        `${formatNumber(silhouette.tangentialSemiAxis * limbCover * unitScale)}) ` +
        `rotate(${formatNumber(-radialAngle)}deg)`;
      publishLevelOfDetail(projection.body.silhouetteDiameter);
      publishMaterialDirection(sunViewDirection, materialSource());
      publications += 1;
    };
    // The stage from the projected disc: the coarser stage fades in over the
    // finer one, which stays painted until the coarser is opaque and then
    // hides. Only changed values are written.
    const publishLevelOfDetail = (silhouetteDiameter) => {
      billboardOpacity = clamp(
        (levelOfDetail.billboardFadeStartDiscPixels - silhouetteDiameter) /
          (levelOfDetail.billboardFadeStartDiscPixels -
            levelOfDetail.billboardFullDiscPixels),
        0,
        1,
      );
      markerOpacity = clamp(
        (levelOfDetail.markerFadeStartDiscPixels - silhouetteDiameter) /
          (levelOfDetail.markerFadeStartDiscPixels -
            levelOfDetail.markerFullDiscPixels),
        0,
        1,
      );
      lodStage = markerOpacity >= 1
        ? "marker"
        : billboardOpacity >= 1
          ? "billboard"
          : billboardOpacity > 0 ? "crossfade" : "geometry";
      if (stage.dataset.lod !== lodStage) stage.dataset.lod = lodStage;
      const opacity = formatNumber(billboardOpacity);
      if (opacity !== publishedBillboardOpacity) {
        mounted.materialRoot.style.setProperty(
          "--mercury-billboard-opacity",
          opacity,
        );
        publishedBillboardOpacity = opacity;
      }
      mounted.heliocentric.setMarkerOpacity(markerOpacity);
    };
    // As soon as the billboard starts fading in the overlay draws from the
    // billboard atlas, and the row shards stop streaming; at that size the
    // two are the same picture.
    const materialSource = () => lodStage === "geometry" ? "rows" : "billboard";
    const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
    // Wheel dolly: multiplicative in distance, so one notch is the same
    // relative step at the surface and at the orbit's scale.
    let wheelEnabled = !mobileQuery.matches;
    const onWheel = (event) => {
      if (!wheelEnabled || destroyedOrbit) return;
      event.preventDefault();
      const delta = event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      safeCamera.update({
        distance: cameraState.distance *
          Math.exp(delta * plan.dolly.wheelStepPerDelta),
      });
      wheelDollies += 1;
      publish();
    };
    inputSurface.addEventListener("wheel", onWheel, { passive: false });
    const wheelControls = Object.freeze({
      update(options) {
        if (options.wheel !== undefined) wheelEnabled = options.wheel;
      },
      destroy() {
        inputSurface.removeEventListener("wheel", onWheel);
      },
    });
    const trackball = () => {
      const bounds = mounted.cameraRoot.getBoundingClientRect();
      return Object.freeze({
        centerX: (bounds.left + bounds.right) / 2,
        centerY: (bounds.top + bounds.bottom) / 2,
        // A small body still orbits comfortably: the trackball never shrinks
        // below a fifth of the viewport's short side.
        radius: Math.max(
          projection?.body.silhouetteRadius ?? bodyRadius,
          Math.min(viewportWidth, viewportHeight) / 5,
        ),
      });
    };
    const dragControls = createUnboundedMatrixDragControls({
      inputSurface,
      trackballMetrics: trackball,
      surfaceFlyToState: () => Object.freeze({
        zoom: safeCamera.state.zoom,
        minimumZoom: distanceToZoom(maximumDistance),
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
    // The shell moves the render roots when the sidebar collapses; the eye
    // stays at the sky's vanishing point, so re-measure the offset then.
    const relayout = () => {
      if (destroyedOrbit || !mounted) return;
      measureViewport();
      safeCamera.update({ distance: cameraState.distance });
      publish();
    };
    const sidebarObserver = new MutationObserver(relayout);
    sidebarObserver.observe(stage.ownerDocument.body, {
      attributes: true,
      attributeFilter: ["data-sidebar-collapsed"],
    });
    const onTransitionEnd = (event) => {
      if (event.propertyName === "translate") relayout();
    };
    stage.addEventListener("transitionend", onTransitionEnd);
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
      measureViewport();
      responsiveFit = selectPreparedResponsiveZoom({
        stage,
        cameraElement: mounted.cameraRoot,
        plan,
        mobile: policy.mobile,
        mobilePreviewElement:
          stage.ownerDocument.querySelector(".planet-sidebar"),
      });
      safeCamera.update({ distance: cameraState.distance });
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
          distance: cameraState.distance,
          distanceKilometers: cameraState.distance * kilometersPerUnit,
          distanceRadii: cameraState.distance / bodyRadius,
          focal,
          principalOffset,
          offAxisDegrees: projection?.body.offAxisDegrees ?? null,
          silhouetteRadius: projection?.body.silhouetteRadius ?? null,
        });
      },
      skyState() {
        const heliocentric = mounted.heliocentric.state();
        return Object.freeze({
          sunViewDirection: Object.freeze([...sunViewDirection]),
          skySunViewDirection: Object.freeze([...skySunViewDirection]),
          sunVisible: heliocentric.sun?.visible ?? false,
          sunClassification: heliocentric.sun?.classification ?? "unpublished",
          sunCenterNdc: heliocentric.sun?.centerNdc ?? null,
          sunSpriteDiameter: heliocentric.sun?.spriteDiameter ?? null,
          shadowsEnabled,
          materialMode: shadowsEnabled
            ? "directional-terminator"
            : "full-phase-curvature",
          materialFrame,
          materialLightRollDegrees,
          orbitEnabled,
          orbitPieceCount: heliocentric.orbitPieceCount,
          orbitOpacity: heliocentric.orbitOpacity,
          bodyMarkerOpacity: heliocentric.markerOpacity,
          lod: Object.freeze({
            stage: lodStage,
            silhouetteDiameter: projection?.body.silhouetteDiameter ?? null,
            billboardOpacity,
            markerOpacity,
            materialSource: materialSource(),
            rowStreaming: materialCache.stats().active,
          }),
        });
      },
      setState({
        controlPitch,
        controlYaw,
        zoom,
        distance,
        distanceKilometers,
      } = {}) {
        dragControls.stop();
        const resetsOrientation = controlPitch !== undefined ||
          controlYaw !== undefined;
        safeCamera.update({
          ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
          ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
          ...(distanceKilometers !== undefined
            ? { distance: distanceKilometers / kilometersPerUnit }
            : distance !== undefined
              ? { distance }
              : zoom !== undefined ? { zoom } : {}),
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
          projection: plan.projection,
          dolly: Object.freeze({
            ...plan.dolly,
            minimumDistance: minimumDistance(),
            maximumDistance,
            minimumDistanceKilometers: minimumDistance() * kilometersPerUnit,
            maximumDistanceKilometers: maximumDistance * kilometersPerUnit,
            wheelDollies,
          }),
          // The zoom alias's bounds: the prepared close framing and the
          // whole-orbit dolly distance seen through the same alias.
          minimumZoom: distanceToZoom(maximumDistance),
          maximumZoom: plan.maximumZoom,
          responsiveFitModel: responsiveFit.model,
          responsiveWidthShare: responsiveFit.widthShare,
          responsiveBaseZoom: responsiveFit.zoom,
          interactionStarts,
          interactionEnds,
          publications,
          dragInertia: dragControls.stats(),
          // Scene, sky orientation, the Sun billboard and the material
          // scale, plus one per visible orbit piece.
          runtimeTransformStringWrites: publications * 4,
          orbitPieceCount: mounted.heliocentric.state().orbitPieceCount,
          orbitPoolOverflows: mounted.heliocentric.state().orbitPoolOverflows,
        });
      },
      destroy() {
        if (destroyedOrbit) return;
        destroyedOrbit = true;
        windowTarget?.removeEventListener("resize", handleViewportResize);
        sidebarObserver.disconnect();
        stage.removeEventListener("transitionend", onTransitionEnd);
        controls.destroy();
        policy.destroy();
        materialCache.onReady(null);
      },
    });

    function publishMaterialDirection(direction, source) {
      const lighting = PREPARED_MERCURY_ASSETS.lighting;
      if (source === "billboard") materialCache.suspend();
      if (!shadowsEnabled) {
        if (source === "billboard") {
          publishBillboardMaterialFrame(
            mounted.materialLeaf,
            shadowlessPresentation.frameIndex,
          );
          mounted.materialLeaf.style.setProperty("--mercury-light-roll", "0deg");
        } else {
          publishShadowlessMaterial(
            mounted.materialLeaf,
            shadowlessPresentation,
          );
        }
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
      if (source === "billboard") {
        publishBillboardMaterialFrame(mounted.materialLeaf, frame);
      } else {
        publishMaterialFrame(mounted.materialLeaf, frame);
      }
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
    // Asking the row cache for the frame is what keeps its rows streaming.
    const presentation = materialCache.presentation(frameIndex);
    if (!presentation || (leaf.dataset.materialSource === "rows" &&
        leaf.dataset.materialFrame === String(frameIndex))) {
      return;
    }
    delete leaf.dataset.materialMode;
    leaf.dataset.materialSource = "rows";
    leaf.dataset.materialFrame = String(frameIndex);
    leaf.style.backgroundImage = `url("${presentation.url}")`;
    leaf.style.backgroundPosition = presentation.backgroundPosition;
    leaf.style.backgroundSize = presentation.backgroundSize;
  }

  function publishBillboardMaterialFrame(leaf, frameIndex) {
    if (leaf.dataset.materialSource === "billboard" &&
        leaf.dataset.materialFrame === String(frameIndex)) {
      return;
    }
    const presentation = billboardLighting.presentations[frameIndex];
    delete leaf.dataset.materialMode;
    leaf.dataset.materialSource = "billboard";
    leaf.dataset.materialFrame = String(frameIndex);
    leaf.style.backgroundImage = `url("${presentation.url}")`;
    leaf.style.backgroundPosition = presentation.backgroundPosition;
    leaf.style.backgroundSize = presentation.backgroundSize;
  }

  function publishShadowlessMaterial(leaf, presentation) {
    if (leaf.dataset.materialMode === "full-phase-curvature") return;
    leaf.dataset.materialMode = "full-phase-curvature";
    leaf.dataset.materialSource = "rows";
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
        mounted.materialRoot.style.setProperty(
          "--mercury-billboard-color",
          lens.billboardColor,
        );
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
    const orbitLine = document.querySelector('input[name="orbit"]');
    if (!(speed instanceof HTMLButtonElement) ||
        !(shadows instanceof HTMLInputElement) ||
        !(orbitLine instanceof HTMLInputElement)) {
      throw new Error("Mercury settings controls are incomplete.");
    }
    const events = new AbortController();
    let speedIndex = PLANET_SPEED_STATES.findIndex(({ value }) => value === 1);
    let bound = false;
    speed.dataset.state = "normal";
    speed.setAttribute("aria-label", "Speed: normal");
    shadows.checked = false;
    orbitLine.checked = true;
    const onSpeed = () => {
      speedIndex = (speedIndex + 1) % PLANET_SPEED_STATES.length;
      publishSpeed();
    };
    const onShadows = () => {
      shadowsEnabled = shadows.checked;
      stage.classList.toggle("mercury-hide-shadows", !shadows.checked);
      orbit?.refresh();
    };
    // The orbit line is retained either way; the class only hides it, so
    // toggling neither re-lays-out nor republishes the scene.
    const onOrbit = () => {
      orbitEnabled = orbitLine.checked;
      stage.classList.toggle("mercury-hide-orbit", !orbitLine.checked);
    };
    return Object.freeze({
      bind() {
        if (bound) return;
        bound = true;
        speed.addEventListener("click", onSpeed, { signal: events.signal });
        shadows.addEventListener("change", onShadows, { signal: events.signal });
        orbitLine.addEventListener("change", onOrbit, { signal: events.signal });
        publishSpeed();
        onShadows();
        onOrbit();
      },
      destroy() {
        if (!bound) return;
        bound = false;
        events.abort();
        shadowsEnabled = false;
        orbitEnabled = true;
        for (const animation of animations) animation.playbackRate = 1;
        stage.classList.remove("mercury-hide-shadows");
        stage.classList.remove("mercury-hide-orbit");
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
    if (!/^#[0-9a-f]{6}$/u.test(lens.billboardColor ?? "")) {
      throw new Error(`Mercury lens ${id} has no prepared billboard colour.`);
    }
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
      sky: Object.freeze({
        state: orbit.skyState,
        sceneRegistration: PREPARED_MERCURY_SCENE.starfield.sceneRegistration,
        sunLocalDirection: PREPARED_MERCURY_SKY_SUN.localDirection,
        heliocentricView: Object.freeze({
          schema: PREPARED_MERCURY_SCENE.heliocentricView.schema,
          units: PREPARED_MERCURY_SCENE.heliocentricView.units,
          sun: Object.freeze({
            direction: PREPARED_MERCURY_SCENE.heliocentricView.sun.direction,
            distanceAu: PREPARED_MERCURY_SCENE.heliocentricView.sun.distanceAu,
            radiusKilometers:
              PREPARED_MERCURY_SCENE.heliocentricView.sun.radiusKilometers,
          }),
          orbit: Object.freeze({
            semiMajorAxisAu:
              PREPARED_MERCURY_SCENE.heliocentricView.orbit.semiMajorAxisAu,
            eccentricity:
              PREPARED_MERCURY_SCENE.heliocentricView.orbit.eccentricity,
            inclinationDegrees:
              PREPARED_MERCURY_SCENE.heliocentricView.orbit.inclinationDegrees,
            normal: PREPARED_MERCURY_SCENE.heliocentricView.orbit.normal,
            perihelionDirection:
              PREPARED_MERCURY_SCENE.heliocentricView.orbit.perihelionDirection,
            vertexCount:
              PREPARED_MERCURY_SCENE.heliocentricView.orbit.vertexCount,
          }),
        }),
      }),
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
        retainedOrbitPieceCount: mounted.retainedOrbitPieceCount,
        retainedBillboardCount: 1,
        retainedBodyMarkerCount: 1,
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

function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

function validatePreparedStarfield() {
  validatePreparedCubicSky(PREPARED_MERCURY_SCENE.starfield, {
    requireSun: false,
  });
  if (PREPARED_MERCURY_SCENE.starfield.cameraContract !==
        "scene-locked-unbounded-accumulated-matrix3d" ||
      typeof PREPARED_MERCURY_SCENE.starfield.sceneRegistration !== "string") {
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
