/** The app's input policy and canonical physical-camera representation. */
import type { InspectionCameraBackend } from '@cssearth/volume-viewer/camera/inspection-camera';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import * as runtimePolicy from '../../../../../../../site/runtime-policy.mts';
import { createObjectInteractionControls } from '@cssearth/renderer/navigation/object-interaction-controls.ts';
import { createCameraMotion } from '@cssearth/renderer/navigation/camera-motion.ts';
import { worldCameraFromCenteredPresentation } from '@cssearth/renderer/navigation/world-camera.ts';
import { referenceRotationFromPresentation, worldRotationFromQuaternion } from '@cssearth/renderer/navigation/world-camera-math.ts';
import { rotationFromMatrix3d } from '@cssearth/renderer/solar-system/heliocentric-geometry.ts';
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
