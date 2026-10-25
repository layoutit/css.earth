/** Effective foreground fraction converted to a continuous Gaussian-layer ordering. */
import {need} from '../inputs.mts';
export const DUST_SIGMA=.25,OLD_SIGMA=.36656497062880344;
/** Five-point Gauss-Hermite quadrature for a unit-variance normal distribution. */
export const DEPTH_NODES=[{z:-2.8569700138728056,weight:.0112574113277207},{z:-1.355626179974266,weight:.2220759220056126},{z:0,weight:.5333333333333333},{z:1.355626179974266,weight:.2220759220056126},{z:2.8569700138728056,weight:.0112574113277207}];
export function cdf(x:number){const t=1/(1+.2316419*Math.abs(x)),p=t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429)))),tail=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*p;return x>=0?1-tail:tail;}
export function fractionAtHeight(height:number){return DEPTH_NODES.reduce((s,n)=>s+n.weight*cdf((height+n.z*DUST_SIGMA)/OLD_SIGMA),0);}
export function inferHeight(frontAv:number,totalAv:number){need(Number.isFinite(frontAv)&&frontAv>=0&&Number.isFinite(totalAv)&&totalAv>0,'Invalid regional columns');const raw=frontAv/totalAv,fraction=Math.max(.02,Math.min(.98,raw));let lo=-1.5,hi=1.5;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(fractionAtHeight(mid)<fraction)lo=mid;else hi=mid;}return{rawFraction:raw,fraction,height:(lo+hi)/2,clipped:raw!==fraction};}
