import { polarGeographicUv } from "./wmts-polar-geometry.mjs";
import { prepareCityPageGeometry,cityGeographicFrame } from "./page-geometry.mjs";
import { EARTH_CUBIC_CAMERA } from "../prepared-camera.mjs";

const degrees = radians => radians * 180 / Math.PI;
const radians = degrees => degrees * Math.PI / 180;
const longitude360 = longitude => (longitude % 360 + 360) % 360;

export function pageCoordinates(page, longitude, latitude) {
  const m = page.geographicMatrix;
  if (!m) return null;
  const reference = (page.sourceBounds.west + page.sourceBounds.east) / 2;
  const lon = longitude + 360 * Math.round((reference - longitude) / 360);
  const a = m[0] - lon * m[6], b = m[1] - lon * m[7], c = lon * m[8] - m[2];
  const d = m[3] - latitude * m[6], e = m[4] - latitude * m[7], f = latitude * m[8] - m[5];
  const determinant = a * e - b * d;
  return [(c * e - b * f) / determinant, (a * f - c * d) / determinant];
}

export function prepareLocationPoint(scene, longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error("Invalid city coordinates.");
  }
  const lon = longitude360(longitude);
  // The accepted square cap includes a visible apron below 78.75 degrees.
  // Destinations on that apron must target its prepared geographic position;
  // aiming at the lower band plane can put the view kilometres off-centre.
  if(Math.abs(latitude)>67.5){
    const cap=prepareCityPageGeometry({level:0,x:0,y:latitude>0?15:0},scene);
    const uv=polarGeographicUv(cap,longitude,latitude);
    if(uv.every(value=>value>=0&&value<=1)){
      const p=cap.geographicProjection,m=p.matrix,x=p.x0+(p.x1-p.x0)*uv[0],y=p.y0+(p.y1-p.y0)*uv[1];
      return [m[0]*x+m[4]*y+m[12],m[1]*x+m[5]*y+m[13],m[14]];
    }
  }
  const polar = Math.abs(latitude) >= 78.75;
  const band = polar ? (latitude > 0 ? 14 : 1) : Math.floor((latitude + 90) / 11.25);
  const page = prepareCityPageGeometry({ level: 0, x: Math.floor(lon / 11.25), y: band }, scene);
  let targetLatitude = latitude;
  const leaf = scene.body.bands.find(b => b.latitudeIndex === band)
    .leaves[Math.floor(((lon + 180) % 360) / 11.25)];
  const m = cityGeographicFrame(leaf).split(",").map(Number);
  const pointAt = lat => {
    const [u, v] = pageCoordinates(page, lon, lat);
    const x = -.25 + 32.5 * u, y = -.25 + 32.5 * v;
    const w = m[3] * x + m[7] * y + m[15];
    return [0, 1, 2].map(i => (m[i] * x + m[4 + i] * y + m[12 + i]) / w);
  };
  let point = pointAt(targetLatitude);
  if (polar) {
    const cap = scene.body.bands.find(b => b.latitudeIndex === (latitude > 0 ? 15 : 0)).leaves[0];
    const capZ = Number(cap.style.match(/matrix3d\(([^)]+)\)/)[1].split(",")[14]);
    // A bounded preparation-only solve finds the actual regular/cap seam.
    let lo = latitude > 0 ? 67.5 : -89, hi = latitude > 0 ? 89 : -67.5;
    for (let i = 0; i < 45; i++) {
      targetLatitude = (lo + hi) / 2;
      if (pointAt(targetLatitude)[2] < capZ) lo = targetLatitude; else hi = targetLatitude;
    }
    point = pointAt(targetLatitude);
    const ratio = Math.cos(radians(latitude)) / Math.cos(radians(78.75));
    point = [point[0] * ratio, point[1] * ratio, capZ];
  }
  return point;
}

export function prepareLocationCamera(scene, point, zoom) {
  const rotateZ = (p, angle) => {
    const c = Math.cos(radians(angle)), s = Math.sin(radians(angle));
    return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
  };
  let [x, y, z] = rotateZ(point, -scene.earth.meshRotationDegrees);
  const tilt = radians(-scene.earth.obliquityDegrees);
  [x, z] = [Math.cos(tilt) * x + Math.sin(tilt) * z, -Math.sin(tilt) * x + Math.cos(tilt) * z];
  [x, y, z] = rotateZ([x, y, z], -scene.earth.presentationNodeDegrees);
  const pitch = degrees(Math.atan2(y, Math.hypot(x, z)));
  return {
    controlPitch: EARTH_CUBIC_CAMERA.defaultControlPitchDegrees +
      (1 - pitch / EARTH_CUBIC_CAMERA.initialScenePitchDegrees) *
      (EARTH_CUBIC_CAMERA.maximumControlPitchDegrees - EARTH_CUBIC_CAMERA.defaultControlPitchDegrees),
    controlYaw: degrees(Math.atan2(-x, z)), zoom,
  };
}
