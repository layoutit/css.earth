import { cross3 as cross } from '../../../src/platform/vector3.mts';
import assert from 'node:assert/strict';
import { readFitsHeader } from '../../fits/fits.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { array, number, shape, text } from '../terrestrial-layers/source-records.mts';
import { parsePdsRadiusTable } from '../terrestrial-layers/obj-shape.mts';
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';
import { createGiottoSampler, interpolatedNormals, polygonInteriorDistance } from './prepare-giotto.mts';
import { deriveVegaCamera } from './encounter-camera.mts';
import { validateVegaOutline } from './encounter-outline.mts';

const vector = array(number);
const parseRegistration = shape({
  schema:text,
  mask:shape({physicalInsetKm:number,maximumEmissionDegrees:number,maximumIncidenceDegrees:number}),
  observations:array(shape({id:text,utc:text,bodyRight:vector,bodyUp:vector,bodyEye:vector,bodySun:vector,
    kmPerPixel:vector,scaleMultiplier:number,center:vector,footprintPolygon:array(vector)})),
});
type Registration = ReturnType<typeof parseRegistration>;
type Observation = Registration['observations'][number];
const radians = Math.PI/180;
const dot = (a:readonly number[], b:readonly number[]) => a.reduce((sum,n,i) => sum+n*b[i],0);
const sub = (a:readonly number[], b:readonly number[]) => a.map((n,i) => n-b[i]);


const median=(values:readonly number[])=>{assert.ok(values.length);const a=[...values].sort((a,b)=>a-b),mid=Math.floor(a.length/2);return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;};

/** A relative display adjustment, not an exposure or spectral calibration.
 * Each input is from a different 2x2-pixel block in BOTH observations. */
export function fitDisplayGain(logRatios:readonly number[]) {
  if(logRatios.length<64) return {accepted:false as const,reason:'Fewer than 64 distinct paired detector blocks.'};
  const train=logRatios.filter((_,i)=>i%2===0),holdout=logRatios.filter((_,i)=>i%2===1);
  const fit=median(train),gain=Math.exp(fit),errors=holdout.map(n=>n-fit),absolute=errors.map(Math.abs).sort((a,b)=>a-b);
  const bias=median(errors),p95=absolute[Math.ceil(.95*absolute.length)-1];
  const accepted=gain>=1/3 && gain<=3 && Math.abs(bias)<=.1 && p95<=.3;
  return {accepted,gain,trainingBlocks:train.length,heldOutBlocks:holdout.length,heldOutMedianLogError:bias,heldOutP95AbsoluteLogError:p95,
    reason:accepted?'Consistent connected overlap; original illumination and band differences remain.':'Unsupported gain or inconsistent held-out overlap.'};
}

interface VegaValue {dn:number;pixel:number[];emission:number;resolutionKm:number}
export function selectVegaCandidate(values:readonly (VegaValue|null)[]):{index:number;value:VegaValue}|null {
  let winner:{index:number;value:VegaValue}|null=null;
  for(const [index,value] of values.entries()) if(value && (!winner || value.resolutionKm<winner.value.resolutionKm)) winner={value,index};
  return winner;
}

/** These two native KFKI products have 512 rows followed by FITS padding.
 * The old MSB_INTEGER label describes unsigned 8-bit detector data. The native
 * checksum and stated maximum independently qualify that interpretation. */
export function decodeVegaImage(bytes:Uint8Array, header:Uint8Array) {
  const cards=readFitsHeader(Buffer.from(header)).header, width=Number(cards.NAXIS1), height=Number(cards.NAXIS2);
  assert.equal(cards.BITPIX,8);
  assert.equal(cards.BSCALE,1); assert.equal(cards.BZERO,0);
  assert.equal(width,512); assert.equal(height,512);
  assert.equal(bytes.length,Math.ceil(width*height/2880)*2880);
  const data=bytes.slice(0,width*height);
  assert.equal(data.reduce((sum,n)=>sum+n,0),Number(cards.CHECKSUM),'Native image/header checksum mismatch');
  assert.equal(data.reduce((max,n)=>Math.max(max,n),0),Number(cards['DATA-MAX']));
  return {data,width,height,cards};
}

