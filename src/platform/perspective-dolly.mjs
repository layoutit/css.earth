import {
  distanceForSilhouetteRadius,
  rotationFromMatrix3d,
  silhouetteRadiusAtDistance,
} from "./heliocentric-view.mjs";

// A true perspective camera for the shared orbit: the eye sits at the sky's
// vanishing point (the camera root's CSS perspective, re-read whenever the
// viewport or the shell layout changes) and frames by dolly. The prepared
// camera plan declares it with `projection.model`, its wheel `dolly`, the
// `orbitLineFade` and the `levelOfDetail` crossfade; the body's heliocentric
// neighbourhood (Sun, orbit, marker) is projected with the same camera in
// float64 and the body is placed by the same projection.
//
// Zoom stays the framing alias the responsive fit, the destination flights
// and the material overlays speak: silhouette diameter over the logical body
// diameter, times the default zoom.
//
// A plan may also opt into `drag: { model: "screen-axis-tumble" }`: every
// pointer sample is taken as if it started at the trackball's centre, so a
// drag anywhere on screen tumbles the scene about the screen axes. The
// shared virtual trackball twists the scene about the view axis once the
// pointer leaves its disc, which at a far dolly (the body a few pixels wide,
// the disc a fifth of the viewport) is nearly everywhere: measured as a
// 0.99 roll share and 11-27 degrees per 240 px stroke off-centre against
// 82 degrees of pure tumble at the centre. Rotation itself is unbounded on
// every path; the control pitch anchors in the plan calibrate the affine
// control-to-scene map and clamp nothing.
//
// A plan whose heliocentric view carries the planetary system opts into the
// wider dolly (`dolly.maximumDistanceOverSystemExtent` against the system's
// extent instead of the body's orbit), the system's fade-in with distance
// (`planetarySystem`) and the Sun's marker floor (`sunMarker`). Plans without
// them keep the body-orbit range exactly as before.
export const PERSPECTIVE_PROJECTION_MODEL = "css-perspective-shared-with-sky";
export const SCENE_LOCKED_SKY_CAMERA_CONTRACT =
  "scene-locked-unbounded-accumulated-matrix3d";

export function isPerspectiveCameraPlan(plan) {
  return plan?.projection?.model === PERSPECTIVE_PROJECTION_MODEL;
}

export function validatePerspectiveCameraPlan(plan) {
  if (plan?.projection?.model !== PERSPECTIVE_PROJECTION_MODEL ||
      typeof plan.projection.cssPerspective !== "string" ||
      !plan.projection.cssPerspective ||
      plan.dolly?.model !== "multiplicative-wheel-distance" ||
      !Number.isFinite(plan.dolly.wheelStepPerDelta) ||
      !Number.isFinite(plan.dolly.minimumDistanceRadii) ||
      !Number.isFinite(plan.dolly.maximumDistanceOverOrbitExtent) ||
      (plan.dolly.maximumDistanceOverSystemExtent !== undefined &&
        !(plan.dolly.maximumDistanceOverSystemExtent > 0)) ||
      (plan.planetarySystem !== undefined && (
        plan.planetarySystem?.model !== "distance-over-orbit-extent-fade" ||
        !Number.isFinite(plan.planetarySystem.hiddenBelowDistanceOverOrbitExtent) ||
        !(plan.planetarySystem.visibleAboveDistanceOverOrbitExtent >
          plan.planetarySystem.hiddenBelowDistanceOverOrbitExtent))) ||
      (plan.drag !== undefined && plan.drag?.model !== "screen-axis-tumble") ||
      (plan.sunMarker !== undefined && (
        plan.sunMarker?.model !== "sprite-diameter-crossfade" ||
        !(plan.sunMarker.fadeStartSpritePixels > plan.sunMarker.fullSpritePixels) ||
        !(plan.sunMarker.fullSpritePixels > 0))) ||
      !Number.isFinite(plan.orbitLineFade?.visibleBelowDiscHeightShare) ||
      !Number.isFinite(plan.orbitLineFade?.hiddenAboveDiscHeightShare) ||
      !(plan.orbitLineFade.hiddenAboveDiscHeightShare >
        plan.orbitLineFade.visibleBelowDiscHeightShare) ||
      plan.levelOfDetail?.model !== "silhouette-diameter-crossfade" ||
      !(plan.levelOfDetail.billboardFadeStartDiscPixels >
        plan.levelOfDetail.billboardFullDiscPixels) ||
      !(plan.levelOfDetail.billboardFullDiscPixels >
        plan.levelOfDetail.markerFadeStartDiscPixels) ||
      !(plan.levelOfDetail.markerFadeStartDiscPixels >
        plan.levelOfDetail.markerFullDiscPixels) ||
      !(plan.levelOfDetail.markerFullDiscPixels > 0) ||
      !Number.isFinite(plan.logicalBodyDiameter) ||
      !(plan.defaultZoom > 0) || !(plan.maximumZoom > 0) ||
      !Number.isFinite(plan.sceneScale)) {
    throw new TypeError("Perspective camera contract drifted.");
  }
  return plan;
}

