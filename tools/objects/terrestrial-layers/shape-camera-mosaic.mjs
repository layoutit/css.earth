import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadStlShape, loadObjShape, loadPdsPlateShape, loadPdsVertexFacetShape,loadPdsRadiusTable,parsePdsRadiusTable} from './obj-shape.mjs';
import {parsePdsRadialTable} from './pds-radial-table.mjs';
import {readFitsPrimary} from '../static-surface/fits-map.mjs';

const rad = Math.PI / 180;
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => a.map(v=>v/Math.hypot(...a));
const vector = (latitude, westLongitude) => [Math.cos(latitude*rad)*Math.cos(-westLongitude*rad),Math.cos(latitude*rad)*Math.sin(-westLongitude*rad),Math.sin(latitude*rad)];

/** CISSCAL retains a VICAR binary telemetry record. Some detached PDS labels
 * still point at record 2: the attached header, not that stale pointer, owns
 * the raster layout. Never interpret telemetry bytes as image pixels.
 * Raw BYTE detector DN is opt-in and normalized to 0..1 for display only;
 * that path does not imply radiometric calibration. */
export function decodeCalibratedCamera(bytes, encoding = 'calibrated') {
  if(encoding==='fits-ssi-iof'){
    const fits=readFitsPrimary(bytes);
    if(fits.bitpix!==-32||fits.width!==800||fits.height!==800||fits.scale!==1||fits.zero!==0||fits.nextOffset!==bytes.length)throw new Error('Unsupported calibrated SSI FITS layout.');
    return {data:fits.values,width:fits.width,height:fits.height,offset:fits.dataOffset,encoding,allowZero:true};
  }
  const text = bytes.subarray(0,4096).toString('ascii');
  const field = name => text.match(new RegExp(`(?:^|\\s)${name}=(?:'([^']*)'|([^\\s]+))`))?.slice(1).find(v=>v!==undefined);
  const n = name => Number(field(name));
  const width=n('NS'),height=n('NL'),record=n('RECSIZE'),offset=n('LBLSIZE')+n('NLB')*record;
  const raw=encoding==='vicar-byte-dn', half=field('FORMAT')==='HALF', size=raw?1:half?2:4;
  const prefix=n('NBB');
  // Voyager FICOR77 stores signed integers with an explicit I/F multiplier.
  // The VAX REALFMT field is irrelevant for HALF samples; INTFMT owns them.
  const scale=raw?1/255:half?Number(text.match(/FOR \(I\/F\)\*10000\., MULTIPLY DN VALUE BY\s+([\d.E+-]+)/)?.[1])*1e-4:1;
  if (!['calibrated','vicar-byte-dn'].includes(encoding)||(raw?field('FORMAT')!=='BYTE':!half&&field('FORMAT')!=='REAL')||field('ORG')!=='BSQ'||n('NB')!==1||
      !Number.isSafeInteger(prefix)||prefix<0||(!raw&&prefix!==0)||
      !(scale>0)||(!raw&&!(half?['LOW','HIGH'].includes(field('INTFMT')):['RIEEE','IEEE'].includes(field('REALFMT')))) ||
      ![width,height,record,offset].every(v=>Number.isSafeInteger(v)&&v>0)||
      record!==prefix+width*size || offset+height*record>bytes.length || n('LBLSIZE')>bytes.length || n('NLB')<0) throw new Error('Unsupported VICAR camera layout.');
  const data=new Float32Array(width*height), little=half?field('INTFMT')==='LOW':field('REALFMT')==='RIEEE';
  for(let i=0;i<data.length;i++)data[i]=(raw?bytes[offset+Math.floor(i/width)*record+prefix+i%width]:half?(little?bytes.readInt16LE(offset+2*i):bytes.readInt16BE(offset+2*i)):
    (little?bytes.readFloatLE(offset+4*i):bytes.readFloatBE(offset+4*i)))*scale;
  return {data,width,height,offset,encoding};
}

