import { cross3 as cross, array, number, shape, text, dotN as dot } from '@cssearth/core';
import { pds4Blocks, pds4Elements } from '../pds-labels.mts';
import { readFitsHdu, fitsImageAccessor } from '../../fits/fits.mts';
import { readFitsHeader, readFitsPrimary } from '../observation/fits.mts';
import { archivedCameraFields, dimensions, sipCameraFields } from './source-records.mts';
import { bindSipCamera, sipPixel } from './llorri-geo.mts';

const parseCamera = shape({ ...archivedCameraFields, ...sipCameraFields, ...dimensions,
  startTime: text, target: text });
const unquote = (value: string | undefined) => value?.replace(/^'(.*)'$/, '$1').trim();

const unit = (v: number[]) => { const length = Math.hypot(...v); return v.map(n => n / length); };
export const multiplyCameraMatrices = (a: readonly number[][],b: readonly number[][]) => a.map(row => b[0].map((_,j) => row.reduce((sum,v,k) => sum+v*b[k][j],0)));
export const inverseCameraMatrix = (m: readonly number[][]) => {const co=[cross(m[1],m[2]),cross(m[2],m[0]),cross(m[0],m[1])],d=dot(m[0],co[0]);if(!(Math.abs(d)>1e-30))throw new Error('Singular camera matrix.');return [0,1,2].map(i=>co.map(row=>row[i]/d));};
const radians = Math.PI / 180;
const equatorial = (ra: number, dec: number) => [Math.cos(ra*radians)*Math.cos(dec*radians), Math.sin(ra*radians)*Math.cos(dec*radians), Math.sin(dec*radians)];

/** The released FITS WCS is inertial. A separately qualified body attitude is
 * required: the older body-fixed keywords are not a transform for a newer mesh. */
export function newHorizonsCamera(bytes: Buffer, value: unknown) {
  const control = shape({bodyToJ2000: array(array(number)), offsetPixels: array(number)})(value);
  const {header: h} = readFitsHeader(bytes);
  const n = (key: string) => number(h[key]);
  const rotation = control.bodyToJ2000;
  if (rotation.length !== 3 || rotation.some(row => row.length !== 3) || control.offsetPixels.length !== 2 ||
      rotation.some((row,i) => rotation.some((other,j) => Math.abs(dot(row,other) - Number(i===j)) > 1e-10)) ||
      dot(rotation[0],cross(rotation[1],rotation[2])) < .999999 || Math.hypot(...control.offsetPixels) > 64 ||
      h.CTYPE1 !== 'RA---TAN-SIP' || h.CTYPE2 !== 'DEC--TAN-SIP' || h.A_ORDER !== 3 || h.B_ORDER !== 3 ||
      h.RADESYS !== 'ICRS' || h.CUNIT1 !== 'deg' || h.CUNIT2 !== 'deg') throw new Error('Unsupported New Horizons attitude or WCS.');
  const toBody = (v: number[]) => [0,1,2].map(i => dot(rotation.map(row => row[i]),v));
  const eye = toBody(['SPCTSCX','SPCTSCY','SPCTSCZ'].map(n));
  const bore = equatorial(n('CRVAL1'),n('CRVAL2')), east = equatorial(n('CRVAL1')+90,0), north = cross(bore,east);
  const cd = [[n('CD1_1'),n('CD1_2')],[n('CD2_1'),n('CD2_2')]], det = cd[0][0]*cd[1][1]-cd[0][1]*cd[1][0];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('Degenerate New Horizons WCS.');
  const ref = [n('CRPIX1')-1,n('CRPIX2')-1];
  const qx = east.map((v,i) => (cd[1][1]*v-cd[0][1]*north[i])/det/radians);
  const qy = east.map((v,i) => (-cd[1][0]*v+cd[0][0]*north[i])/det/radians);
  const rows = [qx.map((v,i) => v+(ref[0]+control.offsetPixels[0])*bore[i]),
    qy.map((v,i) => v+(ref[1]+control.offsetPixels[1])*bore[i]), bore].map(toBody);
  const cofactors = [cross(rows[1],rows[2]),cross(rows[2],rows[0]),cross(rows[0],rows[1])], determinant = dot(rows[0],cofactors[0]);
  const terms = (axis: string) => [2,3].flatMap(degree => Array.from({length:degree+1}, (_,i) => [i,degree-i,n(`${axis}_${i}_${degree-i}`)]));
  return {schema:'cssearth-archived-camera@1',
    width:n('NAXIS1'),height:n('NAXIS2'),target:text(h.SPCTCB),startTime:text(h.SPCUTCAL),filter:'PANCHROMATIC',
    matrix:rows.map(row => [...row,-dot(row,eye)]),rayMatrix:[0,1,2].map(i => cofactors.map(row => row[i]/determinant)),
    positionKm:eye,sunDirection:toBody(unit(['SPCTSOX','SPCTSOY','SPCTSOZ'].map(n))),
    sip:{referencePixel:ref,a:terms('A'),b:terms('B'),offsetPixels:[0,0]}};
}

