import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { mountPointPaths } from './point-paths.js';

test('dots are written in pixels, to an eighth, as wide as they draw, and no group scales them', () => {
  const { document } = parseHTML('<svg id="host"></svg>'), host = document.getElementById('host') as unknown as SVGElement;
  const paths = mountPointPaths(host, ['#ffffffff@1', '#ff0000ff@.75']);
  const white = paths.entry('#ffffffff@1', 1), red = paths.entry('#ff0000ff@.75', .75);
  paths.begin({ focalPixels: 900, principalOffsetPixels: [0, 0], widthPixels: 390, heightPixels: 604 });
  paths.add(white, 12.3, -4.7);
  paths.add(white, -.1, 0);
  // Past the looked-up texts (2,048 px from the centre) a dot's text is formatted, to the same eighth.
  paths.add(red, 3000.06, -2500.2);
  paths.commit();
  const [first, second] = [...host.querySelectorAll('path')];
  assert.equal(first!.getAttribute('d'), 'M12.25 -4.75h.01M-.125 0h.01');
  assert.equal(second!.getAttribute('d'), 'M3000 -2500.25h.01');
  assert.deepEqual([first!.getAttribute('stroke-width'), second!.getAttribute('stroke-width')], ['2', '1.5']);
  // A scaled group made Chrome draw every dot eight times as wide under a turn's warp (point-paths.ts).
  const transforms = [...host.querySelectorAll('g')].map(group => group.getAttribute('transform')).filter(value => value !== null);
  assert.deepEqual(transforms, ['translate(195 302)']);
});
