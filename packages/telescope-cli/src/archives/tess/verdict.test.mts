import assert from 'node:assert/strict';
import test from 'node:test';
import { besideCatalogued, blended, BLENDED, notTurning, withinBreakup } from './verdict.mts';

test('a period is set beside the one the star\'s record holds: the same, its half, or not believed', () => {
  const seen = { detected: true, periodDays: 3.2, amplitude: 0.0075 };
  assert.deepEqual(besideCatalogued(seen, undefined), seen); assert.deepEqual(besideCatalogued(seen, 3.4), seen);
  // HD 63433 in sector 47: the light repeats every 3.2 d, and the catalogues print 6.508 d.
  assert.deepEqual(besideCatalogued(seen, 6.508), { detected: true, periodDays: 6.4, lightPeriodDays: 3.2, amplitude: 0.0075 });
  assert.match(besideCatalogued(seen, 8.58).reason!, /3\.2 d, is neither the star's catalogued rotation period, 8\.58 d, nor its half/u);
  assert.deepEqual(besideCatalogued({ detected: false, reason: 'weak' }, 6.5), { detected: false, reason: 'weak' });
});

test('a period shorter than an orbit at the star\'s surface is not its rotation', () => {
  // EPIC 205979159, a giant of 7 solar radii: its pixels show 0.16 d, and nothing could turn it faster than 2.3 d.
  const seen = { detected: true, periodDays: 0.16, amplitude: 0.0142 };
  assert.match(withinBreakup(seen, 2.3004).reason!, /0\.16 d, is shorter than the 2\.30 d of an orbit at the star's surface/u);
  // AU Mic, a dwarf: 4.85 d against 0.12 d.
  assert.deepEqual(withinBreakup({ detected: true, periodDays: 4.85, amplitude: 0.085 }, 0.1163), { detected: true, periodDays: 4.85, amplitude: 0.085 });
  assert.deepEqual(withinBreakup(seen, undefined), seen);
});

test('a star SIMBAD files as eclipsing or pulsating is not read for a rotation', () => {
  assert.match(notTurning('Eclipsing Binary', '* > ** > EB*')!, /SIMBAD lists the star as Eclipsing Binary/u);
  assert.match(notTurning('Classical Cepheid Variable', '* > Ev* > Ce* > cC*')!, /Classical Cepheid/u); assert.match(notTurning('gamma Dor Variable', '* > MS* > gD*')!, /gamma Dor/u);
  // Spotted stars, young stars and plain stars are read.
  for (const path of ['* > ** > BY*', '* > ** > RS*', '* > V* > Ro*', '* > Y*O > TT*', '* > V* > Er*', '* > PM*', '*']) assert.equal(notTurning('x', path), undefined);
  assert.equal(notTurning(undefined, undefined), undefined);
});

test('a TESS target whose pixels hold too much of other stars\' light is not read: the catalog\'s ratio at the published limit', () => {
  assert.equal(BLENDED.contaminationRatio, 0.2);
  // HD 222259 B (DS Tuc B), 5.4 arcseconds from the brighter DS Tuc A: the TESS Input Catalog gives its target 2.201013.
  assert.match(blended(2.201013, 410214984)!, /TIC 410214984\) a contamination ratio of 2\.2: .*Fetherolf et al\. \(2023\) search these light curves for periodic variability only under a ratio of 0\.2, and the light is not read as this star's/u);
  // The limit is the papers' "< 0.2": 0.2 itself is blended, and AU Mic's 0.002225163 is not.
  assert.match(blended(0.2, 1)!, /a contamination ratio of 0\.2:/u); assert.equal(blended(0.19994, 1), undefined); assert.equal(blended(0.002225163, 441420236), undefined);
  // A target the catalog gives no ratio is read, as such stars are in the paper's own catalogue.
  assert.equal(blended(undefined, 285473140), undefined);
});
