/** Every archive the telescope asks or keeps a ledger of, described once. `explore` runs each `search`
 * (exploration.mts); the registry check compares each `registry` address (vo/registry-check.mts); `ledgers.mts` runs each
 * `ledgerCommand`; and an archive with a ledger has a coverage reader under the same id (observation-query/query-modes.mts `ADAPTERS`, which
 * archives.test.mts holds to this list). An archive's own code stays in its folder; this is the list, not the code. */
import type { IcrsCircle } from '@cssearth/objects';
import type { TargetCatalogueEntry } from '@cssearth/telescope';
import { searchGeminiLeads, searchKeckLeads, type ArchiveLeadFilter, type ArchiveLeadService, type LeadPosition } from '../archive-adapters/archive-leads.mts';
import { searchChandraLeads, searchSpitzerLeads } from '../archive-adapters/other-leads.mts';
import { SERVICES } from '../vo/discovery.mts';
import { TAP as CHANDRA_TAP } from './chandra/archive.mts';
import { CADC_TAP } from './gemini/cadc.mts';
import { TAP_SYNC as KOA_TAP } from './keck/koa.mts';

export interface ArchiveSearchContext {
  /** The circle the reader asked for. */
  readonly region?: IcrsCircle;
  /** Where a target that does not move is on the sky. */
  readonly position?: LeadPosition;
  readonly filter?: ArchiveLeadFilter;
}
export interface ArchiveDescription {
  readonly id: string;
  readonly name: string;
  /** Its TAP service as the registry of Virtual Observatory services names it, and the address pinned for it here. */
  readonly registry?: { readonly ivoid: string; readonly address: string };
  /** The live search `explore` runs for a target, beside the observation search of the VO profiles (vo/discovery.mts). */
  readonly search?: (root: string, target: TargetCatalogueEntry, context: ArchiveSearchContext) => Promise<ArchiveLeadService>;
  /** The command that builds its ledger, `src/sources/<id>/ledger.json`. */
  readonly ledgerCommand?: string;
  /** True when that command takes `--write` and `--local` (archives/ledger.mts `runArchiveLedger`). */
  readonly sharedLedgerCommand?: true;
}

/** A VO profile's registry identifier and pinned address, read from the profile so neither is written twice. */
const profile = (ivoid: string) => { const found = SERVICES.find(service => service.authority === ivoid); if (!found) throw new TypeError(`No VO profile is named ${ivoid}.`); return { ivoid, address: found.service }; };
const ledger = (id: string) => ({ ledgerCommand: `packages/telescope-cli/src/archives/${id}/archive-ledger.mts`, sharedLedgerCommand: true as const });
const CADC = { ivoid: 'ivo://cadc.nrc.ca/argus', address: CADC_TAP }, ESO = profile('ivo://eso.org/tap_obs'), MAST = profile('ivo://archive.stsci.edu/caomtap');

export const ARCHIVES: readonly ArchiveDescription[] = [
  { id: 'eso', name: 'ESO Science Archive', registry: ESO },
  { id: 'alma', name: 'ALMA Science Archive', registry: profile('ivo://jao.alma/tap_eu') },
  { id: 'psa', name: 'ESA Planetary Science Archive', registry: profile('ivo://esavo/psa/epntap') },
  { id: 'jwst', name: 'JWST at MAST', registry: MAST, ...ledger('jwst') },
  { id: 'hst', name: 'Hubble at MAST', registry: MAST, ...ledger('hst') },
  { id: 'naco', name: 'VLT/NACO at ESO', registry: ESO, ...ledger('naco') },
  { id: 'keck', name: 'Keck Observatory Archive', registry: { ivoid: 'ivo://koa.ipac/tap', address: KOA_TAP }, ...ledger('keck'),
    search: (root, target, { position, filter }) => searchKeckLeads(root, target, undefined, filter, position) },
  { id: 'gemini', name: 'Gemini at CADC', registry: CADC, ...ledger('gemini'),
    search: (root, target, { position, filter }) => searchGeminiLeads(root, target, undefined, filter, position) },
  { id: 'espadons', name: 'CFHT ESPaDOnS at CADC', registry: CADC, ...ledger('espadons') },
  { id: 'chandra', name: 'Chandra Data Archive', registry: { ivoid: 'ivo://cxc.harvard.edu/cda', address: CHANDRA_TAP }, ...ledger('chandra'),
    search: (root, target, { region, filter }) => searchChandraLeads(root, target, region, undefined, filter) },
  { id: 'spitzer', name: 'Spitzer Heritage Archive', ...ledger('spitzer'),
    search: (root, target, { region, filter }) => searchSpitzerLeads(root, target, region, undefined, filter) },
  { id: 'juno', name: 'JunoCam', ...ledger('juno') },
  { id: 'ihw', name: 'International Halley Watch at PDS', ledgerCommand: 'packages/telescope-cli/src/archives/ihw/archive-ledger.mts' },
  { id: 'pds', name: 'Planetary Data System', ledgerCommand: 'packages/telescope-cli/src/archives/pds/archive-ledger.mts' },
];
