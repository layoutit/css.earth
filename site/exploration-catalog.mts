import { SOURCES, SOURCE_CATALOGUE } from './sources-catalog.mts';
import input from './prepared-machines.json' with { type: 'json' };
import { parsePreparedExploration } from '../src/platform/prepared-exploration.mts';

// This module is an Astro/build owner. Only each body's prepared cards become
// HTML; the catalogue, provenance and compiler never enter the scene runtime.
export const EXPLORATION = parsePreparedExploration(input,SOURCES);
// Sources already checked these files. Both catalogues must use that exact set.
if (JSON.stringify(EXPLORATION.closure) !== JSON.stringify(SOURCE_CATALOGUE.closure)) throw new Error('Prepared catalogue inputs disagree. Run pnpm prepare:sources.');
if (EXPLORATION.sourceCatalogSha256 !== SOURCE_CATALOGUE.catalogSha256) throw new Error('Prepared catalogue identities disagree. Run pnpm prepare:sources.');
