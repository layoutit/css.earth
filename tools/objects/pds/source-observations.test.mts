import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { sourcePds3Observations } from './source-observations.mts';

const ROOT = resolve(import.meta.dirname, '../../..');

test('source-pinned Wild 2 PDS3 images enter the PDS adapter without inventing a filter width', async () => {
  const observations = await sourcePds3Observations(ROOT, 'comet-81p');
  assert.deepEqual(observations.map(observation => observation.id), ['n2069we02_rr', 'n2073we02_rr', 'n2075we02_rr', 'n2077we02_rr', 'n2079we02_rr']);
  assert.equal(observations.every(observation => observation.sourceFiles.length === 2), true);
  assert.equal(observations.every(observation => observation.filter === 'OPNAV' && observation.centralWavelengthMicrometres === 0.6988), true);
  assert.deepEqual(observations.map(observation => observation.surfaceResolutionKm), [0.021253, 0.014167, 0.01533, 0.01939, 0.024964]);
});

test('ordinal UTC is validated without requiring a product processing-level field',async()=>{
 const {pds3TimeIso}=await import('@cssearth/telescope');
 assert.equal(pds3TimeIso('2004-163T16:09:09.703'),'2004-06-11T16:09:09.703Z');
 assert.throws(()=>pds3TimeIso('2003-366T00:00:00'),/day of year/);
 for(const target of ['phoebe','tethys']){
  const observations=await sourcePds3Observations(ROOT,target);assert.ok(observations.length);assert.ok(observations.every(o=>!o.mode.includes('undefined')&&o.startIso.endsWith('Z')));
 }
});

for (const target of ['amalthea', 'ceres', 'gaspra', 'ida', 'metis', 'thebe']) {
  test(`${target}: an incomplete mission label is reported without aborting discovery`, async () => {
    const issues: { path: string; reason: string }[] = [];
    await sourcePds3Observations(ROOT, target, (path, reason) => issues.push({ path, reason }));
    assert.ok(issues.length, 'The tracked incomplete label must remain visible to the caller.');
    assert.ok(issues.every(issue => issue.path.startsWith(`src/objects/${target}/source/`)));
    assert.ok(issues.some(issue => /lacks (?:PRODUCT_ID|INSTRUMENT_HOST_NAME|INSTRUMENT_ID)/u.test(issue.reason)));
  });
}
for (const target of ['comet-103p', 'comet-9p']) {
  test(`${target}: HRI-IR's N/A filter and horizontal scale remain unknown`, async () => {
    const observations = await sourcePds3Observations(ROOT, target);
    const spectrum = observations.find(observation => observation.id.startsWith('hi'));
    assert.ok(spectrum, 'The rectified spectral image is still discoverable.');
    assert.equal(spectrum.centralWavelengthMicrometres, undefined);
    assert.equal(spectrum.surfaceResolutionKm, undefined, 'One spatial axis cannot supply two-dimensional surface sampling.');
  });
}
