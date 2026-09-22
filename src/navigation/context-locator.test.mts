import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { contextLocatorImages } from './context-locator.mts';

function decode(image: string): string {
  const match = /^url\("data:image\/svg\+xml,(.+)"\)$/.exec(image);
  assert.ok(match, 'Locator must be an inline SVG CSS image');
  return decodeURIComponent(match[1]!);
}

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
  const [rest, hover] = contextLocatorImages('#A1b2C3').map(decode);
  assert.match(rest!, /width="16" height="16" viewBox="0 0 16 16"/);
  assert.match(hover!, /width="20" height="20" viewBox="0 0 20 20"/);
  for (const svg of [rest!, hover!]) {
    assert.match(svg, /fill="#A1b2C3"/);
    const rects = svg.match(/M[^z]*z/g) ?? [];
    assert.equal(rects.length, 8, 'Two arms at each of the four corners');
    const size = Number(/width="(\d+)"/.exec(svg)![1]);
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
  assert.match(rest!, /M11 0h5v1\.5h-5z/, 'Top-right horizontal arm ends at the far edge');
  assert.match(hover!, /M18\.5 15H20v5h-1\.5z/, 'Bottom-right vertical arm ends at the far edge');
});

test('locators accept only validated swatch colours', () => {
  for (const colour of ['red', '#abc', '#12345g', '', 'url(x)']) {
    assert.throws(() => contextLocatorImages(colour), /Invalid locator color/);
  }
});
