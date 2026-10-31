/** Individual catalogue astrometry and photometry; depths are conditional prior draws. */
import {readdir,readFile} from 'node:fs/promises';
import {LOCAL,at,need,json,rec,num,makeRaster,type Sources,type NativeStars} from './inputs.mts';
import {unit,rayInBody,add,mul,type V3} from './geometry.mts';
import {HEIGHT_DISC,EXTINCTION_RGB,FOREGROUND_EBV,smoothstep} from './model.mts';
export const nativeWeight=(radius:number)=>1-smoothstep((radius-8.5)/.5);
export function foregroundFraction(height:number,sigma:number):number {
  const x=height/(Math.SQRT2*sigma),a=Math.abs(x),t=1/(1+.3275911*a);
  const erf=Math.sign(x)*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a));
  return .5*(1-erf);
}
export function normalFromId(id:string):number {
  let seed=2166136261;for(const ch of id)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
  const uniform=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return((seed>>>0)+.5)/4294967296;};
  // Mix before the first draw so adjacent catalogue identifiers do not share a depth sequence.
  for(let i=0;i<4;i++)uniform();const u=uniform(),v=uniform();
  return Math.max(-4,Math.min(4,Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)));
}
export async function loadNative(sources:Sources):Promise<NativeStars> {
  const coverage=makeRaster(sources.youngCoverage.n,sources.youngCoverage.half);coverage.mask.fill(1);
  for(let y=0;y<coverage.n;y++)for(let x=0;x<coverage.n;x++)coverage.values[y*coverage.n+x]=nativeWeight(Math.hypot(((x+.5)/coverage.n*2-1)*coverage.half,((y+.5)/coverage.n*2-1)*coverage.half));
  sources.youngCoverage=coverage;
  const dir=`${LOCAL}versions/inputs/native-bright/`,files=(await readdir(dir)).filter(f=>/^ra-.*\.csv$/u.test(f)).sort();
  need(files.length===38,'Native catalogue acquisition has not completed all 38 bounded tiles');
  let capacity=0;for(const file of files)capacity+=num(rec(await json(`${dir}${file}.request.json`)).rows);
  const positions=new Float64Array(capacity*3),rgb=new Float64Array(capacity*3),earthTau=new Float32Array(capacity);let count=0,totalRows=0,green=0;
  for(const file of files){const lines=(await readFile(`${dir}${file}`,'utf8')).trim().split(/\r?\n/u);need(lines.shift()==='id,ra,dec,gmag,rmag,imag','Native catalogue header mismatch');
    for(const line of lines){totalRows++;const v=line.split(','),ra=Number(v[1]),dec=Number(v[2]),m=v.slice(3).map(Number);need(v.length===6&&[ra,dec,...m].every(Number.isFinite),'Invalid native catalogue values');
      const ray=rayInBody(unit(ra,dec)),height=normalFromId(v[0])*HEIGHT_DISC;let t=-ray.origin[2]/ray.direction[2],p=add(ray.origin,mul(ray.direction,t));
      for(let iter=0;iter<3;iter++){t=(at(sources.warp,p[0],p[1])+height-ray.origin[2])/ray.direction[2];p=add(ray.origin,mul(ray.direction,t));}
      // VMC polygons constrain age budgets, not the boundary of real SMASH stars.
      // Keep the native catalogue across the galaxy, with a declared finite boundary.
      const weight=nativeWeight(Math.hypot(p[0],p[1]));if(weight<=0)continue;
      const tau=at(sources.dust,p[0],p[1])/Math.abs(ray.direction[2])*foregroundFraction(height,HEIGHT_DISC/2);
      const foreground=FOREGROUND_EBV*3.41/1.0857362047581296;
      const color:V3=[10**(-.4*(m[2]-20)),10**(-.4*(m[1]-20)),10**(-.4*(m[0]-20))];
      for(let c=0;c<3;c++){color[c]*=weight*Math.exp((tau+foreground)*EXTINCTION_RGB[c]);positions[count*3+c]=p[c];rgb[count*3+c]=color[c];}
      earthTau[count]=tau;green+=color[1];count++;
    }
  }
  need(count>1000&&green>0,'No complete native young-star sample');
  for(let i=0;i<count*3;i++)rgb[i]/=green;
  return {count,positions:positions.subarray(0,count*3),rgb:rgb.subarray(0,count*3),earthTau:earthTau.subarray(0,count),metadata:{source:'SMASH DR2 individual object catalogue',rowsRetrieved:totalRows,retained:count,
    selection:'12 <= g,r,i < 20.5; -0.5 <= g-i < 0.5; measured errors <0.1 mag; strict PSF quality; smooth presentation taper 8.5–9 kpc. VMC polygons do not clip astrometry.',
    resolution:'Individual measured positions; pixel integration only, no smoothing by survey regions',
    depth:'Deterministic normal draws by source identifier, sigma equal to the adopted stellar height; each position remains on its measured Earth ray',
    luminosity:'Observed gri photometry corrected with the declared dust-height prior, then one common normalization to the VMC young luminosity budget',
    limitations:['Blue observed-color candidates, not a complete young-age or membership catalogue.','Distances are conditional; no individual stellar depth is claimed.','The bright selection excludes faint stars; the global population normalization accounts for unresolved light only in aggregate.','The VMC-derived young fraction is extrapolated outside VMC polygons wherever native SMASH astrometry is used. Nine kpc is a presentation limit, not a measured galaxy edge.']}};
}
