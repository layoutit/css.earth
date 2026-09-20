/** An explicit navigation step between a pinned 2D measurement and an existing body-map contract. */
import { readFile,writeFile,mkdir,rm,rmdir,rename,realpath } from 'node:fs/promises';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireArray,requireRecord,requireString,requireFiniteNumber } from '../../source-values.mts';
import { pinFile,parseProductRecord,sameRun,type ProductInput } from '../product-record.mts';
import { parseBodyMapProduct } from '../body-map-product.mts';
import { assertBodyMapPlanes,bodyMapProductRecord,formatProductRecord } from '../body-map-publication.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { projectWithPlanetMapper } from '../astronomy-packages/projection.mts';
import { delivery } from './outputs.mts';

export function localOutput(root:string,name:string):string {
  const path=resolve(root,name),rel=relative(root,path);
  if(isAbsolute(name)||!rel||rel==='..'||rel.startsWith('../'))throw new Error('Output escapes its product directory');
  return path;
}
export async function verifiedProduct(path:string){
  const file=resolve(path),bytes=await readFile(file),record=parseProductRecord(JSON.parse(bytes.toString())),root=dirname(file);
  const realRoot=await realpath(root);
  for(const output of record.outputs)localOutput(realRoot,relative(realRoot,await realpath(localOutput(root,output.path))));
  if(!await sameRun(record,record,name=>localOutput(root,name)))throw new Error('Product output pins changed or are missing');
  return {file,root,record,pin:{sha256:sha256(bytes),bytes:bytes.length}};
}
export function parseGeometry(raw:unknown,root:string){
  const g=requireRecord(raw);if(g.schema!=='cssearth-navigation-input@1')throw new TypeError('Expected cssearth-navigation-input@1');
  for(const key of Object.keys(g))if(!['schema','observer','kernels','registration','width','height','maximumEmissionDegrees'].includes(key))throw new TypeError(`Unknown navigation option ${key}`);
  const width=requireFiniteNumber(g.width),height=requireFiniteNumber(g.height),maximumEmissionDegrees=requireFiniteNumber(g.maximumEmissionDegrees);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<2||width*height>260000||maximumEmissionDegrees<=0||maximumEmissionDegrees>=90)throw new RangeError('Use a bounded map grid and emission limit strictly between 0 and 90 degrees');
  const kernels=requireArray(g.kernels).map(value=>{const k=requireRecord(value),file=resolve(root,requireString(k.file)),bytes=requireFiniteNumber(k.bytes),digest=requireString(k.sha256);if(!/^[a-f0-9]{64}$/u.test(digest)||!Number.isSafeInteger(bytes)||bytes<1)throw new TypeError('Kernels require byte counts and SHA256 pins');return {file,bytes,sha256:digest,source:requireString(k.source),role:requireString(k.role)};});
  if(!kernels.length||kernels.filter(k=>k.role==='rotation').length!==1||new Set(kernels.map(k=>k.file)).size!==kernels.length)throw new TypeError('Pin an ordered unique kernel set with exactly one rotation kernel');
  const registration=requireRecord(g.registration),method=requireString(registration.method);
  for(const key of Object.keys(registration))if(!['method','explanation','parameters','evidence'].includes(key))throw new TypeError(`Unknown registration option ${key}`);
  if(method==='wcs'&&registration.parameters!==undefined)throw new TypeError('WCS registration does not accept disc parameters');
  if(method!=='wcs'&&method!=='disc')throw new TypeError('Registration must explicitly choose wcs or disc');
  const parameters=method==='disc'?requireArray(registration.parameters).map(v=>requireFiniteNumber(v)):undefined;
  if(parameters&&(parameters.length!==4||parameters[2]<=0))throw new TypeError('Disc registration takes x, y, radius and rotation in PlanetMapper coordinates');
  const explanation=requireString(registration.explanation);
  const evidence=registration.evidence===undefined?undefined:requireRecord(registration.evidence);
  const evidencePin=evidence?{file:resolve(root,requireString(evidence.file)),sha256:requireString(evidence.sha256),bytes:requireFiniteNumber(evidence.bytes)}:undefined;
  if(method==='disc'&&(!evidencePin||!/^[a-f0-9]{64}$/u.test(evidencePin.sha256)||!Number.isSafeInteger(evidencePin.bytes)||evidencePin.bytes<1))throw new TypeError('Disc registration requires a pinned evidence file');
  return {observer:requireString(g.observer),kernels,registration:{method,explanation,...(parameters?{parameters}: {}),...(evidencePin?{evidence:evidencePin}:{})},width,height,maximumEmissionDegrees};
}
async function checkPins(inputs:readonly ProductInput[]){for(const input of inputs){const actual=await pinFile(input.identity);if(actual.sha256!==input.sha256||actual.bytes!==input.bytes)throw new Error(`Input pin mismatch: ${input.identity}`);}}

