/** Measured sky frame. West, north, toward the observer form a right-handed basis. */
export type V3 = [number, number, number];
export const DEG = Math.PI / 180;
export const DISTANCE = 49.59;
export const INCLINATION = 25.86 * DEG;
export const NODE = 149.23 * DEG;
export const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a: V3, b: V3): V3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const mul = (a: V3, s: number): V3 => [a[0]*s,a[1]*s,a[2]*s];
export const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const normalize = (v: V3): V3 => { const n=Math.hypot(...v); if (!(n>0)) throw Error('Empty vector'); return mul(v,1/n); };
export const unit = (ra: number, dec: number): V3 => [Math.cos(dec*DEG)*Math.cos(ra*DEG),Math.cos(dec*DEG)*Math.sin(ra*DEG),Math.sin(dec*DEG)];
export const skyOf = (v: V3): [number,number] => [(Math.atan2(v[1],v[0])/DEG+360)%360,Math.atan2(v[2],Math.hypot(v[0],v[1]))/DEG];
export const BODY_X: V3 = [-Math.sin(NODE), Math.cos(NODE), 0];
export const BODY_Z: V3 = [-Math.cos(NODE)*Math.sin(INCLINATION),-Math.sin(NODE)*Math.sin(INCLINATION),Math.cos(INCLINATION)];
export const BODY_Y = cross(BODY_Z,BODY_X);
export const bodyToSky = (p: V3): V3 => add(add(mul(BODY_X,p[0]),mul(BODY_Y,p[1])),mul(BODY_Z,p[2]));
export const skyToBody = (p: V3): V3 => [dot(p,BODY_X),dot(p,BODY_Y),dot(p,BODY_Z)];

/** A measured sky PA is transported into the inclined disc, never copied as an XY angle. */
export function barAngle(): number {
  const pa=121.26*DEG, west=-Math.sin(pa),north=Math.cos(pa);
  const toward=-(west*BODY_Z[0]+north*BODY_Z[1])/BODY_Z[2];
  const inPlane=skyToBody(normalize([west,north,toward]));
  return Math.atan2(inPlane[1],inPlane[0]);
}
export const BAR_ANGLE = barAngle();
/** Figure 8's star and circle: (857,705),(870,759), in the bar-aligned plot.
 * The magnitude comes from the table, not the raster scale. Direction is a
 * figure-derived approximation (~0.1 kpc precision), not the quoted 0.01 kpc.
 */
const figureDx=-13, figureDy=54, offset=.76*DISTANCE/49.9;
const f=offset/Math.hypot(figureDx,figureDy);
export const BAR_OFFSET: V3 = [f*(figureDx*Math.cos(BAR_ANGLE)-figureDy*Math.sin(BAR_ANGLE)),f*(figureDx*Math.sin(BAR_ANGLE)+figureDy*Math.cos(BAR_ANGLE)),0];
const barRay=unit(80.27,-69.65),a=80.27*DEG,d=-69.65*DEG;
export const WEST: V3 = [Math.sin(a),-Math.cos(a),0];
export const NORTH: V3 = [-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];
export const TOWARD=mul(barRay,-1);
const offsetSky=bodyToSky(BAR_OFFSET);
// The Fourier center is a proxy for the bar ellipse center; this approximation is recorded.
const offsetIcrs=add(add(mul(WEST,offsetSky[0]),mul(NORTH,offsetSky[1])),mul(TOWARD,offsetSky[2]));
const radialOffset=dot(barRay,offsetIcrs);
const barDistance=radialOffset+Math.sqrt(DISTANCE**2-dot(offsetIcrs,offsetIcrs)+radialOffset**2);
export const ORIGIN_ICRS = add(mul(barRay,barDistance),mul(offsetIcrs,-1));
export const icrsToSky = (p: V3): V3 => { const q=add(p,mul(ORIGIN_ICRS,-1));return [dot(q,WEST),dot(q,NORTH),dot(q,TOWARD)]; };
export const skyToIcrs = (p: V3): V3 => add(ORIGIN_ICRS,add(add(mul(WEST,p[0]),mul(NORTH,p[1])),mul(TOWARD,p[2])));
export const bodyToIcrs = (p: V3): V3 => skyToIcrs(bodyToSky(p));
export function rayPlane(ray: V3): V3 {
  const r: V3=[dot(ray,WEST),dot(ray,NORTH),dot(ray,TOWARD)];
  const o=skyToBody(icrsToSky([0,0,0])),v=skyToBody(r),t=-o[2]/v[2];
  return add(o,mul(v,t));
}
export function rayInBody(ray: V3): { origin: V3; direction: V3 } {
  return {origin:skyToBody(icrsToSky([0,0,0])),direction:skyToBody([dot(ray,WEST),dot(ray,NORTH),dot(ray,TOWARD)])};
}
export function earthRayOfBody(p: V3): V3 {return normalize(bodyToIcrs(p));}
