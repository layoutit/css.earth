/** One integrated bar spectrum from released VMC histories; no spatial photo colors. */
import {ARCHIVE,json,rec,array,num,numbers,need} from './inputs.mts';
import {locate,type CatalogueScene} from './catalogue-scene.mts';
import type {V3} from './geometry.mts';
const FEH=[-.19,-.19,-.19,-.19,-.19,-.19,-.19,-.19,-.19,-.19,-.25,-.36,-.49,-.60,-.95,-2.07,-3.18];
export function scaledSolarZ(feh:number){const ratio=.0207*10**feh;return .7515*ratio/(1+2.78*ratio);}
function bracket(v:number[],x:number){need(x>=v[0]&&x<=v.at(-1)!,'No population extrapolation');let i=0;while(i+1<v.length-1&&v[i+1]<x)i++;return i;}
export async function makeBarPopulation(scene:CatalogueScene,selection:'bar'|'innerDisc'='bar'){
 const vmc=rec(await json(ARCHIVE+'dataset-model/stars/regions.json')),source=rec(await json(ARCHIVE+'dataset-model/world-field/metallicity/bc03-native-Z-optical.json')),solutions=array(source.solutions).map(v=>{const r=rec(v);return{z:num(r.physicalMetallicityZ),rows:array(r.native).map(v=>{const row=rec(v);return{age:num(row.ageYr),rgb:numbers(row.bandMeanLnuWPerHzPerInitialMsun,3)};})};}),metals=solutions.map(v=>v.z),ages=solutions[0].rows.map(v=>v.age),edges=numbers(vmc.ageLogYrEdges).map(v=>10**v),bar=scene.barGeometry;need(bar&&edges.length===17,'Bar geometry and native SFH bins are required');
 need(array(rec(source.metadata).bands).join(',')==='B,V,R'&&solutions.length===6&&solutions.every((s,i)=>s.z>0&&(i===0||s.z>solutions[i-1].z)&&s.rows.length===ages.length&&s.rows.every((r,j)=>r.age===ages[j]&&r.rgb.every(v=>v>0)))&&ages.every((a,i)=>a>0&&(i===0||a>ages[i-1])),'Invalid qualified BC03 BVR grid');
 const ssp=(age:number,z:number)=>{const m=bracket(metals,z),a=bracket(ages,age),u=Math.log(z/metals[m])/Math.log(metals[m+1]/metals[m]),v=Math.log(age/ages[a])/Math.log(ages[a+1]/ages[a]);return[0,1,2].map(c=>{const at=(j:number)=>Math.log(solutions[j].rows[a].rgb[c])*(1-v)+Math.log(solutions[j].rows[a+1].rgb[c])*v;return Math.exp(at(m)*(1-u)+at(m+1)*u);});};
 const sums=[0,0,0],regions:string[]=[],weights:number[]=[];let mass=0,excludedMass=0,excludedV=0,allV=0,ageV=0,fehV=0;
 for(const value of array(vmc.regions)){
  const r=rec(value),centre=numbers(r.centerIcrsDeg,2),p=locate(centre[0],centre[1],scene.sources),dx=p[0]-bar.center[0],dy=p[1]-bar.center[1],x=(Math.cos(bar.angle)*dx+Math.sin(bar.angle)*dy)/bar.sigma,y=(-Math.sin(bar.angle)*dx+Math.cos(bar.angle)*dy)/(bar.sigma*bar.ratio);if(selection==='bar'?x*x+y*y>4:Math.hypot(p[0],p[1])>=3||x*x+y*y<=4)continue;
  need(typeof r.id==='string','Missing VMC region identity');regions.push(r.id);const masses=numbers(r.formedMassMsunByAgeBin,16),shifts=numbers(r.metallicityShiftDex,2);
  for(let k=7;k<16;k++)for(let j=0;j<24;j++){
   const t=edges[k]+(j+.5)/24*(edges[k+1]-edges[k]),fraction=(t-edges[k])/(edges[k+1]-edges[k]),shift=(t-edges[0])/(edges[16]-edges[0]),feh=FEH[k]*(1-fraction)+FEH[k+1]*fraction+shifts[0]*(1-shift)+shifts[1]*shift,z=scaledSolarZ(feh),m=masses[k]/24,reference=ssp(t,.008);mass+=m;allV+=m*reference[1];
   if(z<metals[0]||z>metals.at(-1)!){excludedMass+=m;excludedV+=m*reference[1];continue;}const rgb=ssp(t,z);for(let c=0;c<3;c++)sums[c]+=m*rgb[c];ageV+=m*rgb[1]*t;fehV+=m*rgb[1]*feh;
  }
  weights.push(masses.slice(7).reduce((a,b)=>a+b,0));
 }
 need(regions.length>5&&sums[1]>0,'Insufficient VMC bar population');const color:V3=[sums[2]/sums[1],1,sums[0]/sums[1]];
 return{color,metadata:{source:'Mazzi et al. 2021 VMC XLIII, released JKs regional histories; BC03 native-Z Johnson BVR spectra.',paper:'https://arxiv.org/html/2108.07225',regions:regions.length,regionIds:regions,selection:selection==='bar'?'Regional centres inside the fixed two-sigma Kacharov bar ellipse; ages >=10^8.6 years.':'Regional centres inside 3 kpc, outside the two-sigma bar ellipse; ages >=10^8.6 years. Applied as one global color to the existing inner-disc partition, not as regional colors.',formedMassWeights:weights,luminosityWeightedAgeGyr:ageV/sums[1]/1e9,luminosityWeightedFeH:fehV/sums[1],rgbVNormalized:color,unsupportedMassFraction:excludedMass/mass,unsupportedReferenceVFraction:excludedV/allV,assumptions:'Linear-age interpolation within published AMR edges and between regional young/old shifts. Scaled-solar Fe/H-to-Z conversion and BC03 log-age/log-Z interpolation are a color-prior proxy, not a reproduction of the VMC PARSEC/Kroupa synthesis. No metallicity extrapolation.',limits:'Regional histories are coarse and coupled to reddening and distance. Oldest age-bin labels extend beyond the cosmological age. Unsupported low-Z portions are omitted and disclosed. No formal color uncertainty is claimed.'}};
}
