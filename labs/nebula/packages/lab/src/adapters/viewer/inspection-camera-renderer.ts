/** The app's input policy and canonical physical-camera representation. */
import type { InspectionCameraBackend } from '@cssearth/volume-viewer/camera/inspection-camera';
import type { VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
import * as runtimePolicy from '../../../../../../../site/runtime-policy.mts';
import { createObjectInteractionControls } from '../../../../../../../src/renderers/css/navigation/object-interaction-controls';
import { createCameraMotion } from '../../../../../../../src/renderers/css/navigation/camera-motion';
import { worldCameraFromCenteredPresentation } from '../../../../../../../src/renderers/css/navigation/world-camera';
import { referenceRotationFromPresentation, worldRotationFromQuaternion } from '../../../../../../../src/renderers/css/navigation/world-camera-math';
import { rotationFromMatrix3d } from '../../../../../../../src/renderers/css/solar-system/heliocentric-geometry';
export const inspectionCameraRenderer: InspectionCameraBackend<VolumeCameraPublication> = {
  rotationFromQuaternion: worldRotationFromQuaternion,
  connect(bindings) { return createObjectInteractionControls({ ...bindings, runtimePolicy, cameraMotion: createCameraMotion(),
    minimumZoom: .01, maximumZoom: 100, dolly: { stepPerDelta: .0015 }, surfaceFlyToHitTest: () => false }); },
  publication(frame, rotation, distanceUnits, radius, { width, height, focal }) {
    const world = worldCameraFromCenteredPresentation({ rotation: rotationFromMatrix3d(rotation), distanceUnits },
      // `presentationToReference` is the CSS presentation's map into the reference frame, so it must reverse
      // handedness. The prepared quaternion is its y-negated proper twin; the conversion is the exact inverse
      // of the one `focusFrame` applies to recover `localToReferenceXyzw`.
      { ...frame, presentationToReference: referenceRotationFromPresentation(worldRotationFromQuaternion(frame.localToReferenceXyzw)),
        bodyRadiusM: radius * frame.metersPerUnit },
      { focalPixels: focal, principalOffsetPixels: [0, 0] });
    return { world, viewport: { widthPixels: width, heightPixels: height, focalPixels: focal, principalOffsetPixels: [0, 0] } };
  },
};
