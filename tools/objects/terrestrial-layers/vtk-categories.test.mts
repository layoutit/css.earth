import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeVtkCategories, loadVtkCategories, validateVtkCategories} from './vtk-categories.mts';
import {createIndexedShape} from './obj-shape.mts';
import {decodeSbmtLocations, decodeSbmtPaths} from './sbmt-symbols.mts';

const vtk = '# vtk DataFile Version 2.0\nfixture\nASCII\nDATASET POLYDATA\nPOINTS 6 float\n-1 -1 1\n1 -1 1\n0 1 1\n-1 -1 2\n1 -1 2\n0 1 2\nPOLYGONS 2 8\n3 0 1 2\n3 3 4 5\nCELL_DATA 2\nSCALARS Region integer 1\nLOOKUP_TABLE default\n0\n1\n';
const grid = {expectedVertices: 6, expectedFaces: 2, metersPerUnit: 1, field: 'Region'};
const lens = {format: 'vtk-cell-categories', path: 'regions.vtk', grid, categories: [{value:'a',label:'A',color:'#abcdef'},{value:'b',label:'B',color:'#123456'}],cellCategories:[0,1],sampling:'nearest',displaySampling:'nearest',
  surfaceSampling:{method:'closest-registered-surface',renderedMeshPath:'model.obj',maximumDistanceMeters:.1,maximumRegistrationDistanceMeters:.1}};

test('categorical VTK requires exact topology, units and complete integer cell data', () => {
  const decoded = decodeVtkCategories(vtk, grid);
  assert.deepEqual([...decoded.values], [0,1]); assert.deepEqual(decoded.positions[5], [0,1,2]);
  for (const broken of [vtk.replace('CELL_DATA 2','CELL_DATA 3'),vtk.replace('POLYGONS 2 8','POLYGONS 2 7'),vtk+' 3',vtk.replace('SCALARS Region','SCALARS Color'),vtk.replace('3 0 1 2','4 0 1 2')]) assert.throws(()=>decodeVtkCategories(broken,grid));
  assert.throws(()=>validateVtkCategories({...lens,cellCategories:[0,2]},{path:'model.obj',simplification:{maximumErrorMeters:.1}}));
});

test('3D categorical transfer distinguishes two sheets at the same radial direction and withholds gaps', async () => {
  const dir = await mkdtemp(join(tmpdir(),'vtk-categories-'));
  try {
    await writeFile(join(dir,'regions.vtk'),vtk);
    const data = decodeVtkCategories(vtk,grid), mesh = createIndexedShape(data.positions,data.indices,grid);
    const source = await loadVtkCategories(dir,lens,mesh);
    const lowerSheet = source.samplePoint([0,0,1.01]);
    const upperSheet = source.samplePoint([0,0,1.99]);
    assert.ok(lowerSheet);
    assert.ok(upperSheet);
    assert.equal(lowerSheet.value,0);
    assert.equal(upperSheet.value,1);
    assert.equal(source.sample(0,90),null,'flat preview must not choose one of two surface sheets');
    assert.equal(source.samplePoint([0,0,1.5]),null);
    const partial = await loadVtkCategories(dir,{...lens,cellCategories:[0,null]},mesh);
    assert.equal(partial.samplePoint([0,0,2]),null,'unmapped region stays missing');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('SBMT latitude, longitude and kilometre radius preserve the full 3D position', () => {
  const [path] = decodeSbmtPaths('<lines shapemodel="fixture"><path name="test" color="1,2,3" vertices="0 0 2 0 90 3"/></lines>', 'fixture');
  assert.deepEqual(path.points[0],[2000,0,0]); assert.ok(Math.abs(path.points[1][1]-3000)<1e-9);
  const row='1\tBoulder\t0\t0\t2\t90\t0\t2\tNA\tNA\tNA\tNA\t0.03\t1\t0\t255,0,255\tNA\t""';
  assert.deepEqual(decodeSbmtLocations(row)[0].point,[0,0,2000]);
  assert.throws(()=>decodeSbmtLocations(row.replace('\t90\t','\t0\t')),/disagree/);
  assert.throws(()=>decodeSbmtLocations(row.replace('\t90\t','\tNaN\t')),/Invalid SBMT spherical/);
});
