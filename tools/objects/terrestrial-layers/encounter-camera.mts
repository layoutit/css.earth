import { cross3 as cross } from '../../../src/platform/vector3.mts';
import {parseEncounterControl,array,number} from './source-records.mts';
import {requireRecord} from '../../sources/source-values.mts';
// Calibrated detector projection. J2000/body binding and measured pointing
// corrections are authored preparation inputs; no cameras run in the browser.
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);

const unit = (a: readonly number[]) => { const n = Math.hypot(...a); if (!(n > 0)) throw new Error('Degenerate camera vector.'); return a.map(v => v/n); };
export function equatorialVector(ra: number, dec: number) {
  if (![ra, dec].every(Number.isFinite) || Math.abs(dec) > 90) throw new Error('Invalid equatorial direction.');
  const a = ra*Math.PI/180, d = dec*Math.PI/180;
  return [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)];
}
export function validateBodyFrame(value: unknown) {
  const matrix=array(array(number))(value);
  if (!Array.isArray(matrix) || matrix.length !== 3 || matrix.some(row => !Array.isArray(row) || row.length !== 3 || !row.every(Number.isFinite))) throw new Error('Invalid body frame.');
  for (let i=0; i<3; i++) for (let j=0; j<3; j++) if (Math.abs(dot(matrix[i],matrix[j])-(i===j?1:0)) > 1e-8) throw new Error('Body frame must be orthonormal.');
  if (Math.abs(dot(matrix[0],cross(matrix[1],matrix[2]))-1)>1e-8) throw new Error('Body frame must preserve handedness.');
}
const inverse3 = (m: readonly number[][]) => {
  const cols = [cross(m[1],m[2]),cross(m[2],m[0]),cross(m[0],m[1])], det=dot(m[0],cols[0]);
  if (!Number.isFinite(det) || Math.abs(det)<1e-12) throw new Error('Degenerate detector projection.');
  return [0,1,2].map(i=>cols.map(c=>c[i]/det));
};

export function encounterCamera(sourceHeader: unknown, value: unknown) {
  const header=requireRecord(sourceHeader),control=parseEncounterControl(value);
  const numeric=(key:string)=>number(header[key]);
  validateBodyFrame(control.bodyToJ2000);
  const R=control.bodyToJ2000, toBody=(v: readonly number[])=>[0,1,2].map(i=>R.reduce((sum,row,j)=>sum+row[i]*v[j],0));
  const offset=control.offsetPixels;
  if (!Array.isArray(offset) || offset.length!==2 || !offset.every(Number.isFinite) || !Number.isFinite(control.maximumOffsetPixels) ||
      control.maximumOffsetPixels < 0 || Math.hypot(...offset)>control.maximumOffsetPixels) throw new Error('Pointing correction exceeds its documented control budget.');
  let observer: number[], sun: number[], b: number[], qx: number[], qy: number[], cx: number, cy: number, nominalPixelScaleMeters: number;
  if (header.WCS_STAT === 'OK') {
    if (header.DNAXIS1!=='+X, RIGHT' || header.DNAXIS2!=='+Y, UP' || header.CTYPE1!=='RA---TAN' || header.CTYPE2!=='DEC--TAN' || header.CUNIT1!=='deg' || header.CUNIT2!=='deg') throw new Error('Unsupported NAVCAM WCS.');
    observer=['X','Y','Z'].map(a=>-numeric(`SCTARGR${a}`));
    sun=['X','Y','Z'].map((a,i)=>numeric(`SCSUNR${a}`)+observer[i]);
    b=equatorialVector(numeric("CRVAL1"),numeric("CRVAL2"));
    const east=equatorialVector(numeric("CRVAL1")+90,0), north=cross(b,east);
    const pc=[[numeric("CDELT1")*numeric("PC1_1"),numeric("CDELT1")*numeric("PC1_2")],[numeric("CDELT2")*numeric("PC2_1"),numeric("CDELT2")*numeric("PC2_2")]];
    const det=pc[0][0]*pc[1][1]-pc[0][1]*pc[1][0];
    if (!Number.isFinite(det) || Math.abs(det)<1e-14) throw new Error('Invalid NAVCAM pixel scale.');
    qx=east.map((v,i)=>(pc[1][1]*v-pc[0][1]*north[i])/det*180/Math.PI);
    qy=east.map((v,i)=>(-pc[1][0]*v+pc[0][0]*north[i])/det*180/Math.PI);
    cx=numeric("CRPIX1")-1; cy=numeric("CRPIX2")-1;
    nominalPixelScaleMeters=Math.hypot(...observer)*1000*Math.PI/180*Math.hypot(pc[0][0],pc[1][0]);
  } else {
    if (header.GEOMSTAT!=='OK' || header.GEOMQUAL!=='RECONSTRUCTED' || header.DNAXIS1!=='RIGHT, +Xinstr' || header.DNAXIS2!=='UP, -Yinstr') throw new Error('Unqualified EPOXI image geometry.');
    observer=['X','Y','Z'].map(a=>numeric(`TARSCR${a}`));
    sun=['X','Y','Z'].map(a=>numeric(`TARSUNR${a}`));
    b=equatorialVector(numeric("BORERA"),numeric("BOREDEC"));
    const east=equatorialVector(numeric("BORERA")+90,0), north=cross(b,east), angle=numeric("CELESTN")*Math.PI/180;
    const focal=numeric("TARSCR")*1000/numeric("PXLSCALE");
    if (!(focal>0) || !Number.isFinite(focal) || !Number.isFinite(angle)) throw new Error('Invalid EPOXI pixel scale.');
    qx=east.map((v,i)=>focal*(-v*Math.cos(angle)+north[i]*Math.sin(angle)));
    qy=east.map((v,i)=>focal*(v*Math.sin(angle)+north[i]*Math.cos(angle)));
    cx=(numeric("NAXIS1")-1)/2; cy=(numeric("NAXIS2")-1)/2; nominalPixelScaleMeters=numeric("PXLSCALE");
  }
  if (![...observer,...sun,cx,cy,...qx,...qy].every(Number.isFinite)) throw new Error('Missing encounter geometry.');
  const rows=[qx.map((v,i)=>v+(cx+offset[0])*b[i]),qy.map((v,i)=>v+(cy+offset[1])*b[i]),b];
  const M=rows.map(toBody), inverse=inverse3(M), eye=toBody(observer).map(n=>n*1000), sunDirection=unit(toBody(sun));
  const project=(point: readonly number[])=>{
    const delta=point.map((v,i)=>v-eye[i]), depth=dot(M[2],delta);
    return depth>0 ? [dot(M[0],delta)/depth,dot(M[1],delta)/depth,depth] : null;
  };
  const ray=(x: number,y: number)=>unit(inverse.map(row=>dot(row,[x,y,1])));
  return { project, ray, positionMeters:eye, positionKm:eye.map(n=>n/1000), sunDirection,
    report:{ nominalPixelScaleMeters, bodyToJ2000:R, offsetPixels:offset, maximumOffsetPixels:control.maximumOffsetPixels,
      sourcePixelOrigin:'zero-based pixel centers; stored rows increase upward', positionKm:eye.map(n=>n/1000) } };
}
