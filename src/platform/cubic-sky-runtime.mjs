import { createPreparedCameraPublisher, preparedCameraZoomScale } from "./prepared-camera-runtime.mjs";
import {
  BASE_TILE,
  createPolyCamera,
} from "@layoutit/polycss";

import {
  bindResponsiveOrbitPolicy,
  isOrbitDragStart,
  MOBILE_VIEWPORT_QUERY,
} from "../../site/runtime-policy.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import {
  validatePreparedCubicSky,
} from "./cubic-sky-contract.mjs";
import {
  projectSphereDrag,
  composeDragRotation,
  rotationFromAngularVelocity,
} from "./sphere-drag.mjs";
import { rotationAxisAngle, sampleDestinationFlight } from "./destination-flight.mjs";
import { cssDirectionToViewDirection } from "./solar-view-direction.mjs";
import { createPerspectiveDolly } from "./perspective-dolly.mjs";

import {
  viewSunDirectionToPhysicalLightDirection,
  viewSunDirectionToPreparedLightDirection,
} from "./directional-sun-coordinate.mjs";
import { validateDirectionalSunPlan } from
  "./directional-sun-contract.mjs";
import {
  advanceGoogleEarthDragThrow,
  createGoogleEarthDragHistory,
  estimateGoogleEarthDragThrow,
  GOOGLE_EARTH_DRAG_INERTIA,
  googleEarthDirectAngularDegreesPerTrackballRadius,
  googleEarthInteractionTrackball,
  directPitchResponseForZoom,
  projectGoogleEarthTrackballDelta,
  recordGoogleEarthDragSample,
  resetGoogleEarthDragHistory,
} from "./google-earth-drag-inertia.mjs";
import {
  GOOGLE_EARTH_SURFACE_FLY_TO,
  planGoogleEarthSurfaceFlyTo,
  sampleGoogleEarthSurfaceFlyTo,
} from "./google-earth-surface-fly-to.mjs";
import { createPreparedWheelZoomControls } from "./prepared-wheel-zoom.mjs";

const POINTER_POSITION_EPSILON = 1e-6;

export function mountRetainedCubicSky({
  host,
  plan,
  imageDensity,
  objectId,
  requireSun = true,
}) {
  validatePreparedCubicSky(plan, { requireSun });
  if (!(host instanceof HTMLElement) || ![1, 2].includes(imageDensity) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId)) {
    throw new TypeError("Retained cubic sky mount arguments are invalid.");
  }
  const root = document.createElement("div");
  root.className = `planet-cubic-sky ${objectId}-skybox`;
  root.ariaHidden = "true";
  if (plan.projection?.cssPerspective) {
    root.style.setProperty(
      "--planet-cubic-sky-camera-distance",
      plan.projection.cssPerspective,
    );
  }
  const cube = document.createElement("div");
  cube.className = `planet-cubic-sky-cube ${objectId}-skybox-cube`;
  const orientation = document.createElement("div");
  orientation.className =
    `planet-cubic-sky-orientation ${objectId}-skybox-orientation`;
  for (const face of plan.faces) {
    const element = document.createElement("div");
    element.className =
      `planet-cubic-sky-face planet-cubic-sky-${face.id} ` +
      `${objectId}-skybox-face ${objectId}-skybox-${face.id}`;
    const selectedUrl = imageDensity === 2 ? face.url2x : face.url;
    const selectedHighContrastUrl = imageDensity === 2
      ? face.highContrastUrl2x
      : face.highContrastUrl;
    element.style.setProperty(
      "--planet-cubic-sky-standard-image",
      `url("${selectedUrl}")`,
    );
    element.style.setProperty(
      "--planet-cubic-sky-high-contrast-image",
      `url("${selectedHighContrastUrl}")`,
    );
    orientation.appendChild(element);
  }
  // Catalogue stars (opt-in, see prepare-catalogue-stars.mjs): the retained
  // band as points just inside the faces, each placed by its prepared cube
  // transform, sized by a scale the root's size sets (a point at 0.99 of the
  // half side appears at perspective / (0.99 half side) of its CSS size),
  // coloured and dimmed by the chain's luminance. Retained once; the
  // orientation's matrix carries them with the faces.
  let starGroup = null;
  let starResizeObserver = null;
  const stars = plan.catalogueStars ?? null;
  if (stars !== null) {
    starGroup = document.createElement("div");
    starGroup.className = `planet-cubic-sky-stars ${objectId}-skybox-stars`;
    for (const star of stars.retained) {
      const element = document.createElement("s");
      element.className = `planet-cubic-sky-star planet-cubic-sky-star-${star.band}`;
      element.style.setProperty("--planet-cubic-sky-star-radius", `${star.radiusPx}px`);
      element.style.backgroundColor = `rgb(${star.color[0]}, ${star.color[1]}, ${star.color[2]})`;
      element.style.opacity = String(star.luminance);
      element.style.transform = star.transform;
      if (star.name) element.dataset.name = star.name;
      element.dataset.magnitude = String(star.magnitude);
      element.dataset.direction = star.direction.join(",");
      starGroup.appendChild(element);
    }
    orientation.appendChild(starGroup);
  }
  cube.appendChild(orientation);
  root.appendChild(cube);
  host.prepend(root);
  const measureStarScale = () => {
    if (starGroup === null) return;
    const view = root.ownerDocument.defaultView;
    const perspective = parseFloat(view.getComputedStyle(root).perspective);
    const halfSide = Math.max(root.clientWidth, root.clientHeight);
    if (!(perspective > 0) || !(halfSide > 0)) return;
    const scale = perspective / (stars.retainedRadiusShareOfHalfSide * halfSide);
    starGroup.style.setProperty("--planet-cubic-sky-star-scale", scale.toFixed(5));
  };
  measureStarScale();
  if (starGroup !== null && typeof ResizeObserver === "function") {
    starResizeObserver = new ResizeObserver(() => measureStarScale());
    starResizeObserver.observe(root);
  }
  let publishedMatrix = null;
  let publishedZoomScale = null;
  return Object.freeze({
    root,
    cube,
    orientation,
    starGroup,
    retainedStarCount: starGroup === null ? 0 : starGroup.childElementCount,
    catalogueStars: stars === null ? null : Object.freeze({
      limitingMagnitude: stars.limitingMagnitude, count: stars.count, photographicCount: stars.photographicCount,
      retainedCount: stars.retainedCount, bands: stars.bands, coexistence: stars.coexistence,
    }),
    faceCount: orientation.querySelectorAll(".planet-cubic-sky-face").length,
    setOrientation({ matrix, zoom, defaultZoom }) {
      if (typeof matrix !== "string" || !Number.isFinite(zoom) ||
          !Number.isFinite(defaultZoom) || defaultZoom <= 0) {
        throw new TypeError("Retained cubic sky camera publication is invalid.");
      }
      if (matrix !== publishedMatrix) {
        orientation.style.transform = matrix;
        cube.style.setProperty(`--${objectId}-skybox-orientation`, matrix);
        publishedMatrix = matrix;
      }
      const zoomScale = 1 + plan.cameraZoomResponse *
        (zoom / defaultZoom - 1);
      if (zoomScale !== publishedZoomScale) {
        root.style.setProperty("--planet-cubic-sky-zoom", String(zoomScale));
        root.style.setProperty(`--${objectId}-skybox-zoom`, String(zoomScale));
        publishedZoomScale = zoomScale;
      }
    },
    destroy() {
      starResizeObserver?.disconnect();
      root.remove();
    },
  });
}

