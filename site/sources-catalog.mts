import input from './prepared-sources.json' with { type: 'json' };
import { parsePreparedSources } from '@cssearth/objects/provenance';
import { DATASET_ROUTES } from '../src/platform/dataset-destination.mts';
// Astro/build only. No catalogue or graph is imported by the browser runtime. The catalogue is a build output:
// predev and prebuild compile it from the source records, so the site reads it and does not re-hash its inputs.
export const SOURCE_CATALOGUE = parsePreparedSources(input,DATASET_ROUTES);
export const SOURCES = SOURCE_CATALOGUE.sources;
