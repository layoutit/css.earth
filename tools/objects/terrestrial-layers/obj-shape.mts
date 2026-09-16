import { isArray } from '../../../src/platform/is-array.mts';
import type {SourceMesh,SourceFace,FaceTree,ClosestSurfacePoint,MeshDimensions} from './contracts.mts';
import {parseMeshProfile,parseRadiusProfile,parsePlateProfile,parseShapeLens,parseSurfaceLens} from './source-records.mts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const exec = promisify(execFile);
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const cross = (a: readonly number[], b: readonly number[]) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Read the released triangular surface in its body-fixed frame. Units are
 * authored explicitly; no ellipsoid or missing terrain is synthesized. */
export async function loadObjShape(path: string, value: unknown) {
  const profile=parseMeshProfile(value);
  const text = profile.member
    ? (await exec('unzip', ['-p', path, profile.member], { maxBuffer: 96 * 1024 * 1024 })).stdout
    : profile.compression === 'gzip' ? gunzipSync(await readFile(path)).toString('utf8') : await readFile(path, 'utf8');
  return parseObjShape(text, profile);
}

/** STL releases repeat vertices per facet. Weld exact source coordinates before
 * the common mesh simplifier; retain positions, winding and explicit units. */
export async function loadStlShape(path: string, value: unknown) {
  const profile=parseMeshProfile(value);
  const bytes = await readFile(path);
  return parseStlShape(profile.compression === 'gzip' ? gunzipSync(bytes) : bytes, profile);
}

export function parseStlShape(bytes: Uint8Array, value: unknown) {
  const profile=parseMeshProfile(value);
  const data = Buffer.from(bytes), vertices: number[][] = [], indices: number[][] = [], ids = new Map<string,number>();
  const addFace = (points: number[][]) => {
    if (points.length !== 3 || points.some(v => v.length !== 3 || !v.every(Number.isFinite))) throw new Error('Invalid STL facet.');
    indices.push(points.map(v => {
      const key = v.join(',');
      if (!ids.has(key)) {
        ids.set(key, vertices.length);
        vertices.push(v.map(n => n * profile.metersPerUnit));
      }
      return ids.get(key)!;
    }));
  };
  if (data.length >= 84 && data.length === 84 + data.readUInt32LE(80) * 50) {
    for (let offset = 84; offset < data.length; offset += 50) {
      addFace([0,1,2].map(i => [0,1,2].map(j => data.readFloatLE(offset + 12 + i * 12 + j * 4))));
    }
  } else {
    const text = data.toString('utf8');
    if (!/^\s*solid\b/.test(text) || !/endsolid\b/.test(text)) throw new Error('Invalid STL document.');
    for (const facet of text.matchAll(/facet\s+normal\b[\s\S]*?endfacet/g)) {
      addFace(Array.from(facet[0].matchAll(/\bvertex\s+([^\r\n]+)/g), m => m[1].trim().split(/\s+/).map(Number)));
    }
  }
  return radialShape(vertices, indices, profile);
}

/** PDS vertex-facet tables retain their explicit row ids and kilometre units. */
export async function loadPdsVertexFacetShape(path: string, profile: unknown) {
  return parsePdsVertexFacetShape(await readFile(path, 'utf8'), profile);
}

/** PDS plate tables: counts on the first row, followed by unnumbered XYZ
 * vertices and explicitly indexed triangles. Keep the released topology and units. */
export async function loadPdsPlateShape(path: string, profile: unknown) {
  return parsePdsPlateShape(await readFile(path, 'utf8'), profile);
}

/** Rosetta's PDS VRML releases wrap one body-fixed triangular surface in viewer
 * material, lighting and scripts. Read only that untransformed IndexedFaceSet;
 * viewer code is never evaluated and does not define the scientific frame. */
export async function loadVrmlShape(path: string, profile: unknown) {
  return parseVrmlShape(await readFile(path, 'utf8'), profile);
}

