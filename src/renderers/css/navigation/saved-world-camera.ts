import type { SharedView } from './view-url.js';
import { parseSharedView, formatSharedView } from './view-url.js';
import type { PreparedWorldCameraFrame, WorldCameraViewport } from './world-camera.js';
import { worldCameraFromCenteredPresentation, worldCameraFromPresentation } from './world-camera.js';

/** Resolve a validated saved camera before flight so Back lands at its exact view. */
export function savedWorldCamera(saved: SharedView, frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport) {
  const view = parseSharedView(formatSharedView(saved))!;
  if (view.preparedEpochJdTt !== frame.epochJdTt) throw new TypeError('Saved camera has a different prepared epoch.');
  const camera = view.camera;
  const components = camera.pose.scene.slice(9, -1).split(',').map(Number);
  const rotation = [components[0], components[4], components[8], components[1], components[5],
    components[9], components[2], components[6], components[10]];
  if (camera.bodyCenterKilometers) {
    const units = camera.bodyCenterKilometers.map(value => value * 1000 / frame.metersPerUnit);
    return worldCameraFromPresentation({ rotation, bodyCenterUnits: [units[0], units[1], units[2]] }, frame);
  }
  return worldCameraFromCenteredPresentation({ rotation,
    distanceUnits: camera.distanceKilometers * 1000 / frame.metersPerUnit }, frame, viewport);
}
