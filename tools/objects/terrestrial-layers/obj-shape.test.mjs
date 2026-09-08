import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseObjShape } from './obj-shape.mjs';

// An octahedron has analytic radial intersections, including vertices and edges.
const octahedron = 'v 2 0 0\nv -2 0 0\nv 0 3 0\nv 0 -3 0\nv 0 0 4\nv 0 0 -4\n'+
  'f 1 3 5\nf 3 2 5\nf 2 4 5\nf 4 1 5\nf 3 1 6\nf 2 3 6\nf 4 2 6\nf 1 4 6\n';
const profile = {metersPerUnit:1000,expectedVertices:6,expectedFaces:8};
test('sourced radial intersections preserve units, seam and polar shape',()=>{
  const mesh=parseObjShape(octahedron,profile);
  for(const [lon,lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30],[359.9,-67],[-.1,-67]]){
    const l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1000/(Math.abs(Math.cos(p)*Math.cos(l))/2+Math.abs(Math.cos(p)*Math.sin(l))/3+Math.abs(Math.sin(p))/4);
    assert.ok(Math.abs(mesh.sample(lon,lat)-expected)<1e-8);
  }
  assert.equal(mesh.sample(0,91),null);
});
test('source layout mismatches fail instead of inventing a shape',()=>{
  assert.throws(()=>parseObjShape(octahedron,{...profile,expectedFaces:7}),/dimensions/);
  assert.throws(()=>parseObjShape(octahedron.replace('f 1 3 5','f 1 3 99'),profile),/absent/);
});

test('PDS vertex-facet rows reproduce analytic octahedron intersections', async () => {
  const { parsePdsVertexFacetShape } = await import('./obj-shape.mjs');
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
    assert.ok(Math.abs(mesh.sample(lon,lat)-expected)<1e-8);
    assert.equal(combinedMesh.sample(lon,lat), mesh.sample(lon,lat));
  }
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 2 0 0','2 2 0 0'),profile),/row/);
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 1 3 5','1 1 3 99'),profile),/absent/);
  assert.throws(()=>parsePdsVertexFacetShape(text,{...profile,metersPerUnit:0}),/units/);
});

test('radius tables retain west longitude, asymmetric radii and closed poles', async () => {
  const {parsePdsRadiusTable}=await import('./obj-shape.mjs');
  const rows=[];
  for(let lon=0;lon<=360;lon+=90)for(const lat of [-90,0,90])rows.push([lon,lat,lat===0?({0:2,90:3,180:4,270:5,360:2}[lon]):6].join(' '));
  const p={metersPerUnit:1000,stepDegrees:90,longitudeDirection:'west-positive',expectedVertices:6,expectedFaces:8};
  const mesh=parsePdsRadiusTable(rows.join('\n'),p);
  for(const [lon,lat,expected] of [[0,0,2000],[90,0,5000],[180,0,4000],[270,0,3000],[0,90,6000],[0,-90,6000]])assert.ok(Math.abs(mesh.sample(lon,lat)-expected)<1e-8);
  const edges=new Map();
  for(const f of mesh.indices)for(let i=0;i<3;i++) {const a=f[i],b=f[(i+1)%3],k=[a,b].sort((a,b)=>a-b).join(',');edges.set(k,[...(edges.get(k)??[]),a<b?1:-1]);}
  assert.ok([...edges.values()].every(e=>e.length===2&&e[0]+e[1]===0));
  assert.throws(()=>parsePdsRadiusTable(rows.slice(1).join('\n'),p),/dimensions/);
  assert.throws(()=>parsePdsRadiusTable(rows.join('\n').replace('360 0 2','360 0 3'),p),/seam or pole/);
});

test('ASCII and binary STL preserve the same physical mesh and reject malformed facets', async () => {
  const { parseStlShape } = await import('./obj-shape.mjs');
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
      assert.ok(Math.abs(mesh.sample(lon, lat) - expected) < 1e-8);
    }
  }
  assert.throws(() => parseStlShape(binary.subarray(0, binary.length - 1), profile), /STL|dimensions/);
  assert.throws(() => parseStlShape(Buffer.from(ascii.replace('vertex 2 0 0', 'vertex NaN 0 0')), profile), /facet/);
  assert.throws(() => parseStlShape(Buffer.from(ascii.replace('vertex 2 0 0\n', '')), profile), /facet/);
  assert.throws(() => parseStlShape(binary, {...profile, expectedFaces: 7}), /dimensions/);
  assert.throws(() => parseStlShape(binary, {...profile, metersPerUnit: 0}), /units/);
});
