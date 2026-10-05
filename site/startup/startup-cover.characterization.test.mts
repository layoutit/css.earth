import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { parseStartupCover, presentStartupCover, startupCoverPlacement } from './startup-cover.mts';
const cover = {
  plan: { logicalBodyDiameter: 100, defaultZoom: 1, projection: { cssPerspective: '600px' }, responsiveFit: {
    model: 'continuous-aspect-smoothstep', portraitBaseWidthShare: .5, narrowPortraitWidthShareGain: .1, landscapeWidthShareGain: .1,
    narrowPortraitAspectRatio: .4, portraitAspectRatio: .8, squareAspectRatio: 1, maximumHeightShare: .8, maximumMobilePreviewShare: .8, minimumZoom: .1, maximumZoom: 10,
  } }, mobileQuery: '(orientation: portrait)', billboard: { size: 100, focalPixels: 100, distanceM: 10 }, bodyRadiusM: 1,
};
const rect = (width: number, height: number): DOMRect => ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height, toJSON() { return {}; } });
function page(search = '', mobile = false) {
  const { document, window } = parseHTML('<html><body><div class="object-stage"></div><img data-startup-billboard><script data-startup-cover></script><div class="startup-loading"></div><div class="explorer-navigation-progress" aria-hidden="true"></div></body></html>');
  const marks: string[] = []; let disconnected = false;
  Object.assign(window, { location: { search }, matchMedia: () => ({ matches: mobile }), getComputedStyle: () => ({ perspective: '600px' }), performance: { mark(name: string) { marks.push(name); } }, ResizeObserver: class { observe() {} disconnect() { disconnected = true; } } });
  const image = document.querySelector<HTMLImageElement>('img')!; Object.assign(image, { decode: async () => {}, complete: true, naturalWidth: 100 });
  document.querySelector<HTMLScriptElement>('script')!.textContent = JSON.stringify(cover);
  document.querySelector<HTMLElement>('.object-stage')!.getBoundingClientRect = () => rect(800, 600);
  return { document, image, marks, disconnected: () => disconnected };
}
test('startup cover paints a decoded cold-view image, removes loading and releases viewport ownership', async () => {
  for (const mobile of [false, true]) {
    const p = page('', mobile); await presentStartupCover(p.document);
  assert.equal(p.image.dataset.startupCover, 'shown');
  assert.equal(p.image.style.width, '100px');
  assert.equal(p.image.style.position, 'absolute');
  assert.equal(p.image.style.left, '50%');
  assert.equal(p.image.style.zIndex, '2147483646');
  assert.equal(p.image.style.opacity, '1');
  assert.equal(p.image.style.transform, `translate(-50%, -50%) translate(0px, 0px) scale(${240 * Math.sqrt(99) / 100})`);
  assert.equal(p.document.querySelector('.startup-loading'), null);
  assert.equal(p.document.querySelector('.explorer-navigation-progress')?.getAttribute('aria-hidden'), 'false');
  assert.deepEqual(p.marks, ['cssearth:startup-billboard']);
  assert.equal(p.disconnected(), true);
  assert.equal(p.document.querySelector('.object-stage')?.children.length, 0);
  }
});
test('query views, missing nodes, invalid plans, unsized stages and unusable decoded images stay unpainted', async () => {
  const query = page('?v=pose'); await presentStartupCover(query.document);
  assert.equal(query.image.dataset.startupCover, undefined);
  for (const selector of ['img', 'script', '.object-stage']) { const p = page(); p.document.querySelector(selector)!.remove(); await presentStartupCover(p.document);
  assert.deepEqual(p.marks, []); }
  const invalid = page(); invalid.document.querySelector('script')!.textContent = 'null'; await presentStartupCover(invalid.document);
  assert.deepEqual(invalid.marks, []);
  const unsized = page(); unsized.document.querySelector<HTMLElement>('.object-stage')!.getBoundingClientRect = () => rect(0, 0); await presentStartupCover(unsized.document);
  assert.deepEqual(unsized.marks, []);
  for (const kind of ['removed', 'arrival', 'incomplete', 'empty', 'decode-reject'] as const) {
    const p = page(); p.image.decode = async () => {
      if (kind === 'removed') p.image.remove(); if (kind === 'arrival') p.image.dataset.arrivalBillboard = 'adopted';
      if (kind === 'incomplete') Object.assign(p.image, { complete: false }); if (kind === 'empty') Object.assign(p.image, { naturalWidth: 0 });
      if (kind === 'decode-reject') { Object.assign(p.image, { complete: false }); throw new Error('decode failed'); }
    };
    await presentStartupCover(p.document);
  assert.equal(p.image.dataset.startupCover, undefined);
  assert.deepEqual(p.marks, []);
  assert.equal(p.disconnected(), true);
  }
  const malformed = page(); malformed.document.querySelector('script')!.textContent = '{';
  await assert.rejects(presentStartupCover(malformed.document), SyntaxError);
});
test('cover validation is permissive about negative size and empty fit but refuses missing numeric optics', () => {
  assert.equal(parseStartupCover({ ...cover, billboard: { ...cover.billboard, size: -1 }, plan: { ...cover.plan, responsiveFit: {} } })?.billboard.size, -1);
  for (const input of [0, null, {}, { ...cover, bodyRadiusM: 0 }, { ...cover, mobileQuery: 1 }, { ...cover, billboard: { ...cover.billboard, focalPixels: NaN } }, { ...cover, plan: { ...cover.plan, projection: undefined } }]) assert.equal(parseStartupCover(input), null);
});

