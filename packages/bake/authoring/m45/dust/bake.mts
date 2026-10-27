import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { encodeCloudPoints, readCloudPoints, type PreparedCloudPoints } from '@cssearth/objects';
import { packPreparedBank } from '@cssearth/objects/node';
import { createField } from './field/density.mts';
import {prepareTransmission} from './field/transmission.mts';
import { prepareTransport } from './physics/illumination.mts';
import { json, vector } from './field/grid.mts';
import type { Vec } from './physics/types.mts';
import { cellBox, cellPart, derivePatchFromDensity, patchPlan, rayBox, referenceProjection, type FixedPatch } from './geometry/patches.mts';
import { referenceCamera } from './geometry/reference.mts';
import { patchAxisWeight, quantizedPatchAlpha } from './geometry/windows.mts';
import { foregroundSelection } from './field/foreground.mts';
import { prepareWide } from './panorama/integrate.mts';
import { guardPanorama } from './panorama/guard.mts';
import { packCloudAtlas,encodeCloudAtlas } from './atlas/pack.mts';

const pilot = process.argv.includes('--pilot'), out = pilot ? '.local/pleiades-dust/pilot' : '.local/pleiades-dust/bake';
const texels = 160, kernel = 'cosine-half-pitch-joint-alpha', started = Date.now();
await mkdir(out, { recursive: true });
if (!pilot) {
  const previous = await json('.local/pleiades-dust/pilot/record.json');
  if (previous.executionComplete !== true || previous.pilot !== true || previous.texels !== texels || previous.kernel !== kernel)
    throw new Error('Matching positive Pleiades pilot required');
}
const reference = await referenceCamera(), field = await createField(), selection = foregroundSelection(field);
const transport = await prepareTransport(field), light = transport.source([0, 0, -1], selection.earthEye);
const old = await json('src/objects/milky-way-pleiades-dust/source/parameters.json'), oldRows = requireArray(old.cellProjections).map(v => requireRecord(v));
const display = requireRecord(old.display), gains = vector(display.gains), exposure = requireFiniteNumber(display.exposure);
if (!(exposure > 0) || gains.some(v => !(v > 0))) throw new Error('Positive inherited display required');
const plan = patchPlan().filter(p => cellBox(p.cell).min[2] < selection.starPlaneZPc && (!pilot || ['core-0-1-1', 'surround-0-0'].includes(p.cell.id)));
interface Raster { data: Uint8Array; width: number; height: number }
interface Sprite { id: string; position: Vec; diameter: number; rgba: Uint8Array; record: Record<string, unknown> }
const images = new Map<string, Raster>(), sprites: Sprite[] = [], cellRecords: Record<string, unknown>[] = [];
const encoded = (v: number) => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
function encode(rgb: Float64Array, rgba: Uint8Array, offset: number): void {
  const peak = Math.max(...rgb.map((v, c) => v * gains[c]!));
  if (!(Number.isFinite(peak) && peak >= 0)) throw new Error('Nonphysical radiance');
  const alpha = -Math.expm1(-exposure * peak);
  rgba[offset + 3] = Math.round(255 * alpha);
  if (!rgba[offset + 3]) return;
  for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(255 * encoded(peak ? Math.min(1, rgb[c]! * gains[c]! / peak) : 0));
}
function sample(image: Raster, u: number, v: number): [number, number, number, number] {
  const x = u * image.width - .5, y = v * image.height - .5, ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const result = [0, 0, 0, 0];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const px = ix + i, py = iy + j;
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
    const at = (py * image.width + px) * 4, alpha = image.data[at + 3]! / 255, weight = (i ? tx : 1 - tx) * (j ? ty : 1 - ty);
    result[3]! += alpha * weight;
    for (let c = 0; c < 3; c++) result[c]! += image.data[at + c]! / 255 * alpha * weight;
  }
  return [result[3]! ? result[0]! / result[3]! : 0, result[3]! ? result[1]! / result[3]! : 0, result[3]! ? result[2]! / result[3]! : 0, result[3]!];
}

