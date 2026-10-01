import type {InferenceGrid} from './solver.ts';
import type { Bounds3, Vector3 } from '@cssearth/objects';
export function applyRecordedPointMasks(diffuse:Buffer,original:Buffer,width:number,height:number,masks:readonly {x:number;y:number;radius:number}[]) {
// Explicitly recorded point masks, bounded by nearby light. Not a detector or a
// replacement for NOX: this baseline preserves bright extended nebular knots.
for (const mask of masks) {
  const samples: number[][] = [[], [], []];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot(x - mask.x, y - mask.y);
    if (distance < mask.radius * 1.5 || distance > mask.radius * 2) continue;
    for (let c = 0; c < 3; c++) samples[c]!.push(original[(y * width + x) * 3 + c]!);
  }
  if (samples.some(values => !values.length)) throw new Error('A point mask has no background annulus.');
  const background = samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot(x - mask.x, y - mask.y);
    if (distance >= mask.radius) continue;
    const weight = Math.min(1, (mask.radius - distance) / Math.max(1, mask.radius * .25));
    for (let c = 0; c < 3; c++) {
      const i = (y * width + x) * 3 + c;
      diffuse[i] = Math.round(diffuse[i]! + weight * (Math.min(diffuse[i]!, background[c]!) - diffuse[i]!));
    }
  }
}
}
/** Masks over a neighbour that lies inside a galaxy's own light. Each masked pixel takes the median of the unmasked
 * light on its own isophote: the ellipse through it about `centre` with the galaxy's measured `axisRatio`, whose
 * `minorAxis` is a direction in image pixels. It never gains light. An isophote with no unmasked pixel falls back to
 * the median of the light around the mask, as applyRecordedPointMasks does. */
export function applyIsophoteMasks(diffuse:Buffer,width:number,height:number,masks:readonly {x:number;y:number;radius:number}[],
  ellipse:{centre:readonly [number,number];minorAxis:readonly [number,number];axisRatio:number}) {
  const norm = Math.hypot(...ellipse.minorAxis);
  if (diffuse.length !== width * height * 3 || !ellipse.centre.every(Number.isFinite) || !(norm > 1e-10) || !(ellipse.axisRatio > 0 && ellipse.axisRatio <= 1))
    throw new TypeError('Isophote masks need an RGB raster, a finite centre, a minor-axis direction and an axis ratio in (0, 1].');
  const ax = ellipse.minorAxis[0] / norm, ay = ellipse.minorAxis[1] / norm;
  const isophote = (x:number,y:number) => { const dx = x - ellipse.centre[0], dy = y - ellipse.centre[1], axial = dx * ax + dy * ay;
    return Math.round(Math.hypot(dx * ay - dy * ax, axial / ellipse.axisRatio)); };
  const masked = new Uint8Array(width * height);
  for (const mask of masks) for (let y = Math.max(0, Math.floor(mask.y - mask.radius)); y <= Math.min(height - 1, Math.ceil(mask.y + mask.radius)); y++)
    for (let x = Math.max(0, Math.floor(mask.x - mask.radius)); x <= Math.min(width - 1, Math.ceil(mask.x + mask.radius)); x++)
      if (Math.hypot(x - mask.x, y - mask.y) < mask.radius) masked[y * width + x] = 1;
  const bins = isophote(0, 0) + isophote(width - 1, 0) + isophote(0, height - 1) + isophote(width - 1, height - 1) + 1;
  const histogram = new Uint32Array(bins * 3 * 256), counts = new Uint32Array(bins);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (masked[y * width + x]) continue;
    const bin = isophote(x, y); counts[bin]!++;
    for (let c = 0; c < 3; c++) histogram[(bin * 3 + c) * 256 + diffuse[(y * width + x) * 3 + c]!]!++;
  }
  const median = (bin:number,c:number) => { let seen = 0; const half = counts[bin]! / 2, base = (bin * 3 + c) * 256;
    for (let value = 0; value < 256; value++) { seen += histogram[base + value]!; if (seen > half) return value; } return 0; };
  const source = Buffer.from(diffuse), unresolved: {x:number;y:number;radius:number}[] = [];
  for (const mask of masks) {
    let missing = false;
    for (let y = Math.max(0, Math.floor(mask.y - mask.radius)); y <= Math.min(height - 1, Math.ceil(mask.y + mask.radius)); y++)
      for (let x = Math.max(0, Math.floor(mask.x - mask.radius)); x <= Math.min(width - 1, Math.ceil(mask.x + mask.radius)); x++) {
        const distance = Math.hypot(x - mask.x, y - mask.y);
        if (distance >= mask.radius) continue;
        const bin = isophote(x, y);
        if (!counts[bin]) { missing = true; continue; }
        const weight = Math.min(1, (mask.radius - distance) / Math.max(1, mask.radius * .25));
        for (let c = 0; c < 3; c++) { const i = (y * width + x) * 3 + c;
          diffuse[i] = Math.min(diffuse[i]!, Math.round(source[i]! + weight * (Math.min(source[i]!, median(bin, c)) - source[i]!))); }
      }
    if (missing) unresolved.push(mask);
  }
  applyRecordedPointMasks(diffuse, source, width, height, unresolved);
}
export function emissionInputChannels(resized:Uint8Array,pixels:number,blackLevel:number) {return Array.from({length:3},(_,c)=>Float32Array.from({length:pixels},(_,p)=>Math.max(0,(resized[p*3+c]!/255-blackLevel)/(1-blackLevel))));}
export function emissionRasterPixels(channels:Float32Array[],pixels:number,gain=1){
 const bytes=Buffer.alloc(pixels*3);
 for(let p=0;p<pixels;p++)for(let c=0;c<3;c++)bytes[p*3+c]=Math.round(Math.max(0,Math.min(1,channels[c]![p]!*gain))*255);
 return bytes;
}
export function createInferredEmissionSampler(volumes:readonly Float32Array[],grid:InferenceGrid,bounds:Bounds3,voxelSize:number){return (x:number,y:number,z:number,out:Vector3)=>{

    const gx = (x - bounds.min[0]) / voxelSize - .5;
    const gy = (bounds.max[1] - y) / voxelSize - .5;
    const gz = (z - bounds.min[2]) / voxelSize - .5;
    out.fill(0);
    const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz);
    for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const xx = ix + dx, yy = iy + dy, zz = iz + dz;
      if (xx < 0 || xx >= grid.width || yy < 0 || yy >= grid.height || zz < 0 || zz >= grid.depth) continue;
      const weight = (dx ? gx - ix : 1 - gx + ix) * (dy ? gy - iy : 1 - gy + iy) * (dz ? gz - iz : 1 - gz + iz);
      const index = (zz * grid.height + yy) * grid.width + xx;
      for (let c = 0; c < 3; c++) out[c]! += volumes[c]![index]! * weight / (voxelSize * Math.sqrt(grid.depth));
    }

};}
