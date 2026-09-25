/** One readback owner for native source files and reducer products. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sciencePackage } from '@cssearth/telescope/node';
import { isisMetadata, pdsMetadata, parseNativeMetadata, type NativeMetadata } from './native-metadata.mts';
import { calibrationDependencies, verifyCalibrationDependencies } from './calibration-dependencies.mts';
import { parseProductFacts } from './qualified-observations.mts';
import { fileSize } from '@cssearth/telescope/node';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { decodeIsis3Core } from '../terrestrial-layers/isis3-raster.mts';
import type { ProductFacts } from './request-satisfaction.mts';
export interface ScienceProduct { readonly file:string; readonly format:'fits'|'isis3'|'pds'; readonly target:string; readonly label?:string; readonly decoded?:unknown; readonly region?: import('@cssearth/telescope/node').IcrsCircle }
function intersection(left:readonly (readonly [number,number])[],right:readonly (readonly [number,number])[]): [number,number][] {
  return left.flatMap(([a,b])=>right.flatMap(([c,d])=>Math.max(a,c)<=Math.min(b,d)?[[Math.max(a,c),Math.min(b,d)] as [number,number]]:[]));
}
export async function readProductScience(root:string, product:ScienceProduct, options:{resolveCalibrations?:boolean}={}):Promise<Partial<ProductFacts>> {
  const before=await fileSize(resolve(root,product.file));let facts:Partial<ProductFacts>, references:{field:string;value:string}[]=[],header:Record<string,unknown>={};
  if(product.format==='fits'){
    const answer=await sciencePackage({operation:'fits',path:resolve(root,product.file), ...(product.region ? { region: product.region } : {})});
    const rows=requireArray(answer.structures).map(v=>requireRecord(v));
    const structures=rows.map(r=>parseNativeMetadata(r)), first=structures[0];
    let intervals=rows[0]?.wavelengthIntervalsMicrometres;
    for(const row of rows.slice(1))intervals=intervals===undefined||row.wavelengthIntervalsMicrometres===undefined?undefined:intersection(parseProductFacts({target:product.target,verified:true,wavelengthIntervalsMicrometres:intervals}).wavelengthIntervalsMicrometres!,parseProductFacts({target:product.target,verified:true,wavelengthIntervalsMicrometres:row.wavelengthIntervalsMicrometres}).wavelengthIntervalsMicrometres!);
    const beams=rows.map(r=>r.angularResolutionArcsec), beam=beams.length&&beams.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)?Math.max(...beams as number[]):undefined;
    const multi:NativeMetadata={structure:'multiple science arrays',structures,calibration:structures.flatMap(s=>s.calibration),limitations:['Each science array is qualified separately; top-level coverage is their intersection. No measurements are averaged.']};
    facts=parseProductFacts({target:product.target,verified:true,nativeMetadata:structures.length===1?first:multi,
      ...(rows.length === 1 && rows[0]!.regionCoverage ? { regionCoverage: rows[0]!.regionCoverage } : {}),
      kind:structures.every(s=>s.shape && (s.shape.length>3?2+s.shape.slice(0,-2).filter(n=>n!==1).length:s.shape.length)===3)?'cube':structures.every(s=>s.shape && (s.shape.length>3?2+s.shape.slice(0,-2).filter(n=>n!==1).length:s.shape.length)===2)?'image':undefined,
      ...(intervals===undefined?{}:{wavelengthIntervalsMicrometres:intervals}),
      ...(beam===undefined?{}:{angularResolutionArcsec:beam,resolutionEvidence:[{kind:'calibrated',receipt:{file:product.file}}]})});
    references=requireArray(answer.references).map(r=>{const row=requireRecord(r);return {field:requireString(row.field),value:requireString(row.value)};});header=requireRecord(answer.primary);
  }else{
    if(product.format==='isis3'){
      const bytes=await readFile(resolve(root,product.file)),label=product.label?await readFile(resolve(root,product.label)):bytes,core=decodeIsis3Core(bytes,label),valid=new Array<boolean>(core.bands).fill(false),minimum=Buffer.from('faff7fff','hex').readFloatLE();
      let finite=0;for(let i=0;i<core.data.length;i++)if(Number.isFinite(core.data[i])&&core.data[i]>=minimum){finite++;valid[Math.floor(i/(core.width*core.height))]=true;}
      facts=isisMetadata(label,core.bands,valid);
      facts={...facts,nativeMetadata:{...facts.nativeMetadata!,quality:{policy:'finite non-special ISIS core; uncertainty and quality arrays absent',samples:core.data.length,finite,usable:finite,flagged:core.data.length-finite,invalidUncertainty:0,mask:null},uncertainty:{status:'unknown',kind:null,structure:null}}};
      references=facts.nativeMetadata!.calibration.filter(r=>r.field.endsWith('File'));
      header=core.identity;
    }else facts=pdsMetadata(product.decoded);
    const meta=facts.nativeMetadata!;
    if(meta.units){const result=await sciencePackage({operation:'units',units:[meta.units.value]}),value=requireArray(result.units)[0];
      if(value===null){facts={...facts,nativeMetadata:{...meta,units:undefined,limitations:[...meta.limitations,`Astropy cannot validate unit ${meta.units.value}.`]}};}}
  }
  if(options.resolveCalibrations!==false && references.length){
    const dependencies=await calibrationDependencies(root,references,header);
    facts={...facts,calibrationDependencies:dependencies};
    // A matched VIMS reference must reproduce the product's time-dependent coordinate vector.
    if(product.format==='isis3'&&facts.nativeMetadata?.spectral){
      const band=dependencies.find(r=>r.field==='RadiometricCalibration:BandwidthFile'&&r.file);
      if(band){try{
        const calBytes=await readFile(resolve(root,band.file!)),cal=decodeIsis3Core(calBytes,calBytes,false),centers=facts.nativeMetadata.spectral.centersMicrometres;
        const bytes=await readFile(resolve(root,product.label??product.file));
        const original=/OriginalBand\s*=\s*\(([^)]+)\)/u.exec(bytes.subarray(0,128*1024).toString('latin1'))?.[1].split(',').map(Number);
        if(original?.length===centers.length){const plane=cal.width*cal.height;
          const matches=original.every((b,i)=>{if(!Number.isInteger(b)||b<1||b>cal.bands)return false;const values=cal.data.subarray((b-1)*plane,b*plane);const mean=values.reduce((a,b)=>a+b,0)/plane;return Math.abs(mean-centers[i])<=Math.max(1e-5,Math.abs(centers[i])*1e-5);});
          if(!matches)throw new Error('Recorded calibration coordinates contradict the product');
          facts={...facts,calibrationDependencies:dependencies.map(d=>d===band?{...d,applicability:'matched',reason:'Exact recorded band indices reproduce the calibrated wavelength centers within label rounding.'}:d)};
        }
      }catch(error){if(String(error).includes('contradict'))throw error;facts={...facts,calibrationDependencies:dependencies.map(d=>d===band?{...d,reason:`Pinned reference could not establish coordinate applicability: ${String(error)}`}:d)};}}
    }
  }
  if(!await verifyCalibrationDependencies(root,facts.calibrationDependencies??[]))throw new Error('Calibration bytes changed during scientific readback');
  const after=await fileSize(resolve(root,product.file));if(after.bytes!==before.bytes)throw new Error('Product changed during scientific readback');
  return facts;
}
