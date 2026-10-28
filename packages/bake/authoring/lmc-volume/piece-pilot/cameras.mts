import { worldQuaternionFromRotation, worldRotationCss } from '@cssearth/engine';
import { parsePreparedWorldCameraFrame } from '@cssearth/objects';
import { presentWorldCamera, formatSharedView } from '@cssearth/renderer/navigation';
import { galaxyNearCamera } from '../../milky-way-dust/galaxy-near-cameras.mts';
import { deliveryPhysicalFrame, bodyDirectionToIcrs, KPC_M } from '../delivery/delivery-frame.mts';
import { ORIGIN_ICRS, add, mul, dot, normalize, type V3 } from '../geometry.mts';
import { json, rec, need } from '../inputs.mts';
import type { RegionBox } from './regions.mts';
export function pilotCamera(name: string, size: number, center: V3, widthKpc: number, tilt: number, azimuth: number) {
  const basis = galaxyNearCamera(tilt, azimuth, size, 10, center), distance = 15, eye = add(center, mul(basis.back, distance)), focal = size * distance / widthKpc;
  return { ...basis, name, widthKpc, distance, eye, focal,
    ray(x: number, y: number) { return { origin: eye, direction: normalize(add(mul(basis.back, -focal), add(mul(basis.right, x - size / 2), mul(basis.up, size / 2 - y)))) }; },
    pixelOf(p: V3): [number, number] | null { const v = add(p, mul(eye, -1)), z = -dot(v, basis.back); return z > 0 ? [size / 2 + dot(v, basis.right) * focal / z, size / 2 - dot(v, basis.up) * focal / z] : null; },
    areaAt(p: V3) { return (-dot(add(p, mul(eye, -1)), basis.back) / focal) ** 2; },
  };
}
export function regionCameras(id: string, box: RegionBox, size = 128) {
  const center: V3 = [0,1,2].map(a => (box.min[a]! + box.max[a]!) / 2) as V3;
  const width = 1.8 * Math.hypot(...box.max.map((v, a) => v - box.min[a]!));
  return [[0,0],[45,0],[90,0],[90,30],[90,45],[90,60],[90,90]].map(([tilt,az]) => pilotCamera(id+'-'+tilt+'-'+az,size,center,width,tilt!,az!));
}
export type PilotCamera = ReturnType<typeof pilotCamera>;
export function cameraWorld(c: PilotCamera) {
  const right=bodyDirectionToIcrs(c.right),up=bodyDirectionToIcrs(c.up),back=bodyDirectionToIcrs(c.back);
  return { referenceFrame:'sun-icrf',epochJdTt:deliveryPhysicalFrame().epochJdTt,
    pose:{positionM:mul(add(ORIGIN_ICRS,bodyDirectionToIcrs(c.eye)),KPC_M),orientationXyzw:worldQuaternionFromRotation([right[0],up[0],back[0],right[1],up[1],back[1],right[2],up[2],back[2]])},
    projectionScale:c.focal/(c.width*Math.sqrt(3)/2) };
}
export async function cameraUrl(origin:string,c: PilotCamera) {
  need(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u.test(origin),'Pilot URLs must remain local');
  const frame=parsePreparedWorldCameraFrame(rec(rec(await json('src/objects/lmc/object.json')).properties).worldFrame);need(frame,'Missing shared LMC frame');
  const world=cameraWorld(c),p=presentWorldCamera(world,frame,{focalPixels:c.width*Math.sqrt(3)/2,principalOffsetPixels:[0,0],widthPixels:c.width,heightPixels:c.height});
  const center:V3=p.bodyCenterUnits.map(v=>v*frame.metersPerUnit/1000) as V3;
  return origin+'/lmc/?'+formatSharedView({camera:{distanceKilometers:Math.hypot(...center),bodyCenterKilometers:center,projectionScale:world.projectionScale,pose:{schema:'cssearth-camera-pose@2',scene:worldRotationCss(p.rotation)}},preparedEpochJdTt:frame.epochJdTt,playback:{times:[],speed:1,motionRequested:false}})+'&embed';
}
