/** A small final stage: verified delivery -> explicit output selection -> pinned figure and numeric values. */
import { readFile, mkdir, mkdtemp, rename, rm, rmdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { nativeFigureInput } from './native-figure.mts';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
import { writeProductRecord, parseProductRecord } from '../product-record.mts';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { plotProduct } from '../astronomy-packages/plots.mts';
import { parseNativeMetadata, type NativeMetadata } from './native-metadata.mts';
import { contextTarget, deliveryContext } from './delivery-context.mts';
import { openFitsSource } from './fits-source.mts';
import { openPdsSource, preparePdsSource } from './pds-source.mts';
export interface OutputChoice {
  readonly kind:OutputRequest['kind']|'body-map'|'sphere'|'points'|'volume'|'volume-lens-bank';readonly available:boolean;readonly reason:string;
  readonly hdu?:number;readonly structure?:string;readonly shape?:readonly number[];readonly parameters?:readonly string[];
  readonly unit?:NativeMetadata['units'];readonly spectral?:NativeMetadata['spectral'];readonly limitations?:readonly string[];
}
export interface OutputRequest {
  readonly kind:'image'|'spectrum'|'band-image'|'aperture-spectrum'|'feature-map';
  readonly hdu:number; readonly structure?:string; readonly plane?:number; readonly pixel?:readonly [number,number];
  readonly band?:readonly number[]; readonly aperture?:readonly number[];
  readonly background?:'none'|readonly number[]; readonly continuum?:readonly number[];
  /** PNG and SVG figure background; transparent when omitted. */
  readonly figureBackground?:'transparent'|'opaque';
  readonly uncertainty?:'omit'|'independent';
}
export function validateOutputRequest(request:OutputRequest):void {
  const fields:Record<OutputRequest['kind'],readonly string[]>={image:['plane'],spectrum:['pixel'],'band-image':['band','uncertainty'],'aperture-spectrum':['aperture','background','uncertainty'],'feature-map':['band','continuum','uncertainty']};
  if(!Object.hasOwn(fields,request.kind)||!Number.isSafeInteger(request.hdu)||request.hdu<0)throw new TypeError('Choose a supported output and a nonnegative HDU index');
  if(request.figureBackground!==undefined&&request.figureBackground!=='transparent'&&request.figureBackground!=='opaque')throw new TypeError('Figure background takes transparent or opaque');
  for(const key of Object.keys(request))if(!['kind','hdu','structure','figureBackground',...fields[request.kind]].includes(key))throw new TypeError(`${key} is not valid for ${request.kind}`);
  if(request.structure!==undefined&&(typeof request.structure!=='string'||!request.structure.trim()))throw new TypeError('Native structure must be nonempty');
  const tuple=(value:unknown,count:number,integer=false)=>Array.isArray(value)&&value.length===count&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&(!integer||Number.isSafeInteger(n)&&n>=0));
  if(request.plane!==undefined&&(!Number.isSafeInteger(request.plane)||request.plane<0))throw new TypeError('Plane must be a nonnegative integer');
  if(request.kind==='spectrum'&&!tuple(request.pixel,2,true))throw new TypeError('A spectrum requires --pixel X,Y');
  if(['band-image','feature-map'].includes(request.kind)&&(!tuple(request.band,2)||request.band![0]<=0||request.band![0]>=request.band![1]))throw new TypeError('A band requires two positive increasing wavelengths');
  if(request.kind==='feature-map'&&!tuple(request.continuum,4))throw new TypeError('A feature map requires two bracketing continuum bands');
  if(request.kind==='aperture-spectrum'&&(!tuple(request.aperture,4,true)||request.background!=='none'&&!tuple(request.background,4,true)))throw new TypeError('Choose --aperture X0,Y0,X1,Y1 and --background X0,Y0,X1,Y1 or none');
  if(request.uncertainty!==undefined&&!['omit','independent'].includes(request.uncertainty))throw new TypeError('Uncertainty takes omit or independent');
}
function beneath(root:string,path:string):string {
  const file=resolve(root,path),rel=relative(root,file);
  if(isAbsolute(path)||!rel||rel==='..'||rel.startsWith('../'))throw new Error('Delivery path escapes its directory');
  return file;
}
export async function delivery(resultPath:string){
  const path=resolve(resultPath),directory=dirname(path),bytes=await readFile(path),record=requireRecord(JSON.parse(bytes.toString('utf8')));
  if (record.schema !== 'cssearth-telescope-delivery@3') throw new Error('This delivery predates content pins. Run telescope get into a new directory.');
  const context=deliveryContext(record);
  // A delivery binds every copied file by path, size and digest; the delivery record itself is hashed below.
  const files=requireArray(record.files).map(raw=>{const f=requireRecord(raw),sha256=requireString(f.sha256,'delivery SHA-256');if(!/^[a-f0-9]{64}$/u.test(sha256))throw new TypeError('Invalid delivery SHA-256');return {path:requireString(f.path),bytes:requireFiniteNumber(f.bytes),sha256};});
  if(!files.length||new Set(files.map(f=>f.path)).size!==files.length)throw new Error('Delivery files must be unique and pinned');
  const realDirectory=await realpath(directory);
  for(const expected of files){
    const file=beneath(directory,expected.path);beneath(realDirectory,relative(realDirectory,await realpath(file)));
    const actual=await sha256File(file);if(actual.bytes!==expected.bytes||actual.sha256!==expected.sha256)throw new Error(`Delivery content pin mismatch: ${expected.path}`);
  }
  const productPath=requireString(record.product),product=files.find(f=>f.path===productPath);
  if(!product)throw new Error('The chosen product is absent from the delivery pins');
  for(const key of ['record','receipt'])if(!files.some(f=>f.path===requireString(record[key])))throw new Error('Delivery evidence is not pinned');
  const producing=parseProductRecord(JSON.parse(await readFile(beneath(directory,requireString(record.record)),'utf8')));
  // Producer paths are resolved within its recorded output root when one is supplied.
  const outputRoot=record.outputRoot===undefined?undefined:beneath(directory,requireString(record.outputRoot));
  const outputPins=producing.outputs.map(output=>{
    const exact=outputRoot===undefined?undefined:relative(directory,beneath(outputRoot,output.path));
    if(!output.sha256)throw new Error('Producing record has no content digest. Requalify the observation.');
    const matches=files.filter(f=>f.bytes===output.bytes&&f.sha256===output.sha256&&(exact===undefined?(f.path===output.path||f.path.endsWith('/'+output.path)):f.path===exact));
    if(matches.length!==1)throw new Error('Producing output is absent or ambiguous in delivery');return matches[0];
  });
  if(!outputPins.some(f=>f.path===product.path))throw new Error('Product is not bound by its producing record');
  const facts=requireRecord(record.facts);if(facts.verified!==true)throw new Error('The delivery is not verified');
  const target=requireString(facts.target);if(target!==contextTarget(context))throw new Error('Delivery facts disagree with source context target');
  return {path,directory,record,context,files,product,producing,telescope:producing.telescope,file:beneath(directory,productPath),target,pin:{sha256:sha256(bytes),bytes:bytes.length}};
}
function choices(structures:readonly NativeMetadata[],sourceOnly=false):OutputChoice[]{
  const result:OutputChoice[]=[];
  for(const s of structures){
    if(s.fitsHdu===undefined||!s.shape)continue;
    const dimensions=s.shape,spatial=dimensions.length>=2&&dimensions.slice(0,-3).every(n=>n===1),spectral=s.spectral?.axis===dimensions.length-3;
    const supported=spatial&&(s.spectral?.axis===undefined?(dimensions.length===2||dimensions.at(-3)===1):spectral),usable=(s.quality?.usable??0)>0;
    const common={hdu:s.fitsHdu,structure:s.structure,shape:dimensions,...(s.units?{unit:s.units}:{}),...(s.spectral?{spectral:s.spectral}:{}),...(s.limitations.length?{limitations:s.limitations}:{})};
    result.push({...common,kind:'image',available:supported&&usable,parameters:s.spectral?.axis===undefined?[]:['plane'],reason:!usable?'No usable samples.':!supported?'Select two spatial axes and a separable leading wavelength axis.':'Native image coordinates; masks retained. A cube requires an explicit zero-based plane.'});
    result.push({...common,kind:'spectrum',available:supported&&spectral&&usable,parameters:['pixel'],reason:spectral?'One explicitly selected pixel; supplied uncertainties retain their meaning. No aperture integration or covariance assumption.':'No qualified leading wavelength axis.'});
    const cube=supported&&spectral&&usable&&!!s.units;
    for(const kind of ['band-image','aperture-spectrum','feature-map'] as const){
      const edges=kind==='aperture-spectrum'||!!s.spectral?.binEdgesMicrometres;
      result.push({...common,kind,available:cube&&edges,parameters:kind==='aperture-spectrum'?['aperture','background','uncertainty']:kind==='feature-map'?['band','continuum','uncertainty']:['band','uncertainty'],reason:!cube?'Requires a usable cube with qualified units and leading wavelength axis.':!edges?'Qualified bin edges are required; tabulated centers alone cannot establish band integration.':kind==='aperture-spectrum'?'Fixed-region mean spectrum with explicit background choice. Independent-sample uncertainty is opt-in.':kind==='band-image'?'Wavelength-bin-weighted mean; complete selected coverage is required per pixel.':'Continuum-subtracted wavelength integral with two explicit bracketing bands; positive emission, negative absorption.'});
    }
  }
  return [...result,
    {kind:'body-map',available:false,reason:sourceOnly?'A pinned archive source has no verified delivery and navigation context for body-map projection.':'First export a 2D image measurement. Its output.product.json can then be exported as a body map with explicit navigation.'},
    {kind:'sphere',available:false,reason:'Use telescope export MAP/map.fits.product.json --output sphere after projection; native pixels are insufficient.'},
    {kind:'points',available:false,reason:'Export an existing physical object.json with --output points, volume or volume-lens-bank. A spectral cube requires a scientific reconstruction first; wavelength or radial velocity is not distance.'}];
}
export async function listOutputs(resultPath:string,structure?:string){
  const source=await openFitsSource(resultPath);
  if(source){
    if(structure!==undefined)throw new TypeError('--structure applies only to native delivery inspection');
    const metadata=await sciencePackage({operation:'fits',path:source.file,...(source.companions?{companions:source.companions}:{})});
    const structures=requireArray(metadata.structures).map(s=>parseNativeMetadata(s));
    const outputs=choices(structures,true).map(({structure:_structure,...choice})=>choice);
    return {source:source.path,sourceContext:undefined,outputs,limitations:source.limitations};
  }
  const pds=await openPdsSource(resultPath);
  if(pds){
    const scratch=await mkdtemp(resolve(tmpdir(),'telescope-pds-source-'));
    try{
      const staged=await preparePdsSource(pds,resolve(scratch,'source'));
      const input=await nativeFigureInput(staged,resolve(scratch,'converted'),structure);
      const metadata=await sciencePackage({operation:'fits',path:input.file});
      const structures=requireArray(metadata.structures).map(s=>parseNativeMetadata(s));
      return {source:pds.path,sourceContext:undefined,outputs:choices(structures,true),limitations:pds.limitations,native:input.native};
    }finally{await rm(scratch,{recursive:true,force:true});}
  }
  const d=await delivery(resultPath);
  const scratch=await mkdtemp(resolve(tmpdir(),'telescope-native-'));
  try{
    const input=await nativeFigureInput(d,scratch,structure);
    const metadata=await sciencePackage({operation:'fits',path:input.file});
    const structures=requireArray(metadata.structures).map(s=>parseNativeMetadata(s));
    // A FITS product is exported by --hdu alone; only a decoded native product also takes --structure.
    const outputs=input.native?choices(structures):choices(structures).map(({structure:_structure,...choice})=>choice);
    return {target:d.target,source:d.path,sourceContext:d.context,outputs,...(input.native?{native:input.native}: {})};
  }finally{await rm(scratch,{recursive:true,force:true});}
}
export async function exportOutput(resultPath:string,request:OutputRequest,outputDirectory:string){
  validateOutputRequest(request);
  const source=await openFitsSource(resultPath);
  if(source)return exportSourceOutput(source,request,outputDirectory);
  const pds=await openPdsSource(resultPath);
  if(pds)return exportSourceOutput(pds,request,outputDirectory);
  const d=await delivery(resultPath);
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  // A fresh output directory preserves earlier selections and their evidence.
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const input=await nativeFigureInput(d,resolve(staging,'native'),request.structure);
    if(input.native&&request.hdu!==0)throw new Error('Decoded native arrays use --hdu 0');
    const answer=await sciencePackage({...request,operation:'extract',path:input.file,arrayDirectory:resolve(staging,'arrays'),x:request.pixel?.[0],y:request.pixel?.[1]});
    const rows=requireArray(answer.structures).map(v=>requireRecord(v)),found=rows.filter(s=>s.fitsHdu===request.hdu);
    if(found.length!==1||found[0].extraction===undefined)throw new Error('Selected HDU is not an unambiguous science array');
    const data=requireRecord(found[0].extraction);
    const plotted=await plotProduct(staging,d.target,data,input.file,{...request});
    const fresh=await delivery(resultPath);if(fresh.pin.sha256!==d.pin.sha256)throw new Error('Delivery changed while producing output');
    const softwareFiles=['outputs.mts','native-figure.mts','native-metadata.mts','../astronomy-packages/pds-client.mts','../terrestrial-layers/isis3-raster.mts','../astronomy-packages/science.mts','../astronomy-packages/plots.mts','../astronomy-packages/cube-outputs.mts','../astronomy-packages/requirements.lock'];
    const implementation=sha256(Buffer.concat(await Promise.all(softwareFiles.map(name=>readFile(new URL(name,import.meta.url))))));
    const run={telescope:d.telescope,stage:'telescope-output',inputs:[{role:'delivery',identity:d.path,bytes:d.pin.bytes},...d.files.map(f=>({role:'qualified input',identity:resolve(d.directory,f.path),bytes:f.bytes}))],parameters:{selection:request,...(input.native?{native:input.native}:{}),definition:data.definition??(request.kind==='image'?'Native sampled image plane; not a registered surface map.':'Single-pixel spectrum; no spatial integration.'),measurement:{unit:data.unit,arithmetic:data.arithmetic??'native samples',uncertaintyPolicy:data.uncertaintyPolicy??'recorded',maskPolicy:data.maskPolicy??'native sample mask'},sourceContext:d.context,metadata:parseNativeMetadata(found[0]),software:plotted},software:[{name:'cssEarth telescope outputs',version:implementation},{name:'Astropy',version:'8.0.1'},{name:'Matplotlib',version:'3.11.2'},...Object.entries(input.native?.packages??{}).map(([name,version])=>({name,version}))]};
    const names=requireArray(plotted.files).map(v=>requireString(v));
    await writeProductRecord(resolve(staging,'output.product.json'),run,names.map(path=>({path,file:beneath(staging,path)})));
    await rm(resolve(staging,'arrays'),{recursive:true,force:true});await rm(resolve(staging,'native'),{recursive:true,force:true});
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,figure:resolve(destination,'figure.png'),values:resolve(destination,'values.csv'),data:resolve(destination,names.includes('image.fits')?'image.fits':'spectrum.ecsv'),receipt:resolve(destination,'output.product.json'),sourceContext:d.context};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}

