import { sha256 } from '../../../src/platform/sha256.mts';
import { parseControlledCamera, parseCameraFrame, parseCameraShape } from './source-records.mts';
type Vector = readonly number[] | Float32Array | Float64Array;
export interface CameraImage {data:Float32Array | Float64Array; width:number; height:number; offset?:number; encoding?:string; allowZero?:boolean; sampleFormat?:string;
 missing?:Uint8Array;allowFiniteSigned?:boolean;quality?:{records:number;badBlockPixels:number;saturatedPixels:number;specialPixels:number;withheldPixels:number}}
type CameraFrame = ReturnType<typeof parseCameraFrame>;
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadStlShape, loadObjShape, loadPdsPlateShape, loadPdsVertexFacetShape,loadPdsRadiusTable} from './obj-shape.mts';
import {loadPdsRadialTableMesh} from './pds-radial-table.mts';
import {readFitsPrimary} from '../observation/fits.mts';
import {readFitsImage} from '../../fits/fits.mts';
import {skyDisplayRaster, skyImageAxes} from '../../fits/fits-sky.mts';
import { pds3Keyword } from '../pds-labels.mts';
import { alignCameraBands, BAND_ALIGNMENT_CRITERIA } from './band-alignment.mts';

const rad = Math.PI / 180;
const dot = (a: Vector,b: Vector) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: Vector,b: Vector) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (a: Vector) => a.map(v=>v/Math.hypot(...a));
const vector = (latitude: number, westLongitude: number) => [Math.cos(latitude*rad)*Math.cos(-westLongitude*rad),Math.cos(latitude*rad)*Math.sin(-westLongitude*rad),Math.sin(latitude*rad)];

/** CISSCAL retains a VICAR binary telemetry record. Some detached PDS labels
 * still point at record 2: the attached header, not that stale pointer, owns
 * the raster layout. Never interpret telemetry bytes as image pixels.
 * Raw BYTE detector DN is opt-in and normalized to 0..1 for display only;
 * that path does not imply radiometric calibration. */
