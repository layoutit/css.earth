import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptsSavedResult, selectedPreviewAllowed, selectedProcessing } from './reconstruction-selection.ts';
import { reconstructionProcessingCapability } from './reconstruction-capabilities.ts';
import type { PreparedReconstruction } from './reconstruction-types.ts';

const saved = (resultId: string, method: string) => ({ resultId, processing: reconstructionProcessingCapability(method) }) as unknown as PreparedReconstruction;
const lens = saved('test-model-first-lens', 'simulation-guided-finite-material@1'), repaint = saved('test-subject-first-lens', 'alignment-density-material-v1');
const finite = { finiteModel: { modelResultId: 'test-model', bundle: 'bundle.json' }, candidates: [{ prepared: lens }, {}] };
const density = { candidates: [{ prepared: repaint }, {}] };

test('Preview follows the selected image and its owning finite model, not the displayed result', () => {
  assert.equal(selectedPreviewAllowed(finite, finite.candidates[0]), false);
  // "Unpainted density" may still be on screen after a failed lens mount; the selected image still has no repaint.
  assert.equal(selectedPreviewAllowed(finite, finite.candidates[1]), false);
  assert.match(selectedProcessing(finite, finite.candidates[1])?.reason ?? '', /offline recipe/);
  assert.equal(selectedPreviewAllowed(density, density.candidates[0]), true);
  assert.equal(selectedPreviewAllowed(density, density.candidates[1]), true);
  assert.equal(selectedPreviewAllowed(density, { prepared: { resultId: 'test-subject-second-lens' } as unknown as PreparedReconstruction }), false);
});

test('a linked or remembered result is ignored unless the current finite model baked it', () => {
  assert.equal(acceptsSavedResult(finite, lens.resultId), true);
  assert.equal(acceptsSavedResult(finite, repaint.resultId), false);
  assert.equal(acceptsSavedResult(finite, 'test-subject-third-lens'), false);
  assert.equal(acceptsSavedResult(density, 'test-subject-third-lens'), true);
});

test('the controls use these rules for links, restored display and every Preview gate', () => {
  const source = readFileSync('labs/nebula/packages/lab/src/features/reconstruction/reconstruction-controls-react.tsx', 'utf8');
  assert.match(source, /const previewAllowed = \(\) => selectedPreviewAllowed\(catalogue, candidate\(\)\);/);
  assert.match(source, /if \(requested && acceptsSavedResult\(value, requested\)\)/);
  assert.match(source, /restoreDisplay && selection\.displayedResultId && catalogue && acceptsSavedResult\(catalogue, selection\.displayedResultId\)/);
  assert.match(source, /processing: selectedProcessing\(catalogue, row\), processDisabled: !previewAllowed\(\)/);
});
