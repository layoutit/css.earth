// Entry script: `pnpm prepare:search-thumbnails`. The work is in ../prepare-search-thumbnails.mts.
import { prepareSearchThumbnails } from '../prepare-search-thumbnails.mts';

console.log(await prepareSearchThumbnails());
