import type {InferenceGrid} from './solver.ts';
import type { Bounds3, Vector3 } from '@cssearth/bake/volume';
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
