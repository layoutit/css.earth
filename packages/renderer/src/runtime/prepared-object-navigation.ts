import { initialStageSelection } from './initial-stage-selection.js';
import { savedWorldCamera } from '../navigation/saved-world-camera.js';
import type { SharedView } from '../navigation/view-url.js';
import { preparedLabelEdge } from '../navigation/prepared-label-edge.js';
import type { WorldRotation } from '../navigation/world-camera-math.js';
import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';
import type { ObjectRuntimeDefinition } from './object-runtime-types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import { presentWorldCamera, worldCameraSilhouetteDiameter, worldCameraViewport, worldCameraFromCenteredPresentation } from '../navigation/world-camera.js';
import { createCameraOrientation } from '../navigation/camera-orientation.js';
import { levelOfDetailFor } from '../navigation/perspective-dolly.js';
import { viewSunDirectionToPhysicalLightDirection } from '../solar-system/directional-sun-coordinate.js';
import { initialObjectSelection } from './object-contract.js';
import { resolvePreparedPresentation } from '../rendering/prepared-presentation.js';
import { prepareObjectResources } from './prepared-resource-lease.js';
import { loadPreparedDataset } from '../loader.js';
import { preparePresentationTree, type PreparedTreeLease } from '../rendering/prepared-tree.js';
import type { CameraViewport } from '../navigation/camera-viewport.js';
import { selectPreparedResponsiveZoom } from '../navigation/camera-layout.js';

export interface ObjectPreparationView { world: WorldCameraPose; viewport: WorldCameraViewport; }

/** Prepared address selection uses the same camera orientation, LOD and
 * material resolver as the mounted presentation, without constructing a scene. */
export function createObjectViewDemand(definition: ObjectRuntimeDefinition, frame: PreparedWorldCameraFrame,
  selection = initialObjectSelection(definition.controls)) {
  const { camera, sun } = definition;
  const orientation = definition.materials.length ? createCameraOrientation({ cameraPlan: camera,
    controlPitch: camera.defaultControlPitchDegrees, controlYaw: camera.defaultControlYawDegrees,
    sunDirection: sun?.localDirection }) : null;
  const light = () => {
    const direction = orientation?.sunViewDirection() ?? null;
    return direction && sun ? viewSunDirectionToPhysicalLightDirection(direction) : direction;
  };
  const reference = { sceneMatrix: orientation?.scene() ?? '', sunViewDirection: light() };
  return ({ world, viewport }: ObjectPreparationView) => {
    const presentation = presentWorldCamera(world, frame, viewport);
    orientation?.setSceneRotation(presentation.rotation);
    const radius = frame.bodyRadiusM / frame.metersPerUnit;
    const diameter = worldCameraSilhouetteDiameter(presentation, radius);
    return resolvePreparedPresentation(definition, { selection, view: {
      sceneMatrix: orientation?.scene() ?? '', sunViewDirection: light(), reference,
      levelOfDetail: levelOfDetailFor(camera.levelOfDetail, diameter),
      projection: physicalProjectionFromCamera(presentation.rotation, presentation.bodyCenterUnits, camera.sceneScale, worldCameraViewport(world, viewport)),
      viewportWidth: viewport.widthPixels, viewportHeight: viewport.heightPixels, motionAtRest: true,
    } });
  };
}

