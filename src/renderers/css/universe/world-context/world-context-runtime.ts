import { createObjectRuntime } from '../../runtime/object-runtime.js';
import type { ObjectRuntimeDefinition, ObjectMountOptions } from '../../runtime/object-runtime-types.js';
import { requireCamera } from '../../validation/camera-controls.js';
import { parsePreparedWorldCamera, parsePreparedWorldContextPlan, PREPARED_WORLD_CAMERA_SCHEMA } from '../prepared-world-context.js';
import type { PreparedWorldCameraFrame } from '../../navigation/world-camera.js';

/** Adapt the selected detail to the application's physical observer and prepared extent.
 * `context` is the page's embedded world camera or a full world context; a full context also checks the detail against
 * its prepared body. Keep its resource bank by identity: navigation preflight owns those exact decoded assets. */
export function createWorldContextObjectRuntime({ definition, context, frame }: {
  definition: ObjectRuntimeDefinition; context: unknown; frame: PreparedWorldCameraFrame;
}) {
  const world = parsePreparedWorldCamera(context);
  if (frame.referenceFrame !== world.frame.referenceFrame || frame.epochJdTt !== world.frame.epochJdTt) {
    throw new TypeError('Selected detail must share the prepared context frame and epoch.');
  }
  const schema = context && typeof context === 'object' ? (context as { schema?: unknown }).schema : undefined;
  if (schema !== PREPARED_WORLD_CAMERA_SCHEMA) {
    const plan = parsePreparedWorldContextPlan(context);
    const selected = [plan.focus, ...plan.bodies].find(body => body.id === definition.id);
    if (!selected || frame.bodyRadiusM !== selected.radiusM || !selected.positionM.every((value, axis) => Math.abs(value - frame.originM[axis]) < .001)) {
      throw new TypeError('Selected detail must share the prepared context position, radius and epoch.');
    }
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
