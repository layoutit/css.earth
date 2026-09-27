import { SOURCES } from './sources-catalog.mts';
import input from './prepared-facilities.json' with { type: 'json' };
import { parsePreparedExploration } from '@cssearth/objects/provenance';
import { DATASET_ROUTES } from '../src/platform/dataset-destination.mts';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime.
export const EXPLORATION = parsePreparedExploration(input,SOURCES,DATASET_ROUTES);
