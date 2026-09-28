// Entry script: `pnpm prepare:lens-billboards`. Writes the lens billboards of the checkout it runs in; the work is
// `prepareLensBillboards` in @cssearth/bake/site-assets.
import { prepareLensBillboards } from '@cssearth/bake/site-assets';

console.log(await prepareLensBillboards());
