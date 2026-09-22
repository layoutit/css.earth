/** Exact recorded dependencies. Retrieval does not establish calibration accuracy. */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { sha256File } from '../../../src/platform/sha256.mts';
import { dirname, resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileSize } from '../product-record.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
import { readFitsFileHdus } from '../../fits/fits.mts';
export interface CalibrationDependency {
  readonly field: string; readonly reference: string; readonly status: 'pinned' | 'unresolved'; readonly reason: string;
  readonly file?: string; readonly sha256?: string; readonly bytes?: number; readonly origin?: string;
  readonly applicability: 'recorded' | 'matched' | 'contradicted' | 'unknown';
}
export function parseCalibrationDependencies(raw: unknown): CalibrationDependency[] {
  return requireArray(raw).map(v => {
    const r=requireRecord(v), status=requireString(r.status), applicability=requireString(r.applicability);
    if(!['pinned','unresolved'].includes(status)||!['recorded','matched','contradicted','unknown'].includes(applicability))throw new Error('Invalid calibration dependency status');
    const row={field:requireString(r.field),reference:requireString(r.reference),status:status as CalibrationDependency['status'],reason:requireString(r.reason),applicability:applicability as CalibrationDependency['applicability']};
    if(status==='unresolved')return row;
    const sha256=requireString(r.sha256),bytes=requireFiniteNumber(r.bytes),file=requireString(r.file);
    if(!/^[a-f0-9]{64}$/u.test(sha256)||!Number.isSafeInteger(bytes)||bytes<1||file.startsWith('/')||file.split('/').includes('..'))throw new Error('Invalid calibration pin');
    return {...row,sha256,bytes,file,origin:requireString(r.origin)};
  });
}
export async function verifyCalibrationDependencies(root:string, rows:readonly CalibrationDependency[]):Promise<boolean> {
  for(const row of rows)if(row.status==='pinned'){
    const actual=await sha256File(resolve(root,row.file!)).catch(()=>null);
    if(!actual||actual.sha256!==row.sha256||actual.bytes!==row.bytes)return false;
  }
  return true;
}
export function calibrationOrigin(reference:string):string|undefined {
  if(/^\$[a-z][a-z0-9_]*\/[a-zA-Z0-9_./-]+$/u.test(reference)&&!reference.split('/').includes('..'))
    return `https://asc-isisdata.s3.us-west-2.amazonaws.com/usgs_data/${reference.slice(1)}`;
  if(/^crds:\/\/(jwst|hst|roman)_[a-zA-Z0-9_.-]+$/u.test(reference)) {
    const name=reference.slice(7),mission=name.split('_')[0];return `https://${mission}-crds.stsci.edu/unchecked_get/references/${mission}/${name}`;
  }
  return undefined;
}
/** Cache pins are immutable after first retrieval. Changed cached bytes fail, never silently repin. */
export async function calibrationDependencies(root:string, references:readonly {field:string;value:string}[], productHeader:Readonly<Record<string,unknown>>, options:{maxFileBytes?:number;maxTotalBytes?:number;fetcher?:typeof fetch}={}):Promise<CalibrationDependency[]> {
  const rows:CalibrationDependency[]=[], maxFile=options.maxFileBytes??16_000_000, maxTotal=options.maxTotalBytes??64_000_000;
  let downloaded=0;
  for(const ref of references){
    const origin=calibrationOrigin(ref.value);
    if(!origin){rows.push({field:ref.field,reference:ref.value,status:'unresolved',applicability:'unknown',reason:'No exact archive resolver for this reference.'});continue;}
    const key=createHash('sha256').update(origin).digest('hex'), dir=resolve(root,'output/telescopes/calibration',key), file=resolve(dir,basename(new URL(origin).pathname)), manifest=resolve(dir,'pin.json');
    try{
      const saved=await readFile(manifest,'utf8').then(t=>requireRecord(JSON.parse(t)),()=>undefined);
      if(saved){const current=await fileSize(file);if(current.bytes!==saved.bytes||saved.origin!==origin)throw new Error('Calibration cache integrity mismatch');}
      else {
        const fetcher=options.fetcher??fetch;
        const response=await fetcher(origin,{signal:AbortSignal.timeout(30_000)});
        if(!response.ok||!response.body)throw new Error(`Archive returned HTTP ${response.status}`);
        const declared=Number(response.headers.get('content-length'));
        if((declared>maxFile)||(downloaded+declared>maxTotal)){await response.body.cancel();throw new Error('Dependency exceeds this run\'s explicit calibration download budget');}
        const chunks:Uint8Array[]= [];let n=0,mark=10_000_000;
        for await(const chunk of response.body){n+=chunk.length;if(n>maxFile||downloaded+n>maxTotal)throw new Error('Dependency exceeds calibration download budget');chunks.push(chunk);if(n>=mark){process.stderr.write(`${basename(file)}: ${(n/1e6).toFixed(1)} MB\n`);mark+=10_000_000;}}
        if(!n)throw new Error('Empty calibration file');
        await mkdir(dir,{recursive:true});const tmp=`${file}.${process.pid}.partial`;await writeFile(tmp,Buffer.concat(chunks));await rename(tmp,file);
        const pin=await fileSize(file);await writeFile(manifest,JSON.stringify({...pin,origin}));downloaded+=n;
      }
      const pin=await fileSize(file);let applicability:CalibrationDependency['applicability']='recorded',reason='Exact file named by the product; archive bytes pinned. Calibration accuracy is not independently verified.';
      if(/\.fits$/iu.test(file)){
        const h=(await readFitsFileHdus(file))[0].header;let checked=0,conflict=false;
        for(const key of ['INSTRUME','DETECTOR','FILTER','GRATING','PUPIL']){
          const expected=productHeader[key],actual=h[key];if(expected===undefined||actual===undefined||['ANY','N/A','GENERIC'].includes(String(actual)))continue;
          checked++;if(!String(actual).split('|').map(s=>s.trim()).includes(String(expected)))conflict=true;
        }
        if(conflict){applicability='contradicted';reason='Calibration selectors contradict the product headers; this dependency cannot support scientific facts.';}
        else if(checked){applicability='matched';reason=`Exact recorded file and ${checked} instrument/configuration selectors agree; calibration accuracy is not independently verified.`;}
      }
      rows.push({field:ref.field,reference:ref.value,status:'pinned',applicability,reason,file:relative(root,file),origin,...pin});
    }catch(error){
      if(String(error).includes('integrity mismatch'))throw error;
      rows.push({field:ref.field,reference:ref.value,status:'unresolved',applicability:'unknown',origin,reason:String(error)});
    }
  }
  return rows;
}
