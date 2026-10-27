export type Vec = [number, number, number];
export interface Star { name:string; hip:number; at:Vec; temperatureK:number; radiusSolar:number; massSolar:number; luminositySolar:number; spectralWNm:Vec }
export interface Grain { radiusMicron:number; weight:number; materialDensityGcm3:number; qPr:number }
export interface Inputs { stars:Star[]; grains:Grain[]; gasVelocityPcYr:Vec; upstream:Vec; speedKmS:number; columnEbv(x:number,y:number):number; grainOptical:{albedo:Vec;g:Vec;extinctionRatio:Vec}; reference:{normal:Vec;east:Vec;north:Vec}; metadata:Record<string,unknown> }
export const PC=3.085677581491367e16,YEAR=365.25*86400;
export const scale=(a:Vec,k:number):Vec=>[a[0]*k,a[1]*k,a[2]*k];
export const dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const unit=(v:Vec):Vec=>scale(v,1/Math.hypot(...v));
export const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
export const hg=(mu:number,g:number)=>(1-g*g)/(4*Math.PI*(1+g*g-2*g*clamp(mu,-1,1))**1.5);
