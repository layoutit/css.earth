import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Preserve a model's authored UVs, including its triangular polar islands. */
export async function prepareGlbSurface(path, width, height) {
  const file = await readFile(path);
  if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2 || file.readUInt32LE(8) !== file.length) throw new TypeError('Expected a GLB 2 model.');
  const jsonSize = file.readUInt32LE(12), gltf = JSON.parse(file.subarray(20, 20 + jsonSize).toString());
  const binary = file.subarray(28 + jsonSize);
  if (gltf.meshes.length !== 1 || gltf.meshes[0].primitives.length !== 1 || gltf.nodes.length !== 1 ||
      ['matrix', 'translation', 'rotation', 'scale'].some(k => gltf.nodes[0][k])) throw new TypeError('Surface reprojection requires a single untransformed ellipsoid mesh.');
  const primitive = gltf.meshes[0].primitives[0];
  if ((primitive.mode ?? 4) !== 4) throw new TypeError('Surface model must contain triangles.');
  function accessor(index) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
    const bytes = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 0;
    if (!size || !bytes || a.sparse) throw new TypeError('Unsupported GLB accessor.');
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => {
      const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? size * bytes) + j * bytes;
      return bytes === 4 ? binary.readFloatLE(offset) : binary.readUInt16LE(offset);
    }));
  }
  const positions = accessor(primitive.attributes.POSITION), uv = accessor(primitive.attributes.TEXCOORD_0), indices = accessor(primitive.indices).flat();
  const axes = [0, 1, 2].map(i => Math.max(...positions.map(p => Math.abs(p[i]))));
  const points = positions.map(p => p.map((v, i) => v / axes[i]));
  if (points.some(p => Math.abs(Math.hypot(...p) - 1) > .001)) throw new TypeError('GLB surface must be an ellipsoid centered at its origin.');
  const texture = gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture;
  if ((texture.texCoord ?? 0) !== 0 || texture.extensions) throw new TypeError('Unsupported base-color UV transform.');
  const image = gltf.images[gltf.textures[texture.index].source], view = gltf.bufferViews[image.bufferView];
  const { data, info } = await sharp(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3), p = ids.map(id => points[id]);
    const e1 = sub(p[1], p[0]), e2 = sub(p[2], p[0]);
    triangles.push({ p: p[0], e1, e2, normal: cross(e1, e2), uv: ids.map(id => uv[id]) });
  }
  function intersect(d, t) {
    const h = cross(d, t.e2), det = dot(t.e1, h);
    if (Math.abs(det) < 1e-12) return null;
    const s = t.p.map(v => -v), u = dot(s, h) / det;
    const q = cross(s, t.e1), v = dot(d, q) / det, distance = dot(t.e2, q) / det;
    if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || distance <= 0) return null;
    return t.uv[0].map((value, i) => value * (1 - u - v) + t.uv[1][i] * u + t.uv[2][i] * v);
  }
  // Bucket triangles by latitude/longitude. Polar vertices have no longitude;
  // sample the bucket corners and center once, never search the full mesh per texel.
  const columns = 64, rows = 32, buckets = Array.from({ length: columns * rows }, () => new Set());
  const direction = (u, v) => { const lat = (.5 - v) * Math.PI, lon = u * 2 * Math.PI; return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const bucket = buckets[y * columns + x];
    for (const dy of [.00001, .5, .99999]) for (const dx of [.00001, .5, .99999]) {
      const d = direction((x + dx) / columns, (y + dy) / rows);
      for (let i = 0; i < triangles.length; i++) if (intersect(d, triangles[i])) bucket.add(i);
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
  return { pixels: output, sourceAxes: axes, sourceImage: { name: image.name, width: info.width, height: info.height }, sourceTriangles: triangles.length };
}
