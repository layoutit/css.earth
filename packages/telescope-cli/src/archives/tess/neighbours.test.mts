import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNeighbours } from './neighbours.mts';
import { placeAt, tiltOfPole } from './reduce.mts';

test('the Gaia sources around a star are counted, with their share of the light', () => {
  // Three stars: one alone but for a faint neighbour, one with a neighbour as bright as itself 49 arcseconds away, one Gaia does not hold.
  const light = parseNeighbours(['angDist,id,ra,dec,Source,Gmag,RPmag', '0.0009,alone,311.29,-31.34,10,7.84,6.80', '40.9,alone,311.29,-31.34,11,15.2,14.15', '5.4,alone,311.29,-31.34,12,20.5,',
    '0.09,paired,61.33,20.16,20,10.07,9.44', '49.2,paired,61.33,20.16,21,10.2,9.53', '12.0,absent,10,10,30,12,11.5'].join('\n'));
  assert.deepEqual(light.get('alone'), { gaiaDr3: '10', magnitude: 6.8, neighbours: 2, neighbourShare: 0.0012, brightest: { gaiaDr3: '11', magnitude: 14.15, arcsec: 40.9 } });
  assert.equal(light.get('paired')!.neighbourShare, 0.4793); assert.equal(light.has('absent'), false);
  assert.throws(() => parseNeighbours('angDist,id\n'), /did not answer with Gaia DR3 sources/u);
});

test('a star is looked for where it was in a given year, and a pole gives the tilt a page draws', () => {
  // Barnard's Star moves 10.4 arcseconds a year, mostly north: a TESS pixel every two years.
  const star = { raDegrees: 269.448503, decDegrees: 4.739420, epochYear: 2016, motionRaDegreesPerYear: -801.551 / 3.6e6, motionDecDegreesPerYear: 10362.394 / 3.6e6 }, then = placeAt(star, 2024);
  assert.ok(Math.abs((then.decDegrees - star.decDegrees) * 3600 - 10.362394 * 8) < 0.01); assert.ok(then.raDegrees < star.raDegrees);
  assert.deepEqual(placeAt(star, 2016), { raDegrees: 269.448503, decDegrees: 4.73942 });
  // A pole in the plane of the sky is tilted 90 degrees; one pointing at us, 0.
  assert.equal(tiltOfPole(311.29, 58.66, 311.29, -31.34), 90); assert.equal(tiltOfPole(131.29, 31.34, 311.29, -31.34), 0);
});
