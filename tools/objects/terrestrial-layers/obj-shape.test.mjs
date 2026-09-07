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
  for (const [lon,lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[0,-90],[45,30]]) {
    const l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1000/(Math.abs(Math.cos(p)*Math.cos(l))/2+Math.abs(Math.cos(p)*Math.sin(l))/3+Math.abs(Math.sin(p))/4);
    assert.ok(Math.abs(mesh.sample(lon,lat)-expected)<1e-8);
  }
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 2 0 0','2 2 0 0'),profile),/row/);
  assert.throws(()=>parsePdsVertexFacetShape(text.replace('1 1 3 5','1 1 3 99'),profile),/absent/);
  assert.throws(()=>parsePdsVertexFacetShape(text,{...profile,metersPerUnit:0}),/units/);
});
