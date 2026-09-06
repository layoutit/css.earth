import { rotationAxisAngle } from "./destination-flight.mjs";
import { preparedScenePitch } from "./camera-math.mjs";

export function createCubicSkyCameraOrientation({
  controlPitch,
  controlYaw,
  cameraPlan,
  skyPlan,
  requireSun = true,
  sunDirection = skyPlan?.sun?.localDirection ?? null,
  sunReferenceViewDirection = null,
}) {
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
  const counterPresentations = new Map();
  const invalidatePresentations = () => {
    scenePresentation = null;
    skyboxPresentation = null;
    counterMatrix = null;
    counterPresentations.clear();
  };
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
        skybox: formatMatrix3d(skyboxMatrix),
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

    skybox() {
      if (skyboxPresentation !== null) return skyboxPresentation;
      const sunViewDirection = sunReferenceViewDirection
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
        matrix: formatMatrix3d(skyboxMatrix),
        sunViewDirection,
      });
      return skyboxPresentation;
    },
  });
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

function dragRotationMatrix([x, y, z, w]) {
  return new DOMMatrix([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ]);
}
