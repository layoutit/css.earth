import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { footprintReachesGrid } from './author-sky-bands.mts';

const grid = { width: 4000, height: 4000, fovDeg: 10, centerIcrsDegrees: [13.19, -72.83] as [number, number] };

test('an atlas tile is selected only when its projected footprint overlaps the grid, not merely its bounding box', () => {
  // AllWISE 3471m773_ac51 projected onto the SMC 10 degree grid: its box overlaps the grid corner, its footprint does not.
  const rotatedOutside: [number, number][] = [[3816.94, -417.01], [4391.26, -690.53], [4658.13, -117.43], [4083.61, 153.70]];
  assert.equal(footprintReachesGrid(rotatedOutside, grid), false);
  assert.equal(footprintReachesGrid([[3990, -10], [4100, -10], [4100, 100], [3990, 100]], grid), true, 'a vertex inside the grid');
  assert.equal(footprintReachesGrid([[-100, -100], [4200, -100], [4200, 4200], [-100, 4200]], grid), true, 'a footprint containing the whole grid');
  assert.equal(footprintReachesGrid([[1900, -50], [2100, -50], [2100, -40], [1900, -40]], grid), false, 'a strip just outside');
  assert.equal(footprintReachesGrid([[1990, -500], [2010, -500], [2010, 4500], [1990, 4500]], grid), true, 'an edge-crossing strip with no vertex or corner inside');
});