/** NH LORRI calibrated DN, paired uncertainty, and unsigned quality flags.
 * ABSCCORR adds conversion keywords; it does not turn these pixels into I/F. */
export function decodeNewHorizonsLorri(bytes: Buffer, value: unknown) {
  const camera = parseCamera(value);
  const image = readFitsPrimary(bytes), sigma = readFitsPrimary(bytes.subarray(image.nextOffset));
  const quality = readFitsPrimary(bytes.subarray(image.nextOffset+sigma.nextOffset)), h = image.header;
  if (image.bitpix !== -32 || sigma.bitpix !== -32 || quality.bitpix !== 16 || quality.zero !== 32768 ||
      [image,sigma,quality].some(f => f.width !== 1024 || f.height !== 1024 || f.scale !== 1) || image.zero !== 0 || sigma.zero !== 0 ||
      image.nextOffset+sigma.nextOffset+quality.nextOffset !== bytes.length || camera.width !== 1024 || camera.height !== 1024 ||
      unquote(sigma.header.EXTNAME) !== 'LORRI Error image' || unquote(quality.header.EXTNAME) !== 'LORRI Quality flag image' ||
      unquote(h.INSTRU) !== 'lor' || unquote(h.SPCINSTR) !== 'NH_LORRI' || unquote(h.SPCSTAT) !== 'OK' ||
      unquote(h.HSCOMPR) !== 'LOSSLESS' || unquote(h.OBSCOMPL) !== 'COMPLETE' || unquote(h.SPCTCB) !== camera.target ||
      unquote(h.SPCUTCAL) !== camera.startTime || unquote(h.CTYPE1) !== 'RA---TAN-SIP' || unquote(h.CTYPE2) !== 'DEC--TAN-SIP' ||
      ['BIASCORR','SMEARCOR','FLATCORR','COMPERR','COMPQUAL'].some(key => unquote(h[key]) !== 'PERFORM') ||
      !(Number(h.EXPTIME) > 0)) throw new Error('Unsupported New Horizons LORRI product or quality layout.');
  const values = Float32Array.from(image.values, v => v/Number(h.EXPTIME));
  return {width:1024,height:1024,planes:{IMAGE:values},camera,...bindSipCamera(camera),startTime:camera.startTime,filter:'PANCHROMATIC',
    acceptPixel:(i:number) => quality.values[i] === 0 && Number.isFinite(values[i]) && Number.isFinite(sigma.values[i]) && sigma.values[i] >= 0,
    qualityReport:{units:'relative DN per second',pairedSigmaAndQuality:true,exposureSeconds:Number(h.EXPTIME),
      flagDefinition:'Reject all nonzero flags: Reed-Solomon error, reference calibration defect, dead pixel, saturation, missing data or other bad pixel.',
      geometry:'Original TAN-SIP WCS, source inertial vectors and a mesh-specific fitted attitude; full source-mesh visibility.',
      illumination:'Original acquisition illumination retained; no albedo or disk-normalization claim.'}};
}

