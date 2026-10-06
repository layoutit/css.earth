import input from '../prepared/prepared-facilities.json' with { type: 'json' };
import { parsePreparedExploration, DATASET_ROUTES } from '@cssearth/objects/provenance';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime. The citations it names were checked against
// the source catalogue when prepare-facilities wrote both files, so the pages do not load that catalogue again.
export const EXPLORATION = parsePreparedExploration(input,undefined,DATASET_ROUTES);
