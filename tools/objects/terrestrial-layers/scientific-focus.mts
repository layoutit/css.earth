import {parseScientificFocus,parseScientificCamera} from './source-records.mts';
import {prepareEclipticPresentationFrame} from '../../../src/platform/solar-presentation-frame.mts';
import {preparedControlPitch} from '@cssearth/engine';

/** A geographic target is a body-fixed direction; the ecliptic presentation frame is where the drawn body puts it (the
 * world-navigation stage solves the carrier so that holds). The runtime receives only the existing camera destination contract. */
export function prepareScientificFocus(bodyId: string, value: unknown, cameraValue: unknown) {
  const focus=parseScientificFocus(value),camera=parseScientificCamera(cameraValue);
  if (!focus || ![focus.longitudeDegrees,focus.latitudeDegrees,focus.zoom].every(Number.isFinite) ||
      focus.longitudeDegrees < 0 || focus.longitudeDegrees >= 360 || Math.abs(focus.latitudeDegrees)>90 ||
      focus.zoom < camera.minimumZoom || focus.zoom > camera.maximumZoom ||
      !(camera.maximumControlPitchDegrees > 0) || !(camera.maximumScenePitchDegrees > 0)) {
    throw new TypeError('Scientific focus requires geographic coordinates and an existing supported camera zoom.');
  }
  const lon=focus.longitudeDegrees*Math.PI/180, lat=focus.latitudeDegrees*Math.PI/180;
  const local=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
  const [x,y,z]=prepareEclipticPresentationFrame(bodyId).toPresentation(local);
  const pitch=Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
  return {controlPitch:preparedControlPitch(pitch,camera),
    controlYaw:Math.atan2(-x,z)*180/Math.PI,zoom:focus.zoom};
}

/** Keep the camera destination and its allowed zoom in the existing renderer
 * navigation contract. Surface preparation emits this record unchanged. */
export function prepareScientificNavigation(bodyId: string, focus: unknown, cameraValue: unknown) {
  const camera=parseScientificCamera(cameraValue);
  return {maximumZoom: camera.maximumZoom, camera: prepareScientificFocus(bodyId, focus, camera)};
}