/** The same extraction and plotting backend, with a pinned source record rather than a qualified delivery. */
async function exportSourceOutput(source:NonNullable<Awaited<ReturnType<typeof openFitsSource>>>|NonNullable<Awaited<ReturnType<typeof openPdsSource>>>,request:OutputRequest,outputDirectory:string){
  const pds='image' in source;
  if(!pds&&request.structure!==undefined)throw new TypeError('--structure applies only to native outputs');
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const prepared=pds?await nativeFigureInput(await preparePdsSource(source,resolve(staging,'source')),resolve(staging,'native'),request.structure):undefined;
    const file=prepared?.file??(pds?undefined:source.file);
    if(!file)throw new Error('Source has no science array.');
    const label=pds?source.image.path:source.label;
    const answer=await sciencePackage({...request,operation:'extract',path:file,arrayDirectory:resolve(staging,'arrays'),x:request.pixel?.[0],y:request.pixel?.[1],
      ...(!pds&&source.companions?{companions:source.companions}:{})});
    const rows=requireArray(answer.structures).map(v=>requireRecord(v)),found=rows.filter(s=>s.fitsHdu===request.hdu);
    if(found.length!==1||found[0].extraction===undefined)throw new Error('Selected HDU is not an unambiguous science array');
    const data=requireRecord(found[0].extraction);
    const plotted=await plotProduct(staging,label,data,file,{...request});
    const fresh=pds?await openPdsSource(source.path):await openFitsSource(source.path);
    if(!fresh||fresh.source.pin.sha256!==source.source.pin.sha256)throw new Error('Source changed while producing output');
    const softwareFiles=['outputs.mts',pds?'pds-source.mts':'fits-source.mts',...(pds?['native-figure.mts','../astronomy-packages/pds-client.mts']:[]),'../astronomy-packages/science.mts','../astronomy-packages/plots.mts','../astronomy-packages/cube-outputs.mts','../astronomy-packages/requirements.lock'];
    const implementation=sha256(Buffer.concat(await Promise.all(softwareFiles.map(name=>readFile(new URL(name,import.meta.url))))));
    const names=requireArray(plotted.files).map(v=>requireString(v));
    await writeProductRecord(resolve(staging,'output.product.json'),{
      telescope:source.source.record.telescope,stage:'telescope-source-output',
      inputs:[{role:'archive source record',identity:source.source.file,...source.source.pin},
        ...(pds?source.files.map(member=>({role:'original PDS member',identity:resolve(source.source.root,member.path),bytes:member.bytes,sha256:member.sha256})):
          [{role:'FITS source',identity:source.file,bytes:source.pin.bytes,sha256:source.pin.sha256},
            ...Object.entries(source.companions??{}).map(([role,path])=>{
              const output=source.source.record.outputs.find(entry=>resolve(source.source.root,entry.path)===path);
              if(!output?.sha256)throw new Error(`${role} FITS companion has no source pin`);
              return {role:`FITS ${role}`,identity:path,bytes:output.bytes,sha256:output.sha256};
            })])],
      parameters:{selection:request,label,status:'unresolved',limitations:source.limitations,...(prepared?.native?{native:prepared.native}:{}),
        definition:data.definition??(request.kind==='image'?'Native sampled image plane; no registered surface map.':'Selected samples from a pinned source.'),
        measurement:{unit:data.unit,arithmetic:data.arithmetic??'native samples',uncertaintyPolicy:data.uncertaintyPolicy??'recorded',maskPolicy:data.maskPolicy??'native sample mask'},
        metadata:parseNativeMetadata(found[0]),software:plotted},
      software:[{name:'cssEarth telescope outputs',version:implementation},{name:'Astropy',version:'8.0.1'},{name:'Matplotlib',version:'3.11.2'},...(prepared?.native?.packages?Object.entries(prepared.native.packages).map(([name,version])=>({name,version})):[])]
    },names.map(path=>({path,file:beneath(staging,path)})));
    await rm(resolve(staging,'arrays'),{recursive:true,force:true});
    if(pds){await rm(resolve(staging,'source'),{recursive:true,force:true});await rm(resolve(staging,'native'),{recursive:true,force:true});}
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,figure:resolve(destination,'figure.png'),values:resolve(destination,'values.csv'),
      data:resolve(destination,names.includes('image.fits')?'image.fits':'spectrum.ecsv'),receipt:resolve(destination,'output.product.json'),sourceContext:undefined};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
