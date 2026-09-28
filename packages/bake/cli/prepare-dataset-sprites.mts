// Entry script: `pnpm prepare:dataset-sprites`. The work is in @cssearth/bake/site-assets.
import { prepareDatasetSprites } from '@cssearth/bake/site-assets';

console.log(`Prepared ${await prepareDatasetSprites()} object dataset sprites.`);
