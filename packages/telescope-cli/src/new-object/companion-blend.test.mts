/** A measured spectrum is refused when a double-star catalogue lists a close companion bright enough to change its color (companion-blend.mts). */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Archive } from './archives/archives.mts';
import { BLEND_LIMIT, blendRefusal, blendingCompanion, lightShare, parseWdsPairs } from './companion-blend.mts';

// Rows as VizieR serves B/wds/wds around each star, 2026-10-03.
const header = ['WDS\tDisc\tComp\tObs2\tsep2\tmag1\tmag2', ' \t \t \tyr\tarcsec\tmag\tmag', '----------\t-------\t-----\t----\t------\t------\t-----'];
const izar = [...header, '14450+2704\tSTF1877\tAB   \t2024\t  2.90\t 2.580\t 4.81', '14450+2704\tSTF1877\tAC   \t2020\t174.10\t 2.580\t12.58'].join('\n');
const kornephoros = [...header, '16302+2129\tBLA   4\tAa,Ab\t1990\t  0.00\t 2.800\t 6.50', '16302+2129\tBUP 170\tAB   \t2020\t245.80\t 2.860\t10.70'].join('\n');
const serving = (tsv: string): Archive => ({ async text(url, form) { assert.match(url, /asu-tsv/u); assert.equal(form?.['-source'], 'B/wds/wds'); return tsv; }, async bytes() { return Buffer.from(''); }, async exists() { return false; } });

test('a companion\'s share of the light follows its magnitude difference, and the limit is the color cross-check\'s tolerance', () => {
  assert.ok(Math.abs(lightShare(0) - 0.5) < 1e-12 && Math.abs(lightShare(2.5) - 1 / 11) < 1e-12);
  assert.ok(Math.abs(BLEND_LIMIT - 12 / 255) < 1e-12);
  assert.deepEqual(parseWdsPairs(izar).map(pair => [pair.discoverer, pair.components, pair.separationArcsec, pair.secondaryMagnitude]), [['STF1877', 'AB', 2.9, 4.81], ['STF1877', 'AC', 174.1, 12.58]]);
  assert.deepEqual(parseWdsPairs('#\n'), [], 'a response with no table has no pairs');
});

test('Izar\'s companion, 2.9 arcseconds away with 11% of the light, stops a measured spectrum; Kornephoros\'s 3% does not', async () => {
  const pair = await blendingCompanion(serving(izar), { ra: 221.24649, dec: 27.07432 });
  assert.ok(pair && Math.abs(pair.share - 0.1137) < 1e-3, `${pair?.share}`);
  assert.match(blendRefusal('izar', 'pulkovo', pair), /izar: the pulkovo spectrum would blend a companion\. .* WDS 14450\+2704 STF1877 AB: 2\.9 arcsec apart, magnitudes 2\.58 and 4\.81, so the companion gives 11\.4% of the light \(the color check allows 4\.7%\)\. Skip the spectral routes .* or keep the spectrum and say what is known of the companion \(color\.companion\)\./u);
  assert.equal(await blendingCompanion(serving(kornephoros), { ra: 247.55453, dec: 21.48954 }), undefined, 'magnitudes 2.8 and 6.5: 3.2% of the light');
});
