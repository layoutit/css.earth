import assert from 'node:assert/strict';
import {test} from 'node:test';
import {preparePhotographicAtmosphere} from './photographic-atmosphere.mts';
import {createEllipsoidGeometry} from './ellipsoid-geometry.mts';
import profile from '../../../src/planets/mars/source/preparation/atmosphere.json' with {type:'json'};
import shape from '../../../src/planets/mars/source/preparation/ellipsoid.json' with {type:'json'};

const atmosphere=await preparePhotographicAtmosphere({sourceDirectory:new URL('../../../src/planets/mars/source/',import.meta.url).pathname,profile,geometry:createEllipsoidGeometry(shape)});
test('photographic atmosphere calibration remains bound to the source annuli and physical model',()=>{
  assert.equal(atmosphere.PUBLISHED_ATMOSPHERE_REFERENCE.discDetection.thresholdRgb8,8);
  assert.deepEqual(atmosphere.PUBLISHED_ATMOSPHERE_REFERENCE.limbAnnulus,[0.96,0.99]);
  assert.ok(atmosphere.PUBLISHED_ATMOSPHERE_REFERENCE.limbSampleCount>1000);
  assert.equal(atmosphere.OPENSPACE_ATMOSPHERE.planetRadiusKm,3386.190);
  assert.equal(atmosphere.ATMOSPHERE_PROFILE.radiusKm,3386.190);
  assert.ok(atmosphere.ATMOSPHERE_PROFILE.layers[0].scatteringPerKm.every(value=>value>0));
});
test('physical material retains independent atmosphere when ground shadows are disabled',()=>{
  const projection=atmosphere.prepareMaterialProjection(40,1),lightDirection=[1,0,0];
  const layer=atmosphere.prepareAtmosphereFrame(40,1,{lightDirection,preparedProjection:projection});
  const lit=atmosphere.prepareMaterialFrame(40,1,{lightDirection,preparedProjection:projection,preparedAtmosphere:layer,shadows:true});
  const unshadowed=atmosphere.prepareMaterialFrame(40,1,{lightDirection,preparedProjection:projection,preparedAtmosphere:layer,shadows:false});
  assert.equal(lit.data.length,512*512*4);assert.notDeepEqual(lit.data,unshadowed.data);
  assert.ok(layer.data.some(value=>value>0));
  assert.throws(()=>atmosphere.prepareMaterialFrame(40,3),/density/);
});
