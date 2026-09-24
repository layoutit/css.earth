import { parseTransform } from './source-records.mts';
import { shape, text, number, boolean, optional } from '@cssearth/core';
import type { SourceMesh, SurfaceHit, ClosestSurfacePoint } from './contracts.mts';
const parseUvSampler = shape({grid:shape({bitpix:number,width:number,height:number,flipV:boolean,noData:optional(number)}),sampling:text,surfaceSampling:shape({method:text,maximumDistanceMeters:number}),valueTransform:optional(parseTransform)});
const parseUvRecipe = shape({meshPath:text,labelPath:text,...{grid:shape({bitpix:number,width:number,height:number,flipV:boolean,noData:optional(number)}),sampling:text,surfaceSampling:shape({method:text,maximumDistanceMeters:number})},additionalGrids:optional(value=>value),relief:optional(value=>value)});
const parseUvTerrain = shape({path:text,format:text,simplification:shape({method:text,maximumErrorMeters:number})});
interface UvFits {bitpix:number;width:number;height:number;values:ArrayLike<number>;scale:number;zero:number}
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsPrimary } from '../observation/fits.mts';
import { closestTrianglePoint } from './obj-shape.mts';

const safePath = (path: unknown) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');

export function validateObjUvFits(value: unknown, geometry: unknown) {
  const lens = parseUvRecipe(value), terrain = parseUvTerrain(geometry);
  if (!safePath(lens.meshPath) || lens.meshPath !== terrain?.path || terrain.format !== 'wavefront-obj' ||
      terrain.simplification?.method !== 'source-meshoptimizer' || !safePath(lens.labelPath) ||
      lens.grid?.bitpix !== -32 || typeof lens.grid.flipV !== 'boolean' ||
      ![lens.grid.width, lens.grid.height].every(n => Number.isSafeInteger(n) && n > 0) ||
      !['nearest', 'bilinear'].includes(lens.sampling) || lens.surfaceSampling?.method !== 'closest-source-point' ||
      !(lens.surfaceSampling.maximumDistanceMeters > 0) ||
      lens.surfaceSampling.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      lens.additionalGrids || lens.relief || lens.grid.noData !== undefined && !Number.isFinite(lens.grid.noData)) {
    throw new TypeError('UV science requires its exact source mesh, released UVs, explicit FITS orientation and bounded surface transfer.');
  }
}

/** Keep the released per-corner texture indices, including UV seams. Geometry
 * identity is checked against the already loaded mesh; no UV projection is made. */
export function parseObjTextureCoordinates(text: string, mesh: Pick<SourceMesh,'indices'|'positions'>) {
  const uv: number[][] = [], faces: number[][] = []; let vertexCount = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) vertexCount++;
    else if (line.startsWith('vt ')) {
      const point = line.trim().split(/\s+/).slice(1).map(Number);
      if (point.length !== 2 || point.some(n => !Number.isFinite(n) || n < 0 || n > 1)) throw new Error('Invalid released OBJ texture coordinate.');
      uv.push(point);
    } else if (line.startsWith('f ')) {
      const corners = line.trim().split(/\s+/).slice(1).map(value => value.split('/').map(Number));
      const expected = mesh.indices[faces.length];
      if (corners.length !== 3 || corners.some((corner, i) => corner[0] - 1 !== expected?.[i] || !Number.isInteger(corner[1]) || corner[1] < 1)) {
        throw new Error('OBJ texture connectivity differs from its source shape.');
      }
      faces.push(corners.map(corner => corner[1] - 1));
    }
  }
  if (vertexCount !== mesh.positions.length || faces.length !== mesh.indices.length || !uv.length ||
      faces.some(face => face.some(index => index >= uv.length))) throw new Error('Incomplete source OBJ texture mapping.');
  return { uv, faces };
}

