/** Record the completed tiny integration separately from an all-region conversion. */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { json, rec, need, array } from '../inputs.mts';
import { COMPONENT_DIR } from './component-bank.mts';
import { SHAPE_DIR, readShapeSource } from './source.mts';
import { approvedScene } from '../delivery/reference.mts';
import { allFiniteRegions } from './all-source.mts';

export async function recordComponents() {
  const pilot = rec(await json(COMPONENT_DIR + 'pilot/result.json')), restored = rec(await json(SHAPE_DIR + 'restored.json')), source = await readShapeSource();
  need(pilot.complete === true && array(pilot.rows).length === 10 && pilot.layers === 33, 'The complete real-site integration pilot is required');
  need(restored.complete === true && restored.bankRestored === true && restored.inventoryBytesIdentical === true && restored.descriptorBytesIdentical === true && restored.contextTableBytesIdentical === true, 'The accepted delivery must be restored');
  const replay = await readFile('output/lmc-approved-delivery/components-mw-replay.log', 'utf8');
  need(replay.includes('PRODUCTION REPLAY VERIFIED: 33 slabs and 6 sky faces') && replay.includes('# fail 0'), 'A fresh default Milky Way replay is required');
  const losses = await Promise.all(['background', 'cloud', 'shell'].map(async id => ({ id, loss: rec(await json(SHAPE_DIR + 'banks/' + id + '/encoding.json')).faceOnEffectiveAlphaLoss })));
  const approved = await approvedScene(), regions = allFiniteRegions(approved.scene, approved.amplitudes);
  const sweep = await readFile('output/lmc-approved-delivery/components-package-tests.log', 'utf8'), rerun = await readFile('output/lmc-approved-delivery/components-package-reruns.log', 'utf8');
  const count = (log: string, field: string) => { const values = [...log.matchAll(new RegExp('^# ' + field + ' (\\d+)$', 'gmu'))]; need(values.length > 0, 'Missing completed test summary'); return Number(values.at(-1)![1]); };
  need(count(rerun, 'fail') === 0, 'The initially failing environment cases must pass their rerun');
  const record = { schema: 'cssearth-lmc-independent-components@1', model: 'l36', approvedCommit: source.approvedCommit,
    generator: 'packages/bake/authoring/lmc-volume/shape-pilot/record-components.mts', sourceParametersChanged: 0,
    status: 'Shared independent-component integration demonstrated at the tiny rung. All-region conversion is not complete.',
    size: 128, totalOpticalLayers: 33, primaryLayers: 11, separateRegions: ['N44G', 'Thirty Doradus'], availableCatalogueGasRegions: regions.length, finiteGasPrimitives: regions.reduce((n, r) => n + r.emitters.length, 0),
    otherRegions: 'The other catalogue regions remain in the existing background for this integration pilot.',
    runtime: { sharedLocalFrames: true, normalizedTransparentAxisShares: true, rootCount: 9, retainedMaterialUpdates: true, defaultVolumePathUnchanged: true },
    evidence: { directory: COMPONENT_DIR + 'pilot/', wholeGalaxyViews: ['earth', 'pz', 'tilt45', 'py'], closeViews: ['cloud-0-0', 'cloud-45-0', 'cloud-90-0', 'shell-0-0', 'shell-45-0', 'shell-90-0'], pageErrors: [], layerAndNormalizedShareAssertionsPassed: true },
    tests: { localFramesMutationCaught: true, opaqueMixingMutationCaught: true, competingPreviewLeaseRefused: true, sourceEmissionAndPhysicalScaleRegressions: true,
      fullPackageSweep: { tests: count(sweep, 'tests'), passed: count(sweep, 'pass'), initialFailures: count(sweep, 'fail'), skipped: count(sweep, 'skipped'), rerunTests: count(rerun, 'tests'), rerunFailures: 0, note: 'The initial built-chunk resolution failure and three missing-NumPy cases passed after builds settled and the existing Python environment was selected.' } },
    milkyWayReplay: { slabs: 33, skyFaces: 6, bytesIdentical: true, inventoryBytesIdentical: true }, restoration: restored,
    mergedAlphaLoss: { definition: 'Effective face-on encoded alpha loss, not luminosity loss.', banks: losses },
    limits: ['This record qualifies the shared integration mechanism, not the visual or photometric quality of an all-region bake.', 'Finite components composite in prepared order over the parent field; arbitrary interleaving of gas, stars and dust is not represented.', 'Existing per-object color and optical encoding residuals remain. The tiny continuous background is deliberately coarse.', 'All 409 regions need additional geometry beyond the original whole-scene 33-layer limit. Owner clarification is pending.', 'The full site build remains blocked by the previously missing Abell 1689 Chandra source preview.', 'No Android device is connected. Phone performance is unqualified.'],
  };
  await writeFile('src/objects/lmc-volume/source/preparation/l36/components.json', JSON.stringify(record, null, 2) + '\n');
  console.log('LMC_COMPONENT_INTEGRATION_RECORDED'); return record;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await recordComponents();
