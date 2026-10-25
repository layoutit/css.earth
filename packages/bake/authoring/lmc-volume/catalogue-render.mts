import {barSurfaceFor} from './bar-geometry.mts';
/** Project canonical 3D objects and smooth published components. No image is sampled here. */
import {at,need} from './inputs.mts';
import {add,mul,dot,normalize,type V3} from './geometry.mts';
import {discSurface,barSurface,outerSurface,gaussian,smoothstep,EXTINCTION_RGB,FOREGROUND_EBV} from './model.mts';
import {BAR_SIGMA_Z} from './depth-model.mts';
import {boundsInterval,type Camera,type Basis} from './render.mts';
import {chord,column,columnTo,emissionNodes,type VolumeObject,type Chord} from './catalogue-volume.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
export interface SparseObject {owner:number;indices:Int32Array;rgb:Float64Array;}
export interface CatalogueProjection {smooth:Basis;objects:SparseObject[];grain?:Float64Array[];metadata:Record<string,unknown>;}
interface Event {owner:number;weight:number;color:V3;t:number;pointComponent?:number;}
interface DustHit {object:VolumeObject;chord:Chord;fineCloud?:boolean;}
interface PixelCloud {pixel:number;value:number;nodes:{t:number;fraction:number}[];}
const sqrt2pi=Math.sqrt(2*Math.PI);
function bbox(v:VolumeObject,camera:Camera):[number,number,number,number]|null {
 if(!camera.pixelOf)return null;const coords=[];for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1]){let p=v.center;for(let k=0;k<3;k++)p=add(p,mul(v.basis[k],v.axes[k]*[a,b,c][k]));const q=camera.pixelOf(p);if(q)coords.push(q);}
 if(!coords.length)return null;return[Math.floor(Math.min(...coords.map(p=>p[0]))-1),Math.ceil(Math.max(...coords.map(p=>p[0]))+1),Math.floor(Math.min(...coords.map(p=>p[1]))-1),Math.ceil(Math.max(...coords.map(p=>p[1]))+1)];
}
function pointProjection(v:VolumeObject,camera:Camera):PixelCloud[] {
 const p=camera.pixelOf?.(v.center);if(!p||!camera.areaAt)return[];const x=p[0]-.5,y=p[1]-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ray=camera.ray(Math.max(0,Math.min(camera.width,p[0])),Math.max(0,Math.min(camera.height,p[1]))),dir=normalize(ray.direction),t=dot(add(v.center,mul(ray.origin,-1)),dir),radius=Math.sqrt(v.axes.reduce((a,r,k)=>a+(dot(v.basis[k],dir)*r)**2,0)),d=radius*Math.sqrt(3/11),nodes=[{t:t-d,fraction:11/54},{t,fraction:16/27},{t:t+d,fraction:11/54}],out:PixelCloud[]=[];
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){const xx=ix+i,yy=iy+j;if(xx<0||yy<0||xx>=camera.width||yy>=camera.height)continue;out.push({pixel:yy*camera.width+xx,value:(i?fx:1-fx)*(j?fy:1-fy)/camera.areaAt(v.center),nodes});}return out;
}
export function projectObject(v:VolumeObject,camera:Camera):PixelCloud[] {
 const box=bbox(v,camera),p=camera.pixelOf?.(v.center);if(!box||!p||!camera.areaAt)return[];if(box[1]<0||box[0]>=camera.width||box[3]<0||box[2]>=camera.height)return[];
 if(Math.max(box[1]-box[0],box[3]-box[2])<=4)return pointProjection(v,camera);
 const pixels:PixelCloud[]=[],area=camera.areaAt(v.center);let mass=0;
 for(let y=Math.max(0,box[2]);y<=Math.min(camera.height-1,box[3]);y++)for(let x=Math.max(0,box[0]);x<=Math.min(camera.width-1,box[1]);x++){
  const samples:{value:number;nodes:{t:number;fraction:number}[]}[]=[];let value=0;
  for(const dy of [.25,.75])for(const dx of [.25,.75]){const ray=camera.ray(x+dx,y+dy),dir=normalize(ray.direction),hit=chord(v,ray.origin,dir);if(!hit)continue;const c=column(v,hit)/4;value+=c;samples.push({value:c,nodes:emissionNodes(v,hit)});}
  mass+=value*area;if(!(value>0)||x<0||y<0||x>=camera.width||y>=camera.height)continue;
  const nodes=samples.flatMap(s=>s.nodes.map(n=>({t:n.t,fraction:n.fraction*s.value/value})));pixels.push({pixel:y*camera.width+x,value,nodes});
 }
 if(!(mass>1e-20))return pointProjection(v,camera);if(box[0]>=0&&box[1]<camera.width&&box[2]>=0&&box[3]<camera.height)for(const p of pixels)p.value/=mass;return pixels;
}
function dustScreens(scene:CatalogueScene,camera:Camera):Map<number,DustHit[]> {
 const screens=new Map<number,DustHit[]>(),legacy=scene.dustLayer&&!scene.dustLayer.retainMolecular?[]:scene.dust,items=[...legacy.map(object=>({object,fineCloud:false})),...(scene.dustLayer?.clouds??[]).map(object=>({object,fineCloud:true}))];for(const {object:v,fineCloud} of items){const b=bbox(v,camera);if(!b)continue;for(let y=Math.max(0,b[2]);y<=Math.min(camera.height-1,b[3]);y++)for(let x=Math.max(0,b[0]);x<=Math.min(camera.width-1,b[1]);x++){
  const ray=camera.ray(x+.5,y+.5),c=chord(v,ray.origin,normalize(ray.direction));if(!c)continue;const id=y*camera.width+x,list=screens.get(id)??[];list.push({object:v,chord:c,...(fineCloud?{fineCloud:true}:{})});screens.set(id,list);
 }}return screens;
}
/** Normalize the catalogue/smooth dust mixture against Bell, using one scalar only. */
export function normalizeCatalogueDust(scene:CatalogueScene):void {
 const bell=scene.sources.dust,dir:V3=[0,0,-1];let measured=0,model=0,n=0;
 for(let y=0;y<bell.n;y+=2)for(let x=0;x<bell.n;x+=2){const i=y*bell.n+x;if(!bell.mask[i])continue;const bx=((x+.5)/bell.n*2-1)*bell.half,by=((y+.5)/bell.n*2-1)*bell.half;let tau=(1-scene.molecularFraction)*discSurface(Math.hypot(bx,by));
  for(const d of scene.dust){const hit=chord(d,[bx,by,12],dir);if(hit)tau+=scene.molecularFraction*d.weight*column(d,hit);}measured+=bell.values[i];model+=tau;n++;
 }
 need(n>100&&model>0&&measured>0,'Missing Bell/catalogue dust overlap');scene.dustArea=measured/model;scene.metadata.dustNormalization={samples:n,observedMeanFaceOnTauV:measured/n,modelMeanFaceOnTauV:scene.dustArea*model/n,area:scene.dustArea,molecularFraction:scene.molecularFraction,spatialBellMapUsed:false};
}
const stepRad=.002,radial=Array.from({length:10002},(_,i)=>[discSurface(i*stepRad),outerSurface(i*stepRad)]);
function radialAt(r:number):[number,number]{const x=Math.min(radial.length-2,r/stepRad),i=Math.floor(x),f=x-i;return[radial[i][0]*(1-f)+radial[i+1][0]*f,radial[i][1]*(1-f)+radial[i+1][1]*f];}
export function projectCatalogue(scene:CatalogueScene,camera:Camera,step=.06):CatalogueProjection {
 if(scene.dustLayer)need(scene.dustLayer.strength>=.25&&scene.dustLayer.strength<=2,'Dust strength must remain bounded and positive');
 const {width,height}=camera,planes=Array.from({length:5},()=>new Float64Array(width*height*3)),grain=scene.oldPopulation?planes.map(v=>new Float64Array(v.length)):undefined,events=new Map<number,Event[]>(),ownerIndex=new Map(scene.owners.map((o,i)=>[o.id,i])),templates=scene.owners.map(()=>new Map<number,V3>()),dust=dustScreens(scene,camera);let eventCount=0;
 for(const object of scene.objects){const owner=ownerIndex.get(object.owner);need(owner!==undefined,'Orphaned geometric primitive');for(const pixel of projectObject(object,camera)){const list=events.get(pixel.pixel)??[];for(const node of pixel.nodes){list.push({owner,weight:object.weight*pixel.value*node.fraction,color:object.color,t:node.t});eventCount++;}events.set(pixel.pixel,list);}}
 if(scene.oldPopulation){need(camera.pixelOf&&camera.areaAt,'A Gaia point camera needs astrometric projection');const points=scene.oldPopulation.points;for(let i=0;i<points.count;i++){const p:V3=[points.positions[i*3],points.positions[i*3+1],points.positions[i*3+2]],q=camera.pixelOf(p);if(!q||q[0]<0||q[1]<0||q[0]>=width||q[1]>=height)continue;const x=q[0]-.5,y=q[1]-.5,ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,ray=camera.ray(q[0],q[1]),t=dot(add(p,mul(ray.origin,-1)),normalize(ray.direction)),area=camera.areaAt(p),color:V3=[points.rgb[i*3],points.rgb[i*3+1],points.rgb[i*3+2]];for(let b=0;b<2;b++)for(let a=0;a<2;a++){const xx=ix+a,yy=iy+b;if(xx<0||yy<0||xx>=width||yy>=height)continue;const pixel=yy*width+xx,list=events.get(pixel)??[];list.push({owner:-1,pointComponent:points.components[i],weight:(a?u:1-u)*(b?v:1-v)/area,color,t});events.set(pixel,list);eventCount++;}}}
 const smoothTau=new Float64Array(3),tauStep=new Float64Array(3),transmission=new Float64Array(3),values=new Float64Array(5);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const pixel=y*width+x,ray=camera.ray(x+.5,y+.5),dir=normalize(ray.direction),bounds=boundsInterval(ray.origin,dir);if(!bounds)continue;const list=events.get(pixel)??[],hits=dust.get(pixel)??[];list.sort((a,b)=>a.t-b.t);let event=0;smoothTau.fill(0);
  const count=Math.ceil((bounds[1]-bounds[0])/step),ds=(bounds[1]-bounds[0])/count;
  const cloudTau=(t:number)=>{let tau=0,fine=0;for(const h of hits){const value=h.object.weight*columnTo(h.object,h.chord,t);if(h.fineCloud)fine+=value;else tau+=value;}return tau*scene.molecularFraction*scene.dustArea*(scene.dustLayer?.strength??1)+fine*(scene.dustLayer?.strength??1);};
  for(let k=0;k<count;k++){
   const t0=bounds[0]+k*ds,t=t0+ds/2,p=add(ray.origin,mul(dir,t)),r=Math.hypot(p[0],p[1]);if(r>20)continue;const z=p[2]-at(scene.sources.warp,p[0],p[1]),[disc,outer]=radialAt(r),verticalOld=gaussian(z,.41010570629613075),verticalYoung=gaussian(z,.15),opacity=(scene.dustLayer?at(scene.dustLayer.column,p[0],p[1])*scene.dustLayer.strength:scene.dustArea*(1-scene.molecularFraction)*disc)*gaussian(z,.25);
   const transition=scene.outskirtsTransitionKpc??[2,4],tail=scene.separateOutskirts?smoothstep((r-transition[0])/(transition[1]-transition[0])):0;values[0]=disc*(1-tail)*verticalOld;values[1]=scene.barGeometry?barSurfaceFor(scene.barGeometry,p[0],p[1])*gaussian(p[2]-scene.barGeometry.center[2],scene.barGeometry.sigmaZ):barSurface(p[0],p[1])*gaussian(p[2],BAR_SIGMA_Z);values[2]=(outer+disc*tail)*verticalOld;values[3]=.15*(scene.youngDensity?at(scene.youngDensity,p[0],p[1]):disc)*verticalYoung;values[4]=.002*disc*verticalYoung;
   if(scene.oldPopulation){values[0]=at(scene.oldPopulation.disc,p[0],p[1])*1.2842040336717868*verticalOld;values[1]=at(scene.oldPopulation.bar,p[0],p[1])*1.2842040336717868*gaussian(z,.36656497062880344);values[2]=0;}
   const cTau=cloudTau(t);
   for(let c=0;c<3;c++){tauStep[c]=opacity*ds*EXTINCTION_RGB[c];const correction=tauStep[c]>1e-8?-Math.expm1(-tauStep[c])/tauStep[c]:1-tauStep[c]/2;transmission[c]=Math.exp(-smoothTau[c]-cTau*EXTINCTION_RGB[c])*correction;}
   for(let component=0;component<5;component++){const color=component===0&&scene.innerDiscColor?scene.innerDiscColor:scene.colors[component<3?component===1?1:0:component-1];for(let c=0;c<3;c++)planes[component][pixel*3+c]+=values[component]*color[c]*transmission[c]*ds;}
   while(event<list.length&&list[event].t<=t0+ds){const e=list[event++];if(e.t<bounds[0])continue;const tau=cloudTau(e.t),rgb:V3=e.pointComponent===undefined?templates[e.owner].get(pixel)??[0,0,0]:[0,0,0];for(let c=0;c<3;c++)rgb[c]+=e.weight*e.color[c]*Math.exp(-smoothTau[c]-opacity*Math.max(0,e.t-t0)*EXTINCTION_RGB[c]-tau*EXTINCTION_RGB[c]);if(e.pointComponent===undefined)templates[e.owner].set(pixel,rgb);else for(let c=0;c<3;c++)grain![e.pointComponent][pixel*3+c]+=rgb[c];}
   for(let c=0;c<3;c++)smoothTau[c]+=tauStep[c];
  }
  if(camera.foreground){for(let c=0;c<3;c++){const factor=Math.exp(-FOREGROUND_EBV*3.41/1.0857362047581296*EXTINCTION_RGB[c]);for(let component=0;component<5;component++){planes[component][pixel*3+c]*=factor;if(grain)grain[component][pixel*3+c]*=factor;}}}
 }
 const objects:SparseObject[]=templates.map((map,owner)=>{const entries=[...map],indices=Int32Array.from(entries.map(e=>e[0])),rgb=new Float64Array(entries.length*3);for(let j=0;j<entries.length;j++)for(let c=0;c<3;c++)rgb[j*3+c]=entries[j][1][c]*(camera.foreground?Math.exp(-FOREGROUND_EBV*3.41/1.0857362047581296*EXTINCTION_RGB[c]):1);return{owner,indices,rgb};});
 if(scene.youngOwner){const owner=ownerIndex.get(scene.youngOwner);need(owner!==undefined,'Missing diffuse-population gain');const indices=[];for(let i=0;i<width*height;i++)if(planes[3][i*3]+planes[3][i*3+1]+planes[3][i*3+2]>0)indices.push(i);const rgb=new Float64Array(indices.length*3);for(let j=0;j<indices.length;j++)for(let c=0;c<3;c++)rgb[j*3+c]=planes[3][indices[j]*3+c];objects[owner]={owner,indices:Int32Array.from(indices),rgb};planes[3].fill(0);}
 return{smooth:{width,height,planes,dustGain:1},objects,grain,metadata:{emissionEvents:eventCount,objects:scene.objects.length,owners:scene.owners.length,dustScreenPixels:dust.size,stepKpc:step,method:'Finite 3D objects, measured Gaia stellar fields and catalogue points where supplied, positive ray integration and extinction. No photograph in the renderer.'}};
}
export function catalogueBasis(p:CatalogueProjection,scene:CatalogueScene,amplitudes:Float64Array):Basis {
 const gains=[scene.innerDiscGain??1,scene.barGain??1,scene.outskirtsGain??1,1,1],planes=p.smooth.planes.map((v,k)=>gains[k]===1?v.slice():Float64Array.from(v,x=>x*gains[k]));if(scene.oldPopulation&&p.grain)for(const k of [0,1])for(let i=0;i<planes[k].length;i++)planes[k][i]=planes[k][i]*(1-scene.oldPopulation.oldFraction)+p.grain[k][i]*gains[k]*scene.oldPopulation.oldFraction;
 for(const s of p.objects){const owner=scene.owners[s.owner],component=owner.component,a=amplitudes[s.owner],young=owner.id===scene.youngOwner;for(let j=0;j<s.indices.length;j++)for(let c=0;c<3;c++)planes[component][s.indices[j]*3+c]+=s.rgb[j*3+c]*a*(young&&scene.youngTint?scene.youngTint[c]:1)*(young&&scene.oldPopulation?1-scene.oldPopulation.youngFraction:1);if(young&&scene.oldPopulation&&p.grain)for(let i=0;i<planes[3].length;i++)planes[3][i]+=p.grain[3][i]*a*(scene.youngTint?.[i%3]??1)*scene.oldPopulation.youngFraction;}
 return{...p.smooth,planes};
}
