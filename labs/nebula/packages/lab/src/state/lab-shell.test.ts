import assert from 'node:assert/strict';
import test from 'node:test';
import { labPresentation } from './lab-shell';

const alignment = { busy: false, alignment: true, densityMode: true, densityAvailable: true,
  overlaysAvailable: true, referenceAvailable: true, observationInspection: false, cloudAvailable: false,
  reconstructionImages: false, sourceCredit: 'Pinned source', status: { message: '', hidden: true, error: false } };
test('workflow state selects alignment controls, reconstruction controls and observation workspaces without DOM reads', () => {
  const view = labPresentation(alignment);
  assert.equal(view.imageAdjustments, true); assert.equal(view.densityAdjustments, true);
  assert.equal(view.cloudAdjustments, false); assert.equal(view.cameraDisabled, false);
  const reconstruction = labPresentation({ ...alignment, alignment: false, densityMode: false, cloudAvailable: true, reconstructionImages: true });
  assert.equal(reconstruction.imageAdjustments, false); assert.equal(reconstruction.densityAdjustments, false);
  assert.equal(reconstruction.cloudAdjustments, true); assert.equal(reconstruction.cloudDensity, true);
  assert.equal(reconstruction.toneDisabled, true);
  const observation = labPresentation({ ...alignment, densityAvailable: false, overlaysAvailable: false, observationInspection: true });
  assert.equal(observation.viewerHidden, true); assert.equal(observation.imageAdjustments, false); assert.equal(observation.cameraDisabled, true);
  assert.equal(labPresentation({ ...alignment, busy: true }).cameraDisabled, true);
});
