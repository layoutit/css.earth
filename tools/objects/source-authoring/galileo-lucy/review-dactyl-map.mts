/** Inspect the printed map and corroborate an existing pose; never fit or prepare a scene. */
import { sha256 } from '../../../../src/platform/sha256.mts';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {controlledShapeCamera, decodeCalibratedCamera} from '../../terrestrial-layers/shape-camera-mosaic.mts';
import {parseTextKernel, number as kernelNumber, numbers as kernelNumbers} from '../../../spice/text-kernel.mts';
import {requireArray, requireFiniteNumber, requireRecord, requireString} from '../../../sources/source-values.mts';

type Pixel = [number, number];
type Vector = [number, number, number];
const paperPath = process.argv[2], output = resolve(process.argv[3] ?? 'output/dactyl-map-review');
if (!paperPath || process.argv.length > 4) throw new Error('Usage: node review-dactyl-map.mts /path/to/paper.pdf [output-directory]');
const base = 'src/objects/dactyl/evidence/registration/', rad = Math.PI / 180;

const numbers = (v: unknown) => requireArray(v).map(n => requireFiniteNumber(n));
function pixel(v: unknown): Pixel {const n = numbers(v); if (n.length !== 2) throw new Error('Expected pixel pair.'); return [n[0], n[1]];}
function integer(v: unknown) {const n = requireFiniteNumber(v); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Expected nonnegative integer.'); return n;}
function verify(b: Buffer, record: Record<string, unknown>) {
  if (b.length !== integer(record.expectedBytes) || sha256(b) !== requireString(record.expectedSha256)) throw new Error('Changed source bytes.');
}
const pins: {path: string; sha256: string}[] = [];
async function retained(path: string) {const b = await readFile(path); pins.push({path, sha256: sha256(b)}); return b;}
const configBytes = await retained(base + 'published-controls.json'), config = requireRecord(JSON.parse(configBytes.toString()));
if (config.schema !== 'cssearth-dactyl-published-control-input@1' || config.objectId !== 'dactyl') throw new Error('Wrong control input.');
const paper = requireRecord(config.paper), pdf = await readFile(paperPath); verify(pdf, paper);
const mapRecord = requireArray(paper.images).map(v => requireRecord(v)).find(p => p.id === 'figure-10');
if (!mapRecord) throw new Error('Missing Figure 10.');
const offset = integer(mapRecord.offset), jpeg = pdf.subarray(offset, offset + integer(mapRecord.expectedBytes)); verify(jpeg, mapRecord);
const metadata = await sharp(jpeg).metadata();
if (metadata.width !== mapRecord.width || metadata.height !== mapRecord.height || metadata.format !== 'jpeg') throw new Error('Unexpected map layout.');
const map = await sharp(jpeg).greyscale().raw().toBuffer({resolveWithObject: true});
const frame = requireRecord(config.mapFrame), corners = requireArray(frame.plotCornersFigurePixels).map(pixel);
if (corners.length !== 4 || JSON.stringify(frame.longitudeDegrees) !== '[0,360]' || JSON.stringify(frame.latitudeDegrees) !== '[90,-90]') throw new Error('Unexpected plot frame.');
function mapPixel(lon: number, lat: number): Pixel {
  const u = lon / 360, v = (90 - lat) / 180;
  const coordinate = (k: number) => (1-v)*((1-u)*corners[0][k]+u*corners[1][k])+v*((1-u)*corners[3][k]+u*corners[2][k]);
  return [coordinate(0), coordinate(1)];
}
function sample(data: ArrayLike<number>, width: number, height: number, p: Pixel) {
  const x = Math.floor(p[0]), y = Math.floor(p[1]), a = p[0]-x, b = p[1]-y;
  if (x < 0 || y < 0 || x+1 >= width || y+1 >= height) throw new Error('Sample outside source.');
  return (1-b)*((1-a)*data[y*width+x]+a*data[y*width+x+1])+b*((1-a)*data[(y+1)*width+x]+a*data[(y+1)*width+x+1]);
}
const mapSample = (p: Pixel) => sample(map.data, map.info.width, map.info.height, p);
// Eight printed ticks not used to digitize the four plot corners. Brightest
// integer column/row inside the frame estimates the narrow tick's centre.
const gridChecks = [];
for (const lon of [90, 180, 270]) for (const lat of [90, -90]) {
  const p = mapPixel(lon, lat), inward = lat === 90 ? 1 : -1;
  const candidates = [];
  for (let x = Math.round(p[0])-4; x <= Math.round(p[0])+4; x++) {
    let sum = 0; for (let d = 3; d <= 9; d++) sum += mapSample([x, Math.round(p[1])+inward*d]);
    candidates.push({position: x, sum});
  }
  candidates.sort((a,b) => b.sum-a.sum);
  gridChecks.push({longitude: lon, latitude: lat, axis: 'sample', predicted: p[0], measured: candidates[0].position, residual: candidates[0].position-p[0]});
}
for (const lon of [0, 360]) {
  const p = mapPixel(lon, 0), inward = lon === 0 ? 1 : -1, candidates = [];
  for (let y = Math.round(p[1])-4; y <= Math.round(p[1])+4; y++) {
    let sum = 0; for (let d = 3; d <= 10; d++) sum += mapSample([Math.round(p[0])+inward*d, y]);
    candidates.push({position: y, sum});
  }
  candidates.sort((a,b) => b.sum-a.sum);
  gridChecks.push({longitude: lon, latitude: 0, axis: 'line', predicted: p[1], measured: candidates[0].position, residual: candidates[0].position-p[1]});
}
const previousBytes = await retained(requireString(config.previousInputPath));
if (sha256(previousBytes) !== config.previousInputSha256) throw new Error('Changed original input record.');
const previous = requireRecord(JSON.parse(previousBytes.toString()));
async function input(id: string) {
  const record = requireArray(previous.files).map(v => requireRecord(v)).find(p => p.id === id);
  if (!record) throw new Error(`Missing ${id}.`);
  const b = await retained(requireString(record.path)); verify(b, record); return b;
}
const source = decodeCalibratedCamera(await input('vicar'), 'vicar-byte-dn');
const instrument = parseTextKernel((await input('instrument')).toString('ascii'), 'gll36001.ti');
const pitch = kernelNumber(instrument, 'INS-77036_PIXEL_SIZE'), focal = kernelNumber(instrument, 'INS-77036_FOCAL_LENGTH');
const distortion = kernelNumber(instrument, 'INS-77036_DISTORTION_COEFF'), center = kernelNumbers(instrument, 'INS-77036_FOV_CENTER').map(n => n-1);
const axes = numbers(requireRecord(JSON.parse((await input('shape')).toString())).semiaxesKm).map(n => n*1000);
if (axes.length !== 3 || axes.some(n => n <= 0) || center.length !== 2) throw new Error('Invalid geometry input.');
const poseReport = requireRecord(JSON.parse((await retained(base + 'published-control-fit.json')).toString()));
if (poseReport.inputSha256 !== sha256(configBytes)) throw new Error('Pose belongs to a different input revision.');
for (const value of requireArray(poseReport.dependencies)) {
  const dependency = requireRecord(value), b = await retained(requireString(dependency.path));
  if (sha256(b) !== dependency.sha256) throw new Error('Pose dependency changed; assess the earlier result before reuse.');
}
const geometry = requireRecord(poseReport.geometry), fit = requireRecord(requireArray(geometry.fits)[0]);
if (fit.useAcmon !== true || fit.limbResidualDivisor !== 1 || JSON.stringify(geometry.axesMetres) !== JSON.stringify(axes)) throw new Error('Unexpected baseline fit.');
const pose = numbers(requireRecord(fit.best).pose), rangeKm = requireFiniteNumber(config.rangeKm);
if (pose.length !== 5) throw new Error('Invalid camera pose.');
const camera = controlledShapeCamera({observerLatitude: pose[0], observerWestLongitude: pose[1], northAzimuthDegrees: pose[2], center: [pose[3], pose[4]], rangeKm, sunLatitude: 0, sunWestLongitude: 0, pixelAngleMicroradians: pitch/focal*1e6});
function xyz(lon: number, lat: number): Vector {
  const d = [Math.cos(lat*rad)*Math.cos(lon*rad), Math.cos(lat*rad)*Math.sin(lon*rad), Math.sin(lat*rad)];
  const r = 1/Math.sqrt(d.reduce((s,v,i) => s+(v/axes[i])**2,0)); return [d[0]*r, d[1]*r, d[2]*r];
}
function detector(lon: number, lat: number): Pixel {
  const p = camera.project(xyz(lon, lat)); if (!p) throw new Error('Point behind camera.');
  const x = p[0]-center[0], y = p[1]-center[1], s = 1+distortion*(x*x+y*y);
  return [center[0]+x*s, center[1]+y*s];
}
const patches = [];
for (const lat of [-20, 10]) for (const lon of [140, 170, 200]) {
  const samples: {value: number; detector: Pixel}[] = [];
  for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) samples.push({value: mapSample(mapPixel(lon+dx,lat+dy)), detector: detector(lon+dx,lat+dy)});
  function ncc(dx: number, dy: number) {
    let a=0, b=0, aa=0, bb=0, ab=0;
    for (const p of samples) {
      const u=p.value, v=sample(source.data,source.width,source.height,[p.detector[0]+dx,p.detector[1]+dy]);
      a+=u; b+=v; aa+=u*u; bb+=v*v; ab+=u*v;
    }
    const n=samples.length, variance=(aa-a*a/n)*(bb-b*b/n);
    if (variance <= 0) throw new Error('Uninformative correlation patch.');
    return (ab-a*b/n)/Math.sqrt(variance);
  }
  const matches=[];
  for (let dy=-4; dy<=4; dy+=.25) for (let dx=-4; dx<=4; dx+=.25) matches.push({dx,dy,correlation:ncc(dx,dy)});
  matches.sort((a,b)=>b.correlation-a.correlation);
  const best=matches[0], alternative=matches.find(p=>Math.hypot(p.dx-best.dx,p.dy-best.dy)>1.5);
  patches.push({longitude:lon,latitude:lat,unshiftedCorrelation:ncc(0,0),best,alternative,shiftPixels:Math.hypot(best.dx,best.dy),atSearchBoundary:Math.abs(best.dx)===4||Math.abs(best.dy)===4});
}
const report = {
  schema:'cssearth-dactyl-map-review@1',qualifiedSurface:false,date:'2026-09-14',paperSha256:sha256(pdf),mapSha256:sha256(jpeg),
  generatorSha256:sha256(await readFile(new URL(import.meta.url))),inputs:pins,
  grid:{corners,checks:gridChecks,rmsPixels:Math.sqrt(gridChecks.reduce((s,p)=>s+p.residual**2,0)/gridChecks.length),maximumPixels:Math.max(...gridChecks.map(p=>Math.abs(p.residual))),
    interpretation:'Agreement checks printed plot digitization only. It does not establish the latitude definition, reference shape, geographic accuracy or photographic coverage.'},
  fixedPose:{pose,axesMetres:axes,rangeKm,patchHalfSpanDegrees:8,patchStepDegrees:2,searchRadiusNativePixels:4,searchStepNativePixels:.25,patches,
    interpretation:'Six non-overlapping windows on the printed map, 81 interpolated samples each, not 81 independent detector measurements. The earlier camera is fixed. Local shifts diagnose disagreement; they are not fitted controls or permission to warp a texture. Some competing correlation peaks are nearly equal, and one maximum reaches the search boundary. The map was inspected in earlier development; this is corroboration, not a fresh blind holdout.'},
  limits:['The paper shows a non-ellipsoidal shape but does not identify the numeric model or latitude definition behind Figure 10.','This check tests the existing planetocentric ellipsoid hypothesis; it does not silently establish that hypothesis as the producer convention.','Source brightness is used only for correlation, never as a photographic-validity mask.','Publisher figure reuse and image-to-surface transfer are separate unresolved decisions. No figure pixels or new surface assets are written.']
};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'published-map-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({gridRmsPixels:report.grid.rmsPixels,gridMaximumPixels:report.grid.maximumPixels,patches:patches.map(p=>({longitude:p.longitude,latitude:p.latitude,unshiftedCorrelation:p.unshiftedCorrelation,shiftPixels:p.shiftPixels,atSearchBoundary:p.atSearchBoundary})),qualifiedSurface:false}));
