#!/usr/bin/env node
// Entry script: node tools/prepare/cli/check-preparation-inputs.mts <object-id>.... The checks are in ../check-preparation-inputs.mts.
import { resolve } from 'node:path';
import { deriveRestoredPreparedFiles } from '../../assets/setup.mts';
import { missingPreparedFiles, restoreDriftedFiles, textBudgetFindings, worldStepOutput } from '../check-preparation-inputs.mts';

const root = resolve(import.meta.dirname, '../../..');

const ids = process.argv.slice(2);
if (!ids.length) throw new TypeError('Usage: check-preparation-inputs <object-id>...');
const findings = await textBudgetFindings(ids), missing = await missingPreparedFiles(ids);
if (missing.length) {
  console.error(`${missing.length} prepared file(s) of other objects are missing or the wrong size (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''}). `
    + 'The bake rebuilds the catalogue and the Sun\'s world files from them, so it stops here. Restore them first: pnpm setup:assets, then pnpm prepare:object-json.');
  process.exitCode = 1;
} else if (findings.length) {
  console.error(`Reader text breaks its budgets; fix it before the bake, or the text step refuses it after:\n${findings
    .map(({ objectId, slot, rule, detail }) => `  src/objects/${objectId}/text.json ${slot}: ${rule}, ${detail}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Reader text is within its budgets.');
  if (!ids.includes('sun')) {
    const restored = await restoreDriftedFiles('sun', { keep: worldStepOutput });
    if (restored.length) console.log(`Restored ${restored.length} Sun file(s) that differed from its inventory, before the world and pins steps build on them: ${restored.join(', ')}.`);
    // A checkout that never restored the Sun also lacks the page data derived from it, which the provenance step reads.
    await deriveRestoredPreparedFiles(['sun'], root);
  }
}
