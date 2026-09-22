import {required} from '../../contract/test-values.mts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseObjShape} from './obj-shape.mts';
import {parseFacetCsv, parseFacetFits, createFacetScalarSampler, validateFacetScalarProfile} from './facet-scalars.mts';

const mesh = parseObjShape(['v 1 0 0','v 1 3 0','v 1 0 3','v 5 0 0','v 5 3 0','v 5 0 3','f 1 2 3','f 4 5 6'].join('\n'),
  {metersPerUnit:1, expectedVertices:6, expectedFaces:2});
const profile = {field:'Slope', units:'degrees', expectedRows:2, maximumCentroidErrorMeters:.001};
const csv = 'X,Y,Z,Slope,Albedo\nkm,km,km,degrees,\n0.001,0.001,0.001,0,NaN\n0.005,0.001,0.001,30,1.4\n';

test('facet CSV validates the complete source face correspondence and preserves valid zero values', () => {
  const table = parseFacetCsv(csv, profile, mesh);
  assert.deepEqual([...table.values], [0,30]);
  assert.equal(table.report.maximumCentroidErrorMeters,0);
  assert.throws(() => parseFacetCsv(csv.replace('0.005,0.001','0.006,0.001'), profile, mesh), /does not match source geometry/);
  assert.throws(() => parseFacetCsv(csv.replace('degrees,','radians,'), profile, mesh), /units changed/);
  assert.throws(() => parseFacetCsv(csv.replace(',30,',',,30,'), profile, mesh), /Malformed/);
});

test('source support and nearest 3D facet are retained through a concave radial overlap', () => {
  const table = parseFacetCsv(csv, {...profile,validityField:'Albedo'}, mesh);
  const sampler = createFacetScalarSampler(mesh,table,{surfaceSampling:{maximumDistanceMeters:.2}});
  assert.equal(sampler.samplePoint([1,1,1]),null,'Unsupported front facet must remain missing');
  assert.equal(required(sampler.samplePoint([5.1,1,1])).value,30,'Rear facet must not receive front ray scalar');
  assert.equal(required(sampler.samplePoint([5.1,1,1])).sourceCell,1);
  assert.equal(sampler.samplePoint([5.5,1,1]),null,'Transfer distance is enforced');
  assert.equal(sampler.sample(0,0),null,'Multiple radial source sheets are withheld');
});

const header = (values: Record<string, string | number | boolean | undefined>) => {
  const cards = Object.entries(values).map(([key,value]) => (key.padEnd(8) + '= ' +
    (typeof value === 'boolean' ? value ? 'T' : 'F' : typeof value === 'string' ? "'" + value + "'" : String(value))).padEnd(80));
  cards.push('END'.padEnd(80));
  return Buffer.from(cards.join('').padEnd(Math.ceil(cards.length*80/2880)*2880,' '),'ascii');
};
function fitsFixture(reverseSource=false) {
  const source = parseObjShape('v 3 0 0\nv 0 3 0\nv 0 0 3\nv 7 0 0\nv 4 3 0\nv 4 0 3\n' + (reverseSource ? 'f 4 5 6\nf 1 2 3' : 'f 1 2 3\nf 4 5 6'),
    {metersPerUnit:1000,expectedVertices:6,expectedFaces:2});
  const names=['FACET_NUM','LATITUDE','LONGITUDE','RADIUS','SLOPE','SIGMA'];
  const units=[undefined,'DEGREES','DEGREES','KILOMETERS','DEGREES','DEGREES'];
  const primary=header({SIMPLE:true,BITPIX:8,NAXIS:0,TARGET:'FIXTURE',OBJ_FILE:'fixture.obj',PRODNAME:'fixture.fits'});
  const columns: Record<string, string | number | boolean | undefined>={XTENSION:'BINTABLE',BITPIX:8,NAXIS:2,NAXIS1:24,NAXIS2:2,PCOUNT:0,GCOUNT:1,TFIELDS:6};
  names.forEach((name,i) => {columns['TTYPE'+(i+1)]=name;columns['TFORM'+(i+1)]=i?'1E':'1J';if(units[i])columns['TUNIT'+(i+1)]=units[i];});
  const data=Buffer.alloc(2880);data.writeInt32BE(0);
  [Math.asin(1/Math.sqrt(3))*180/Math.PI,45,Math.sqrt(3),0,0].forEach((n,i) => data.writeFloatBE(n,(i+1)*4));
  data.writeInt32BE(1,24);
  [Math.asin(1/Math.sqrt(27))*180/Math.PI,Math.atan2(1,5)*180/Math.PI,Math.sqrt(27),30,2].forEach((n,i)=>data.writeFloatBE(n,24+(i+1)*4));
  const bytes=Buffer.concat([primary,header(columns),data]);
  const xml='<file_name>fixture.fits</file_name><comment>fixture.obj</comment><records>2</records><record_length unit="byte">24</record_length>'+
    names.map((name,i)=>'<Field_Binary><name>'+name+'</name><field_location unit="byte">'+(i*4+1)+
      '</field_location><field_length unit="byte">4</field_length><data_type>'+(i?'IEEE754MSBSingle':'SignedMSB4')+'</data_type></Field_Binary>').join('');
  return {source,bytes,xml,profile:{expectedRows:2,target:'FIXTURE',meshFile:'fixture.obj',field:'SLOPE',units:'DEGREES',maximumCentroidErrorMeters:.001}};
}

