import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combinationContract, combinationReport, parseCombinations } from './combinations.mts';
import { signature } from './qualification.mts';
import type { RegisteredJourney } from './registry.mts';
test('the thirteen representatives close exactly the 159 S0 combinations', async () => {
  const contract = await combinationContract();
  assert.equal(contract.combinations.length, 159);
  const report = combinationReport([], contract, []);
  assert.equal(report.counts, 'combinations 0/159'); assert.equal(report.unreached.length, 159);
  assert.throws(() => parseCombinations({ ...contract, combinations: contract.combinations.slice(1) }), /Invalid/u);
});
test('a prepared declaration or experimental witness cannot credit a combination', async () => {
  const contract = await combinationContract();
  const journey: RegisteredJourney = { id: 'lmc', status: { desktop: 'qualified' }, exercises: [], async run() {} };
  const combination = 'lmc | controls.datasets | direct-load:server-adoption';
  const proof = [{ journey: 'lmc', profile: 'desktop', signature: signature(journey), observed: ['control:dataset'], combinations: [combination], captures: 40, evidence: 'output/fixture' }];
  const report = combinationReport([journey], contract, proof);
  assert.equal(report.counts, 'combinations 1/159');
  assert.deepEqual(report.reached, ['controls.datasets | direct-load:server-adoption']);
  assert.equal(combinationReport([{ ...journey, status: { desktop: 'experimental' } }], contract, proof).counts, 'combinations 0/159');
  assert.equal(combinationReport([journey], contract, [{ ...proof[0]!, combinations: [] }]).counts, 'combinations 0/159');
  assert.equal(combinationReport([{ ...journey, async run() { throw new Error('changed'); } }], contract, proof).counts, 'combinations 0/159');
});
