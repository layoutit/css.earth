import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePdsPackageAnswer } from './pds-client.mts';

test('the PDS boundary requires exact package versions and one exact product', () => {
  const request = { operation: 'discover-product' as const, targetLid: 'urn:nasa:pds:context:target:asteroid.65803_didymos', lidvid: 'urn:nasa:pds:example::1.0' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.4.0', pdr: '1.4.4', products: [] }, request), /wrong contract/u);
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.5.0', pdr: '1.4.4', products: [{}, {}] }, request), /not a unique/u);
});

test('target discovery keeps every row because Peppi owns complete pagination', () => {
  const request = { operation: 'discover-target' as const, targetLid: 'urn:nasa:pds:context:target:satellite.x', processingLevel: 'Derived' as const };
  const answer = parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-target', peppi: '0.5.0', pdr: '1.4.4', products: [{ lidvid: 'one' }, { lidvid: 'two' }] }, request);
  assert.equal(answer.products?.length, 2);
});

test('the PDS boundary validates every decoded structure', () => {
  const request = { operation: 'decode-product' as const, labelPath: '/tmp/product.xml' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'decode-product', peppi: '0.5.0', pdr: '1.4.4',
    decoded: { standard: 'PDS4', metadata: {}, structures: [{ name: 'image', shape: [2, 2], dtype: '>f8' }] } }, request), /elements/u);
});
