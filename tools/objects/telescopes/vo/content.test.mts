import assert from 'node:assert/strict';
import test from 'node:test';
import { binaryTableHdu, primaryHdu } from '../../interferometry/fits-table.mts';
import { inspectVoFits } from './content.mts';

test('native FITS content dispatch refuses an event table without disguising it as an image', () => {
  const bytes = Buffer.concat([primaryHdu(), binaryTableHdu('EVENTS', [{ name: 'TIME', form: 'D' }], [[1]], []), binaryTableHdu('GTI', [{ name: 'START', form: 'D' }], [[0]], [])]);
  const profile = inspectVoFits('members/events.fits', bytes);
  assert.deepEqual(profile, { member: 'members/events.fits', family: 'events', profile: 'fits-events@1', state: 'non-qualifiable',
    reason: 'FITS EVENTS and GTI extensions are present; the VO route has no GTI-preserving event qualifier.' });
});

test('native FITS content dispatch retains ordinary tables as a non-qualifiable family', () => {
  const bytes = Buffer.concat([primaryHdu(), binaryTableHdu('CATALOG', [{ name: 'FLUX', form: 'E' }], [[1]], [])]);
  const profile = inspectVoFits('members/catalog.fits', bytes);
  assert.equal(profile.family, 'fits-table'); assert.equal(profile.profile, 'fits-bintable@1'); assert.equal(profile.state, 'non-qualifiable');
});
