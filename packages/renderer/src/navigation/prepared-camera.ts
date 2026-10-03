import { type CameraPose, cameraProjectionScale, worldCameraFromCenteredPresentation, worldCameraFromPresentation, type PerspectiveCameraPlan, type PreparedWorldCameraFrame, type WorldCameraPose } from '@cssearth/objects';

import { preparedScenePitch } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { CameraAngles, CameraDelta, CameraUpdate } from './types.js';

import { createCameraOrientation } from './camera-orientation.js';
import { distanceForSilhouetteRadius, rotationFromMatrix3d, silhouetteRadiusAtDistance } from '@cssearth/engine';
import { worldCameraViewport, presentWorldCamera } from './world-camera.js';
import type { WorldCameraViewport } from './world-camera.js';

import { scaleWorldPosition, validateWorldPosition } from '@cssearth/engine';
import type { PerspectiveWorldContext } from './perspective-dolly.js';
import type { Vector3 } from './types.js';
import { clamp } from '@cssearth/core';

/** The live camera stays in its prepared local frame for float64 precision.
 * Input, focus changes and restored observers mutate this owner; frame capture is read-only. */
/** How far past its own far limit a scene lets the zoom go while a wider scene can take the camera: ten doublings, more
 * runway than any zoom covers in the fraction of a second a switch takes. */
const OPEN_FAR_LIMIT = 1024;

export function createPreparedCamera(cameraPlan: PerspectiveCameraPlan, worldContext: PerspectiveWorldContext,
  baseOptics: () => WorldCameraViewport, sunDirection: Vector3 | null | undefined,
  createOrientation = createCameraOrientation) {
  let projectionScale = 1;
  const optics = () => worldCameraViewport({ projectionScale }, baseOptics());
  const bodyRadius = worldContext.bodyRadiusUnits, kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumDistance = cameraPlan.dolly.maximumDistanceOverOrbitExtent * worldContext.maximumExtentUnits;
  // The camera is the world's, not this scene's. A scene with a wider one to hand it to (setZoomOutOpen) does not stop
  // the zoom at its own far limit: the wider scene takes the camera over underneath, and a camera standing at the limit
  // until that switch was done is a hold (6 frames of a steady zoom out of Earth on the iPad, 2026-10-03). The limit
  // still ends the zoom of a scene with nowhere wider to go, and far out of one whose switch never comes.
  let zoomOutOpen = false;
  const farLimit = () => zoomOutOpen ? maximumDistance * OPEN_FAR_LIMIT : maximumDistance;
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
    clamp(distance, minimumDistance(), farLimit());
  const minimumZoom = () => distanceToZoom(farLimit());
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
      Math.min(minimumDistance(), previousDistance), Math.max(farLimit(), previousDistance));
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
  // The world camera last adopted, while nothing has moved this camera since: its body centre is the same array, its scene
  // rotation and projection scale the same values. Capturing then returns that pose itself. Rebuilding it from this body's
  // local presentation would round it at this body's distance from the eye: a kilometre when a flight from here approaches a
  // 23 km star 157 parsecs away, which made its label jump by up to 24 px a frame (2026-10-01).
  let adopted: { world: WorldCameraPose; frame: PreparedWorldCameraFrame; bodyCenter: PositionM | null; rotation: readonly number[]; projectionScale: number } | null = null;
  function capture(frame: PreparedWorldCameraFrame): WorldCameraPose {
    if (adopted && adopted.frame === frame && adopted.bodyCenter === bodyCenter && adopted.projectionScale === projectionScale &&
        readRotation().every((value, index) => value === adopted!.rotation[index])) return adopted.world;
    const rotation = readRotation(), bodyCenterUnits = bodyCenter;
    return bodyCenterUnits === null
      ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: detailState().distance }, frame, optics())
      : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame, projectionScale);
  }
  /** Whether a world camera sits inside this body: a flight to something behind the body passes through it. */
  function contains(world: WorldCameraPose, frame: PreparedWorldCameraFrame) {
    return Math.hypot(...presentWorldCamera(world, frame, optics()).bodyCenterUnits) <= bodyRadius;
  }
  function adopt(world: WorldCameraPose, frame: PreparedWorldCameraFrame) {
    projectionScale = cameraProjectionScale(world.projectionScale);
    const presentation = presentWorldCamera(world, frame, optics());
    setBodyCenter(presentation.bodyCenterUnits);
    orientation.setSceneRotation(presentation.rotation);
    adopted = { world, frame, bodyCenter, rotation: [...readRotation()], projectionScale };
  }
  const inputState = detailState, updateInput = updateDetail;
  return Object.freeze({
    get projectionScale() { return projectionScale; },
    setProjectionScale(value: number) { projectionScale = cameraProjectionScale(value); aliasZoom = null; },
    get state() { return inputState(); },
    dolly(update: Pick<CameraUpdate, "zoom" | "distance" | "distanceKilometers">) { updateInput(update); },
    rotate(delta: CameraDelta) {
      const previousPitch = inputState().rotX;
      updateInput({ rotX: previousPitch + delta.controlPitchDelta,
        rotY: inputState().rotY + delta.controlYawDelta, zoom: delta.zoom, distance: delta.distance });
      orientation.rotate({ renderedPitchDelta: preparedScenePitch(inputState().rotX, cameraPlan) - preparedScenePitch(previousPitch, cameraPlan),
        yawDelta: delta.controlYawDelta, rotation: delta.rotation });
    },
    rebaseScene(change: DOMMatrix) { orientation.rebaseScene(change); },
    prepareFlight(target: CameraAngles, correction?: DOMMatrix) {
      const flight = orientation.prepareFlight(target, correction);
      return { angularDistance: flight.angularDistance,
        sample(progress: number, update: CameraUpdate) { updateInput(update); flight.sample(progress); } };
    },
    restore(update: CameraUpdate, pose?: CameraPose, bodyCenterKilometers?: PositionM) {
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
    setZoomOutOpen(open: boolean) { zoomOutOpen = open; },
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
    adopt, contains,
  });
}
function add(a: PositionM, b: PositionM): PositionM { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: PositionM, b: PositionM): PositionM { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export type PreparedCamera = ReturnType<typeof createPreparedCamera>;
