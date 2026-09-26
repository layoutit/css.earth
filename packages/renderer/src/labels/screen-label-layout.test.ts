import { expect, test } from 'vitest';
import { labelRectsOverlap } from './screen-label-layout.js';

test('screen label overlap compares both axes with a three CSS pixel gap',()=>{
  const box={left:-30,top:-20,right:30,bottom:0};
  expect(labelRectsOverlap(box,{left:33,top:-10,right:60,bottom:10})).toBe(true);
  expect(labelRectsOverlap(box,{left:33.01,top:-10,right:60,bottom:10})).toBe(false);
  expect(labelRectsOverlap(box,{left:0,top:3,right:20,bottom:15})).toBe(true);
  expect(labelRectsOverlap(box,{left:0,top:3.01,right:20,bottom:15})).toBe(false);
  expect(labelRectsOverlap(box,{left:31,top:-10,right:60,bottom:10},0)).toBe(false);
});