export function decodeCalibratedCamera(bytes: Buffer, encoding = 'calibrated'): CameraImage {
  if(encoding==='fits-ssi-iof'){
    const fits=readFitsPrimary(bytes);
    if(fits.bitpix!==-32||fits.width!==800||fits.height!==800||fits.scale!==1||fits.zero!==0||fits.nextOffset!==bytes.length)throw new Error('Unsupported calibrated SSI FITS layout.');
    return {data:fits.values,width:fits.width,height:fits.height,offset:fits.dataOffset,encoding,allowZero:true};
  }
  // Deconvolved VLT/SPHERE/ZIMPOL intensity frames. The survey distributes one double-precision image HDU whose values
  // are the deconvolution's own relative intensity: no BUNIT, no radiometric scale, no calibrated I/F to claim.
  if(encoding==='fits-zimpol-intensity'){
    const fits=readFitsImage(bytes);
    if(fits.header.XTENSION!==undefined||fits.dimensions.length!==2||fits.bitpix!==-64||fits.scale!==1||fits.zero!==0||fits.nextOffset!==bytes.length||
        ![fits.width,fits.height].every(v=>Number.isSafeInteger(v)&&v>=2&&v<=4096))throw new Error('Unsupported deconvolved ZIMPOL FITS layout.');
    if(fits.header.INSTRUME!=='SPHERE')throw new Error('A deconvolved ZIMPOL frame states SPHERE as its instrument.');
    // Every other camera this route reads stores its top row first, and the ray caster indexes rows directly. The frame's
    // own WCS puts north on the first row and east on the first column, so a stated camera centre is a row and column as seen.
    const {width,height}=fits;
    return {data:skyDisplayRaster(fits.values,width,height,skyImageAxes(fits.header)),width,height,offset:fits.dataOffset,encoding,allowZero:true};
  }
  // An image reconstructed from optical-interferometric visibilities (SQUEEZE output): one double-precision plane whose values
  // are the reconstruction's own normalised intensity. Its axes put north on the first row and east on the first column, as the
  // ray caster assumes for every frame on this route.
  if(encoding==='fits-oi-reconstruction'){
    const fits=readFitsImage(bytes);
    if(fits.bitpix!==-64||fits.planes!==1||![fits.width,fits.height].every(v=>Number.isSafeInteger(v)&&v>=2&&v<=4096))throw new Error('Unsupported reconstructed-image FITS layout.');
    // SQUEEZE writes plain RA and Dec: a reconstruction carries no projection. A radio interferometer's imager writes the same
    // sky in a zenithal projection, and over a field this small the two agree far inside a pixel, so one is accepted with the
    // field bounded. The departure of SIN or TAN from a constant plate scale grows as the cube of the field half-angle.
    const projected=/^RA---(SIN|TAN)$/u.test(String(fits.header.CTYPE1??''))&&/^DEC--(SIN|TAN)$/u.test(String(fits.header.CTYPE2??''));
    if(projected){
      const scaleDegrees=Math.max(Math.abs(Number(fits.header.CDELT1)),Math.abs(Number(fits.header.CDELT2)));
      const halfFieldRadians=Math.hypot(fits.width,fits.height)/2*scaleDegrees*Math.PI/180;
      // A third of the cube is the leading term for TAN; a hundredth of a pixel is the bound taken here.
      if(!(halfFieldRadians**3/3<scaleDegrees*Math.PI/180/100))throw new Error('A projected reconstructed image covers too wide a field to read as a plate scale.');
    } else if(fits.header.CTYPE1!=='RA'||fits.header.CTYPE2!=='DEC')throw new Error('A reconstructed image states unprojected RA and Dec axes.');
    const {width,height}=fits;
    return {data:skyDisplayRaster(fits.values,width,height,skyImageAxes(fits.header)),width,height,offset:fits.dataOffset,encoding,allowZero:true};
  }
  const text = bytes.subarray(0,4096).toString('ascii');
  const field = (name: string) => text.match(new RegExp(`(?:^|\\s)${name}=(?:'([^']*)'|([^\\s]+))`))?.slice(1).find(v=>v!==undefined);
  const n = (name: string) => Number(field(name));
  const width=n('NS'),height=n('NL'),record=n('RECSIZE'),offset=n('LBLSIZE')+n('NLB')*record;
  const raw=encoding==='vicar-byte-dn', half=field('FORMAT')==='HALF', size=raw?1:half?2:4;
  const prefix=n('NBB');
  // Voyager FICOR77 stores signed integers with an explicit I/F multiplier.
  // The VAX REALFMT field is irrelevant for HALF samples; INTFMT owns them.
  const scale=raw?1/255:half?Number(text.match(/FOR \(I\/F\)\*10000\., MULTIPLY DN VALUE BY\s+([\d.E+-]+)/)?.[1])*1e-4:1;
  if (!['calibrated','vicar-byte-dn'].includes(encoding)||(raw?field('FORMAT')!=='BYTE':!half&&field('FORMAT')!=='REAL')||field('ORG')!=='BSQ'||n('NB')!==1||
      !Number.isSafeInteger(prefix)||prefix<0||(!raw&&prefix!==0)||
      !(scale>0)||(!raw&&!(half?['LOW','HIGH'].includes(field('INTFMT') ?? ''):['RIEEE','IEEE'].includes(field('REALFMT') ?? ''))) ||
      ![width,height,record,offset].every(v=>Number.isSafeInteger(v)&&v>0)||
      record!==prefix+width*size || offset+height*record>bytes.length || n('LBLSIZE')>bytes.length || n('NLB')<0) throw new Error('Unsupported VICAR camera layout.');
  const data=new Float32Array(width*height), little=half?field('INTFMT')==='LOW':field('REALFMT')==='RIEEE';
  for(let i=0;i<data.length;i++)data[i]=(raw?bytes[offset+Math.floor(i/width)*record+prefix+i%width]:half?(little?bytes.readInt16LE(offset+2*i):bytes.readInt16BE(offset+2*i)):
    (little?bytes.readFloatLE(offset+4*i):bytes.readFloatBE(offset+4*i)))*scale;
  return {data,width,height,offset,encoding,sampleFormat:field('FORMAT')};
}