export function createCubicSkyCameraOrientation({
  controlPitch,
  controlYaw,
  cameraPlan,
  skyPlan,
  requireSun = true,
  sunDirection = skyPlan?.sun?.localDirection ?? null,
  sunReferenceViewDirection = null,
  // An observed Sun direction is fixed in the body-fixed frame, so it has to
  // ride the scene matrix exactly like the body does. The reference-view path
  // instead carries its own pitch response and inverted yaw, which is a
  // presentation choice and drifts away from the terminator as the camera
  // moves. Objects with prepared solar geometry opt into the physical path.
  sunTracksScene = false,
  // The stars are as far away as the Sun, so under camera rotation they must
  // cross the screen exactly like it: the sky then rides the scene matrix
  // through a prepared registration (`skyPlan.sceneRegistration`, the cube's
  // orientation in the scene frame) instead of the presentation sky response
  // (inverted yaw, scaled pitch) the standard objects keep. Every camera path
  // (reset, drag, flight, rebase, restore) derives the sky from the scene.
  skyTracksScene = false,
}) {
  validatePreparedCubicSky(skyPlan, { requireSun });
  const skyRegistration = skyTracksScene
    ? parseSceneRegistration(skyPlan.sceneRegistration)
    : null;
  if (sunTracksScene && sunDirection === null) {
    throw new TypeError("A scene-tracking Sun requires its local direction.");
  }
  if (sunDirection !== null && (
    !Array.isArray(sunDirection) || sunDirection.length !== 3 ||
    sunDirection.some((component) => !Number.isFinite(component)) ||
    Math.abs(Math.hypot(...sunDirection) - 1) > 1e-9
  )) {
    throw new TypeError("Cubic-sky Sun direction is invalid.");
  }
  if (sunReferenceViewDirection !== null && (
    !Array.isArray(sunReferenceViewDirection) ||
    sunReferenceViewDirection.length !== 3 ||
    sunReferenceViewDirection.some((component) =>
      !Number.isFinite(component)) ||
    Math.abs(Math.hypot(...sunReferenceViewDirection) - 1) > 1e-9
  )) {
    throw new TypeError("Cubic-sky Sun reference view direction is invalid.");
  }
  const referenceSceneMatrix = createSceneMatrix(
    cameraPlan.materialReferenceControlPitchDegrees ?? controlPitch,
    cameraPlan.materialReferenceControlYawDegrees ?? controlYaw,
    cameraPlan,
  );
  let sceneMatrix;
  let skyboxMatrix;
  let sunViewMatrix;
  let scenePresentation = null;
  let skyboxPresentation = null;
  let counterMatrix = null;
  let billboardCounterMatrix = null;
  const counterPresentations = new Map();
  const billboardCounterPresentations = new Map();
  const invalidatePresentations = () => {
    scenePresentation = null;
    skyboxPresentation = null;
    counterMatrix = null;
    billboardCounterMatrix = null;
    counterPresentations.clear();
    billboardCounterPresentations.clear();
  };
  // The sky cube's orientation: locked to the scene through the prepared
  // registration, or the presentation sky's own accumulated matrix.
  const currentSkyboxMatrix = () => skyRegistration
    ? sceneMatrix.multiply(skyRegistration)
    : skyboxMatrix;
  const reset = ({ controlPitch: nextPitch, controlYaw: nextYaw }) => {
    const renderedPitch = preparedScenePitch(nextPitch, cameraPlan);
    const skyboxPitch = cameraPlan.initialScenePitchDegrees +
      skyPlan.cameraPitchResponse *
        (renderedPitch - cameraPlan.initialScenePitchDegrees);
    sceneMatrix = createSceneMatrix(nextPitch, nextYaw, cameraPlan);
    const resetSkyboxMatrix = new DOMMatrix()
      .rotateAxisAngle(
        1,
        0,
        0,
        skyboxPitch + skyPlan.presentationPitchOffsetDegrees,
      )
      .rotateAxisAngle(0, 0, 1, skyPlan.presentationYawOffsetDegrees);
    skyboxMatrix = new DOMMatrix()
      .rotateAxisAngle(0, 1, 0, -nextYaw)
      .multiply(resetSkyboxMatrix);
    sunViewMatrix = new DOMMatrix()
      .rotateAxisAngle(
        1,
        0,
        0,
        (renderedPitch - cameraPlan.initialScenePitchDegrees) *
          skyPlan.cameraPitchResponse,
      )
      .rotateAxisAngle(
        0,
        1,
        0,
        -(nextYaw - cameraPlan.defaultControlYawDegrees),
      );
    invalidatePresentations();
  };
  reset({ controlPitch, controlYaw });
  return Object.freeze({
    reset,
    rebaseScene(change) {
      sceneMatrix = sceneMatrix.multiply(change);
      invalidatePresentations();
    },
    prepareFlight(target) {
      const from = [sceneMatrix, skyboxMatrix, sunViewMatrix];
      reset(target);
      const to = [sceneMatrix, skyboxMatrix, sunViewMatrix];
      [sceneMatrix, skyboxMatrix, sunViewMatrix] = from;
      invalidatePresentations();
      const rotations = to.map((matrix, i) => rotationAxisAngle(matrix.multiply(from[i].inverse())));
      return Object.freeze({
        angularDistance: rotations[0].degrees,
        sample(progress) {
          const matrices = rotations.map(({ axis, degrees }, i) => progress === 0 ? from[i]
            : progress === 1 ? to[i]
            : new DOMMatrix().rotateAxisAngle(...axis, degrees * progress).multiply(from[i]));
          [sceneMatrix, skyboxMatrix, sunViewMatrix] = matrices;
          invalidatePresentations();
        },
      });
    },
    snapshot() {
      return Object.freeze({
        schema: "cssearth-camera-pose@1",
        scene: formatMatrix3d(sceneMatrix),
        skybox: formatMatrix3d(currentSkyboxMatrix()),
        sunView: formatMatrix3d(sunViewMatrix),
      });
    },
    restore(snapshot) {
      if (snapshot?.schema !== "cssearth-camera-pose@1") {
        throw new TypeError("Cubic-sky camera pose is invalid.");
      }
      sceneMatrix = parseCameraPoseMatrix(snapshot.scene, "scene");
      skyboxMatrix = parseCameraPoseMatrix(snapshot.skybox, "skybox");
      sunViewMatrix = parseCameraPoseMatrix(snapshot.sunView, "sun view");
      invalidatePresentations();
    },
    rotate({ renderedPitchDelta, yawDelta, rotation }) {
      if (rotation) {
        sceneMatrix = dragRotationMatrix(rotation).multiply(sceneMatrix);
        // The background uses the opposite X/Y view axes; Z stays coupled.
        const viewDelta = dragRotationMatrix([
          rotation[0] * skyPlan.cameraPitchResponse,
          -rotation[1],
          -rotation[2] * skyPlan.cameraPitchResponse,
          rotation[3],
        ]);
        skyboxMatrix = viewDelta.multiply(skyboxMatrix);
        sunViewMatrix = viewDelta.multiply(sunViewMatrix);
        invalidatePresentations();
        return;
      }

      sceneMatrix = new DOMMatrix()
        .rotateAxisAngle(1, 0, 0, renderedPitchDelta)
        .rotateAxisAngle(0, 1, 0, yawDelta)
        .multiply(sceneMatrix);
      skyboxMatrix = new DOMMatrix()
        .rotateAxisAngle(
          1,
          0,
          0,
          renderedPitchDelta * skyPlan.cameraPitchResponse,
        )
        .rotateAxisAngle(0, 1, 0, -yawDelta)
        .multiply(skyboxMatrix);
      sunViewMatrix = new DOMMatrix()
        .rotateAxisAngle(
          1,
          0,
          0,
          renderedPitchDelta * skyPlan.cameraPitchResponse,
        )
        .rotateAxisAngle(0, 1, 0, -yawDelta)
        .multiply(sunViewMatrix);
      invalidatePresentations();
    },
    scene() {
      scenePresentation ??= formatMatrix3d(sceneMatrix);
      return scenePresentation;
    },
    // The accumulated scene rotation itself, for consumers that project
    // scene-frame geometry with the same camera in JavaScript.
    sceneMatrix() {
      return sceneMatrix;
    },
    counterRotation(localMatrix = null) {
      if (counterPresentations.has(localMatrix)) {
        return counterPresentations.get(localMatrix);
      }
      counterMatrix ??= sceneMatrix.inverse().multiply(referenceSceneMatrix);
      if (localMatrix === null) {
        const presentation = formatMatrix3d(counterMatrix);
        counterPresentations.set(null, presentation);
        return presentation;
      }
      const local = typeof localMatrix === "string"
        ? new DOMMatrix(localMatrix)
        : localMatrix;
      if (!(local instanceof DOMMatrix)) {
        throw new TypeError("Cubic-sky local counter basis is invalid.");
      }
      const presentation = formatMatrix3d(
        local.inverse().multiply(counterMatrix).multiply(local),
      );
      counterPresentations.set(localMatrix, presentation);
      return presentation;
    },
    billboardCounterRotation(localMatrix = null) {
      if (billboardCounterPresentations.has(localMatrix)) {
        return billboardCounterPresentations.get(localMatrix);
      }
      scenePresentation ??= formatMatrix3d(sceneMatrix);
      billboardCounterMatrix ??= new DOMMatrix(
        `scale(${cameraPlan.sceneScale}) ${scenePresentation}`,
      ).inverse();
      if (localMatrix === null) {
        const presentation = formatMatrix3d(billboardCounterMatrix);
        billboardCounterPresentations.set(null, presentation);
        return presentation;
      }
      const local = typeof localMatrix === "string"
        ? new DOMMatrix(localMatrix)
        : localMatrix;
      if (!(local instanceof DOMMatrix)) {
        throw new TypeError("Cubic-sky billboard counter basis is invalid.");
      }
      const presentation = formatMatrix3d(
        local.inverse().multiply(billboardCounterMatrix),
      );
      billboardCounterPresentations.set(localMatrix, presentation);
      return presentation;
    },
    skybox() {
      if (skyboxPresentation !== null) return skyboxPresentation;
      const sunViewDirection = sunTracksScene
        ? Object.freeze(cssDirectionToViewDirection(
          transformDirection(sceneMatrix, sunDirection),
        ))
        : sunReferenceViewDirection
          ? Object.freeze(transformDirection(
            sunViewMatrix,
            sunReferenceViewDirection,
          ))
          : sunDirection
            ? Object.freeze(transformDirection(
              skyboxMatrix,
              sunDirection,
            ))
            : null;
      skyboxPresentation = Object.freeze({
        matrix: formatMatrix3d(currentSkyboxMatrix()),
        sunViewDirection,
      });
      return skyboxPresentation;
    },
  });
}