for (const patch of plan) {
  const p = patch, source = oldRows.find(r => r.cell === p.cell.id);
  if (!source) throw new Error('Original projection missing');
  const projection = referenceProjection(p.cell, vector(source.eye), reference.axes, { cameraEye: reference.eye, spanPc: requireFiniteNumber(source.spanPc) });
  let image = images.get(p.cell.id);
  if (!image) {
    const size = p.cell.kind === 'core' ? 384 : 128, rgba = new Uint8Array(size * size * 4), radiance = new Float32Array(size * size * 3);
    const j = new Float64Array(3), sum = new Float64Array(3), box = cellBox(p.cell);
    box.max[2] = Math.min(box.max[2], selection.starPlaneZPc);
    let nonzero = 0, maxSteps = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const ray = projection.bakeRay((x + .5) / size, (y + .5) / size), segment = rayBox(ray, box);
      sum.fill(0);
      if (segment) {
        const steps = Math.ceil((segment[1] - segment[0]) / (p.cell.kind === 'core' ? .04 : .25)), ds = (segment[1] - segment[0]) / steps;
        maxSteps = Math.max(maxSteps, steps);
        for (let k = 0; k < steps; k++) {
          const distance = segment[0] + (k + .5) * ds, at: Vec = ray.eye.map((v, a) => v + ray.direction[a]! * distance) as Vec;
          const rho = selection.selected(...at) * cellPart(p.cell, ...at);
          if (!rho) continue;
          light.at(...at, j);
          for (let c = 0; c < 3; c++) sum[c]! += rho * j[c]! * ds;
        }
      }
      const pixel = y * size + x;
      radiance.set(sum, pixel * 3); encode(sum, rgba, pixel * 4);
      if (rgba[pixel * 4 + 3]) nonzero++;
    }
    image = { data: rgba, width: size, height: size }; images.set(p.cell.id, image);
    await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png().toFile(`${out}/${p.cell.id}-earth-foreground.png`);
    await writeFile(`${out}/${p.cell.id}-earth-foreground.f32`, Buffer.from(radiance.buffer));
    cellRecords.push({ id: p.cell.id, texels: size, nonzero, maxSteps, eye: projection.bakeEye, lightEye: selection.earthEye, spanPc: projection.spanPc });
    console.log('PLEIADES_FOREGROUND_CELL_COMPLETE', JSON.stringify({ cell: p.cell.id, nonzero, seconds: (Date.now() - started) / 1000 }));
    await new Promise<void>(done => setImmediate(done));
  }
  const n = p.cell.kind === 'core' ? 3 : 2, ix = Math.round(p.bounds.u0 * n), iy = Math.round(p.bounds.v0 * n), epsilon = .5 / n;
  const bounds = { u0: Math.max(0, p.bounds.u0 - epsilon), v0: Math.max(0, p.bounds.v0 - epsilon), u1: Math.min(1, p.bounds.u1 + epsilon), v1: Math.min(1, p.bounds.v1 + epsilon) };
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
  for (let y = Math.floor(bounds.v0 * image.height); y < Math.ceil(bounds.v1 * image.height); y++)
    for (let x = Math.floor(bounds.u0 * image.width); x < Math.ceil(bounds.u1 * image.width); x++) {
      if (quantizedPatchAlpha(image.data[(y * image.width + x) * 4 + 3]! / 255, (x + .5) / image.width, (y + .5) / image.height, ix, iy, n)) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  if (maxX < 0) continue;
  bounds.u0 = Math.max(bounds.u0, (minX - 2) / image.width); bounds.v0 = Math.max(bounds.v0, (minY - 2) / image.height);
  bounds.u1 = Math.min(bounds.u1, (maxX + 3) / image.width); bounds.v1 = Math.min(bounds.v1, (maxY + 3) / image.height);
  let placed: FixedPatch | null = null, rays = 9;
  const j = new Float64Array(3), box = cellBox(p.cell); box.max[2] = Math.min(box.max[2], selection.starPlaneZPc);
  for (const count of [9, 17, 31]) {
    rays = count;
    placed = derivePatchFromDensity((x, y, z) => {
      const rho = selection.selected(x, y, z) * cellPart(p.cell, x, y, z);
      if (!rho) return 0;
      light.at(x, y, z, j); return rho * j[1]!;
    }, box, projection, bounds, { raysPerAxis: count, maxStepPc: p.cell.kind === 'core' ? .04 : .25, centerMode: 'weighted', weightAtUv: (u, v) => patchAxisWeight(u, ix, n) * patchAxisWeight(v, iy, n) });
    if (placed) break;
  }
  if (!placed) throw new Error(`Visible foreground patch lacks model support: ${p.id}`);
  const rgba = new Uint8Array(texels * texels * 4), m = projection.basisM, det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-6) throw new Error('Singular reference display projection');
  const [cx, cy] = projection.displayPlaneXY(...placed.sourceCenterUv), origin = projection.displayPlaneXY(.5, .5), depthScale = placed.cameraDepthPc / projection.cellCameraDepthPc;
  let nonzero = 0;
  for (let y = 0; y < texels; y++) for (let x = 0; x < texels; x++) {
    const dx = (cx + ((x + .5) / texels - .5) * placed.diameterPc / depthScale - origin[0]) / projection.spanPc;
    const dy = (cy + ((y + .5) / texels - .5) * placed.diameterPc / depthScale - origin[1]) / projection.spanPc;
    const u = .5 + (m[3] * dx - m[2] * dy) / det, v = .5 + (-m[1] * dx + m[0] * dy) / det;
    if (u < bounds.u0 || u > bounds.u1 || v < bounds.v0 || v > bounds.v1) continue;
    const rgb = sample(image, u, v), at = (y * texels + x) * 4;
    rgba[at + 3] = quantizedPatchAlpha(rgb[3], u, v, ix, iy, n);
    if (!rgba[at + 3]) continue;
    nonzero++;
    for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(255 * rgb[c]!);
  }
  if (!nonzero) continue;
  if (!(placed.position[2] > selection.earthEye[2] && placed.position[2] < selection.starPlaneZPc)) throw new Error('Representative escaped selected foreground');
  const record = { id: p.id, parent: p.cell.id, position: placed.position, diameterPc: placed.diameterPc, sourceBounds: bounds,
    cameraDepthPc: placed.cameraDepthPc, depthSigmaPc: placed.cameraDepthSigmaPc, sourceCenterUv: placed.sourceCenterUv,
    raysPerAxis: rays, nonzero, material: 'One immutable Earth-referenced foreground radiance image; no directional alternative', placement: placed.metadata };
  sprites.push({ id: p.id, position: placed.position, diameter: placed.diameterPc, rgba, record });
  await sharp(rgba, { raw: { width: texels, height: texels, channels: 4 } }).png().toFile(`${out}/${p.id}.png`);
}
if (!sprites.length) throw new Error('No foreground cloud');
const packedAtlas=packCloudAtlas(sprites.map(s=>s.rgba),texels,4),{width,height,cells}=packedAtlas;
const positions=new Float64Array(sprites.length*3),diameters=new Float32Array(sprites.length);
for(const [i,s]of sprites.entries()){positions.set(s.position,i*3);diameters[i]=s.diameter;}
const bank: PreparedCloudPoints = { id: 'pleiades-earth-foreground', frame: reference.frame, count: sprites.length, positions, diameters, cells,
  cellTexels: texels, atlas: 'foreground-cloud-atlas.webp', compositing: 'grouped', occluder: [] };