/** Camera is centred on the controlled body origin. North azimuth is clockwise
 * from image up; source longitudes are west-positive, mesh XYZ east-positive. */
export function controlledShapeCamera(source: unknown) {
  const frame = parseControlledCamera(source);
  if (![frame.observerLatitude,frame.observerWestLongitude,frame.sunLatitude,frame.sunWestLongitude,
      frame.rangeKm,frame.northAzimuthDegrees,frame.pixelAngleMicroradians,...(frame.center??[])].every(Number.isFinite) ||
      frame.center?.length!==2||Math.abs(frame.observerLatitude)>90||Math.abs(frame.sunLatitude)>90||
      !(frame.rangeKm>0)||!(frame.pixelAngleMicroradians>0))throw new Error('Invalid controlled shape camera.');
  const observer=vector(frame.observerLatitude,frame.observerWestLongitude), sun=vector(frame.sunLatitude,frame.sunWestLongitude);
  const east=[Math.sin(frame.observerWestLongitude*rad),Math.cos(frame.observerWestLongitude*rad),0];
  const north=cross(observer,east),a=frame.northAzimuthDegrees*rad,focal=1/Math.tan(frame.pixelAngleMicroradians*1e-6);
  const position=observer.map(v=>v*frame.rangeKm*1000);
  return {observer,sun,position,ray(x: number,y: number){
    const dx=(x-frame.center[0])/focal,dy=(y-frame.center[1])/focal;
    return unit(observer.map((v,k)=>-v+east[k]*(dx*Math.cos(a)+dy*Math.sin(a))+north[k]*(dx*Math.sin(a)-dy*Math.cos(a))));
  },project(point: Vector){
    const depth=frame.rangeKm*1000-dot(point,observer);
    if(depth<=0)return null;
    const x=dot(point,east),y=dot(point,north);
    return [frame.center[0]+focal*(x*Math.cos(a)+y*Math.sin(a))/depth,
      frame.center[1]+focal*(x*Math.sin(a)-y*Math.cos(a))/depth];
  }};
}

/** Thomas releases camera controls alongside each shape and mosaic. Read that
 * body frame directly, avoiding the earlier frame in individual image labels.
 * SSI's pinned instrument kernel owns focal length and physical pixel pitch. */
export async function resolveCatalogCamera(sourceDirectory: string, source: unknown){
  const frame = parseCameraFrame(source);
  if(!frame.cameraCatalog)return {...frame,...parseControlledCamera(frame)};
  const c=frame.cameraCatalog;
  if(!['east','west'].includes(c.longitudeDirection)||c.pixelOrigin!=='one-based')throw new Error('Unsupported camera catalog coordinates.');
  const rows=(await readFile(resolve(sourceDirectory,c.path),'utf8')).trim().split(/\r?\n/).map(line=>line.trim().split(/\s+/).map(Number));
  const matches=rows.filter(row=>row[0]===c.imageNumber);
  if(matches.length!==1||matches[0].length!==9||!matches[0].every(Number.isFinite))throw new Error('Camera catalog observation is missing or ambiguous.');
  const [,lat,lon,slat,slon,range,az,x,y]=matches[0],sign=c.longitudeDirection==='east'?-1:1;
  const kernel=await readFile(resolve(sourceDirectory,c.instrumentPath),'utf8');
  const number=(name: string)=>Number(kernel.match(new RegExp('^\\s*INS-77036_'+name+'\\s*=\\s*\\(\\s*([0-9.dDeE+-]+)\\s*\\)','m'))?.[1].replace(/[dD]/,'e'));
  const focal=number('FOCAL_LENGTH'),pitch=number('PIXEL_SIZE');
  if(!(focal>0)||!(pitch>0)||!(pitch/focal<.001))throw new Error('SSI instrument focal scale is unavailable.');
  return {...frame,observerLatitude:lat,observerWestLongitude:sign*lon,sunLatitude:slat,sunWestLongitude:sign*slon,
    rangeKm:range,northAzimuthDegrees:az,center:[x-1,y-1],pixelAngleMicroradians:Math.atan(pitch/focal)*1e6};
}

