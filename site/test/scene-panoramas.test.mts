import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { panoramaFromUrl, withScenePanorama } from '../scene/scene-panoramas.mts';
import { parsePanoramaList } from '../panorama-list.mts';

test('the address names an open panorama beside the other scene parameters', () => {
  assert.equal(panoramaFromUrl('/mars/?v=abc&panorama=van-zyl-overlook', 'https://css.earth/'), 'van-zyl-overlook');
  assert.equal(panoramaFromUrl('/mars/?panorama=../x', 'https://css.earth/'), null);
  const opened = withScenePanorama(new URL('https://css.earth/mars/?dataset=elevation'), 'belva');
  assert.equal(opened.search, '?dataset=elevation&panorama=belva');
  assert.equal(withScenePanorama(opened, null).search, '?dataset=elevation');
});

test('the card lists a body\'s own prepared panoramas and refuses another body\'s list', () => {
  const list = { schema: 'cssearth-surface-panorama-list@1', objectId: 'mars', source: { label: 'Collection', url: 'https://example.org/' },
    panoramas: [{ id: 'belva', title: 'Belva crater', sols: [789, 791], camera: 'Mastcam-Z', credit: 'NASA/JPL-Caltech/ASU/MSSS', pageUrl: 'https://example.org/',
      site: { latitudeDeg: 18.48, longitudeDegEast: 77.37, localization: 'site 39 drive 926, sol 784' }, thumbnail: '/scenes/mars/mars-panorama-belva-thumbnail.webp' }] };
  assert.equal(parsePanoramaList(list, 'mars').panoramas[0]!.sols[1], 791);
  assert.throws(() => parsePanoramaList(list, 'moon'), /not a surface panorama list for this object/u);
});
