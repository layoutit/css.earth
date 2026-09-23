import type { CameraPlan, CameraAngles, CameraPose, Quaternion, Vector3 } from './types.js';
export interface CameraOrientationOptions extends CameraAngles { cameraPlan: CameraPlan; sunDirection?: Vector3 | null; }
export type CameraOrientation = ReturnType<typeof createCameraOrientation>;
import { rotationAxisAngle } from "@cssearth/engine";
import { cssDirectionToViewDirection } from "../solar-system/solar-view-direction.js";
import { validateWorldRotation } from './world-camera-math.js';
import { preparedSceneMatrix } from './prepared-camera-basis.js';

export function createCameraOrientation({
  controlPitch,
  controlYaw,
  cameraPlan,
  sunDirection = null,
}: CameraOrientationOptions) {
  if (sunDirection !== null && (
    !Array.isArray(sunDirection) || sunDirection.length !== 3 ||
    sunDirection.some((component) => !Number.isFinite(component)) ||
    Math.abs(Math.hypot(...sunDirection) - 1) > 1e-9
  )) {
    throw new TypeError("Camera Sun direction is invalid.");
  }
  const referenceSceneMatrix = createSceneMatrix(
    cameraPlan.materialReferenceControlPitchDegrees ?? controlPitch,
    cameraPlan.materialReferenceControlYawDegrees ?? controlYaw,
    cameraPlan,
  );
  let sceneMatrix: DOMMatrix;
  let scenePresentation: string | null = null;
  let sunViewDirection: Vector3 | null | undefined;
  let counterMatrix: DOMMatrix | null = null;
  const invalidatePresentations = () => {
    scenePresentation = null;
    sunViewDirection = undefined;
    counterMatrix = null;
  };
  const reset = ({ controlPitch: nextPitch, controlYaw: nextYaw }: CameraAngles) => {
    sceneMatrix = createSceneMatrix(nextPitch, nextYaw, cameraPlan);
    invalidatePresentations();
  };
  reset({ controlPitch, controlYaw });
  return Object.freeze({
    reset,
    setSceneRotation(rotation: readonly number[]) {
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
      const from = sceneMatrix;
      reset(target);
      if (targetCorrection) sceneMatrix = targetCorrection.multiply(sceneMatrix);
      const to = sceneMatrix;
      sceneMatrix = from;
      invalidatePresentations();
      const { axis, degrees } = rotationAxisAngle(to.multiply(from.inverse()));
      return Object.freeze({
        angularDistance: degrees,
        sample(progress: number) {
          sceneMatrix = progress === 0 ? from : progress === 1 ? to
            : new DOMMatrix().rotateAxisAngle(...axis, degrees * progress).multiply(from);
          invalidatePresentations();
        },
      });
    },
    snapshot(): CameraPose {
      return Object.freeze({ schema: "cssearth-camera-pose@2", scene: formatMatrix3d(sceneMatrix) });
    },
    restore(snapshot: CameraPose) {
      if (snapshot?.schema !== "cssearth-camera-pose@2") throw new TypeError("Physical camera pose is invalid.");
      sceneMatrix = parseCameraPoseMatrix(snapshot.scene, "scene");
      invalidatePresentations();
    },
    rotate({ renderedPitchDelta, yawDelta, rotation }: { renderedPitchDelta: number; yawDelta: number; rotation?: Quaternion }) {
      if (rotation) {
        sceneMatrix = dragRotationMatrix(rotation).multiply(sceneMatrix);
        invalidatePresentations();
        return;
      }

      sceneMatrix = new DOMMatrix()
        .rotateAxisAngle(1, 0, 0, renderedPitchDelta)
        .rotateAxisAngle(0, 1, 0, yawDelta)
        .multiply(sceneMatrix);
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
    /** A deferred frame must not consult a later input rotation. */
    captureCounterRotation() {
      counterMatrix ??= sceneMatrix.inverse().multiply(referenceSceneMatrix);
      const captured = counterMatrix;
      const presentations = new Map<string | DOMMatrix | null, string>();
      return (localMatrix: string | DOMMatrix | null = null): string => {
        const cached = presentations.get(localMatrix);
        if (cached !== undefined) return cached;
        const local = typeof localMatrix === 'string' ? new DOMMatrix(localMatrix) : localMatrix;
        if (local !== null && !(local instanceof DOMMatrix)) throw new TypeError('Camera local counter basis is invalid.');
        const value = formatMatrix3d(local === null ? captured : local.inverse().multiply(captured).multiply(local));
        presentations.set(localMatrix, value);
        return value;
      };
    },

    sunViewDirection() {
      if (sunViewDirection === undefined) sunViewDirection = sunDirection === null ? null
        : Object.freeze(cssDirectionToViewDirection(transformDirection(sceneMatrix, sunDirection)));
      return sunViewDirection;
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

function parseCameraPoseMatrix(value: string, label: string) {
  if (typeof value !== "string" || !/^matrix3d\([^()]+\)$/u.test(value)) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  // CSS-string parsing in browsers rounds to float32. Numeric construction
  // preserves the saved float64 pose across repeated URL restore cycles.
  const components = value.slice(9, -1).split(",").map(Number);
  if (components.length !== 16 || components.some(component => !Number.isFinite(component))) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  const matrix = new DOMMatrix(components);
  const values = [
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ];
  if (values.some((component) => !Number.isFinite(component))) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  return matrix;
}

function createSceneMatrix(controlPitch: number, controlYaw: number, cameraPlan: CameraPlan) {
  return new DOMMatrix([...preparedSceneMatrix(cameraPlan, controlPitch, controlYaw)]);
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
