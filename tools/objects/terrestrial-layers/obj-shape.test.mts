import { required, fixtureRecord } from '../../contract/test-values.mts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseObjShape, parseVrmlShape, closestTrianglePoint, createShapeSurfaceSampler } from './obj-shape.mts';
import { parsePdsPlateShape } from './obj-shape.mts';

test('flagged PDS plates preserve observed, ellipsoid and joining provenance', () => {
  const table = '4 4\n1 0 0 0\n0 1 0 0\n0 0 1 0\n-1 -1 -1 1\n0 1 2 0\n0 3 1 2\n1 3 2 2\n2 3 0 2';
  const p = { metersPerUnit: 1000, indexBase: 0, expectedVertices: 4, expectedFaces: 4, provenanceFlags: 'observed-ellipsoid' };
  const mesh = parsePdsPlateShape(table, p);
  assert.deepEqual(mesh.positions[0], [1000, 0, 0]);
  assert.deepEqual(mesh.faceProvenance, [0, 2, 2, 2]);
  assert.ok('coverage' in mesh); assert.equal(fixtureRecord(mesh,'coverage').observedVertices, 3);
  const ellipsoid = table.replace('1 0 0 0', '1 0 0 1').replace('0 1 0 0', '0 1 0 1').replace('0 0 1 0', '0 0 1 1').replace(/(\d \d \d) [02]$/gm, '$1 1');
  assert.equal(fixtureRecord(parsePdsPlateShape(ellipsoid, p),'coverage').ellipsoidFaces, 4);
  assert.throws(() => parsePdsPlateShape(table.replace('0 1 2 0', '0 1 2 1'), p), /provenance/);
  assert.throws(() => parsePdsPlateShape(table.replace('-1 -1 -1 1', '-1 -1 -1 9'), p), /provenance/);
  assert.throws(() => parsePdsPlateShape(table, { ...p, provenanceFlags: undefined }), /rows changed/);
});

// An octahedron has analytic radial intersections, including vertices and edges.
const octahedron = 'v 2 0 0\nv -2 0 0\nv 0 3 0\nv 0 -3 0\nv 0 0 4\nv 0 0 -4\n'+
  'f 1 3 5\nf 3 2 5\nf 2 4 5\nf 4 1 5\nf 3 1 6\nf 2 3 6\nf 4 2 6\nf 1 4 6\n';
const profile = {metersPerUnit:1000,expectedVertices:6,expectedFaces:8};

test('closest source point preserves barycentric geometry, edges and physical distance bounds', () => {
  const mesh = parseObjShape(octahedron, profile);
  const a=[2000,0,0],ab=[-2000,3000,0],ac=[-2000,0,4000];
  const onFace=[1000,750,1000], n=[12,8,6].map(x=>x/Math.sqrt(244));
  const point=onFace.map((x,i)=>x+20*n[i]);
  const hit=mesh.closestPoint(point,21);
  required(hit).point.forEach((x,i)=>assert.ok(Math.abs(x-onFace[i])<1e-9));
  assert.ok(Math.abs(required(hit).distanceMeters-20)<1e-9);
  assert.deepEqual(closestTrianglePoint([2200,-100,0],a,ab,ac),{point:a,barycentric:[1,0,0]});
  assert.equal(mesh.closestPoint(point,19),null,'No projection beyond the declared physical allowance');
  const result=createShapeSurfaceSampler(mesh,{surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:21},valueTransform:{scale:.001,offset:-1}}).samplePoint(point);
  assert.ok(Math.abs(required(result).value-(Math.hypot(...onFace)/1000-1))<1e-12);
});

