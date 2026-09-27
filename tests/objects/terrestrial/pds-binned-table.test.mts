import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceTest} from '../source-test.mts';
import {parsePdsBinnedTable,loadPdsBinnedTable} from '@cssearth/bake/objects/raster';
const test=sourceTest();
const label=`PDS_VERSION_ID = PDS3
ROWS = 8
COLUMNS = 5
${['LATITUDE','LONGITUDE','CONCENTRATION','SIGMA','SIGMA WITH CFS'].map((name,i)=>`OBJECT = COLUMN
NAME = "${name}"
COLUMN_NUMBER = ${i+1}
UNIT = "${i<2?'DEGREE':'WEIGHT PERCENT'}"
NOT_APPLICABLE_CONSTANT = 9999.999
END_OBJECT = COLUMN`).join('\n')}`;
const rows=Array.from({length:8},(_,i)=>`${i<4?-45:45} ${(i%4+.5)*90} ${i===0?-2:i===7?9999.999:i} 0.1 ${i===1?9999.999:.2}`).join('\n');

test('PDS bin reader preserves negative estimates and independent missing uncertainties',()=>{
  const table=parsePdsBinnedTable(label,rows,90,'CONCENTRATION','WEIGHT PERCENT');
  assert.equal(table.valid,7);assert.equal(table.minimum,-2);assert.equal(table.maximum,6);
  assert.equal(table.values[1],1);assert.ok(Number.isNaN(table.totalErrors[1]));
  assert.ok(Number.isNaN(table.values[7]));assert.equal(table.errors[0],.1);
  assert.throws(()=>parsePdsBinnedTable(label,rows.replace('-45 45','-44 45'),90,'CONCENTRATION','WEIGHT PERCENT'),/coordinates/);
  assert.throws(()=>parsePdsBinnedTable(label,rows,5,'CONCENTRATION','WEIGHT PERCENT'),/layout/);
  assert.throws(()=>parsePdsBinnedTable(label,rows,90,'CONCENTRATION','ppm'),/columns/);
  assert.throws(()=>parsePdsBinnedTable(label,rows.split('\n').slice(1).join('\n'),90,'CONCENTRATION','WEIGHT PERCENT'),/Incomplete/);
});

test('PDS bins remain flat, wrap longitude and scale units without filling gaps',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pds-bins-'));
  try{
    await writeFile(join(root,'map.lbl'),label);await writeFile(join(root,'map.tab'),rows);
    const recipe={path:'map.tab',labelPath:'map.lbl',binDegrees:90,column:'CONCENTRATION',sourceUnits:'WEIGHT PERCENT',scale:10000};
    const surface=await loadPdsBinnedTable(root,recipe);
    assert.equal(surface.sample(1,-1),-20000);assert.equal(surface.sample(89,-89),-20000);
    assert.equal(surface.sample(361,-45),-20000);assert.equal(surface.sample(-1,45),null);
    assert.equal(surface.sample(91,90),50000);assert.equal(surface.sample(0,91),null);
    await assert.rejects(loadPdsBinnedTable(root,{...recipe,labelPath:'../map.lbl'}),/escapes/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Odyssey release anchors keep native concentrations, errors and polar coverage',async()=>{
  const root=new URL('../../../src/objects/mars/source/grs/',import.meta.url);
  for(const [name,value,error,valid] of [['h2o',6.632,1.435,1508],['cl',.634,.132,1508],['fe',11.212,2.33,1508],['si',23.343,2.543,1508],['k',.289,.039,2592],['th',.000088,.000022,2592]] as const){
    const table=parsePdsBinnedTable(await readFile(new URL(name+'_5x5.lbl',root),'utf8'),await readFile(new URL(name+'_5x5.tab',root),'utf8'),5,'CONCENTRATION','WEIGHT PERCENT');
    assert.equal(table.valid,valid,name);assert.equal(table.values[18*72],value,name);assert.equal(table.errors[18*72],error,name);
  }
});
