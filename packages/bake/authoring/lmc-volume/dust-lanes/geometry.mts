/** Optical selection within the measured RC distribution; all native dust columns survive. */
import {at,need} from '../inputs.mts';
import {bodyToIcrs,skyOf} from '../geometry.mts';
import {gaiaWarpLocator} from '../gaia-plane.mts';
import {loadOgle,RV,EVI_PER_EBV} from '../dust-geometry/ogle.mts';
import {DEPTH_NODES,DUST_SIGMA,fractionAtHeight,inferHeight} from '../dust-geometry/depth.mts';
import {MAG_PER_TAU} from '../dust-native/field.mts';
import {smoothstep} from '../model.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
export function denseGate(av:number){need(Number.isFinite(av)&&av>=0,'Invalid native column');return smoothstep((av-.2)/.3);}
export function lowerBound(derivative:number,spread:number){need(derivative>=0&&spread>0,'Invalid RC distribution bound');return derivative>0?Math.max(0,1-spread/derivative):0;}
export function selectedFraction(original:number,av:number,scale:number,bound:number){need(original>=.019999&&original<=.980001&&scale>=.05&&scale<=1&&bound>=0&&bound<=1,'Invalid foreground selection');return Math.max(.02,original*(1-(1-Math.max(scale,bound))*denseGate(av)));}
export async function dustControl(scene:CatalogueScene){
 need(scene.dustLayer?.clouds&&scene.dustLayer.clouds.length===86690*5,'Expected l25 five-depth field');
 const clouds=scene.dustLayer.clouds,ogle=await loadOgle(),locate=gaiaWarpLocator(scene.sources),original=clouds.map(v=>({center:[...v.center],width:v.axes[0],weight:v.weight,distance:Math.hypot(...bodyToIcrs(v.center))})),patches=[],regions=new Map<number,{id:number;area:number;fore:number;derivative:number;spread:number;box:number;}>();
 for(let i=0;i<clouds.length;i+=5){const v=clouds[i+2],[ra,dec]=skyOf(bodyToIcrs(v.center)),height=v.center[2]-at(scene.sources.warp,v.center[0],v.center[1]),fraction=fractionAtHeight(height),av=clouds.slice(i,i+5).reduce((s,c)=>s+c.weight/(c.axes[0]*c.axes[1])*MAG_PER_TAU,0),distance=original[i+2].distance,area=(v.axes[0]/distance)**2,cells=ogle.sample.containing(ra,dec);need(cells.length>0,'A native patch lost OGLE coverage');for(const cell of cells){const r=regions.get(cell.id)??{id:cell.id,area:0,fore:0,derivative:0,spread:RV/EVI_PER_EBV*cell.lower,box:cell.box};r.area+=area;r.fore+=av*fraction*area*1.2;r.derivative+=av*fraction*denseGate(av)*area*1.2;regions.set(cell.id,r);}patches.push({i,ra,dec,height,fraction,av,area,cells:cells.map(c=>c.id),bound:0});}
 for(const r of regions.values()){r.fore/=r.area;r.derivative/=r.area;}
 for(const p of patches)p.bound=Math.max(...p.cells.map(id=>{const r=regions.get(id);need(r,'Missing complete source aperture');return lowerBound(r.derivative,r.spread);}));
 return{scene,original,patches,regions,locate};
}
export type DustControl=Awaited<ReturnType<typeof dustControl>>;
export function applySelection(c:DustControl,scale:number){
 need(Number.isFinite(scale)&&scale>=.05&&scale<=1,'Foreground scale must lie in 0.05–1');const clouds=c.scene.dustLayer?.clouds;need(clouds,'Missing finite dust');let capped=0,changed=0,maxShift=0;
 for(const p of c.patches){const fraction=selectedFraction(p.fraction,p.av,scale,p.bound);if(p.bound>scale&&denseGate(p.av)>0)capped++;if(Math.abs(fraction-p.fraction)<1e-12){for(let j=0;j<5;j++){const v=clouds[p.i+j],old=c.original[p.i+j];v.center=[old.center[0],old.center[1],old.center[2]];v.axes=[old.width,old.width,old.width];v.weight=old.weight;}continue;}changed++;const height=inferHeight(fraction,1).height;maxShift=Math.max(maxShift,Math.abs(height-p.height));for(let j=0;j<5;j++){const v=clouds[p.i+j],old=c.original[p.i+j],center=c.locate(p.ra,p.dec,height+DEPTH_NODES[j].z*DUST_SIGMA,DUST_SIGMA),width=old.width*Math.hypot(...bodyToIcrs(center))/old.distance;v.center=center;v.axes=[width,width,width];v.weight=old.weight*(width/old.width)**2;}}
 return{scale,changedPatches:changed,distributionLimitedPatches:capped,maximumMeanHeightShiftKpc:maxShift,globalDustStrength:c.scene.dustLayer!.strength};
}
export function reddeningCheck(c:DustControl,scale:number){const sums=new Map<number,number>();for(const p of c.patches){const fraction=selectedFraction(p.fraction,p.av,scale,p.bound);for(const id of p.cells)sums.set(id,(sums.get(id)??0)+p.av*fraction*p.area*1.2);}let maximumSpreadFraction=0;for(const r of c.regions.values()){const current=(sums.get(r.id)??0)/r.area;maximumSpreadFraction=Math.max(maximumSpreadFraction,(r.fore-current)/r.spread);}need(maximumSpreadFraction<=1+1e-10,'Optical selection left the measured RC distribution');return{regions:c.regions.size,maximumSpreadFraction,meaning:'Every full published OGLE aperture loses no more effective foreground A_V than its measured lower 34-percentile color width converted to A_V. This is a range of stellar sightlines, not an error bar on the median. It bounds an adopted optical-selection prior; no individual cloud distance is measured.'};}
