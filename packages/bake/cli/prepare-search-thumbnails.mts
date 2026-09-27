// Entry script: `pnpm prepare:search-thumbnails`. The work is in @cssearth/bake/site-assets.
import { prepareSearchThumbnails } from '@cssearth/bake/site-assets';

console.log(await prepareSearchThumbnails());
