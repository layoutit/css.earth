import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { archiveProfileFamilyEvidence, productKindFamilyEvidence } from './observation-families.mts';

const owner = { kind: 'archive-adapter' as const, id: 'fixture', evidence: 'fixture ledger' };
test('normalized archive kinds retain their mapping owner and vocabulary', () => {
  const evidence = productKindFamilyEvidence('spectrum', owner);
  assert.deepEqual(evidence.families, ['F03']);
  assert.equal(evidence.owner, owner);
  assert.equal(evidence.status, 'mapped');
});

test('the COR1 archive profile establishes F16 only from its physical axes and units', () => {
  const identity = { NAXIS: 3, NAXIS1: 361, NAXIS2: 181, NAXIS3: 51, CTYPE1: 'CRLN', CRPIX1: 1, CRVAL1: 0, CDELT1: 1, CUNIT1: 'deg', CTYPE2: 'CRLT', CRPIX2: 91, CRVAL2: 0, CDELT2: 1, CUNIT2: 'deg', CTYPE3: 'HECR', CRPIX3: 1, CRVAL3: 1.5, CDELT3: 0.05, CUNIT3: 'solRad', BUNIT: 'cm^-3', INSTRUME: 'SECCHI' };
  const evidence = archiveProfileFamilyEvidence('stereo-secchi-cor1-electron-density@2025-05-06', { kind: 'cube', decoder: 'fits-image', identity, owner });
  assert.deepEqual(evidence.families, ['F16']);
  assert.equal(evidence.status, 'source');
  assert.match(evidence.sourceTerm, /spherical physical grid/u);
  assert.throws(() => archiveProfileFamilyEvidence('stereo-secchi-cor1-electron-density@2025-05-06', { kind: 'cube', decoder: 'fits-image', identity: { ...identity, CTYPE3: 'DELAY' }, owner }), /requires identity CTYPE3=HECR/u);
});
