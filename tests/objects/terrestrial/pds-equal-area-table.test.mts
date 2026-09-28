import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceTest} from '../source-test.mts';
import {parsePdsEqualAreaTable,loadPdsEqualAreaTable,equalAreaPixel} from '@cssearth/bake/objects/raster';
const test=sourceTest();

// Four pixels in three bands, laid out as the Lunar Prospector GRS elemental-abundance tables are: fixed-width,
// space-separated, CR LF rows, bounds from the format file's START_BYTE and BYTES.
const names=['PIXEL_INDEX','MIN_LAT','MAX_LAT','MIN_LON','MAX_LON','W_TH','E[0,0]'];
const widths=[10,7,7,7,7,15,15];
let start=1;
const structure=names.map((name,i)=>{const s=start;start+=widths[i]!;return `  OBJECT = COLUMN
    COLUMN_NUMBER = ${i+1}
    NAME = "${name}"
    START_BYTE = ${s}
    BYTES = ${widths[i]}
    DESCRIPTION = "${name==='W_TH'?'Weight fraction Th, ppm':name}"
  END_OBJECT = COLUMN`;}).join('\n\n');
const rowBytes=start-1+2;
const label=`PDS_VERSION_ID = PDS3
DATA_SET_ID = "LP-L-GRS-5-ELEM-ABUNDANCE-V1.0"
PRODUCT_ID = "TEST_2DEG"
OBJECT = TABLE
  COLUMNS = 7
  INTERCHANGE_FORMAT = ASCII
  ROW_BYTES = ${rowBytes}
  ROWS = 4
  ^STRUCTURE = "TEST.FMT"
END_OBJECT = TABLE
END`;
const pixels=[[-90,-30,-180,180,1.5],[-30,30,-180,0,2.5],[-30,30,0,180,0],[30,90,-180,180,11.25]];
const row=(p:number[],i:number)=>[String(i).padStart(10),...p.slice(0,4).map(v=>v.toFixed(1).padStart(7)),
  ' '+p[4]!.toExponential(4).padStart(14),' '+(0.04).toExponential(4).padStart(14)].join('')+'\r\n';
const table=pixels.map(row).join('');
const policy={datasetId:'LP-L-GRS-5-ELEM-ABUNDANCE-V1.0',productId:'TEST_2DEG',column:'W_TH',columnDescription:'Weight fraction Th, ppm',errorColumn:'E[0,0]'};

test('equal-area table reads its columns at the format file bytes and tiles the sphere',()=>{
  const parsed=parsePdsEqualAreaTable(label,structure,'test.fmt',table,policy,'test');
  assert.deepEqual([...parsed.values],[1.5,2.5,0,11.25]);
  assert.equal(parsed.bands.length,3);
  assert.equal(equalAreaPixel(parsed.bands,-1,0),1);assert.equal(equalAreaPixel(parsed.bands,0,0),2);
  assert.equal(equalAreaPixel(parsed.bands,359,0),1);assert.equal(equalAreaPixel(parsed.bands,180,0),1);
  assert.equal(equalAreaPixel(parsed.bands,10,90),3);assert.equal(equalAreaPixel(parsed.bands,10,-90),0);
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,'test.fmt',table,{...policy,columnDescription:'Weight fraction Th, g/g'},'test'),/DESCRIPTION/);
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,'other.fmt',table,policy,'test'),/STRUCTURE/);
  assert.throws(()=>parsePdsEqualAreaTable(label.replace('TEST_2DEG','OTHER'),structure,'test.fmt',table,policy,'test'),/PRODUCT_ID/);
  const gap=[pixels[0],[-30,30,-180,-1,2.5],pixels[2],pixels[3]].map(row).join('');
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,'test.fmt',gap,policy,'test'),/starts at 0, expected -1/);
  const short=[pixels[0],pixels[1],pixels[2],[30,80,-180,180,1]].map(row).join('');
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,'test.fmt',short,policy,'test'),/not 90/);
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,'test.fmt',table.slice(0,-2),policy,'test'),/bytes/);
});

test('equal-area lens samples the containing pixel, scales units and reports the propagated uncertainty',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pds-equal-area-'));
  try{
    await writeFile(join(root,'t.lbl'),label);await writeFile(join(root,'test.fmt'),structure);await writeFile(join(root,'t.tab'),table);
    const lens={path:'t.tab',labelPath:'t.lbl',structurePath:'test.fmt',...policy,sampling:'nearest',valueTransform:{scale:2,offset:0}};
    const surface=await loadPdsEqualAreaTable(root,lens);
    assert.equal(surface.sample(-90,10),5);assert.equal(surface.sample(90,10),0);assert.equal(surface.sample(0,60),22.5);
    assert.equal(surface.sample(0,91),null);
    assert.equal(surface.report.medianSigma,0.4);assert.deepEqual(surface.report.valueRange,[0,22.5]);
    await assert.rejects(loadPdsEqualAreaTable(root,{...lens,structurePath:'../test.fmt'}),/escapes/);
    await assert.rejects(loadPdsEqualAreaTable(root,{...lens,sampling:'bilinear'}),/nearest/);
    await assert.rejects(loadPdsEqualAreaTable(root,{...lens,noData:0}),/noDataEvidence/);
  }finally{await rm(root,{recursive:true,force:true});}
});

// The Dawn GRaND Ceres maps (volume DWNCGRD_2) describe their columns inline, without COLUMN_NUMBER or ^STRUCTURE.
const inline=label.replace('  ^STRUCTURE = "TEST.FMT"\n','').replace('END_OBJECT = TABLE',structure.replace(/\n *COLUMN_NUMBER = \d+/g,'')+'\nEND_OBJECT = TABLE');

test('equal-area table reads COLUMN objects from its own label when the recipe names no format file',async()=>{
  const parsed=parsePdsEqualAreaTable(inline,'',null,table,policy,'test');
  assert.deepEqual([...parsed.values],[1.5,2.5,0,11.25]);
  assert.throws(()=>parsePdsEqualAreaTable(label,structure,null,table,policy,'test'),/inline columns/);
  assert.throws(()=>parsePdsEqualAreaTable(inline,structure,'test.fmt',table,policy,'test'),/STRUCTURE/);
  const root=await mkdtemp(join(tmpdir(),'pds-equal-area-inline-'));
  try{
    await writeFile(join(root,'t.lbl'),inline);await writeFile(join(root,'t.tab'),table);
    const surface=await loadPdsEqualAreaTable(root,{path:'t.tab',labelPath:'t.lbl',...policy,sampling:'nearest'});
    assert.equal(surface.sample(-90,10),2.5);assert.equal(surface.sample(0,60),11.25);
  }finally{await rm(root,{recursive:true,force:true});}
});