export function createObjUvFitsSampler(mesh: SourceMesh, mapping: ReturnType<typeof parseObjTextureCoordinates>, fits: UvFits, value: unknown) {
  const lens = parseUvSampler(value);
  if (fits.bitpix !== lens.grid.bitpix || fits.width !== lens.grid.width || fits.height !== lens.grid.height ||
      fits.scale !== 1 || fits.zero !== 0) throw new Error('Source UV FITS dimensions or scalar encoding changed.');
  const at = (x: number, y: number) => {
    const value = fits.values[y * fits.width + x];
    return Number.isFinite(value) && value !== lens.grid.noData ? value : null;
  };
  function valueAt<T extends SurfaceHit & {barycentric:readonly number[]},>(hit: T) {
    const corners = mapping.faces[hit.faceId];
    const [u, v] = [0, 1].map(axis => corners.reduce((sum, index, i) => sum + mapping.uv[index][axis] * hit.barycentric[i], 0));
    const x = Math.max(0, Math.min(fits.width - 1, u * fits.width - .5));
    const y = Math.max(0, Math.min(fits.height - 1, (lens.grid.flipV ? 1 - v : v) * fits.height - .5));
    let value;
    if (lens.sampling === 'bilinear') {
      const x0 = Math.floor(x), x1 = Math.min(x0 + 1, fits.width - 1), y0 = Math.floor(y), y1 = Math.min(y0 + 1, fits.height - 1);
      const four = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)];
      if (!four.every((value): value is number => value !== null)) return null;
      const dx = x - x0, dy = y - y0;
      value = four[0]*(1-dx)*(1-dy) + four[1]*dx*(1-dy) + four[2]*(1-dx)*dy + four[3]*dx*dy;
    } else value = at(Math.round(x), Math.round(y));
    return value === null ? null : { ...hit, value: value * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0),
      sourceCell: Math.round(y) * fits.width + Math.round(x), uv: [u, v] };
  }
  return {
    samplePoint(point: readonly number[]) {
      const hit = mesh.closestPoint(point, lens.surfaceSampling.maximumDistanceMeters);
      return hit ? valueAt(hit) : null;
    },
    sample(longitude: number, latitude: number) {
      const hit = mesh.hit(longitude, latitude, true);
      if (!hit) return null;
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
      const point = [Math.cos(lat)*Math.cos(lon), Math.cos(lat)*Math.sin(lon), Math.sin(lat)].map(n => n * hit.radius);
      const [a, b, c] = mesh.indices[hit.faceId].map(index => mesh.positions[index]);
      const projected = closestTrianglePoint(point, a, b.map((n,i) => n-a[i]), c.map((n,i) => n-a[i]));
      return valueAt({ ...hit, ...projected })?.value ?? null;
    },
  };
}

export async function loadObjUvFits(root: string, value: unknown, mesh?: SourceMesh | null) {
  const lens = {...parseUvRecipe(value),...parseUvSampler(value),...shape({path:text})(value)};
  if (!mesh?.closestPoint) throw new Error('Source UV science requires the full source mesh.');
  const [sourceText, bytes, label] = await Promise.all([readFile(resolve(root, lens.meshPath), 'utf8'), readFile(resolve(root, lens.path)), readFile(resolve(root, lens.labelPath), 'utf8')]);
  const fits = readFitsPrimary(bytes), mapping = parseObjTextureCoordinates(sourceText, mesh);
  if (!label.includes(lens.path.split('/').at(-1)!) || !label.includes('IEEE754MSBSingle')) throw new Error('PDS label does not identify the selected floating point source map.');
  return { ...createObjUvFitsSampler(mesh, mapping, fits, lens), report: {
    sourceFormat: 'obj-uv-fits', sourceMesh: lens.meshPath, sourceMap: lens.path,
    registration: 'Released OBJ per-corner UVs; barycentric transfer from the selected closest full-source triangle, bounded in metres. No radial reprojection.',
    sourceWidth: fits.width, sourceHeight: fits.height, uvCoordinates: mapping.uv.length,
    flipV: lens.grid.flipV, noData: lens.grid.noData ?? null,
    validity: 'Finite released values, with only explicitly authored no-data values withheld. This is not an observational coverage claim.',
  } };
}
