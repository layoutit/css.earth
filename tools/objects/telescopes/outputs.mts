/** A small final stage: verified delivery -> explicit output selection -> pinned figure and numeric values. */
import { readFile, mkdir, rename, rm, rmdir, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../source-values.mts';
import { pinFile, writeProductRecord, parseProductRecord } from '../product-record.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { plotProduct } from '../astronomy-packages/plots.mts';
import { parseNativeMetadata, type NativeMetadata } from './native-metadata.mts';
export interface OutputChoice { readonly kind:'image'|'spectrum'|'body-map'|'sphere'|'points';readonly available:boolean;readonly reason:string;readonly hdu?:number;readonly structure?:string;readonly shape?:readonly number[];readonly parameters?:readonly string[] }
export interface OutputRequest { readonly kind:'image'|'spectrum';readonly hdu:number;readonly plane?:number;readonly pixel?:readonly [number,number] }
function beneath(root:string,path:string):string {
  const file=resolve(root,path),rel=relative(root,file);
  if(isAbsolute(path)||!rel||rel==='..'||rel.startsWith('../'))throw new Error('Delivery path escapes its directory');
  return file;
}
async function delivery(resultPath:string){
  const path=resolve(resultPath),directory=dirname(path),bytes=await readFile(path),record=requireRecord(JSON.parse(bytes.toString('utf8')));
  if(record.schema!=='cssearth-telescope-delivery@1')throw new Error('Expected a telescope delivery result.json');
  const files=requireArray(record.files).map(raw=>{const f=requireRecord(raw);return {path:requireString(f.path),sha256:requireString(f.sha256),bytes:requireFiniteNumber(f.bytes)};});
  if(!files.length||new Set(files.map(f=>f.path)).size!==files.length)throw new Error('Delivery files must be unique and pinned');
  const realDirectory=await realpath(directory);
  for(const expected of files){
    const file=beneath(directory,expected.path);beneath(realDirectory,relative(realDirectory,await realpath(file)));
    const actual=await pinFile(file);if(actual.sha256!==expected.sha256||actual.bytes!==expected.bytes)throw new Error(`Delivery pin mismatch: ${expected.path}`);
  }
  const productPath=requireString(record.product),product=files.find(f=>f.path===productPath);
  if(!product)throw new Error('The chosen product is absent from the delivery pins');
  for(const key of ['record','receipt'])if(!files.some(f=>f.path===requireString(record[key])))throw new Error('Delivery evidence is not pinned');
  const producing=parseProductRecord(JSON.parse(await readFile(beneath(directory,requireString(record.record)),'utf8')));
  const outputPins=producing.outputs.map(output=>{
    const matches=files.filter(f=>f.sha256===output.sha256&&f.bytes===output.bytes&&(f.path===output.path||f.path.endsWith('/'+output.path)));
    if(matches.length!==1)throw new Error('Producing output is absent or ambiguous in delivery');return matches[0];
  });
  if(!outputPins.some(f=>f.path===product.path))throw new Error('Product is not bound by its producing record');
  const facts=requireRecord(record.facts);if(facts.verified!==true)throw new Error('The delivery is not verified');
  return {path,directory,record,files,product,telescope:producing.telescope,file:beneath(directory,productPath),target:requireString(facts.target),pin:{sha256:sha256(bytes),bytes:bytes.length}};
}
function choices(structures:readonly NativeMetadata[]):OutputChoice[]{
  const result:OutputChoice[]=[];
  for(const s of structures){
    if(s.fitsHdu===undefined||!s.shape)continue;
    const dimensions=s.shape,spatial=dimensions.length>=2&&dimensions.slice(0,-3).every(n=>n===1),spectral=s.spectral?.axis===dimensions.length-3;
    const supported=spatial&&(s.spectral?.axis===undefined?(dimensions.length===2||dimensions.at(-3)===1):spectral),usable=(s.quality?.usable??0)>0;
    const common={hdu:s.fitsHdu,structure:s.structure,shape:dimensions};
    result.push({...common,kind:'image',available:supported&&usable&&dimensions.at(-1)!*dimensions.at(-2)!<=1_000_000,parameters:s.spectral?.axis===undefined?[]:['plane'],reason:!usable?'No usable samples.':!supported?'Select two spatial axes and a separable leading wavelength axis.':'Native image coordinates; masks retained. A cube requires an explicit zero-based plane.'});
    result.push({...common,kind:'spectrum',available:supported&&spectral&&usable,parameters:['pixel'],reason:spectral?'One explicitly selected pixel; supplied uncertainties retain their meaning. No aperture integration or covariance assumption.':'No qualified leading wavelength axis.'});
  }
  return [...result,
    {kind:'body-map',available:false,reason:'This exporter does not register images to a surface. Use the existing body-map author and publication route with a measurement definition and viewing geometry.'},
    {kind:'sphere',available:false,reason:'Requires a qualified body map and a prepared layer for the existing body renderer; native image pixels are insufficient.'},
    {kind:'points',available:false,reason:'Requires coordinate semantics and a prepared nebula-lab adapter. Wavelength or radial velocity is not line-of-sight distance.'}];
}
export async function listOutputs(resultPath:string){
  const d=await delivery(resultPath);
  if(!/\.fits?$/iu.test(d.file))return {target:d.target,source:d.product,outputs:[{kind:'image',available:false,reason:'This initial output adapter reads qualified FITS products; PDS and ISIS export adapters are not yet implemented.'},...choices([])]};
  const metadata=await sciencePackage({operation:'fits',path:d.file});
  const structures=requireArray(metadata.structures).map(s=>parseNativeMetadata(s));
  return {target:d.target,source:d.product,outputs:choices(structures)};
}
export async function exportOutput(resultPath:string,request:OutputRequest,outputDirectory:string){
  if(!['image','spectrum'].includes(request.kind)||!Number.isSafeInteger(request.hdu)||request.hdu<0)throw new TypeError('Choose image or spectrum and a nonnegative HDU index');
  if(request.plane!==undefined&&(!Number.isSafeInteger(request.plane)||request.plane<0)||request.pixel?.some(n=>!Number.isSafeInteger(n)||n<0))throw new TypeError('Plane and pixel selectors must be nonnegative integers');
  if(request.kind==='spectrum'&&(!request.pixel||request.plane!==undefined)||request.kind==='image'&&request.pixel!==undefined)throw new TypeError('A spectrum requires --pixel X,Y; an image uses --plane when spectral');
  const d=await delivery(resultPath);
  if(!/\.fits?$/iu.test(d.file))throw new Error('The initial output adapter supports qualified FITS products');
  const answer=await sciencePackage({operation:'extract',path:d.file,hdu:request.hdu,kind:request.kind,plane:request.plane,x:request.pixel?.[0],y:request.pixel?.[1]});
  const rows=requireArray(answer.structures).map(v=>requireRecord(v)),found=rows.filter(s=>s.fitsHdu===request.hdu);
  if(found.length!==1||found[0].extraction===undefined)throw new Error('Selected HDU is not an unambiguous science array');
  const data=requireRecord(found[0].extraction),destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  // A fresh output directory preserves earlier selections and their evidence.
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const plotted=await plotProduct(staging,d.target,data);
    const fresh=await delivery(resultPath);if(fresh.pin.sha256!==d.pin.sha256)throw new Error('Delivery changed while producing output');
    const softwareFiles=['outputs.mts','native-metadata.mts','../astronomy-packages/science.mts','../astronomy-packages/plots.mts','../astronomy-packages/requirements.lock'];
    const implementation=sha256(Buffer.concat(await Promise.all(softwareFiles.map(name=>readFile(new URL(name,import.meta.url))))));
    const run={telescope:d.telescope,stage:'telescope-output',inputs:[{role:'delivery',identity:d.path,...d.pin},...d.files.map(f=>({role:'qualified input',identity:resolve(d.directory,f.path),sha256:f.sha256,bytes:f.bytes}))],parameters:{selection:request,definition:request.kind==='image'?'Native sampled image plane; not a registered surface map.':'Single-pixel spectrum; no spatial integration.',sourceRequest:d.record.request,sourceSatisfaction:d.record.satisfaction,metadata:parseNativeMetadata(found[0]),software:plotted},software:[{name:'cssEarth telescope outputs',version:implementation},{name:'Astropy',version:'8.0.1'},{name:'Matplotlib',version:'3.11.2'}]};
    const names=requireArray(plotted.files).map(v=>requireString(v));
    await writeProductRecord(resolve(staging,'output.product.json'),run,names.map(path=>({path,file:beneath(staging,path)})));
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,figure:resolve(destination,'figure.png'),values:resolve(destination,'values.csv'),receipt:resolve(destination,'output.product.json'),sourceSatisfaction:d.record.satisfaction};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
