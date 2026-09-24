import { cross3 as cross } from '../../../src/platform/vector3.mts';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {parseMeshProfile} from './source-records.mts';
import {array,choice,number,shape,text} from '@cssearth/core';
import {loadPdsPlanetocentricShape} from './obj-shape.mts';
import {decodeHriiSpectra,decodeHriiSolarTable,fitHriiSpectrum} from './hrii-spectra.mts';
import {hriiCamera,hriiControlResidual} from './hrii-camera.mts';
import {parseHriiContext,parseHriiDenseFit,loadHriiContext,fitHriiPointing} from './hrii-pointing.mts';

const pin=shape({path:text});
const recipeParser=shape({schema:text,target:text,targetAliases:array(text),mesh:shape({path:text,grid:parseMeshProfile}),solar:pin,
  bodyToJ2000:array(array(number)),offsetPixels:array(number),
  frames:array(shape({id:text,number:number,path:text,startTime:text})),
  context:parseHriiContext,
  registration:shape({method:choice('dense-context-fit-with-terrain-holdouts'),dense:parseHriiDenseFit,
    controls:array(shape({id:text,frame:number,row:number,sourcePointMeters:array(number)})),
    maximumRmsPixels:number,maximumResidualPixels:number}),
  coverage:shape({maximumIncidenceDegrees:number,maximumEmissionDegrees:number,edgeMarginPixels:number}),
});

const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=(a:number[])=>a.map(v=>v/Math.hypot(...a));


/** Convert pinned spectral pixels to a table on their selected full source mesh.
 * No spectral, geometry or camera work is left to the application runtime. */
