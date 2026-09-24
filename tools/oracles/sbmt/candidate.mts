import { cross3 as cross } from '../../../src/platform/vector3.mts';
/** Test-side binding from archived camera fields to the repository's shared
 * projective camera. This module never imports native reference results. It
 * does not qualify a production mosaic or solve an unknown camera. */
import { project } from '../../objects/terrestrial-layers/osiris-geo.mts';
import type { Case } from './cases.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';

const norm = (v: number[]) => {
  const length = Math.hypot(...v);
  if (!(length > 1e-12) || !Number.isFinite(length)) throw new Error('Invalid camera direction');
  return v.map(n=>n/length);
};
export function readPointing(text: string, c: Pick<Case,'format'|'width'|'height'>) {
  let origin: number[], frustum: number[][];
  if (c.format === 'sum') {
    const rows = text.trim().split(/\r?\n/);
    function row(index: number, length: number) {
      const tokens = rows[index]?.trim().split(/\s+/).slice(0,length);
      if (!tokens || tokens.length !== length || tokens.some(t=>!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?$/.test(t))) throw new Error(`Invalid SUM row ${index+1}`);
      const numbers = tokens.map(t=>Number(t.replace(/[dD]/g,'E')));
      if (!numbers.every(Number.isFinite)) throw new Error('Non-finite SUM value');
      return numbers;
    }
    const [width,height] = row(2,4), [focal,cx,cy] = row(3,3), k = row(9,6), distortion = row(10,4);
    if (width !== c.width || height !== c.height) throw new Error('Pointing and image dimensions differ');
    if (!(focal>0) || k[0]<=0 || k[4]<=0 || k.some((v,i)=>i!==0&&i!==4&&v!==0) || distortion.some(v=>v!==0) ||
      cx !== (width+1)/2 || cy !== (height+1)/2) throw new Error('Unsupported SUM distortion, principal point or K matrix');
    origin = row(4,3).map(v=>-v);
    const x = row(5,3), y = row(6,3), z = row(7,3);
    if ([x,y,z].some(v=>Math.abs(Math.hypot(...v)-1)>1e-6) || Math.abs(dot(x,y))+Math.abs(dot(x,z))+Math.abs(dot(y,z))>1e-6)
      throw new Error('Invalid SUM camera basis');
    const sx = width/(2*focal*k[0]), sy = height/(2*focal*k[4]);
    frustum = [[-1,1],[1,1],[-1,-1],[1,-1]].map(([u,v])=>norm(z.map((n,i)=>n+u*sx*x[i]+v*sy*y[i])));
  } else {
    function field(name: string) {
      const matches = [...text.matchAll(new RegExp(`^\\s*(?:MSI_)?${name}\\s*=\\s*\\(([^)]+)\\)`, 'gm'))];
      if (matches.length !== 1) throw new Error(`Missing or duplicate INFO ${name}`);
      const values = matches[0][1].split(',').map(v=>Number(v.trim()));
      if (values.length!==3 || !values.every(Number.isFinite)) throw new Error(`Invalid INFO ${name}`);
      return values;
    }
    origin = field('SPACECRAFT_POSITION'); frustum = [1,2,3,4].map(i=>norm(field(`FRUSTUM${i}`)));
  }
  if (Math.hypot(...origin)<1e-9 || frustum.some(v=>Math.abs(Math.hypot(...v)-1)>1e-6)) throw new Error('Invalid pointing origin or corner rays');
  // Only a rectangular pinhole is qualified. Distortion and non-affine corner
  // calibrations must use their own established camera model and oracle.
  if (frustum[0].some((v,i)=>Math.abs(v+frustum[3][i]-frustum[1][i]-frustum[2][i])>1e-6)) throw new Error('Unsupported non-affine frustum');
  return { origin, frustum };
}
export function camera(origin: number[], rays: number[][], width: number, height: number) {
  if (width<2 || height<2 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error('Invalid image dimensions');
  const a=rays[1].map((v,i)=>v-rays[0][i]), b=rays[2].map((v,i)=>v-rays[0][i]), c=rays[0];
  const determinant=dot(a,cross(b,c));
  if (Math.abs(determinant)<1e-12) throw new Error('Degenerate camera');
  const inverse=[cross(b,c),cross(c,a),cross(a,b)].map(row=>row.map(v=>v/determinant));
  const matrix=inverse.map((row,i)=>{const scale=i===0?width-1:i===1?height-1:1;return [...row.map(v=>v*scale),-dot(row,origin)*scale];});
  return { matrix, project:(point:number[])=>project(matrix,point) };
}
