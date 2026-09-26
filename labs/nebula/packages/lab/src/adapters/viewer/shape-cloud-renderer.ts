/** cssEarth camera representation binding; generic view math lives in volume-viewer. */
import type { ShapeCloudCameraBackend } from '@cssearth/volume-viewer/camera/shape-cloud';
import { worldCameraFromCenteredPresentation } from '@cssearth/renderer/navigation/world-camera.ts';
import { worldRotationCss, worldRotationFromQuaternion } from '@cssearth/renderer/navigation/world-camera-math.ts';
import { preparedVolumeCameraTransform } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';

export const shapeCloudCameraBackend: ShapeCloudCameraBackend<VolumeCameraPublication> = {
  cssPixelsPerUnit: 50,
  publication(frame, image, viewport, framing, rotation, distanceUnits, focalPixels) {
    const local = worldRotationFromQuaternion(frame.localToReferenceXyzw);
    // Prepared physical axes are west/north/toward. The source-facing CSS presentation has
    // z away, so its mapping into the physical frame is a reflection, never a quaternion.
    const presentationToReference = [local[0]!, local[1]!, -local[2]!, local[3]!, local[4]!, -local[5]!, local[6]!, local[7]!, -local[8]!];
    const world = worldCameraFromCenteredPresentation({ rotation, distanceUnits }, {
      ...frame, presentationToReference,
      bodyRadiusM: image.width * image.unitsPerPixel * frame.metersPerUnit / 2,
    }, { focalPixels, principalOffsetPixels: [0, 0] });
    return { world, viewport: { widthPixels: viewport.width, heightPixels: viewport.height, focalPixels,
      principalOffsetPixels: [framing.panX, framing.panY] } };
  },
  rotation(publication, frame) { return preparedVolumeCameraTransform(publication, frame).rotation; },
  rotationCss: worldRotationCss,
};