/** Display samples remain illuminated image DN; no reflectance is inferred. */
export function createVegaSampler(mesh:SourceMesh, observation:Observation, mask:Registration['mask'], image:{data:Uint8Array;width:number;height:number}) {
  const normalAt=interpolatedNormals(mesh);
  // Express the guard in physical image-plane kilometres, respecting rectangular pixels.
  const physical=(p:readonly number[]) => p.map((n,i)=>(n-observation.center[i])*observation.kmPerPixel[i]/observation.scaleMultiplier);
  const polygon=observation.footprintPolygon.map(physical);
  return (point:readonly number[],faceId:number) => {
    const normal=normalAt(point,faceId), emission=dot(normal,observation.bodyEye);
    if(emission<Math.cos(mask.maximumEmissionDegrees*radians) || dot(normal,observation.bodySun)<Math.cos(mask.maximumIncidenceDegrees*radians)) return null;
    const hit=mesh.intersect(point.map((n,i)=>n+observation.bodyEye[i]*20000),observation.bodyEye.map(n=>-n));
    if(!hit || Math.abs(hit.radius-20000)>1) return null;
    const xy=[dot(point,observation.bodyRight)/1000,-dot(point,observation.bodyUp)/1000];
    const pixel=xy.map((n,i)=>n*observation.scaleMultiplier/observation.kmPerPixel[i]+observation.center[i]);
    const [x,y]=pixel.map(Math.floor), [u,v]=[pixel[0]-x,pixel[1]-y];
    if(x<0 || y<0 || x+1>=image.width || y+1>=image.height) return null;
    const corners=[[x,y],[x+1,y],[x,y+1],[x+1,y+1]];
    if(corners.some(p=>polygonInteriorDistance(physical(p),polygon)<mask.physicalInsetKm)) return null;
    const values=corners.map(([xx,yy])=>image.data[yy*image.width+xx]);
    const dn=(1-v)*((1-u)*values[0]+u*values[1])+v*((1-u)*values[2]+u*values[3]);
    return {dn,pixel,emission,resolutionKm:Math.max(...observation.kmPerPixel)/observation.scaleMultiplier/emission};
  };
}

