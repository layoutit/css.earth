/** DeMCELS source qualification. Shared FITS code is unchanged. */
import { readFile,writeFile } from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readFitsImage,skyProjection,type FitsHeader} from '@cssearth/fits';
import {need} from './inputs.mts';
export async function readGas(path:string){
  const bytes=await readFile(path);need(bytes.length<=64*1024**2,'Gas cutout exceeds pilot budget');
  const normalized=normalizeEquinox(bytes);
  const image=readFitsImage(normalized.bytes,{maxDecodedBytes:128*1024**2});
  need(image.bitpix===-32&&image.width>10&&image.height>10,'Expected floating-point DeMCELS image');
  const header:FitsHeader={...image.header};
  const ignored:Record<string,unknown>={};
  if(['CD1_1','CD1_2','CD2_1','CD2_2'].every(k=>typeof header[k]==='number'))for(const k of ['CDELT1','CDELT2','CROTA1','CROTA2'])if(k in header){ignored[k]=header[k];delete header[k];}
  const projection=skyProjection(header);
  const finite=Array.from(image.values).filter(Number.isFinite).sort((a,b)=>a-b);need(finite.length>100,'No finite gas pixels');
  const at=(p:number)=>finite[Math.floor((finite.length-1)*p)];
  return {image,projection,summary:{path,bytes:bytes.length,width:image.width,height:image.height,header:image.header,normalizedDuplicateCards:normalized.cards,originalUnchanged:true,ignoredLegacyWcsCards:ignored,finite:finite.length,
    p05:at(.05),p50:at(.5),p99:at(.99),maximum:at(1),center:projection.skyOf((image.width-1)/2,(image.height-1)/2),warnings:image.warnings,
    meaning:'Published ha_sub_r is continuum-subtracted narrow-band signal. Missing BUNIT prevents an absolute-flux claim; finite linear counts are a relative emission morphology only.',
    matrixRule:'FITS/WCS full CD matrix takes precedence over legacy CDELT/CROTA for this source. Only a temporary projection-header copy is used; original cards and shared reader remain unchanged.'}};
}
/** This LMC-only adapter retains the appended cutout WCS and identical metadata
 * repeats in a copy, preserving byte offsets and the original source. Other conflicts fail.
 */
export function normalizeEquinox(original:Buffer):{bytes:Buffer;cards:string[]} {
  const bytes=Buffer.from(original),cards:string[]=[],seen=new Map<string,{value:string;offset:number;card:string}>();
  const cutoutWcs=new Set(['CRPIX1','CRPIX2','CD1_1','CD1_2','CD2_1','CD2_2']);
  for(let offset=0;offset+80<=bytes.length;offset+=80){
    const card=bytes.subarray(offset,offset+80).toString('ascii'),key=card.slice(0,8).trim();if(key==='END')break;
    if(card[8]!=='=')continue;
    let quoted=false,end=80;
    for(let i=10;i<80;i++){
      if(card[i]==="'"){if(quoted&&card[i+1]==="'"){i++;continue;}quoted=!quoted;}
      if(card[i]==='/'&&!quoted){end=i;break;}
    }
    const value=card.slice(10,end).trim(),prior=seen.get(key);
    if(!prior){seen.set(key,{value,offset,card});continue;}
    const same=value===prior.value||Number.isFinite(Number(value))&&Number(value)===Number(prior.value);
    need(same||cutoutWcs.has(key),`Conflicting duplicate ${key} values`);
    // Data Lab cutouts append updated CRPIX/CD values after the original tile WCS.
    // Keep the final cutout WCS; all other repeats must be identical.
    cards.push(prior.card);bytes.write(`COMMENT LMC cutout adapter retained ${key} in source record.`.padEnd(80).slice(0,80),prior.offset,80,'ascii');
    seen.set(key,{value,offset,card});
  }
  return {bytes,cards};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  need(process.argv[2],'Supply a DeMCELS cutout path');const source=await readGas(process.argv[2]);
  await writeFile(`${process.argv[2]}.qualification.json`,JSON.stringify(source.summary,null,2)+'\n');console.log(JSON.stringify(source.summary));
}
