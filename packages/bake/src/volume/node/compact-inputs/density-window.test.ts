import assert from 'node:assert/strict';
import { test } from 'vitest';
import { copyDensityWindow } from './density-window.ts';
test('density windows preserve little-endian cells and translate only their coordinate bounds', () => {
  const source=Buffer.alloc(4*3*2*4);for(let i=0;i<24;i++)source.writeFloatLE(i+.25,i*4);
  const result=copyDensityWindow(source,{dimensions:[4,3,2],boundsMin:[0,0,0],boundsMax:[4,3,2],cellMin:[1,1,0],cellMax:[3,3,2],translation:[10,-2,1],level:6});
  assert.deepEqual(result.outputDimensions,[2,2,2]);
  assert.deepEqual(Array.from({length:8},(_,i)=>result.raw.readFloatLE(i*4)),[5.25,6.25,9.25,10.25,17.25,18.25,21.25,22.25]);
  assert.deepEqual(result.translatedBoundsKpc,{min:[-9,3,-1],max:[-7,5,1]});
});
