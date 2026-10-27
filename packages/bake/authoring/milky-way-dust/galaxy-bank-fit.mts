/** Bounded compression fit. The physical model is immutable; only slab display encoding is free. */
import {encodeGalaxyPlane,compositeGalaxyStack,IDENTITY_BANK_FIT,type GalaxyRayCamera,type GalaxyPlane,type GalaxyBankSpec,type GalaxyBankFit,hybridGalaxyPlanes,selectDenseSlabs} from './galaxy-fitted-bank.mts';
import {prepareGalaxyCompositor} from './galaxy-compositor-cache.mts';
import {minimizeBox} from './galaxy-fit-search.mts';
export interface GalaxyFitTarget {name:string;axis:0|1|2;camera:GalaxyRayCamera;linear:Float64Array;annuli:Uint8Array;}
const Y=[.2126,.7152,.0722];
function linear(x:number):number{return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}
export function galaxyResiduals(encoded:Float64Array,target:GalaxyFitTarget){
 if(encoded.length!==target.linear.length||target.annuli.length*3!==encoded.length)throw new TypeError('Galaxy qualification grids disagree');
 const sums=[0,0],annuli=Array.from({length:4},()=>[0,0]),colors=Array.from({length:3},()=>[new Float64Array(3),new Float64Array(3)]);let square=0,norm=0;
 for(let p=0;p<target.annuli.length;p++){
  const a=target.annuli[p]!,region=a<2?0:a===2?1:2;
  for(let c=0;c<3;c++){
   const m=linear(encoded[p*3+c]!),t=Math.max(0,Math.min(1,target.linear[p*3+c]!));if(!Number.isFinite(m)||!Number.isFinite(t))throw new TypeError('Nonfinite galaxy qualification pixel');
   sums[0]+=Y[c]!*m;sums[1]+=Y[c]!*t;annuli[a]![0]!+=Y[c]!*m;annuli[a]![1]!+=Y[c]!*t;colors[region]![0]![c]!+=m;colors[region]![1]![c]!+=t;square+=(m-t)**2;norm+=t*t;
  }
 }
 const light=sums[0]!/Math.max(1e-20,sums[1]!)-1,radial=annuli.map(a=>a[1]!>1e-12?a[0]!/a[1]!-1:null),color=colors.map(([m,t])=>{const sm=m!.reduce((s,v)=>s+v,0),st=t!.reduce((s,v)=>s+v,0);return[0,1,2].map(c=>st>1e-12&&sm>1e-12?m![c]!/sm-t![c]!/st:null);});
 const passed=light>=-.05&&light<=.02&&radial.every(v=>v===null||Math.abs(v)<=.1)&&color.flat().every(v=>v===null||Math.abs(v)<=.03);
 return{name:target.name,lightDifferencePercent:light*100,annulusDifferencePercent:radial.map(v=>v===null?null:v*100),channelShareDifferencePercentagePoints:color.map(row=>row.map(v=>v===null?null:v*100)),relativeRms:Math.sqrt(square/Math.max(norm,1e-20)),passed};
}
export function scoreGalaxyResiduals(row:ReturnType<typeof galaxyResiduals>):number {
 const light=row.lightDifferencePercent/100,radial=row.annulusDifferencePercent.filter((v):v is number=>v!==null).map(v=>v/100),color=row.channelShareDifferencePercentagePoints.flat().filter((v):v is number=>v!==null).map(v=>v/100);
 return .02*row.relativeRms**2+20*(light+.01)**2+5*radial.reduce((s,v)=>s+v*v,0)+20*color.reduce((s,v)=>s+v*v,0)+100*Math.max(0,light)**2;
}
export function evaluateGalaxyBank(planes:readonly GalaxyPlane[],spec:GalaxyBankSpec,targets:readonly GalaxyFitTarget[],fits:readonly GalaxyBankFit[],dense=selectDenseSlabs(planes,spec),compositors?:ReadonlyMap<string,ReturnType<typeof prepareGalaxyCompositor>>){
 const decoded=spec.hybrid?hybridGalaxyPlanes(planes,fits,dense):planes.map(p=>encodeGalaxyPlane(p,fits[p.axis]!)),images=targets.map(t=>compositors?.get(t.name)?.(decoded)??compositeGalaxyStack(decoded,spec.box,t.camera,t.axis)),rows=targets.map((t,i)=>galaxyResiduals(images[i]!,t));return{rows,images,passed:rows.every(r=>r.passed),score:rows.reduce((s,r)=>s+scoreGalaxyResiduals(r),0)/Math.max(1,rows.length)};
}
export function fitGalaxyBank(planes:readonly GalaxyPlane[],spec:GalaxyBankSpec,targets:readonly GalaxyFitTarget[],initial:readonly GalaxyBankFit[]=Array.from({length:3},()=>structuredClone(IDENTITY_BANK_FIT))){
 const dense=selectDenseSlabs(planes,spec),fits:GalaxyBankFit[]=initial.map(v=>({...structuredClone(v),emissionOpacity:v.emissionOpacity??2})),trajectory=[];
 for(const axis of [0,1,2] as const){
  const group=targets.filter(t=>t.axis===axis);if(!group.length)continue;
  const source=planes.filter(p=>p.axis===axis),template=spec.hybrid?hybridGalaxyPlanes(source,fits,dense):source.map(p=>encodeGalaxyPlane(p,fits[p.axis]!)),compositors=new Map(group.map(t=>[t.name,prepareGalaxyCompositor(template,spec.box,t.camera,t.axis)])),score=(fit:GalaxyBankFit)=>{const current=fits.map((v,a)=>a===axis?fit:v);return evaluateGalaxyBank(source,spec,group,current,dense,compositors).score;};let best=score(fits[axis]!);
  // Existing bounded Nelder–Mead solver, now shared with the model's appearance fitter.
  const bounds=([[-6.907755278982137,2.995732273553991],[-6.907755278982137,2.995732273553991],[-6.907755278982137,2.995732273553991],[Math.log(.25),Math.log(4)],[Math.log(.001),Math.log(16)]] as const),decode=(x:number[]):GalaxyBankFit=>({rgb:[Math.exp(x[0]!),Math.exp(x[1]!),Math.exp(x[2]!)],gamma:Math.exp(x[3]!),dust:1,emissionOpacity:Math.exp(x[4]!)});
  const seeds=[fits[axis]!,{...structuredClone(IDENTITY_BANK_FIT),emissionOpacity:.5},{...structuredClone(IDENTITY_BANK_FIT),emissionOpacity:8}];
  for(let start=0;start<seeds.length;start++){
   const seed=seeds[start]!,x=[...seed.rgb,seed.gamma,seed.emissionOpacity!].map(Math.log),result=minimizeBox(v=>score(decode(v)),x,bounds,200);
   if(result.value<best){best=result.value;fits[axis]=decode(result.x);}
   trajectory.push({axis,start,score:best,fit:structuredClone(fits[axis]!)});
   console.log(JSON.stringify({sentinel:'HYBRID_FIT_START_COMPLETE',axis,start,score:best}));
  }
 }
 return{fits,trajectory,dense:[...dense],...evaluateGalaxyBank(planes,spec,targets,fits,dense)};
}
