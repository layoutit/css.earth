/** Reference emission/extinction integration. No slab approximation or runtime rendering. */
import { has,sampleModel,EXTINCTION_RGB,FOREGROUND_EBV,HEIGHT_DISC,gaussian,type Model } from './model.mts';
import { add,mul,normalize,rayInBody,bodyToIcrs,cross,dot,type V3 } from './geometry.mts';
import {at,type NativeStars} from './inputs.mts';
import {foregroundFraction} from './native.mts';
export interface Basis {width:number;height:number;planes:Float64Array[];dustGain:number;}
export interface Camera {name:string;width:number;height:number;ray(col:number,row:number):{origin:V3;direction:V3};foreground:boolean;pixelOf?:(p:V3)=>[number,number]|null;areaAt?:(p:V3)=>number;}
export function earthCamera(width:number,height:number,rayAt:(col:number,row:number)=>V3,pixelOfIcrs?:(p:readonly number[])=>[number,number]|null):Camera {
  const center=rayAt(width/2,height/2),a=rayAt(width/2+1,height/2),b=rayAt(width/2,height/2+1),omega=Math.hypot(...cross(add(a,mul(center,-1)),add(b,mul(center,-1))));
  return {name:'earth',width,height,ray:(x,y)=>rayInBody(rayAt(x,y)),foreground:true,
    pixelOf:pixelOfIcrs?p=>pixelOfIcrs(bodyToIcrs(p)):undefined,areaAt:p=>{const v=bodyToIcrs(p);return omega*dot(v,v);}};
}
export function outsideCamera(tiltDegrees:number,size:number,half=8):Camera {
  const angle=tiltDegrees*Math.PI/180,eye:V3=[0,Math.sin(angle),Math.cos(angle)],up:V3=[0,Math.cos(angle),-Math.sin(angle)];
  return {name:`tilt-${tiltDegrees}-half-${half}`,width:size,height:size,foreground:false,pixelOf:p=>[(p[0]/half+1)*size/2,(1-dot(p,up)/half)*size/2],areaAt:()=>((2*half)/size)**2,ray(col,row){
    const x=((col/size)*2-1)*half,y=(1-row/size*2)*half;
    return {origin:add(add([x,0,0],mul(up,y)),mul(eye,30)),direction:mul(eye,-1)};
  }};
}
interface NativeScreen {count:number;x:Float32Array;y:Float32Array;tau:Float32Array;rgb:Float64Array;}
const screens=new WeakMap<NativeStars,Map<string,NativeScreen>>();
function nativeScreen(model:Model,camera:Camera):NativeScreen {
  const stars=model.sources.nativeStars;if(!stars||!camera.pixelOf||!camera.areaAt)throw Error('Missing native projection');
  const key=`${camera.name}-${camera.width}-${camera.height}-warp${has(model,3)}-dust${has(model,6)}`,cache=screens.get(stars)??new Map<string,NativeScreen>();screens.set(stars,cache);
  const existing=cache.get(key);if(existing)return existing;
  const result:NativeScreen={count:0,x:new Float32Array(stars.count),y:new Float32Array(stars.count),tau:new Float32Array(stars.count),rgb:new Float64Array(stars.count*3)},direction=camera.ray(camera.width/2,camera.height/2).direction;
  for(let i=0;i<stars.count;i++){
    const p:V3=[stars.positions[i*3],stars.positions[i*3+1],stars.positions[i*3+2]];
    if(!has(model,3))p[2]-=at(model.sources.warp,p[0],p[1]);
    const pixel=camera.pixelOf(p);if(!pixel||pixel[0]<0||pixel[1]<0||pixel[0]>=camera.width||pixel[1]>=camera.height)continue;
    let tau=0;
    if(!has(model,6))tau=0;
    else if(camera.foreground)tau=stars.earthTau[i];
    else if(Math.abs(direction[2])>.15){const z=p[2]-(has(model,3)?at(model.sources.warp,p[0],p[1]):0);tau=at(model.sources.dust,p[0],p[1])/Math.abs(direction[2])*foregroundFraction(direction[2]<0?z:-z,HEIGHT_DISC/2);}
    else for(let t=.15;t<30;t+=.3){const x=p[0]-direction[0]*t,y=p[1]-direction[1]*t,z=p[2]-direction[2]*t-(has(model,3)?at(model.sources.warp,x,y):0);tau+=at(model.sources.dust,x,y)*gaussian(z,HEIGHT_DISC/2)*.3;}
    const j=result.count++,area=camera.areaAt(p);result.x[j]=pixel[0];result.y[j]=pixel[1];result.tau[j]=tau;
    for(let c=0;c<3;c++)result.rgb[j*3+c]=stars.rgb[i*3+c]/area;
  }
  if(cache.size>=2)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
}
export function boundsInterval(origin:V3,direction:V3):[number,number]|null {
  let lo=0,hi=Infinity;
  for(let c=0;c<3;c++){const bound=c===2?12:20;if(Math.abs(direction[c])<1e-12){if(Math.abs(origin[c])>bound)return null;continue;}
    let a=(-bound-origin[c])/direction[c],b=(bound-origin[c])/direction[c];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}
  return lo<hi?[lo,hi]:null;
}
export function project(model:Model,camera:Camera,step:number,dustGain:number,dustTint:V3=[1,1,1]):Basis {
  const {width,height}=camera,planes=Array.from({length:5},()=>new Float64Array(width*height*3)),sample=new Float64Array(16);
  const attenuation=new Float64Array(3),integral=new Float64Array(15),sourceRatio=new Float64Array(3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const ray=camera.ray(x+.5,y+.5),dir=normalize(ray.direction),interval=boundsInterval(ray.origin,dir);if(!interval)continue;
    const length=interval[1]-interval[0],count=Math.ceil(length/step),ds=length/count,start=interval[0];
    integral.fill(0);attenuation.fill(1);
    for(let k=0;k<count;k++){
      const t=start+(k+.5)*ds,p=add(ray.origin,mul(dir,t));sampleModel(model,p[0],p[1],p[2],sample);
      for(let c=0;c<3;c++){
        const tau=sample[15]*dustGain*EXTINCTION_RGB[c]*dustTint[c]*ds;
        sourceRatio[c]=tau>1e-8?-Math.expm1(-tau)/tau:1-tau/2;
        for(let component=0;component<5;component++)integral[component*3+c]+=attenuation[c]*sample[component*3+c]*ds*sourceRatio[c];
        attenuation[c]*=Math.exp(-tau);
      }
    }
    for(let component=0;component<5;component++)for(let c=0;c<3;c++)planes[component][(y*width+x)*3+c]=integral[component*3+c]*(camera.foreground?Math.exp(-FOREGROUND_EBV*3.41/1.0857362047581296*EXTINCTION_RGB[c]):1);
  }
  if(model.sources.nativeStars&&has(model,5)){
    const stars=nativeScreen(model,camera),luminosity=model.sources.youngFraction*model.youngBudget;
    for(let i=0;i<stars.count;i++){
      const tau=has(model,6)?stars.tau[i]:0,x=stars.x[i]-.5,y=stars.y[i]-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
      for(let c=0;c<3;c++){
        const foreground=camera.foreground?Math.exp(-FOREGROUND_EBV*3.41/1.0857362047581296*EXTINCTION_RGB[c]):1;
        const value=stars.rgb[i*3+c]*luminosity*Math.exp(-tau*dustGain*EXTINCTION_RGB[c]*dustTint[c])*foreground;
        for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){const xx=x0+dx,yy=y0+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height)planes[3][(yy*width+xx)*3+c]+=value*(dx?fx:1-fx)*(dy?fy:1-fy);}
      }
    }
  }
  return{width,height,planes,dustGain};
}
export interface Fit {gains:number[];red:number;blue:number;dust:number;loss:number;iterations:number;}
export function predict(basis:Basis,fit:Fit):Float64Array {
  const out=new Float64Array(basis.width*basis.height*3);
  for(let i=0;i<out.length;i++){let value=0;for(let c=0;c<5;c++)value+=basis.planes[c][i]*fit.gains[c];out[i]=value*(i%3===0?fit.red:i%3===2?fit.blue:1);}
  return out;
}
export interface Target {data:Float64Array;train:Uint8Array;holdout:Uint8Array;}
export function loss(prediction:Float64Array,target:Target,holdout=false):number {
  const mask=holdout?target.holdout:target.train;let sum=0,denom=0;
  for(let p=0;p<mask.length;p++)if(mask[p])for(let c=0;c<3;c++){const i=p*3+c;sum+=(prediction[i]-target.data[i])**2;denom+=target.data[i]**2;}
  return Math.sqrt(sum/Math.max(denom,1e-20));
}
/** Bounded coordinate least squares of global gains only; no local image coefficients. */
export function fitBasis(basis:Basis,target:Target,initial:Fit,free:readonly number[],iterations=24):Fit {
  const fit:Fit={...initial,gains:[...initial.gains],dust:basis.dustGain,iterations:0};
  for(let round=0;round<iterations;round++){
    for(const component of free){let numer=0,denom=0;
      for(let p=0;p<target.train.length;p++)if(target.train[p])for(let c=0;c<3;c++){
        const i=p*3+c,color=c===0?fit.red:c===2?fit.blue:1,b=basis.planes[component][i]*color;let other=0;
        for(let k=0;k<5;k++)if(k!==component)other+=basis.planes[k][i]*fit.gains[k]*color;
        numer+=b*(target.data[i]-other);denom+=b*b;
      }if(denom>0)fit.gains[component]=Math.max(0,Math.min(10,numer/denom));
    }
    if(free.includes(0))for(const c of [0,2]){let numer=0,denom=0;
      for(let p=0;p<target.train.length;p++)if(target.train[p]){const i=p*3+c;let b=0;for(let k=0;k<5;k++)b+=basis.planes[k][i]*fit.gains[k];numer+=b*target.data[i];denom+=b*b;}
      const value=Math.max(.4,Math.min(2.5,numer/Math.max(denom,1e-20)));if(c===0)fit.red=value;else fit.blue=value;
    }fit.iterations++;
  }fit.loss=loss(predict(basis,fit),target);return fit;
}
/** The optical photograph has no leverage on the measured far outskirts. */
export function calibrateVersion(basis:Basis,target:Target,initial:Fit,stage:number):Fit {
  const fixed={...initial,gains:[...initial.gains]};fixed.gains[2]=0;
  const planes=basis.planes.slice();planes[0]=basis.planes[0].map((v,i)=>v+basis.planes[2][i]);planes[2]=new Float64Array(planes[0].length);
  const free=stage===1?[0]:stage===2||stage===3?[0,1]:stage===4?[]:stage===5||stage===6?[0,1,3]:[4];
  const fit=fitBasis({...basis,planes},target,fixed,free);fit.gains[2]=fit.gains[0];return fit;
}
