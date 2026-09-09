import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mjs';
const source=new URL('../../../../src/planets/miranda/source/',import.meta.url).pathname;
test('Miranda historical units preserve independently identified craters and unmapped north',async()=>{
  const recipe=JSON.parse(await readFile(source+'preparation/terrestrial.json'));
  const lens=recipe.raster.scientific.find(l=>l.id==='geology');
  const map=await loadScienceSurface(source,lens);
  // Original GIS centroid locations after the graticule-only fit. These three
  // crater identities were independently checked against the USGS named map.
  for(const [name,lon,lat] of [['Alonso',350.9556370785001,-45.6943837350925],['Gonzalo',80.3482470440008,-11.152188062773813],['Stephano',234.9237361358206,-42.274842901325904]])
    assert.equal(lens.categories[map.sample(lon,lat)]?.value,'freshimpactcraters',name);
  assert.equal(map.sample(77,30),null);
  const receipt=JSON.parse(await readFile(source+'science/geology-2026/categories.receipt.json'));
  assert.equal(createHash('sha256').update(await readFile(source+lens.path)).digest('hex'),receipt.output.sha256);
  assert.ok(receipt.sampledSphereCoverage>.43&&receipt.sampledSphereCoverage<.45);
  assert.ok(receipt.ambiguousCombinations.length>0,'Unresolved source overlaps are explicit gaps');
});
