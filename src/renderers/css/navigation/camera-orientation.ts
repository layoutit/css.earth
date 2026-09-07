import type { CubicSkyPlan } from '../solar-system/cubic-sky-runtime.js';
import type { CameraPlan, CameraAngles, CameraPose, Quaternion, Vector3 } from './types.js';
export interface CameraSkyPlan { cameraPitchResponse: number; presentationPitchOffsetDegrees: number; presentationYawOffsetDegrees: number; cameraContract?: CubicSkyPlan['cameraContract']; sceneRegistration?: string; sun?: { localDirection: Vector3; initialViewDirection: Vector3 } | null; }
export interface CameraOrientationOptions extends CameraAngles { cameraPlan: CameraPlan; skyPlan: CameraSkyPlan; requireSun?: boolean; sunDirection?: Vector3 | null; sunReferenceViewDirection?: Vector3 | null; sunTracksScene?: boolean; skyTracksScene?: boolean; }
export type CubicSkyCameraOrientation = ReturnType<typeof createCubicSkyCameraOrientation>;
import { rotationAxisAngle } from "@cssearth/engine";
import { preparedScenePitch } from "@cssearth/engine";
import { cssDirectionToViewDirection } from "../solar-system/solar-view-direction.js";
import { validateWorldRotation } from './world-camera-math.js';

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
}: CameraOrientationOptions) {
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
  let sceneMatrix: DOMMatrix;
  let skyboxMatrix: DOMMatrix;
  let sunViewMatrix: DOMMatrix;
  let scenePresentation: string | null = null;
  let skyboxPresentation: Readonly<{ matrix: string; sunViewDirection: Vector3 | null }> | null = null;
  let counterMatrix: DOMMatrix | null = null;
  const counterPresentations = new Map<string | DOMMatrix | null, string>();
  const invalidatePresentations = () => {
    scenePresentation = null;
    skyboxPresentation = null;
    counterMatrix = null;
    counterPresentations.clear();
  };
  // The sky cube's orientation: locked to the scene through the prepared
  // registration, or the presentation sky's own accumulated matrix.
  const currentSkyboxMatrix = () => skyRegistration
    ? sceneMatrix.multiply(skyRegistration)
    : skyboxMatrix;
  const reset = ({ controlPitch: nextPitch, controlYaw: nextYaw }: CameraAngles) => {
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
    setSceneRotation(rotation: readonly number[]) {
      if (!skyRegistration) throw new TypeError('A world camera requires a registered scene-tracking sky.');
      validateWorldRotation(rotation);
      sceneMatrix = new DOMMatrix([rotation[0], rotation[3], rotation[6], 0,
        rotation[1], rotation[4], rotation[7], 0, rotation[2], rotation[5], rotation[8], 0, 0, 0, 0, 1]);
      invalidatePresentations();
    },
    rebaseScene(change: DOMMatrix) {
      sceneMatrix = sceneMatrix.multiply(change);
      invalidatePresentations();
    },
    prepareFlight(target: CameraAngles, targetCorrection?: DOMMatrix) {
      const from = [sceneMatrix, skyboxMatrix, sunViewMatrix];
      reset(target);
      if (targetCorrection) sceneMatrix = targetCorrection.multiply(sceneMatrix);
      const to = [sceneMatrix, skyboxMatrix, sunViewMatrix];
      [sceneMatrix, skyboxMatrix, sunViewMatrix] = from;
      invalidatePresentations();
      const rotations = to.map((matrix, i) => rotationAxisAngle(matrix.multiply(from[i].inverse())));
      return Object.freeze({
        angularDistance: rotations[0].degrees,
        sample(progress: number) {
          const matrices = rotations.map(({ axis, degrees }, i) => progress === 0 ? from[i]
            : progress === 1 ? to[i]
            : new DOMMatrix().rotateAxisAngle(...axis, degrees * progress).multiply(from[i]));
          [sceneMatrix, skyboxMatrix, sunViewMatrix] = matrices;
          invalidatePresentations();
        },
      });
    },
    snapshot({ sceneOnly = false } = {}): CameraPose {
      if (sceneOnly) {
        if (!skyRegistration) throw new TypeError("This camera needs a registered scene orientation.");
        return Object.freeze({ schema: "cssearth-camera-pose@2", scene: formatMatrix3d(sceneMatrix) });
      }
      return Object.freeze({
        schema: "cssearth-camera-pose@1",
        scene: formatMatrix3d(sceneMatrix),
        skybox: formatMatrix3d(currentSkyboxMatrix()),
        sunView: formatMatrix3d(sunViewMatrix),
      });
    },
    restore(snapshot: CameraPose) {
      if (snapshot?.schema === "cssearth-camera-pose@2") {
        if (!skyRegistration) throw new TypeError("This camera needs a registered scene orientation.");
        sceneMatrix = parseCameraPoseMatrix(snapshot.scene, "scene");
        invalidatePresentations();
        return;
      }
      if (snapshot?.schema !== "cssearth-camera-pose@1") {
        throw new TypeError("Cubic-sky camera pose is invalid.");
      }
      sceneMatrix = parseCameraPoseMatrix(snapshot.scene, "scene");
      skyboxMatrix = parseCameraPoseMatrix(snapshot.skybox, "skybox");
      sunViewMatrix = parseCameraPoseMatrix(snapshot.sunView, "sun view");
      invalidatePresentations();
    },
    rotate({ renderedPitchDelta, yawDelta, rotation }: { renderedPitchDelta: number; yawDelta: number; rotation?: Quaternion }) {
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
    counterRotation(localMatrix: string | DOMMatrix | null = null): string {
      if (counterPresentations.has(localMatrix)) {
        return counterPresentations.get(localMatrix)!;
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

    skybox() {
      if (skyboxPresentation !== null) return skyboxPresentation;
      const sunViewDirection = sunTracksScene
        ? Object.freeze(cssDirectionToViewDirection(
          transformDirection(sceneMatrix, sunDirection!),
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

function formatMatrix3d(matrix: DOMMatrixReadOnly) {
  return `matrix3d(${[
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ].map((value) => Math.abs(value) < 1e-12
    ? 0
    : Number(value.toFixed(12))).join(",")})`;
}

function parseSceneRegistration(registration: string | undefined) {
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

function parseCameraPoseMatrix(value: string, label: string) {
  if (typeof value !== "string" || !/^matrix3d\([^()]+\)$/u.test(value)) {
    throw new TypeError(`Cubic-sky camera ${label} matrix is invalid.`);
  }
  // CSS-string parsing in browsers rounds to float32. Numeric construction
  // preserves the saved float64 pose across repeated URL restore cycles.
  const components = value.slice(9, -1).split(",").map(Number);
  if (components.length !== 16 || components.some(component => !Number.isFinite(component))) {
    throw new TypeError(`Cubic-sky camera ${label} matrix is invalid.`);
  }
  const matrix = new DOMMatrix(components);
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

function createSceneMatrix(controlPitch: number, controlYaw: number, cameraPlan: CameraPlan) {
  return new DOMMatrix()
    .rotateAxisAngle(1, 0, 0, preparedScenePitch(controlPitch, cameraPlan))
    .rotateAxisAngle(0, 1, 0, controlYaw);
}

function transformDirection(matrix: DOMMatrixReadOnly, direction: Vector3): Vector3 {
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

function dragRotationMatrix([x, y, z, w]: Quaternion) {
  return new DOMMatrix([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ]);
}