// Only edge-connected low-signal sky is withheld. Isolated dark crater floors
// remain observed, even when their intensity is below this authored threshold.
export function maskBackground(image: CameraImage,threshold: number | undefined){
  if(threshold===undefined)return;
  if(!Number.isFinite(threshold)||threshold<0)throw new Error('Invalid source background threshold.');
  const mask=image.missing??new Uint8Array(image.data.length),seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let end=0;
  const add=(i: number)=>{if(!seen[i]&&(mask[i]||!Number.isFinite(image.data[i])||image.data[i]<=threshold)){seen[i]=1;mask[i]=1;queue[end++]=i;}};
  for(let x=0;x<image.width;x++){add(x);add((image.height-1)*image.width+x);}
  for(let y=0;y<image.height;y++){add(y*image.width);add(y*image.width+image.width-1);}
  for(let j=0;j<end;j++){const i=queue[j],x=i%image.width;
    if(x>0)add(i-1);if(x<image.width-1)add(i+1);if(i>=image.width)add(i-image.width);if(i<mask.length-image.width)add(i+image.width);}
  image.missing=mask;
}

// An authored pointing/shape uncertainty can withhold source pixels next to
// a known invalid boundary. This does not invent or stretch observed coverage.
export function insetCoverage(image: CameraImage,pixels: number | undefined){
  if(pixels===undefined||pixels===0)return;
  if(!Number.isSafeInteger(pixels)||pixels<0||pixels>64)throw new Error('Invalid camera coverage inset.');
  const mask=image.missing??new Uint8Array(image.data.length),distance=new Uint8Array(mask.length).fill(255),queue=new Int32Array(mask.length);let end=0;
  const add=(i: number,d: number)=>{if(distance[i]!==255)return;distance[i]=d;mask[i]=1;queue[end++]=i;};
  for(let i=0;i<mask.length;i++)if(mask[i])add(i,0);
  for(let x=0;x<image.width;x++){add(x,0);add((image.height-1)*image.width+x,0);}
  for(let y=0;y<image.height;y++){add(y*image.width,0);add(y*image.width+image.width-1,0);}
  for(let q=0;q<end;q++){const i=queue[q],d=distance[i]+1,x=i%image.width;if(d>pixels)continue;
    if(x>0)add(i-1,d);if(x<image.width-1)add(i+1,d);if(i>=image.width)add(i-image.width,d);if(i<mask.length-image.width)add(i+image.width,d);}
  image.missing=mask;
}

/** The latitude-first Thomas tables use the same released regular-grid
 * connectivity as the existing radius-table mesh reader. Validate the source
 * grid before changing column order; this does not change the display mesh. */
export async function loadCameraShape(sourceDirectory: string, source: unknown){
  const shape = parseCameraShape(source);
  if(shape.format==='pds-radial-table')return loadPdsRadialTableMesh(resolve(sourceDirectory,shape.path),shape.grid);
  const load=shape.format==='stl'?loadStlShape:shape.format==='pds-radius-table'?loadPdsRadiusTable:shape.format==='pds-plate-model'?loadPdsPlateShape:shape.format==='pds-vertex-facet'?loadPdsVertexFacetShape:loadObjShape;
  return load(resolve(sourceDirectory,shape.path),shape.grid);
}

/** The SBN bad-data tables preserve the original SSI telemetry quality blocks.
 * Their one-based inclusive line/sample ranges refer to the unchanged detector
 * pixels, also retained by the calibrated FITS products. All five bad-data codes
 * are withheld; raw 255 saturation and ISIS special values are withheld too. */
