import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePdsPackageAnswer } from './pds-client.mts';

test('the PDS boundary requires exact package versions and one exact product', () => {
  const request = { operation: 'discover-product' as const, targetLid: 'urn:nasa:pds:context:target:asteroid.65803_didymos', lidvid: 'urn:nasa:pds:example::1.0' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.4.0', pdr: '1.4.4', products: [] }, request), /wrong contract/u);
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.5.0', pdr: '1.4.4', products: [{}, {}] }, request), /not a unique/u);
});

test('target discovery keeps every row because Peppi owns complete pagination', () => {
  const request = { operation: 'discover-target' as const, targetLid: 'urn:nasa:pds:context:target:satellite.x' };
  const answer = parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-target', peppi: '0.5.0', pdr: '1.4.4', products: [{ lidvid: 'one' }, { lidvid: 'two' }] }, request);
  assert.equal(answer.products?.length, 2);
});

test('target identity resolution requires typed PDS context rows', () => {
  const request = { operation: 'resolve-target' as const, names: ['Charon'] };
  const answer = parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'resolve-target', peppi: '0.5.0', pdr: '1.4.4', targets: [
    { lid: 'urn:nasa:pds:context:target:satellite.134340_pluto.charon', name: 'Charon', aliases: ['Pluto I (Charon)'], type: 'Satellite', harvestIso: '2026-08-29T03:30:29Z' },
  ] }, request);
  assert.equal(answer.targets?.[0]?.lid, 'urn:nasa:pds:context:target:satellite.134340_pluto.charon');
});

test('the PDS boundary validates every decoded structure', () => {
  const request = { operation: 'decode-product' as const, labelPath: '/tmp/product.xml' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'decode-product', peppi: '0.5.0', pdr: '1.4.4',
    decoded: { standard: 'PDS4', metadata: {}, structures: [{ name: 'image', shape: [2, 2], dtype: '>f8' }] } }, request), /elements/u);
});

test('PDS4 missing constants are scoped to their own array',async()=>{
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {resolve}=await import('node:path');
  const {pdsPackages}=await import('./pds-client.mts');const dir=await mkdtemp(resolve(tmpdir(),'pds-array-mask-'));
  try{
    const array=(name:string,offset:number,missing:boolean)=>`<Array_2D_Image><local_identifier>${name}</local_identifier><offset unit="byte">${offset}</offset><axes>2</axes><axis_index_order>Last Index Fastest</axis_index_order><Element_Array><data_type>UnsignedByte</data_type></Element_Array><Axis_Array><axis_name>Line</axis_name><elements>1</elements><sequence_number>1</sequence_number></Axis_Array><Axis_Array><axis_name>Sample</axis_name><elements>2</elements><sequence_number>2</sequence_number></Axis_Array>${missing?'<Special_Constants><missing_constant>0</missing_constant></Special_Constants>':''}</Array_2D_Image>`;
    const xml=`<?xml version="1.0"?><Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1"><File_Area_Observational><File><file_name>data.bin</file_name></File>${array('SCI',0,false)}${array('OTHER',2,true)}</File_Area_Observational></Product_Observational>`;
    await writeFile(resolve(dir,'label.xml'),xml);await writeFile(resolve(dir,'data.bin'),Buffer.from([0,1,0,1]));
    const answer=await pdsPackages({operation:'decode-product',labelPath:resolve(dir,'label.xml')});
    assert.equal(answer.decoded?.structures.find(s=>s.name==='SCI')?.finite,2);assert.equal(answer.decoded?.structures.find(s=>s.name==='OTHER')?.finite,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
