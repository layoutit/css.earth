// Entry script: node packages/bake/cli/published-comparison.mts <object-id> [--write]. Measures a ground-based dataset against its
// paper's comparison figure through the pipeline's own cameras (`measurePublishedComparison` in
// @cssearth/bake/objects/sphere-survey); `--write` records the evidence and the README's comparison block.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measurePublishedComparison, writeComparisonEvidence } from '@cssearth/bake/objects/sphere-survey';
import { comparisonBlock, parseComparisonEvidence, withComparisonBlock } from '@cssearth/bake/objects/layers/terrestrial';

/** The checkout this command belongs to, whatever directory it is run from. */
const ROOT = resolve(import.meta.dirname, '../../..');
const [objectId, flag] = process.argv.slice(2);
if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node packages/bake/cli/published-comparison.mts <object-id> [--write]'); process.exit(2); }
const result = await measurePublishedComparison(objectId, { root: ROOT, adopt: flag === '--write' }), { evidence } = result;
for (const c of evidence.columns) console.log(`${c.label}  overlap with the paper's model ${c.overlapWithModel}, with its photograph ${c.overlapWithPhotograph}, same shape at both scales ${c.sameShapeOverlap}; best turn ${c.bestTurnDegrees}°; image turn onto the model ${c.imageTurnDegrees.model}°, onto the photograph ${c.imageTurnDegrees.photograph}°; axis ours ${c.axis.oursDegrees}° against ${c.axis.paperDegrees}° (${c.axis.differenceDegrees}°)`);
const o = evidence.nativeOutline;
console.log(`native outline over ${o.frames} frames: ${o.residualPixelsAtZero} px at our phase, smallest at ${o.bestOffsetDegrees}°`);
if (flag === '--write') {
  await writeComparisonEvidence(result, resolve(ROOT, 'src/objects', objectId, 'evidence'));
  const readmePath = resolve(ROOT, 'src/objects', objectId, 'README.md'), { readme, replaced } = withComparisonBlock(await readFile(readmePath, 'utf8'), comparisonBlock(parseComparisonEvidence(evidence)));
  if (replaced) { await writeFile(readmePath, readme); console.log(`Wrote the comparison block into ${objectId}/README.md.`); }
  console.log(`Wrote evidence/published-comparison.json and its image for ${objectId}.`);
}
