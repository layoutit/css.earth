import assert from 'node:assert/strict';
import test from 'node:test';
import { PREPARED_MOON_SCENE } from '../src/planets/moon/runtime/preparedScene.mjs';
import { objectControls } from '../src/planets/moon/site/control-content.mjs';
import { createRepresentationReceipt, requireRepresentationReceipt, representationHash as sha } from './prepared-representation-receipt.mjs';

function sample() {
  // Existing Moon source, not an invented application object.
  const scene = PREPARED_MOON_SCENE;
  const semantic = { nodes: scene.body.bands, camera: scene.camera, frames: scene.material ?? null,
    controls: objectControls, resources: scene.body.assets };
  const before = { 'runtime/preparedScene.mjs': sha(scene), 'runtime-assets.json': sha(scene.body.assets) };
  const after = { ...before, 'runtime/preparedPresentation.mjs': sha({ nodes: scene.body.bands }) };
  const args = { objectId: 'moon', baselineSource: sha('baseline'), candidateSource: sha('candidate'),
    before, after, inputPaths: ['runtime/preparedScene.mjs'], baselineFacts: semantic, candidateFacts: structuredClone(semantic) };
  return { args, receipt: createRepresentationReceipt(args) };
}
test('a representation addition requires exact old/new hashes and independent semantic observations', () => {
  const {args,receipt}=sample();
  assert.equal(requireRepresentationReceipt(receipt,args),receipt);
});
for (const field of ['nodes','camera','frames','controls','resources']) test(`changed ${field} fails even if the candidate receipt was recomputed`, () => {
  const {args}=sample(); args.candidateFacts[field]={ changed: args.candidateFacts[field] };
  assert.throws(()=>createRepresentationReceipt(args),/correspondence/);
});
for (const field of ['before','after']) test(`an unlisted ${field} file fails`, () => {
  const {args,receipt}=sample();args[field]={...args[field], 'runtime/unlisted.mjs':sha('unexpected')};
  assert.throws(()=>requireRepresentationReceipt(receipt,args),/file hashes/);
});
test('source mismatch, a missing witness, and a changed original input each fail', () => {
  for(const mutate of [r=>r.baselineSource=sha('different'),r=>delete r.witnesses.before.nodes,
    r=>r.changes[0].inputs[0].sha256=sha('wrong')]) {
    const {args,receipt}=sample();mutate(receipt);assert.throws(()=>requireRepresentationReceipt(receipt,args));
  }
});
test('a receipt cannot silently authorize changed controls', () => {
  const {args}=sample();args.candidateFacts.controls={ lenses:['only'] };
  assert.throws(()=>createRepresentationReceipt(args),/controls correspondence/);
  args.behaviorCorrection={kind:'exclusive-interior-lens',before:args.baselineFacts.controls,after:args.candidateFacts.controls};
  const receipt=createRepresentationReceipt(args);
  const forged={...args,behaviorCorrection:{...args.behaviorCorrection,after:{lenses:[]}}};
  assert.throws(()=>requireRepresentationReceipt(receipt,forged),/corrected control behavior/);
});
