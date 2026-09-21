import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveProfileFamilyEvidence, productKindFamilyEvidence } from './observation-families.mts';

const owner = { kind: 'archive-adapter' as const, id: 'fixture', evidence: 'fixture ledger' };
test('normalized archive kinds retain their mapping owner and vocabulary', () => {
  const evidence = productKindFamilyEvidence('spectrum', owner);
  assert.deepEqual(evidence.families, ['F03']);
  assert.equal(evidence.owner, owner);
  assert.equal(evidence.status, 'mapped');
});

test('the COR1 archive profile establishes F16 only from its physical axes and units', () => {
  const identity = { NAXIS: 3, CTYPE1: 'CRLN', CTYPE2: 'CRLT', CTYPE3: 'HECR', CUNIT1: 'deg', CUNIT2: 'deg', CUNIT3: 'solRad', BUNIT: 'cm^-3', INSTRUME: 'SECCHI' };
  const evidence = archiveProfileFamilyEvidence('stereo-secchi-cor1-electron-density@2025-05-06', { kind: 'cube', decoder: 'fits-image', identity, owner });
  assert.deepEqual(evidence.families, ['F16']);
  assert.equal(evidence.status, 'source');
  assert.match(evidence.sourceTerm, /spherical physical grid/u);
  assert.throws(() => archiveProfileFamilyEvidence('stereo-secchi-cor1-electron-density@2025-05-06', { kind: 'cube', decoder: 'fits-image', identity: { ...identity, CTYPE3: 'DELAY' }, owner }), /requires identity CTYPE3=HECR/u);
});
