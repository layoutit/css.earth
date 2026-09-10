import {parseEllipsoidParameters,parseMeshProfile} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { parseObjShape } from './obj-shape.mts';

/** Preparation-only tessellation. The authored parameters specify a smooth
 * approximation; they never stand in for a recovered convex mesh or terrain. */
export function ellipsoidParameterMesh(value: unknown) {
  const model=parseEllipsoidParameters(value);
  if (model.schema !== 'cssearth-ellipsoid-parameters@1' ||
      model.scaleConvention !== 'thermal-radius-as-volume-equivalent' ||
      ![model.axisRatioAB, model.axisRatioBC, model.thermalRadiusKm].every(n => Number.isFinite(n) && n > 0) ||
      model.axisRatioAB < 1 || model.axisRatioBC < 1) throw new TypeError('Invalid published ellipsoid parameters.');
  const ratios = [model.axisRatioAB * model.axisRatioBC, model.axisRatioBC, 1];
  const scale = model.thermalRadiusKm * 1000 / Math.cbrt(ratios.reduce((a,b) => a*b, 1));
  const axesMeters = ratios.map(n => n * scale);
  const { unit, faces } = subdividedOctahedron(model.subdivisions);
  return { positions: unit.map(v => v.map((n,i) => n * axesMeters[i])), indices: faces, axesMeters };
}

export async function loadEllipsoidParameters(path: string, value: unknown) {
  const profile=parseMeshProfile(value);
  if (profile.metersPerUnit !== 1) throw new TypeError('Ellipsoid parameters produce metre coordinates.');
  const mesh = ellipsoidParameterMesh(JSON.parse(await readFile(path, 'utf8')));
  return parseObjShape([...mesh.positions.map(v => `v ${v.join(' ')}`),
    ...mesh.indices.map(f => `f ${f.map(i => i+1).join(' ')}`)].join('\n'), profile);
}

export function subdividedOctahedron(subdivisions: number) {
  if (!Number.isInteger(subdivisions) || subdivisions < 1 || subdivisions > 5) throw new TypeError('Invalid octahedron subdivision count.');
  let unit = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let faces = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for (let level = 0; level < subdivisions; level++) {
    const mids = new Map<string,number>();
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mids.has(key)) {
        const v = unit[a].map((n, i) => n + unit[b][i]), length = Math.hypot(...v);
        mids.set(key, unit.length); unit.push(v.map(n => n / length));
      }
      return mids.get(key)!;
    };
    faces = faces.flatMap(([a,b,c]) => {
      const ab = midpoint(a,b), bc = midpoint(b,c), ca = midpoint(c,a);
      return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
    });
  }
  return { unit, faces };
}
