import { cross3 as cross } from '../../../src/platform/vector3.mts';
import {requireRecord,requireFiniteNumber} from '../../sources/source-values.mts';
import {shape,text,number,array,optional} from '../terrestrial-layers/source-records.mts';
const parseGltf=shape({meshes:array(shape({primitives:array(shape({mode:optional(number),attributes:shape({POSITION:number,TEXCOORD_0:number}),indices:number,material:number}))})),nodes:array(requireRecord),
  accessors:array(shape({bufferView:number,type:text,componentType:number,count:number,byteOffset:optional(number),sparse:optional(requireRecord)})),
  bufferViews:array(shape({byteOffset:optional(number),byteLength:number,byteStride:optional(number)})),
  materials:array(shape({pbrMetallicRoughness:shape({baseColorTexture:shape({index:number,texCoord:optional(number),extensions:optional(requireRecord)})})})),
  textures:array(shape({source:number})),images:array(shape({bufferView:number,name:optional(text)}))});
interface SurfaceTriangle {p:readonly number[];e1:readonly number[];e2:readonly number[];normal:readonly number[];uv:readonly (readonly number[])[];}
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const dot = (a:readonly number[], b:readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a:readonly number[], b:readonly number[]) => a.map((v, i) => v - b[i]);


/** Preserve a model's authored UVs, including its triangular polar islands. */
export async function prepareGlbSurface(path:string|URL, width:number, height:number) {
  const file = await readFile(path);
  if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2 || file.readUInt32LE(8) !== file.length) throw new TypeError('Expected a GLB 2 model.');
  const jsonSize = file.readUInt32LE(12), gltf = parseGltf(JSON.parse(file.subarray(20, 20 + jsonSize).toString()));
  const binary = file.subarray(28 + jsonSize);
  if (gltf.meshes.length !== 1 || gltf.meshes[0].primitives.length !== 1 || gltf.nodes.length !== 1 ||
      ['matrix', 'translation', 'rotation', 'scale'].some(k => gltf.nodes[0][k])) throw new TypeError('Surface reprojection requires a single untransformed surface mesh.');
  const primitive = gltf.meshes[0].primitives[0];
  if ((primitive.mode ?? 4) !== 4) throw new TypeError('Surface model must contain triangles.');
  function accessor(index:number) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    const size = new Map([['SCALAR',1],['VEC2',2],['VEC3',3]]).get(a.type);
    const bytes = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 0;
    if (!size || !bytes || a.sparse) throw new TypeError('Unsupported GLB accessor.');
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => {
      const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? size * bytes) + j * bytes;
      return bytes === 4 ? binary.readFloatLE(offset) : binary.readUInt16LE(offset);
    }));
  }
  const positions = accessor(primitive.attributes.POSITION), uv = accessor(primitive.attributes.TEXCOORD_0), indices = accessor(primitive.indices).flat();
  const axes = fitEllipsoidAxes(positions);
  const points = positions.map(p => p.map((v, i) => v / axes[i]));
  // Artist meshes can deviate slightly from a true ellipsoid. Keep their exact
  // triangles for UV intersections; the output shape comes from measured recipe
  // dimensions. Reject meshes outside this bounded radial approximation.
  const sourceRadialResidual = Math.max(...points.map(p => Math.abs(Math.hypot(...p) - 1)));
  if (sourceRadialResidual > .01) throw new TypeError('GLB surface must be centered and within 1% of an axis-aligned ellipsoid.');
  const texture = gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture;
  if ((texture.texCoord ?? 0) !== 0 || texture.extensions) throw new TypeError('Unsupported base-color UV transform.');
  const image = gltf.images[gltf.textures[texture.index].source], view = gltf.bufferViews[image.bufferView];
  const { data, info } = await sharp(binary.subarray(requireFiniteNumber(view.byteOffset), requireFiniteNumber(view.byteOffset) + view.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const triangles:SurfaceTriangle[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3), p = ids.map(id => points[id]);
    const e1 = sub(p[1], p[0]), e2 = sub(p[2], p[0]);
    triangles.push({ p: p[0], e1, e2, normal: cross(e1, e2), uv: ids.map(id => uv[id]) });
  }
  function intersect(d:readonly number[], t:SurfaceTriangle) {
    const h = cross(d, t.e2), det = dot(t.e1, h);
    if (Math.abs(det) < 1e-12) return null;
    const s = t.p.map(v => -v), u = dot(s, h) / det;
    const q = cross(s, t.e1), v = dot(d, q) / det, distance = dot(t.e2, q) / det;
    if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || distance <= 0) return null;
    return t.uv[0].map((value, i) => value * (1 - u - v) + t.uv[1][i] * u + t.uv[2][i] * v);
  }
  // A spherical cap enclosing a triangle also encloses its radial projection.
  // Conservatively cover that cap's latitude/longitude bounds, including poles
  // and the wrap seam. Sampling a few directions misses small source triangles.
  const columns = 64, rows = 32, buckets = Array.from({ length: columns * rows }, () => [] as number[]);
  const direction = (u:number, v:number) => { const lat = (.5 - v) * Math.PI, lon = u * 2 * Math.PI; return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; };
  const halfPi = Math.PI / 2, tau = Math.PI * 2, epsilon = 1e-7;
  const unit = (p:readonly number[]) => { const length = Math.hypot(...p); return p.map(value => value / length); };
  for (const [index, triangle] of triangles.entries()) {
    if (Math.hypot(...triangle.normal) < 1e-14) continue;
    const vertices = [triangle.p, triangle.p.map((v, i) => v + triangle.e1[i]), triangle.p.map((v, i) => v + triangle.e2[i])].map(unit);
    const center = unit([0, 1, 2].map(i => vertices.reduce((sum, vertex) => sum + vertex[i], 0)));
    const radius = Math.max(...vertices.map(vertex => Math.acos(Math.max(-1, Math.min(1, dot(center, vertex)))))) + epsilon;
    if (!Number.isFinite(radius) || radius >= halfPi) throw new TypeError('Surface triangles must fit within a hemisphere.');
    const latitude = Math.asin(Math.max(-1, Math.min(1, center[2]))), longitude = Math.atan2(center[1], center[0]);
    const north = Math.min(halfPi, latitude + radius), south = Math.max(-halfPi, latitude - radius);
    const firstRow = Math.max(0, Math.floor((.5 - north / Math.PI) * rows));
    const lastRow = Math.min(rows - 1, Math.floor((.5 - south / Math.PI) * rows));
    const longitudeRadius = north >= halfPi || south <= -halfPi
      ? Math.PI : Math.asin(Math.min(1, Math.sin(radius) / Math.cos(latitude))) + epsilon;
    for (let x = 0; x < columns; x++) {
      const bucketCenter = (x + .5) / columns * tau;
      const difference = Math.abs(Math.atan2(Math.sin(bucketCenter - longitude), Math.cos(bucketCenter - longitude)));
      if (difference > longitudeRadius + Math.PI / columns) continue;
      for (let y = firstRow; y <= lastRow; y++) buckets[y * columns + x].push(index);
    }
  }
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x + .5) / width, v = (y + .5) / height, d = direction(u, v);
    let texel;
    for (const index of buckets[Math.floor(v * rows) * columns + Math.floor(u * columns)]) {
      texel = intersect(d, triangles[index]); if (texel) break;
    }
    if (!texel) throw new TypeError(`Source model UV coverage is missing at ${x},${y}.`);
    const px = Math.max(0, Math.min(info.width - 1, texel[0] * info.width - .5));
    const py = Math.max(0, Math.min(info.height - 1, texel[1] * info.height - .5));
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(info.width - 1, x0 + 1), y1 = Math.min(info.height - 1, y0 + 1);
    for (let c = 0; c < 4; c++) output[(y * width + x) * 4 + c] = Math.round(
      (data[(y0 * info.width + x0) * 4 + c] * (1 - px + x0) + data[(y0 * info.width + x1) * 4 + c] * (px - x0)) * (1 - py + y0) +
      (data[(y1 * info.width + x0) * 4 + c] * (1 - px + x0) + data[(y1 * info.width + x1) * 4 + c] * (px - x0)) * (py - y0));
  }
  return { pixels: output, sourceAxes: axes, sourceRadialResidual, sourceImage: { name: image.name, width: info.width, height: info.height }, sourceTriangles: triangles.length };
}

/** Fit centered, axis-aligned ellipsoid radii from all vertices, not sampled extrema. */
function fitEllipsoidAxes(positions:readonly (readonly number[])[]) {
  const scales = [0, 1, 2].map(axis => positions.reduce((maximum, p) => Math.max(maximum, Math.abs(p[axis])), 0));
  if (scales.some(value => !Number.isFinite(value) || value <= 0)) throw new TypeError('Surface model has invalid dimensions.');
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (const p of positions) {
    const squared = p.map((value, axis) => (value / scales[axis]) ** 2);
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) matrix[row][column] += squared[row] * squared[column];
      matrix[row][3] += squared[row];
    }
  }
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 1e-10) throw new TypeError('Surface vertices do not constrain an ellipsoid.');
    for (let index = column; index < 4; index++) matrix[column][index] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let index = column; index < 4; index++) matrix[row][index] -= factor * matrix[column][index];
    }
  }
  const axes = scales.map((scale, axis) => scale / Math.sqrt(matrix[axis][3]));
  if (axes.some(value => !Number.isFinite(value) || value <= 0)) throw new TypeError('Surface model is not an axis-aligned ellipsoid.');
  return axes;
}
