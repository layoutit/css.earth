import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

type Vec=readonly[number,number,number];
type Json=Record<string,unknown>;
const record=(v:unknown):Json=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Expected record.');return v as Json;};
const finite=(v:unknown):number=>{if(typeof v!=='number'||!Number.isFinite(v))throw new TypeError('Expected finite number.');return v;};
const positive=(v:unknown):number=>{const n=finite(v);if(!(n>0))throw new RangeError('Expected positive number.');return n;};
const vector=(v:unknown):Vec=>{if(!Array.isArray(v)||v.length!==3)throw new TypeError('Expected three-vector.');return [finite(v[0]),finite(v[1]),finite(v[2])];};
export interface DepthPrior {
 /** Physical local Cartesian coordinates, in pc relative to the136pc reference. */
 sample(x:number,y:number,z:number):number;
 /** Observer-ray coordinates: east/north intersected with the136pc plane. */
 sampleRay(xAt136:number,yAt136:number,z:number):number;
 metadata:Json;
}
export async function loadDepthPrior(directory=resolve('src/objects/milky-way-pleiades-dust/source')):Promise<DepthPrior>{
 const header=record(JSON.parse(await readFile(resolve(directory,'depth-profiles.json'),'utf8'))),g=record(header.grid),coordinate=record(header.coordinate);
 if(header.schema!=='pleiades-normal-depth-grid@1'||header.executionComplete!==true)throw new TypeError('Unfinished or unsupported depth prior.');
 const nx=finite(g.nx),ny=finite(g.ny),nz=finite(g.nz),min=vector(g.min),step=vector(g.step),reference=positive(coordinate.referenceNormalDepthPc);
 for(const n of [nx,ny,nz])if(!Number.isSafeInteger(n)||n<2)throw new RangeError('Invalid grid dimension.');
 step.forEach(positive);
 const primary=header.primary;if(typeof primary!=='string'||primary.includes('..')||primary.includes('/'))throw new TypeError('Invalid local primary file.');
 const values=header.values;if(values!==undefined&&(!Array.isArray(values)||values.length!==nx*ny*nz))throw new RangeError('Depth-prior sample count mismatch.');
 const buffer=values===undefined?await readFile(resolve(directory,primary)):null;if(buffer&&buffer.length!==nx*ny*nz*4)throw new RangeError('Depth-prior byte count mismatch.');
 const data=new Float32Array(nx*ny*nz);for(let i=0;i<data.length;i++){const value=Array.isArray(values)?finite(values[i]):buffer!.readFloatLE(i*4);if(!(finite(value)>=0))throw new RangeError('Negative prior.');data[i]=value;}
 // The transport promises complete sight lines and unit normal-depth integrals.
 for(let p=0;p<nx*ny;p++){let total=0;for(let i=1;i<nz;i++)total+=(data[p*nz+i-1]!+data[p*nz+i]!)*step[2]/2;if(Math.abs(total-1)>2e-5)throw new RangeError('Unnormalized/incomplete primary sight line.');}
 const sampleRay=(x:number,y:number,z:number):number=>{
  const f=[(finite(x)-min[0])/step[0],(finite(y)-min[1])/step[1],(finite(z)-min[2])/step[2]],dims=[nx,ny,nz];
  if(f.some((v,i)=>v<0||v>dims[i]!-1))return 0;
  const base=f.map((v,i)=>Math.min(dims[i]!-2,Math.floor(v))),t=f.map((v,i)=>v-base[i]!);let value=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)for(let dz=0;dz<2;dz++)value+=data[((base[1]!+dy)*nx+base[0]!+dx)*nz+base[2]!+dz]!*(dx?t[0]!:1-t[0]!)*(dy?t[1]!:1-t[1]!)*(dz?t[2]!:1-t[2]!);
  return value;
 };
 const metadataHeader={...header};delete metadataHeader.values;
 return {sampleRay,sample:(x,y,z)=>{const depth=reference+finite(z);if(!(depth>0))return 0;return sampleRay(finite(x)*reference/depth,finite(y)*reference/depth,z);},metadata:{...metadataHeader,reader:'trilinear node interpolation; physical sample projects its x/y onto the observer-ray chart at136pc',normalizationCaution:'Returned profile is per normal pc. If multiplying by an observed radial column, multiply by dot(ray,normal) to obtain physical density per radial pc, or explicitly renormalize the integrated ray.',outsideSupport:'returns0; caller must preserve/match wide-source attenuation. This is not a physical cloud edge.'}};
}

