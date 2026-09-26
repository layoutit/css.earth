// Entry script: node tools/prepare/cli/prepare-ci-inputs.mts universe|universe-preparation. The work is in ../prepare-ci-inputs.mts.
import { requireCiInputMode, restoreCiPreparationInputs, restoreCiUniverseInputs } from '../prepare-ci-inputs.mts';

const mode = requireCiInputMode(process.argv.slice(2));
const restore = mode === 'universe' ? restoreCiUniverseInputs : restoreCiPreparationInputs;
const result = await restore({ onProgress: ({ completed, total }) => {
  if (completed % 100 === 0 || completed === total) console.log(`${mode} inputs: ${completed}/${total}`);
} });
console.log(`${mode} inputs ready: ${JSON.stringify(result)}`);