// The stage from the projected disc: the coarser stage fades in over the
// finer one, which stays painted until the coarser is opaque and then hides.
export function levelOfDetailFor(levelOfDetail, silhouetteDiameter) {
  const billboardOpacity = clamp(
    (levelOfDetail.billboardFadeStartDiscPixels - silhouetteDiameter) /
      (levelOfDetail.billboardFadeStartDiscPixels -
        levelOfDetail.billboardFullDiscPixels),
    0,
    1,
  );
  const markerOpacity = clamp(
    (levelOfDetail.markerFadeStartDiscPixels - silhouetteDiameter) /
      (levelOfDetail.markerFadeStartDiscPixels -
        levelOfDetail.markerFullDiscPixels),
    0,
    1,
  );
  const stage = markerOpacity >= 1
    ? "marker"
    : billboardOpacity >= 1
      ? "billboard"
      : billboardOpacity > 0 ? "crossfade" : "geometry";
  return Object.freeze({
    stage,
    silhouetteDiameter,
    billboardOpacity,
    markerOpacity,
  });
}

export function orbitLineOpacity(fade, discHeightShare) {
  return clamp(
    (fade.hiddenAboveDiscHeightShare - discHeightShare) /
      (fade.hiddenAboveDiscHeightShare - fade.visibleBelowDiscHeightShare),
    0,
    1,
  );
}

// The planetary system fades in with the camera's distance over the body's
// own orbit extent: hidden while the body's orbit fills the view, opaque
// once the camera stands well outside it.
export function planetarySystemOpacity(fade, distanceOverOrbitExtent) {
  return clamp(
    (distanceOverOrbitExtent - fade.hiddenBelowDistanceOverOrbitExtent) /
      (fade.visibleAboveDistanceOverOrbitExtent -
        fade.hiddenBelowDistanceOverOrbitExtent),
    0,
    1,
  );
}

// The Sun marker fades in as the Sun sprite's projected diameter falls
// below the marker's size, the same crossfade as the body's own marker.
export function sunMarkerOpacity(sunMarker, spriteDiameter) {
  if (!Number.isFinite(spriteDiameter)) return 0;
  return clamp(
    (sunMarker.fadeStartSpritePixels - spriteDiameter) /
      (sunMarker.fadeStartSpritePixels - sunMarker.fullSpritePixels),
    0,
    1,
  );
}

