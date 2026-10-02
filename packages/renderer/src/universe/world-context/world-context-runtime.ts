import { type ObjectRuntimeDefinition, requireCamera, parsePreparedWorldCamera, type PreparedWorldCameraFrame } from '@cssearth/objects';

import { createObjectRuntime } from '../../runtime/object-runtime.js';
import type { ObjectMountOptions } from '../../runtime/object-runtime-types.js';

/** Adapt the selected detail to the application's physical observer and prepared extent. `context` is a world camera
 * record (`world-camera.ts`; `worldCameraOf` picks it out of a world context). Keep its resource bank by identity:
 * navigation preflight owns those exact decoded assets. */
export function createWorldContextObjectRuntime({ definition, context, frame }: {
  definition: ObjectRuntimeDefinition; context: unknown; frame: PreparedWorldCameraFrame;
}) {
  const world = parsePreparedWorldCamera(context);
  if (frame.referenceFrame !== world.frame.referenceFrame || frame.epochJdTt !== world.frame.epochJdTt) {
    throw new TypeError('Selected detail must share the prepared context frame and epoch.');
  }
  const isFocus = definition.id === world.focusId;
  const camera = isFocus ? { ...definition.camera, ...world.camera.presentation }
    : { ...definition.camera, dolly: { ...definition.camera.dolly!, maximumDistanceOverOrbitExtent: 1 } };
  requireCamera(camera);
  const mount = createObjectRuntime({ ...definition, camera });
  return (stage: HTMLElement, options: Omit<ObjectMountOptions, 'worldContext'>) => mount(stage, {
    ...options,
    worldContext: { frame: frame, bodyRadiusUnits: frame.bodyRadiusM / frame.metersPerUnit,
      kilometersPerUnit: frame.metersPerUnit / 1000,
      maximumExtentUnits: world.camera.maximumDistanceM / frame.metersPerUnit,
      framingReferenceZoom: isFocus ? world.camera.framingReferenceZoom
        : definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2 /
          (frame.bodyRadiusM / frame.metersPerUnit) },
  });
}
