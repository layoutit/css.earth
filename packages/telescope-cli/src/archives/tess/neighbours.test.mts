import assert from 'node:assert/strict';
import test from 'node:test';
import { lightRefusal, parseNeighbours } from './neighbours.mts';
import { pickSector, placeAt, sectorYear, tiltOfPole } from './reduce.mts';

test('a star\'s pixels are its own when Gaia\'s neighbours give little of the light', () => {
  // Three stars: one alone but for a faint neighbour, one with a neighbour as bright as itself 49 arcseconds away, one Gaia does not hold.
  const light = parseNeighbours(['angDist,id,ra,dec,Source,Gmag,RPmag', '0.0009,alone,311.29,-31.34,10,7.84,6.80', '40.9,alone,311.29,-31.34,11,15.2,14.15', '5.4,alone,311.29,-31.34,12,20.5,',
    '0.09,paired,61.33,20.16,20,10.07,9.44', '49.2,paired,61.33,20.16,21,10.2,9.53', '12.0,absent,10,10,30,12,11.5'].join('\n'));
  assert.deepEqual(light.get('alone'), { gaiaDr3: '10', magnitude: 6.8, neighbours: 2, neighbourShare: 0.0012, brightest: { gaiaDr3: '11', magnitude: 14.15, arcsec: 40.9 } });
  assert.equal(lightRefusal(light.get('alone')), undefined);
  assert.equal(light.get('paired')!.neighbourShare, 0.4793); assert.match(lightRefusal(light.get('paired'))!, /Other stars give 48% of the light within 63 arcseconds.*49\.2 arcseconds away, has magnitude 9\.5 against the star's 9\.4/u);
  assert.equal(light.has('absent'), false); assert.match(lightRefusal(undefined)!, /Gaia DR3 has no source within 3 arcseconds/u);
  assert.match(lightRefusal({ gaiaDr3: '1', magnitude: 14.1, neighbours: 0, neighbourShare: 0 })!, /fainter than the 13\.5/u);
  assert.throws(() => parseNeighbours('angDist,id\n'), /did not answer with Gaia DR3 sources/u);
});

test('a star is looked for where it was in the sector\'s year', () => {
  // Barnard's Star moves 10.4 arcseconds a year, mostly north: a TESS pixel every two years.
  const star = { raDegrees: 269.448503, decDegrees: 4.739420, epochYear: 2016, motionRaDegreesPerYear: -801.551 / 3.6e6, motionDecDegreesPerYear: 10362.394 / 3.6e6 }, then = placeAt(star, sectorYear(80));
  assert.ok(Math.abs(sectorYear(1) - 2018.6) < 0.01 && Math.abs(sectorYear(95) - 2025.65) < 0.01);
  assert.ok(Math.abs((then.decDegrees - star.decDegrees) * 3600 - 10.362394 * (sectorYear(80) - 2016)) < 0.01); assert.ok(then.raDegrees < star.raDegrees);
  assert.deepEqual(placeAt(star, 2016), { raDegrees: 269.448503, decDegrees: 4.73942 });
  // The newest ten-minute sector is read when there is one; a place imaged only since sector 56 gives its newest.
  const imaged = (...numbers: number[]) => numbers.map(sector => ({ sector, camera: 1, ccd: 1 }));
  assert.equal(pickSector(imaged(13, 39, 66, 98))!.sector, 39); assert.equal(pickSector(imaged(13, 66, 98))!.sector, 98); assert.equal(pickSector([]), undefined);
  // A pole in the plane of the sky is tilted 90 degrees; one pointing at us, 0.
  assert.equal(tiltOfPole(311.29, 58.66, 311.29, -31.34), 90); assert.equal(tiltOfPole(131.29, 31.34, 311.29, -31.34), 0);
});