export function createUnboundedMatrixDragControls({
  inputSurface,
  trackballMetrics,
  flyToTrackballMetrics = trackballMetrics,
  rotate,
  surfaceFlyToState = null,
  onPointerStart = () => {},
  onStart = () => {},
  onEnd = () => {},
  onError = null,
}) {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof trackballMetrics !== "function" ||
      typeof flyToTrackballMetrics !== "function" ||
      typeof rotate !== "function" ||
      (surfaceFlyToState !== null &&
        typeof surfaceFlyToState !== "function") ||
      typeof onPointerStart !== "function" ||
      typeof onStart !== "function" || typeof onEnd !== "function" ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Unbounded matrix drag controls are invalid.");
  }
  const lifetime = createSceneLifetime();
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) {
      if (onError === null) throw error;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length
        ? new AggregateError([error, ...cleanupErrors], error.message, { cause: error }) : error);
    }
  };
  let drag = true;
  let wheel = true;
  let pointerId = null;
  let pointerDragging = false;
  let previousX = 0;
  let previousY = 0;
  let accumulatedPitch = 0;
  let accumulatedYaw = 0;
  let activeTrackball = null;
  let trackballInvalidated = false;
  let previousPointerTimestamp = null;
  let cadenceFrame = null;
  let previousCadenceTimestamp = null;
  let frameMilliseconds = 1000 / 60;
  const history = createGoogleEarthDragHistory();
  let inertiaFrame = null;
  let inertiaState = null;
  let interactionActive = false;
  let activeMode = "idle";
  let inertiaStarts = 0;
  let inertiaFrames = 0;
  let inertiaCancels = 0;
  let pointerCancels = 0;
  let flyToFrame = null;
  let flyToMotion = null;
  let flyToStarts = 0;
  let flyToFrames = 0;
  let flyToCompletions = 0;
  let flyToCancels = 0;
  const destinationFlight = { starts: 0, frames: 0, completions: 0, cancels: 0 };

  const interruptionCounts = {
    drag: 0,
    pointer: 0,
    wheel: 0,
    "fly-to": 0,
    programmatic: 0,
    disabled: 0,
    destroy: 0,
  };
  let lastInterruption = null;
  const windowTarget = inputSurface.ownerDocument.defaultView;
  const requestFrame = (callback) => windowTarget.requestAnimationFrame(guardNative(callback));
  const cancelFrame = windowTarget.cancelAnimationFrame.bind(windowTarget);
  let pendingDrag = null;
  const flushPendingDrag = () => {
    if (pendingDrag === null) return;
    const update = pendingDrag;
    pendingDrag = null;
    rotate(update);
  };
  const cancelCadence = () => {
    if (cadenceFrame !== null) cancelFrame(cadenceFrame);
    cadenceFrame = null;
    previousCadenceTimestamp = null;
  };
  const measureCadence = timestamp => {
    if (previousCadenceTimestamp !== null && timestamp > previousCadenceTimestamp) {
      frameMilliseconds = timestamp - previousCadenceTimestamp;
    }
    previousCadenceTimestamp = timestamp;
    flushPendingDrag();
    if (lifetime.disposed) return;
    cadenceFrame = requestFrame(measureCadence);
  };
  const syncCursor = () => {
    if (lifetime.disposed) return;
    inputSurface.style.cursor = drag ? "grab" : "";
  };
  const finishInteraction = () => {
    if (!interactionActive) return;
    interactionActive = false;
    activeMode = "idle";
    onEnd();
  };
  const cancelInertia = () => {
    if (inertiaFrame === null) return;
    cancelFrame(inertiaFrame);
    inertiaFrame = null;
    inertiaState = null;
    inertiaCancels += 1;
  };
  const cancelFlyTo = () => {
    if (flyToFrame === null) return;
    cancelFrame(flyToFrame);
    const motion = flyToMotion;
    flyToFrame = null;
    flyToMotion = null;
    if (motion?.sample) { destinationFlight.cancels++; motion.finish(false); }
    else flyToCancels += 1;
  };
  const cancelPointer = () => {
    pendingDrag = null;
    cancelCadence();
    if (pointerId === null) return;
    const activePointerId = pointerId;
    pointerId = null;
    pointerDragging = false;
    resetGoogleEarthDragHistory(history);
    activeTrackball = null;
    if (inputSurface.hasPointerCapture(activePointerId)) {
      inputSurface.releasePointerCapture(activePointerId);
    }
    pointerCancels += 1;
    syncCursor();
  };
  const interruptMotion = (nextMode) => {
    const previousMode = activeMode;
    const hadActivity = previousMode !== "idle" || pointerId !== null;
    if (!hadActivity) return false;
    cancelInertia();
    cancelFlyTo();
    cancelPointer();
    finishInteraction();
    if (previousMode !== "idle") {
      interruptionCounts[nextMode] += 1;
      lastInterruption = Object.freeze({
        from: previousMode,
        to: nextMode,
      });
    }
    return true;
  };
  const replaceCameraMotion = (nextMode) => {
    const previousMode = activeMode;
    if (previousMode === "inertia") cancelInertia();
    if (previousMode === "fly-to") cancelFlyTo();
    if (previousMode !== "idle" && previousMode !== nextMode) {
      interruptionCounts[nextMode] += 1;
      lastInterruption = Object.freeze({
        from: previousMode,
        to: nextMode,
      });
    }
    activeMode = nextMode;
    return previousMode;
  };
  const animateFlyTo = (timestamp) => {
    if (flyToMotion === null) return;
    if (flyToMotion.startedAt === null) flyToMotion.startedAt = timestamp;
    if (flyToMotion.sample) {
      const motion = flyToMotion;
      const progress = Math.min(1, Math.max(0, timestamp - motion.startedAt) / motion.durationMilliseconds);
      motion.sample(progress);
      if (lifetime.disposed || flyToMotion !== motion) return;
      destinationFlight.frames++;
      if (progress < 1) flyToFrame = requestFrame(animateFlyTo);
      else {
        flyToFrame = null;
        flyToMotion = null;
        destinationFlight.completions++;
        motion.finish(true);
        finishInteraction();
      }
      return;
    }

    const progress = Math.min(
      1,
      Math.max(0, timestamp - flyToMotion.startedAt) /
        GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds,
    );
    const sample = sampleGoogleEarthSurfaceFlyTo(
      flyToMotion.plan,
      progress,
    );
    const zoom = sample.zoom;
    rotate({
      controlPitchDelta:
        sample.pitchDeltaDegrees - flyToMotion.previousPitchDelta,
      controlYawDelta:
        sample.yawDeltaDegrees - flyToMotion.previousYawDelta,
      zoom,
      rotation: composeDragRotation(
        sample.rotation,
        conjugateRotation(flyToMotion.previousRotation),
      ),
    });
    if (lifetime.disposed) return;
    flyToMotion.previousPitchDelta = sample.pitchDeltaDegrees;
    flyToMotion.previousYawDelta = sample.yawDeltaDegrees;
    flyToMotion.previousRotation = sample.rotation;
    flyToFrames += 1;
    if (!sample.complete) {
      flyToFrame = requestFrame(animateFlyTo);
      return;
    }
    flyToFrame = null;
    flyToMotion = null;
    flyToCompletions += 1;
    finishInteraction();
  };
  let completedDoublePress = null;
  const beginSurfaceFlyTo = (event) => {
    if (!drag || surfaceFlyToState === null || event.button !== 0) return;
    const measuredTrackball = flyToTrackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const cameraState = surfaceFlyToState();
    const plan = planGoogleEarthSurfaceFlyTo({
      clientX: event.clientX,
      clientY: event.clientY,
      trackball: measuredTrackball,
      currentZoom: cameraState?.zoom,
      minimumZoom: cameraState?.minimumZoom,
      maximumZoom: cameraState?.maximumZoom,
    });
    if (plan === null) return false;
    event.preventDefault();
    cancelPointer();
    const wasInteractionActive = interactionActive;
    replaceCameraMotion("fly-to");
    flyToMotion = {
      plan,
      startedAt: null,
      previousPitchDelta: 0,
      previousYawDelta: 0,
      previousRotation: [0, 0, 0, 1],
    };
    flyToStarts += 1;
    if (!wasInteractionActive) {
      interactionActive = true;
      onStart();
    }
    if (lifetime.disposed) return;
    flyToFrame = requestFrame(animateFlyTo);
    return true;
  };
  const onMouseDown = event => {
    if (event.detail !== 2 || event.button !== 0) return;
    // Native Qt starts a flight on the second press. Browser dblclick arrives
    // after its release, so recognize that same press via MouseEvent.detail.
    if (beginSurfaceFlyTo(event)) completedDoublePress = {
      x:event.clientX, y:event.clientY, timestamp:event.timeStamp,
    };
  };
  const onDoubleClick = event => {
    const prior = completedDoublePress;
    completedDoublePress = null;
    if (prior && event.clientX === prior.x && event.clientY === prior.y &&
        event.timeStamp >= prior.timestamp && event.timeStamp - prior.timestamp < 1000) {
      event.preventDefault();
      return;
    }
    beginSurfaceFlyTo(event);
  };
  const animateInertia = (timestamp) => {
    if (inertiaState === null) return;
    const elapsedMilliseconds = Math.max(
      0,
      timestamp - inertiaState.previousTimestamp,
    );
    const step = advanceGoogleEarthDragThrow({
      pitchDegreesPerMillisecond:
        inertiaState.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: inertiaState.yawDegreesPerMillisecond,
      initialSpeedDegreesPerMillisecond:
        inertiaState.initialSpeedDegreesPerMillisecond,
      elapsedMilliseconds,
    });
    inertiaState.previousTimestamp = timestamp;
    inertiaState.pitchDegreesPerMillisecond =
      step.pitchDegreesPerMillisecond;
    inertiaState.yawDegreesPerMillisecond = step.yawDegreesPerMillisecond;
    if (step.pitchDeltaDegrees !== 0 || step.yawDeltaDegrees !== 0) {
      rotate({
        controlPitchDelta: step.pitchDeltaDegrees,
        controlYawDelta: step.yawDeltaDegrees,
        rotation: rotationFromAngularVelocity(
          inertiaState.angularVelocity,
          elapsedMilliseconds * Math.hypot(
            step.pitchDegreesPerMillisecond, step.yawDegreesPerMillisecond,
          ) / inertiaState.initialSpeedDegreesPerMillisecond,
        ),
      });
      if (lifetime.disposed) return;
      inertiaFrames += 1;
    }
    if (step.active) {
      inertiaFrame = requestFrame(animateInertia);
    } else {
      inertiaFrame = null;
      inertiaState = null;
      finishInteraction();
    }
  };
  const startInertia = (throwState, releaseTimestamp, releaseFrameTimestamp) => {
    if (throwState === null) return false;
    // The release frame projects the pointer and advances the first coast
    // step. Compose both rotations before publishing the retained scene.
    const firstStep = advanceGoogleEarthDragThrow({
      ...throwState,
      elapsedMilliseconds: frameMilliseconds,
    });
    rotate({
      rotation: composeDragRotation(
        rotationFromAngularVelocity(throwState.angularVelocity,
          frameMilliseconds * Math.hypot(firstStep.pitchDegreesPerMillisecond,
            firstStep.yawDegreesPerMillisecond) /
              throwState.initialSpeedDegreesPerMillisecond),
        throwState.launchRotation,
      ),
      controlPitchDelta: throwState.pitchDegreesPerMillisecond * frameMilliseconds +
        firstStep.pitchDeltaDegrees,
      controlYawDelta: throwState.yawDegreesPerMillisecond * frameMilliseconds +
        firstStep.yawDeltaDegrees,
    });
    if (lifetime.disposed) return false;
    inertiaState = {
      ...throwState,
      pitchDegreesPerMillisecond: firstStep.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: firstStep.yawDegreesPerMillisecond,
      previousTimestamp: releaseFrameTimestamp ?? releaseTimestamp,
    };
    activeMode = "inertia";
    inertiaStarts += 1;
    inertiaFrame = requestFrame(animateInertia);
    return true;
  };
  const onPointerDown = (event) => {
    if (!drag || pointerId !== null || !isOrbitDragStart(event)) return;
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    // Mouse compatibility events carry the second-press click count. Blocking
    // them here would postpone double-click flights until the final release.
    if (event.pointerType !== "mouse") event.preventDefault();
    onPointerStart();
    if (lifetime.disposed) return;
    interruptMotion("pointer");
    if (lifetime.disposed) return;

    pointerId = event.pointerId;
    pointerDragging = false;
    previousX = event.clientX;
    previousY = event.clientY;
    previousPointerTimestamp = event.timeStamp;
    accumulatedPitch = 0;
    accumulatedYaw = 0;
    pendingDrag = null;
    activeTrackball = measuredTrackball;
    trackballInvalidated = false;
    frameMilliseconds = 1000 / 60;
    cadenceFrame = requestFrame(measureCadence);
    resetGoogleEarthDragHistory(history);
    recordGoogleEarthDragSample(history, {
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      pitch: accumulatedPitch,
      yaw: accumulatedYaw,
    });
    inputSurface.style.cursor = "grabbing";
    inputSurface.setPointerCapture(event.pointerId);
  };
  const applyPointerSamples = (event) => {
    const coalesced = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [];
    const sampleEvents = coalesced.length > 0 ? coalesced : [event];
    let pitchDelta = 0;
    let yawDelta = 0;
    let rotation = [0, 0, 0, 1];
    for (const sampleEvent of sampleEvents) {
      if (Math.abs(sampleEvent.clientX - previousX) <=
            POINTER_POSITION_EPSILON &&
          Math.abs(sampleEvent.clientY - previousY) <=
            POINTER_POSITION_EPSILON) {
        continue;
      }
      if (!pointerDragging) {
        // Pointer ownership persists when wheel zoom changes the camera.
        const wasInteractionActive = interactionActive;
        replaceCameraMotion("drag");
        pointerDragging = true;
        if (!wasInteractionActive) {
          interactionActive = true;
          onStart();
          if (lifetime.disposed) return;
        }
      }
      if (trackballInvalidated) {
        const measuredTrackball = trackballMetrics();
        if (!isTrackballMetrics(measuredTrackball)) {
          throw new TypeError("Unbounded matrix drag trackball is invalid.");
        }
        activeTrackball = measuredTrackball;
        trackballInvalidated = false;
        // Velocity from before zoom belongs to a different screen projection.
        resetGoogleEarthDragHistory(history);
        accumulatedPitch = 0;
        accumulatedYaw = 0;
      }
      // A tumble-only trackball (perspective plans that opt in) takes every
      // sample as if it started at the trackball's centre, so the scene
      // tumbles about the screen axes wherever the pointer is instead of
      // twisting about the view axis outside the disc.
      const sampleStart = activeTrackball.tumbleOnly
        ? [activeTrackball.centerX, activeTrackball.centerY]
        : [previousX, previousY];
      const sampleEnd = activeTrackball.tumbleOnly
        ? [activeTrackball.centerX + (sampleEvent.clientX - previousX),
          activeTrackball.centerY + (sampleEvent.clientY - previousY)]
        : [sampleEvent.clientX, sampleEvent.clientY];
      const projected = projectGoogleEarthTrackballDelta({
        ...activeTrackball,
        previousX: sampleStart[0],
        previousY: sampleStart[1],
        currentX: sampleEnd[0],
        currentY: sampleEnd[1],
      });
      const fittedPitch = projected.pitchDegrees *
        (activeTrackball.pitchResponse ??
          GOOGLE_EARTH_DRAG_INERTIA.directPitchResponse);
      const sampleRotation = projectSphereDrag({
        previousX: sampleStart[0],
        previousY: sampleStart[1],
        currentX: sampleEnd[0],
        currentY: sampleEnd[1],
        centerX: activeTrackball.centerX,
        centerY: activeTrackball.centerY,
        opticalCenterX: activeTrackball.opticalCenterX,
        opticalCenterY: activeTrackball.opticalCenterY,
        radius: activeTrackball.surfaceRadius,
        focalLength: activeTrackball.focalLength,
      });
      rotation = composeDragRotation(sampleRotation, rotation);
      pitchDelta += fittedPitch;
      yawDelta += projected.yawDegrees;
      accumulatedPitch += fittedPitch;
      accumulatedYaw += projected.yawDegrees;
      previousX = sampleEvent.clientX;
      previousY = sampleEvent.clientY;
      previousPointerTimestamp = sampleEvent.timeStamp;
      recordGoogleEarthDragSample(history, {
        x: sampleEvent.clientX,
        y: sampleEvent.clientY,
        timestamp: sampleEvent.timeStamp,
        pitch: accumulatedPitch,
        yaw: accumulatedYaw,
      });
    }
    if (pitchDelta !== 0 || yawDelta !== 0 ||
        Math.abs(rotation[0]) + Math.abs(rotation[1]) + Math.abs(rotation[2]) > 1e-12) {
      const update = {
        controlPitchDelta: pitchDelta,
        controlYawDelta: yawDelta,
        rotation,
      };
      pendingDrag = pendingDrag === null ? update : {
        controlPitchDelta: pendingDrag.controlPitchDelta + pitchDelta,
        controlYawDelta: pendingDrag.controlYawDelta + yawDelta,
        rotation: composeDragRotation(rotation, pendingDrag.rotation),
      };
      return update;
    }
    return null;
  };
  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== pointerId) return;
    event.preventDefault();
    applyPointerSamples(event);
  };
  const endPointer = (event) => {
    if (event.pointerId !== pointerId) return;
    const wasDragging = pointerDragging;
    // Native Qt release consumes the existing movement history. The release
    // location is not another movement and cannot refresh a paused drag.
    const releaseAge = event.timeStamp - previousPointerTimestamp;
    const freshRelease = releaseAge >= 0 &&
      releaseAge <= GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const throwState = wasDragging && event.type === "pointerup" && freshRelease
      ? estimateGoogleEarthDragThrow({ history, releaseTimestamp: event.timeStamp,
        trackball: activeTrackball, frameMilliseconds }) : null;
    // A rejected release clears the native rotation pending for the next
    // present. A throw keeps that movement as part of its launch.
    if (throwState !== null) flushPendingDrag();
    else pendingDrag = null;
    if (lifetime.disposed) return;
    const releaseFrameTimestamp = previousCadenceTimestamp;
    cancelCadence();
    pointerId = null;
    pointerDragging = false;
    syncCursor();
    if (inputSurface.hasPointerCapture(event.pointerId)) {
      inputSurface.releasePointerCapture(event.pointerId);
    }
    if (throwState !== null) {
      if (startInertia(throwState, event.timeStamp, releaseFrameTimestamp)) return;
    }
    if (wasDragging) finishInteraction();
  };
  const onWheel = (event) => {
    if (!wheel || event.deltaY === 0) return;
    if (pointerId !== null) {
      // Native held-button controls consume the wheel and end the grab.
      // The zoom controller observes defaultPrevented on the same event.
      event.preventDefault();
      interruptMotion("wheel");

      return;
    }
    if (activeMode !== "inertia" && activeMode !== "fly-to") return;
    // Native fly-wheel rest trace: the first wheel receipt stops the flight.
    // Cancel its pending frame before the wheel controller starts publishing.
    interruptMotion("wheel");
  };
  lifetime.onDispose(() => interruptMotion("destroy"));
  try {
    for (const [name, callback, options] of [
      ["pointerdown", onPointerDown],
      ["pointermove", onPointerMove],
      ["pointerup", endPointer],
      ["pointercancel", endPointer],
      ["lostpointercapture", endPointer],
      ["mousedown", onMouseDown],
      ["dblclick", onDoubleClick],
      ["wheel", onWheel, { passive: false }],
    ]) {
      const guarded = guardNative(callback);
      lifetime.onDispose(() => inputSurface.removeEventListener(name, guarded));
      inputSurface.addEventListener(name, guarded, options);
    }
    lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
    lifetime.onDispose(() => inputSurface.style.removeProperty("cursor"));
    const cancelDestination = guardNative(event => {
      if (flyToMotion?.sample && (event.key === "Escape" || inputSurface.ownerDocument?.hidden)) interruptMotion("programmatic");
    });
    for (const [target,type] of [[windowTarget,"keydown"],[inputSurface.ownerDocument,"visibilitychange"]]) {
      if (!target?.addEventListener || !target?.removeEventListener) continue;
      lifetime.onDispose(() => target.removeEventListener(type,cancelDestination));
      target.addEventListener(type,cancelDestination);
    }
    inputSurface.style.userSelect = "none";
    syncCursor();
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Drag controls construction failed.", { cause: error });
    throw error;
  }
  return Object.freeze({
    flyTo({ sample, durationMilliseconds = 4500 }) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      if (typeof sample !== "function" || !Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new TypeError("Invalid destination camera motion.");
      }
      try {
        interruptMotion("programmatic");
        activeMode = "fly-to";
        interactionActive = true;
        destinationFlight.starts++;
        onStart();
        if (lifetime.disposed) return Promise.resolve({ completed: false });
        const completion = new Promise(resolve => {
          flyToMotion = { sample, durationMilliseconds, startedAt: null, finish: completed => resolve({ completed }) };
        });
        flyToFrame = requestFrame(animateFlyTo);
        return completion;
      } catch (error) {
        flyToMotion?.finish?.(false);
        const cleanup = lifetime.destroy();
        if (cleanup.length) throw new AggregateError([error, ...cleanup], error.message, { cause: error });
        throw error;
      }
    },
    update(options) {
      if (lifetime.disposed) return;
      if (options.drag !== undefined) drag = options.drag;
      if (options.wheel !== undefined) wheel = options.wheel;
      if (!drag) interruptMotion("disabled");
      syncCursor();
    },
    stop() {
      if (lifetime.disposed) return;
      interruptMotion("programmatic");
    },
    invalidateTrackball() {
      if (pointerId !== null) trackballInvalidated = true;
    },
    stats() {
      return Object.freeze({
        schema: GOOGLE_EARTH_DRAG_INERTIA.schema,
        projection: "screen-space-sphere",
        historyStorage: "fixed-capacity-float64-ring",
        activeMode,
        activeMotionCount:
          Number(pointerDragging) + Number(inertiaFrame !== null) +
          Number(flyToFrame !== null),
        pendingPointer: pointerId !== null && !pointerDragging,
        active: inertiaFrame !== null,
        starts: inertiaStarts,
        frames: inertiaFrames,
        cancels: inertiaCancels,
        pointerCancels,
        interruptions: Object.freeze({ ...interruptionCounts }),
        lastInterruption,
        surfaceFlyTo: Object.freeze({
          schema: GOOGLE_EARTH_SURFACE_FLY_TO.schema,
          qualification: GOOGLE_EARTH_SURFACE_FLY_TO.qualification,
          enabled: surfaceFlyToState !== null,
          active: flyToFrame !== null && !flyToMotion?.sample,
          starts: flyToStarts,
          frames: flyToFrames,
          completions: flyToCompletions,
          cancels: flyToCancels,
        }),
        destinationFlyTo: Object.freeze({ ...destinationFlight, active: Boolean(flyToMotion?.sample) }),
      });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    },
  });
}