export async function prepareEncounters(sourceDirectory:string) {
  const registrationBytes=await readFile(resolve(sourceDirectory,'reference/encounter-registration.json'));
  const registration=parseRegistration(JSON.parse(registrationBytes.toString()));
  assert.equal(registration.schema,'cssearth-halley-encounter-registration@1');
  const giottoRegistration=JSON.parse(await readFile(resolve(sourceDirectory,'reference/giotto-registration.json'),'utf8'));
  const shapeBytes=await readFile(resolve(sourceDirectory,'shape/1682q1halley.tab'));
  const mesh=parsePdsRadiusTable(shapeBytes.toString(),{stepDegrees:5,longitudeDirection:'east-positive',metersPerUnit:1000,expectedVertices:2522,expectedFaces:5040});
  const photo=await sharp(resolve(sourceDirectory,'giotto/hmc_best.gif')).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
  const giotto=createGiottoSampler(mesh,giottoRegistration,{data:photo.data,...photo.info});
  const vega=[];
  for(const observation of registration.observations) {
    const image=decodeVegaImage(await readFile(resolve(sourceDirectory,`vega/${observation.id}.img`)),await readFile(resolve(sourceDirectory,`vega/${observation.id}.hdr`)));
    assert.equal(observation.utc.slice(11,19),image.cards['TIM--OBS']);
    assert.deepEqual(observation.kmPerPixel,[Number(image.cards.SCALEX),Number(image.cards.SCALEY)]);
    assert.ok(observation.scaleMultiplier>=.9 && observation.scaleMultiplier<=1.1);
    const derived=await deriveVegaCamera(sourceDirectory,observation.utc);
    for(const key of ['bodyEye','bodySun','bodyRight','bodyUp'] as const) {
      assert.equal(observation[key].length,3);
      assert.ok(observation[key].every((n,i)=>Math.abs(n-derived[key][i])<1e-8),`${observation.id}: ${key} must follow the pinned spin state and ephemeris`);
    }
    assert.ok(Math.abs(derived.rangeKm/Number(image.cards['RANGE'])-1)<.01);
    assert.ok(Math.abs(derived.phaseDegrees-Number(image.cards['PHASEANG']))<.5);
    assert.ok(Math.abs(derived.sunCounterclockwiseFromUpDegrees-Number(image.cards['SUNANG']))<1.5);
    const outline=validateVegaOutline(mesh,observation);
    vega.push({id:observation.id,filter:image.cards['FILTER'],geometry:derived,outline,sample:createVegaSampler(mesh,observation,registration.mask,image)});
  }
  const weights=[[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]];
  let totalArea=0,oldArea=0,newArea=0;
  const perSourceArea=Array(vega.length+1).fill(0), overlap:{a:number;b:number;logRatios:number[];usedA:Set<string>;usedB:Set<string>;cellLogRatios:number[]}[]=[];
  for(let a=0;a<3;a++) for(let b=a+1;b<3;b++) overlap.push({a,b,logRatios:[],usedA:new Set(),usedB:new Set(),cellLogRatios:[]});
  for(let id=0;id<mesh.indices.length;id++) {
    const f=mesh.indices[id].map(i=>mesh.positions[i]);
    const area=Math.hypot(...cross(sub(f[1],f[0]),sub(f[2],f[0])))/2;totalArea+=area;
    for(const w of weights) {
      const point=[0,1,2].map(k=>f.reduce((sum,v,i)=>sum+v[k]*w[i],0));
      const g=giotto(point,id), vs=vega.map(o=>o.sample(point,id));
      const values=[g?g.color.reduce((sum,n)=>sum+n,0)/3:null,...vs.map(s=>s?.dn??null)], pixels=[g?.pixel,...vs.map(s=>s?.pixel)];
      if(g) oldArea+=area/weights.length;
      if(values.some(v=>v!==null)) newArea+=area/weights.length;
      values.forEach((v,i)=>{if(v!==null) perSourceArea[i]+=area/weights.length;});
      for(const pair of overlap) {
        const a=values[pair.a],b=values[pair.b];
        if(a!==null && b!==null && a>5 && b>5) {
          const logRatio=Math.log(a/b);pair.logRatios.push(logRatio);
          const ka=pixels[pair.a]!.map(n=>Math.floor(n/2)).join(','),kb=pixels[pair.b]!.map(n=>Math.floor(n/2)).join(',');
          if(!pair.usedA.has(ka) && !pair.usedB.has(kb)) {pair.usedA.add(ka);pair.usedB.add(kb);pair.cellLogRatios.push(logRatio);}
        }
      }
    }
  }
  const overlapReport=overlap.map(({a,b,logRatios,cellLogRatios})=>{
    const m=logRatios.length?median(logRatios):null;
    return {a,b,samples:logRatios.length,medianRatio:m===null?null:Math.exp(m),logMad:m===null?null:median(logRatios.map(n=>Math.abs(n-m))),
      distinctTwoPixelCells:cellLogRatios.length,displayFit:fitDisplayGain(cellLogRatios)};
  });
  assert.deepEqual(vega.map(o=>o.id),['t11190','t11194']);
  const vegaFit=overlapReport.find(pair=>pair.a===1 && pair.b===2)!.displayFit;
  assert.ok(vegaFit.accepted && 'gain' in vegaFit,'Vega display levels require qualified overlap.');
  // Anchor Vega to its closest-approach NIR image. The six Giotto/Vega detector
  // blocks are too sparse for a common gain; Giotto retains its original RGB.
  const gains=[1,vegaFit.gain];
  const width=512,height=256,rgb=Buffer.alloc(width*height*3),attribution=Buffer.alloc(width*height),counts=[0,0,0,0];
  let clippedPixels=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const longitude=(x+.5)*360/width,latitude=90-(y+.5)*180/height,l=longitude*radians,b=latitude*radians;
    const hit=mesh.hit(longitude,latitude);assert.ok(hit);
    const point=[Math.cos(b)*Math.cos(l),Math.cos(b)*Math.sin(l),Math.sin(b)].map(n=>n*hit.radius);
    const g=giotto(point,hit.faceId);let color:number[]|null=g?.color??null,source=g?1:0;
    if(!g) {
      const winner=selectVegaCandidate(vega.map(o=>o.sample(point,hit.faceId)));
      if(winner) {
        const value=winner.value.dn*gains[winner.index];
        if(value>255) clippedPixels++;
        color=Array(3).fill(Math.min(255,Math.max(1,Math.round(value))));source=winner.index+2;
      }
    }
    const index=y*width+x; if(color) rgb.set(color,index*3);attribution[index]=source;counts[source]++;
  }
  const png=await sharp(rgb,{raw:{width,height,channels:3}}).png().toBuffer();
  const report={schema:'cssearth-halley-encounter-projection-report@1',
    interpretation:'Approximate mixed-filter, mixed-date photographic mosaic; original illumination and coma contamination retained. Not albedo or true colour.',
    observations:[{id:'giotto',displayGain:1},...vega.map((o,i)=>({id:o.id,filter:o.filter,geometry:o.geometry,outline:o.outline,displayGain:gains[i]}))],
    selection:'Retain every accepted Giotto RGB sample. Else choose the qualified Vega sample with the smallest foreshortening-adjusted pixel size; ties follow observation order.',
    masks:registration.mask,photometricCorrection:'None. Only T11194 receives a fitted relative display gain; this is not a spectral or reflectance calibration.',clippedPixels,
    map:{width,height,attributionCounts:counts},
    attribution:{width,height,encoding:'One unsigned byte per input-map texel, row-major; no padding or bleed. Same orientation as encounters.png.',codes:['gap','giotto',...vega.map(o=>o.id)]},
    coverage:{sourceAreaSquareKm:totalArea/1e6,samplesPerTriangle:7,triangles:mesh.indices.length,beforePercent:oldArea/totalArea*100,afterPercent:newArea/totalArea*100,perSourcePercent:perSourceArea.map(a=>a/totalArea*100)},overlap:overlapReport};
  return {png,attribution,report};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length,3);assert.ok(['--diagnostic','--write'].includes(process.argv[2]));
  const source=resolve('src/objects/comet-1p/source'),result=await prepareEncounters(source),write=process.argv[2]==='--write';
  const output=write?source:resolve('output/comet-intake/halley-mosaic');
  await writeFile(resolve(output,write?'material/encounters.png':'encounters.png'),result.png);
  await writeFile(resolve(output,write?'reference/encounter-attribution.bin':'attribution.bin'),result.attribution);
  await writeFile(resolve(output,write?'reference/encounter-projection-report.json':'projection-report.json'),JSON.stringify(result.report,null,2)+'\n');
  console.log(JSON.stringify({map:result.report.map,coverage:result.report.coverage,overlap:result.report.overlap},null,2));
}