test('two surfaces on a ray keep different source heights, while a flat preview withholds ambiguity', () => {
  // Two closed cubes, one around the origin and another farther along +X.
  // Their shared longitude has three distinct positive intersections. A radial
  // sampler assigns x=1 to both bodies; closest 3D correspondence cannot do so.
  const vertices=[],faces=[];
  for(const center of [0,4]) {
    const offset=vertices.length;
    vertices.push(...[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>[x+center,y,z]));
    faces.push(...[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]].map(f=>f.map(i=>i+offset+1)));
  }
  const text=vertices.map(v=>'v '+v.join(' ')).concat(faces.map(f=>'f '+f.join(' '))).join('\n');
  const mesh=parseObjShape(text,{metersPerUnit:1,expectedVertices:16,expectedFaces:24});
  assert.equal(mesh.sample(0,0),1);
  assert.equal(mesh.hit(0,0,true),null);
  const sampler=createShapeSurfaceSampler(mesh,{surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:.2},valueTransform:{scale:1,offset:-1}});
  assert.equal(required(sampler.samplePoint([1.1,0,0])).value,0);
  assert.equal(required(sampler.samplePoint([4.9,0,0])).value,4);
  assert.equal(mesh.closestPoint([2,0,0],1.1),null,'Equidistant distinct source surfaces do not establish correspondence');
  assert.equal(required(mesh.closestPoint([2,0,0],1.1,false)).distanceMeters,1,'Distance-only audits can measure an ambiguous nearest surface');
  assert.ok(mesh.hit(180,0,true),'Coincident triangles at a source edge are one surface, not an ambiguity');
});
const vrmlOctahedron = `#VRML V2.0 utf8
Shape { geometry IndexedFaceSet { coord Coordinate { point [
  2e0 0 0, -2 0 0, 0 3 0, 0 -3 0, 0 0 4, 0 0 -4
] } solid FALSE coordIndex [
  0 2 4 -1, 2 1 4 -1, 1 3 4 -1, 3 0 4 -1,
  2 0 5 -1, 1 2 5 -1, 3 1 5 -1, 0 3 5 -1
] } appearance Appearance { material Material { diffuseColor 1 1 1 } } }
DEF example Script { url "javascript: throw new Error('viewer script must not run');" }
`;
test('Rosetta VRML triangle coordinates retain the analytic body frame and units', () => {
  const mesh = parseVrmlShape(vrmlOctahedron, profile);
  for (const [lon,lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30],[359.9,-67]]) {
    const l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1000/(Math.abs(Math.cos(p)*Math.cos(l))/2+Math.abs(Math.cos(p)*Math.sin(l))/3+Math.abs(Math.sin(p))/4);
    assert.ok(Math.abs(required(mesh.sample(lon,lat))-expected)<1e-8);
  }
});
test('VRML rejects transformed geometry, non-triangles, invalid indices and truncated source', () => {
  assert.throws(() => parseVrmlShape(vrmlOctahedron.replace('Shape {', 'Transform { children [ Shape {'),profile), /untransformed/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron.replace('0 2 4 -1','0 2 4 5 -1'),profile), /triangles/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron.replace('0 2 4 -1','0 2 99 -1'),profile), /absent/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron.replace('2e0','NaN'),profile), /coordinate/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron.replace('solid FALSE','ccw FALSE'),profile), /untransformed/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron,{...profile,expectedFaces:7}), /triangles/);
  assert.throws(() => parseVrmlShape(vrmlOctahedron,{...profile,metersPerUnit:0}), /units/);
});
test('sourced radial intersections preserve units, seam and polar shape',()=>{
  const mesh=parseObjShape(octahedron,profile);
  for(const [lon,lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30],[359.9,-67],[-.1,-67]]){
    const l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1000/(Math.abs(Math.cos(p)*Math.cos(l))/2+Math.abs(Math.cos(p)*Math.sin(l))/3+Math.abs(Math.sin(p))/4);
    assert.ok(Math.abs(required(mesh.sample(lon,lat))-expected)<1e-8);
  }
  assert.equal(mesh.sample(0,91),null);
});
test('source layout mismatches fail instead of inventing a shape',()=>{
  assert.throws(()=>parseObjShape(octahedron,{...profile,expectedFaces:7}),/dimensions/);
  assert.throws(()=>parseObjShape(octahedron.replace('f 1 3 5','f 1 3 99'),profile),/absent/);
});

test('PDS vertex-facet rows reproduce analytic octahedron intersections', async () => {
  const { parsePdsVertexFacetShape } = await import('./obj-shape.mts');
  const vertices = ['2 0 0','-2 0 0','0 3 0','0 -3 0','0 0 4','0 0 -4'];
  const faces = ['1 3 5','3 2 5','2 4 5','4 1 5','3 1 6','2 3 6','4 2 6','1 4 6'];
  const text = ['6',...vertices.map((v,i)=>`${i+1} ${v}`),'8',...faces.map((f,i)=>`${i+1} ${f}`)].join('\r\n');
  const mesh = parsePdsVertexFacetShape(text, profile);
  // Eros and Itokawa publish both counts in the first row; Phoebe separates them.
  const combined = ['6 8',...vertices.map((v,i)=>`${i+1} ${v}`),...faces.map((f,i)=>`${i+1} ${f}`)].join('\r\n');
  const combinedMesh = parsePdsVertexFacetShape(combined, profile);
  for (const [lon,lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30]]) {
    const l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1000/(Math.abs(Math.cos(p)*Math.cos(l))/2+Math.abs(Math.cos(p)*Math.sin(l))/3+Math.abs(Math.sin(p))/4);
    assert.ok(Math.abs(required(mesh.sample(lon,lat))-expected)<1e-8);
    assert.equal(combinedMesh.sample(lon,lat), mesh.sample(lon,lat));
  }
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 2 0 0','2 2 0 0'),profile),/row/);
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 1 3 5','1 1 3 99'),profile),/absent/);
  assert.throws(()=>parsePdsVertexFacetShape(text,{...profile,metersPerUnit:0}),/units/);
});

