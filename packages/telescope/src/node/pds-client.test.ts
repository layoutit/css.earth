import assert from 'node:assert/strict';
import { it as test } from 'vitest';
import { parsePdsPackageAnswer } from './pds-client.js';

test('the PDS boundary requires exact package versions and one exact product', () => {
  const request = { operation: 'discover-product' as const, targetLid: 'urn:nasa:pds:context:target:asteroid.65803_didymos', lidvid: 'urn:nasa:pds:example::1.0' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.4.0', pdr: '1.4.4', products: [] }, request), /wrong contract/u);
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-product', peppi: '0.5.0', pdr: '1.4.4', products: [{}, {}] }, request), /not a unique/u);
});

test('target discovery keeps every row because Peppi owns complete pagination', () => {
  const request = { operation: 'discover-target' as const, targetLid: 'urn:nasa:pds:context:target:satellite.x' };
  const answer = parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'discover-target', peppi: '0.5.0', pdr: '1.4.4', products: [{ lidvid: 'one' }, { lidvid: 'two' }] }, request);
  assert.equal(answer.products?.length, 2);
});

test('target identity resolution requires typed PDS context rows', () => {
  const request = { operation: 'resolve-target' as const, names: ['Charon'] };
  const answer = parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'resolve-target', peppi: '0.5.0', pdr: '1.4.4', targets: [
    { lid: 'urn:nasa:pds:context:target:satellite.134340_pluto.charon', name: 'Charon', aliases: ['Pluto I (Charon)'], type: 'Satellite', harvestIso: '2026-08-29T03:30:29Z' },
  ] }, request);
  assert.equal(answer.targets?.[0]?.lid, 'urn:nasa:pds:context:target:satellite.134340_pluto.charon');
});

test('the PDS boundary validates every decoded structure', () => {
  const request = { operation: 'decode-product' as const, labelPath: '/tmp/product.xml' };
  assert.throws(() => parsePdsPackageAnswer({ schema: 'cssearth-pds-package-answer@1', operation: 'decode-product', peppi: '0.5.0', pdr: '1.4.4',
    decoded: { standard: 'PDS4', metadata: {}, structures: [{ name: 'image', shape: [2, 2], dtype: '>f8' }] } }, request), /elements/u);
});
