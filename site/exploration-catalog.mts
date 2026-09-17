import { SOURCES, SOURCE_CATALOGUE } from './sources-catalog.mts';
import input from './prepared-facilities.json' with { type: 'json' };
import { parsePreparedExploration } from '../src/platform/prepared-exploration.mts';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime.
export const EXPLORATION = parsePreparedExploration(input,SOURCES);
// Sources already checked the input files; this catalogue must be built from that same source catalogue.
if (EXPLORATION.sourceCatalogSha256 !== SOURCE_CATALOGUE.catalogSha256) throw new Error('Prepared catalogue identities disagree. Run pnpm prepare:sources.');
