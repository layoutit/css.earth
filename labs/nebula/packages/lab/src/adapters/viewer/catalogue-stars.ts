/** Retained catalogue points: runtime projects prepared XYZ only, never source astrometry. */
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { projectPreparedPoint } from '@cssearth/volume-viewer/camera/point-projection';
import { cssViewFromOrientation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { WorldCameraPose, WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import { mountCatalogueStars } from '@cssearth/volume-viewer/scene/catalogue-stars';

import { parsePreparedLmcStars, type PreparedLmcStars } from '@cssearth/bake/volume';
export { parsePreparedLmcStars, type PreparedLmcStars, type PreparedLmcStar } from '@cssearth/bake/volume';

export function mountPreparedLmcStars({ host, payload, before = null }: {
  host: HTMLElement; payload: PreparedLmcStars; before?: Node | null;
}) {
  parsePreparedLmcStars(payload, payload.frame);
  return mountCatalogueStars({ host, payload, before, className: 'prepared-lmc-stars',
    projection({ world, viewport }: { world: WorldCameraPose; viewport: WorldCameraViewport }, host) {
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt)
      throw new TypeError('Prepared stars and camera must share a frame and epoch.');
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    // CSS screen y points down, so the projection needs the camera's CSS view, not the bare transposed
    // physical rotation: the same `cssViewFromOrientation` the prepared volume and the shipped catalogue
    // point renderer use. Without the y row reversed the points render mirrored about the principal row.
    const rotation = cssViewFromOrientation(local.orientationXyzw);
    const [ox, oy] = viewport.principalOffsetPixels, focal = viewport.focalPixels;
    if (!(focal > 0) || ![focal, ox, oy].every(Number.isFinite)) throw new TypeError('Invalid star camera viewport.');
    const halfWidth = (viewport.widthPixels ?? host.clientWidth) / 2, halfHeight = (viewport.heightPixels ?? host.clientHeight) / 2;
      return { halfWidth, halfHeight,
        project: (position: readonly [number, number, number]) => projectPreparedPoint(position, local.positionUnits, rotation, focal, ox, oy) };
    },
  });
}