const packed = encodeCloudPoints(bank); readCloudPoints(packed);
await writeFile(`${out}/foreground-cloud.bin`, packPreparedBank(packed));
await writeFile(`${out}/foreground-cloud-atlas.webp`,await encodeCloudAtlas(packedAtlas));
const native = await prepareWide({ field, transport, frame: reference.frame, out, pilot });
const wide = await guardPanorama(out,native);
const transmission=await prepareTransmission(field,{pilot});
const record = { executionComplete: true, pilot, texels, kernel, count: sprites.length, frames: 1, nativePixels: sprites.length * texels ** 2,
  atlas: { width, height }, display: { exposure, gains }, referenceEye: reference.eye, referenceAxes: reference.axes,
  foreground: selection.metadata, source: 'Single-scattering radiance evaluated once toward the fixed Earth reference, then frozen for every preview camera',
  field: field.metadata, transport: transport.metadata, transmission, cells: cellRecords, patches: sprites.map(s => s.record), wide,
  limitations: ['Billboards are finite-volume representatives, not rigid cloud surfaces or newly measured filament depths.',
    'Only the selected foreground column contributes cluster reflection; its column is not renormalized.',
    'The full unchanged dust field still attenuates illumination and stars; visible Galactic light is partitioned once over all remaining dust.',
    'Earth-reference scattering and outgoing attenuation remain frozen from other camera positions by the fixed reference model; this is a presentation model.',
    'Geometric behind-camera visibility follows ordinary point projection; it is separate from immutable material lighting.'],
  seconds: (Date.now() - started) / 1000 };
await writeFile(`${out}/record.json`, JSON.stringify(record, null, 2) + '\n');
console.log('PLEIADES_FIXED_EARTH_CLOUD_COMPLETE', JSON.stringify({ pilot, patches: sprites.length, wide: wide.count, frames: 1, seconds: record.seconds }));