export interface CavityStar {name:string;at:Vec;luminositySolar:number;massSolar:number}
export interface CavityGrain {radiusMicron:number;weight:number;materialDensityGcm3:number;qPr:number}
export interface CavityInputs {stars:readonly CavityStar[];grains:readonly CavityGrain[];upstream:Vec;speedKmS:number}
export interface CavityOptions {radiation?:boolean}
export interface CavityModel {factor(x:number,y:number,z:number,cellPc:number):number;metadata:Json}
interface CombinedStar {names:string[];at:Vec;luminositySolar:number;massSolar:number}
interface Population {weight:number;grain:number;speedKmS:number;radiiPc:number[]}
const SPEED_OFFSETS=[-1,0,1] as const,SPEED_WEIGHTS=[.25,.5,.25] as const;
const G_PC_KMS=4.30091727e-3;
// Exact primitive/finite-cell average copied from the Pleiades offline fields owner.
// F'(A)=.5(sqrt(A)+1/sqrt(A)), outside the excluded A<=0 region.
function densityPrimitive(a:number):number{if(a<=0)return 0;if(a>=1)return 4/3+a-1;return Math.sqrt(a)*(1+a/3);}
function averageColdDensity(a:number,halfWidth:number):number{
 if(a+halfWidth<=0)return 0;
 if(halfWidth<1e-7&&a>halfWidth*10){const q=Math.sqrt(a);return .5*(q+1/q);}
 const width=Math.max(halfWidth,1e-10);return (densityPrimitive(a+width)-densityPrimitive(a-width))/(2*width);
}
export function cavityModel(inputs:CavityInputs,options:CavityOptions={}):CavityModel{
 const u=vector(inputs.upstream),speed=positive(inputs.speedKmS);if(Math.abs(Math.hypot(...u)-1)>1e-8)throw new RangeError('Upstream must be a unit vector opposing the incoming velocity.');
 if(speed<=1)throw new RangeError('Incoming speed must exceed adopted1km/s dispersion.');
 if(!inputs.stars.length||!inputs.grains.length)throw new RangeError('Stars and grain populations are required.');
 const groups:CombinedStar[]=[];
 for(const star of inputs.stars){const at=vector(star.at),L=positive(star.luminositySolar),M=positive(star.massSolar);let group=groups.find(s=>Math.hypot(s.at[0]-at[0],s.at[1]-at[1],s.at[2]-at[2])<1e-9);if(!group){group={names:[],at,luminositySolar:0,massSolar:0};groups.push(group);}group.names.push(star.name);group.luminositySolar+=L;group.massSolar+=M;}
 let totalGrainWeight=0;for(const grain of inputs.grains){positive(grain.radiusMicron);positive(grain.weight);positive(grain.materialDensityGcm3);if(finite(grain.qPr)<0)throw new RangeError('Negative Qpr.');totalGrainWeight+=grain.weight;}
 const radiation=options.radiation!==false,ensemble:Population[]=[];
 for(const [grainIndex,grain] of inputs.grains.entries())for(const [speedIndex,offset] of SPEED_OFFSETS.entries()){
  const v=speed+offset,radiiPc=groups.map(s=>2*G_PC_KMS*Math.max(0,(radiation?.574*s.luminositySolar*grain.qPr/(grain.materialDensityGcm3*grain.radiusMicron):0)-s.massSolar)/(v*v));
  ensemble.push({grain:grainIndex,speedKmS:v,weight:grain.weight/totalGrainWeight*SPEED_WEIGHTS[speedIndex]!,radiiPc});
 }
 return {factor:(x,y,z,cellPc)=>{
  finite(x);finite(y);finite(z);positive(cellPc);if(!radiation)return 1;
  const w:number[]=[],halfW:number[]=[];
  for(const star of groups){const dx=x-star.at[0],dy=y-star.at[1],dz=z-star.at[2],r=Math.hypot(dx,dy,dz);w.push(Math.max(0,r+dx*u[0]+dy*u[1]+dz*u[2]));halfW.push(r>0?.5*cellPc*(Math.abs(dx/r+u[0])+Math.abs(dy/r+u[1])+Math.abs(dz/r+u[2])):0);}
  let factor=0;
  for(const population of ensemble){let worstA=1,interval=0,excluded=false;
   for(let j=0;j<groups.length;j++){const r0=population.radiiPc[j]!;if(r0<=0)continue;const denominator=w[j]!;if(denominator<1e-14){excluded=true;break;}const twiceRadius=2*r0,a=1-twiceRadius/denominator;if(a<worstA){worstA=a;interval=twiceRadius*halfW[j]!/(denominator*denominator);}}
   if(!excluded)factor+=population.weight*averageColdDensity(worstA,interval);
  }
  if(!Number.isFinite(factor)||factor<0)throw new RangeError('Nonphysical cold-flow factor.');return factor;
 },metadata:{method:'Pleiades analytic cold-flow grain/speed ensemble; minimum A over individual-star avoidance regions; not an exact multi-star continuity solution',sourceImplementation:'.local/physics/fields.mts populations/densityPrimitive/averageColdDensity/cavities',primaryTheory:'Artymowicz&Clampin1997Eq1–4; Katushkina&Izmodenov2019Eq12',formula:'r0=2G(beta−1)M/v²; beta=.574LQpr/(M rho a); A=1−2r0/(r+r·upstream); n/n∞=.5(sqrt(A)+1/sqrt(A)) for A>0',forceUnits:'G=4.30091727e−3 pc(km/s)²/solarMass',radiationEnabled:radiation,combinedStars:groups,grainPopulations:inputs.grains,speedKmS:speed,speedOffsetsKmS:[...SPEED_OFFSETS],speedWeights:[...SPEED_WEIGHTS],upstream:[...u],ensemble,assumptions:['Grain sizes/weights/material density and Qpr are adopted unless supplied with specific measurements.','The conditional Herbig flow is not measured for the whole foreground cloud; speed dispersion±1km/s is adopted.','Cold collisionless flow; gas drag and magnetic coupling omitted.','The finite caustic uses the Pleiades cell-integrated primitive; cellPc is an isotropic physical cell size.','Coincident stellar components have summed force before their avoidance radius is computed.','No column compensation is applied here; the caller owns any observational normalization.','Radiation-disabled or non-repulsive populations have factor1; gravitational focusing is omitted.']}};
}