export function createPerspectiveDolly({
  cameraPlan,
  heliocentric,
  cameraElement,
  sceneElement,
  skyElement,
  stage,
}) {
  validatePerspectiveCameraPlan(cameraPlan);
  const plan = heliocentric?.plan;
  if (!plan?.units || !(plan.units.bodyRadiusUnits > 0) ||
      !(plan.units.kilometersPerUnit > 0) ||
      !(plan.orbit?.maximumExtentUnits > 0) ||
      !cameraElement?.style || !sceneElement?.style || !skyElement ||
      !heliocentric.sunRoot?.style || !stage) {
    throw new TypeError("Perspective dolly requires the mounted heliocentric view.");
  }
  const levelOfDetail = cameraPlan.levelOfDetail;
  const bodyRadius = plan.units.bodyRadiusUnits;
  const kilometersPerUnit = plan.units.kilometersPerUnit;
  // The planetary system, when the plan carries it and the camera plan opts
  // in: the dolly reaches the whole system, and the system fades in.
  const system = plan.system ?? null;
  const systemFade = system !== null ? cameraPlan.planetarySystem ?? null : null;
  const sunMarker = system !== null ? cameraPlan.sunMarker ?? null : null;
  if (system !== null && (typeof heliocentric.setSystemOpacity !== "function" ||
      typeof heliocentric.setSunMarkerOpacity !== "function")) {
    throw new TypeError("Perspective dolly requires the mounted planetary system.");
  }
  const maximumDistance = system !== null &&
      cameraPlan.dolly.maximumDistanceOverSystemExtent !== undefined
    ? cameraPlan.dolly.maximumDistanceOverSystemExtent * system.maximumExtentUnits
    : cameraPlan.dolly.maximumDistanceOverOrbitExtent * plan.orbit.maximumExtentUnits;
  // Object packages own their prepared perspective as data; the roots are
  // never scaled, so the same eye serves the Sun's root and the body's.
  for (const root of [cameraElement, heliocentric.sunRoot]) {
    root.style.perspective = cameraPlan.projection.cssPerspective;
  }
  const cameraState = {
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    distance: 0,
  };
  // The zoom alias last set, while the distance still corresponds to it: the
  // alias round trip through the focal length is exact only to floating
  // point, and a camera state set by zoom reads back the same number.
  let aliasZoom = null;
  let aliasDistance = null;
  let focal = 0;
  let viewportWidth = 1;
  let viewportHeight = 1;
  // The eye sits at the sky's vanishing point; the shell lays the body's root
  // out beside its chrome, so the body is viewed slightly off-axis. The
  // offset is the principal point relative to the root's centre.
  let principalOffset = Object.freeze([0, 0]);
  // The stage's rectangle relative to the root's centre: what is actually on
  // screen when the shell lays the root out partly beyond the stage.
  let visibleRect = null;
  let projection = null;
  let lod = levelOfDetailFor(levelOfDetail, Number.POSITIVE_INFINITY);
  let systemOpacity = 0;
  let sunMarkerOpacityValue = 0;
  let publishedSceneTransform = null;
  let transformWrites = 0;

  const measure = () => {
    const view = cameraElement.ownerDocument.defaultView;
    const nextFocal = parseFloat(view.getComputedStyle(cameraElement).perspective);
    const bounds = cameraElement.getBoundingClientRect();
    if (!(nextFocal > 0) || !(bounds.width > 0) || !(bounds.height > 0)) {
      throw new Error("Perspective camera root has no projection.");
    }
    focal = nextFocal;
    viewportWidth = bounds.width;
    viewportHeight = bounds.height;
    const skyBounds = skyElement.getBoundingClientRect();
    const [skyOriginX, skyOriginY] = view.getComputedStyle(skyElement)
      .perspectiveOrigin.split(" ").map(parseFloat);
    principalOffset = Object.freeze([
      skyBounds.x + skyOriginX - (bounds.x + bounds.width / 2),
      skyBounds.y + skyOriginY - (bounds.y + bounds.height / 2),
    ].map((value) => Number.isFinite(value) ? value : 0));
    const stageBounds = stage.getBoundingClientRect();
    const rootCentre = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
    const candidate = {
      left: Math.max(stageBounds.x, bounds.x) - rootCentre[0],
      top: Math.max(stageBounds.y, bounds.y) - rootCentre[1],
      right: Math.min(stageBounds.x + stageBounds.width, bounds.x + bounds.width) - rootCentre[0],
      bottom: Math.min(stageBounds.y + stageBounds.height, bounds.y + bounds.height) - rootCentre[1],
    };
    visibleRect = candidate.right > candidate.left && candidate.bottom > candidate.top
      ? Object.freeze(candidate) : null;
    const origin = `calc(50% + ${formatNumber(principalOffset[0])}px) ` +
      `calc(50% + ${formatNumber(principalOffset[1])}px)`;
    cameraElement.style.perspectiveOrigin = origin;
    heliocentric.sunRoot.style.perspectiveOrigin = origin;
  };
  const zoomToDistance = (zoom) => distanceForSilhouetteRadius(
    bodyRadius,
    focal,
    Math.max(1e-6, zoom / cameraPlan.defaultZoom * cameraPlan.logicalBodyDiameter / 2),
    principalOffset,
  );
  // The round trip through the distance is exact only to floating point;
  // the alias reports the prepared bound itself at the bound.
  const distanceToZoom = (distance) => {
    const zoom = silhouetteRadiusAtDistance(bodyRadius, focal, distance, principalOffset) *
      2 / cameraPlan.logicalBodyDiameter * cameraPlan.defaultZoom;
    return Math.abs(zoom - cameraPlan.maximumZoom) < 1e-9 ? cameraPlan.maximumZoom : zoom;
  };
  const minimumDistance = () => Math.max(
    cameraPlan.dolly.minimumDistanceRadii * bodyRadius,
    zoomToDistance(cameraPlan.maximumZoom),
  );
  const clampDistance = (distance) =>
    clamp(distance, minimumDistance(), maximumDistance);
  measure();
  // The prepared default framing until the responsive fit is selected: the
  // camera is never inside the body, even before its first publication.
  cameraState.distance = clampDistance(zoomToDistance(cameraPlan.defaultZoom));

  const camera = Object.freeze({
    get state() {
      return Object.freeze({
        rotX: cameraState.rotX,
        rotY: cameraState.rotY,
        distance: cameraState.distance,
        zoom: aliasZoom !== null && cameraState.distance === aliasDistance
          ? aliasZoom
          : distanceToZoom(cameraState.distance),
      });
    },
    update(partial) {
      if (partial.rotX !== undefined) cameraState.rotX = partial.rotX;
      if (partial.rotY !== undefined) cameraState.rotY = partial.rotY;
      if (partial.distanceKilometers !== undefined) {
        cameraState.distance = clampDistance(partial.distanceKilometers / kilometersPerUnit);
      } else if (partial.distance !== undefined) {
        cameraState.distance = clampDistance(partial.distance);
      } else if (partial.zoom !== undefined) {
        const requested = zoomToDistance(partial.zoom);
        cameraState.distance = clampDistance(requested);
        aliasZoom = cameraState.distance === requested ? partial.zoom : null;
        aliasDistance = cameraState.distance;
      }
    },
  });

  return Object.freeze({
    camera,
    measure,
    // The alias bounds: the prepared close framing and the whole-orbit dolly
    // distance seen through the same alias.
    minimumZoom: () => distanceToZoom(maximumDistance),
    maximumZoom: () => cameraPlan.maximumZoom,
    // Re-clamps the distance after the viewport (and so the focal length)
    // changed.
    reclamp() {
      camera.update({ distance: cameraState.distance });
    },
    // Re-measures the projection and keeps the framing: the zoom alias (the
    // silhouette's size on screen) survives a viewport or layout change the
    // way the scale camera's zoom does, so the distance follows the focal
    // length (clamped to the prepared bounds).
    remeasure() {
      const zoom = camera.state.zoom;
      measure();
      camera.update({ zoom });
    },
    // Projects the Sun, the orbit and the body for the accumulated scene
    // rotation and places the body: its centre `distance` from the eye on the
    // line that projects to the root's centre, then the rotation. The scene
    // scale must be uniform in three dimensions: a 2D scale() leaves the
    // body's depth unscaled, which a real perspective camera notices.
    publish(sceneMatrix, scenePresentation) {
      const distance = cameraState.distance;
      // The system's visibility depends on the distance alone, so it is set
      // before the projection decides whether to work on the system.
      if (system !== null) {
        systemOpacity = systemFade === null
          ? 1
          : planetarySystemOpacity(systemFade, distance / plan.orbit.maximumExtentUnits);
        heliocentric.setSystemOpacity(systemOpacity);
      }
      projection = heliocentric.publish({
        rotation: rotationFromMatrix3d(sceneMatrix),
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        visibleRect,
      });
      const [bodyX, bodyY, bodyZ] = projection.body.translate;
      const transform =
        `translate3d(${formatNumber(bodyX)}px, ${formatNumber(bodyY)}px, ` +
        `${formatNumber(bodyZ)}px) ` +
        `scale3d(${cameraPlan.sceneScale}, ${cameraPlan.sceneScale}, ` +
        `${cameraPlan.sceneScale}) ${scenePresentation}`;
      if (transform !== publishedSceneTransform) {
        sceneElement.style.transform = transform;
        publishedSceneTransform = transform;
        transformWrites += 1;
      }
      heliocentric.setOrbitOpacity(orbitLineOpacity(
        cameraPlan.orbitLineFade,
        projection.body.silhouetteDiameter / viewportHeight,
      ));
      lod = levelOfDetailFor(levelOfDetail, projection.body.silhouetteDiameter);
      heliocentric.setMarkerOpacity(lod.markerOpacity);
      if (system !== null) {
        sunMarkerOpacityValue = sunMarker === null
          ? 0
          : sunMarkerOpacity(sunMarker, projection.sun.spriteDiameter);
        heliocentric.setSunMarkerOpacity(sunMarkerOpacityValue);
      }
      return Object.freeze({
        distance,
        focal,
        viewportWidth,
        viewportHeight,
        principalOffset,
        body: projection.body,
        sun: projection.sun,
        levelOfDetail: lod,
        ...(system === null ? {} : {
          planetarySystem: Object.freeze({
            opacity: systemOpacity,
            sunMarkerOpacity: sunMarkerOpacityValue,
            projected: projection.system !== null,
          }),
        }),
      });
    },
    // The drag trackball: the projected silhouette. A small body still orbits
    // comfortably: the trackball never shrinks below a fifth of the
    // viewport's short side, and the sphere the drag rides is that disc.
    trackball() {
      const bounds = cameraElement.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const silhouette = projection?.body.silhouette;
      const centerX = bounds.x + bounds.width / 2 + (silhouette?.centre[0] ?? 0);
      const centerY = bounds.y + bounds.height / 2 + (silhouette?.centre[1] ?? 0);
      const radius = Math.max(
        projection?.body.silhouetteRadius ?? bodyRadius,
        Math.min(viewportWidth, viewportHeight) / 5,
      );
      return Object.freeze({
        centerX,
        centerY,
        opticalCenterX: bounds.x + bounds.width / 2 + principalOffset[0],
        opticalCenterY: bounds.y + bounds.height / 2 + principalOffset[1],
        radius,
        surfaceRadius: radius,
        focalLength: focal,
        viewportWidth: stageBounds.width,
        viewportCenterX: (stageBounds.left ?? 0) + stageBounds.width / 2,
        viewportCenterY: (stageBounds.top ?? 0) + stageBounds.height / 2,
        // Pointer samples are re-based to the centre: tumble everywhere.
        tumbleOnly: cameraPlan.drag?.model === "screen-axis-tumble",
      });
    },
    state() {
      return Object.freeze({
        distance: cameraState.distance,
        distanceKilometers: cameraState.distance * kilometersPerUnit,
        distanceRadii: cameraState.distance / bodyRadius,
        focal,
        principalOffset,
        visibleRect,
        offAxisDegrees: projection?.body.offAxisDegrees ?? null,
        silhouetteRadius: projection?.body.silhouetteRadius ?? null,
      });
    },
    levelOfDetail: () => lod,
    planetarySystem: () => system === null ? null : Object.freeze({
      opacity: systemOpacity,
      sunMarkerOpacity: sunMarkerOpacityValue,
    }),
    stats({ wheelDollies = 0 } = {}) {
      return Object.freeze({
        projection: cameraPlan.projection,
        dolly: Object.freeze({
          ...cameraPlan.dolly,
          minimumDistance: minimumDistance(),
          maximumDistance,
          minimumDistanceKilometers: minimumDistance() * kilometersPerUnit,
          maximumDistanceKilometers: maximumDistance * kilometersPerUnit,
          maximumDistanceOverOrbitExtentEffective: maximumDistance / plan.orbit.maximumExtentUnits,
          // The wheel is multiplicative: the whole range in log-distance,
          // and the mouse notches (100 delta units each) it takes end to end.
          logDistanceRange: Math.log(maximumDistance / minimumDistance()),
          wheelNotchesEndToEnd: Math.log(maximumDistance / minimumDistance()) /
            (cameraPlan.dolly.wheelStepPerDelta * 100),
          wheelDollies,
        }),
        levelOfDetail,
        orbitLineFade: cameraPlan.orbitLineFade,
        drag: cameraPlan.drag ?? null,
        // Nothing on any input path clamps the pitch or the yaw; the
        // control pitch anchors only calibrate the control-to-scene map.
        rotationBounds: "none",
        planetarySystem: system === null ? null : Object.freeze({
          fade: systemFade,
          sunMarker,
          bodyCount: system.bodies.length,
          maximumExtentUnits: system.maximumExtentUnits,
          maximumExtentKilometers: system.maximumExtentUnits * kilometersPerUnit,
        }),
        sceneTransformWrites: transformWrites,
      });
    },
  });
}

function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
