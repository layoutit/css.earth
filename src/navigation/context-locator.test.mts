import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { locatorCornerPath } from '@cssearth/renderer/universe/context-locator.ts';

/** Bounding box of one `M`/`h`/`v`/`H`/`V` rectangle path. */
function box(rect: string) {
  const tokens = rect.match(/[MhvHV]|-?\d+(?:\.\d+)?/g) ?? [];
  let x = 0, y = 0;
  const xs: number[] = [], ys: number[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const op = tokens[index], value = () => Number(tokens[++index]);
    if (op === 'M') { x = value(); y = value(); }
    else if (op === 'h') x += value();
    else if (op === 'v') y += value();
    else if (op === 'H') x = value();
    else if (op === 'V') y = value();
    else continue;
    xs.push(x); ys.push(y);
  }
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

test('locators draw four 5px corner arms with 1.5px strokes at rest and on hover', () => {
  for (const size of [16, 20]) {
    const rects = locatorCornerPath(size).match(/M[^z]*z/g) ?? [];
    assert.equal(rects.length, 8, 'Two arms at each of the four corners');
    const boxes = rects.map(box);
    const horizontal = boxes.filter(b => b.width === 5 && b.height === 1.5);
    const vertical = boxes.filter(b => b.width === 1.5 && b.height === 5);
    assert.equal(horizontal.length, 4, 'Four 5px by 1.5px horizontal arms');
    assert.equal(vertical.length, 4, 'Four 1.5px by 5px vertical arms');
    for (const arms of [horizontal, vertical]) {
      // Each arm sits flush against one of the four distinct corners.
      const corners = new Set(arms.map(b => {
        assert.ok([0, size - b.width].includes(b.left) && [0, size - b.height].includes(b.top), JSON.stringify(b));
        return `${b.left === 0 ? 'L' : 'R'}${b.top === 0 ? 'T' : 'B'}`;
      }));
      assert.equal(corners.size, 4);
    }
  }
  assert.match(locatorCornerPath(16), /M11 0h5v1\.5h-5z/, 'Top-right horizontal arm ends at the far edge');
  assert.match(locatorCornerPath(20), /M18\.5 15H20v5h-1\.5z/, 'Bottom-right vertical arm ends at the far edge');
});
