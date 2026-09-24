import { cross3 as cross } from '@cssearth/core';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const day=86400000, radians=Math.PI/180;
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);

const unit=(a:readonly number[])=>a.map(n=>n/Math.hypot(...a));
const direction=(ra:number,dec:number)=>[Math.cos(dec*radians)*Math.cos(ra*radians),Math.cos(dec*radians)*Math.sin(ra*radians),Math.sin(dec*radians)];
function rotate(v:readonly number[],axis:readonly number[],angle:number) {
  const c=Math.cos(angle),s=Math.sin(angle),k=cross(axis,v),d=dot(axis,v);
  return v.map((n,i)=>n*c+k[i]*s+axis[i]*d*(1-c));
}
type Row={time:number;position:number[]};
function interpolate(rows:Row[],time:number) {
  assert.ok(time>=rows[0].time);
  let high=rows.findIndex(row=>row.time>=time);
  if(high<0) high=rows.length-1;
  if(high===0) high=1;
  const a=rows[high-1],b=rows[high],t=(time-a.time)/(b.time-a.time);
  return a.position.map((n,i)=>n+(b.position[i]-n)*t);
}

/** The same approximate long-axis frame used by the accepted Giotto projection.
 * SPDF defines CSE position Z along ecliptic north and XY parallel to the ecliptic;
 * the interpolated heliocentric trajectory fixes its sunward azimuth. Obliquity
 * is for 1986.2; omitted precession to J2000 is below 0.2 degrees. */
export async function deriveVegaCamera(sourceDirectory:string,utc:string) {
  const rotation=await readFile(resolve(sourceDirectory,'giotto/rotation-2004.tab'),'utf8');
  const row=rotation.split(/\r?\n/).find(row=>row.includes('1P/Halley'));
  assert.ok(row);
  // This parser is deliberately bound to the documented, rounded Halley row.
  const columns=row.trim().split(/\s+/);
  assert.equal(columns[4],'LAM');
  const precessionPeriod=Number(columns[5]),rollPeriod=Number(columns[8]);
  assert.equal(columns[16],'Y');
  const momentum=direction(Number(columns[14]),Number(columns[15]));
  const initialAxis=direction(Number(columns[17]),Number(columns[18]));
  const epoch=Date.UTC(2000,0,1,12)+(Number(columns[19])-2451545)*day;
  assert.ok(precessionPeriod>0 && rollPeriod>0 && Number.isFinite(epoch));
  const flybyText=await readFile(resolve(sourceDirectory,'giotto/vega2-flyby.txt'),'utf8');
  const flyby=flybyText.trim().split(/\r?\n/).slice(2).map(line=>{
    const c=line.trim().split(/\s+/).map(Number);
    return {time:Date.UTC(c[0],c[1]-1,c[2],c[3],c[4])+c[5]*1000,position:c.slice(10,13)};
  });
  const trajectoryText=await readFile(resolve(sourceDirectory,'giotto/vega2-trajectory.txt'),'utf8');
  const trajectory=trajectoryText.trim().split(/\r?\n/).slice(4).map(line=>{
    const c=line.trim().split(/\s+/);
    return {time:Date.parse(`${c[0]}T${c[1]}Z`),position:c.slice(2,5).map(Number)};
  });
  const north=rotate([0,0,1],[1,0,0],23.4411*radians);
  const inertial=(time:number)=>{
    const position=interpolate(flyby,time),helio=interpolate(trajectory,time);
    const x=unit([-helio[0],-helio[1],0]),y=cross([0,0,1],x);
    const ecliptic=[0,1,2].map(k=>x[k]*position[0]+y[k]*position[1]+(k===2?position[2]:0));
    return {position:rotate(ecliptic,[1,0,0],23.4411*radians),sun:rotate(x,[1,0,0],23.4411*radians)};
  };
  const anchor=Date.parse('1986-03-09T07:19:58Z'),time=Date.parse(utc);
  assert.ok(time>=anchor-500000 && time<=anchor+500000,'Only the qualified close encounter is supported');
  const anchorEye=unit(inertial(anchor).position);
  const z0=rotate(initialAxis,momentum,(anchor-epoch)/day/precessionPeriod*2*Math.PI);
  const y0=unit(anchorEye.map((n,i)=>-(n-z0[i]*dot(anchorEye,z0)))),x0=cross(y0,z0);
  const dt=(time-anchor)/day,psi=dt/rollPeriod*2*Math.PI,phi=dt/precessionPeriod*2*Math.PI;
  const columnsAtTime=[x0.map((n,i)=>n*Math.cos(psi)+y0[i]*Math.sin(psi)),y0.map((n,i)=>n*Math.cos(psi)-x0[i]*Math.sin(psi)),z0].map(v=>rotate(v,momentum,phi));
  const toBody=(v:readonly number[])=>columnsAtTime.map(column=>dot(column,v));
  const state=inertial(time),eye=unit(state.position),right=unit(cross(north,eye)),up=cross(eye,right);
  const bodyEye=toBody(eye),bodySun=toBody(state.sun);
  return {bodyEye,bodySun,bodyRight:toBody(right),bodyUp:toBody(up),
    eastLongitudeDegrees:(Math.atan2(bodyEye[1],bodyEye[0])/radians+360)%360,
    latitudeDegrees:Math.asin(bodyEye[2])/radians,
    rangeKm:Math.hypot(...state.position),phaseDegrees:Math.acos(dot(eye,state.sun))/radians,
    sunCounterclockwiseFromUpDegrees:(360-Math.atan2(dot(state.sun,right),dot(state.sun,up))/radians)%360,
    extrapolationSeconds:Math.max(0,(time-flyby.at(-1)!.time)/1000)};
}
