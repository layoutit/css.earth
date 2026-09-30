import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { labelRectsOverlap } from './screen-label-layout.js';

test('screen label overlap compares both axes with a three CSS pixel gap',()=>{
  const box={left:-30,top:-20,right:30,bottom:0};
  assert.equal(labelRectsOverlap(box,{left:33,top:-10,right:60,bottom:10}), true);
  assert.equal(labelRectsOverlap(box,{left:33.01,top:-10,right:60,bottom:10}), false);
  assert.equal(labelRectsOverlap(box,{left:0,top:3,right:20,bottom:15}), true);
  assert.equal(labelRectsOverlap(box,{left:0,top:3.01,right:20,bottom:15}), false);
  assert.equal(labelRectsOverlap(box,{left:31,top:-10,right:60,bottom:10},0), false);
});
