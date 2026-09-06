import assert from 'node:assert/strict';import{test}from'node:test';
import{observationPixelMissing}from'./observed-geotiff.mjs';
test('explicit source no-data distinguishes any-channel and complete-pixel masks',()=>{
 const base={noData:0,zeroValidity:'all-channels'};assert.equal(observationPixelMissing([1,1,1],0,0,base),false);
 assert.equal(observationPixelMissing([0,1,1],0,0,base),false);assert.equal(observationPixelMissing([0,0,0],0,0,base),true);
 assert.equal(observationPixelMissing([0,1,1],0,0,{...base,zeroValidity:'any-channel'}),true);
});
test('documented polar and synthetic-channel exclusions operate in source geographic coordinates',()=>{
 const p={noData:0,zeroValidity:'any-channel',withholdLatitudeDegrees:85,withholdLongitudeDegrees:[110,150]};
 assert.equal(observationPixelMissing([1,1,1],109.999,84.999,p),false);assert.equal(observationPixelMissing([1,1,1],110,0,p),true);
 assert.equal(observationPixelMissing([1,1,1],150,0,p),true);assert.equal(observationPixelMissing([1,1,1],151,-85,p),true);
});
