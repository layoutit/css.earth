import { cross3 as cross } from '../../../src/platform/vector3.mts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../terrestrial-layers/obj-shape.mts';

import type { SourceMesh } from '../terrestrial-layers/contracts.mts';
import { array, number, shape, text } from '../terrestrial-layers/source-records.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';

const pair = (value: unknown) => { const result = array(number)(value); assert.equal(result.length, 2); return result; };
const parseRegistration = shape({
  schema:text,
  camera:shape({observerEastLongitudeDegrees:number,observerLatitudeDegrees:number,bodyRollDegrees:number,scalePxPerKm:number,center:pair}),
  photoToPhoto:shape({rotationDegrees:number,scale:number,translation:pair}),
  bodyFrame:shape({predictedGiottoSun:shape({eastLongitude:number,latitude:number})}),
  mask:shape({polygon:array(pair),cataloguePixelInset:number,maximumEmissionDegrees:number,maximumIncidenceDegrees:number}),
});
type Registration = ReturnType<typeof parseRegistration>;
interface RgbImage {data:Uint8Array; width:number; height:number}

const radians = Math.PI / 180;
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);

const unit = (a: readonly number[]) => a.map(n => n / Math.hypot(...a));
const vector = (longitude: number, latitude: number) => [Math.cos(latitude*radians)*Math.cos(longitude*radians), Math.cos(latitude*radians)*Math.sin(longitude*radians), Math.sin(latitude*radians)];

export function polygonInteriorDistance(point: readonly number[], polygon: readonly (readonly number[])[]) {
  const [x, y] = point;
  let inside = false, distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dy = b[1] - a[1];
    if ((a[1] > y) !== (b[1] > y) && x < dx * (y - a[1]) / dy + a[0]) inside = !inside;
    const t = Math.max(0, Math.min(1, ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
    distance = Math.min(distance, Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy));
  }
  return inside ? distance : -distance;
}

export function interpolatedNormals(mesh: SourceMesh) {
  const sums = mesh.positions.map(() => [0, 0, 0]);
  for (const f of mesh.indices) {
    const n = cross(sub(mesh.positions[f[1]], mesh.positions[f[0]]), sub(mesh.positions[f[2]], mesh.positions[f[0]]));
    for (const index of f) for (let k = 0; k < 3; k++) sums[index][k] += n[k];
  }
  const normals = sums.map(unit);
  return (point: readonly number[], faceId: number) => {
    const f = mesh.indices[faceId], [a,b,c] = f.map(i => mesh.positions[i]);
    const v0 = sub(b,a), v1 = sub(c,a), v2 = sub(point,a);
    const d00 = dot(v0,v0), d01 = dot(v0,v1), d11 = dot(v1,v1), d20 = dot(v2,v0), d21 = dot(v2,v1);
    const denominator = d00*d11-d01*d01, v = (d11*d20-d01*d21)/denominator, w = (d00*d21-d01*d20)/denominator;
    return unit([0,1,2].map(k => normals[f[0]][k]*(1-v-w)+normals[f[1]][k]*v+normals[f[2]][k]*w));
  };
}

/** Source-specific orthographic registration, evaluated only during preparation.
 * The camera comes from the rounded published spin state and Vega longitude
 * anchor. Only image scale/translation were fitted to the catalogue outline.
 * These are approximate geographic positions, not calibrated reflectance. */
export function createGiottoSampler(mesh: SourceMesh, registration: Registration, image: RgbImage) {
  const { camera, photoToPhoto, bodyFrame, mask } = registration;
  const eye = vector(camera.observerEastLongitudeDegrees, camera.observerLatitudeDegrees);
  const sun = vector(bodyFrame.predictedGiottoSun.eastLongitude, bodyFrame.predictedGiottoSun.latitude);
  const longitude = camera.observerEastLongitudeDegrees*radians;
  const right = [-Math.sin(longitude), Math.cos(longitude), 0], up = cross(eye, right);
  const c = Math.cos(camera.bodyRollDegrees*radians), s = Math.sin(camera.bodyRollDegrees*radians);
  const pc = Math.cos(photoToPhoto.rotationDegrees*radians), ps = Math.sin(photoToPhoto.rotationDegrees*radians);
  const normalAt = interpolatedNormals(mesh);
  return (point: readonly number[], faceId: number) => {
    const x = camera.center[0]+camera.scalePxPerKm*(dot(point,right)*c+dot(point,up)*s)/1000;
    const y = camera.center[1]+camera.scalePxPerKm*(dot(point,right)*s-dot(point,up)*c)/1000;
    // The inset is 0.5 km at the catalogue scale; brightness never grants coverage.
    if (polygonInteriorDistance([x,y], mask.polygon) < mask.cataloguePixelInset) return null;
    const normal = normalAt(point, faceId);
    if (dot(normal,eye) < Math.cos(mask.maximumEmissionDegrees*radians) ||
        dot(normal,sun) < Math.cos(mask.maximumIncidenceDegrees*radians)) return null;
    // Check the full shape, including non-convex occlusions.
    const hit = mesh.intersect(point.map((n,i) => n+eye[i]*20000), eye.map(n => -n));
    if (!hit || Math.abs(hit.radius-20000) > 1) return null;
    const sx = photoToPhoto.scale*(x*pc-y*ps)+photoToPhoto.translation[0];
    const sy = photoToPhoto.scale*(x*ps+y*pc)+photoToPhoto.translation[1];
    const ix = Math.floor(sx), iy = Math.floor(sy), u = sx-ix, v = sy-iy;
    if (ix < 0 || iy < 0 || ix+1 >= image.width || iy+1 >= image.height) return null;
    const color = [0,1,2].map(k => {
      const at = (xx:number,yy:number) => image.data[(yy*image.width+xx)*3+k];
      const value = (1-v)*((1-u)*at(ix,iy)+u*at(ix+1,iy))+v*((1-u)*at(ix,iy+1)+u*at(ix+1,iy+1));
      // Reserve exact RGB zero for missing data; valid photographic black survives.
      return Math.max(1, Math.round(value));
    });
    return { color, pixel: [sx,sy] };
  };
}

