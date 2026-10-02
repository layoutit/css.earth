import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preferredName } from './display-name.mts';

test('a star is named by the first designation in the order of preference, as SIMBAD lists it', () => {
  assert.equal(preferredName(['HD 39801', 'NAME Betelgeuse', '* alf Ori'])?.name, 'Betelgeuse');
  assert.equal(preferredName(['HD 75732', '* 55 Cnc', 'GJ 324 A'])?.name, '55 Cancri');
  assert.equal(preferredName(['HD 182989', 'V* RR Lyr'])?.name, 'RR Lyrae');
  // SIMBAD's lists as served 2026-10-01 for HD 6582 and HD 20630: the Bayer letter is the name, however the list is ordered.
  assert.equal(preferredName(['*  30 Cas', '* mu. Cas', 'V* V987 Cas'])?.name, 'Mu Cassiopeiae');
  assert.equal(preferredName(['* kap01 Cet', '* kap Cet', '*  96 Cet', 'V* kap01 Cet'])?.name, 'Kappa Ceti');
  assert.equal(preferredName(['HD 39587', '* chi01 Ori', '*  54 Ori'])?.name, 'Chi1 Orionis');
  assert.equal(preferredName(['Gaia DR3 4657705291679698048', 'HV 1005', 'OGLE-LMC-CEP-2534'])?.name, 'HV 1005');
  assert.equal(preferredName(['TYC 6865-327-1', 'CD-27 12874', 'Gaia DR3 4051659602122050176'])?.name, 'TYC 6865-327-1');
  assert.equal(preferredName(['LGGS J004438.01+412923.9', '[VRJ2006] M31V-J00443799+4129236', 'DIRECT V12650 M31C', 'Gaia DR3 369281910880929792'])?.name, 'DIRECT V12650 M31C');
});

test('a star with only position or source-number designations keeps the name it has', () => {
  assert.equal(preferredName(['Gaia DR3 1003193721988825600', '2MASS J06224093+5839301', 'UCAC4 744-046322', 'TIC 123456789', '** TOI 6383B']), undefined);
});
