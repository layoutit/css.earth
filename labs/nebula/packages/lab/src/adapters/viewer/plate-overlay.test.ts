import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';
import { skyPlanePoint } from './reconstruction-overlay.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));

test('a plate photograph lies on its bank frame\'s sky plane, centred on the target and as wide as its field at the distance', () => {
  for (const id of ['cassiopeia-a-layers', 'cassiopeia-a-miri-layers', 'helix-wfi-layers', 'm57-miri-layers']) {
    const recipe = parseImageLayerRecipe(read(`src/objects/${id}/source/recipe.json`));
    // The bank's frame as its tracked descriptor states it: the prepared copy is restored from R2 and absent on a fresh checkout.
    const { frame } = (read(`src/objects/${id}/object.json`) as { properties: { frame: Parameters<typeof skyPlanePoint>[1] & { originM: number[] } } }).properties;
    const distanceUnits = Math.hypot(...frame.originM) / frame.metersPerUnit, view = imageLayerView(recipe);
    // The target's own sight line meets the plane at the frame's origin.
    const target = [Math.cos(recipe.target.centerDecDeg * Math.PI / 180) * Math.cos(recipe.target.centerRaDeg * Math.PI / 180),
      Math.cos(recipe.target.centerDecDeg * Math.PI / 180) * Math.sin(recipe.target.centerRaDeg * Math.PI / 180), Math.sin(recipe.target.centerDecDeg * Math.PI / 180)];
    const centre = skyPlanePoint(target, frame);
    assert.ok(Math.hypot(centre[0], centre[1]) < 1e-9 * distanceUnits, `${id}: the target is off the frame origin by ${Math.hypot(centre[0], centre[1])}`);
    // The picture's top edge spans its horizontal field at the target's distance.
    const [left, right] = [skyPlanePoint(view.ray(-1, 1), frame), skyPlanePoint(view.ray(1, 1), frame)];
    const expected = 2 * Math.tan(recipe.observation.fieldOfViewDeg[0] * Math.PI / 360) * distanceUnits;
    assert.ok(Math.abs(Math.hypot(right[0] - left[0], right[1] - left[1]) / expected - 1) < 1e-3, `${id}: the top edge is ${Math.hypot(right[0] - left[0], right[1] - left[1])} units, not ${expected}`);
  }
});