test('cover paints exact opacity and scale at small frames, including both clamp ends', async () => {
  for (const [width, opacity] of [[1, '0'], [5, '0.08333333333333333'], [10, '0.3333333333333333'], [20, '0.8333333333333334'], [30, '1']] as const) {
    const p = page();
    p.document.querySelector<HTMLElement>('.object-stage')!.getBoundingClientRect = () => rect(width, width);
    await presentStartupCover(p.document);
    const radiusPixels = width * .6 / 2;
    const scale = radiusPixels / (100 / Math.sqrt(99));
  assert.equal(p.image.style.opacity, opacity);
  assert.equal(p.image.style.transform, `translate(-50%, -50%) translate(0px, 0px) scale(${scale})`);
  }
});
test('cover placement uses the open-area centre and prepared billboard optics exactly', () => {
  const viewport = {
    read: () => ({ bounds: { x: 0, y: 10, left: 0, top: 10, width: 800, height: 600 }, focalPixels: 600, previewTop: null, openArea: { top: 100, bottom: 500 } }),
    subscribe: () => () => {},
    destroy() {},
  };
  assert.deepEqual(startupCoverPlacement(parseStartupCover(cover)!, viewport, true), { offsetY: -10, radiusPixels: 120, scale: 120 / (100 / Math.sqrt(99)) });
});

test('mobile cover transform includes the open-area vertical offset', async () => {
  const p = page('', true);
  const band = p.document.createElement('div');
  band.className = 'object-viewport-search-band';
  band.getBoundingClientRect = () => ({ ...rect(800, 100), y: 500, top: 500, bottom: 600 });
  p.document.body.append(band);
  await presentStartupCover(p.document);
  const scale = 150 / (100 / Math.sqrt(99));
  assert.equal(p.image.style.transform, `translate(-50%, -50%) translate(0px, -50px) scale(${scale})`);
  assert.equal(p.image.style.opacity, '1');
});

test('one zero stage dimension prevents painting', async () => {
  for (const [width, height] of [[0, 600], [800, 0]]) {
    const p = page();
    p.document.querySelector<HTMLElement>('.object-stage')!.getBoundingClientRect = () => rect(width, height);
    await presentStartupCover(p.document);
  assert.deepEqual(p.marks, []);
  assert.equal(p.image.dataset.startupCover, undefined);
  }
});
