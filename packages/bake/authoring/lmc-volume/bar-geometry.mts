/** Gaussian-bar projection in the accepted Choi plane; no image fitting. */
import {bodyToSky,bodyToIcrs,normalize,dot,WEST,NORTH,BAR_ANGLE,BAR_OFFSET,DEG,DISTANCE,type V3} from './geometry.mts';
import {SIGMA_BAR,BAR_RATIO,BAR_LUMINOSITY} from './model.mts';
import {need,rec,num,numbers} from './inputs.mts';
export interface BarGeometry {center:V3;angle:number;sigma:number;ratio:number;sigmaZ:number;luminosity:number;}
export function readBarGeometry(v:unknown):BarGeometry {const r=rec(v),a=numbers(r.center,3),b={center:[a[0],a[1],a[2]] as V3,angle:num(r.angle),sigma:num(r.sigma),ratio:num(r.ratio),sigmaZ:num(r.sigmaZ),luminosity:num(r.luminosity)};need(b.sigma>0&&b.ratio>0&&b.ratio<=1&&b.sigmaZ>0&&b.luminosity>0,'Invalid Gaussian bar');return b;}
export function legacyBar(sigmaZ:number):BarGeometry{return{center:[...BAR_OFFSET],angle:BAR_ANGLE,sigma:SIGMA_BAR,ratio:BAR_RATIO,sigmaZ,luminosity:BAR_LUMINOSITY};}
export function projectedBar(b:BarGeometry){
 const a=bodyToSky([b.sigma*Math.cos(b.angle),b.sigma*Math.sin(b.angle),0]),c=bodyToSky([-b.sigma*b.ratio*Math.sin(b.angle),b.sigma*b.ratio*Math.cos(b.angle),0]),z=bodyToSky([0,0,b.sigmaZ]),xx=a[0]**2+c[0]**2+z[0]**2,yy=a[1]**2+c[1]**2+z[1]**2,xy=a[0]*a[1]+c[0]*c[1]+z[0]*z[1],d=Math.hypot(xx-yy,2*xy),angle=.5*Math.atan2(2*xy,xx-yy);
 return{paDegrees:(Math.atan2(-Math.cos(angle),Math.sin(angle))/DEG+360)%180,sigmaMajorKpc:Math.sqrt((xx+yy+d)/2),axisRatio:Math.sqrt((xx+yy-d)/(xx+yy+d))};
}
export function measuredBar(sigmaZ:number):BarGeometry{
 const b=legacyBar(sigmaZ),targetSigma=4271.76/3600*DEG*DISTANCE,targetPa=121.26;
 const at=(angle:number)=>{const shape={...b,angle};let lo=.8,hi=1.3;for(let i=0;i<45;i++){shape.sigma=(lo+hi)/2;if(projectedBar(shape).sigmaMajorKpc<targetSigma)lo=shape.sigma;else hi=shape.sigma;}shape.sigma=(lo+hi)/2;return shape;};
 let lo=b.angle-10*DEG,hi=b.angle+10*DEG;const delta=(x:number)=>(x-targetPa+270)%180-90;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(delta(projectedBar(at(mid)).paDegrees)>0)hi=mid;else lo=mid;}const result=at((lo+hi)/2);need(Math.abs(projectedBar(result).paDegrees-targetPa)<1e-7,'Measured bar PA conversion failed');return result;
}
export function barSurfaceFor(b:BarGeometry,x:number,y:number){const dx=x-b.center[0],dy=y-b.center[1],u=Math.cos(b.angle)*dx+Math.sin(b.angle)*dy,v=-Math.sin(b.angle)*dx+Math.cos(b.angle)*dy;return b.luminosity*Math.exp(-.5*((u/b.sigma)**2+(v/(b.sigma*b.ratio))**2))/(2*Math.PI*b.sigma**2*b.ratio);}
/** Full finite-distance projection check, integrating the same Gaussian in 3D. */
export function perspectiveBarMoments(b:BarGeometry){
 const centre=bodyToIcrs(b.center),ray=normalize(centre),distance=Math.hypot(...centre);let w=0,x=0,y=0,xx=0,yy=0,xy=0;
 for(let i=0;i<28;i++)for(let j=0;j<28;j++)for(let k=0;k<28;k++){
  const u=(i+.5)/28*10-5,v=(j+.5)/28*10-5,z=(k+.5)/28*10-5,p:V3=[b.center[0]+b.sigma*(u*Math.cos(b.angle)-b.ratio*v*Math.sin(b.angle)),b.center[1]+b.sigma*(u*Math.sin(b.angle)+b.ratio*v*Math.cos(b.angle)),b.center[2]+z*b.sigmaZ],sky=bodyToIcrs(p),d=dot(sky,ray),a=distance*dot(sky,WEST)/d,c=distance*dot(sky,NORTH)/d,q=Math.exp(-.5*(u*u+v*v+z*z))/dot(sky,sky);w+=q;x+=q*a;y+=q*c;xx+=q*a*a;yy+=q*c*c;xy+=q*a*c;
 }
 xx=xx/w-(x/w)**2;yy=yy/w-(y/w)**2;xy=xy/w-x*y/w**2;const delta=Math.hypot(xx-yy,2*xy),angle=.5*Math.atan2(2*xy,xx-yy);return{paDegrees:(Math.atan2(-Math.cos(angle),Math.sin(angle))/DEG+360)%180,sigmaMajorKpc:Math.sqrt((xx+yy+delta)/2),axisRatio:Math.sqrt((xx+yy-delta)/(xx+yy+delta))};
}
