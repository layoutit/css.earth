import { sha256 } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {requireArray,requireRecord,requireFiniteNumber} from '@cssearth/core';
import {parseMappedCompositionRecipe,prepareMappedComposition} from './mapped-composition.mts';
import {loadScienceSurface} from '../terrestrial-layers/scientific-raster.mts';

const nativeGrid=(value:unknown)=>requireArray(value).map(row=>requireArray(row).map(v=>requireFiniteNumber(v)));

/** Independently read the native fields, then query the delivered GeoTIFF at every
 * native coordinate through the product's existing scientific surface sampler. */
export async function qualifyMappedComposition(sourceRoot:string,recipePath:string){
 const recipeBytes=await readFile(resolve(sourceRoot,recipePath));
 const recipe=parseMappedCompositionRecipe(JSON.parse(recipeBytes.toString()));
 const converted=await prepareMappedComposition(sourceRoot,recipePath);
 const original=await readFile(resolve(sourceRoot,recipe.input));
 const document=requireRecord(JSON.parse(gunzipSync(original).toString()));
 const metadata=requireRecord(document.metadata);
 const latitudes=requireArray(metadata.latitudes).map(v=>requireFiniteNumber(v));
 const longitudes=requireArray(metadata.longitudes).map(v=>requireFiniteNumber(v));
 const products=[];
 for(const selection of recipe.selections){
  let expected:number[][];
  if(selection.kind==='posterior'){
   const median=nativeGrid(requireRecord(document.best_estimate_abundance)[selection.field]);
   const lower=nativeGrid(requireRecord(document.lower_bound_abundance)[selection.field]);
   const upper=nativeGrid(requireRecord(document.upper_bound_abundance)[selection.field]);
   expected=selection.statistic==='median'?median:upper.map((row,y)=>row.map((v,x)=>v===-99?-99:v-lower[y][x]));
  }else{
   const wavelengths=requireArray(metadata.wavelengths);
   const cube=requireArray(document.cube);
   const numerator=nativeGrid(cube[wavelengths.indexOf(selection.numeratorMicrons)]);
   const denominator=nativeGrid(cube[wavelengths.indexOf(selection.denominatorMicrons)]);
   expected=numerator.map((row,y)=>row.map((v,x)=>v===-99||denominator[y][x]===-99||denominator[y][x]===0?-99:v/denominator[y][x]));
  }
  const path=`${dirname(recipePath)}/${selection.id}.tif`,bytes=await readFile(resolve(sourceRoot,path));
  assert.equal(sha256(bytes),sha256(converted.products[selection.id]),`${selection.id}: reproduction differs`);
  const surface=await loadScienceSurface(sourceRoot,{format:'geotiff',path,grid:converted.report.grid,sampling:'nearest'});
  let valid=0,missing=0;
  const anchors=[];
  for(let y=0;y<latitudes.length;y++)for(let x=0;x<longitudes.length;x++){
   const native=expected[y][x],actual=surface.sample(longitudes[x],latitudes[y]);
   assert.equal(actual,native===-99?null:Math.fround(native),`${selection.id}: ${longitudes[x]}E ${latitudes[y]}N`);
   if(native===-99)missing++;else valid++;
   if([0,45,90,135,179].includes(y)&&[0,90,180,270].includes(x))anchors.push({eastLongitude:longitudes[x],northLatitude:latitudes[y],native:native===-99?null:native,prepared:actual});
  }
  for(const lat of [-60,0,60])assert.equal(surface.sample(-180,lat),surface.sample(180,lat),'Periodic seam differs');
  assert.equal(surface.sample(0,90),null,'Unobserved north pole was extended');
  products.push({id:selection.id,path,sha256:sha256(bytes),checkedNodes:valid+missing,valid,missing,anchors});
 }
 return {schema:'cssearth-mapped-composition-evidence@1',target:recipe.target,recipe:{path:recipePath,sha256:sha256(recipeBytes)},
  input:{path:recipe.input,sha256:sha256(original)},comparison:'Every native geographic node matches exactly after float32 rounding; missing samples remain null. Seam equivalence and absent north-pole coverage checked.',products};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [sourceRoot,recipePath,output]=process.argv.slice(2);
 if(!sourceRoot||!recipePath||!output||process.argv.length!==5)throw new TypeError('Usage: mapped-composition-evidence.mts <source-root> <recipe-path> <receipt.json>');
 const receipt=await qualifyMappedComposition(sourceRoot,recipePath);await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({target:receipt.target,products:receipt.products.map(p=>({id:p.id,checked:p.checkedNodes,valid:p.valid,missing:p.missing}))}));
}