export function parseVrmlShape(text: string, value: unknown) {
  const profile=parseMeshProfile(value);
  if (!/^#VRML V2\.0 utf8\s/.test(text)) throw new Error('Unsupported VRML shape header.');
  const source = text.replace(/#[^\r\n]*/g, '').trim();
  const mesh = /^Shape\s*\{\s*geometry\s+IndexedFaceSet\s*\{\s*coord\s+Coordinate\s*\{\s*point\s*\[([^\]]*)\]\s*\}\s*(?:solid\s+(?:TRUE|FALSE)\s*)?coordIndex\s*\[([^\]]*)\]\s*\}/.exec(source);
  if (!mesh || (source.match(/\bIndexedFaceSet\s*\{/g) ?? []).length !== 1) {
    throw new Error('Expected one untransformed VRML triangle surface.');
  }
  const tokens = (value: string) => value.trim().split(/[\s,]+/);
  const points = tokens(mesh[1]);
  if (points.length !== profile.expectedVertices * 3 || points.some(value =>
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) {
    throw new Error('VRML coordinate dimensions or values changed.');
  }
  const facets = tokens(mesh[2]);
  if (facets.length !== profile.expectedFaces * 4 || facets.some((value, index) =>
    index % 4 === 3 ? value !== '-1' : !/^\d+$/.test(value))) {
    throw new Error('VRML faces must be zero-based triangles terminated by -1.');
  }
  const vertices = Array.from({ length: profile.expectedVertices }, (_, i) =>
    points.slice(i * 3, i * 3 + 3).map(value => Number(value) * profile.metersPerUnit));
  const indices = Array.from({ length: profile.expectedFaces }, (_, i) =>
    facets.slice(i * 4, i * 4 + 3).map(Number));
  return radialShape(vertices, indices, profile);
}

/** Preserve the published comet plate model, including its confidence codes.
 * Weakly constrained regions are source estimates and are labelled in the
 * prepared constraint lens; the loader does not invent replacement geometry. */
export async function loadPdsPlanetocentricShape(path: string, profile: unknown) {
  return parsePdsPlanetocentricShape(await readFile(path, 'utf8'), profile);
}

export function parsePdsPlanetocentricShape(text: string, value: unknown) {
  const profile=parseMeshProfile(value);
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const header = rows.shift();
  if (!header) throw new Error("Missing PDS shape header");
  const [vertexCount, faceCount] = header;
  if (header.length !== 2 || vertexCount !== profile.expectedVertices || faceCount !== profile.expectedFaces ||
      rows.length !== vertexCount + faceCount || !(profile.metersPerUnit > 0) || !Number.isFinite(profile.metersPerUnit)) throw new Error('Invalid PDS comet shape dimensions or units.');
  const coordinates: number[][] = [], flags: number[] = [], counts: Record<number,number> = { 1: 0, 2: 0, 3: 0 };
  const positions = rows.slice(0, vertexCount).map(row => {
    const [latitude, longitude, radius, flag] = row;
    if (row.length !== 4 || !row.every(Number.isFinite) || Math.abs(latitude) > 90 ||
        longitude < 0 || longitude >= 360 || !(radius > 0) || ![1, 2, 3].includes(flag)) throw new Error('Invalid PDS shape vertex or constraint flag.');
    flags.push(flag); counts[flag]++; coordinates.push([latitude, longitude]);
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180, r = radius * profile.metersPerUnit;
    return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
  });
  const indices = rows.slice(vertexCount);
  if (indices.some(face => face.length !== 3 || face.some(i => !Number.isInteger(i) || i < 0 || i >= vertexCount))) throw new Error('Invalid PDS plate connectivity.');
  return { ...radialShape(positions, indices, profile), constraintFlags: flags, coordinates,
    coverage: { model: 'pds-vertex-constraint-flags', sourceVertices: vertexCount, sourceFaces: faceCount,
      vertexFlags: counts, interpretation: '1 stereo control; 2 limb silhouette; 3 not well constrained. The complete published model is retained.' } };
}

/** PDS longitude/latitude/radius tables preserve their authored origin. The
 * regular grid defines the connectivity; duplicated seam/pole rows are welded. */
export async function loadPdsRadiusTable(path: string, profile: unknown) {
  return parsePdsRadiusTable(await readFile(path, 'utf8'), profile);
}

export function parsePdsRadiusTable(text: string, value: unknown) {
  const profile=parseRadiusProfile(value);
  const { stepDegrees: step, longitudeDirection } = profile;
  if (!(step > 0 && step <= 90) || 180 % step ||
      !['east-positive', 'west-positive'].includes(longitudeDirection)) throw new Error('Invalid radius table grid.');
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const nx = 360 / step, ny = 180 / step, radii = new Map<string,number>();
  if (rows.length !== (nx + 1) * (ny + 1)) throw new Error('Radius table dimensions changed.');
  for (const row of rows) {
    const [lon, lat, radius] = row;
    if (row.length !== 3 || !row.every(Number.isFinite) || !(radius > 0) ||
        lon < 0 || lon > 360 || lat < -90 || lat > 90 || lon % step || (lat + 90) % step) throw new Error('Invalid radius table row.');
    const key = `${lon},${lat}`;
    if (radii.has(key)) throw new Error('Duplicate radius table row.');
    radii.set(key, radius);
  }
  const positions: number[][] = [], indices: number[][] = [], ids = new Map<string,number>();
  const at = (x: number, y: number) => {
    const lon = x * step, lat = -90 + y * step;
    const key = Math.abs(lat) === 90 ? `pole,${lat}` : `${x % nx},${y}`;
    const radius = radii.get(`${lon},${lat}`), prior = ids.get(key);
    if (radius === undefined) throw new Error("Missing radius table sample");
    if (prior !== undefined) {
      // Published decimal radii can differ by the last 1e-6 source unit.
      // Allow floating-point roundoff at that boundary, without widening the
      // source precision tolerance (1 mm for kilometre tables).
      const roundoff = 8 * Number.EPSILON * Math.max(1, radius);
      if (Math.abs(Math.hypot(...positions[prior]) / profile.metersPerUnit - radius) > 1e-6 + roundoff) throw new Error('Inconsistent radius table seam or pole.');
      return prior;
    }
    const l = lon * Math.PI / 180 * (longitudeDirection === 'west-positive' ? -1 : 1), p = lat * Math.PI / 180;
    const id = positions.length;
    positions.push([Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)].map(v => v * radius * profile.metersPerUnit));
    ids.set(key, id);
    return id;
  };
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
    const a = at(x,y), b = at(x+1,y), c = at(x+1,y+1), d = at(x,y+1);
    for (const f of [[a,b,c],[a,c,d]]) if (new Set(f).size === 3) {
      const [v,w,z] = f.map(i => positions[i]);
      if (dot(v,cross(sub(w,v),sub(z,v))) < 0) f.reverse();
      indices.push(f);
    }
  }
  return radialShape(positions, indices, profile);
}

export function parsePdsPlateShape(text: string, value: unknown) {
  const profile=parsePlateProfile(value);
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const header = rows.shift();
  if (!header) throw new Error("Missing PDS plate header");
  const [vertices, faces] = header;
  const flagged = profile.provenanceFlags === 'observed-ellipsoid';
  if (profile.provenanceFlags !== undefined && !flagged) throw new TypeError('Unknown PDS plate provenance flags.');
  if (header.length !== 2 || ![0,1].includes(profile.indexBase) || vertices !== profile.expectedVertices || faces !== profile.expectedFaces || rows.length !== vertices + faces ||
      rows.some(row => row.length !== (flagged ? 4 : 3) || row.some(n => !Number.isFinite(n)))) throw new Error('PDS plate dimensions or rows changed.');
  const mesh = radialShape(rows.slice(0, vertices).map(v => v.slice(0, 3).map(n => n * profile.metersPerUnit)),
    rows.slice(vertices).map(f => f.slice(0, 3).map(n => n - profile.indexBase)), profile);
  if (!flagged) return mesh;
  const vertexProvenance = rows.slice(0, vertices).map(row => row[3]);
  const faceProvenance = rows.slice(vertices).map(row => row[3]);
  if (vertexProvenance.some(flag => ![0, 1].includes(flag)) || faceProvenance.some((flag, i) => {
    const flags = mesh.indices[i].map(index => vertexProvenance[index]);
    return flag !== (flags.every(n => n === 0) ? 0 : flags.every(n => n === 1) ? 1 : 2);
  })) throw new Error('PDS plate provenance disagrees with its vertex flags.');
  const count = (values: readonly number[], flag: number) => values.filter(value => value === flag).length;
  return { ...mesh, vertexProvenance, faceProvenance, coverage: {
    model: 'pds-observed-ellipsoid-flags', sourceVertices: vertices, sourceFaces: faces,
    observedVertices: count(vertexProvenance, 0), ellipsoidVertices: count(vertexProvenance, 1),
    observedFaces: count(faceProvenance, 0), ellipsoidFaces: count(faceProvenance, 1), connectingFaces: count(faceProvenance, 2),
  } };
}

export function parsePdsVertexFacetShape(text: string, value: unknown) {
  const profile=parseMeshProfile(value);
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const vertexCount = rows[0]?.[0], combinedHeader = rows[0]?.length === 2;
  const faceOffset = vertexCount + (combinedHeader ? 1 : 2);
  if (vertexCount !== profile.expectedVertices ||
      (combinedHeader ? rows[0][1] : rows[faceOffset - 1]?.[0]) !== profile.expectedFaces ||
      rows.length !== faceOffset + profile.expectedFaces) throw new Error('PDS shape dimensions changed.');
  const table = (start: number, count: number, columns: number) => rows.slice(start, start + count).map((row, i) => {
    if (row.length !== columns || row[0] !== i + 1 || row.some(n => !Number.isFinite(n))) throw new Error('Invalid PDS shape row.');
    return row.slice(1);
  });
  const vertices = table(1, vertexCount, 4).map(v => v.map(n => n * profile.metersPerUnit));
  const indices = table(faceOffset, profile.expectedFaces, 4).map(f => f.map(n => n - 1));
  return radialShape(vertices, indices, profile);
}

/** Sample a bounded scientific grid from the source mesh. A facet-support
 * column can withhold regions whose detailed SPC solution is absent. */
export async function loadShapeScalarGrid(root: string, value: unknown, sourceMesh?: SourceMesh | null) {
  const lens=parseShapeLens(value);
  const load = lens.format === 'stl' ? loadStlShape : lens.format === 'pds-radius-table' ? loadPdsRadiusTable : lens.format === 'vrml-mesh' ? loadVrmlShape : lens.format === 'pds-plate-model' ? loadPdsPlateShape : lens.format === 'pds-vertex-facet' ? loadPdsVertexFacetShape : loadObjShape;
  const mesh = sourceMesh ?? await load(resolve(root, lens.path), lens.grid);
  const field = lens.facetField ? await (await import('./fits-facet-field.mts')).loadFitsFacetField(root, mesh, lens) : null;
  const { width = 721, height = 361 } = lens.sampleGrid ?? {};
  if (![width,height].every(n => Number.isInteger(n) && n >= 3 && n <= 4097)) throw new Error('Invalid shape sampling grid.');
  let validity;
  if (lens.coverage) {
    const {stdout} = await exec('unzip',['-p',resolve(root,lens.coverage.path),lens.coverage.member],{maxBuffer:128*1024*1024});
    const rows=stdout.trim().split(/\r?\n/),field=rows[0].split(',').indexOf(lens.coverage.field);
    if(field<0 || rows.length-2!==mesh.faces)throw new Error('Shape facet attributes differ from the pinned mesh.');
    validity=Uint8Array.from(rows.slice(2),row=>Number.isFinite(Number(row.split(',')[field]))?1:0);
  }
  const data=new Float64Array(width*height);data.fill(NaN);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    // A flat longitude/latitude map cannot identify more than one surface on
    // a center ray. Withhold ambiguous preview cells; the triangle atlas below
    // samples the actual source surface instead of painting this map on it.
    const h=mesh.hit(x/(width-1)*360,90-y/(height-1)*180, !!lens.surfaceSampling);
    if(h && (!validity || validity[h.faceId])) data[y*width+x]=field ? field.values[h.faceId] : h.radius;
  }
  return { ...(field ? { fieldReport: field.report } : {}),
    ...(lens.surfaceSampling ? createShapeSurfaceSampler(mesh, lens, validity, field?.values) : {}), sample(longitude: number,latitude: number){
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>90)return null;
    const x=((longitude%360+360)%360)/360*(width-1),y=(90-latitude)/180*(height-1);
    const x0=Math.floor(x),x1=Math.min(width-1,x0+1),y0=Math.floor(y),y1=Math.min(height-1,y0+1);
    const v=[data[y0*width+x0],data[y0*width+x1],data[y1*width+x0],data[y1*width+x1]];
    if(v.some(n=>!Number.isFinite(n)))return null;
    const u=x-x0,t=y-y0;
    const radius=(v[0]*(1-u)+v[1]*u)*(1-t)+(v[2]*(1-u)+v[3]*u)*t;
    return radius*(lens.valueTransform?.scale??1)+(lens.valueTransform?.offset??0);
  }};
}

