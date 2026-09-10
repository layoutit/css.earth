import type { SourceMesh } from './contracts.mts';
import { parseArchivedCamera, parseReflectanceCamera, type NumericRaster } from './source-records.mts';
import { createHash } from 'node:crypto';
import { field, imageBlock, acceptOsirisQuality } from './osiris-geo.mts';

/** Level-4 resampled reflectance keeps its quality and sigma arrays in the
 * same original PDS file. Pixel origin includes any archived CCD subframe. */
export function decodeOsirisReflectance(bytes: Buffer, cameraSource: unknown, allowLossy: boolean) {
  const camera = parseReflectanceCamera(cameraSource);
  const prefix = bytes.subarray(0, 65536).toString('ascii');
  const records = Number(field(prefix, 'FILE_RECORDS')), labelRecords = Number(field(prefix, 'LABEL_RECORDS'));
  if (field(prefix, 'PDS_VERSION_ID') !== 'PDS3' || Number(field(prefix, 'RECORD_BYTES')) !== 512 ||
      records * 512 !== bytes.length || !Number.isInteger(labelRecords) || labelRecords < 1 || labelRecords > 128) throw new Error('Invalid OSIRIS reflectance record layout.');
  const label = bytes.subarray(0, labelRecords * 512).toString('ascii');
  if (!['OSINAC', 'OSIWAC'].includes(field(label, 'INSTRUMENT_ID') ?? '') ||
      field(label, 'TARGET_NAME') !== camera.target || field(label, 'START_TIME') !== camera.startTime ||
      field(label, 'FILTER_NAME') !== camera.filter || field(label, 'DATA_QUALITY_ID') !== '0000000000000000' ||
      createHash('sha256').update(bytes).digest('hex') !== camera.imageSha256) throw new Error('OSIRIS camera is not bound to this exact observation.');
  const data: Record<string, NumericRaster> = {}, ranges: number[][] = []; const count = camera.width * camera.height;
  for (const name of ['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE']) {
    const block = imageBlock(label, name), quality = name === 'QUALITY_MAP_IMAGE', stride = quality ? 1 : 4;
    const offset = (Number(field(label, '^' + name)) - 1) * 512, end = offset + count * stride;
    if (Number(field(block, 'LINE_SAMPLES')) !== camera.width || Number(field(block, 'LINES')) !== camera.height ||
        Number(field(block, 'BANDS')) !== 1 || Number(field(block, 'SAMPLE_BITS')) !== stride * 8 ||
        Number(field(block, 'FIRST_LINE')) !== camera.firstLine || Number(field(block, 'FIRST_LINE_SAMPLE')) !== camera.firstSample ||
        field(block, 'SAMPLE_TYPE') !== (quality ? 'LSB_UNSIGNED_INTEGER' : 'PC_REAL') ||
        (!quality && field(block, 'UNIT') !== '1') || field(block, 'SAMPLE_DISPLAY_DIRECTION') !== (field(label, 'INSTRUMENT_ID') === 'OSIWAC' ? 'RIGHT' : 'LEFT') ||
        field(block, 'LINE_DISPLAY_DIRECTION') !== 'DOWN' || !Number.isInteger(offset) || offset < label.length || end > bytes.length ||
        ranges.some(([a,b]) => offset < b && end > a)) throw new Error('Unsupported OSIRIS reflectance plane.');
    ranges.push([offset, end]);
    data[name] = quality ? Uint8Array.from(bytes.subarray(offset, end)) : new Float32Array(count);
    if (!quality) for (let i = 0; i < count; i++) data[name][i] = bytes.readFloatLE(offset + i * 4);
  }
  const planes: Record<string, NumericRaster> = { IMAGE: data.IMAGE };
  return { width: camera.width, height: camera.height, planes,
    acceptPixel: (i: number) => acceptOsirisQuality(data.QUALITY_MAP_IMAGE[i], allowLossy) &&
      Number.isFinite(data.IMAGE[i]) && Number.isFinite(data.SIGMA_MAP_IMAGE[i]) && data.SIGMA_MAP_IMAGE[i] >= 0,
    startTime: camera.startTime, filter: camera.filter, camera, isLossyPixel: (i: number) => Boolean(data.QUALITY_MAP_IMAGE[i] & 8),
    qualityReport: { units: 'calibrated reflectance, I/F', pairedSigmaAndQuality: true,
      flagDefinition: 'VALID bit 0 required; optional LOSSY bit 3; reject all other quality flags and nonfinite/negative sigma.',
      outputMode: allowLossy ? 'LOSSY allowed' : 'lossless only',
      geometry: 'Per-pixel full-source mesh intersections from the controlled archived camera; prepared geometry, not archive-supplied XYZ backplanes.' } };
}

