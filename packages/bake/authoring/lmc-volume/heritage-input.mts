/** Gordon's author-released BEMBB expectation maps. Shared FITS code stays unchanged. */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readFitsHdus,readFitsImage,skyProjection,type FitsHeader} from '@cssearth/fits';
import {LOCAL,need} from './inputs.mts';
export const L19=LOCAL+'versions/l19/',HERITAGE_FILE='lmc_bembb_19apr14_dust_param_exp.final.fits';
export function heritageProjectionHeader(source:FitsHeader){const h={...source};need(h.CTYPE1==='RA---TAN'&&h.CTYPE2==='DEC--TAN'&&h.PV2_1===0&&h.PV2_2===0,'Unexpected HERITAGE projection cards');delete h.PV2_1;delete h.PV2_2;return h;}
export async function inspectHeritage(){
 const bytes=await readFile(L19+'inputs/'+HERITAGE_FILE);need(bytes.length<64*1024**2,'HERITAGE file exceeds bounded input size');
 const hdus=readFitsHdus(bytes),summary={file:HERITAGE_FILE,bytes:bytes.length,hdus:hdus.map((h,i)=>({hdu:i,header:h.header,dimensions:h.dimensions,offset:i?hdus[i-1].nextOffset:0,dataOffset:h.dataOffset}))};
 await writeFile(L19+'inputs/fits-inspection.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({sentinel:'HERITAGE_HDUS_INSPECTED',...summary}));return{bytes,hdus};
}
export async function loadHeritage(){
 const {bytes,hdus}=await inspectHeritage(),index=hdus.findIndex(h=>h.header.EXTNAME==='log_sigma_mass');need(index>0,'Missing log dust surface density extension');const image=readFitsImage(bytes,{start:hdus[index-1].nextOffset,maxDecodedBytes:32*1024**2}),wcs=skyProjection(heritageProjectionHeader(image.header)),finite=Array.from(image.values).filter(Number.isFinite).sort((a,b)=>a-b);need(image.width===596&&image.height===583&&finite.length>10000,'Unexpected HERITAGE image');
 const summary={width:image.width,height:image.height,finite:finite.length,minimum:finite[0],median:finite[Math.floor(finite.length/2)],maximum:finite.at(-1),pixelArcsec:Math.abs(Number(image.header.CD1_1))*3600,meaning:'log10 dust mass surface density in solar masses per square parsec, Gordon 2014 BEMBB expectation estimator. The FITS extension lacks BUNIT; units are established by the paper and author product description.'};await writeFile(L19+'inputs/density-qualification.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({sentinel:'HERITAGE_DENSITY_QUALIFIED',...summary}));return{image,wcs,summary};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await loadHeritage();
