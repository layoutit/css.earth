/** Production config plus hidden client maps and read-only module observation. */
import { mergeConfig } from 'astro/config';
import production from '../../../astro.config.mts';
import { comparisonMetadata } from './metadata.mts';

const output = process.env.CSSEARTH_COMPARISON_METADATA;
if (!output) throw new Error('Use build.mts to set the comparison metadata directory');
const mapPolicy = { addedClientMaps: false };
export default mergeConfig(production, { vite: {
  plugins: [comparisonMetadata(process.cwd(), output, false, mapPolicy)],
  worker: { plugins: () => [comparisonMetadata(process.cwd(), output, true, mapPolicy)] },
} });