export function applySsiQuality(image: CameraImage,rawBytes: Buffer,badData: string,profile: {imageId:string}){
  const raw=readFitsPrimary(rawBytes);
  if(raw.bitpix!==8||raw.width!==image.width||raw.height!==image.height||raw.scale!==1||raw.zero!==0||raw.nextOffset!==rawBytes.length||
      !/^[a-z]\d{4}$/.test(profile.imageId))throw new Error('SSI quality is not bound to a supported detector layout.');
  const missing=new Uint8Array(image.data.length);let records=0;
  for(const row of badData.trim().split(/\r?\n/)){
    const [id,...fields]=row.trim().split(/\s+/),[code,y0,y1,x0,x1]=fields.map(Number);
    if(fields.length!==5||![code,y0,y1,x0,x1].every(Number.isInteger)||code<3||code>7||x0<1||y0<1||x1<x0||y1<y0||x1>800||y1>800)throw new Error('Unsupported SSI bad-data record.');
    if(id!==profile.imageId)continue;
    records++;
    for(let y=y0-1;y<y1;y++)missing.fill(1,y*800+x0-1,y*800+x1);
  }
  if(!records)throw new Error('No archived quality records for this SSI observation.');
  const badBlockPixels=missing.reduce((a,b)=>a+b,0);let saturatedPixels=0,specialPixels=0;
  for(let i=0;i<missing.length;i++){
    if(raw.values[i]===255){missing[i]=1;saturatedPixels++;}
    if(!Number.isFinite(image.data[i])||image.data[i]<0||image.data[i]>1e10){missing[i]=1;specialPixels++;}
  }
  image.missing=missing;
  image.quality={records,badBlockPixels,saturatedPixels,specialPixels,withheldPixels:missing.reduce((a,b)=>a+b,0)};
}

export async function loadShapeCameraImage(sourceDirectory: string, source: unknown){
  const frame = parseCameraFrame(source);
  const image=decodeCalibratedCamera(await readFile(resolve(sourceDirectory,frame.path)),frame.encoding);
  // FICOR77 HALF values are signed calibrated I/F, not unsigned detector DN.
  // Accept them only for an explicitly bounded, sky-masked source footprint.
  if(frame.allowFiniteSigned!==undefined){
    if(frame.allowFiniteSigned!==true||image.sampleFormat!=='HALF'||frame.encoding==='vicar-byte-dn'||
        frame.backgroundMaximum===undefined||!Number.isFinite(frame.backgroundMaximum)||frame.backgroundMaximum<0||!((frame.coverageInsetPixels??0)>0))
      throw new Error('Signed camera samples require calibrated HALF data and an explicit bounded sky mask.');
    image.allowFiniteSigned=true;
  }
  if(frame.encoding==='fits-ssi-iof'){
    const q=frame.quality;
    if(!q)throw new Error('Calibrated SSI requires its archived detector-quality companions.');
    if(!frame.labelPath)throw new Error('Calibrated SSI requires its archived PDS4 label.');
    const rawLabel=await readFile(resolve(sourceDirectory,q.rawLabelPath),'utf8'),label=await readFile(resolve(sourceDirectory,frame.labelPath),'utf8');
    const field=(name: string)=>pds3Keyword(rawLabel,name);
    if(field('TARGET_NAME')!==q.target||field('START_TIME')!==q.startTime||field('FILTER_NAME')!==q.filter||
        !label.includes('>'+q.startTime+'<')||!label.includes('>'+q.filter+'<')||
        !rawLabel.includes('"'+q.imageId.toUpperCase()+'.FIT"')||
        Number(field('SPACECRAFT_CLOCK_START_COUNT')?.replace('.',''))!==Number(frame.path.match(/(\d+)rcal_/i)?.[1]))throw new Error('SSI quality companions identify a different observation.');
    applySsiQuality(image,await readFile(resolve(sourceDirectory,q.rawPath)),await readFile(resolve(sourceDirectory,q.badDataPath),'utf8'),q);
  }
  if(frame.backgroundOffset!==undefined){
    if(!Number.isFinite(frame.backgroundOffset))throw new Error('Invalid measured camera background offset.');
    for(let i=0;i<image.data.length;i++)image.data[i]-=frame.backgroundOffset;
  }
  return image;
}

