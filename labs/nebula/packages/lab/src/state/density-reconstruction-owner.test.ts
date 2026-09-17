import test from 'node:test';
import assert from 'node:assert/strict';
import { densityReconstructionOwner } from './lab-workflows.ts';
test('density reconstruction follows capabilities and the exact model owner', () => {
  const subjects = [
    { id: 'lmc-clouds', density: { processingPlan: 'lmc.json' } },
    { id: 'smc-constrained', sourceSubjectId: 'smc', density: { processingPlan: 'smc.json' } },
    { id: 'future-cloud', density: { processingPlan: 'future.json' } },
    { id: 'reconstruction-saved', sourceSubjectId: 'smc-constrained', density: { processingPlan: 'smc.json' } },
    { id: 'unprepared' },
  ];
  for (const id of ['lmc-clouds', 'smc-constrained', 'future-cloud']) assert.equal(densityReconstructionOwner(subjects, id), id);
  assert.equal(densityReconstructionOwner(subjects, 'reconstruction-saved'), 'smc-constrained');
  assert.equal(densityReconstructionOwner(subjects, 'unprepared'), null);
  assert.equal(densityReconstructionOwner(subjects, 'missing'), null);
  assert.equal(densityReconstructionOwner([{ id: 'reconstruction-loop', sourceSubjectId: 'reconstruction-loop' }], 'reconstruction-loop'), null);
});
