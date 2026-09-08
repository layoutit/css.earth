import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const exec = promisify(execFile);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Read the released triangular surface in its body-fixed frame. Units are
 * authored explicitly; no ellipsoid or missing terrain is synthesized. */
export async function loadObjShape(path, profile) {
  const text = profile.member
    ? (await exec('unzip', ['-p', path, profile.member], { maxBuffer: 96 * 1024 * 1024 })).stdout
    : profile.compression === 'gzip' ? gunzipSync(await readFile(path)).toString('utf8') : await readFile(path, 'utf8');
  return parseObjShape(text, profile);
}

/** STL releases repeat vertices per facet. Weld exact source coordinates before
 * the common mesh simplifier; retain positions, winding and explicit units. */
export async function loadStlShape(path, profile) {
  const bytes = await readFile(path);
  return parseStlShape(profile.compression === 'gzip' ? gunzipSync(bytes) : bytes, profile);
}

export function parseStlShape(bytes, profile) {
  const data = Buffer.from(bytes), vertices = [], indices = [], ids = new Map();
  const addFace = points => {
    if (points.length !== 3 || points.some(v => v.length !== 3 || !v.every(Number.isFinite))) throw new Error('Invalid STL facet.');
    indices.push(points.map(v => {
      const key = v.join(',');
      if (!ids.has(key)) {
        ids.set(key, vertices.length);
        vertices.push(v.map(n => n * profile.metersPerUnit));
      }
      return ids.get(key);
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
export async function loadPdsVertexFacetShape(path, profile) {
  return parsePdsVertexFacetShape(await readFile(path, 'utf8'), profile);
}

/** PDS4 plate tables: counts on the first row, followed by unnumbered XYZ
 * vertices and explicitly indexed triangles. Keep the released topology and units. */
export async function loadPdsPlateShape(path, profile) {
  return parsePdsPlateShape(await readFile(path, 'utf8'), profile);
}

/** Rosetta's PDS VRML releases wrap one body-fixed triangular surface in viewer
 * material, lighting and scripts. Read only that untransformed IndexedFaceSet;
 * viewer code is never evaluated and does not define the scientific frame. */
export async function loadVrmlShape(path, profile) {
  return parseVrmlShape(await readFile(path, 'utf8'), profile);
}

export function parseVrmlShape(text, profile) {
  if (!/^#VRML V2\.0 utf8\s/.test(text)) throw new Error('Unsupported VRML shape header.');
  const source = text.replace(/#[^\r\n]*/g, '').trim();
  const mesh = /^Shape\s*\{\s*geometry\s+IndexedFaceSet\s*\{\s*coord\s+Coordinate\s*\{\s*point\s*\[([^\]]*)\]\s*\}\s*(?:solid\s+(?:TRUE|FALSE)\s*)?coordIndex\s*\[([^\]]*)\]\s*\}/.exec(source);
  if (!mesh || (source.match(/\bIndexedFaceSet\s*\{/g) ?? []).length !== 1) {
    throw new Error('Expected one untransformed VRML triangle surface.');
  }
  const tokens = value => value.trim().split(/[\s,]+/);
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

/** PDS longitude/latitude/radius tables preserve their authored origin. The
 * regular grid defines the connectivity; duplicated seam/pole rows are welded. */
export async function loadPdsRadiusTable(path, profile) {
  return parsePdsRadiusTable(await readFile(path, 'utf8'), profile);
}

export function parsePdsRadiusTable(text, profile) {
  const { stepDegrees: step, longitudeDirection } = profile;
  if (!(step > 0 && step <= 90) || 180 % step ||
      !['east-positive', 'west-positive'].includes(longitudeDirection)) throw new Error('Invalid radius table grid.');
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const nx = 360 / step, ny = 180 / step, radii = new Map();
  if (rows.length !== (nx + 1) * (ny + 1)) throw new Error('Radius table dimensions changed.');
  for (const row of rows) {
    const [lon, lat, radius] = row;
    if (row.length !== 3 || !row.every(Number.isFinite) || !(radius > 0) ||
        lon < 0 || lon > 360 || lat < -90 || lat > 90 || lon % step || (lat + 90) % step) throw new Error('Invalid radius table row.');
    const key = `${lon},${lat}`;
    if (radii.has(key)) throw new Error('Duplicate radius table row.');
    radii.set(key, radius);
  }
  const positions = [], indices = [], ids = new Map();
  const at = (x, y) => {
    const lon = x * step, lat = -90 + y * step;
    const key = Math.abs(lat) === 90 ? `pole,${lat}` : `${x % nx},${y}`;
    const radius = radii.get(`${lon},${lat}`), prior = ids.get(key);
    if (prior !== undefined) {
      if (Math.abs(Math.hypot(...positions[prior]) / profile.metersPerUnit - radius) > 1e-6) throw new Error('Inconsistent radius table seam or pole.');
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

export function parsePdsPlateShape(text, profile) {
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const [vertices, faces] = rows.shift();
  if (![0,1].includes(profile.indexBase) || vertices !== profile.expectedVertices || faces !== profile.expectedFaces || rows.length !== vertices + faces ||
      rows.some(row => row.length !== 3 || row.some(n => !Number.isFinite(n)))) throw new Error('PDS plate dimensions or rows changed.');
  return radialShape(rows.slice(0, vertices).map(v => v.map(n => n * profile.metersPerUnit)),
    rows.slice(vertices).map(f => f.map(n => n - profile.indexBase)), profile);
}

export function parsePdsVertexFacetShape(text, profile) {
  const rows = text.trim().split(/\r?\n/).map(row => row.trim().split(/\s+/).map(Number));
  const vertexCount = rows[0]?.[0], combinedHeader = rows[0]?.length === 2;
  const faceOffset = vertexCount + (combinedHeader ? 1 : 2);
  if (vertexCount !== profile.expectedVertices ||
      (combinedHeader ? rows[0][1] : rows[faceOffset - 1]?.[0]) !== profile.expectedFaces ||
      rows.length !== faceOffset + profile.expectedFaces) throw new Error('PDS shape dimensions changed.');
  const table = (start, count, columns) => rows.slice(start, start + count).map((row, i) => {
    if (row.length !== columns || row[0] !== i + 1 || row.some(n => !Number.isFinite(n))) throw new Error('Invalid PDS shape row.');
    return row.slice(1);
  });
  const vertices = table(1, vertexCount, 4).map(v => v.map(n => n * profile.metersPerUnit));
  const indices = table(faceOffset, profile.expectedFaces, 4).map(f => f.map(n => n - 1));
  return radialShape(vertices, indices, profile);
}

/** Sample a bounded scientific grid from the source mesh. A facet-support
 * column can withhold regions whose detailed SPC solution is absent. */
export async function loadShapeScalarGrid(root, lens) {
  const load = lens.format === 'stl' ? loadStlShape : lens.format === 'pds-radius-table' ? loadPdsRadiusTable : lens.format === 'vrml-mesh' ? loadVrmlShape : lens.format === 'pds-plate-model' ? loadPdsPlateShape : lens.format === 'pds-vertex-facet' ? loadPdsVertexFacetShape : loadObjShape;
  const mesh = await load(resolve(root, lens.path), lens.grid);
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
    const h=mesh.hit(x/(width-1)*360,90-y/(height-1)*180);
    if(h && (!validity || validity[h.faceId])) data[y*width+x]=h.radius;
  }
  return {sample(longitude,latitude){
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

export function parseObjShape(text, { metersPerUnit, expectedVertices, expectedFaces }) {
  if (!(metersPerUnit > 0)) throw new TypeError('Shape units must be explicit.');
  const vertices = [], indices = [];
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

function radialShape(vertices, indices, { metersPerUnit, expectedVertices, expectedFaces }) {
  if (!(metersPerUnit > 0)) throw new TypeError('Shape units must be explicit.');
  if (vertices.length !== expectedVertices || indices.length !== expectedFaces) throw new Error('OBJ shape dimensions changed.');
  const faces = indices.map((f, id) => {
    if (f.some(i => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw new Error('Shape face references an absent vertex.');
    const [a,b,c] = f.map(i => vertices[i]), ab = sub(b,a), ac = sub(c,a);
    if (!(Math.hypot(...cross(ab,ac)) > 0)) throw new Error('Degenerate source shape face.');
    return { id, a, ab, ac, min: a.map((v,i) => Math.min(v,b[i],c[i])), max: a.map((v,i) => Math.max(v,b[i],c[i])) };
  });
  function build(items) {
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for (const f of items) for (let i=0;i<3;i++) { min[i]=Math.min(min[i],f.min[i]); max[i]=Math.max(max[i],f.max[i]); }
    if (items.length <= 12) return {min,max,items};
    const extent = max.map((n,i) => n-min[i]), axis = extent.indexOf(Math.max(...extent));
    items.sort((a,b) => a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const half = Math.floor(items.length/2);
    return {min,max,left:build(items.slice(0,half)),right:build(items.slice(half))};
  }
  const root = build(faces);
  function intersect(origin, d, maximumDistance = Infinity) {
    let nearest=maximumDistance, faceId=-1;
    function visit(n) {
      let lo=0,hi=nearest;
      for (let i=0;i<3;i++) {
        if (Math.abs(d[i])<1e-15) { if(n.min[i]>origin[i]||n.max[i]<origin[i])return; continue; }
        const a=(n.min[i]-origin[i])/d[i],b=(n.max[i]-origin[i])/d[i]; lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
        if(lo>hi)return;
      }
      if (!n.items) {visit(n.left);visit(n.right);return;}
      for (const f of n.items) {
        const h=cross(d,f.ac),det=dot(f.ab,h);
        if(Math.abs(det)<1e-12)continue;
        const s=sub(origin,f.a),u=dot(s,h)/det;
        if(u < -1e-9 || u > 1+1e-9)continue;
        const q=cross(s,f.ab),v=dot(d,q)/det;
        if(v < -1e-9 || u+v > 1+1e-9)continue;
        const t=dot(f.ac,q)/det;
        if(t>0&&t<nearest){nearest=t;faceId=f.id;}
      }
    }
    visit(root);
    return faceId<0?null:{radius:nearest,faceId};
  }
  function hit(longitude, latitude) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude)>90) return null;
    const lon=longitude*Math.PI/180, lat=latitude*Math.PI/180;
    return intersect([0,0,0],[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]);
  }
  return { vertices: vertices.length, faces: faces.length, positions: vertices, indices, bounds:[root.min,root.max], hit, intersect,
    sample(longitude,latitude) {return hit(longitude,latitude)?.radius??null;} };
}
