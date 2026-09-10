import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
const root = new URL('../../../../src/planets/miranda/source/', import.meta.url).pathname;
test('Miranda mosaic and kilometre DEM register despite their different longitude origins', async () => {
  const config=JSON.parse(await readFile(root+'preparation/terrestrial.json'));
  const manifest=JSON.parse(await readFile(root+'manifest.json'));
  const entry=manifest.inputs.find(x=>x.lensId==='normal');
  const policy=config.raster.observations[0].validity;
  const mosaic=await loadScienceSurface(root,{path:entry.path,format:'isis3',grid:policy.grid,sampling:'bilinear'});
  const dem=await loadScienceSurface(root,config.raster.scientific[0]);
  // Independent NumPy untile and geographic lookup on the pinned original cubes.
  // USGS Gazetteer centres: Elsinore, Arden, Inverness (east-positive longitude).
  for(const [lon,lat,dn,km] of [[257.1,-24.8,486.825195,.446178168],[73.7,-29.1,1870.390747,-.233635366],[325.7,-66.9,1564.252319,1.164340019]]) {
    assert.ok(Math.abs(mosaic.sample(lon,lat)-dn)<.001);
    assert.ok(Math.abs(dem.sample(lon,lat)-km)<.000001);
  }
  for(const source of [mosaic,dem]) {
    assert.equal(source.sample(180,60),null,'Unobserved north stays missing');
    assert.notEqual(source.sample(180,-85),null,'Measured south remains valid');
  }
  const {rgb,missing}=await readObservation(root,entry,policy,360,180);
  assert.equal(missing[30*360+180],1);
  const value=mosaic.sample(325.5,-66.5),index=156*360+325;
  assert.equal(missing[index],0);
  assert.equal(rgb[index*3],Math.round(Math.max(0,Math.min(255,value/2400*255))));
});