// Object adapters supply rendering and camera facts. This is the sole assembly
// point for shared drag, fly-to and wheel behavior, including their lifecycle.
export function createObjectInteractionControls({
  inputSurface,
  camera,
  trackballMetrics,
  sceneMatrix,
  rotate,
  minimumZoom,
  maximumZoom,
  dolly = null,
  onStart,
  onEnd,
  onError = null,
}) {
  if (typeof sceneMatrix !== "function") {
    throw new TypeError("Object interaction controls require the current scene matrix.");
  }
  const lifetime = createSceneLifetime();
  const fail = error => {
    const cleanup = lifetime.destroy();
    const failure = cleanup.length ? new AggregateError([error, ...cleanup], error.message, { cause:error }) : error;
    if (onError === null) throw failure;
    onError(failure);
  };
  try {
  const interactionTrackballMetrics = () =>
    googleEarthInteractionTrackball(trackballMetrics());
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface,
    onError: fail,
    trackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      angularDegreesPerTrackballRadius:
        googleEarthDirectAngularDegreesPerTrackballRadius(camera.state.zoom),
      pitchResponse: directPitchResponseForZoom(camera.state.zoom),
    }),
    flyToTrackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      sceneMatrix: sceneMatrix(),
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: camera.state.zoom,
      minimumZoom,
      maximumZoom,
    }),
    onPointerStart: () => wheelControls.stop(),
    onStart,
    onEnd,
    rotate,
  });
  lifetime.onDispose(() => dragControls.destroy());
  // The motion observer must receive each wheel event before zoom starts.
  const wheelControls = createPreparedWheelZoomControls({
    inputSurface,
    onError: fail,
    camera,
    trackballMetrics: interactionTrackballMetrics,
    rotate(delta) {
      rotate(delta);
      // Measure the changed camera only if a held pointer moves again.
      dragControls.invalidateTrackball();
    },
    minimumZoom,
    maximumZoom,
    dolly,
  });
  lifetime.onDispose(() => wheelControls.destroy());
  return Object.freeze({
    update(options) {
      if (lifetime.disposed) return;
      wheelControls.update(options);
      dragControls.update(options);
    },
    stop() {
      wheelControls.stop();
      dragControls.stop();
    },
    flyTo(options) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      wheelControls.stop();
      return dragControls.flyTo(options);
    },
    stats: () => Object.freeze({
      ...dragControls.stats(),
      wheelZoom: wheelControls.stats(),
    }),
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Object input cleanup failed.");
    },
  });
  } catch (error) {
    const cleanup = lifetime.destroy();
    if (cleanup.length) throw new AggregateError([error, ...cleanup], error.message, { cause:error });
    throw error;
  }
}