/** Camera is centred on the controlled body origin. North azimuth is clockwise
 * from image up; source longitudes are west-positive, mesh XYZ east-positive. */
export function controlledShapeCamera(frame) {
  if (![frame.observerLatitude,frame.observerWestLongitude,frame.sunLatitude,frame.sunWestLongitude,
      frame.rangeKm,frame.northAzimuthDegrees,frame.pixelAngleMicroradians,...(frame.center??[])].every(Number.isFinite) ||
      frame.center?.length!==2||Math.abs(frame.observerLatitude)>90||Math.abs(frame.sunLatitude)>90||
      !(frame.rangeKm>0)||!(frame.pixelAngleMicroradians>0))throw new Error('Invalid controlled shape camera.');
  const observer=vector(frame.observerLatitude,frame.observerWestLongitude), sun=vector(frame.sunLatitude,frame.sunWestLongitude);
  const east=[Math.sin(frame.observerWestLongitude*rad),Math.cos(frame.observerWestLongitude*rad),0];
  const north=cross(observer,east),a=frame.northAzimuthDegrees*rad,focal=1/Math.tan(frame.pixelAngleMicroradians*1e-6);
  const position=observer.map(v=>v*frame.rangeKm*1000);
  return {observer,sun,position,ray(x,y){
    const dx=(x-frame.center[0])/focal,dy=(y-frame.center[1])/focal;
    return unit(observer.map((v,k)=>-v+east[k]*(dx*Math.cos(a)+dy*Math.sin(a))+north[k]*(dx*Math.sin(a)-dy*Math.cos(a))));
  },project(point){
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
export async function resolveCatalogCamera(sourceDirectory,frame){
  if(!frame.cameraCatalog)return frame;
  const c=frame.cameraCatalog;
  if(!['east','west'].includes(c.longitudeDirection)||c.pixelOrigin!=='one-based')throw new Error('Unsupported camera catalog coordinates.');
  const rows=(await readFile(resolve(sourceDirectory,c.path),'utf8')).trim().split(/\r?\n/).map(line=>line.trim().split(/\s+/).map(Number));
  const matches=rows.filter(row=>row[0]===c.imageNumber);
  if(matches.length!==1||matches[0].length!==9||!matches[0].every(Number.isFinite))throw new Error('Camera catalog observation is missing or ambiguous.');
  const [,lat,lon,slat,slon,range,az,x,y]=matches[0],sign=c.longitudeDirection==='east'?-1:1;
  const kernel=await readFile(resolve(sourceDirectory,c.instrumentPath),'utf8');
  const number=name=>Number(kernel.match(new RegExp('^\\s*INS-77036_'+name+'\\s*=\\s*\\(\\s*([0-9.dDeE+-]+)\\s*\\)','m'))?.[1].replace(/[dD]/,'e'));
  const focal=number('FOCAL_LENGTH'),pitch=number('PIXEL_SIZE');
  if(!(focal>0)||!(pitch>0)||!(pitch/focal<.001))throw new Error('SSI instrument focal scale is unavailable.');
  return {...frame,observerLatitude:lat,observerWestLongitude:sign*lon,sunLatitude:slat,sunWestLongitude:sign*slon,
    rangeKm:range,northAzimuthDegrees:az,center:[x-1,y-1],pixelAngleMicroradians:Math.atan(pitch/focal)*1e6};
}

// Only edge-connected low-signal sky is withheld. Isolated dark crater floors
// remain observed, even when their intensity is below this authored threshold.
function maskBackground(image,threshold){
  if(threshold===undefined)return;
  if(!Number.isFinite(threshold)||threshold<0)throw new Error('Invalid source background threshold.');
  const mask=image.missing??new Uint8Array(image.data.length),seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let end=0;
  const add=i=>{if(!seen[i]&&(mask[i]||!Number.isFinite(image.data[i])||image.data[i]<=threshold)){seen[i]=1;mask[i]=1;queue[end++]=i;}};
  for(let x=0;x<image.width;x++){add(x);add((image.height-1)*image.width+x);}
  for(let y=0;y<image.height;y++){add(y*image.width);add(y*image.width+image.width-1);}
  for(let j=0;j<end;j++){const i=queue[j],x=i%image.width;
    if(x>0)add(i-1);if(x<image.width-1)add(i+1);if(i>=image.width)add(i-image.width);if(i<mask.length-image.width)add(i+image.width);}
  image.missing=mask;
}

// An authored pointing/shape uncertainty can withhold source pixels next to
// a known invalid boundary. This does not invent or stretch observed coverage.
export function insetCoverage(image,pixels){
  if(pixels===undefined||pixels===0)return;
  if(!Number.isSafeInteger(pixels)||pixels<0||pixels>64)throw new Error('Invalid camera coverage inset.');
  const mask=image.missing??new Uint8Array(image.data.length),distance=new Uint8Array(mask.length).fill(255),queue=new Int32Array(mask.length);let end=0;
  const add=(i,d)=>{if(distance[i]!==255)return;distance[i]=d;mask[i]=1;queue[end++]=i;};
  for(let i=0;i<mask.length;i++)if(mask[i])add(i,0);
  for(let x=0;x<image.width;x++){add(x,0);add((image.height-1)*image.width+x,0);}
  for(let y=0;y<image.height;y++){add(y*image.width,0);add(y*image.width+image.width-1,0);}
  for(let q=0;q<end;q++){const i=queue[q],d=distance[i]+1,x=i%image.width;if(d>pixels)continue;
    if(x>0)add(i-1,d);if(x<image.width-1)add(i+1,d);if(i>=image.width)add(i-image.width,d);if(i<mask.length-image.width)add(i+image.width,d);}
  image.missing=mask;
}

function bilinear(image,x,y){
  if(x<1||y<1||x>=image.width-2||y>=image.height-2)return null;
  const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,i=iy*image.width+ix;
  if(image.missing && [i,i+1,i+image.width,i+image.width+1].some(j=>image.missing[j]))return null;
  const p=[image.data[i],image.data[i+1],image.data[i+image.width],image.data[i+image.width+1]];
  if(p.some(n=>!Number.isFinite(n)||n<0||(!image.allowZero&&n===0)||n>1e10))return null;
  return (p[0]*(1-u)+p[1]*u)*(1-v)+(p[2]*(1-u)+p[3]*u)*v;
}

function smoothNormals(mesh){
  const sums=mesh.positions.map(()=>[0,0,0]);
  for(const f of mesh.indices){
    const [a,b,c]=f.map(i=>mesh.positions[i]);let n=cross(sub(b,a),sub(c,a));
    if(dot(n,a)<0)n=n.map(v=>-v);
    for(const i of f)for(let k=0;k<3;k++)sums[i][k]+=n[k];
  }
  const normals=sums.map(unit);
  return (faceId,p)=>{
    const f=mesh.indices[faceId],[a,b,c]=f.map(i=>mesh.positions[i]),v0=sub(b,a),v1=sub(c,a),v2=sub(p,a);
    const d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),d20=dot(v2,v0),d21=dot(v2,v1),d=d00*d11-d01*d01;
    const v=(d11*d20-d01*d21)/d,w=(d00*d21-d01*d20)/d,u=1-v-w;
    return unit([0,1,2].map(k=>u*normals[f[0]][k]+v*normals[f[1]][k]+w*normals[f[2]][k]));
  };
}

/** The latitude-first Thomas tables use the same released regular-grid
 * connectivity as the existing radius-table mesh reader. Validate the source
 * grid before changing column order; this does not change the display mesh. */
export async function loadCameraShape(sourceDirectory,shape){
  if(shape.format==='pds-radial-table'){
    const text=await readFile(resolve(sourceDirectory,shape.path),'utf8'),grid=parsePdsRadialTable(text,shape.grid);
    const step=shape.grid.latitudeStepDegrees,columns=shape.grid.columns??['latitude','longitude','radius'];
    if(step!==shape.grid.longitudeStepDegrees)throw new Error('Camera source mesh requires equal angular steps.');
    const reordered=text.trim().split(/\r?\n/).map(line=>{const row=line.trim().split(/\s+/);return ['longitude','latitude','radius'].map(name=>row[columns.indexOf(name)]).join(' ');}).join('\n');
    return parsePdsRadiusTable(reordered,{stepDegrees:step,longitudeDirection:shape.grid.longitudeDirection+'-positive',metersPerUnit:shape.grid.metersPerUnit,
      expectedVertices:(grid.width-1)*(grid.height-2)+2,expectedFaces:2*(grid.width-1)*(grid.height-2)});
  }
  const load=shape.format==='stl'?loadStlShape:shape.format==='pds-radius-table'?loadPdsRadiusTable:shape.format==='pds-plate-model'?loadPdsPlateShape:shape.format==='pds-vertex-facet'?loadPdsVertexFacetShape:loadObjShape;
  return load(resolve(sourceDirectory,shape.path),shape.grid);
}

/** The SBN bad-data tables preserve the original SSI telemetry quality blocks.
 * Their one-based inclusive line/sample ranges refer to the unchanged detector
 * pixels, also retained by the calibrated FITS products. All five bad-data codes
 * are withheld; raw 255 saturation and ISIS special values are withheld too. */
export function applySsiQuality(image,rawBytes,badData,profile){
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

export async function loadShapeCameraImage(sourceDirectory,frame){
  const image=decodeCalibratedCamera(await readFile(resolve(sourceDirectory,frame.path)),frame.encoding);
  if(frame.encoding==='fits-ssi-iof'){
    const q=frame.quality;
    if(!q)throw new Error('Calibrated SSI requires its archived detector-quality companions.');
    const rawLabel=await readFile(resolve(sourceDirectory,q.rawLabelPath),'utf8'),label=await readFile(resolve(sourceDirectory,frame.labelPath),'utf8');
    const field=name=>rawLabel.match(new RegExp('^'+name+'\\s*=\\s*"?([^"\\r\\n]+)','m'))?.[1].trim();
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

/** Project source observations using their source mesh and camera solution.
 * All ray intersections, illumination normalization and level matching happen
 * here at preparation time. Unobserved/unstable pixels remain explicit gaps. */
export async function prepareShapeCameraMosaic(sourceDirectory,entries,recipe,width,height,shape){
  const p=recipe.photometry;
  const observed=p?.model==='observed';
  if(!recipe.frames?.length||!shape||!(p?.weight>=0&&p.weight<=1)||!(p.maximumGain>=1)||
      !(p.displayMaximum>0)||!(p.gamma>0)||!(p.minimumLevel>0&&p.minimumLevel<=1&&p.maximumLevel>=1)||
      ![p.maximumIncidenceDegrees,p.maximumEmissionDegrees].every(v=>v>0&&v<90))throw new Error('Invalid shape-camera mosaic profile.');
  const paths=new Set(entries.map(e=>e.path));
  const framePaths=f=>[f.path,f.labelPath,...(f.cameraCatalog?[f.cameraCatalog.path,f.cameraCatalog.labelPath,f.cameraCatalog.instrumentPath]:[]),...(f.quality?[f.quality.rawPath,f.quality.rawLabelPath,f.quality.badDataPath,f.quality.badDataLabelPath]:[])];
  for(const f of recipe.frames)if(framePaths(f).some(path=>!paths.has(path)))throw new Error(`Unpinned camera input: ${f.id}`);
  if(paths.size!==new Set(recipe.frames.flatMap(framePaths)).size)throw new Error('Unconsumed camera input.');
  const frames=await Promise.all(recipe.frames.map(frame=>resolveCatalogCamera(sourceDirectory,frame)));
  if(p.model!==undefined&&(!observed||p.maximumGain!==1||p.minimumLevel!==1||p.maximumLevel!==1))throw new Error('Observed camera brightness must not be photometrically normalized.');
  const mesh=await loadCameraShape(sourceDirectory,shape),normalAt=smoothNormals(mesh);
  const points=new Float64Array(width*height*3),normals=new Float32Array(points.length),valid=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const lon=(x+.5)/width*360,lat=90-(y+.5)/height*180,h=mesh.hit(lon,lat);if(!h)continue;
    const point=vector(lat,-lon).map(v=>v*h.radius),i=y*width+x;
    points.set(point,i*3);normals.set(normalAt(h.faceId,point),i*3);valid[i]=1;
  }
  const values=new Float32Array(width*height),missing=new Uint8Array(values.length).fill(1),statistics=[];
  const minI=Math.cos(p.maximumIncidenceDegrees*rad),minE=Math.cos(p.maximumEmissionDegrees*rad),epsilon=.01;
  // Coarse coverage first; finer images replace only their reliable interior.
  for(const frame of frames.sort((a,b)=>b.rangeKm-a.rangeKm)){
    const image=await loadShapeCameraImage(sourceDirectory,frame),camera=controlledShapeCamera(frame);
    maskBackground(image,frame.backgroundMaximum??p.backgroundMaximum);
    insetCoverage(image,frame.coverageInsetPixels);
    const entry=entries.find(e=>e.path===frame.path);
    if(entry.width!==image.width||entry.height!==image.height)throw new Error(`Camera dimensions differ from pinned metadata: ${frame.id}`);
    const samples=[],ratios=[];
    for(let i=0;i<values.length;i++){
      if(!valid[i])continue;
      const point=points.subarray(i*3,i*3+3),n=normals.subarray(i*3,i*3+3),direction=unit(sub(camera.position,point));
      const mu=dot(n,direction),mu0=dot(n,camera.sun);if(mu<minE||mu0<minI)continue;
      const xy=camera.project(point),source=xy&&bilinear(image,...xy);if(source===null||source===undefined)continue;
      const gain=observed?1:1/(2*p.weight*mu0/(mu0+mu)+(1-p.weight)*mu0);if(gain>p.maximumGain)continue;
      const origin=point.map((v,k)=>v+n[k]*epsilon);
      // Camera occlusion and terrain shadows cannot be inverted into imagery.
      if(mesh.intersect(origin,direction,Math.hypot(...sub(camera.position,point)))||mesh.intersect(origin,camera.sun))continue;
      const value=source*gain;
      if(!missing[i]&&i%16===0&&values[i]>.015&&value>.015)ratios.push(values[i]/value);
      const weight=Math.min(1,(mu-minE)/.12,(mu0-minI)/.12,xy[0]/8,xy[1]/8,(image.width-xy[0])/8,(image.height-xy[1])/8);
      samples.push(i,value,weight);
    }
    ratios.sort((a,b)=>a-b);
    const level=ratios.length>=100?Math.max(p.minimumLevel,Math.min(p.maximumLevel,ratios[Math.floor(ratios.length/2)])):1;
    for(let j=0;j<samples.length;j+=3){const [i,value,weight]=samples.slice(j,j+3);
      values[i]=missing[i]?value*level:values[i]*(1-weight)+value*level*weight;missing[i]=0;}
    statistics.push({id:frame.id,sourceWidth:image.width,sourceHeight:image.height,rasterOffset:image.offset,
      encoding:image.encoding,...(image.quality?{quality:image.quality}:{}),resolutionMeters:frame.rangeKm*frame.pixelAngleMicroradians*.001,correctedPixels:samples.length/3,level,overlapSamples:ratios.length});
  }
  const rgb=Buffer.alloc(values.length*3);
  for(let i=0;i<values.length;i++){const v=Math.round(255*Math.min(1,values[i]/p.displayMaximum)**(1/p.gamma));rgb.fill(v,i*3,i*3+3);}
  return {rgb,missing,grid:{model:'controlled-shape-camera',photometry:p,frames:statistics,
    coveragePixels:missing.reduce((sum,v)=>sum+1-v,0),totalPixels:values.length}};
}