/** One readiness contract for both already-decoded and deferred object packages. */
export function createPreparedObjectNavigation(load: (signal?: AbortSignal) => Promise<ObjectRuntimeDefinition>, frame: PreparedWorldCameraFrame) {
  return Object.freeze({ frame,
    async initialView(viewport: CameraViewport, mobile: boolean, arrival: { rotation: WorldRotation; distanceM: number } | { saved: SharedView }, signal: AbortSignal) {
      const { camera } = await abortable(load(signal), signal);
      const snapshot = viewport.read(camera.projection.cssPerspective);
      if ('saved' in arrival) {
        const { width, height, top } = snapshot.bounds, open = snapshot.openArea;
        const offsetY = open ? (open.top + open.bottom) / 2 - (top + height / 2) : 0;
        const viewport = { focalPixels: snapshot.focalPixels, widthPixels: width, heightPixels: height,
          principalOffsetPixels: [0, 0] as const,
          visibleRect: { left: -width / 2, right: width / 2, top: -height / 2 - offsetY, bottom: height / 2 - offsetY } };
        const world = savedWorldCamera(arrival.saved, frame, viewport);
        return { world, viewport: worldCameraViewport(world, viewport) };
      }
      const fit = selectPreparedResponsiveZoom({ plan: camera, viewport, mobile });
      const radiusPixels = fit.zoom / camera.defaultZoom * camera.logicalBodyDiameter / 2;
      const focalPixels = radiusPixels * Math.sqrt(arrival.distanceM ** 2 - frame.bodyRadiusM ** 2) / frame.bodyRadiusM;
      const projectionScale = focalPixels / snapshot.focalPixels;
      const { width, height, top } = snapshot.bounds;
      const open = snapshot.openArea;
      const offsetY = open ? (open.top + open.bottom) / 2 - (top + height / 2) : 0;
      const optics = { focalPixels, projectionScale, widthPixels: width, heightPixels: height,
        principalOffsetPixels: [0, 0] as const,
        visibleRect: { left: -width / 2, right: width / 2, top: -height / 2 - offsetY, bottom: height / 2 - offsetY } };
      const world = worldCameraFromCenteredPresentation({ rotation: arrival.rotation, distanceUnits: arrival.distanceM / frame.metersPerUnit }, frame, optics);
      return { world, viewport: optics };
    },
    /** The shared caption uses the same prepared shape extent before and after attachment. */
    async labelEdge(signal: AbortSignal) {
      return preparedLabelEdge(await abortable(load(signal), signal), frame);
    },
    async framingScale(signal: AbortSignal) {
      return (await abortable(load(signal), signal)).camera.framingScale ?? 1;
    },
    async framingRadius(viewport: CameraViewport, mobile: boolean, signal: AbortSignal) {
      const { camera } = await abortable(load(signal), signal);
      const fit = selectPreparedResponsiveZoom({ plan: camera, viewport, mobile });
      return fit.zoom / camera.defaultZoom * camera.logicalBodyDiameter / 2;
    },
    async prepare({ signal, getView, cameraViewport, selectionStage, ownerDocument = typeof document === 'undefined' ? undefined : document }: {
      signal: AbortSignal; getView: () => ObjectPreparationView; cameraViewport?: CameraViewport; selectionStage?: HTMLElement; ownerDocument?: Document;
    }) {
      const definition = await abortable(load(signal), signal);
      // Resolve a new authored projection while the outgoing scene is intact.
      // Attachment only consumes this application-owned snapshot.
      cameraViewport?.read(definition.camera.projection.cssPerspective);
      const resources = prepareObjectResources(definition.assets, { signal, startup: false, assetOrigin: definition.assetOrigin });
      let tree: PreparedTreeLease | undefined;
      // A server-rendered scene is already prepared DOM; attachment adopts it.
      const construction = ownerDocument && !selectionStage?.dataset.preparedObject ? preparePresentationTree(definition.tree, ownerDocument, signal, undefined, definition.assetOrigin).then(value => { tree = value; }) : Promise.resolve();
      const destroy = () => { resources.destroy(); tree?.destroy(); };
      const selection = selectionStage ? initialStageSelection(definition.controls, selectionStage).selection : initialObjectSelection(definition.controls);
      let demand: ReturnType<typeof createObjectViewDemand> | null = null;
      const prepareView = (read: () => ObjectPreparationView) => {
        demand ??= createObjectViewDemand(definition, frame, selection);
        return resources.prepareDemand(() => demand!(read()));
      };
      try {
        // A view of a dataset whose tables travel apart resolves once they are adopted (dataset-tables.ts).
        await abortable(loadPreparedDataset(definition, selection.datasetId), signal);
        // The incoming camera owns demand; the default close-up startup bank must not decode first.
        await Promise.all([prepareView(getView), construction]);
        return Object.freeze({ frame, definition, resources, tree, prepareView, destroy,
          projection(view: ObjectPreparationView) {
            const { rotation, bodyCenterUnits } = presentWorldCamera(view.world, frame, view.viewport);
            return physicalProjectionFromCamera(rotation, bodyCenterUnits, definition.camera.sceneScale, worldCameraViewport(view.world, view.viewport));
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
