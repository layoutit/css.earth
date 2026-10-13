/** Executable fixture producer for installed-package, offline viewer checks. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireWorkspace, writeProductRecord } from '@cssearth/telescope-core/node';
import { bodyMapFits, renderBodyMapProduct } from '@cssearth/bake/objects/layers/observation';
import { validatePreparedCssVolume, type BodyMapProduct } from '@cssearth/objects';
import { validateSpatialObject } from './spatial-handoff.mts';
import { encodeFits } from '@cssearth/fits/node';

export async function writeHtmlFixtures(directory: string, withPoints = false): Promise<void> {
  const png=await sharp({create:{width:16,height:16,channels:4,background:'#6688aacc'}}).png().toBuffer();
  const context={kind:'exploration',target:'mercury',discovery:{schema:'cssearth-telescope-exploration@1',observation:'fixture'},assessment:{status:'not-requested'}};
  for(const kind of ['image','spectrum'] as const) {
    const root=resolve(directory,kind);await mkdir(root,{recursive:true});
    const file=resolve(root,kind==='image'?'figure.png':'values.csv');
    await writeFile(file,kind==='image'?png:'wavelength_um,value,standard_deviation\n1,2,0.1\n2,3,0.2\n3,,\n4,2,\n5,1,0.3\n');
    await writeProductRecord(resolve(root,'output.product.json'),{telescope:'Fixture telescope',stage:'telescope-output',inputs:[],parameters:{label:'Fixture observation',selection:{kind,hdu:0},sourceContext:context,metadata:{instrument:'Fixture camera',date:'2026-10-13',filter:'Fixture band',scale:'1 arcsec per pixel',credit:'Fixture Observatory <science>'},software:{presentation:{coordinates:{valueUnit:'Jy'}}}},software:[]},[{path:kind==='image'?'figure.png':'values.csv',file}]);
  }
  const root=resolve(directory,'volume');await mkdir(resolve(root,'prepared'),{recursive:true});await mkdir(resolve(root,'source'),{recursive:true});
  await writeFile(resolve(root,'source/recipe.json'),JSON.stringify({credit:'Fixture Observatory <science>'}));
  const frame={referenceFrame:'fixture',epochJdTt:123,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,boundsUnits:{min:[-1,-1,-1],max:[1,1,1]}};
  const axes=['x','y','z'] as const;
  const payload=validatePreparedCssVolume({schema:'cssearth-css-volume@1',id:'fixture-volume',frame,anchors:[],
    stacks:axes.map((axis,index)=>({axis,leaves:[{id:axis,centerUnits:[0,0,0],texturePath:`${axis}.png`,widthPx:16,heightPx:16,style:{width:'100px',height:'100px',transform:index===0?'matrix3d(0,0,1,0,0,1,0,0,-1,0,0,0,0,-50,-50,1)':index===1?'matrix3d(1,0,0,0,0,0,1,0,0,-1,0,0,-50,0,-50,1)':'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-50,-50,0,1)',backgroundSize:'100px 100px',backgroundPosition:'0px 0px'}}]})),
    resources:axes.map(axis=>({path:`${axis}.png`,bytes:png.length,width:16,height:16})),provenance:{credit:'Fixture Observatory <science>'},approximation:{method:'Fixture geometry; no scientific claim'}});
  for(const axis of axes)await writeFile(resolve(root,'prepared',`${axis}.png`),png);
  await writeFile(resolve(root,'prepared/volume.json'),JSON.stringify({schema:'cssearth-prepared-object@1',id:payload.id,type:'density-volume',format:'cssearth-density-volume@1',data:payload}));
  await writeFile(resolve(root,'object.json'),JSON.stringify({schema:'cssearth-object@2',id:payload.id,type:'density-volume',prepared:{format:'cssearth-density-volume@1',url:'prepared/volume.json'},properties:{volume:frame,preparation:{source:'source/recipe.json'}}}));
  const mapRoot=resolve(directory,'sphere');await mkdir(mapRoot,{recursive:true});
  const map:BodyMapProduct={schema:'cssearth-body-map@1',definition:{quantity:'Fixture temperature',units:'K',timeDependence:'instantaneous-state',method:{owner:'fixture'},source:'Fixture Observatory <science>'},frame:{body:'mercury',radiusKm:2439.7,rotation:{model:'fixture',bodyCode:199}},grid:{width:4,height:2,longitude:'east-positive-from-0',rows:'north-to-south'},planes:{file:'map.fits',value:'VALUE',uncertainty:'SIGMA'},mask:{maximumEmissionDegrees:65,missing:'NaN'},observations:[{id:'fixture',telescope:'Fixture',instrument:'Camera',midTimeJd:2460000,rangeKm:1e8,subObserver:{latitudeDegrees:0,westLongitudeDegrees:0},angularResolution:{majorArcsec:1,minorArcsec:1,basis:'fixture'}}]};
  const values=new Float32Array(8).fill(3),errors=new Float32Array(8).fill(.1);
  const files={'map.fits':bodyMapFits({width:4,height:2},{},[{name:'VALUE',units:'K',values},{name:'SIGMA',units:'K',values:errors},{name:'EMISSION',units:'deg',values:new Float32Array(8)}]),'map.fits.body-map.json':renderBodyMapProduct(map),'texture.png':png,'poles.png':png,'navigation.json':JSON.stringify({radiiKm:[2439.7,2439.7,2439.7],shape:'reference sphere',registration:{method:'disc'},uncertainty:'source uncertainty',normalization:{minimum:1,maximum:4,colormap:'viridis',missing:'#333941'},sourceContext:context})};
  for(const [name,bytes]of Object.entries(files))await writeFile(resolve(mapRoot,name),bytes);
  await writeProductRecord(resolve(mapRoot,'map.fits.product.json'),{telescope:'Fixture',stage:'body-map',inputs:[],parameters:{credit:'Fixture Observatory <science>'},software:[]},Object.keys(files).map(path=>({path,file:resolve(mapRoot,path)})));
  // Original detector pairs for the independent oracle, separate from the projected body map.
  await writeFile(resolve(mapRoot,'measurement.fits'),Buffer.concat([encodeFits(values,4,2,{}),
    bodyMapFits({width:4,height:2},{},[{name:'ERR',units:'K',values:errors}]).subarray(2880)]));
  if(withPoints) {
    const value=await validateSpatialObject(resolve(requireWorkspace(),'src/objects/stellar-neighbourhood/object.json'), 'points');
    const target=resolve(directory,'points');await mkdir(target,{recursive:true});await writeFile(resolve(target,'object.json'),value.bytes);
    for(const [path,item]of value.checked){await mkdir(dirname(resolve(target,path)),{recursive:true});await writeFile(resolve(target,path),item.bytes);}
  }
  await readFile(resolve(directory,'image/output.product.json'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const destination=process.argv[2];if(!destination)throw new TypeError('Usage: html-fixture.mts DIRECTORY [--points]');
  await writeHtmlFixtures(destination,process.argv.includes('--points'));console.log(`HTML_FIXTURES_READY ${resolve(destination)}`);
}
