/** Reproduce the published-pole diagnostic. This never writes a scene or a surface recipe. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {controlledShapeCamera, decodeCalibratedCamera} from '../../terrestrial-layers/shape-camera-mosaic.mts';
import {parseTextKernel, number as kernelNumber, numbers as kernelNumbers} from '../../../spice/text-kernel.mts';
import {requireRecord, requireArray, requireFiniteNumber, requireString} from '../../../sources/source-values.mts';

type Pixel = [number, number];
type Vector = [number, number, number];
type Pose = [number, number, number, number, number];
type Similarity = [number, number, number, number];
const rad = Math.PI / 180, base = 'src/objects/dactyl/evidence/registration/';
const paperPath = process.argv[2], output = resolve(process.argv[3] ?? 'output/dactyl-published-controls');
if (!paperPath || process.argv.length > 4) throw new Error('Usage: node fit-dactyl-published-controls.mts /path/to/paper.pdf [output-directory]');

const numbers = (v: unknown) => requireArray(v).map(n => requireFiniteNumber(n));
function pixel(v: unknown): Pixel {const n = numbers(v); if (n.length !== 2) throw new Error('Expected pixel pair.'); return [n[0], n[1]];}
function integer(v: unknown) {const n = requireFiniteNumber(v); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Expected nonnegative integer.'); return n;}
function verify(b: Buffer, record: Record<string, unknown>) {
  if (b.length !== integer(record.expectedBytes)) throw new Error('Source bytes differ from the recorded input.');
}
const configBytes = await readFile(base + 'published-controls.json'), config = requireRecord(JSON.parse(configBytes.toString()));
if (config.schema !== 'cssearth-dactyl-published-control-input@1' || config.objectId !== 'dactyl') throw new Error('Wrong control input.');
const paper = requireRecord(config.paper), pdf = await readFile(paperPath);
verify(pdf, paper);
const inputBytes = await readFile(requireString(config.previousInputPath));
const previous = requireRecord(JSON.parse(inputBytes.toString())), inputs = new Map<string, Buffer>();
for (const item of requireArray(previous.files)) {
  const p = requireRecord(item), path = requireString(p.path);
  if ((!path.startsWith('src/objects/') && !path.startsWith('tests/objects/fixtures/dactyl/')) || path.split('/').includes('..')) throw new Error('Invalid input path.');
  const b = await readFile(path); verify(b, p); inputs.set(requireString(p.id), b);
}
function input(id: string) {const b = inputs.get(id); if (!b) throw new Error(`Missing input ${id}.`); return b;}
const source = decodeCalibratedCamera(input('vicar'), 'vicar-byte-dn');
const frames = new Map<string, Buffer>();
for (const item of requireArray(paper.images)) {
  const p = requireRecord(item), start = integer(p.offset), length = integer(p.expectedBytes), b = pdf.subarray(start, start + length);
  verify(b, p); const metadata = await sharp(b).metadata();
  if (metadata.width !== p.width || metadata.height !== p.height || metadata.format !== 'jpeg') throw new Error('Unexpected embedded figure layout.');
  frames.set(requireString(p.id), b);
}
function frame(id: string) {const b = frames.get(id); if (!b) throw new Error('Missing figure.'); return b;}
const settings = requireRecord(config.alignment), anchor = pixel(settings.nativeAnchor), poleRecord = requireRecord(config.southPole), figurePole = pixel(poleRecord.figurePixel);
function sample(data: ArrayLike<number>, width: number, height: number, x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j;
  if (i < 0 || j < 0 || i + 1 >= width || j + 1 >= height) return 0;
  return (1 - b) * ((1 - a) * data[j * width + i] + a * data[j * width + i + 1]) + b * ((1 - a) * data[(j + 1) * width + i] + a * data[(j + 1) * width + i + 1]);
}
function inverse(v: Similarity, p: Pixel): Pixel {
  const x = (p[0] - v[2]) / v[0], y = (p[1] - v[3]) / v[0], a = v[1] * rad;
  return [anchor[0] + x * Math.cos(a) + y * Math.sin(a), anchor[1] - x * Math.sin(a) + y * Math.cos(a)];
}
async function align(id: string, median: number, rectangle: number[]) {
  if (rectangle.length !== 4 || rectangle.some(n => !Number.isSafeInteger(n)) || rectangle[0] < 0 || rectangle[1] < 0 || rectangle[2] >= 800 || rectangle[3] >= 800 || rectangle[0] >= rectangle[2] || rectangle[1] >= rectangle[3]) throw new Error('Invalid fit rectangle.');
  const b = await sharp(frame(id)).median(median).greyscale().raw().toBuffer({resolveWithObject: true});
  const points: {x: number; y: number; value: number}[] = [];
  for (let y = rectangle[1]; y <= rectangle[3]; y++) for (let x = rectangle[0]; x <= rectangle[2]; x++) points.push({x, y, value: source.data[y * 800 + x]});
  const score = (v: Similarity) => {
    const angle = v[1] * rad, c = Math.cos(angle), s = Math.sin(angle); let a = 0, d = 0, aa = 0, dd = 0, ad = 0;
    for (const p of points) {
      const x = p.x - anchor[0], y = p.y - anchor[1], q = sample(b.data, b.info.width, b.info.height, v[2] + v[0] * (x*c-y*s), v[3] + v[0] * (x*s+y*c));
      a += p.value; d += q; aa += p.value*p.value; dd += q*q; ad += p.value*q;
    }
    const n = points.length, varianceA = aa-a*a/n, varianceB = dd-d*d/n;
    return varianceA > 1e-10 && varianceB > 1e-10 ? (ad-a*d/n)/Math.sqrt(varianceA*varianceB) : -1;
  };
  function improve(start: Similarity) {
    let v: Similarity = [...start], value = score(v);
    for (let step = 2; step >= .003; step /= 2) for (let pass = 0; pass < 50; pass++) {
      let changed = false;
      for (let k = 0; k < 4; k++) for (const sign of [-1, 1]) {
        const w: Similarity = [...v]; w[k] += sign*step*(k === 0 ? .2 : 1);
        if (w[0] < 4 || w[0] > 12) continue;
        const next = score(w); if (next > value) {v = w; value = next; changed = true;}
      }
      if (!changed) break;
    }
    return {parameters: v, correlation: value};
  }
  const best = [-10, 0, 10].map(angle => improve([8, angle, 210, 220])).sort((a,b) => b.correlation-a.correlation)[0];
  return {figure: id, median, rectangle, fitPixels: points.length, ...best, poleDetectorPixel: id === 'figure-9b' ? inverse(best.parameters, figurePole) : null};
}
const alignment = [];
for (const median of numbers(settings.medianSizes)) for (const rectangle of requireArray(settings.rectangles).map(numbers)) alignment.push(await align('figure-9b', median, rectangle));
const baselineAlignment = alignment.find(r => r.median === 5 && JSON.stringify(r.rectangle) === JSON.stringify(settings.fitRectangle));
if (!baselineAlignment?.poleDetectorPixel) throw new Error('Missing declared baseline alignment.');
const plainPhotoAlignment = await align('figure-9a', 5, numbers(settings.fitRectangle));
const pole = baselineAlignment.poleDetectorPixel;
const instrument = parseTextKernel(input('instrument').toString('ascii'), 'gll36001.ti');
const pitch = kernelNumber(instrument, 'INS-77036_PIXEL_SIZE'), focal = kernelNumber(instrument, 'INS-77036_FOCAL_LENGTH'), distortion = kernelNumber(instrument, 'INS-77036_DISTORTION_COEFF');
const center = kernelNumbers(instrument, 'INS-77036_FOV_CENTER').map(x => x-1);
if (center.length !== 2) throw new Error('Invalid optical center.');
function detector(p: Pixel): Pixel {const x = p[0]-center[0], y = p[1]-center[1], s = 1+distortion*(x*x+y*y); return [center[0]+x*s, center[1]+y*s];}
function ideal(p: Pixel): Pixel {
  const x = p[0]-center[0], y = p[1]-center[1], R = Math.hypot(x,y); let r = R;
  for (let i = 0; i < 6; i++) r -= (r+distortion*r**3-R)/(1+3*distortion*r*r);
  const s = R === 0 ? 1 : r/R; return [center[0]+x*s, center[1]+y*s];
}
const axes = numbers(requireRecord(JSON.parse(input('shape').toString())).semiaxesKm).map(x => x*1000);
if (axes.length !== 3 || axes.some(x => x <= 0)) throw new Error('Invalid axes.');
const limbBytes = await readFile(requireString(config.limbReportPath));
const cases = requireArray(requireRecord(JSON.parse(limbBytes.toString())).cases);
const boundary = requireArray(requireRecord(cases[cases.length-1]).detectorPixels).map(pixel), limbIdeal = boundary.map(ideal);
const featureRecords = requireRecord(previous.features);
function feature(value: unknown) {const f = requireRecord(value); return {name: requireString(f.name), lon: requireFiniteNumber(f.eastLongitudeDegrees), lat: requireFiniteNumber(f.latitudeDegrees), pixel: pixel(f.detectorPixel)};}
const acmon = feature(featureRecords.fit), celmis = feature(featureRecords.holdout), rangeKm = requireFiniteNumber(config.rangeKm);
function xyz(lon: number, lat: number): Vector {
  const d = [Math.cos(lat*rad)*Math.cos(lon*rad), Math.cos(lat*rad)*Math.sin(lon*rad), Math.sin(lat*rad)], r = 1/Math.sqrt(d.reduce((s,x,i) => s+(x/axes[i])**2,0));
  return [d[0]*r,d[1]*r,d[2]*r];
}
const camera = (v: Pose) => controlledShapeCamera({observerLatitude:v[0], observerWestLongitude:v[1], northAzimuthDegrees:v[2], center:[v[3],v[4]], rangeKm, sunLatitude:0, sunWestLongitude:0, pixelAngleMicroradians:pitch/focal*1e6});
function evaluate(v: Pose, limbScale: number, polePixel: Pixel, acmonPixel: Pixel | null) {
  const cam = camera(v);
  function project(lon: number, lat: number): Pixel {const p = cam.project(xyz(lon,lat)); if (!p) throw new Error('Control behind camera.'); return detector([p[0],p[1]]);}
  const directions = axes.map((axis,i) => {const p: Vector = [0,0,0]; p[i] = axis; const q = cam.project(p); if (!q) throw new Error('Axis behind camera.'); return [q[0]-v[3],q[1]-v[4]];});
  const xx = directions.reduce((s,p) => s+p[0]**2,0), xy = directions.reduce((s,p) => s+p[0]*p[1],0), yy = directions.reduce((s,p) => s+p[1]**2,0), determinant = xx*yy-xy*xy;
  const A = yy/determinant, B = -xy/determinant, C = xx/determinant;
  const limb = limbIdeal.map(p => {const x=p[0]-v[3],y=p[1]-v[4],gx=A*x+B*y,gy=B*x+C*y; return (x*gx+y*gy-1)/(2*Math.hypot(gx,gy));});
  const a = project(acmon.lon,acmon.lat), p = project(0,-90), c = project(celmis.lon,celmis.lat);
  const residuals = [...(acmonPixel ? [a[0]-acmonPixel[0],a[1]-acmonPixel[1]] : []), p[0]-polePixel[0],p[1]-polePixel[1], ...limb.map(x => x/limbScale)];
  return {objective:residuals.reduce((s,x) => s+x*x,0), limb, conic:{A,B,C}, acmon:a, pole:p, celmis:c};
}
function improve(start: Pose, scale: number, polePixel: Pixel, acmonPixel: Pixel | null) {
  let v: Pose = [...start], score = evaluate(v,scale,polePixel,acmonPixel).objective;
  for (let step=8; step>=.03125; step/=2) for (let pass=0; pass<80; pass++) {
    let changed=false;
    for (let k=0; k<5; k++) for (const sign of [-1,1]) {
      const w: Pose=[...v]; w[k]+=sign*step*(k<3?1:.2); if(w[0]>=0||w[0]<-89)continue;
      const value=evaluate(w,scale,polePixel,acmonPixel).objective;
      if(value<score){v=w;score=value;changed=true;}
    }
    if(!changed)break;
  }
  v[1]=(v[1]%360+360)%360;v[2]=(v[2]%360+360)%360;
  const e=evaluate(v,scale,polePixel,acmonPixel),distance=(a:Pixel,b:Pixel)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  return {pose:v,objective:e.objective,acmonDetectorPixel:e.acmon,acmonErrorPixels:distance(e.acmon,acmon.pixel),poleDetectorPixel:e.pole,poleErrorPixels:distance(e.pole,polePixel),celmisDetectorPixel:e.celmis,celmisErrorPixels:distance(e.celmis,celmis.pixel),limbRmsIdealPixels:Math.sqrt(e.limb.reduce((s,x)=>s+x*x,0)/e.limb.length),maximumLimbIdealPixels:Math.max(...e.limb.map(Math.abs))};
}
const fits = [];
for (const useAcmon of [true,false]) for (const scale of [1,1.42,2]) {
  const starts=[];
  for(const lat of [-60,-40,-20])for(const lon of [20,80,140,200,260,320])for(const az of [200,240,280])starts.push(improve([lat,lon,az,191.5,220],scale,pole,useAcmon?acmon.pixel:null));
  starts.sort((a,b)=>a.objective-b.objective);
  fits.push({useAcmon,limbResidualDivisor:scale,starts:starts.length,best:starts[0]});
}
const baseline=fits[0].best, sensitivity=[];
const poleHalfWidth=requireFiniteNumber(poleRecord.digitizationHalfWidthFigurePixels)/baselineAlignment.parameters[0];
for(const px of [-1,1])for(const py of [-1,1])for(const ax of [-1,1])for(const ay of [-1,1]){
  const pp:Pixel=[pole[0]+px*poleHalfWidth,pole[1]+py*poleHalfWidth],ap:Pixel=[acmon.pixel[0]+ax,acmon.pixel[1]+ay];
  sensitivity.push({polePixel:pp,acmonPixel:ap,fit:improve(baseline.pose,1,pp,ap)});
}
const alignmentPoleSpan=Math.max(...alignment.map(a=>a.poleDetectorPixel?Math.hypot(a.poleDetectorPixel[0]-pole[0],a.poleDetectorPixel[1]-pole[1]):0));
const dependencies=['tools/objects/terrestrial-layers/shape-camera-mosaic.mts','tools/spice/text-kernel.mts','tools/sources/source-values.mts'];
const report={schema:'cssearth-dactyl-published-control-result@1',qualifiedSurface:false,date:config.date,dependencies,rangeKm,
  alignment:{parameters:'paper pixels per native pixel, clockwise degrees, paper x/y at native anchor',baseline:baselineAlignment,plainPhoto:plainPhotoAlignment,checks:alignment,maximumPoleDisplacementNativePixels:alignmentPoleSpan},
  geometry:{poseOrder:'observer latitude, observer west longitude, north azimuth clockwise from image up, ideal center sample/line',axesMetres:axes,limbSamples:boundary.length,fits,
    interpretation:'The baseline uses unit residual weights. Divisors 1.42 and 2 are sensitivity cases, not loosened acceptance limits; 1.42 is approximately the paper limb RMS bound in native pixels, not a Gaussian sigma. Celmis is never in the objective or ranking, but was seen during earlier development and is not a fresh blind validation.',
    sourcePickSensitivity:{poleHalfWidthNativePixels:poleHalfWidth,acmonHalfWidthNativePixels:1,meaning:'Sixteen simultaneous corner perturbations, refitted locally from the baseline; not a full uncertainty distribution or a global uniqueness proof.',cases:sensitivity}},
  limits:['No exact geographic interval is assigned to the unlabelled Figure 9B wireframe.','Figure 10 is a source-controlled cylindrical projection of the same exposure, not another independent observation.','The paper gives a non-ellipsoidal shape but does not supply its numeric surface or a full Dactyl camera table. Agreement near Acmon and Celmis does not qualify all ellipsoid samples.','No source-quality, visibility, model-correspondence or public photographic surface is qualified by this diagnostic.'],
  display:{image:'Original NASA/JPL/Galileo SSI i2278 VICAR DN, uncalibrated monochrome',gain:2,crop:{left:158,top:188,width:64,height:64},zoom:6,paperPixelsRedistributed:false}};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'published-control-fit.json'),JSON.stringify(report,null,2)+'\n');
const pixels=Buffer.from(source.data.map(v=>Math.round(v*255))),crop=await sharp(pixels,{raw:{width:800,height:800,channels:1}}).extract(report.display.crop).linear(2).resize(384,384,{kernel:'nearest'}).png().toBuffer();
const pos=(p:Pixel)=>[(p[0]-158+.5)*6+8,(p[1]-188+.5)*6+74];
function panel(fit:typeof baseline,title:string,subtitle:string){
  const e=evaluate(fit.pose,1,pole,acmon.pixel),{A,B,C}=e.conic,edge=[];
  for(let i=0;i<=180;i++){const a=i/180*2*Math.PI,x=Math.cos(a),y=Math.sin(a),r=1/Math.sqrt(A*x*x+2*B*x*y+C*y*y);edge.push(pos(detector([fit.pose[3]+x*r,fit.pose[4]+y*r])).join(','));}
  const mark=(p:Pixel,color:string,cross:boolean)=>{const [x,y]=pos(p);return cross?`<path d="M${x-5},${y}h10 M${x},${y-5}v10" fill="none" stroke="${color}" stroke-width="1.5"/>`:`<circle cx="${x}" cy="${y}" r="2.2" fill="${color}"/>`;};
  const symbols=[[pole,fit.poleDetectorPixel,'#5ee8da'],[acmon.pixel,fit.acmonDetectorPixel,'#ffc75c'],[celmis.pixel,fit.celmisDetectorPixel,'#f398da']].map(p=>{const measured=pixel(p[0]),predicted=pixel(p[1]),color=requireString(p[2]);return mark(measured,color,true)+mark(predicted,color,false);}).join('');
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="505"><rect width="400" height="505" fill="#15191f"/><g fill="white" font-family="Arial,sans-serif"><text x="12" y="25" font-size="17">${title}</text><text x="12" y="47" font-size="12">${subtitle}</text><text x="12" y="65" font-size="11">Diagnostic only — not a registered surface</text></g><image x="8" y="74" width="384" height="384" href="data:image/png;base64,${crop.toString('base64')}"/><polyline points="${edge.join(' ')}" fill="none" stroke="#eee" stroke-width="1"/>${symbols}<text x="12" y="480" fill="white" font-family="Arial,sans-serif" font-size="12">Celmis discrepancy: ${fit.celmisErrorPixels.toFixed(2)} native px</text><text x="12" y="497" fill="#bbb" font-family="Arial,sans-serif" font-size="10">Crosses: measurements; dots: predictions. NASA/JPL/Galileo SSI.</text></svg>`)).png().toBuffer();
}
await sharp({create:{width:800,height:505,channels:3,background:'#15191f'}}).composite([{input:await panel(baseline,'Published pole + Acmon + full limb','Unit weights; Celmis excluded from fit and selection'),left:0,top:0},{input:await panel(fits[3].best,'Published pole + full limb','Both named craters excluded; longitude unresolved'),left:400,top:0}]).png().toFile(resolve(output,'published-control-fit.png'));
console.log(JSON.stringify({qualifiedSurface:false,output,alignmentPoleDisplacementPixels:alignmentPoleSpan,fits:fits.map(f=>({useAcmon:f.useAcmon,divisor:f.limbResidualDivisor,celmis:f.best.celmisErrorPixels,limbRms:f.best.limbRmsIdealPixels})),sensitivityCelmisRange:[Math.min(...sensitivity.map(s=>s.fit.celmisErrorPixels)),Math.max(...sensitivity.map(s=>s.fit.celmisErrorPixels))]},null,2));
