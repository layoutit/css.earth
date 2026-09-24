import { preparedScenePitch } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { CameraAngles, CameraDelta, CameraPose, CameraUpdate, PerspectiveCameraPlan, TrackballMetrics } from './types.js';
import { createCameraOrientation } from './camera-orientation.js';
import { distanceForSilhouetteRadius, rotationFromMatrix3d, silhouetteRadiusAtDistance } from '../solar-system/heliocentric-geometry.js';
import { presentWorldCamera, worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from './world-camera.js';
import { rotateWorldPosition, scaleWorldPosition, transposeWorldRotation, validateWorldPosition } from './world-camera-math.js';
import { validatePreparedNavigationFocus } from './prepared-focus.js';
import type { PreparedNavigationFocus } from './prepared-focus.js';
import type { PerspectiveWorldContext } from './perspective-dolly.js';
import type { Vector3 } from './types.js';
import { clamp } from '@cssearth/core';

/** The live camera stays in its prepared local frame for float64 precision.
 * Input, focus changes and restored observers mutate this owner; frame capture is read-only. */
export function createPreparedCamera(cameraPlan: PerspectiveCameraPlan, worldContext: PerspectiveWorldContext,
  optics: () => WorldCameraViewport, sunDirection: Vector3 | null | undefined,
  createOrientation = createCameraOrientation) {
  const bodyRadius = worldContext.bodyRadiusUnits, kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumDistance = cameraPlan.dolly.maximumDistanceOverOrbitExtent * worldContext.maximumExtentUnits;
  const framingReferenceZoom = worldContext.framingReferenceZoom ?? cameraPlan.defaultZoom;
  const orientation = createOrientation({ cameraPlan, controlPitch: cameraPlan.defaultControlPitchDegrees,
    controlYaw: cameraPlan.defaultControlYawDegrees, sunDirection });
  const readRotation = () => rotationFromMatrix3d(orientation.sceneMatrix());
  const cameraState = {
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    distance: 0,
  };
  // Null is the original centred dolly. A world publication adopts a full
  // eye-space centre, retained across drag, wheel and viewport changes.
  let bodyCenter: PositionM | null = null;
  let zoomOutCentering = false;
  // The zoom alias last set, while the distance still corresponds to it: the
  // alias round trip through the focal length is exact only to floating
  // point, and a camera state set by zoom reads back the same number.
  let aliasZoom: number | null = null;
  let aliasDistance: number | null = null;
  const zoomToDistance = (zoom: number) => distanceForSilhouetteRadius(
    bodyRadius,
    optics().focalPixels,
    zoom / framingReferenceZoom * cameraPlan.logicalBodyDiameter / 2,
    optics().principalOffsetPixels,
  );
  // The round trip through the distance is exact only to floating point;
  // the alias reports the prepared bound itself at the bound.
  const distanceToZoom = (distance: number) => {
    // The world observer may legally sit closer than the authored input
    // range. Saturate input calibration there without moving that observer
    // or asking a centred tangent cone that crosses the eye to define zoom.
    if (bodyCenter !== null && distance < minimumDistance()) return distanceToZoom(minimumDistance());
    const zoom = silhouetteRadiusAtDistance(bodyRadius, optics().focalPixels, distance, optics().principalOffsetPixels) *
      2 / cameraPlan.logicalBodyDiameter * framingReferenceZoom;
    return Math.abs(zoom - cameraPlan.maximumZoom) < 1e-9 ? cameraPlan.maximumZoom : zoom;
  };
  // The zoom stops where one CSS pixel under the eye shows the least surface arc the body's prepared imagery supports:
  // closer, it is only stretched. The altitude scales with the focal length, so every viewport stops as sharp.
  const texelAltitude = () => cameraPlan.dolly.surfaceArcPerCssPixelRadians === undefined ? 0
    : bodyRadius * cameraPlan.dolly.surfaceArcPerCssPixelRadians * optics().focalPixels;
  const minimumDistance = () => Math.max(
    cameraPlan.dolly.minimumDistanceRadii * bodyRadius,
    bodyRadius + texelAltitude(),
    zoomToDistance(cameraPlan.maximumZoom),
  );
  const clampDistance = (distance: number) =>
    clamp(distance, minimumDistance(), maximumDistance);
  const minimumZoom = () => distanceToZoom(maximumDistance);
  const maximumZoom = () => cameraPlan.maximumZoom;
  // The prepared default framing until the responsive fit is selected: the
  // camera is never inside the body, even before its first publication.
  cameraState.distance = clampDistance(zoomToDistance(cameraPlan.defaultZoom));

  function detailState() {
    return Object.freeze({
      rotX: cameraState.rotX,
      rotY: cameraState.rotY,
      distance: cameraState.distance,
      zoom: aliasZoom !== null && cameraState.distance === aliasDistance
        ? aliasZoom
        : distanceToZoom(cameraState.distance),
    });
  }
  function updateDetail(partial: CameraUpdate) {
    const previousDistance = cameraState.distance;
    const constrain = bodyCenter === null ? clampDistance : (distance: number) => clamp(distance,
      Math.min(minimumDistance(), previousDistance), Math.max(maximumDistance, previousDistance));
    if (partial.rotX !== undefined) cameraState.rotX = partial.rotX;
    if (partial.rotY !== undefined) cameraState.rotY = partial.rotY;
    if (partial.distanceKilometers !== undefined) {
      cameraState.distance = constrain(partial.distanceKilometers / kilometersPerUnit);
    } else if (partial.distance !== undefined) {
      cameraState.distance = constrain(partial.distance);
    } else if (partial.zoom !== undefined) {
      const clampedZoom = clamp(partial.zoom, minimumZoom(), maximumZoom());
      const requested = zoomToDistance(clampedZoom);
      cameraState.distance = constrain(requested);
      aliasZoom = cameraState.distance === requested ? clampedZoom : null;
      aliasDistance = cameraState.distance;
    }
    if (bodyCenter !== null && cameraState.distance !== previousDistance) {
      if (zoomOutCentering && cameraState.distance > previousDistance) {
        // Dolly back along the content-centre ray. Its perpendicular offset
        // stays fixed in world units, so the body drifts toward the centre
        // naturally as the user zooms out. There is no separate camera turn.
        const { focalPixels: focal, principalOffsetPixels: principalOffset } = optics();
        const axisLength = Math.hypot(principalOffset[0], principalOffset[1], focal);
        const axis: PositionM = [-principalOffset[0] / axisLength, -principalOffset[1] / axisLength, -focal / axisLength];
        const along = bodyCenter.reduce((sum, value, index) => sum + value * axis[index]!, 0);
        if (along > 0) {
          const across: PositionM = [bodyCenter[0] - axis[0] * along,
            bodyCenter[1] - axis[1] * along, bodyCenter[2] - axis[2] * along];
          const nextAlong = Math.sqrt(Math.max(0, cameraState.distance ** 2 - Math.hypot(...across) ** 2));
          bodyCenter = [across[0] + axis[0] * nextAlong, across[1] + axis[1] * nextAlong, across[2] + axis[2] * nextAlong];
        } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
      } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
    }
  }

  function setBodyCenter(next: PositionM) {
    validateWorldPosition(next);
    const distance = Math.hypot(...next);
    if (distance <= bodyRadius) throw new RangeError('The world camera is inside the focused body.');
    bodyCenter = [next[0], next[1], next[2]];
    cameraState.distance = distance;
    aliasZoom = null;
  }
  let active: { focus: PreparedNavigationFocus; frame: PreparedWorldCameraFrame;
    offsetUnits: PositionM; rotatedOffset: PositionM; centerUnits: PositionM } | null = null;
  function capture(frame: PreparedWorldCameraFrame): WorldCameraPose {
    const rotation = readRotation(), bodyCenterUnits = bodyCenter;
    return bodyCenterUnits === null
      ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: detailState().distance }, frame, optics())
      : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame);
  }
  function adopt(world: WorldCameraPose, frame: PreparedWorldCameraFrame) {
    const presentation = presentWorldCamera(world, frame, optics());
    setBodyCenter(presentation.bodyCenterUnits);
    orientation.setSceneRotation(presentation.rotation);
    if (active) {
      active.rotatedOffset = rotateWorldPosition(presentation.rotation, active.offsetUnits);
      active.centerUnits = add(presentation.bodyCenterUnits, active.rotatedOffset);
    }
  }
  function preservePivot() {
    if (!active) return;
    const nextOffset = rotateWorldPosition(readRotation(), active.offsetUnits);
    // Apply only the changed pivot offset. Subtracting two galaxy-scale positions
    // when the rotation is unchanged would erase a nearby detail's metre-scale eye.
    if (nextOffset.some((value, axis) => value !== active!.rotatedOffset[axis])) {
      setBodyCenter(add(bodyCenter!, subtract(active.rotatedOffset, nextOffset)));
      active.rotatedOffset = nextOffset;
    }
  }
  function set(focus: PreparedNavigationFocus | null, frame: PreparedWorldCameraFrame) {
    if (focus === null) { active = null; return; }
    const validated = validatePreparedNavigationFocus(focus);
    const presentation = presentWorldCamera(capture(frame), frame, optics());
    const offsetUnits = scaleWorldPosition(rotateWorldPosition(transposeWorldRotation(frame.presentationToReference),
      subtract(validated.positionM, frame.originM)), 1 / frame.metersPerUnit);
    const rotatedOffset = rotateWorldPosition(presentation.rotation, offsetUnits);
    const centerUnits = add(presentation.bodyCenterUnits, rotatedOffset);
    if (!(Math.hypot(...centerUnits) > 0)) throw new RangeError('The observer cannot orbit from the prepared focus centre.');
    // Materialise a centred detail dolly before changing its input pivot.
    setBodyCenter(presentation.bodyCenterUnits);
    active = { focus: validated, frame, offsetUnits, rotatedOffset, centerUnits };
    preservePivot();
  }
  const focusZoom = () => {
    if (!active) return detailState().zoom;
    const distanceM = Math.hypot(...active.centerUnits) * active.frame.metersPerUnit;
    // A framing bound is not a solid body: this alias remains defined inside it.
    return Math.min(cameraPlan.maximumZoom, optics().focalPixels * active.focus.framingRadiusM /
      distanceM * 2 / cameraPlan.logicalBodyDiameter * framingReferenceZoom);
  };
  function inputState() {
    return active ? { ...detailState(), distance: Math.hypot(...active.centerUnits), zoom: focusZoom() } : detailState();
  }
  function updateInput(partial: CameraUpdate) {
    if (!active) { updateDetail(partial); return; }
    const oldDistance = Math.hypot(...active.centerUnits);
    const requested = partial.distanceKilometers !== undefined ? partial.distanceKilometers * 1000 / active.frame.metersPerUnit
      : partial.distance ?? (partial.zoom === undefined ? oldDistance : oldDistance * focusZoom() / partial.zoom);
    if (!Number.isFinite(requested) || requested <= 0) throw new TypeError('Prepared focus distance must be positive and finite.');
    const { minimumDistanceM, maximumDistanceM } = active.focus.limits;
    // Restored observers outside the authored interval remain stationary until dolly input.
    if (requested !== oldDistance) {
      const next = Math.max(Math.min(minimumDistanceM / active.frame.metersPerUnit, oldDistance),
        Math.min(Math.max(maximumDistanceM / active.frame.metersPerUnit, oldDistance), requested));
      const nextCenter = scaleWorldPosition(active.centerUnits, next / oldDistance);
      setBodyCenter(add(bodyCenter!, subtract(nextCenter, active.centerUnits)));
      active.centerUnits = nextCenter;
    }
    updateDetail({ ...(partial.rotX === undefined ? {} : { rotX: partial.rotX }),
      ...(partial.rotY === undefined ? {} : { rotY: partial.rotY }) });
  }
  return Object.freeze({
    get state() { return inputState(); },
    dolly(update: Pick<CameraUpdate, "zoom" | "distance" | "distanceKilometers">) { updateInput(update); },
    rotate(delta: CameraDelta) {
      const previousPitch = inputState().rotX;
      updateInput({ rotX: previousPitch + delta.controlPitchDelta,
        rotY: inputState().rotY + delta.controlYawDelta, zoom: delta.zoom, distance: delta.distance });
      orientation.rotate({ renderedPitchDelta: preparedScenePitch(inputState().rotX, cameraPlan) - preparedScenePitch(previousPitch, cameraPlan),
        yawDelta: delta.controlYawDelta, rotation: delta.rotation });
      preservePivot();
    },
    rebaseScene(change: DOMMatrix) { orientation.rebaseScene(change); preservePivot(); },
    prepareFlight(target: CameraAngles, correction?: DOMMatrix) {
      const flight = orientation.prepareFlight(target, correction);
      return { angularDistance: flight.angularDistance,
        sample(progress: number, update: CameraUpdate) { updateInput(update); flight.sample(progress); preservePivot(); } };
    },
    restore(update: CameraUpdate, pose?: CameraPose, bodyCenterKilometers?: PositionM) {
      active = null;
      const resetsOrientation = update.rotX !== undefined || update.rotY !== undefined;
      if (resetsOrientation || pose !== undefined) bodyCenter = null;
      updateDetail(update);
      if (pose !== undefined) orientation.restore(pose);
      else if (resetsOrientation) orientation.reset({ controlPitch: cameraState.rotX, controlYaw: cameraState.rotY });
      if (bodyCenterKilometers !== undefined) setBodyCenter([bodyCenterKilometers[0] / kilometersPerUnit, bodyCenterKilometers[1] / kilometersPerUnit, bodyCenterKilometers[2] / kilometersPerUnit]);
    },
    snapshot: orientation.snapshot,
    scene: orientation.scene,
    bodyCenter: () => bodyCenter,
    setZoomOutCentering(enabled: boolean) { zoomOutCentering = enabled; },
    minimumZoom, maximumZoom, minimumDistance, maximumDistance,
    /** Only the original centred framing follows a resize; a restored observer stays put. */
    reframe(zoom: number) { if (bodyCenter === null) updateDetail({ zoom }); },
    detailState() {
      return { ...detailState(),
        ...(bodyCenter === null ? {} : { bodyCenterKilometers: scaleWorldPosition(bodyCenter, kilometersPerUnit) }) };
    },
    capture,
    captureFrame() {
      const world = capture(worldContext.frame);
      return { world, rotation: readRotation(), scenePresentation: orientation.scene(), distance: cameraState.distance,
        controlPitch: inputState().rotX, controlYaw: inputState().rotY, zoom: inputState().zoom,
        sunDirection: orientation.sunViewDirection(), counterRotationFor: orientation.captureCounterRotation() };
    },
    adopt,
    setFocus: set,
    focus: () => active?.focus ?? null,
    clearFocus() { active = null; },
    trackball(base: TrackballMetrics): TrackballMetrics {
      if (!active) return base;
      const [x, y, z] = active.centerUnits, depth = -z;
      const visible = depth > 0;
      const radius = Math.max(base.viewportWidth / 5, Math.min(base.viewportWidth,
        visible ? base.focalLength * active.focus.framingRadiusM / active.frame.metersPerUnit / depth : 0));
      return { ...base, centerX: visible ? (base.opticalCenterX ?? base.centerX) + base.focalLength * x / depth : base.viewportCenterX ?? base.centerX,
        centerY: visible ? (base.opticalCenterY ?? base.centerY) + base.focalLength * y / depth : base.viewportCenterY ?? base.centerY,
        radius, surfaceRadius: radius };
    },
  });
}
function add(a: PositionM, b: PositionM): PositionM { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: PositionM, b: PositionM): PositionM { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export type PreparedCamera = ReturnType<typeof createPreparedCamera>;
