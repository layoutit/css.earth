import { volumeRenderer } from './volume-renderer';
/** Explicit cssEarth renderer binding; selectors and renderer payloads stay outside volume-viewer. */
import type { CompilerViewerBackend } from '@cssearth/volume-viewer/scene/compiler-viewer';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { projectPreparedPoint } from '@cssearth/volume-viewer/camera/point-projection';
import { cssViewFromOrientation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { PreparedCssVolume, VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import { assertCompilerBankIdentity, assertCompilerLensGeometry } from '../../server/workflows/compiler/bank-validation.ts';

export const compilerRenderer: CompilerViewerBackend<PreparedCssVolume, VolumeCameraPublication> = {
  ...volumeRenderer,
  assertIdentity: assertCompilerBankIdentity,
  assertLensGeometry: assertCompilerLensGeometry,
  starProjection(publication, frame, viewport) {
    const local = presentPhysicalPoseInVolume(publication.world.pose, frame);
    const rotation = cssViewFromOrientation(local.orientationXyzw);
    const [ox, oy] = publication.viewport.principalOffsetPixels, focal = publication.viewport.focalPixels;
    return { focal, halfWidth: (publication.viewport.widthPixels ?? viewport.width) / 2,
      halfHeight: (publication.viewport.heightPixels ?? viewport.height) / 2,
      project(position) { return projectPreparedPoint(frame.referenceFrame === 'lab-sky-angular'
        ? [position[0]!, position[1]!, -position[2]!] : position, local.positionUnits, rotation, focal, ox, oy); } };
  },
};
