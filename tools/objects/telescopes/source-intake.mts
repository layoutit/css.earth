import { isisGeometryBands } from './native-metadata.mts';
/** Inventory native products already pinned by a body package. Header reads are discovery only; qualification verifies whole-file pins. */
import { sourceHeaders } from './source-transfer.mts';
import { isis3CoreHeader } from '../terrestrial-layers/isis3-raster.mts';
import {open, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { sourceCacheUrl, RUNTIME_ASSET_ORIGIN } from '../../assets/source-mirror.mts';
import { resolve, dirname, basename } from 'node:path';
import { sha256 } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber, hasErrorCode } from '../../sources/source-values.mts';
import { readFitsHeader } from '../../fits/fits.mts';
import { pds4ProductIdentity, pds4Blocks, pds4Elements, pds4Field, pds3Keyword, pds3Values, pds3TimeIso } from '../pds-labels.mts';
import { inside, sourceCacheAddress, type SourceFile, type SourceProduct } from './source-products.mts';
export interface SourceIntakeIssue { readonly path: string; readonly state: 'unavailable' | 'unsupported' | 'incomplete'; readonly reason: string }
const LIMIT = 128 * 1024;
export async function sourceHeader(root: string, file: SourceFile): Promise<Buffer> {
  const local = await open(resolve(root,file.path),'r').catch(error => { if(hasErrorCode(error,'ENOENT')) return undefined; throw error; });
  if(local) { try { const bytes=Buffer.alloc(LIMIT); const read=await local.read(bytes,0,bytes.length,0); return bytes.subarray(0,read.bytesRead); } finally {await local.close();} }
  const cache=resolve(root,'output/telescopes/source-headers',`${encodeURIComponent(file.path)}.json`);
  const cached=await readFile(cache,'utf8').then(text=>requireRecord(JSON.parse(text))).catch(error=>{if(hasErrorCode(error,'ENOENT'))return undefined;throw error;});
  if(cached && cached.version === 3) { const bytes=Buffer.from(requireString(cached.base64),'base64'); if(cached.origin!==file.origin || cached.digest!==sha256(bytes))throw new Error('Header cache identity mismatch.');return bytes; }
  const headers=await sourceHeaders(root,file);
  let response:Response|undefined;
  for(const url of [sourceCacheUrl(RUNTIME_ASSET_ORIGIN,...sourceCacheAddress(file)),file.origin]) {
   try { response=await fetch(url,{headers:{...(url===file.origin?headers:{}),Range:`bytes=0-${LIMIT-1}`},signal:AbortSignal.timeout(15000)}); if ([416,417].includes(response.status)) { await response.body?.cancel(); response=await fetch(url,{headers:url===file.origin?headers:{},signal:AbortSignal.timeout(15000)}); } if(response.ok)break; await response.body?.cancel(); } catch { response=undefined; }
  }
  if(!response?.ok || !response.body)throw new Error(`Header retrieval HTTP ${response?.status ?? 'unavailable'}`);
  const reader=response.body.getReader(),chunks:Buffer[]=[];let size=0;
  try { while(size<LIMIT){const next=await reader.read();if(next.done)break;const b=Buffer.from(next.value).subarray(0,LIMIT-size);chunks.push(b);size+=b.length;} } finally {await reader.cancel();}
  const bytes=Buffer.concat(chunks);await mkdir(dirname(cache),{recursive:true});
  await writeFile(cache,JSON.stringify({version:3,origin:file.origin,queriedAt:new Date().toISOString(),digest:sha256(bytes),base64:bytes.toString('base64')}));return bytes;
}
export async function intakeSources(root:string,target:string,existing:readonly SourceProduct[], issues:SourceIntakeIssue[]=[]):Promise<SourceProduct[]> {
 const source=`src/objects/${target}/source`,manifest=await readFile(resolve(root,source,'manifest.json'),'utf8').then(text=>requireRecord(JSON.parse(text))).catch(error=>{if(hasErrorCode(error,'ENOENT'))return undefined;throw error;});
 if(!manifest)return [];
 const entries=[...requireArray(manifest.inputs),...requireArray(manifest.documents??[]),...requireArray(manifest.generatedIntermediates??[])];
 // Science products are downloads with an archive origin; files authored here are not products.
 const files=entries.filter(raw=>typeof requireRecord(raw).origin==='string'&&/^https?:\/\//u.test(String(requireRecord(raw).origin))).map(raw=>{const p=requireRecord(raw),path=requireString(p.path);return {id:p.id===undefined?`source-${sha256(path).slice(0,16)}`:requireString(p.id),role:'science',path:`${source}/${path}`,origin:requireString(p.origin)};});
 const products:SourceProduct[]=[];const used=new Set(existing.flatMap(p=>p.files.map(f=>f.path)));
 for(const file of files.filter(f=>/\.(?:fits?|img|cub|qub|lbl|xml)$/iu.test(f.path)&&!used.has(f.path)).sort((a,b)=>(/\.xml$/iu.test(a.path)?0:/\.lbl$/iu.test(a.path)?1:2)-(/\.xml$/iu.test(b.path)?0:/\.lbl$/iu.test(b.path)?1:2))) {
  try {
   if(used.has(file.path))continue;
   inside(root,file.path);
   const bytes=await sourceHeader(root,file), text=bytes.toString('latin1');
   let product:SourceProduct;
   if (pds4Blocks(text,'Product_Observational').length) {
    const identity=pds4ProductIdentity(text);
    const names=pds4Elements(text,'file_name').map(e=>e.content.trim());
    const dependencies=names.map(name=>{const f=files.find(f=>resolve(f.path).toLowerCase()===resolve(dirname(file.path),name).toLowerCase());if(!f)throw new Error(`Unpinned PDS4 file ${name}.`);return f;});
    const area=pds4Blocks(text,'File_Area_Observational')[0];if(!area)throw new Error('No observational file area.');
    const kind=pds4Blocks(area,'Array_3D_Image').length||pds4Blocks(area,'Array_3D_Spectrum').length?'cube':pds4Blocks(area,'Array_2D_Image').length?'image':undefined;
    if(!kind){issues.push({path:file.path,state:'unsupported',reason:'No supported PDS4 numeric image or cube.'});continue;}
    const scienceName=pds4Field(pds4Blocks(area,'File')[0]!,'file_name'),science=dependencies.find(f=>basename(f.path).toLowerCase()===scienceName.toLowerCase())!;
    const components=pds4Blocks(text,'Observing_System_Component'),component=(type:string)=>components.find(c=>pds4Field(c,'type')===type);
    const telescope=component('Spacecraft')??component('Telescope'),instrument=component('Instrument');
    product={id:file.id,target,telescope:telescope?pds4Field(telescope,'name'):'Source archive',mode:`${instrument?pds4Field(instrument,'name'):'PDS4'}/${kind}`,kind,decoder:'pds-product',archiveProductId:`${identity.logical_identifier}::${identity.version_id}`,labelPath:file.path,files:[{...file,role:'label'},...dependencies.map(f=>({...f,role:f.path===science.path?'science':'support'}))],identity,units:'Label-specified units',meaning:'Native PDS4 numeric product with every referenced file pinned.',citation:file.origin,limitations:['Decoding and byte integrity do not establish measurement suitability or surface registration.']};
   } else if(/^Object\s*=\s*IsisCube/mu.test(text)) {
    if(isisGeometryBands(bytes)){issues.push({path:file.path,state:'unsupported',reason:'Named geometry backplanes are ancillary data, not a science observation.'});continue;}
    const header=isis3CoreHeader(bytes),kind=header.bands===1?'image':'cube';
    const science=header.coreFile?files.find(f=>resolve(f.path).toLowerCase()===resolve(dirname(file.path),header.coreFile!).toLowerCase()):file;
    if(!science)throw new Error(`Unpinned ISIS Core ${header.coreFile}.`);
    product={id:file.id,target,telescope:header.identity.SpacecraftName??'Source archive',mode:`${header.identity.InstrumentId??'ISIS3'}/${kind}`,kind,decoder:'isis3',archiveProductId:file.origin,labelPath:file.path,files:science===file?[file]:[{...file,role:'label'},{...science,role:'science'}],identity:header.identity,
      units:'Native ISIS values',meaning:'Native ISIS3 numeric core; original labels and metadata remain in the pinned file.',citation:file.origin,limitations:['Core decoding does not establish calibrated scientific suitability, achieved resolution or body-map registration.']};
   } else if(text.startsWith('SIMPLE  =')) {
    const header=readFitsHeader(bytes).header, rawAxes=Number(header.NAXIS),axes=rawAxes>3?2+Array.from({length:rawAxes-2},(_,i)=>Number(header[`NAXIS${i+3}`])).filter(n=>n!==1).length:rawAxes;
    if(axes!==2&&axes!==3){issues.push({path:file.path,state:'unsupported',reason:`FITS primary has ${axes} axes; extension-only products need an explicit observation declaration.`});continue;}
    const identity=Object.fromEntries(['SIMPLE','BITPIX','NAXIS','NAXIS1','NAXIS2','NAXIS3','OBJECT','TELESCOP','INSTRUME','OBS_ID'].filter(key=>header[key]!==undefined).map(key=>[key,header[key]!])) as SourceProduct['identity'];
    product={id:file.id,target,telescope:String(header.TELESCOP??'Source archive'),mode:String(header.INSTRUME??'FITS')+`/${axes===3?'cube':'image'}`,kind:axes===3?'cube':'image',decoder:'fits-image',archiveProductId:file.origin,files:[file],identity,
      units:String(header.BUNIT??'not stated'),meaning:'Native source-pinned FITS samples; processing level and measurement suitability require qualification.',citation:file.origin,limitations:['Target attribution follows the body package; native headers and exact bytes are checked at qualification.','Wavelength coverage, achieved resolution and surface registration are not established by discovery.']};
   } else {
    const end=/^END\s*$/imu.exec(text);if(!end)throw new Error('No complete PDS3 label within the bounded header read.');
    const label=text.slice(0,end.index+end[0].length);
    if(pds3Keyword(label,'PDS_VERSION_ID',[])!=='PDS3'){issues.push({path:file.path,state:'unsupported',reason:'No supported FITS or PDS3 header.'});continue;}
    const pointers=[...label.matchAll(/^\s*(\^[A-Z][A-Z0-9_:]*)\s*=/gmi)].map(m=>m[1]!);
    const kind=pointers.some(key=>/QUBE|SPECTRAL_CUBE/u.test(key)) || Number(pds3Keyword(label,'BANDS',['IMAGE']) ?? 1)>1 ?'cube':pointers.some(key=>/IMAGE/u.test(key))?'image':pointers.some(key=>/TABLE|SERIES/u.test(key))?'table':undefined;
    if(!kind){issues.push({path:file.path,state:'unsupported',reason:'PDS label contains no image, cube, table or series.'});continue;}
    const dependencies:SourceFile[]=[{...file,role:'label'}]; let science:SourceFile|undefined;
    for(const key of [...new Set(pointers)]) {
      const pointer=pds3Values(label,key),name=pointer?.[0];if(!name)throw new Error(`Unreadable ${key} pointer.`);
      if(/^\d+(?:\s*<BYTES>)?$/u.test(name)){
        const recordBytes=Number(pds3Keyword(label,'RECORD_BYTES',[])??1),offset=(Number(name.split(/\s/u)[0])-1)*(name.includes('<BYTES>')?1:recordBytes);
        const size=await stat(resolve(root,file.path)).then(s=>s.size,()=>undefined);
        if(!Number.isSafeInteger(offset)||offset<0||(size!==undefined&&offset>=size))throw new Error(`Attached ${key} pointer lies outside the local file; an extracted label is not the complete observation.`);
        if(!/HISTORY|HEADER|STRUCTURE/u.test(key))science=file;continue;
      }
      const wanted=resolve(dirname(file.path),name).toLowerCase(),dependency=files.find(f=>resolve(f.path).toLowerCase()===wanted);
      if(!dependency)throw new Error(`Unpinned ${key} dependency ${name}.`);
      if(!dependencies.some(f=>f.path===dependency.path))dependencies.push({...dependency,role:'support'});
      if(!science&&!/HISTORY|HEADER|STRUCTURE/u.test(key))science=dependency;
    }
    if(!science)throw new Error('No pinned science structure.');
    const identity=Object.fromEntries(['PDS_VERSION_ID','DATA_SET_ID','PRODUCT_ID','TARGET_NAME','INSTRUMENT_ID'].flatMap(key=>{const v=pds3Keyword(label,key,[]);return v===undefined?[]:[[key,v]];}));
    if(!identity.PRODUCT_ID)throw new Error('PDS product identity is absent.');
    const inputFiles=dependencies.map(f=>({...f,role:f.path===science!.path?'science':f.role}));
    const start=pds3Keyword(label,'START_TIME',[]),stop=pds3Keyword(label,'STOP_TIME',[]);
    product={id:file.id,target,telescope:pds3Keyword(label,'INSTRUMENT_HOST_NAME',[])??'Source archive',mode:`${pds3Keyword(label,'INSTRUMENT_ID',[])??'PDS3'}/${kind}`,kind,decoder:'pds-product',archiveProductId:`${identity.DATA_SET_ID??''}:${identity.PRODUCT_ID}`,files:inputFiles,identity,
      labelPath:file.path,...(start&&stop?{startIso:pds3TimeIso(start),endIso:pds3TimeIso(stop)}:{}),units:pds3Keyword(label,'UNIT',[])??'not stated',meaning:`Native PDS3 ${kind}; preserve every labeled structure, including uncertainty and quality.`,citation:file.origin,
      limitations:['Header metadata is discovery evidence until complete source pins and decoded structures are checked.','Decoding does not establish scientific suitability, optical resolution or surface registration.']};
   }
   products.push(product);product.files.forEach(f=>used.add(f.path));
  } catch(error){issues.push({path:file.path,state:/Header retrieval/u.test(String(error))?'unavailable':'incomplete',reason:String(error)});}
 }
 return products;
}
