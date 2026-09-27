import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();

// Runs the pinned PDS toolchain; without it installed the test skips.
test('PDS4 missing constants are scoped to their own array',async()=>{
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {resolve}=await import('node:path');
  const {pdsPackages}=await import('@cssearth/telescope/node');const dir=await mkdtemp(resolve(tmpdir(),'pds-array-mask-'));
  try{
    const array=(name:string,offset:number,missing:boolean)=>`<Array_2D_Image><local_identifier>${name}</local_identifier><offset unit="byte">${offset}</offset><axes>2</axes><axis_index_order>Last Index Fastest</axis_index_order><Element_Array><data_type>UnsignedByte</data_type></Element_Array><Axis_Array><axis_name>Line</axis_name><elements>1</elements><sequence_number>1</sequence_number></Axis_Array><Axis_Array><axis_name>Sample</axis_name><elements>2</elements><sequence_number>2</sequence_number></Axis_Array>${missing?'<Special_Constants><missing_constant>0</missing_constant></Special_Constants>':''}</Array_2D_Image>`;
    const xml=`<?xml version="1.0"?><Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1"><File_Area_Observational><File><file_name>data.bin</file_name></File>${array('SCI',0,false)}${array('OTHER',2,true)}</File_Area_Observational></Product_Observational>`;
    await writeFile(resolve(dir,'label.xml'),xml);await writeFile(resolve(dir,'data.bin'),Buffer.from([0,1,0,1]));
    const answer=await pdsPackages({operation:'decode-product',labelPath:resolve(dir,'label.xml')});
    assert.equal(answer.decoded?.structures.find(s=>s.name==='SCI')?.finite,2);assert.equal(answer.decoded?.structures.find(s=>s.name==='OTHER')?.finite,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
