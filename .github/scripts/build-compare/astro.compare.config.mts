/** Production config plus hidden client maps and read-only module observation. */
import { existsSync } from 'node:fs';
import { mergeConfig } from 'astro/config';
import { comparisonMetadata } from './observation/metadata.mts';

// The checkout's own config: under site/, or at the root in revisions from before it moved.
const candidates = ['../../../site/astro.config.mts', '../../../astro.config.mts'].map(path => new URL(path, import.meta.url));
const located = candidates.find(url => existsSync(url));
if (!located) throw new Error('No Astro config in site/astro.config.mts or astro.config.mts');
const loaded: unknown = await import(located.href);
if (!loaded || typeof loaded !== 'object' || !('default' in loaded) || !loaded.default || typeof loaded.default !== 'object') throw new Error(`${located.pathname} has no default config`);
const production: Record<string, unknown> = { ...loaded.default };
const output = process.env.CSSEARTH_COMPARISON_METADATA;
if (!output) throw new Error('Use build.mts to set the comparison metadata directory');
const mapPolicy = { addedClientMaps: false };
export default mergeConfig(production, { vite: {
  plugins: [comparisonMetadata(process.cwd(), output, false, mapPolicy)],
  worker: { plugins: () => [comparisonMetadata(process.cwd(), output, true, mapPolicy)] },
} });
