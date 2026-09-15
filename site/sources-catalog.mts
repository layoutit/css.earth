import input from './prepared-sources.json' with { type: 'json' };
import { parsePreparedSources } from '../src/platform/prepared-sources.mts';
import { checkSourceCatalog } from '../tools/read-source-catalogue.mts';
// Astro/build only. No catalogue or graph is imported by the browser runtime.
export const SOURCE_CATALOGUE = parsePreparedSources(input);
await checkSourceCatalog(process.cwd(), SOURCE_CATALOGUE);
export const SOURCES = SOURCE_CATALOGUE.sources;
