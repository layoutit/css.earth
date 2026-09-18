import { preparedControlPitch } from "@cssearth/engine";
import { polarGeographicUv } from "./wmts-polar-geometry.mts";
import { prepareCityPageGeometry,cityGeographicFrame } from "./page-geometry.mts";

import type { PageGeometry, GeographicScene, BodyAttitude, CameraPolicy } from './contracts.mts';
const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (degrees: number) => degrees * Math.PI / 180;
const longitude360 = (longitude: number) => (longitude % 360 + 360) % 360;

export function pageCoordinates(page: PageGeometry, longitude: number, latitude: number) {
  const m = page.geographicMatrix;
  if (!m) return null;
  const reference = (page.sourceBounds.west + page.sourceBounds.east) / 2;
  const lon = longitude + 360 * Math.round((reference - longitude) / 360);
  const a = m[0] - lon * m[6], b = m[1] - lon * m[7], c = lon * m[8] - m[2];
  const d = m[3] - latitude * m[6], e = m[4] - latitude * m[7], f = latitude * m[8] - m[5];
  const determinant = a * e - b * d;
  return [(c * e - b * f) / determinant, (a * f - c * d) / determinant];
}

export function prepareLocationPoint(scene: GeographicScene, longitude: number, latitude: number) {
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
      const p=cap.geographicProjection! ,m=p.matrix,x=p.x0+(p.x1-p.x0)*uv[0],y=p.y0+(p.y1-p.y0)*uv[1];
      return [m[0]*x+m[4]*y+m[12],m[1]*x+m[5]*y+m[13],m[14]];
    }
  }
  const polar = Math.abs(latitude) >= 78.75;
  const band = polar ? (latitude > 0 ? 14 : 1) : Math.floor((latitude + 90) / 11.25);
  const page = prepareCityPageGeometry({ level: 0, x: Math.floor(lon / 11.25), y: band }, scene);
  let targetLatitude = latitude;
  const leaf = scene.body.bands.find(b => b.latitudeIndex === band)!
    .leaves[Math.floor(((lon + 180) % 360) / 11.25)];
  const m = cityGeographicFrame(leaf).split(",").map(Number);
  const pointAt = (lat: number) => {
    const [u, v] = pageCoordinates(page, lon, lat)!;
    const x = -.25 + 32.5 * u, y = -.25 + 32.5 * v;
    const w = m[3] * x + m[7] * y + m[15];
    return [0, 1, 2].map(i => (m[i] * x + m[4 + i] * y + m[12 + i]) / w);
  };
  let point = pointAt(targetLatitude);
  if (polar) {
    const cap = scene.body.bands.find(b => b.latitudeIndex === (latitude > 0 ? 15 : 0))!.leaves[0];
    const capZ = Number(cap.style.match(/matrix3d\(([^)]+)\)/)![1].split(",")[14]);
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

export function prepareLocationCamera(scene: GeographicScene, point: readonly number[], zoom: number, { body, camera, northUp = false }: { body: BodyAttitude; camera: CameraPolicy; northUp?: boolean }) {
  const m = body.bodyMatrix;
  const toScene = (point: readonly number[]) => [0, 1, 2].map(row => m[3 * row]! * point[0]! + m[3 * row + 1]! * point[1]! + m[3 * row + 2]! * point[2]!);
  const [x, y, z] = toScene(point);
  const pitch = degrees(Math.atan2(y, Math.hypot(x, z)));
  const yaw = degrees(Math.atan2(-x, z));
  // Project the body's north pole through the destination pitch/yaw. A final
  // screen-axis rotation puts north above the equator without changing the
  // geographic target, body attitude, or shared camera's drag behavior.
  let roll;
  if (northUp) {
    const [nx, ny, nz] = toScene([0, 0, 1]);
    const cy = Math.cos(radians(yaw)), sy = Math.sin(radians(yaw));
    const cp = Math.cos(radians(pitch)), sp = Math.sin(radians(pitch));
    const northX = cy * nx + sy * nz;
    const northY = cp * ny - sp * (-sy * nx + cy * nz);
    roll = degrees(Math.atan2(-northX, -northY));
  }
  return {
    // The recipe states its steepest scene pitch directly; the default camera angles it used to
    // derive this from are prepared, not authored (#294), and are no longer on the recipe camera.
    controlPitch: preparedControlPitch(pitch, { maximumControlPitchDegrees: camera.maximumControlPitchDegrees,
      maximumScenePitchDegrees: camera.maximumScenePitchDegrees }),
    controlYaw: yaw, zoom,
    ...(northUp ? { controlRoll: roll } : {}),
  };
}
