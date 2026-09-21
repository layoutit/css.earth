import { createObjectRuntime } from '../runtime/object-runtime.js';
import type { ObjectRuntimeDefinition, ObjectMountOptions } from '../runtime/object-runtime-types.js';
import { requireCamera } from '../validation/camera-controls.js';
import { parsePreparedWorldContextPlan } from './prepared-world-context.js';
import type { PreparedWorldCameraFrame } from '../navigation/world-camera.js';

/** Adapt the selected detail to the application's physical observer and prepared extent.
 * Keep its resource bank by identity: navigation preflight owns those exact decoded assets. */
export function createWorldContextObjectRuntime({ definition, context, frame }: {
  definition: ObjectRuntimeDefinition; context: unknown; frame?: PreparedWorldCameraFrame;
}) {
  const plan = parsePreparedWorldContextPlan(context);
  const selectedFrame = frame ?? plan.frame;
  const selected = [plan.focus, ...plan.bodies].find(body => body.id === definition.id);
  if (!selected || selectedFrame.referenceFrame !== plan.frame.referenceFrame || selectedFrame.epochJdTt !== plan.frame.epochJdTt ||
      selectedFrame.bodyRadiusM !== selected.radiusM || !selected.positionM.every((value, axis) => Math.abs(value - selectedFrame.originM[axis]) < .001)) {
    throw new TypeError('Selected detail must share the prepared context position, radius and epoch.');
  }
  const isFocus = selected.id === plan.focus.id;
  const camera = isFocus ? { ...definition.camera, ...plan.camera.presentation }
    : { ...definition.camera, dolly: { ...definition.camera.dolly!, maximumDistanceOverOrbitExtent: 1 } };
  requireCamera(camera);
  const mount = createObjectRuntime({ ...definition, camera });
  return (stage: HTMLElement, options: ObjectMountOptions) => mount(stage, {
    ...options, worldFrame: selectedFrame,
    worldContext: { frame: selectedFrame, bodyRadiusUnits: selectedFrame.bodyRadiusM / selectedFrame.metersPerUnit,
      kilometersPerUnit: selectedFrame.metersPerUnit / 1000,
      maximumExtentUnits: plan.camera.maximumDistanceM / selectedFrame.metersPerUnit,
      framingReferenceZoom: isFocus ? plan.camera.framingReferenceZoom
        : definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2 /
          (selectedFrame.bodyRadiusM / selectedFrame.metersPerUnit),
      sceneRegistration: isFocus ? plan.sky.sceneRegistration : definition.sky.sceneRegistration },
  });
}