/** Provider-registered, PSF-matched CA05 MVIC cube: BLUE, RED, NIR, CH4.
 * The archive resamples 340 m native pixels threefold; that adds no resolution.
 * Keep derived band values floating until the shared display boundary. */
export function decodeArrokothMvic(bytes: Buffer, value: unknown, label: string) {
  const bins=pds4Blocks(label,'sp:Bin_Wavelength').map(block=>{
    const wavelength=pds4Elements(block,'sp:center_wavelength')[0];
    return {sequence:Number(pds4Elements(block,'sp:bin_sequence_number')[0]?.content),filter:pds4Elements(block,'sp:filter_name')[0]?.content.trim(),
      wavelength:Number(wavelength?.tag==='<sp:center_wavelength unit="nm">'?wavelength.content:undefined)};
  });
  if(!pds4Elements(label,'file_name').some(element=>element.content==='ca05_mvic_cube.fit') || !pds4Elements(label,'unit').some(element=>element.content.trim()==='data number') ||
      bins.length!==4 || bins.some((bin,i)=>bin.sequence!==i+1 || bin.filter!==['Blue','Red','NIR','CH4'][i] || bin.wavelength!==[475,620,877.5,885][i]))
    throw new Error('MVIC color requires its native band order, wavelengths and data-number units.');
  const camera = shape({...archivedCameraFields,...dimensions,startTime:text,
    imageTransform:array(array(number)),referenceCamera:shape(sipCameraFields)})(value);
  const hdu = readFitsHdu(bytes), {header:h,dataOffset} = hdu, at = fitsImageAccessor(bytes, hdu);
  if (camera.width !== 300 || camera.height !== 300 ||
      h.SIMPLE !== true || h.BITPIX !== -64 || h.NAXIS !== 3 || h.NAXIS1 !== 300 || h.NAXIS2 !== 300 || h.NAXIS3 !== 4 ||
      h.BSCALE !== undefined || h.BZERO !== undefined || dataOffset+300*300*4*8 !== bytes.length) throw new Error('Unsupported Arrokoth MVIC cube.');
  const bands = Array.from({length:4}, (_,b) => Float64Array.from({length:90000}, (_,i) => at(b*90000+i)));
  const transform = camera.imageTransform;
  if (transform.length!==3 || transform.some(row=>row.length!==3) || transform[2].some((v,i)=>v!==Number(i===2))) throw new Error('MVIC requires its fitted image-space transform.');
  const inverse = inverseCameraMatrix(transform), reference = bindSipCamera(camera.referenceCamera);
  const pixel = (matrix:number[][],x:number,y:number) => matrix.slice(0,2).map(row=>dot(row,[x,y,1]));
  return {width:300,height:300,planes:{IMAGE:bands[1]},colorPlanes:[bands[2],bands[1],bands[0]],camera,startTime:camera.startTime,filter:'NIR/RED/BLUE',
    projectPoint:(point:readonly number[]) => {const [x,y,depth]=reference.projectPoint(point);return [...pixel(transform,x,y),depth];},
    rayPixel:(x:number,y:number) => {const [u,v]=pixel(inverse,x,y),[a,b]=sipPixel(camera.referenceCamera,u,v,false);return pixel(transform,a,b);},
    acceptPixel:(i:number) => bands.every(plane => Number.isFinite(plane[i])),
    qualityReport:{units:'archive data number',nativePixelScaleMeters:340,archiveUpsampling:3,enhancedColor:true,channels:['NIR','RED','BLUE'],
      geometry:'CA05 LORRI mesh camera transferred through a fitted image-space similarity. MVIC scan geometry varies slightly during acquisition.',
      processing:'Provider matched the four band PSFs and registered them to RED. No invented detail or separate per-channel stretch.',
      illumination:'Original acquisition illumination retained. Enhanced filter color; not natural color or a measured albedo map.'}};
}