const dot = (a: readonly number[],b: readonly number[]) => a.reduce((s,n,i) => s + n*b[i], 0);
const sub = (a: readonly number[],b: readonly number[]) => a.map((n,i) => n-b[i]);
const unit = (a: readonly number[]) => { const n = Math.hypot(...a); return a.map(v => v/n); };
const cross = (a: readonly number[],b: readonly number[]) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Reuse the source mesh's BVH for a controlled camera, just as the existing
 * shape-camera mosaic does. No camera or generated geometry enters runtime. */
interface ArchivedFrame { camera: unknown; width:number; height:number; planes:Record<string,NumericRaster>; qualityReport:Record<string,unknown>; rayPixel?(x:number,y:number):number[] }
export function attachSourceGeometry<T extends ArchivedFrame>(frame: T, mesh: SourceMesh) {
  const {width,height,planes} = frame, count = width*height, camera = parseArchivedCamera(frame.camera);
  if (camera.schema !== 'cssearth-archived-camera@1' || ![width,height].every(n => Number.isInteger(n) && n >= 2 && n <= 4096) ||
      camera.matrix?.length !== 3 || camera.matrix.some(r => r.length !== 4 || !r.every(Number.isFinite)) ||
      camera.rayMatrix?.length !== 3 || camera.rayMatrix.some(r => r.length !== 3 || !r.every(Number.isFinite)) ||
      camera.positionKm?.length !== 3 || !camera.positionKm.every(Number.isFinite) ||
      camera.sunDirection?.length !== 3 || Math.abs(Math.hypot(...camera.sunDirection)-1) > 1e-9) throw new Error('Invalid archived source camera.');
  for (const name of ['COORDINATE_X_IMAGE','COORDINATE_Y_IMAGE','COORDINATE_Z_IMAGE','DISTANCE_IMAGE','INCIDENCE_ANGLE_IMAGE','EMISSION_ANGLE_IMAGE','PHASE_ANGLE_IMAGE']) planes[name] = new Float32Array(count).fill(NaN);
  const eye = camera.positionKm.map(n => n*1000), sun = camera.sunDirection;
  const normals = mesh.indices.map(indices => {
    const [a,b,c] = indices.map(i => mesh.positions[i]); return unit(cross(sub(b,a),sub(c,a)));
  });
  let geometryPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y*width+x;
    const pixel = frame.rayPixel ? frame.rayPixel(x,y) : [x,y];
    const ray = unit(camera.rayMatrix.map(row => dot(row,[...pixel,1]))), hit = mesh.intersect(eye, ray);
    if (!hit) continue;
    const p = eye.map((n,k) => n+ray[k]*hit.radius), normal = normals[hit.faceId];
    planes.COORDINATE_X_IMAGE[i] = p[0]/1000; planes.COORDINATE_Y_IMAGE[i] = p[1]/1000; planes.COORDINATE_Z_IMAGE[i] = p[2]/1000;
    planes.DISTANCE_IMAGE[i] = hit.radius/1000;
    planes.INCIDENCE_ANGLE_IMAGE[i] = Math.acos(Math.max(-1,Math.min(1,dot(normal,sun))));
    planes.EMISSION_ANGLE_IMAGE[i] = Math.acos(Math.max(-1,Math.min(1,-dot(normal,ray))));
    planes.PHASE_ANGLE_IMAGE[i] = Math.acos(Math.max(-1,Math.min(1,-dot(sun,ray))));
    geometryPixels++;
  }
  const xyz = (i: number) => [planes.COORDINATE_X_IMAGE[i],planes.COORDINATE_Y_IMAGE[i],planes.COORDINATE_Z_IMAGE[i]];
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count && planes.DISTANCE_IMAGE[i] > 0;
  frame.qualityReport.modeledGeometryPixels = geometryPixels;
  return Object.assign(frame, {xyz, valid, camera});
}
