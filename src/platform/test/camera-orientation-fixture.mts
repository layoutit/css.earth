import type { CameraOrientation } from '../../renderers/css/navigation/camera-orientation.ts';

/** Fixed browser orientation for DOM-free dolly and viewport checks. */
export function fixedCameraOrientation(rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1]): CameraOrientation {
  const scene = () => `matrix3d(${[rotation[0], rotation[3], rotation[6], 0, rotation[1], rotation[4], rotation[7], 0,
    rotation[2], rotation[5], rotation[8], 0, 0, 0, 0, 1].join(',')})`;
  return {
    scene, sceneMatrix: () => ({ m11: rotation[0], m21: rotation[1], m31: rotation[2],
      m12: rotation[3], m22: rotation[4], m32: rotation[5], m13: rotation[6], m23: rotation[7], m33: rotation[8] } as DOMMatrix),
    sunViewDirection: () => null, captureCounterRotation: () => scene,
    snapshot: () => ({ schema: 'cssearth-camera-pose@2', scene: scene() }),
    setSceneRotation(next) { rotation = [...next]; },
    reset() {}, restore() {}, rebaseScene() {}, rotate() {},
    prepareFlight: () => ({ angularDistance: 0, sample() {} }),
  };
}