/** Radius belongs to the full source surface point, not its longitude/latitude
 * ray. The distance bound is authored in metres alongside simplification. */
export function createShapeSurfaceSampler(mesh: SourceMesh, value: unknown, validity?: ArrayLike<number>, values?: ArrayLike<number>) {
  const lens=parseSurfaceLens(value);
  const policy = lens.surfaceSampling;
  if (policy?.method !== 'closest-source-point' || !(policy.maximumDistanceMeters > 0) ||
      !Number.isFinite(policy.maximumDistanceMeters) || typeof mesh.closestPoint !== 'function') {
    throw new TypeError('Source surface sampling requires a mesh and a finite distance bound.');
  }
  return { samplePoint(point: readonly number[]) {
    const hit = mesh.closestPoint(point, policy.maximumDistanceMeters);
    if (!hit || (validity && !validity[hit.faceId]) || (values && !Number.isFinite(values[hit.faceId]))) return null;
    return { ...hit, value: (values ? values[hit.faceId] : hit.radius) * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0) };
  } };
}

/** Barycentric weights (u on AB, v on AC) of the Euclidean projection of a point onto a triangle, including its boundary.
 * Scalar and allocation-free: the mesh search runs it for every candidate face. */
function projectionWeights(px: number, py: number, pz: number, a: readonly number[], ab: readonly number[], ac: readonly number[], weights: { u: number; v: number }) {
  const apx = px - a[0], apy = py - a[1], apz = pz - a[2];
  const d1 = ab[0] * apx + ab[1] * apy + ab[2] * apz, d2 = ac[0] * apx + ac[1] * apy + ac[2] * apz;
  let u = 0, v = 0;
  if (!(d1 <= 0 && d2 <= 0)) {
    const bpx = apx - ab[0], bpy = apy - ab[1], bpz = apz - ab[2];
    const d3 = ab[0] * bpx + ab[1] * bpy + ab[2] * bpz, d4 = ac[0] * bpx + ac[1] * bpy + ac[2] * bpz;
    if (d3 >= 0 && d4 <= d3) u = 1;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) u = d1 / (d1 - d3);
      else {
        const cpx = apx - ac[0], cpy = apy - ac[1], cpz = apz - ac[2];
        const d5 = ab[0] * cpx + ab[1] * cpy + ab[2] * cpz, d6 = ac[0] * cpx + ac[1] * cpy + ac[2] * cpz;
        if (d6 >= 0 && d5 <= d6) v = 1;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) v = d2 / (d2 - d6);
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 >= d3 && d5 >= d6) { v = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 1 - v; }
            else { const inverse = 1 / (va + vb + vc); u = vb * inverse; v = vc * inverse; }
          }
        }
      }
    }
  }
  weights.u = u; weights.v = v;
}

