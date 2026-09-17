/** Authored compact material partition on immutable density transport. Does not infer emitter positions. */
import { fitMaterialColors, type MaterialColumn } from './material-solver.ts';
type Vec3 = [number, number, number];
export interface MaterialTransportSample { point: Vec3; contribution: number }
export interface FiniteRegionOptions {
  width: number; height: number; target: Float32Array; covered: Uint8Array;
  origin: Vec3; spacing: Vec3; maximumRegions: number; iterations: number; regularization: number;
  raySamples(pixel: number): Iterable<MaterialTransportSample>;
}
export function finiteRegionBasis(point: Vec3, origin: Vec3, spacing: Vec3): { id: string; weight: number }[] {
  if ([...point,...origin,...spacing].some(v=>!Number.isFinite(v)) || spacing.some(v=>v<=0)) throw Error('Invalid finite region coordinates');
  const p=point.map((v,i)=>(v-origin[i]!)/spacing[i]!);
  const cell=p.map(Math.floor), fraction=p.map((v,i)=>v-cell[i]!);
  const result:{id:string;weight:number}[]=[];
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++) {
    const weight=(x?fraction[0]!:1-fraction[0]!)*(y?fraction[1]!:1-fraction[1]!)*(z?fraction[2]!:1-fraction[2]!);
    if(weight>0)result.push({id:`${cell[0]!+x},${cell[1]!+y},${cell[2]!+z}`,weight});
  }
  return result;
}
export function fitFiniteRegionMaterial(options:FiniteRegionOptions) {
  const {width,height,target,covered,origin,spacing}=options;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||target.length!==width*height*3||covered.length!==width*height||
    !target.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!covered.every(v=>v===0||v===1)||!Number.isInteger(options.maximumRegions)||options.maximumRegions<1||options.maximumRegions>8192)throw Error('Invalid finite material raster or region limit');
  finiteRegionBasis(origin,origin,spacing);
  const map=new Map<string,Map<number,number>>(), opacity=new Float32Array(width*height);
  for(let pixel=0;pixel<covered.length;pixel++)if(covered[pixel]) {
    let total=0;
    for(const sample of options.raySamples(pixel)) {
      if(!Number.isFinite(sample.contribution)||sample.contribution<0||sample.contribution>1)throw Error('Invalid fixed transport contribution');
      total+=sample.contribution;
      for(const b of finiteRegionBasis(sample.point,origin,spacing)) {
        const column=map.get(b.id)??new Map<number,number>();
        column.set(pixel,(column.get(pixel)??0)+sample.contribution*b.weight);map.set(b.id,column);
      }
    }
    if(total>1+1e-6)throw Error('Transport exceeds unit opacity');
    opacity[pixel]=Math.min(1,total);
  }
  // Select by training transport only. No held-out target values determine membership or initial colors.
  const selected=[...map].map(([id,column])=>({id,column,influence:[...column].reduce((sum,[pixel,value])=>sum+(pixel%7===0?0:value),0)}))
    .filter(c=>c.influence>0).sort((a,b)=>b.influence-a.influence||a.id.localeCompare(b.id)).slice(0,options.maximumRegions);
  if(!selected.length)throw Error('No finite material regions overlap training support');
  const fixed=new Float32Array(target.length), fittedTarget=new Float32Array(target.length), initial:Vec3[]=[];
  for(let pixel=0;pixel<covered.length;pixel++)for(let c=0;c<3;c++) {fixed[3*pixel+c]=opacity[pixel]!;fittedTarget[3*pixel+c]=target[3*pixel+c]!*opacity[pixel]!;}
  const columns:MaterialColumn[]=selected.map(({column})=>{
    const rgb:Vec3=[0,0,0];let sum=0;
    for(const[pixel,value]of column){for(let c=0;c<3;c++)fixed[3*pixel+c]=Math.max(0,fixed[3*pixel+c]!-value);if(pixel%7!==0){sum+=value;for(let c=0;c<3;c++)rgb[c]!+=value*target[3*pixel+c]!;}}
    initial.push(rgb.map(v=>sum?v/sum:1) as Vec3);
    return {indices:Uint32Array.from(column.keys()),values:Float32Array.from(column.values())};
  });
  const fitted=fitMaterialColors(columns,fittedTarget,fixed,covered,initial,{iterations:options.iterations,regularization:options.regularization});
  const colors=new Map(selected.map((c,i)=>[c.id,fitted.colors[i]!]));
  const sampleMaterial=(x:number,y:number,z:number,out:Vec3):boolean=>{
    out.fill(0);let observed=0;
    for(const b of finiteRegionBasis([x,y,z],origin,spacing)) {const color=colors.get(b.id);if(color)observed+=b.weight;for(let c=0;c<3;c++)out[c]!+=255*b.weight*(color?.[c]??1);}
    for(let c=0;c<3;c++)out[c]=Math.max(0,Math.min(255,out[c]!));
    return observed>0;
  };
  return {sampleMaterial,receipt:{schema:'cssearth-finite-region-material@1',settings:{origin,spacing,maximumRegions:options.maximumRegions,iterations:options.iterations,regularization:options.regularization},
    regions:selected.map((c,i)=>({id:c.id,trainingInfluence:c.influence,rgb:fitted.colors[i]})),transportRegions:map.size,
    beforeRmse:fitted.beforeRmse,afterRmse:fitted.afterRmse,validationBeforeRmse:fitted.validationBeforeRmse,validationAfterRmse:fitted.validationAfterRmse,
    interpretation:'Compact overlapping tent regions in source XYZ; bounded RGB fitted through immutable near-to-far opacity. Regions and colors are authored/conditional, not measured gas emitters. Target chromaticity is multiplied by fixed projected opacity; image brightness never changes density.',
    limitations:['Single-view data do not uniquely identify front/back colors.','Unselected and unobserved regions remain neutral.','Finite region scale smooths source detail and must be judged from front and side views.','Transport uses the existing Z bank; other banks reuse the same continuous material with density-weighted slab quadrature.']}};
}
