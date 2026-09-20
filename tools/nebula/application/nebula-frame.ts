import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PreparedCssVolume, VolumeVector } from '../../../src/renderers/css/volume/types.js';
import { balanceVolumeSlices } from '../../../src/renderers/css/preparation/volume-order.js';

export const METERS_PER_PARSEC = 3.085677581491367e16;
export const ARCSECOND_RADIANS = Math.PI / 648000;
export interface NebulaSkyFrame {
  centerIcrsDegrees: [number, number]; distancePc: number;
  /** ICRS vectors for one source X/Y/Z unit, including image handedness. */
  imageRotationDegrees: number;
  arcsecPerUnit: number;
}
const vector = (v: readonly number[]): VolumeVector => [v[0]!, v[1]!, v[2]!];
function quaternion(x: VolumeVector, y: VolumeVector, z: VolumeVector): [number, number, number, number] {
  const [a,b,c,d,e,f,g,h,i] = [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]], trace = a + e + i;
  if (trace > 0) { const s = Math.sqrt(trace + 1) * 2; return [(h-f)/s,(c-g)/s,(d-b)/s,s/4]; }
  if (a > e && a > i) { const s = Math.sqrt(1+a-e-i)*2; return [s/4,(b+d)/s,(c+g)/s,(h-f)/s]; }
  if (e > i) { const s = Math.sqrt(1+e-a-i)*2; return [(b+d)/s,s/4,(f+h)/s,(c-g)/s]; }
  const s = Math.sqrt(1+i-a-e)*2; return [(c+g)/s,(f+h)/s,s/4,(d-b)/s];
}
const towardFrame = (source?: Pick<DensityVolumeFrame, 'referenceFrame'>) => source?.referenceFrame === 'lab-sky-west-north-toward';
/** Historical angular source frames reflect X; physical west/north/toward frames rotate X and Z. */
export function embedNebulaFrame(source: DensityVolumeFrame, sky: NebulaSkyFrame,
  originUnits: VolumeVector = [0,0,0]): DensityVolumeFrame {
  if (!sky.centerIcrsDegrees.every(Number.isFinite) || sky.centerIcrsDegrees[0] < 0 || sky.centerIcrsDegrees[0] >= 360 ||
      Math.abs(sky.centerIcrsDegrees[1]) > 90 || !(sky.distancePc > 0) || !Number.isFinite(sky.distancePc) ||
      !(sky.arcsecPerUnit > 0) || !Number.isFinite(sky.arcsecPerUnit) || !Number.isFinite(sky.imageRotationDegrees)) throw new TypeError('Invalid physical nebula sky frame.');
  const ra = sky.centerIcrsDegrees[0]*Math.PI/180, dec = sky.centerIcrsDegrees[1]*Math.PI/180;
  const east: VolumeVector = [-Math.sin(ra), Math.cos(ra), 0];
  const north: VolumeVector = [-Math.sin(dec)*Math.cos(ra), -Math.sin(dec)*Math.sin(ra), Math.cos(dec)];
  const away: VolumeVector = [Math.cos(dec)*Math.cos(ra), Math.cos(dec)*Math.sin(ra), Math.sin(dec)];
  const angle = sky.imageRotationDegrees*Math.PI/180, c = Math.cos(angle), s = Math.sin(angle);
  const x = vector(east.map((n,i) => n*c + north[i]!*s)), y = vector(north.map((n,i) => n*c-east[i]!*s));
  const metersPerUnit = sky.distancePc*METERS_PER_PARSEC*ARCSECOND_RADIANS*sky.arcsecPerUnit;
  return { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, metersPerUnit,
    localToReferenceXyzw: quaternion(x,y,away),
    originM: vector(away.map((n,i) => n*sky.distancePc*METERS_PER_PARSEC +
      (-x[i]!*originUnits[0]+y[i]!*originUnits[1]+n*originUnits[2])*metersPerUnit)),
    boundsUnits: { min: [-source.boundsUnits.max[0],source.boundsUnits.min[1],towardFrame(source) ? -source.boundsUnits.max[2] : source.boundsUnits.min[2]],
      max: [-source.boundsUnits.min[0],source.boundsUnits.max[1],towardFrame(source) ? -source.boundsUnits.min[2] : source.boundsUnits.max[2]] } };
}
export const reflectNebulaPoint = (p: VolumeVector, source?: Pick<DensityVolumeFrame, 'referenceFrame'>): [number,number,number] =>
  [-p[0],p[1],towardFrame(source) ? -p[2] : p[2]];
/** PolyCSS encodes physical [x,y,z] as CSS [y,x,z]; reflect the CSS matrix's second row offline. */
export function embedNebulaVolume(volume: PreparedCssVolume, frame: DensityVolumeFrame, id: string, prefix: string): PreparedCssVolume {
  const toward = towardFrame(volume.frame);
  return { ...volume, id, frame, anchors: volume.anchors?.map(a => ({ ...a, positionUnits: reflectNebulaPoint(a.positionUnits, volume.frame) })),
    resources: volume.resources.map(r => ({ ...r, path: `${prefix}/${r.path}` })),
    stacks: volume.stacks.map(stack => ({ axis: stack.axis, leaves: balanceVolumeSlices(stack.leaves.map(leaf => {
      const match = /^matrix3d\(([^)]+)\)$/.exec(leaf.style.transform);
      if (!match) throw new TypeError('Nebula delivery requires prepared PolyCSS matrices.');
      const matrix = match[1]!.split(',').map(Number);
      if (matrix.length !== 16 || !matrix.every(Number.isFinite)) throw new TypeError('Invalid prepared nebula matrix.');
      for (const i of [1,5,9,13]) matrix[i] = -matrix[i]!;
      if (toward) for (const i of [2,6,10,14]) matrix[i] = -matrix[i]!;
      const b = leaf.boundsCssPixels;
      return { ...leaf, centerUnits: reflectNebulaPoint(leaf.centerUnits, volume.frame), texturePath: `${prefix}/${leaf.texturePath}`,
        ...(b ? { boundsCssPixels: { min: [b.min[0],-b.max[1],toward ? -b.max[2] : b.min[2]] as VolumeVector,
          max: [b.max[0],-b.min[1],toward ? -b.min[2] : b.max[2]] as VolumeVector } } : {}),
        style: { ...leaf.style, transform: `matrix3d(${matrix.join(',')})` } };
    }), stack.axis) })) };
}
