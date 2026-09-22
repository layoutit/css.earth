import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { SCENE_OBJECTS } from '../objects.mts';

/** What the browser suites asserted, from the built HTML instead of a live Chrome.
 *
 * They ran 48 bodies x 2 densities through Playwright to check invariants that are all visible in
 * the markup: one scene, a camera box, prepared textures, no forbidden renderer, unique ids. The
 * runtime half they also covered — scene retention across navigation — is scene-session logic and
 * is tested directly in scene-session.test.mts, without a browser.
 *
 * Three bodies, not 48: these are shell invariants, not per-body facts. A body-specific claim
 * belongs in that body's own test. */
const BODIES = ['saturn', 'earth', 'mercury'];
const DIST = resolve(process.cwd(), 'dist');

async function page(id: string) {
  const html = await readFile(resolve(DIST, id, 'index.html'), 'utf8').catch(() => null);
  if (html === null) return null;
  return parseHTML(html).document;
}

for (const id of BODIES) {
  test(`${id}: the built page is a single clean prepared scene`, async t => {
    assert.ok(SCENE_OBJECTS.some(object => object.id === id), `${id} must be a registered scene`);
    const document = await page(id);
    if (!document) return t.skip('no dist build; run pnpm build first');

    const stage = document.querySelector('.object-stage');
    assert.ok(stage, 'the page must carry a planet stage');
    assert.equal(document.querySelectorAll('.polycss-scene').length, 1, 'exactly one scene is mounted');
    assert.ok(document.querySelectorAll('.polycss-camera').length >= 1, 'the scene must place a camera');

    // The rendering claim: geometry is CSS transforms, painted from prepared textures.
    const html = document.documentElement.outerHTML;
    assert.ok(html.includes('matrix3d('), 'geometry must be placed with matrix3d');
    assert.ok(html.includes('/scenes/'), 'surfaces must reference prepared textures');

    // No runtime canvas or WebGL. SVG is allowed sparingly, so it is bounded rather than banned.
    assert.equal(document.querySelectorAll('canvas').length, 0, 'no canvas may be served');
    assert.ok(document.querySelectorAll('svg').length <= 40, 'SVG stays sparing');

    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    assert.deepEqual(ids.filter((value, index) => ids.indexOf(value) !== index), [], 'ids stay unique');
  });
}