export function createRetainedCubicSkyOrbit({
  stage,
  inputSurface,
  cameraElement,
  sceneElement,
  cubicSky,
  skyPlan,
  directionalSun = null,
  directionalSunPlan = null,
  // A mounted heliocentric view (see heliocentric-view-runtime.mjs) replaces
  // the directional Sun billboard: the Sun is real geometry projected with a
  // perspective camera that frames by dolly (cameraPlan.projection), and the
  // Sun's direction in directionalSunPlan is observed, so it rides the scene.
  heliocentric = null,
  cameraPlan,
  objectId,
  mobilePreviewElement,
  onPublish = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
  onError,
  requireSun = true,
}) {
  const hasDirectionalSun = directionalSun !== null ||
    directionalSunPlan !== null;
  const perspectiveCamera = heliocentric !== null;
  validatePreparedCubicSky(skyPlan, {
    requireSun: hasDirectionalSun ? false : requireSun,
  });
  if (hasDirectionalSun) validateDirectionalSunPlan(directionalSunPlan);
  if (perspectiveCamera && (directionalSun !== null || directionalSunPlan === null ||
      cameraPlan?.projection?.model !== "css-perspective-shared-with-sky" ||
      heliocentric?.sunRoot?.isConnected !== true ||
      heliocentric?.overlay?.isConnected !== true)) {
    throw new TypeError("Heliocentric orbit requires the perspective camera, the observed Sun plan and the mounted view.");
  }
  // The stars ride the scene matrix when the sky was registered to it.
  const skyTracksScene = skyPlan.cameraContract === "scene-locked-unbounded-accumulated-matrix3d";
  const numericFields = [
    cameraPlan?.minimumControlPitchDegrees,
    cameraPlan?.maximumControlPitchDegrees,
    cameraPlan?.defaultControlPitchDegrees,
    cameraPlan?.defaultControlYawDegrees,
    cameraPlan?.initialScenePitchDegrees,
    cameraPlan?.maximumScenePitchDegrees,
    cameraPlan?.minimumZoom,
    cameraPlan?.maximumZoom,
    cameraPlan?.defaultZoom,
    cameraPlan?.sceneScale,
    cameraPlan?.logicalBodyDiameter,
  ];
  if (!(stage instanceof HTMLElement) ||
      !(inputSurface instanceof HTMLElement) ||
      !(cameraElement instanceof HTMLElement) ||
      !(sceneElement instanceof HTMLElement) ||
      cubicSky?.root?.isConnected !== true ||
      (hasDirectionalSun && !perspectiveCamera && (
        directionalSun?.root?.isConnected !== true ||
        directionalSunPlan === null
      )) ||
      cameraPlan?.cameraModel !== "accumulated-matrix3d" ||
      cameraPlan?.pitchBounded !== false || cameraPlan?.yawBounded !== false ||
      numericFields.some((value) => !Number.isFinite(value)) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      typeof onPublish !== "function" ||
      typeof onError !== "function" ||
      typeof onInteractionStart !== "function" ||
      typeof onInteractionEnd !== "function") {
    throw new TypeError("Shared retained cubic-sky orbit is invalid.");
  }
  const lifetime = createSceneLifetime();
  let constructing = true;
  const retireFailure = (error) => {
    if (constructing) throw error;
    if (lifetime.disposed) return;
    const cleanupErrors = lifetime.destroy();
    onError(cleanupErrors.length
      ? new AggregateError([error, ...cleanupErrors], error.message, { cause: error }) : error);
  };
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try { return callback(...args); } catch (error) { retireFailure(error); }
  };
  try {
  // The perspective dolly owns the camera state (pose plus distance, zoom as
  // the framing alias) and the projection; the scaled camera keeps the
  // prepared PolyCSS state.
  const perspective = perspectiveCamera ? createPerspectiveDolly({
    cameraPlan, heliocentric, cameraElement, sceneElement,
    skyElement: cubicSky.root, stage,
  }) : null;
  const camera = perspective ? perspective.camera : createPolyCamera({
    target: [0, 0, 0],
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    zoom: cameraPlan.defaultZoom,
    distance: 0,
  });
  const orientation = createCubicSkyCameraOrientation({
    controlPitch: camera.state.rotX,
    controlYaw: camera.state.rotY,
    cameraPlan,
    skyPlan,
    requireSun: hasDirectionalSun ? false : requireSun,
    sunDirection: directionalSunPlan?.localDirection,
    sunReferenceViewDirection: directionalSunPlan?.referenceViewDirection,
    // An observed Sun stays fixed in the prepared scene frame instead of
    // following the presentation sky, and the material below uses the
    // physical light map: a Sun on screen means the camera sees the night
    // side.
    sunTracksScene: perspectiveCamera,
    skyTracksScene,
  });
  const safeCamera = perspective ? camera : Object.freeze({
    get state() { return camera.state; },
    update(partial) {
      camera.update({
        ...partial,
        ...(partial.zoom === undefined ? {} : {
          zoom: clamp(
            partial.zoom,
            cameraPlan.minimumZoom,
            cameraPlan.maximumZoom,
          ),
        }),
      });
    },
  });
  // The zoom alias's bounds: the prepared bounds, or for a dolly the prepared
  // close framing and the whole-orbit distance seen through the same alias.
  const minimumZoom = () => perspective ? perspective.minimumZoom() : cameraPlan.minimumZoom;
  const maximumZoom = () => cameraPlan.maximumZoom;
  const lightDirection = perspectiveCamera
    ? viewSunDirectionToPhysicalLightDirection
    : viewSunDirectionToPreparedLightDirection;
  let publications = 0;
  let interactionStarts = 0;
  let interactionEnds = 0;
  let skySunViewDirection = directionalSunPlan?.referenceViewDirection ??
    skyPlan.sun?.initialViewDirection ?? null;
  let sunPresentation = directionalSun?.state() ?? null;
  const publishCamera = perspective ? null : createPreparedCameraPublisher({
    cameraElement, sceneElement, objectId,
    defaultZoom: cameraPlan.defaultZoom,
    sceneScale: cameraPlan.sceneScale,
  });
  let publishedSkyboxMatrix = null;
  let publishedZoom = null;
  let materialSunViewDirection = hasDirectionalSun &&
      skySunViewDirection !== null
    ? lightDirection(skySunViewDirection)
    : skySunViewDirection;
  let responsiveFit = null;
  let projected = null;
  const publish = () => {
    if (lifetime.disposed) return;
    const sceneMatrix = orientation.scene();
    const sky = orientation.skybox();
    const zoom = safeCamera.state.zoom;
    const skyboxChanged = sky.matrix !== publishedSkyboxMatrix;
    const zoomChanged = zoom !== publishedZoom;
    // The Sun and the orbit, resolved relative to the camera in float64; the
    // same projection places the body.
    if (perspective) projected = perspective.publish(orientation.sceneMatrix(), sceneMatrix);
    else publishCamera({ sceneMatrix, zoom });
    if (skyboxChanged || zoomChanged) {
      cubicSky.setOrientation({
        matrix: sky.matrix,
        zoom,
        defaultZoom: cameraPlan.defaultZoom,
      });
      publishedSkyboxMatrix = sky.matrix;
    }
    publishedZoom = zoom;
    if (skyboxChanged) {
      skySunViewDirection = sky.sunViewDirection;
      sunPresentation = skySunViewDirection === null
        ? null
        : directionalSun?.setViewDirection(skySunViewDirection) ?? null;
      materialSunViewDirection = hasDirectionalSun &&
          skySunViewDirection !== null
        ? lightDirection(skySunViewDirection)
        : skySunViewDirection;
    }
    if (perspective) sunPresentation = projected.sun;
    onPublish(Object.freeze({
      sceneMatrix,
      skyboxMatrix: sky.matrix,
      sunViewDirection: materialSunViewDirection,
      skySunViewDirection,
      sunPresentation,
      counterRotation: orientation.counterRotation(),
      counterRotationFor(localMatrix) {
        return orientation.counterRotation(localMatrix);
      },
      billboardCounterRotation: orientation.billboardCounterRotation(),
      billboardCounterRotationFor(localMatrix) {
        return orientation.billboardCounterRotation(localMatrix);
      },
      controlPitch: safeCamera.state.rotX,
      controlYaw: safeCamera.state.rotY,
      zoom,
      // The dolly's facts: the eye, the projected body and its level of
      // detail, for presentations that fit overlays to the silhouette and
      // choose their material source from the stage.
      ...(projected === null ? {} : {
        distance: projected.distance,
        focal: projected.focal,
        viewportWidth: projected.viewportWidth,
        viewportHeight: projected.viewportHeight,
        principalOffset: projected.principalOffset,
        body: projected.body,
        levelOfDetail: projected.levelOfDetail,
      }),
    }));
    publications += 1;
  };
  const mobileQuery = matchMedia(MOBILE_VIEWPORT_QUERY);
  const publishCameraDelta = ({
    controlPitchDelta,
    controlYawDelta,
    zoom,
    distance,
    rotation,
  }) => {
    const previousPitch = safeCamera.state.rotX;
    safeCamera.update({
      rotX: previousPitch + controlPitchDelta,
      rotY: safeCamera.state.rotY + controlYawDelta,
      ...(zoom === undefined ? {} : { zoom }),
      ...(distance === undefined ? {} : { distance }),
    });
    orientation.rotate({
      renderedPitchDelta:
        preparedScenePitch(safeCamera.state.rotX, cameraPlan) -
          preparedScenePitch(previousPitch, cameraPlan),
      yawDelta: controlYawDelta,
      rotation,
    });
    publish();
  };
  const controls = createObjectInteractionControls({
    inputSurface,
    onError: retireFailure,
    camera: safeCamera,
    trackballMetrics: () => perspective ? perspective.trackball() : measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: cameraPlan.logicalBodyDiameter,
      sceneScale: cameraPlan.sceneScale,
    }),
    sceneMatrix: () => orientation.scene(),
    rotate: publishCameraDelta,
    minimumZoom: minimumZoom(),
    maximumZoom: maximumZoom(),
    // The prepared wheel dolly: the eye moves along its axis, with no
    // surface anchor to hold.
    dolly: perspective
      ? Object.freeze({ stepPerDelta: cameraPlan.dolly.wheelStepPerDelta })
      : null,
    onStart() {
      interactionStarts += 1;
      onInteractionStart();
    },
    onEnd() {
      interactionEnds += 1;
      onInteractionEnd();
    },
  });
  lifetime.onDispose(() => controls.destroy());
  const inputPolicy = bindResponsiveOrbitPolicy({
    controls,
    inputSurface,
    mediaQuery: mobileQuery,
    onError: retireFailure,
  });
  lifetime.onDispose(() => inputPolicy.destroy());
  responsiveFit = selectPreparedResponsiveZoom({
    stage,
    cameraElement,
    plan: cameraPlan,
    mobile: inputPolicy.mobile,
    mobilePreviewElement,
  });
  safeCamera.update({ zoom: responsiveFit.zoom });
  const initialResponsiveZoom = responsiveFit.zoom;
  const windowTarget = stage.ownerDocument.defaultView;
  const handleViewportResize = guardNative(() => {
    perspective?.measure();
    responsiveFit = selectPreparedResponsiveZoom({
      stage,
      cameraElement,
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      mobilePreviewElement,
    });
    perspective?.reclamp();
    publish();
  });
  lifetime.onDispose(() => windowTarget?.removeEventListener("resize", handleViewportResize));
  windowTarget?.addEventListener("resize", handleViewportResize, {
    passive: true,
  });
  if (perspective) {
    // The shell moves the render roots when the sidebar collapses; the eye
    // stays at the sky's vanishing point, so re-measure the offset then.
    const relayout = guardNative(() => {
      perspective.measure();
      perspective.reclamp();
      publish();
    });
    const sidebarObserver = new MutationObserver(relayout);
    sidebarObserver.observe(stage.ownerDocument.body, {
      attributes: true,
      attributeFilter: ["data-sidebar-collapsed"],
    });
    lifetime.onDispose(() => sidebarObserver.disconnect());
    const onTransitionEnd = (event) => {
      if (event.propertyName === "translate") relayout();
    };
    lifetime.onDispose(() => stage.removeEventListener("transitionend", onTransitionEnd));
    stage.addEventListener("transitionend", onTransitionEnd);
  }
  publish();
  constructing = false;
  return Object.freeze({
    mobilePageFlow: () => inputPolicy.mobile,
    initialResponsiveZoom: () => initialResponsiveZoom,
    rebaseScene(change) {
      if (lifetime.disposed) return;
      try { orientation.rebaseScene(change); publish(); }
      catch (error) { retireFailure(error); throw error; }
    },
    flyToState({ controlPitch, controlYaw, zoom }) {
      if (lifetime.disposed) return Promise.resolve({ completed: false });
      try {
      if (![controlPitch, controlYaw, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
      controls.stop();
      const start = { ...safeCamera.state };
      const targetZoom = clamp(zoom, minimumZoom(), maximumZoom());
      const flight = orientation.prepareFlight({ controlPitch, controlYaw });
      const sample = progress => {
        const frame = sampleDestinationFlight({ startZoom: start.zoom, targetZoom,
          overviewZoom: cameraPlan.defaultZoom, angularDistance: flight.angularDistance }, progress);
        safeCamera.update({ rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
          rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation, zoom: frame.zoom });
        flight.sample(frame.rotation);
        publish();
      };
      if (windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        sample(1);
        return Promise.resolve({ completed: true });
      }
      return controls.flyTo({ sample });
      } catch (error) { retireFailure(error); throw error; }
    },
    // Native cache notifications report failures through the same fatal owner.
    invalidate: guardNative(publish),
    refresh() {
      if (lifetime.disposed) return;
      try { publish(); } catch (error) {
        retireFailure(error);
        // Synchronous callers (including selection commits) must stop too.
        throw error;
      }
    },
    setState({ pitch, controlPitch = pitch, controlYaw, zoom, distance, distanceKilometers, pose } = {}) {
      if (lifetime.disposed) return this.state();
      try {
      controls.stop();
      const resetsOrientation = controlPitch !== undefined ||
        controlYaw !== undefined;
      if ((distance !== undefined || distanceKilometers !== undefined) && !perspective) {
        throw new TypeError("Only a perspective camera dollies by distance.");
      }
      safeCamera.update({
        ...(controlPitch === undefined ? {} : { rotX: controlPitch }),
        ...(controlYaw === undefined ? {} : { rotY: controlYaw }),
        ...(distanceKilometers !== undefined
          ? { distanceKilometers }
          : distance !== undefined
            ? { distance }
            : zoom === undefined ? {} : { zoom }),
      });
      if (pose !== undefined) {
        orientation.restore(pose);
      } else if (resetsOrientation) {
        orientation.reset({
          controlPitch: safeCamera.state.rotX,
          controlYaw: safeCamera.state.rotY,
        });
      }
      publish();
      } catch (error) { retireFailure(error); throw error; }
      return this.state();
    },
    state() {
      const state = {
        pitch: safeCamera.state.rotX,
        controlPitch: safeCamera.state.rotX,
        controlYaw: safeCamera.state.rotY,
        zoom: safeCamera.state.zoom,
        ...(perspective ? perspective.state() : {}),
      };
      Object.defineProperty(state, "pose", {
        value: orientation.snapshot(),
      });
      return Object.freeze(state);
    },
    skyState() {
      const currentSunPresentation = directionalSun?.state() ??
        sunPresentation;
      const view = heliocentric?.state() ?? null;
      return Object.freeze({
        sunViewDirection: skySunViewDirection === null
          ? null
          : Object.freeze([...skySunViewDirection]),
        sunVisible: currentSunPresentation?.visible ??
          (skySunViewDirection === null ? false : skySunViewDirection[2] < 0),
        sunClassification: currentSunPresentation?.classification ??
          (skySunViewDirection === null ? "absent" : "cubemap-baked"),
        ...(view === null ? {} : {
          sunCenterNdc: view.sun?.centerNdc ?? null,
          sunSpriteDiameter: view.sun?.spriteDiameter ?? null,
          orbitPieceCount: view.orbitPieceCount,
          orbitOpacity: view.orbitOpacity,
          bodyMarkerOpacity: view.markerOpacity,
          trailSpans: view.trailSpans ?? null,
          captions: view.captions ?? null,
          ...(view.systemOpacity === undefined ? {} : {
            planetarySystem: Object.freeze({
              opacity: view.systemOpacity,
              orbitPieceCount: view.systemPieceCount,
              markerVisibleCount: view.systemMarkerVisibleCount,
              bodies: view.systemBodies,
              sunMarkerOpacity: view.sunMarkerOpacity,
              sunMarkerVisible: view.sunMarkerVisible,
            }),
          }),
        }),
      });
    },
    stats() {
      return Object.freeze({
        owner: "shared-retained-cubic-sky-orbit",
        inputMode: "event-driven-unbounded-matrix-drag-wheel-pinch",
        enabledAxes: "unbounded-pitch-and-yaw",
        cameraModel: cameraPlan.cameraModel,
        pitchBounded: false,
        yawBounded: false,
        minimumPitchDegrees: cameraPlan.minimumControlPitchDegrees,
        maximumPitchDegrees: cameraPlan.maximumControlPitchDegrees,
        defaultControlPitchDegrees: cameraPlan.defaultControlPitchDegrees,
        defaultControlYawDegrees: cameraPlan.defaultControlYawDegrees,
        minimumZoom: minimumZoom(),
        maximumZoom: maximumZoom(),
        defaultZoom: cameraPlan.defaultZoom,
        responsiveFitModel: responsiveFit.model,
        responsiveWidthShare: responsiveFit.widthShare,
        responsiveBaseZoom: responsiveFit.zoom,
        publications,
        directionalSunBillboardCount: hasDirectionalSun ? 1 : 0,
        interactionStarts,
        interactionEnds,
        dragInertia: controls.stats(),
        runtimeGeometryPreparation: false,
        ...(perspective ? {
          ...perspective.stats({ wheelDollies: controls.stats().wheelZoom?.events ?? 0 }),
          // Scene, sky orientation, the Sun billboard and the material fit,
          // plus one per visible orbit piece.
          runtimeTransformStringWrites: publications * 4,
          orbitPieceCount: heliocentric.state().orbitPieceCount,
          orbitPoolOverflows: heliocentric.state().orbitPoolOverflows,
          systemOrbitPieceCount: heliocentric.state().systemPieceCount ?? 0,
          systemPoolOverflows: heliocentric.state().systemPoolOverflows ?? 0,
        } : {}),
      });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Cubic-sky orbit cleanup failed.");
    },
  });
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Cubic-sky orbit construction failed.", { cause: error });
    throw error;
  }
}

