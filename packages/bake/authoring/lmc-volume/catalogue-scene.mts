import type {BarGeometry} from './bar-geometry.mts';
import type {DustLayer} from './heritage-layer.mts';
import type {OldPopulation} from './gaia-old-model.mts';
/** l11 geometry is built from catalogues and H-alpha shape parameters, before RGB calibration. */
import {at,json,array,rec,num,need,type Sources,type Raster} from './inputs.mts';
import {unit,rayInBody,add,mul,normalize,DEG,DISTANCE,type V3} from './geometry.mts';
import {L11,catalogueRows,type CatalogueRow} from './catalogue-data.mts';
import {readHaGeometry,skyOffset,type HaGeometry} from './catalogue-ha.mts';
import {planarBasis,volumeObject,tube,type VolumeObject,type Component} from './catalogue-volume.mts';
import {ARCHIVE} from './inputs.mts';
export interface Owner {id:string;kind:string;component:Component;prior:number;maximum:number;measuredAge:boolean;logAge:number|null;aliases:string[];}
export interface CatalogueScene {objects:VolumeObject[];dust:VolumeObject[];owners:Owner[];sources:Sources;colors:V3[];dustArea:number;molecularFraction:number;metadata:Record<string,unknown>;barGeometry?:BarGeometry;innerDiscColor?:V3;oldPopulation?:OldPopulation;dustLayer?:DustLayer;youngDensity?:Raster;youngOwner?:string;youngTint?:V3;outskirtsGain?:number;separateOutskirts?:boolean;outskirtsTransitionKpc?:readonly[number,number];innerDiscGain?:number;barGain?:number;}
export function locate(ra:number,dec:number,sources:Sources,height=0):V3 {
 const r=rayInBody(unit(ra,dec));let p=add(r.origin,mul(r.direction,-r.origin[2]/r.direction[2]));
 for(let i=0;i<32;i++){const z=at(sources.warp,p[0],p[1])+height,q=add(r.origin,mul(r.direction,(z-r.origin[2])/r.direction[2]));if(Math.hypot(...add(q,mul(p,-1)))<1e-7)return q;p=q;}
 need(Math.abs(p[2]-at(sources.warp,p[0],p[1])-height)<.005,'Catalogue centre failed its warped-plane anchor');return p;
}
function depthDraw(id:string,sigma:number):number {let seed=0;for(let i=0;i<id.length;i++)seed=(seed*31+id.charCodeAt(i))%1000003;const f=(n:number)=>{const x=Math.sin(seed*12.9898+n*78.233)*43758.5453;return x-Math.floor(x);};return Math.max(-2.5,Math.min(2.5,Math.sqrt(-2*Math.log(Math.max(1e-6,f(1))))*Math.cos(2*Math.PI*f(2))))*sigma;}
function physicalShape(r:CatalogueRow,sources:Sources):{axes:V3;angle:number} {
 const p=locate(r.ra,r.dec,sources),a=locate(...skyOffset(r,1,0),sources),b=locate(...skyOffset(r,0,1),sources),u=add(a,mul(p,-1)),v=add(b,mul(p,-1)),xx=u[0]**2+v[0]**2,yy=u[1]**2+v[1]**2,xy=u[0]*u[1]+v[0]*v[1],d=Math.hypot(xx-yy,2*xy),major=Math.sqrt(Math.max(1e-8,(xx+yy+d)/2)),minor=Math.sqrt(Math.max(1e-8,(xx+yy-d)/2));
 return{axes:[major,minor,Math.sqrt(major*minor)],angle:.5*Math.atan2(2*xy,xx-yy)};
}
export async function buildCatalogueScene(sources:Sources):Promise<CatalogueScene> {
 const {rows,metadata}=await catalogueRows(),ha=new Map(array(await json(L11+'ha-geometry.json')).map(v=>{const r=readHaGeometry(v);return[r.id,r];})),raw=rec(await json(`${ARCHIVE}dataset-model/detail-stars/ssp-intake/bc03-Z008-optical-age-table.json`)),ssps=array(rec(array(raw.solutions)[0]).native).map(v=>{const r=rec(v);return{age:num(r.ageYr),bands:array(r.bandMeanLnuWPerHzPerInitialMsun).map(num)};});
 const color=(age:number):V3=>{const r=ssps.reduce((a,b)=>Math.abs(Math.log(a.age/age))<Math.abs(Math.log(b.age/age))?a:b);return[r.bands[2]/r.bands[1],1,r.bands[0]/r.bands[1]];},old=color(5e9),young=color(3e6),gas:V3=[2.08,1,1.06],objects:VolumeObject[]=[],dust:VolumeObject[]=[],owners:Owner[]=[],ownerMap=new Map<string,Owner>();
 const addOwner=(r:CatalogueRow,component:Component,prior:number,ownerId=r.id)=>{let o=ownerMap.get(ownerId);if(!o){o={id:ownerId,kind:r.kind,component,prior,maximum:prior*25,measuredAge:r.logAge!==null,logAge:r.logAge,aliases:r.aliases};owners.push(o);ownerMap.set(ownerId,o);}return o;};
 const put=(r:CatalogueRow,owner:string,kind:VolumeObject['kind'],component:Component,center:V3,axes:V3,angle:number,spectrum:V3,weight:number,suffix='')=>{const o=volumeObject({id:r.id+suffix,owner,kind,component,center,axes,basis:planarBasis(angle),inner:kind==='shell'?.72:0,color:spectrum,weight,source:r.source});objects.push(o);return o;};
 for(const r of rows){
  const shape=physicalShape(r,sources),isStar=r.kind==='cluster'||r.kind==='association';
  if(r.kind==='molecular'){const p=locate(r.ra,r.dec,sources,depthDraw(r.id,.125));dust.push(volumeObject({id:r.id,owner:r.id,kind:'dust',component:0,center:p,basis:planarBasis(shape.angle),axes:shape.axes,inner:0,color:[1,1,1],weight:r.massMsun??r.weight,source:r.source}));continue;}
  if(isStar){const unknownYoung=r.kind==='association'||/Bica class (CN|DCN|CA)\b|association|nebula/iu.test(r.notes),age=r.aliases.some(a=>a==='R136')?1.5e6:r.logAge!==null?10**r.logAge:unknownYoung?30e6:/IAC|globular/iu.test(r.notes)?3e9:200e6,component:Component=age<1e9?3:0,o=addOwner(r,component,r.weight),p=locate(r.ra,r.dec,sources,depthDraw(r.id,age<1e9?.15:.41010570629613075));put(r,o.id,'ball',component,p,shape.axes,shape.angle,color(age),1);continue;}
  if(r.kind==='supershell'){const owner=r.id==='KDS-SGS13'?'KDS-SGS12':r.id,o=addOwner(r,4,r.weight,owner),p=locate(r.ra,r.dec,sources);put(r,o.id,'shell',4,p,shape.axes,shape.angle,gas,1);continue;}
  const morphology=ha.get(r.id),tara=r.aliases.some(a=>a==='30 Doradus'||a==='NGC2070'),o=addOwner(r,4,r.weight),p=locate(r.ra,r.dec,sources,depthDraw(r.id,.075)),begin=objects.length;
  if(tara){
   const bowl=put(r,o.id,'shell',4,locate(r.ra,r.dec,sources),[.05,.05,.05],0,gas,.2,'-published-bowl');bowl.halfSpace=[0,0,1];bowl.source='Pellegrini2011; MNRAS 520,5600 (2023): 40–60 pc hemispherical bowl';
   const r136=rows.find(s=>s.aliases.includes('R136'));if(r136)put(r,o.id,'shell',4,locate(r136.ra,r136.dec,sources),[.015,.015,.015],0,gas,.05,'-central-shell').source='ChuKennicutt1994 central 30 pc diameter shell';
   if(morphology){
    for(let i=0;i<morphology.bubbles.length;i++){const b=morphology.bubbles[i],q=locate(...skyOffset(r,b.x,b.y),sources);put(r,o.id,'shell',4,q,shape.axes.map(a=>a*b.radius) as V3,shape.angle,gas,.25/Math.max(1,morphology.bubbles.length),`-ha-bubble-${i}`);}
    const points=morphology.knots.map(k=>{const xy=locate(...skyOffset(r,k.x,k.y),sources),dx=xy[0]-p[0],dy=xy[1]-p[1],rad=Math.hypot(dx,dy),height=rad<.05?-Math.sqrt(.05**2-rad**2):.015*Math.sin(Math.atan2(dy,dx)*2);return locate(...skyOffset(r,k.x,k.y),sources,height);});
    for(let i=0;i<morphology.links.length;i++){const [a,b]=morphology.links[i];if(Math.hypot(...add(points[a],mul(points[b],-1)))<.002)continue;objects.push(tube(r.id+`-filament-${i}`,o.id,points[a],points[b],.003,gas,.25/Math.max(1,morphology.links.length),'DeMCELS ridge endpoints; finite 3D tube, adopted shell-side depth'));}
   }
  }else put(r,o.id,morphology?.ringRatio&&morphology.ringRatio>1.3||/shell|bubble|remnant/iu.test(r.notes)?'shell':'ball',4,p,shape.axes,shape.angle,gas,(morphology?.knots.length ? .6 : 1));
  if(morphology?.knots.length){const sum=morphology.knots.reduce((a,b)=>a+b.weight,0);for(let i=0;i<morphology.knots.length;i++){const k=morphology.knots[i],q=locate(...skyOffset(r,k.x,k.y),sources,depthDraw(`${r.id}-k${i}`,tara?.025:.015)),radius=Math.max(.002,Math.sqrt(shape.axes[0]*shape.axes[1])*k.radius);put(r,o.id,'ball',4,q,[radius,radius,radius],0,gas,(tara?.25:.4)*k.weight/sum,`-ha-knot-${i}`);}}
  if(objects.length===begin)put(r,o.id,'ball',4,p,shape.axes,shape.angle,gas,1);
 }
 // Normalize substructure within each real catalogue owner, then set broad initial light budgets.
 const ownerSums=new Map<string,number>();for(const v of objects)ownerSums.set(v.owner,(ownerSums.get(v.owner)??0)+v.weight);for(const v of objects)v.weight/=ownerSums.get(v.owner)!;
 for(const group of [0,3,4] as const){const members=owners.filter(o=>o.component===group),sum=members.reduce((a,b)=>a+b.prior,0),budget=group===0?.15:group===3?.5:.12;for(const o of members){o.prior=o.prior/Math.max(sum,1e-20)*budget;o.maximum=o.prior*25;}}
 const molecularMass=dust.reduce((a,b)=>a+b.weight,0),molecularFraction=molecularMass/(molecularMass+3.8e8*(DISTANCE/50)**2);for(const d of dust)d.weight/=molecularMass;
 const scene:CatalogueScene={objects,dust,owners,sources,colors:[old,old,young,gas],dustArea:1,molecularFraction,metadata:{...metadata,emissionPrimitives:objects.length,ownerCount:owners.length,haShapes:ha.size,tarantula:objects.filter(o=>o.id.includes('published-bowl')).map(o=>o.owner),geometrySource:'Catalogue positions and sizes, DeMCELS shell/knot/filament parameters, smooth published disc/bar/warp. No Horálek pixels enter density or color structure.',heightsSigmaKpc:{old:.41010570629613075,young:.15,gas:.15,dust:.25,bar:.36656497062880344},agePriors:{spectrum:'BC03 Z=0.008; nearest tabulated age, fixed before grading',unknownAssociationOrNebularClusterYr:30e6,unknownOrdinaryClusterYr:200e6,unknownIntermediateOrGlobularYr:3e9,R136AdoptedYr:1.5e6,meaning:'Color priors only. Missing catalogue ages remain null and are never presented as measurements.'},depthStatus:'Unmeasured centre heights use deterministic adopted population dispersions; ellipsoid depth is the geometric mean transverse radius. Individual 3D distances are not claimed.',dustMixture:'Molecular mass from NANTEN, refined by MAGMA islands; smooth atomic-disc mass 3.8e8 Msun at 50 kpc from Staveley-Smith 2003. One Bell column normalization follows.'}};
 return scene;
}
