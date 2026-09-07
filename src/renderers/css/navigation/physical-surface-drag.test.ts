import {expect,it} from 'vitest';
import {physicalSurfacePoint,projectPhysicalSurfaceDrag} from './physical-surface-drag.js';

it('keeps a grabbed surface point under the pointer at several altitudes and off-axis views', () => {
  const projection = {centerX:720,centerY:500,opticalCenterX:720,opticalCenterY:500,focalLength:1247,radius:100};
  for (const altitude of [1,60,1000,20000]) {
    const distance=6378+altitude, sphere={radius:6378,center:[distance*.08,0,-distance*Math.sqrt(1-.08*.08)]};
    const pointer={...projection,previousX:810,previousY:510,currentX:850,currentY:525};
    const a=physicalSurfacePoint(pointer.previousX,pointer.previousY,pointer,sphere)!;
    const q=projectPhysicalSurfaceDrag(pointer,sphere);
    // Independently rotate the grabbed 3D point, then project it with the camera.
    const [x,y,z,w]=q, cross=(u:readonly number[],v:readonly number[])=>[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!];
    const t=cross([x!,y!,z!],a).map(v=>v*2), c=cross([x!,y!,z!],t);
    const rotated=a.map((value,i)=>(value+w!*t[i]!+c[i]!)*sphere.radius+sphere.center[i]!);
    expect(projection.opticalCenterX+projection.focalLength*rotated[0]!/-rotated[2]!).toBeCloseTo(pointer.currentX,6);
    expect(projection.opticalCenterY+projection.focalLength*rotated[1]!/-rotated[2]!).toBeCloseTo(pointer.currentY,6);
  }
});

it('continues a captured drag to the horizon while sky presses remain separate', () => {
  const pointer={centerX:0,centerY:0,radius:100,focalLength:1000,previousX:0,previousY:0,currentX:2000,currentY:0};
  const sphere={center:[0,0,-200],radius:100};
  expect(physicalSurfacePoint(2000,0,pointer,sphere)).toBeNull();
  const rotation = projectPhysicalSurfaceDrag(pointer,sphere);
  expect(rotation[0]).toBeCloseTo(0,12);
  expect(rotation[1]).toBeCloseTo(0.5,12);
  expect(rotation[2]).toBeCloseTo(0,12);
  expect(rotation[3]).toBeCloseTo(Math.sqrt(3)/2,12);
  const horizon = 1000/Math.sqrt(3);
  const edge = projectPhysicalSurfaceDrag({...pointer,previousX:horizon-1e-6},sphere);
  expect(Math.hypot(...edge.slice(0,3))).toBeLessThan(0.0001);
  const around = projectPhysicalSurfaceDrag({...pointer,previousX:2000,currentX:2000,currentY:200},sphere);
  expect(Math.hypot(...around.slice(0,3))).toBeGreaterThan(0.01);
  const returned = projectPhysicalSurfaceDrag({...pointer,previousX:2000,currentX:0},sphere);
  for(let i=0;i<3;i++)expect(returned[i]).toBeCloseTo(-rotation[i]!,12);
  expect(returned[3]).toEqual(rotation[3]);
});
