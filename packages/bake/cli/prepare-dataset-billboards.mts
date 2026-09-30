// Entry script: `pnpm prepare:dataset-billboards`. Writes the dataset billboards of the checkout it runs in; the work is
// `prepareDatasetBillboards` in @cssearth/bake/site-assets.
import { prepareDatasetBillboards } from '@cssearth/bake/site-assets';

console.log(await prepareDatasetBillboards());
