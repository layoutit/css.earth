/** The approved body's kpc coordinates placed in the shared heliocentric ICRF scene. */
import{worldQuaternionFromRotation}from'@cssearth/engine';import{bodyToSky,WEST,NORTH,TOWARD,ORIGIN_ICRS,add,mul,type V3}from'../geometry.mts';
export const KPC_M=3.0856775814913673e19;
export function bodyDirectionToIcrs(v:V3):V3{const p=bodyToSky(v);return add(add(mul(WEST,p[0]),mul(NORTH,p[1])),mul(TOWARD,p[2]));}
export function deliveryPhysicalFrame(){const x=bodyDirectionToIcrs([1,0,0]),y=bodyDirectionToIcrs([0,1,0]),z=bodyDirectionToIcrs([0,0,1]);return{referenceFrame:'sun-icrf',epochJdTt:2461286.5,originM:mul(ORIGIN_ICRS,KPC_M),localToReferenceXyzw:worldQuaternionFromRotation([x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]]),metersPerUnit:KPC_M/1000};}
