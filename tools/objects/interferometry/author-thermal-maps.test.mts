import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { cutDisc } from './author-thermal-maps.mts';
import { ALMA, observerQuery } from '../sphere-horizons.mts';

test('the disc cutout follows the uv-plane offset: east is toward the first column, north toward later rows', () => {
  const width = 200, height = 200, values = new Float64Array(width * height);
  // Reference pixel (1-based) 101,101; the disc sits 50 mas east and 25 mas north of it at 5 mas per pixel: 10 columns left, 5 rows up.
  values[(100 + 5) * width + (100 - 10)] = 7;
  const cut = cutDisc({ values, width, height, referencePixel: [101, 101], arcsecPerPixel: 0.005 }, [50, 25], 0.1, 1.5);
  assert.ok(cut.size >= 60 && cut.size % 2 === 0);
  assert.equal(cut.values[cut.size / 2 * cut.size + cut.size / 2], 7);
  assert.equal(cut.values.reduce((sum, value) => sum + value, 0), 7);
});

test('a cutout that would leave the image is refused', () => {
  assert.throws(() => cutDisc({ values: new Float64Array(100), width: 10, height: 10, referencePixel: [6, 6], arcsecPerPixel: 0.01 }, [0, 0], 0.1, 1.5), /leaves the image/u);
});

test('ALMA is asked of Horizons as geodetic coordinates, other centres by their code', () => {
  const alma = observerQuery('502', [2457352.85], ALMA), paranal = observerQuery('502', [2457352.85]);
  assert.equal(alma.get('CENTER'), "'coord@399'"); assert.equal(alma.get('COORD_TYPE'), "'GEODETIC'"); assert.equal(alma.get('SITE_COORD'), "'-67.7549,-23.0229,5.06'");
  assert.equal(paranal.get('CENTER'), "'309'"); assert.equal(paranal.has('SITE_COORD'), false);
});
