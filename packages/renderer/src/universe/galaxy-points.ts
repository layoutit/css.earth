import { parseDensityVolumeFrame } from '@cssearth/objects';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';
import type { PreparedVolumeRuntime } from '../volume/types.js';
import { mountBatchedSpatialPoints } from './batched-spatial-points.js';
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Invalid point manifest');
  return v as Record<string, unknown>;
}
export async function mountGalaxyPoints({host, manifestUrl, cloudUrl}: {host: HTMLElement; manifestUrl: string; cloudUrl?: string}): Promise<PreparedVolumeRuntime> {
  const response = await fetch(manifestUrl); if (!response.ok) throw new Error('Point manifest unavailable');
  const bytes=await response.arrayBuffer();
  const data = record(JSON.parse(new TextDecoder().decode(bytes)));
  if (data.schema !== 'cssearth-galaxy-points@1' || !Array.isArray(data.points) || data.points.length > 1800) throw new TypeError('Invalid prepared points');
  const frame = parseDensityVolumeFrame(data.frame);
  const appearance=record(data.appearance);
  const positive=(value:unknown)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError('Invalid field appearance');return value;};
  const pointExposure=positive(appearance.pointExposure), pointReferenceDistanceMpc=positive(appearance.pointReferenceDistanceMpc), cloudExposure=positive(appearance.cloudExposure), cloudMaximumOpacity=positive(appearance.cloudMaximumOpacity);
  const points = data.points.map(v => {
    const p = record(v), xyz = p.position;
    if (!Array.isArray(xyz) || xyz.length !== 3 || !xyz.every(n => typeof n === 'number' && Number.isFinite(n)) ||
        typeof p.brightness !== 'number' || !Number.isFinite(p.brightness) || p.brightness <= 0 || p.brightness > 1 ||
        typeof p.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(p.color)) throw new TypeError('Invalid prepared point');
    return {position: [xyz[0], xyz[1], xyz[2]] as [number,number,number], brightness: p.brightness, color: p.color};
  });
  const pointRuntime=mountBatchedSpatialPoints({host,frame,points:points.map(point=>({positionUnits:point.position,...point})),className:'galaxy-direct-points',
    stylePoint(point,distance){
      const signal=pointExposure*point.brightness*(pointReferenceDistanceMpc/Math.max(1,distance))**2;
      const proximity=Math.max(0,Math.min(1,(distance-.2)/.8));
      return {colorCss:point.color,opacity:signal/(1+signal)*proximity*proximity*(3-2*proximity),radiusPx:1};
    }});
  const root=pointRuntime.root;
  if (!Array.isArray(data.clouds) || data.clouds.length > 160) throw new TypeError('Invalid cloud bank');
  const clouds = data.clouds.map(value => {
    const c=record(value), p=c.position;
    if(!Array.isArray(p)||p.length!==3||!p.every(n=>typeof n==='number'&&Number.isFinite(n))||typeof c.radius!=='number'||!Number.isFinite(c.radius)||c.radius<=0||typeof c.brightness!=='number'||!Number.isFinite(c.brightness)||c.brightness<0||c.brightness>.15)throw new TypeError('Invalid cloud');
    if(!Array.isArray(c.covariance)||c.covariance.length!==9||!c.covariance.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new TypeError('Invalid cloud covariance');
    const covariance: number[]=c.covariance;
    const node=host.ownerDocument.createElement('img');node.alt='';node.src=cloudUrl ?? new URL('cloud.webp',new URL(manifestUrl,location.href)).href;
    Object.assign(node.style,{position:'absolute',left:'50%',top:'50%',pointerEvents:'none'});root.prepend(node);
    return {position:[p[0],p[1],p[2]] as [number,number,number],radius:c.radius,brightness:c.brightness,covariance,node};
  });
  await Promise.all(clouds.map(c=>c.node.decode()));
  let previousCamera: number[] = [];
  return {roots:[root],publish({world,viewport}) {
    const started=performance.now();
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const camera=[...local.positionUnits,...local.orientationXyzw,viewport.focalPixels,...viewport.principalOffsetPixels,viewport.widthPixels??0,viewport.heightPixels??0];
    if(camera.length===previousCamera.length && camera.every((value,i)=>value===previousCamera[i]))return;
    previousCamera=camera;
    for(const c of clouds){
      const x=c.position[0]-local.positionUnits[0],y=c.position[1]-local.positionUnits[1],z=c.position[2]-local.positionUnits[2];
      const depth=-(r[2]!*x+r[5]!*y+r[8]!*z);
      if(depth<=0){c.node.style.display='none';continue;}
      const sx=viewport.focalPixels*(r[0]!*x+r[3]!*y+r[6]!*z)/depth+viewport.principalOffsetPixels[0];
      const sy=viewport.focalPixels*(r[1]!*x+r[4]!*y+r[7]!*z)/depth+viewport.principalOffsetPixels[1];
      const right=[r[0]!,r[3]!,r[6]!], down=[r[1]!,r[4]!,r[7]!];
      const form=(a:number[],b:number[])=>a.reduce((sum,v,i)=>sum+v*b.reduce((s,w,j)=>s+c.covariance[i*3+j]!*w,0),0);
      const a=form(right,right),b=form(right,down),d=form(down,down);
      const delta=Math.hypot(a-d,2*b), major=Math.sqrt(Math.max(.01,(a+d+delta)/2)),minor=Math.sqrt(Math.max(.01,(a+d-delta)/2));
      const size=6*major*viewport.focalPixels/depth, height=6*minor*viewport.focalPixels/depth;
      const angle=.5*Math.atan2(2*b,a-d);
      c.node.style.transformOrigin='50% 50%';
      c.node.style.display='block';c.node.style.width=`${size}px`;c.node.style.height=`${height}px`;
      c.node.style.opacity=String(Math.min(cloudMaximumOpacity,cloudExposure*c.brightness)*Math.min(1,depth/c.radius));
      c.node.style.transform=`translate(${sx-size/2}px,${sy-height/2}px) rotate(${angle}rad)`;
    }
    pointRuntime.publish({world,viewport});
    root.dataset.residentElements=String(pointRuntime.nodes.length+clouds.length+1);
    root.dataset.publishMs=(performance.now()-started).toFixed(2);
  },destroy(){pointRuntime.destroy();}};
}
