import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { PREPARED_VOLUME_DATASET_INDEX_SCHEMA, type PreparedVolumeDatasets } from '@cssearth/objects';
import { writeVolumeDatasetBank } from '@cssearth/objects/node';
const test = sourceTest();
import { parseCli } from './cli-arguments.mts';
import { exportSpatialObject,inspectSpatialObject } from './spatial-handoff.mts';

const frame={referenceFrame:'fixture-icrf',epochJdTt:2460000.5,originM:[1,2,3],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,boundsUnits:{min:[-1,-1,-1],max:[1,1,1]}};

async function json(path:string,value:unknown){await writeFile(path,JSON.stringify(value));}

/** Tiny fixture deliberately goes through the application's bank loader, but needs no renderer or image decoder. */
async function fixture(root:string){
  const assets={x:Buffer.from([1]),y:Buffer.from([2]),z:Buffer.from([3])};
  await Promise.all([mkdir(resolve(root,'prepared/first'),{recursive:true}),mkdir(resolve(root,'source'),{recursive:true})]);
  for(const [axis,bytes] of Object.entries(assets))await writeFile(resolve(root,`prepared/first/${axis}.bin`),bytes);
  const volume={schema:'cssearth-css-volume@1',id:'fixture-bank-first',frame,anchors:[],stacks:(['x','y','z'] as const).map(axis=>({axis,leaves:[{id:`${axis}-0`,centerUnits:[0,0,0],texturePath:`first/${axis}.bin`,widthPx:1,heightPx:1,style:{width:'1px',height:'1px',transform:'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',backgroundSize:'1px 1px',backgroundPosition:'0px 0px'}}]})),resources:(['x','y','z'] as const).map(axis=>({path:`first/${axis}.bin`,bytes:assets[axis].length,width:1,height:1})),provenance:{fixture:true},approximation:{fixture:true}};
  const data={schema:'cssearth-volume-datasets@1',id:'fixture-bank',defaultDataset:'first',framingRadiusUnits:1,attachedTo:'fixture-body',datasets:[{id:'first',label:'Fixture dataset',title:'Fixture dataset',description:'Deterministic prepared fixture.',sourceUrl:'https://example.test/fixture',volume,brightness:{overall:1,x:1,y:1,z:1},stars:{frame,points:[]}}],provenance:{fixture:true}};
  // The bank as a preparation stores it: its index, one volume a dataset, its stars and its record.
  await writeVolumeDatasetBank(resolve(root,'prepared'),data as unknown as PreparedVolumeDatasets);
  const recipe={schema:'fixture-recipe@1',id:'fixture-bank'};const recipeBytes=Buffer.from(JSON.stringify(recipe));await writeFile(resolve(root,'source/recipe.json'),recipeBytes);
  const object={schema:'cssearth-object@2',id:'fixture-bank',type:'volume-dataset-bank',properties:{frame,preparation:{source:'source/recipe.json'}},prepared:{format:PREPARED_VOLUME_DATASET_INDEX_SCHEMA,url:'prepared/datasets.json'}};
  const path=resolve(root,'object.json');await json(path,object);return {path,assets};
}

test('Telescope API preserves a pinned attached volume-dataset bank and refuses changed resources',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'telescope-volume-dataset-bank-'));
  try{
    const {path,assets}=await fixture(root),inspected=await inspectSpatialObject(path);
    assert.deepEqual(inspected,{kind:'volume-dataset-bank',target:'fixture-bank',frame,provenance:{fixture:true},inputs:9,attachedTo:'fixture-body',defaultDataset:'first',datasets:['first']});
    assert.deepEqual(parseCli(['export',path,'--output','volume-dataset-bank','--out',resolve(root,'handoff')]),{command:'spatial',result:path,kind:'volume-dataset-bank',directory:resolve(root,'handoff'),json:false,verbose:false});
    const handoff=await exportSpatialObject(path,'volume-dataset-bank',resolve(root,'handoff'));
    const receipt=JSON.parse(await readFile(handoff.receipt,'utf8'));
    const {interpretation,scope,...preserved}=receipt.parameters;
    assert.equal(interpretation,'Existing prepared physical object; no new depth inference, reconstruction or qualification of an observation.');
    assert.match(scope,/raw source datasets are referenced/u);
    assert.deepEqual(preserved,{kind:'volume-dataset-bank',target:'fixture-bank',frame,provenance:{fixture:true},attachedTo:'fixture-body',defaultDataset:'first',datasets:['first']});
    for(const [axis,bytes] of Object.entries(assets))assert.deepEqual(await readFile(resolve(handoff.directory,`prepared/first/${axis}.bin`)),bytes);
    await writeFile(resolve(root,'prepared/first/z.bin'),Buffer.from([9,9]));
    await assert.rejects(inspectSpatialObject(path),/Spatial resource first\/z\.bin is 2 bytes/);
    await assert.rejects(exportSpatialObject(path,'volume-dataset-bank',resolve(root,'changed')),/Spatial resource first\/z\.bin is 2 bytes/);
  }finally{await rm(root,{recursive:true,force:true});}
});