test('PDS FITS joins by explicit zero-based facet IDs, verifies label/geometry and retains sigma without treating it as coverage', () => {
  const f=fitsFixture(),table=parseFacetFits(f.bytes,f.xml,f.profile,f.source);
  assert.equal(table.values[0],0);
  assert.equal(table.sigmas[0],0);
  assert.equal(table.report.zeroSigmaRows,1);
  assert.ok(table.report.maximumCentroidErrorMeters<.001);
  const reordered=Buffer.from(f.bytes);reordered.writeInt32BE(1,5760);
  assert.throws(()=>parseFacetFits(reordered,f.xml,f.profile,f.source),/IDs changed/);
  assert.throws(()=>parseFacetFits(f.bytes,f.xml.replace('<name>SLOPE','<name>ALBEDO'),f.profile,f.source),/label differs/);
  assert.throws(()=>parseFacetFits(f.bytes,f.xml,{...f.profile,meshFile:'other.obj'},f.source),/identity/);
});

test('facet recipe binds its source mesh and transfer distance to the actual retained simplification', () => {
  const terrain={path:'shape/source.obj',grid:{expectedFaces:2},simplification:{method:'source-meshoptimizer',maximumErrorMeters:2}};
  const lens={meshPath:terrain.path,table:{...profile,format:'sbmt-csv-zip',member:'values.csv'},
    surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:2},sampling:'nearest'};
  assert.doesNotThrow(()=>validateFacetScalarProfile(lens,terrain));
  assert.throws(()=>validateFacetScalarProfile({...lens,meshPath:'other.obj'},terrain),/exact source mesh/);
  assert.throws(()=>validateFacetScalarProfile({...lens,surfaceSampling:{...lens.surfaceSampling,maximumDistanceMeters:3}},terrain),/bounded/);
});

test('explicit centroid bijection reconciles exporter order and retains the original scalar row index', () => {
  const f=fitsFixture(true);
  assert.throws(()=>parseFacetFits(f.bytes,f.xml,f.profile,f.source),/does not match source geometry/);
  const table=parseFacetFits(f.bytes,f.xml,{...f.profile,registration:'centroid-bijection'},f.source);
  assert.deepEqual([...table.values],[30,0]);
  assert.deepEqual([...table.sourceRows],[1,0]);
  assert.equal(table.report.remappedRows,2);
  const sampler=createFacetScalarSampler(f.source,table,{surfaceSampling:{maximumDistanceMeters:1}});
  assert.equal(required(sampler.samplePoint([5000,1000,1000])).sourceCell,1);
  const duplicate=Buffer.from(f.bytes);duplicate.copy(duplicate,5760+24+4,5760+4,5760+24);
  assert.throws(()=>parseFacetFits(duplicate,f.xml,{...f.profile,registration:'centroid-bijection'},f.source),/bijection/);
});

test('derived gzip facet tables retain their NaN gaps and exact mesh binding', async () => {
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{gzipSync}=await import('node:zlib');
  const {loadFacetScalarSurface}=await import('./facet-scalars.mts');
  const root=await mkdtemp(join(tmpdir(),'hrii-facets-'));
  try{
    await writeFile(join(root,'fields.csv.gz'),gzipSync(csv));
    const lens={sampling:'nearest',path:'fields.csv.gz',meshPath:'shape.obj',table:{...profile,format:'facet-csv-gzip',validityField:'Albedo'},surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:.2},minimum:0,maximum:30};
    const sampler=await loadFacetScalarSurface(root,lens,mesh);
    assert.equal(sampler.samplePoint([1,1,1]),null);
    assert.equal(required(sampler.samplePoint([5.1,1,1])).value,30);
    await writeFile(join(root,'fields.csv.gz'),gzipSync(csv.replace('0.005,0.001','0.006,0.001')));
    await assert.rejects(()=>loadFacetScalarSurface(root,lens,mesh),/does not match source geometry/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('facet tables explicitly reject column scaling and null sentinels', () => {
  for (const key of ['TSCAL5', 'TZERO5', 'TNULL1']) {
    const f = fitsFixture();
    const end = f.bytes.indexOf('END'.padEnd(80), 2880);
    f.bytes.write((key.padEnd(8) + '= 1').padEnd(80) + 'END'.padEnd(80), end, 'ascii');
    assert.throws(() => parseFacetFits(f.bytes, f.xml, f.profile, f.source), /scaling or null/);
  }
});