export async function validateProjectionSource(source:Awaited<ReturnType<typeof verifiedProduct>>){
  if(source.record.stage!=='telescope-output'||!source.record.outputs.some(o=>o.path==='image.fits'))throw new TypeError('Body-map export requires a telescope image output.product.json');
  const selection=requireRecord(source.record.parameters.selection),kind=requireString(selection.kind);
  if(!['image','band-image','feature-map'].includes(kind))throw new TypeError(`Body-map export cannot project a ${kind} output`);
  const definition=requireString(source.record.parameters.definition),metadata=requireRecord(source.record.parameters.metadata),measurement=requireRecord(source.record.parameters.measurement);
  const deliveryPins=source.record.inputs.filter(i=>i.role==='delivery');
  if(deliveryPins.length!==1)throw new Error('Measurement must name exactly one source delivery');
  const deliveryPin=deliveryPins[0]!,d=await delivery(deliveryPin.identity);
  if(d.pin.sha256!==deliveryPin.sha256||d.pin.bytes!==deliveryPin.bytes)throw new Error('Measurement source delivery changed');
  const inputs:ProductInput[]=[{role:'measurement record',identity:source.file,...source.pin},...source.record.outputs.map(o=>({role:'measurement output',identity:localOutput(source.root,o.path),bytes:o.bytes,sha256:o.sha256})),...source.record.inputs];
  await checkPins(inputs);
  return {source,d,selection,definition,metadata,measurement,inputs};
}

export async function projectionSource(recordPath:string){return validateProjectionSource(await verifiedProduct(recordPath));}

