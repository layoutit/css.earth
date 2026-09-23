import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';
import type { ObjectRuntimeDefinition } from './object-runtime-types.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { presentWorldCamera, worldCameraSilhouetteDiameter } from '../navigation/world-camera.js';
import { createCubicSkyCameraOrientation } from '../navigation/camera-orientation.js';
import { levelOfDetailFor } from '../navigation/perspective-dolly.js';
import { viewSunDirectionToPhysicalLightDirection } from '../solar-system/directional-sun-coordinate.js';
import { initialObjectSelection } from './object-contract.js';
import { resolvePreparedPresentation, selectedPreparedVariant } from '../rendering/prepared-presentation.js';
import { prepareObjectResources } from './prepared-resource-lease.js';
import { preparePresentationTree, type PreparedTreeLease } from '../rendering/prepared-tree.js';
import type { CameraViewport } from '../navigation/camera-viewport.js';

export interface ObjectPreparationView { world: WorldCameraPose; viewport: WorldCameraViewport; }

/** Prepared address selection uses the same camera orientation, LOD and
 * material resolver as the mounted presentation, without constructing a scene. */
export function createObjectViewDemand(definition: ObjectRuntimeDefinition, frame: PreparedWorldCameraFrame) {
  const selection = initialObjectSelection(definition.controls);
  if (!selectedPreparedVariant(definition, selection).materials.length) {
    const plan = resolvePreparedPresentation(definition, { selection, view: null, initial: true });
    return (_view: ObjectPreparationView) => plan;
  }
  const { camera, sky, sun } = definition;
  const orientation = createCubicSkyCameraOrientation({ cameraPlan: camera, skyPlan: sky,
    controlPitch: camera.defaultControlPitchDegrees, controlYaw: camera.defaultControlYawDegrees,
    sunDirection: sun?.localDirection });
  const light = () => {
    const direction = orientation.skybox().sunViewDirection;
    return direction && sun ? viewSunDirectionToPhysicalLightDirection(direction) : direction;
  };
  const reference = { sceneMatrix: orientation.scene(), sunViewDirection: light() };
  return ({ world, viewport }: ObjectPreparationView) => {
    const presentation = presentWorldCamera(world, frame, viewport);
    orientation.setSceneRotation(presentation.rotation);
    const radius = frame.bodyRadiusM / frame.metersPerUnit;
    const diameter = worldCameraSilhouetteDiameter(presentation, radius);
    return resolvePreparedPresentation(definition, { selection, initial: true, view: {
      sceneMatrix: orientation.scene(), sunViewDirection: light(), reference,
      ...(camera.levelOfDetail ? { levelOfDetail: levelOfDetailFor(camera.levelOfDetail, diameter) } : {}),
    } });
  };
}

/** One readiness contract for both already-decoded and deferred object packages. */
export function createPreparedObjectNavigation(load: (signal?: AbortSignal) => Promise<ObjectRuntimeDefinition>, frame: PreparedWorldCameraFrame) {
  return Object.freeze({ frame,
    async prepare({ signal, getView, cameraViewport, ownerDocument = typeof document === 'undefined' ? undefined : document }: {
      signal: AbortSignal; getView: () => ObjectPreparationView; cameraViewport?: CameraViewport; ownerDocument?: Document;
    }) {
      const definition = await abortable(load(signal), signal);
      // Resolve a new authored projection while the outgoing scene is intact.
      // Attachment only consumes this application-owned snapshot.
      if (definition.camera.projection) cameraViewport?.read(definition.camera.projection.cssPerspective);
      const resources = prepareObjectResources(definition.assets, { signal, assetOrigin: definition.assetOrigin });
      let tree: PreparedTreeLease | undefined;
      const construction = ownerDocument ? preparePresentationTree(definition.tree, ownerDocument, signal, undefined, definition.assetOrigin).then(value => { tree = value; }) : Promise.resolve();
      const destroy = () => { resources.destroy(); tree?.destroy(); };
      let demand: ReturnType<typeof createObjectViewDemand> | null = null;
      const prepareView = (read: () => ObjectPreparationView) => {
        demand ??= createObjectViewDemand(definition, frame);
        return resources.prepareDemand(() => demand!(read()));
      };
      try {
        // One bounded bank completes startup, then follows the incoming view.
        await Promise.all([prepareView(getView), construction]);
        return Object.freeze({ frame, definition, resources, tree, prepareView, destroy,
          projection(view: ObjectPreparationView) {
            const { rotation, bodyCenterUnits } = presentWorldCamera(view.world, frame, view.viewport);
            return physicalProjectionFromCamera(rotation, bodyCenterUnits, definition.camera.sceneScale, view.viewport);
          },
        });
      } catch (error) {
        destroy();
        // A failed bank cannot leave the concurrent detached builder retained.
        construction.then(() => tree?.destroy(), () => {});
        throw error;
      }
    },
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Navigation was cancelled.', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
