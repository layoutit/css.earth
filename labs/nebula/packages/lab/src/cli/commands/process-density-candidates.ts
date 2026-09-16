/** Explicit, resumable research comparisons; never promotes projection-only material to the application. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStarRemover, resolveAppliedRemovalLayers } from '../../server/services/star-removal.ts';
import { bakeDensity } from '../../server/workflows/density/assets.ts';
import { createReconstructor, reconstructionCatalogue } from '../../server/services/density-reconstruction.ts';

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
  return value as Record<string, unknown>;
}
function rows(value: unknown) { assert.ok(Array.isArray(value)); return value.map(record); }
function text(value: unknown) { assert.equal(typeof value, 'string'); return value as string; }
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const root = process.cwd();
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [path, ...extra] = process.argv.slice(2);
assert.ok(path && !extra.length, 'Usage: process-density-candidates <recipe.json>');
const recipeBytes = await readFile(path), recipe = record(JSON.parse(recipeBytes.toString()));
assert.equal(recipe.schema, 'cssearth-density-comparison@1');
const subjectId = text(recipe.subjectId), imageIds = recipe.imageIds;
assert.match(subjectId, /^[a-z0-9-]+$/);
assert.ok(Array.isArray(imageIds) && imageIds.length && imageIds.every(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)));
assert.equal(new Set(imageIds).size, imageIds.length);
const subject = rows(await json('labs/nebula/packages/lab/src/state/subjects.json')).find(item => item.id === subjectId);
assert.ok(subject);
const plan = record(await json(text(record(subject.density).processingPlan)));
const proofPin = record(plan.alignmentReport), proofBytes = await readFile(text(proofPin.path));
assert.equal(hash(proofBytes), proofPin.sha256);
const proof = record(JSON.parse(proofBytes.toString()));
assert.equal(proof.pass, true, 'Alignment must pass before processing');
const sources = rows(proof.sources);
const inputs = rows(record(await json(text(plan.catalogue))).targets).flatMap(target => rows(target.images));
for (const id of imageIds) {
  const source = sources.find(item => item.id === id), input = inputs.find(item => item.id === id);
  assert.ok(source && input, `Missing alignment proof: ${id}`);
  assert.equal(source.pass, true, `Alignment failed: ${id}`);
  assert.equal(source.sourcePath, input.path); assert.equal(source.sourceSha256, input.sha256);
  const geometry = input.registration ? { kind: 'matched-star-homography', registration: input.registration } : { kind: 'fixed-publisher-wcs', wcs: input.wcs };
  assert.deepEqual(source.geometry, geometry);
  const gate = record(source.gate); assert.equal(hash(await readFile(text(gate.path))), gate.sha256);
}
await bakeDensity(root, text(record(subject.density).directory));
const directory = resolve(root, '.local/nebula-lab/density-comparisons', subjectId);
await mkdir(directory, { recursive: true });
const receipt = { schema: 'cssearth-density-comparison-receipt@1', recipe: { path, sha256: hash(recipeBytes) },
  subjectId, qualification: 'Projection-only fixed-density research comparison; not qualified 3D emission or application promotion.',
  results: [] as { imageId: string; removalResultId: string; resultId: string }[] };
const remove = createStarRemover(root), reconstruct = createReconstructor(root);
const controller = new AbortController();
const abort = () => controller.abort(); process.once('SIGINT', abort); process.once('SIGTERM', abort);
try {
  for (const imageId of imageIds) {
    const candidate = (await reconstructionCatalogue(root, subjectId)).candidates.find(item => item.imageId === imageId);
    assert.ok(candidate, `Unknown image: ${imageId}`);
    let stage = '', last = 0;
    const progress = (event: {stage: string; current: number; total: number; message: string}) => {
      if (stage !== event.stage || Date.now() - last > 5000 || event.current === event.total) {
        console.log(`${imageId} ${event.stage} ${event.current}/${event.total}: ${event.message}`); stage = event.stage; last = Date.now();
      }
    };
    let removalResultId = candidate.removalResultId;
    if (removalResultId) {
      await resolveAppliedRemovalLayers(root, removalResultId, imageId, candidate.sourcePreviewSha256);
      console.log(`${imageId} verified saved native removal`);
    } else {
      const removal = await remove({ imageId, action: 'apply' }, controller.signal, progress);
      removalResultId = text(record(record(removal).applied).resultId);
    }
    assert.ok(removalResultId);
    const result = await reconstruct({ action: 'apply', subjectId, imageId, removalResultId, placement: candidate.placement }, controller.signal, progress);
    receipt.results.push({ imageId, removalResultId, resultId: result.resultId });
    const destination = resolve(directory, 'receipt.json');
    await writeFile(destination + '.pending', JSON.stringify(receipt, null, 2) + '\n');
    await rename(destination + '.pending', destination);
    console.log(`DENSITY_COMPARISON_READY ${imageId} ${result.resultId}`);
  }
  console.log(`DENSITY_COMPARISONS_COMPLETE ${receipt.results.length}`);
} finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