export async function projectOutput(recordPath:string,geometryPath:string,outputDirectory:string){
  const prepared=await projectionSource(recordPath),{source,d,selection,definition,metadata,measurement}=prepared;
  const geometryFile=resolve(geometryPath),geometryBytes=await readFile(geometryFile),geometry=parseGeometry(JSON.parse(geometryBytes.toString()),dirname(geometryFile));
  const inputs:ProductInput[]=[...prepared.inputs,{role:'navigation choices',identity:geometryFile,bytes:geometryBytes.length,sha256:sha256(geometryBytes)},...geometry.kernels.map(k=>({role:`SPICE ${k.role}: ${k.source}`,identity:k.file,bytes:k.bytes,sha256:k.sha256}))];
  if(geometry.registration.evidence)inputs.push({role:'registration evidence',identity:geometry.registration.evidence.file,sha256:geometry.registration.evidence.sha256,bytes:geometry.registration.evidence.bytes});
  await checkPins(inputs);
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const nav=await projectWithPlanetMapper({directory:staging,geometry,image:localOutput(source.root,'image.fits'),source:d.file,target:d.target,quantity:definition});
    const rotation=geometry.kernels.find(k=>k.role==='rotation')!,plane=await readFile(resolve(staging,'map.fits'));
    const facts=requireRecord(d.record.facts);
    // Mapping does not turn sampling or a nominal capability into measured resolution.
    // The map retains explicitly typed sampling; publication cannot treat it as PSF evidence.
    const spectral=requireRecord(metadata.spectral??{}),band=selection.band;
    const sampling=requireFiniteNumber(nav.samplingArcsec);
    const resolution={majorArcsec:sampling,minorArcsec:sampling,basis:'Native angular sampling from the registered disc scale; achieved PSF/beam resolution remains unknown.',evidence:{kind:'sampling'}};
    const product=parseBodyMapProduct({schema:'cssearth-body-map@1',definition:{quantity:definition,units:requireString(nav.units),timeDependence:'instantaneous-state',
      ...(Array.isArray(band)?{wavelengthIntervalsMicrometres:[band]}:selection.kind==='image'&&Array.isArray(spectral.centersMicrometres)&&typeof selection.plane==='number'?{wavelengthIntervalsMicrometres:[[spectral.centersMicrometres[selection.plane],spectral.centersMicrometres[selection.plane]]]}:{}),
      method:{measurement,selection:Object.fromEntries(Object.entries(selection).filter(([key])=>key!=='hdu')),projection:{owner:'PlanetMapper',interpolation:'nearest',latitude:'planetocentric',shape:nav.shape,uncertainty:nav.uncertainty}},source:source.file},
      frame:{body:d.target,radiusKm:nav.radiusKm,rotation:{model:rotation.file,sha256:rotation.sha256,bodyCode:nav.bodyCode}},grid:{width:geometry.width,height:geometry.height,longitude:'east-positive-from-0',rows:'north-to-south'},
      planes:{file:'map.fits',sha256:sha256(plane),value:'VALUE',uncertainty:'SIGMA'},mask:{maximumEmissionDegrees:geometry.maximumEmissionDegrees,missing:'NaN'},
      observations:[{id:nav.observation,telescope:d.telescope,instrument:nav.instrument,midTimeJd:nav.midTimeJd,startTimeJd:nav.startTimeJd,endTimeJd:nav.endTimeJd,startIso:nav.startIso,endIso:nav.endIso,exposureSeconds:nav.exposureSeconds,rangeKm:nav.rangeKm,subObserver:nav.subObserver,angularResolution:resolution}]});
    assertBodyMapPlanes(plane,product);const bytes=Buffer.from(JSON.stringify(product,null,2)+'\n');await writeFile(resolve(staging,'map.fits.body-map.json'),bytes);
    await writeFile(resolve(staging,'navigation.json'),JSON.stringify({...nav,sourceRequest:d.record.request,sourceSatisfaction:d.record.satisfaction,sourceResolution:{angularResolutionArcsec:facts.angularResolutionArcsec??null,evidence:facts.resolutionEvidence??[]},publication:'not-evaluated'},null,2)+'\n');
    const names=['navigation.json','texture.png','poles.png','figure.png'],extras=await Promise.all(names.map(async path=>({path,bytes:await readFile(resolve(staging,path))})));
    const implementation=sha256(Buffer.concat(await Promise.all(['projection.mts','../astronomy-packages/projection.mts','../body-map-product.mts','../body-map-publication.mts'].map(path=>readFile(new URL(path,import.meta.url))))));
    const software=[{name:'cssEarth projection',version:implementation},...Object.entries(requireRecord(nav.software)).map(([name,v])=>({name,version:requireString(v)}))];
    const record=bodyMapProductRecord(product,plane,bytes,inputs,software,(await astroqueryToolchain()).digest,extras);
    await checkPins(inputs);await writeFile(resolve(staging,'map.fits.product.json'),formatProductRecord(record));
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,map:resolve(destination,'map.fits'),figure:resolve(destination,'figure.png'),receipt:resolve(destination,'map.fits.product.json'),sourceSatisfaction:d.record.satisfaction,registration:geometry.registration,publication:'not-evaluated' as const};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