test('radius tables retain west longitude, asymmetric radii and closed poles', async () => {
  const {parsePdsRadiusTable}=await import('./obj-shape.mts');
  const rows: string[]=[];
  for(let lon=0;lon<=360;lon+=90)for(const lat of [-90,0,90])rows.push([lon,lat,lat===0?({0:2,90:3,180:4,270:5,360:2}[lon]):6].join(' '));
  const p={metersPerUnit:1000,stepDegrees:90,longitudeDirection:'west-positive',expectedVertices:6,expectedFaces:8};
  const mesh=parsePdsRadiusTable(rows.join('\n'),p);
  for(const [lon,lat,expected] of [[0,0,2000],[90,0,5000],[180,0,4000],[270,0,3000],[0,90,6000],[0,-90,6000]])assert.ok(Math.abs(required(mesh.sample(lon,lat))-expected)<1e-8);
  const edges=new Map();
  for(const f of mesh.indices)for(let i=0;i<3;i++) {const a=f[i],b=f[(i+1)%3],k=[a,b].sort((a,b)=>a-b).join(',');edges.set(k,[...(edges.get(k)??[]),a<b?1:-1]);}
  assert.ok([...edges.values()].every(e=>e.length===2&&e[0]+e[1]===0));
  assert.throws(()=>parsePdsRadiusTable(rows.slice(1).join('\n'),p),/dimensions/);
  assert.throws(()=>parsePdsRadiusTable(rows.join('\n').replace('360 0 2','360 0 3'),p),/seam or pole/);
  // Decimal subtraction slightly exceeds 1e-6 in binary floating point.
  const rounded = rows.join('\n').replace('360 0 2', '360 0 2.000001').replace('90 -90 6', '90 -90 6.000001');
  const welded = parsePdsRadiusTable(rounded, p);
  assert.deepEqual(welded.positions, mesh.positions);
  assert.throws(()=>parsePdsRadiusTable(rounded.replace('6.000001', '6.000002'),p),/seam or pole/);
});

test('ASCII and binary STL preserve the same physical mesh and reject malformed facets', async () => {
  const { parseStlShape } = await import('./obj-shape.mts');
  const vertices = [[2,0,0],[-2,0,0],[0,3,0],[0,-3,0],[0,0,4],[0,0,-4]];
  const triangles = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  const ascii = `solid octahedron\n${triangles.map(face =>
    `facet normal 0 0 0\nouter loop\n${face.map(i => `vertex ${vertices[i].join(' ')}`).join('\n')}\nendloop\nendfacet`
  ).join('\n')}\nendsolid octahedron\n`;
  const binary = Buffer.alloc(84 + triangles.length * 50);
  // Binary STL permits a header beginning with "solid"; length/count disambiguate it.
  binary.write('solid binary octahedron');
  binary.writeUInt32LE(triangles.length, 80);
  triangles.forEach((face, index) => face.forEach((vertex, corner) =>
    vertices[vertex].forEach((value, axis) => binary.writeFloatLE(value, 84 + index * 50 + 12 + corner * 12 + axis * 4))
  ));
  const [textMesh, binaryMesh] = [Buffer.from(ascii), binary].map(bytes => parseStlShape(bytes, profile));
  assert.deepEqual(binaryMesh.positions, textMesh.positions);
  assert.deepEqual(binaryMesh.indices, textMesh.indices);
  assert.deepEqual(textMesh.positions, [[2000,0,0],[0,3000,0],[0,0,4000],[-2000,0,0],[0,-3000,0],[0,0,-4000]]);
  for (const mesh of [textMesh, binaryMesh]) {
    for (const [lon, lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30]]) {
      const l = lon * Math.PI / 180, p = lat * Math.PI / 180;
      const expected = 1000 / (Math.abs(Math.cos(p)*Math.cos(l))/2 + Math.abs(Math.cos(p)*Math.sin(l))/3 + Math.abs(Math.sin(p))/4);
      assert.ok(Math.abs(required(mesh.sample(lon, lat)) - expected) < 1e-8);
    }
  }
  assert.throws(() => parseStlShape(binary.subarray(0, binary.length - 1), profile), /STL|dimensions/);
  assert.throws(() => parseStlShape(Buffer.from(ascii.replace('vertex 2 0 0', 'vertex NaN 0 0')), profile), /facet/);
  assert.throws(() => parseStlShape(Buffer.from(ascii.replace('vertex 2 0 0\n', '')), profile), /facet/);
  assert.throws(() => parseStlShape(binary, {...profile, expectedFaces: 7}), /dimensions/);
  assert.throws(() => parseStlShape(binary, {...profile, metersPerUnit: 0}), /units/);
});