export function preparedScenePitch(controlPitchDegrees, plan) {
  const progress = (
    controlPitchDegrees - plan.defaultControlPitchDegrees
  ) / (
    plan.maximumControlPitchDegrees - plan.defaultControlPitchDegrees
  );
  return plan.initialScenePitchDegrees * (1 - progress);
}

export function selectPreparedResponsiveZoom({
  stage,
  cameraElement,
  plan,
  mobile,
  mobilePreviewElement,
}) {
  const fit = plan.responsiveFit;
  const numericFields = [
    fit?.portraitBaseWidthShare,
    fit?.narrowPortraitWidthShareGain,
    fit?.landscapeWidthShareGain,
    fit?.narrowPortraitAspectRatio,
    fit?.portraitAspectRatio,
    fit?.squareAspectRatio,
    fit?.maximumHeightShare,
    fit?.maximumMobilePreviewShare,
    fit?.minimumZoom,
    fit?.maximumZoom,
    plan.logicalBodyDiameter,
  ];
  if (fit?.model !== "continuous-aspect-smoothstep" ||
      numericFields.some((value) => !Number.isFinite(value)) ||
      fit.narrowPortraitAspectRatio >= fit.portraitAspectRatio ||
      fit.portraitAspectRatio >= fit.squareAspectRatio ||
      fit.maximumMobilePreviewShare <= 0 ||
      fit.maximumMobilePreviewShare > 1) {
    throw new TypeError("Continuous responsive planet fit is invalid.");
  }
  const stageBounds = stage?.getBoundingClientRect();
  const cameraBounds = cameraElement?.getBoundingClientRect();
  if (!stageBounds?.width || !stageBounds.height || !cameraBounds.width) {
    throw new TypeError("Responsive planet viewport bounds are invalid.");
  }
  const shellScale = cameraBounds.width / stageBounds.width /
    preparedCameraZoomScale(cameraElement);
  const aspectRatio = stageBounds.width / stageBounds.height;
  const narrowPortraitProgress = smoothstep(
    fit.narrowPortraitAspectRatio,
    fit.portraitAspectRatio,
    aspectRatio,
  );
  const landscapeProgress = smoothstep(
    fit.portraitAspectRatio,
    fit.squareAspectRatio,
    aspectRatio,
  );
  const widthShare = fit.portraitBaseWidthShare +
    fit.narrowPortraitWidthShareGain * (1 - narrowPortraitProgress) +
    fit.landscapeWidthShareGain * landscapeProgress;
  const mobilePreviewBounds = mobile
    ? mobilePreviewElement?.getBoundingClientRect()
    : null;
  const maximumMobileDiameter = mobile && mobilePreviewBounds?.top > 0
    ? mobilePreviewBounds.top * fit.maximumMobilePreviewShare
    : Number.POSITIVE_INFINITY;
  const targetDiameter = Math.min(
    stageBounds.width * widthShare,
    stageBounds.height * fit.maximumHeightShare,
    maximumMobileDiameter,
  );
  const zoom = clamp(
    targetDiameter / (plan.logicalBodyDiameter * shellScale),
    fit.minimumZoom,
    fit.maximumZoom,
  );
  return Object.freeze({ model: fit.model, widthShare, zoom });
}