export const framePaths=(f: CameraFrame)=>[f.path,...(f.labelPath?[f.labelPath]:[]),...(f.cameraCatalog?[f.cameraCatalog.path,f.cameraCatalog.labelPath,f.cameraCatalog.instrumentPath]:[]),...(f.quality?[f.quality.rawPath,f.quality.rawLabelPath,f.quality.badDataPath,f.quality.badDataLabelPath]:[])];

/** Measure every registered camera against its declared reference images. References are used in order: the first is the
 * camera seed, and each later one once a check has confirmed it. Every channel camera must be confirmed. */
export async function checkBandAlignment(sourceDirectory: string,channels: readonly {filter:string;frames:readonly CameraFrame[]}[],
  registration: {references:readonly CameraFrame[];checks:readonly {reference:string;targets:readonly string[]}[]},mesh: Parameters<typeof alignCameraBands>[0]['mesh']){
  const frames=new Map<string,{frame:CameraFrame;filter:string}>();
  for(const entry of [...registration.references.map(frame=>({frame,filter:'reference'})),...channels.flatMap(channel=>channel.frames.map(frame=>({frame,filter:channel.filter})))]){
    // A registered band image may itself be the reference, stated identically in both places.
    const known=frames.get(entry.frame.id);
    if(known&&JSON.stringify(known.frame)!==JSON.stringify(entry.frame))throw new Error(`Registered camera ids must be unique: ${entry.frame.id}`);
    if(!known)frames.set(entry.frame.id,entry);
  }
  const sources=new Map<string,Promise<{frame:CameraFrame;image:CameraImage;sha256:string}>>();
  const load=(frame:CameraFrame)=>{
    let pending=sources.get(frame.id);
    if(!pending){pending=readFile(resolve(sourceDirectory,frame.path)).then(async bytes=>{
      if(frame.encoding!=='fits-ssi-iof')return {frame,image:decodeCalibratedCamera(bytes),sha256:sha256(bytes)};
      // Calibrated SSI: the catalog owns the camera, and archive fill and quality-withheld pixels are not measurements.
      const [camera,image]=await Promise.all([resolveCatalogCamera(sourceDirectory,frame),loadShapeCameraImage(sourceDirectory,frame)]);
      const data=Float32Array.from(image.data,(value,i)=>image.missing?.[i]||!(Math.abs(value)<1e30)?NaN:value);
      return {frame:camera as CameraFrame,image:{...image,data},sha256:sha256(bytes)};
    });sources.set(frame.id,pending);}
    return pending;
  };
  const confirmed=new Set(registration.references.slice(0,1).map(frame=>frame.id)),checks=[];
  for(const check of registration.checks){
    const reference=registration.references.find(frame=>frame.id===check.reference);
    if(!reference||!confirmed.has(reference.id))throw new Error(`Registration reference ${check.reference} is neither the camera seed nor confirmed by an earlier check.`);
    const targets=[];
    for(const id of check.targets){
      const entry=frames.get(id);
      if(!entry||id===reference.id)throw new Error(`Unknown registration target: ${id}`);
      targets.push({filter:entry.filter,...await load(entry.frame)});
    }
    const {reports}=alignCameraBands({mesh,camera:controlledShapeCamera,reference:await load(reference),targets,checkOnly:true});
    for(const report of reports){
      if(!('holdout' in report)||!report.accepted)throw new Error(`Camera ${report.id} is not confirmed by reference ${reference.id}: ${'holdout' in report?JSON.stringify(report.holdout):report.reason}.`);
      confirmed.add(report.id);
      checks.push({reference:reference.id,target:report.id,filter:report.filter,fit:report.fit,holdout:report.holdout});
    }
  }
  const unconfirmed=channels.flatMap(channel=>channel.frames).filter(frame=>!confirmed.has(frame.id));
  if(unconfirmed.length)throw new Error(`Filter cameras lack a registration check: ${unconfirmed.map(frame=>frame.id).join(', ')}.`);
  return {method:'The authored cameras are measured against their reference images; preparation refits nothing.',criteria:BAND_ALIGNMENT_CRITERIA,checks};
}