/** Euclidean projection onto a triangle, including its boundary. The returned
 * barycentric weights identify the source point independently of any ray. */
export function closestTrianglePoint(point: readonly number[], a: readonly number[], ab: readonly number[], ac: readonly number[]) {
  const weights = { u: 0, v: 0 };
  projectionWeights(point[0], point[1], point[2], a, ab, ac, weights);
  const { u, v } = weights;
  return { point: a.map((n, i) => n + u * ab[i] + v * ac[i]), barycentric: [1 - u - v, u, v] };
}

export function parseObjShape(text: string, value: unknown) {
  const {metersPerUnit,expectedVertices,expectedFaces}=parseMeshProfile(value);
  if (!(metersPerUnit > 0)) throw new TypeError('Shape units must be explicit.');
  const vertices: number[][] = [], indices: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const v = line.trim().split(/\s+/).slice(1).map(Number);
      if (v.length !== 3 || v.some(n => !Number.isFinite(n))) throw new Error('Invalid OBJ vertex.');
      vertices.push(v.map(n => n * metersPerUnit));
    } else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map(v => Number(v.split('/')[0]) - 1);
      if (f.length !== 3 || f.some(n => !Number.isInteger(n) || n < 0)) throw new Error('Expected triangular OBJ faces.');
      indices.push(f);
    }
  }
  return radialShape(vertices, indices, { metersPerUnit, expectedVertices, expectedFaces });
}