function formatMatrix3d(matrix) {
  return `matrix3d(${[
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ].map((value) => Math.abs(value) < 1e-12
    ? 0
    : Number(value.toFixed(12))).join(",")})`;
}

function parseSceneRegistration(registration) {
  if (typeof registration !== "string" ||
      !/^matrix3d\([^()]+\)$/u.test(registration)) {
    throw new TypeError("Cubic-sky scene registration is invalid.");
  }
  const matrix = new DOMMatrix(registration);
  if (!matrix.is2D && [matrix.m41, matrix.m42, matrix.m43].some((value) =>
    value !== 0)) {
    throw new TypeError("Cubic-sky scene registration must be a rotation.");
  }
  return matrix;
}

function parseCameraPoseMatrix(value, label) {
  if (typeof value !== "string" || !value.startsWith("matrix3d(")) {
    throw new TypeError(`Cubic-sky camera ${label} matrix is invalid.`);
  }
  const matrix = new DOMMatrix(value);
  const values = [
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ];
  if (values.some((component) => !Number.isFinite(component))) {
    throw new TypeError(`Cubic-sky camera ${label} matrix is invalid.`);
  }
  return matrix;
}

function createSceneMatrix(controlPitch, controlYaw, cameraPlan) {
  return new DOMMatrix()
    .rotateAxisAngle(1, 0, 0, preparedScenePitch(controlPitch, cameraPlan))
    .rotateAxisAngle(0, 1, 0, controlYaw);
}

