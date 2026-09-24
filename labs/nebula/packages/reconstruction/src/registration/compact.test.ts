import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { detectCompactStars, matchCompactStars } from './compact.ts';
import type { Point } from './affine.ts';
import type { Star } from './stellar.ts';

test('compact matching preserves reciprocal constellation identities under frame translation', () => {
  const points: Point[] = [[10,10],[25,12],[37,29],[15,40],[49,51],[60,30],[72,64],[83,44]];
  const stars: Star[] = points.map(point => ({point,peak:100}));
  const shifted = stars.map(star => ({...star,point:[star.point[0]+3,star.point[1]-2] as Point}));
  const pairs = matchCompactStars(stars, shifted, [1,0,0,1,3,-2], [1,0,0,1,0,0]);
  assert.equal(pairs.length,points.length);
  assert.deepEqual(pairs.map(pair=>[pair.sourceIndex,pair.referenceIndex]),points.map((_,i)=>[i,i]));
});

test('compact detector rejects grid mismatch and does not manufacture stars on a blank image', async () => {
  const bytes = await sharp(Buffer.alloc(64*64*3),{raw:{width:64,height:64,channels:3}}).png().toBuffer();
  assert.deepEqual(await detectCompactStars(bytes,[64,64]),[]);
  await assert.rejects(detectCompactStars(bytes,[63,64]),/grid differs/);
});
