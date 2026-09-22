import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeArrayBuffer} from 'geotiff';
import {loadScienceSurface} from './scientific-raster.mts';

test('geographic science preserves native degree cells, signed values and missing coverage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geographic-science-'));
  try {
    // Four 90-degree longitude cells, north row first. No projected-metre conversion.
    await writeFile(join(root, 'map.tif'), Buffer.from(writeArrayBuffer(
      Float32Array.from([0, -0.148, 0.148, -9999, 100, 200, 300, 400]), {
        width:4, height:2, SamplesPerPixel:1, PhotometricInterpretation:1,
        GTModelTypeGeoKey:2, GeographicTypeGeoKey:32767,
        BitsPerSample:[32], SampleFormat:[3], GDAL_NODATA:'-9999',
        ModelPixelScale:[90,90,0], ModelTiepoint:[0,0,0,0,90,0],
        GeoDoubleParams:[448],
        GeoKeyDirectory:[1,1,0,6, 1024,0,1,2, 1025,0,1,1, 2054,0,1,9102,
          2057,34736,1,0, 2058,34736,1,0, 2061,0,1,0],
      })));
    const grid = {width:4,height:2,noData:-9999,coordinates:'degrees',referenceRadiusMeters:448,
      centerLongitude:0,origin:[0,90],resolution:[90,-90]};
    const lens = {path:'map.tif',format:'geotiff',grid,sampling:'nearest'};
    const source = await loadScienceSurface(root, lens);
    assert.equal(source.sample(45,45),0, 'Zero is a measured value');
    assert.ok(Math.abs(source.sample(135,45)! + .148) < 1e-8);
    assert.equal(source.sample(315,45),null);
    assert.equal(source.sample(45,-45),100);
    assert.equal(source.sample(359.999,-45),400);
    assert.equal(source.sample(360,-45),null, 'No invented wrapped source column');
    assert.equal(source.sample(45,-90),null);
    for (const changed of [{coordinates:'radians'},{coordinates:'meters'},{centerLongitude:180},
      {referenceRadiusMeters:449},{origin:[-180,90]},{resolution:[1,-1]},{projection:'polar-stereographic'}]) {
      await assert.rejects(loadScienceSurface(root,{...lens,grid:{...grid,...changed}}));
    }
    const masked = await loadScienceSurface(root,{...lens,qualityMasks:[{...lens,minimum:0,maximum:300}]});
    assert.equal(masked.sample(135,45),null);
    assert.equal(masked.sample(45,45),0);
    assert.equal(masked.sample(315,-45),null);
  } finally { await rm(root,{recursive:true,force:true}); }
});