function transformDirection(matrix, direction) {
  const transformed = [
    matrix.m11 * direction[0] + matrix.m21 * direction[1] +
      matrix.m31 * direction[2],
    matrix.m12 * direction[0] + matrix.m22 * direction[1] +
      matrix.m32 * direction[2],
    matrix.m13 * direction[0] + matrix.m23 * direction[1] +
      matrix.m33 * direction[2],
  ];
  const length = Math.hypot(...transformed);
  return transformed.map((value) => value / length);
}

export function measureRetainedPlanetTrackball({
  stage,
  cameraElement,
  logicalBodyDiameter,
  sceneScale = 1 / BASE_TILE,
}) {
  if (!Number.isFinite(sceneScale) || sceneScale <= 0) {
    throw new TypeError("Retained planet scene scale is invalid.");
  }
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = cameraElement.getBoundingClientRect();
  const style = cameraElement.ownerDocument.defaultView
    .getComputedStyle(cameraElement);
  const scale = retainedPlanetUniformScale(style.scale) ?? Math.min(
    cameraBounds.width / stageBounds.width,
    cameraBounds.height / stageBounds.height,
  );
  const perspective = Number.parseFloat(style.perspective);
  const depthRadius = logicalBodyDiameter * BASE_TILE / 2;
  if (!Number.isFinite(perspective) || perspective <= depthRadius) {
    throw new TypeError("Retained planet camera perspective is invalid.");
  }
  const distance = perspective / depthRadius;
  const centerX = (cameraBounds.left + cameraBounds.right) / 2;
  const centerY = (cameraBounds.top + cameraBounds.bottom) / 2;
  const origin = style.perspectiveOrigin?.trim().split(/\s+/u) ?? [];
  const originOffset = (value, size) => value === undefined ? 0 :
    (value.endsWith("%") ? Number.parseFloat(value) / 100 * size :
      Number.parseFloat(value)) - size / 2;
  const surfaceRadius = perspective * sceneScale * scale /
    Math.sqrt(distance ** 2 - 1);
  const metrics = {
    centerX,
    centerY,
    opticalCenterX: centerX + scale * originOffset(origin[0],
      cameraElement.offsetWidth ?? cameraBounds.width / scale),
    opticalCenterY: centerY + scale * originOffset(origin[1],
      cameraElement.offsetHeight ?? cameraBounds.height / scale),
    radius: logicalBodyDiameter * scale / 2,
    surfaceRadius,
    focalLength: perspective * sceneScale * scale,
    viewportWidth: stageBounds.width,
    viewportCenterX: (stageBounds.left ?? 0) + stageBounds.width / 2,
    viewportCenterY: (stageBounds.top ?? 0) + stageBounds.height / 2,
  };
  if (!isTrackballMetrics(metrics)) {
    throw new TypeError("Retained planet trackball bounds are invalid.");
  }
  return metrics;
}

function dragRotationMatrix([x, y, z, w]) {
  return new DOMMatrix([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ]);
}

function conjugateRotation([x, y, z, w]) {
  return [-x, -y, -z, w];
}

export function measureRetainedPlanetFlyToDisc({
  stage,
  cameraElement,
  logicalBodyDiameter,
}) {
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = cameraElement.getBoundingClientRect();
  const scale = Math.min(
    cameraBounds.width / stageBounds.width,
    cameraBounds.height / stageBounds.height,
  );
  const metrics = Object.freeze({
    centerX: (cameraBounds.left + cameraBounds.right) / 2,
    centerY: (cameraBounds.top + cameraBounds.bottom) / 2,
    radius: logicalBodyDiameter * scale / 2,
  });
  if (!isTrackballMetrics(metrics)) {
    throw new TypeError("Retained planet fly-to disc is invalid.");
  }
  return metrics;
}

export function retainedPlanetUniformScale(value) {
  if (typeof value !== "string" || value === "none") return null;
  const components = value.trim().split(/\s+/u).slice(0, 2)
    .map(Number);
  if (components.length === 0 || components.some((component) =>
    !Number.isFinite(component) || component <= 0)) return null;
  return Math.min(...components);
}

function isTrackballMetrics(metrics) {
  return metrics !== null && typeof metrics === "object" &&
    Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) &&
    (metrics.opticalCenterX === undefined || Number.isFinite(metrics.opticalCenterX)) &&
    (metrics.opticalCenterY === undefined || Number.isFinite(metrics.opticalCenterY)) &&
    Number.isFinite(metrics.radius) && metrics.radius > 0 &&
    (metrics.pitchResponse === undefined ||
      (Number.isFinite(metrics.pitchResponse) && metrics.pitchResponse > 0));
}

function smoothstep(minimum, maximum, value) {
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