export async function prepareGiottoProjection(sourceDirectory: string) {
  const registrationBytes = await readFile(resolve(sourceDirectory, 'reference/giotto-registration.json'));
  const registration = parseRegistration(JSON.parse(registrationBytes.toString('utf8')));
  assert.equal(registration.schema, 'cssearth-halley-giotto-registration@1');
  const shapeBytes = await readFile(resolve(sourceDirectory, 'shape/1682q1halley.tab'));
  const mesh = parsePdsRadiusTable(shapeBytes.toString(), { stepDegrees:5, longitudeDirection:'east-positive', metersPerUnit:1000, expectedVertices:2522, expectedFaces:5040 });
  const { data, info } = await sharp(resolve(sourceDirectory, 'giotto/hmc_best.gif')).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject:true });
  assert.equal(info.channels, 3);
  const sample = createGiottoSampler(mesh, registration, { data, ...info });
  const width = 512, height = 256, rgb = Buffer.alloc(width*height*3), validity = Buffer.alloc(width*height);
  let accepted = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = (x+.5)*360/width, latitude = 90-(y+.5)*180/height;
    const hit = mesh.hit(longitude, latitude);
    assert.ok(hit, 'The published complete radius grid must intersect each map direction.');
    const point = vector(longitude, latitude).map(n => n*hit.radius);
    const value = sample(point, hit.faceId);
    if (!value) continue;
    const index = y*width+x;
    rgb.set(value.color, index*3); validity[index] = 1; accepted++;
  }
  const weights = [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]];
  let totalArea = 0, observedArea = 0;
  for (let id = 0; id < mesh.indices.length; id++) {
    const f = mesh.indices[id].map(i => mesh.positions[i]);
    const area = Math.hypot(...cross(sub(f[1],f[0]),sub(f[2],f[0])))/2;
    totalArea += area;
    for (const b of weights) {
      const point = [0,1,2].map(k => f.reduce((sum,v,i) => sum+v[k]*b[i],0));
      if (sample(point,id)) observedArea += area/weights.length;
    }
  }
  const png = await sharp(rgb, { raw:{ width,height,channels:3 } }).png().toBuffer();
  const report = {
    schema:'cssearth-halley-giotto-projection-report@1', interpretation:'Approximate projection of the MPS Giotto composite; original lighting and dust contamination retained.',
    map:{ width,height,acceptedPixels:accepted,missingPixels:width*height-accepted,noData:0 },
    validity:{ encoding:'one byte per equirectangular pixel; 1 observed, 0 missing',bytes:validity.length },
    coverage:{ sampledSurfacePercent:observedArea/totalArea*100,sourceAreaSquareKm:totalArea/1e6,samplesPerTriangle:weights.length,triangles:mesh.faces },
    camera:registration.camera, maximumEmissionDegrees:registration.mask.maximumEmissionDegrees,
    maximumIncidenceDegrees:registration.mask.maximumIncidenceDegrees, cataloguePixelInset:registration.mask.cataloguePixelInset,
    photometricCorrection:'None. Source display composite is not linear radiance or albedo.', displayGain:1,
  };
  return { png, validity, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), ['--write'], 'Usage: node tools/objects/comet-1p/prepare-giotto.mts --write');
  const source = resolve('src/objects/comet-1p/source'), result = await prepareGiottoProjection(source);
  await mkdir(resolve(source, 'material'), { recursive:true });
  await writeFile(resolve(source, 'material/giotto.png'), result.png);
  await writeFile(resolve(source, 'reference/giotto-validity.bin'), result.validity);
  await writeFile(resolve(source, 'reference/giotto-projection-report.json'), JSON.stringify(result.report,null,2)+'\n');
  console.log(JSON.stringify({ map:result.report.map, coverage:result.report.coverage },null,2));
}
