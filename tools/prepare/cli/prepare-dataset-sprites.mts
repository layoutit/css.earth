// Entry script: `pnpm prepare:dataset-sprites`. The work is in ../prepare-dataset-sprites.mts.
import { prepareDatasetSprites } from '../prepare-dataset-sprites.mts';

console.log(`Prepared ${await prepareDatasetSprites()} object dataset sprites.`);
