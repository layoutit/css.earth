import {required} from '../../../../tools/contract/test-values.mts';
import {array,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('miranda');
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {parseInterpreterRecipe} from '../../../../tools/objects/observation/interpret.mts';
const source=new URL('../../../../src/objects/miranda/source/',import.meta.url).pathname;
test('Miranda historical units preserve independently identified craters and unmapped north',async()=>{
  const recipe=parseInterpreterRecipe(JSON.parse((await readFile(source+'preparation/raster.json')).toString('utf8')));
  const lens=required(recipe.surfaces.find(surface=>surface.id==='geology')?.science,'geology science');
  const {path,categories}=shape({path:text,categories:array(shape({value:text}))})(lens);
  const map=await loadScienceSurface(source,lens);
  // Original GIS centroid locations after the graticule-only fit. These three
  // crater identities were independently checked against the USGS named map.
  for(const [name,lon,lat] of [['Alonso',350.9556370785001,-45.6943837350925],['Gonzalo',80.3482470440008,-11.152188062773813],['Stephano',234.9237361358206,-42.274842901325904]] as const)
    assert.equal(categories[required(map.sample(lon,lat))]?.value,'freshimpactcraters',name);
  assert.equal(map.sample(77,30),null);
  const receipt=JSON.parse((await readFile(source+'science/geology-2026/categories.receipt.json')).toString('utf8'));
  assert.ok(receipt.sampledSphereCoverage>.43&&receipt.sampledSphereCoverage<.45);
  assert.ok(receipt.ambiguousCombinations.length>0,'Unresolved source overlaps are explicit gaps');
});