export { radialShape as createIndexedShape };

function radialShape(vertices: number[][], indices: number[][], { metersPerUnit, expectedVertices, expectedFaces }: MeshDimensions): SourceMesh {
  if (!(metersPerUnit > 0)) throw new TypeError('Shape units must be explicit.');
  if (vertices.length !== expectedVertices || indices.length !== expectedFaces) throw new Error('OBJ shape dimensions changed.');
  const faces = indices.map((f, id) => {
    if (f.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw new Error('Shape face references an absent vertex.');
    const [a,b,c] = f.map(i => vertices[i]), ab = sub(b,a), ac = sub(c,a);
    if (!(Math.hypot(...cross(ab,ac)) > 0)) throw new Error('Degenerate source shape face.');
    return { id, a, ab, ac, min: a.map((v,i) => Math.min(v,b[i],c[i])), max: a.map((v,i) => Math.max(v,b[i],c[i])) };
  });
  function build(items: SourceFace[]): FaceTree {
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for (const f of items) for (let i=0;i<3;i++) { min[i]=Math.min(min[i],f.min[i]); max[i]=Math.max(max[i],f.max[i]); }
    if (items.length <= 12) return {min,max,items};
    const extent = max.map((n,i) => n-min[i]), axis = extent.indexOf(Math.max(...extent));
    items.sort((a,b) => a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const half = Math.floor(items.length/2);
    return {min,max,left:build(items.slice(0,half)),right:build(items.slice(half))};
  }
  const root = build(faces);
  function intersect(origin: readonly number[], d: readonly number[], maximumDistance = Infinity, requireUnique = false) {
    let nearest=maximumDistance, faceId=-1;
    let farthest = 0;
    function visit(n: FaceTree) {
      let lo=0,hi=requireUnique ? maximumDistance : nearest;
      for (let i=0;i<3;i++) {
        if (Math.abs(d[i])<1e-15) { if(n.min[i]>origin[i]||n.max[i]<origin[i])return; continue; }
        const a=(n.min[i]-origin[i])/d[i],b=(n.max[i]-origin[i])/d[i]; lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
        if(lo>hi)return;
      }
      if (!n.items) {visit(n.left);visit(n.right);return;}
      for (const f of n.items) {
        // Scalar Möller–Trumbore in the order the vector helpers used; every candidate face of every ray passes here.
        const ab=f.ab, ac=f.ac, fa=f.a;
        const h0=d[1]*ac[2]-d[2]*ac[1], h1=d[2]*ac[0]-d[0]*ac[2], h2=d[0]*ac[1]-d[1]*ac[0], det=ab[0]*h0+ab[1]*h1+ab[2]*h2;
        if(Math.abs(det)<1e-12)continue;
        const s0=origin[0]-fa[0], s1=origin[1]-fa[1], s2=origin[2]-fa[2], u=(s0*h0+s1*h1+s2*h2)/det;
        if(u < -1e-9 || u > 1+1e-9)continue;
        const q0=s1*ab[2]-s2*ab[1], q1=s2*ab[0]-s0*ab[2], q2=s0*ab[1]-s1*ab[0], v=(d[0]*q0+d[1]*q1+d[2]*q2)/det;
        if(v < -1e-9 || u+v > 1+1e-9)continue;
        const t=(ac[0]*q0+ac[1]*q1+ac[2]*q2)/det;
        if (t > 0 && t < maximumDistance) {
          farthest = Math.max(farthest, t);
          if (t < nearest) { nearest = t; faceId = f.id; }
        }
      }
    }
    visit(root);
    return faceId<0 || (requireUnique && farthest - nearest > 1e-7) ? null : {radius:nearest,faceId};
  }
  function hit(longitude: number, latitude: number, requireUnique = false) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude)>90) return null;
    const lon=longitude*Math.PI/180, lat=latitude*Math.PI/180;
    return intersect([0,0,0],[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)], Infinity, requireUnique);
  }
  function closestPoint(point: readonly number[], maximumDistance = Infinity, requireUnique = true) {
    if (!isArray(point) || point.length !== 3 || !point.every(Number.isFinite) || !(maximumDistance > 0) || typeof requireUnique !== 'boolean') {
      throw new TypeError('Surface projection requires a finite point and positive distance bound.');
    }
    let distanceSquared = maximumDistance * maximumDistance, result: ClosestSurfacePoint | null = null, ambiguous = false;
    // Coincident hits at an edge identify the same point; equal-distance hits
    // on distinct surfaces do not establish a unique correspondence.
    const tieSquared = 1e-12;
    const [px, py, pz] = point, weights = { u: 0, v: 0 };
    const axisGap = (min: number, p: number, max: number) => Math.max(min - p, 0, p - max) ** 2;
    const boxDistance = (node: FaceTree) => 0 + axisGap(node.min[0], px, node.max[0]) + axisGap(node.min[1], py, node.max[1]) + axisGap(node.min[2], pz, node.max[2]);
    function visit(node: FaceTree) {
      if (boxDistance(node) > distanceSquared + tieSquared) return;
      if (!node.items) {
        const leftFirst = boxDistance(node.left) <= boxDistance(node.right);
        visit(leftFirst ? node.left : node.right); visit(leftFirst ? node.right : node.left); return;
      }
      for (const face of node.items) {
        // Scalar arithmetic in the order closestTrianglePoint uses, so results are bit-identical without allocating per face.
        projectionWeights(px, py, pz, face.a, face.ab, face.ac, weights);
        const { u, v } = weights, { a, ab, ac } = face;
        const qx = a[0] + u * ab[0] + v * ac[0], qy = a[1] + u * ab[1] + v * ac[1], qz = a[2] + u * ab[2] + v * ac[2];
        const dx = px - qx, dy = py - qy, dz = pz - qz, squared = dx * dx + dy * dy + dz * dz;
        if (squared > distanceSquared + tieSquared) continue;
        if (result && Math.abs(squared - distanceSquared) <= tieSquared) {
          const sx = result.point[0] - qx, sy = result.point[1] - qy, sz = result.point[2] - qz;
          if (sx * sx + sy * sy + sz * sz > tieSquared) ambiguous = true;
          continue;
        }
        const projected = { point: [qx, qy, qz], barycentric: [1 - u - v, u, v] };
        const normal = cross(face.ab, face.ac), length = Math.hypot(...normal);
        distanceSquared = squared; ambiguous = false;
        result = { ...projected, faceId: face.id, normal: normal.map(n => n / length),
          radius: Math.hypot(...projected.point), distanceMeters: Math.sqrt(squared) };
      }
    }
    visit(root);
    // A distance-only geometry audit may accept either equally near point.
    // Material transfer keeps the default unique correspondence requirement.
    return requireUnique && ambiguous ? null : result;
  }
  return { vertices: vertices.length, faces: faces.length, positions: vertices, indices, bounds:[root.min,root.max], hit, intersect,
    closestPoint,
    sample(longitude: number,latitude: number) {return hit(longitude,latitude)?.radius??null;} };
}
