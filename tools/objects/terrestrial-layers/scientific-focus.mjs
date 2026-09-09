import {prepareEclipticPresentationFrame} from '../../../src/platform/solar-presentation-frame.mjs';

/** Geographic targets bind to the existing solid PolyCSS leaf axes (X/Y
 * swapped by its polygon planner), then to the prepared physical carrier.
 * The runtime receives only the existing camera destination contract. */
export function prepareScientificFocus(bodyId, focus, camera) {
  if (!focus || ![focus.longitudeDegrees,focus.latitudeDegrees,focus.zoom].every(Number.isFinite) ||
      focus.longitudeDegrees < 0 || focus.longitudeDegrees >= 360 || Math.abs(focus.latitudeDegrees)>90 ||
      focus.zoom < camera.minimumZoom || focus.zoom > camera.maximumZoom ||
      !camera.initialScenePitchDegrees || camera.maximumControlPitchDegrees === camera.defaultControlPitchDegrees) {
    throw new TypeError('Scientific focus requires geographic coordinates and an existing supported camera zoom.');
  }
  const lon=focus.longitudeDegrees*Math.PI/180, lat=focus.latitudeDegrees*Math.PI/180;
  const local=[Math.cos(lat)*Math.sin(lon),Math.cos(lat)*Math.cos(lon),Math.sin(lat)];
  const [x,y,z]=prepareEclipticPresentationFrame(bodyId).toPresentation(local);
  const pitch=Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
  return {controlPitch:camera.defaultControlPitchDegrees+(1-pitch/camera.initialScenePitchDegrees)*
    (camera.maximumControlPitchDegrees-camera.defaultControlPitchDegrees),
    controlYaw:Math.atan2(-x,z)*180/Math.PI,zoom:focus.zoom};
}

/** Keep the camera destination and its allowed zoom in the existing renderer
 * navigation contract. Surface preparation emits this record unchanged. */
export function prepareScientificNavigation(bodyId, focus, camera) {
  return {maximumZoom: camera.maximumZoom, camera: prepareScientificFocus(bodyId, focus, camera)};
}