export async function prepareHriiFacets(sourceDirectory:string,recipePath:string) {
  const source=resolve(sourceDirectory);
  const read=async(path:string)=>{
    const target=resolve(source,path),local=relative(source,target);
    if(!local||local.startsWith('..')||path.startsWith('/'))throw new Error('HRII input is outside its source package.');
    return readFile(target);
  };
  const recipeBytes=await read(recipePath),r=recipeParser(JSON.parse(recipeBytes.toString('utf8')));
  if(r.schema!=='cssearth-hrii-facet-preparation@1'||!r.frames.length||r.frames.some((f,i)=>!Number.isSafeInteger(f.number)||(i>0&&f.number<=r.frames[i-1].number)))throw new Error('Invalid HRII scan recipe.');
  if(r.registration.controls.length<4||r.registration.maximumRmsPixels>Math.SQRT2||r.registration.maximumResidualPixels>2||
     r.registration.maximumRmsPixels<=0||r.registration.maximumResidualPixels<r.registration.maximumRmsPixels)throw new Error('Insufficient HRII camera evidence.');
  const c=r.coverage;
  if(c.maximumIncidenceDegrees<=0||c.maximumIncidenceDegrees>75||c.maximumEmissionDegrees<=0||c.maximumEmissionDegrees>75||c.edgeMarginPixels<2||c.edgeMarginPixels>4)throw new Error('Unbounded HRII surface coverage.');
  await read(r.mesh.path);
  const mesh=await loadPdsPlanetocentricShape(resolve(source,r.mesh.path),r.mesh.grid);
  const solar=decodeHriiSolarTable((await read(r.solar.path)).toString('utf8'));
  const normals=mesh.indices.map(indices=>{
    const [a,b,d]=indices.map(i=>mesh.positions[i]);return unit(cross(b.map((v,i)=>v-a[i]),d.map((v,i)=>v-a[i])));
  });
  const centers=mesh.indices.map(indices=>[0,1,2].map(axis=>indices.reduce((s,i)=>s+mesh.positions[i][axis],0)/3));
  const inputs:{frame:(typeof r.frames)[number];spectrum:ReturnType<typeof decodeHriiSpectra>;camera:ReturnType<typeof hriiCamera>;values:Float64Array}[]=[];
  for(const frame of r.frames) {
    const spectrum=decodeHriiSpectra(await read(frame.path));
    if(![r.target,...r.targetAliases].includes(text(spectrum.header.OBJECT))||spectrum.header.OBSDATE!==frame.startTime)throw new Error(`Wrong HRII exposure: ${frame.id}`);
    const camera=hriiCamera(spectrum.header,r);
    inputs.push({frame,spectrum,camera,values:new Float64Array(spectrum.height*2).fill(NaN)});
  }
  const context=await loadHriiContext(r.context,read,mesh,r.bodyToJ2000);
  const dense=fitHriiPointing(r.registration.dense,inputs,r.bodyToJ2000,mesh,context,r.registration.controls);
  if(r.offsetPixels.length!==2||dense.offsetPixels.some((v,i)=>Math.abs(v-r.offsetPixels[i])>1e-8))throw new Error(`HRII pointing does not reproduce: ${dense.offsetPixels}, expected ${r.offsetPixels}`);
  const controls=r.registration.controls.map(control=>({id:control.id,...hriiControlResidual(inputs.map(x=>x.camera),r.frames.map(x=>x.number),control)}));
  const rms=Math.sqrt(controls.reduce((s,x)=>s+x.distancePixels**2,0)/controls.length),maximum=Math.max(...controls.map(x=>x.distancePixels));
  if(rms>r.registration.maximumRmsPixels||maximum>r.registration.maximumResidualPixels)throw new Error(`HRII terrain holdouts fail: RMS ${rms}, maximum ${maximum} pixels.`);
  const minimumIncidence=Math.cos(c.maximumIncidenceDegrees*Math.PI/180),minimumEmission=Math.cos(c.maximumEmissionDegrees*Math.PI/180);
  const reject:Record<string,number>={};let acceptedPixels=0;
  const spectra:{frame:string;row:number;incidenceCosine:number;heliocentricDistanceAu:number;temperatureKelvin:number;slopePercentPer100Nm:number}[]=[];
  const count=(reason:string)=>{reject[reason]=(reject[reason]??0)+1;};
  for(const input of inputs) {
    const {spectrum,camera}=input;
    for(let row=2;row<spectrum.height-2;row++) {
      const ray=camera.ray(row),hit=mesh.intersect(camera.eye,ray);
      if(!hit){count('outside-nucleus');continue;}
      if(mesh.indices[hit.faceId].some(i=>mesh.constraintFlags?.[i]!==1)){count('outside-stereo-control');continue;}
      const normal=normals[hit.faceId],mu0=dot(normal,camera.sunDirection),mu=-dot(normal,ray);
      if(mu0<minimumIncidence||mu<minimumEmission){count('grazing-or-unlit');continue;}
      let bounded=true;
      for(const dx of [-c.edgeMarginPixels,0,c.edgeMarginPixels])for(const dy of [-c.edgeMarginPixels,0,c.edgeMarginPixels]) {
        const near=mesh.intersect(camera.eye,camera.ray(row+dy,dx));
        if(!near||mesh.indices[near.faceId].some(i=>mesh.constraintFlags?.[i]===3)){bounded=false;break;}
      }
      if(!bounded){count('uncertain-nucleus-edge');continue;}
      const samples=Array.from({length:spectrum.width},(_,channel)=>{
        const i=row*spectrum.width+channel;return {wavelengthMicrons:spectrum.wavelength[i],radiance:spectrum.values[i],valid:!spectrum.reject(i)};
      });
      const fit=fitHriiSpectrum(samples,solar,{incidenceCosine:mu0,heliocentricDistanceAu:camera.heliocentricDistanceAu});
      if(!fit){count('spectrum-not-qualified');continue;}
      input.values[row*2]=fit.thermal.colorTemperatureKelvin;input.values[row*2+1]=fit.continuum.slopePercentPer100Nm;
      spectra.push({frame:input.frame.path,row,incidenceCosine:mu0,heliocentricDistanceAu:camera.heliocentricDistanceAu,temperatureKelvin:fit.thermal.colorTemperatureKelvin,slopePercentPer100Nm:fit.continuum.slopePercentPer100Nm});
      acceptedPixels++;
    }
  }
  const temperatures=new Float64Array(mesh.faces).fill(NaN),slopes=new Float64Array(mesh.faces).fill(NaN),frameNumbers=new Float64Array(mesh.faces).fill(NaN),detectorRows=new Float64Array(mesh.faces).fill(NaN);
  for(let face=0;face<mesh.faces;face++) {
    if(mesh.indices[face].some(i=>mesh.constraintFlags?.[i]!==1))continue;
    const point=centers[face];let best=Infinity;
    for(const input of inputs) {
      const {camera}=input,pixel=camera.project(point);if(!pixel||Math.abs(pixel[0])>.5)continue;
      const row=Math.round(pixel[1]);if(row<0||row>=camera.rows||!Number.isFinite(input.values[row*2]))continue;
      const d=point.map((v,i)=>v-camera.eye[i]),distance=Math.hypot(...d),ray=unit(d),hit=mesh.intersect(camera.eye,ray,distance+.5);
      if(!hit||Math.abs(hit.radius-distance)>.5||dot(normals[face],camera.sunDirection)<minimumIncidence||-dot(normals[face],ray)<minimumEmission)continue;
      const score=Math.hypot(pixel[0],pixel[1]-row);if(score>=best)continue;
      best=score;temperatures[face]=input.values[row*2];slopes[face]=input.values[row*2+1];frameNumbers[face]=input.frame.number;detectorRows[face]=row;
    }
  }
  const finite=Array.from(temperatures).filter(Number.isFinite),finiteSlope=Array.from(slopes).filter(Number.isFinite);
  if(!finite.length)throw new Error('HRII has no qualified source facets.');
  const csv=['X,Y,Z,Color temperature,Continuum slope,Scan frame,Detector row','km,km,km,K,%/100nm,1,1',...centers.map((point,i)=>[...point.map(x=>(x/1000).toFixed(9)),temperatures[i],slopes[i],frameNumbers[i],detectorRows[i]].join(','))].join('\n')+'\n';
  return {bytes:gzipSync(Buffer.from(csv),{level:9}),report:{schema:'cssearth-hrii-facet-result@1',
    inputFrames:r.frames.length,acceptedPixels,rejectedPixels:reject,sourceFacets:mesh.faces,acceptedFacets:finite.length,
    temperatureRangeKelvin:[Math.min(...finite),Math.max(...finite)],slopeRangePercentPer100Nm:[Math.min(...finiteSlope),Math.max(...finiteSlope)],
    spectralAnchors:[spectra[0],spectra[Math.floor(spectra.length/2)],spectra.at(-1)!],
    registration:{context:context.report,dense,rmsPixels:rms,maximumPixels:maximum,controls},
    method:'Native V3 calibrated spectra; iterated solar continuum and free-amplitude L1 Planck fit; nearest slit footprint on the selected source mesh.',
    coverage:'Stereo-controlled source facets, detector flags, spectral-fit checks, incidence/emission below 75 degrees, and a two-pixel nucleus-edge margin. No interpolation across missing spectra.'}};
}

export async function writeHriiFacets(sourceDirectory:string,recipePath:string,outputPath:string,reportPath:string) {
  const result=await prepareHriiFacets(sourceDirectory,recipePath);
  await writeFile(resolve(sourceDirectory,outputPath),result.bytes);
  await writeFile(resolve(sourceDirectory,reportPath),JSON.stringify(result.report,null,2)+'\n');
  return result.report;
}
