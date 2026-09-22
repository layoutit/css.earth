import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {convertMappedComposition,parseMappedCompositionRecipe} from './mapped-composition.mts';
import {loadScienceSurface} from '../terrestrial-layers/scientific-raster.mts';

const grid = (f:(longitude:number,latitude:number)=>number) => Array.from({length:180},(_,y)=>Array.from({length:360},(_,x)=>f(x,y-90)));
const metadata = {target:'Reference',observation_name:'original',nan_value:-99,
  latitudes:Array.from({length:180},(_,i)=>i-90),longitudes:Array.from({length:360},(_,i)=>i)};
function input(document:unknown,selections:unknown[]) {
  const bytes=gzipSync(JSON.stringify(document));
  return {bytes,recipe:parseMappedCompositionRecipe({schema:'cssearth-mapped-composition@1',target:'Reference',referenceRadiusMeters:1560800,
    observationName:'original',input:'original.json.gz',sha256:createHash('sha256').update(bytes).digest('hex'),selections})};
}
test('mapped posterior nodes retain north/east orientation, seam, zero and source gaps through the existing GeoTIFF sampler',async()=>{
  const value=(lon:number,lat:number)=>lon===31&&lat===17?-99:lon===0&&lat===0?0:.2+lon/1000+lat/10000;
  const {bytes,recipe}=input({metadata,best_estimate_abundance:{ice:grid(value)},
    lower_bound_abundance:{ice:grid((x,y)=>value(x,y)===-99?-99:Math.max(0,value(x,y)-.1))},
    upper_bound_abundance:{ice:grid((x,y)=>value(x,y)===-99?-99:value(x,y)+.1)}},
    [{id:'ice',kind:'posterior',field:'ice',statistic:'median'}]);
  const converted=convertMappedComposition(bytes,recipe),root=await mkdtemp(join(tmpdir(),'mapped-composition-'));
  try{
    await writeFile(join(root,'ice.tif'),converted.products.ice);
    const raster=await loadScienceSurface(root,{format:'geotiff',path:'ice.tif',grid:converted.report.grid,sampling:'nearest'});
    for(const [lon,lat]of [[0,0],[20,30],[200,-40],[359,80],[180,12],[181,-12]])assert.equal(raster.sample(lon,lat),Math.fround(value(lon,lat)));
    assert.equal(raster.sample(31,17),null);
    assert.equal(raster.sample(-.2,0),0);
    assert.equal(raster.sample(179.8,12),raster.sample(-180.2,12));
    assert.equal(raster.sample(0,90),null,'Do not extend the last native latitude node to the north pole');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('mapped reflectance uses exact wavelengths and intersection validity, preserving measured zero',()=>{
  const {bytes,recipe}=input({metadata:{...metadata,wavelengths:[1.3,1.50263]},
    cube:[grid((x,y)=>x===1?-99:x===2?0:6),grid((x,y)=>x===3?-99:x===4?0:2)]},
    [{id:'ratio',kind:'ratio',numeratorMicrons:1.3,denominatorMicrons:1.50263}]);
  const result=convertMappedComposition(bytes,recipe);
  const report=result.report.products.ratio as {validNativeNodes:number;minimum:number;maximum:number};
  assert.equal(report.validNativeNodes,357*180);assert.equal(report.minimum,0);assert.equal(report.maximum,3);
  assert.throws(()=>convertMappedComposition(bytes,{...recipe,selections:[{id:'ratio',kind:'ratio',numeratorMicrons:1.3,denominatorMicrons:1.51}]}),/Exact selected wavelength/);
});
test('posterior uncertainty uses released interval endpoints and rejects swapped bounds or inconsistent masks',()=>{
  for(const lower of [.6,-99]){
    const {bytes,recipe}=input({metadata,best_estimate_abundance:{ice:grid(()=>.5)},lower_bound_abundance:{ice:grid(()=>lower)},upper_bound_abundance:{ice:grid(()=>.7)}},
      [{id:'uncertainty',kind:'posterior',field:'ice',statistic:'interval-width'}]);
    assert.throws(()=>convertMappedComposition(bytes,recipe),/ordering disagree/);
  }
});
