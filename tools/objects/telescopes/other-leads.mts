/** Live, bounded source identities from existing Chandra and Spitzer archive owners. */
import { observationsOf, shippedObjects as chandraObjects } from '../chandra/archive-ledger.mts';
import { cxcQuery, TAP as CHANDRA_TAP } from '../chandra/archive.mts';
import { observationRecords, shippedObjects as spitzerObjects } from '../spitzer/archive-ledger.mts';
import { SEARCH as SPITZER_SEARCH, shaSearch } from '../spitzer/archive.mts';
import { saveArchiveLeadEvidence, type ArchiveLeadService, type ChandraSourceLead, type SpitzerSourceLead } from './archive-leads.mts';
import type { TargetCatalogueEntry } from './targets.mts';
import type { IcrsCircle } from './vo/contracts.mts';

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const LIMIT = 100;

export async function searchChandraLeads(root: string, target: TargetCatalogueEntry, region?: IcrsCircle,
  query: typeof cxcQuery = cxcQuery): Promise<ArchiveLeadService> {
  const scope = `Chandra archived observations for the target's shipped name or sky position; first ${LIMIT} archive rows, up to 3 ObsIDs per instrument`;
  try {
    const object = (await chandraObjects()).find(entry => entry.id === target.id) ??
      (region ? { id: target.id, raDeg: region.raDegrees, decDeg: region.decDegrees, source: 'explicit ICRS search region' } : undefined);
    if (!object) return { service: CHANDRA_TAP, state: 'unavailable', scope, reason: 'No Chandra name or sky-position search mapping exists for this target.', instruments: [] };
    const rows = await observationsOf(object, query, region?.radiusDegrees, LIMIT), pin = await saveArchiveLeadEvidence(root, CHANDRA_TAP, object, rows);
    const groups = new Map<string, { telescope: string; instrument: string; records: number; sample: string }>();
    const sources: ChandraSourceLead[] = [];
    for (const row of rows) {
      const instrument = `${row.instrument}${row.grating.toUpperCase() === 'NONE' ? '' : `/${row.grating}`}`;
      const group = groups.get(instrument) ?? { telescope: 'Chandra', instrument, records: 0, sample: String(row.obsid) };
      group.records++; groups.set(instrument, group);
      if (group.records <= 3) sources.push({ obsid: row.obsid, targetName: row.targetName, instrument: row.instrument,
        grating: row.grating, startDate: row.startDate, evidence: pin });
    }
    return { service: CHANDRA_TAP, state: rows.length >= LIMIT ? 'overflow' : rows.length ? 'sampled' : 'empty-in-scope', scope,
      reason: `${rows.length} archived ObsID(s) in this bounded query. A position match and archive target name do not prove target detection.`,
      instruments: [...groups.values()], sources, evidence: [pin] };
  } catch (error) { return { service: CHANDRA_TAP, state: 'unavailable', scope, reason: errorText(error), instruments: [] }; }
}

export async function searchSpitzerLeads(root: string, target: TargetCatalogueEntry, region?: IcrsCircle,
  query: typeof shaSearch = shaSearch): Promise<ArchiveLeadService> {
  const scope = `Spitzer Heritage Archive AORs by the target's NAIF identity or sky position; first ${LIMIT} rows, up to 3 AORs per mode`;
  try {
    const object = (await spitzerObjects()).find(entry => entry.id === target.id);
    const route = object?.query.kind === 'none' || !object ? region ? { kind: 'position' as const, raDeg: region.raDegrees,
      decDeg: region.decDegrees, radiusDeg: region.radiusDegrees } : undefined : object.query;
    if (!route) return { service: SPITZER_SEARCH, state: 'unavailable', scope,
      reason: object?.query.kind === 'none' ? object.query.reason : 'No Spitzer NAIF identity or sky position exists for this target.', instruments: [] };
    const request: Record<string, string> = route.kind === 'naif' ? { id: 'aorByNaifID', naifID: String(route.naifId) }
      : { id: 'aorByPosition', position: `${route.raDeg};${route.decDeg};EQ_J2000`, radius: String(route.radiusDeg) };
    const rows = await query(request, { timeoutMs: 20_000, attempts: 1 });
    const records = observationRecords(rows.slice(0, LIMIT)), pin = await saveArchiveLeadEvidence(root, SPITZER_SEARCH, request, rows.slice(0, LIMIT));
    const groups = new Map<string, { telescope: string; instrument: string; records: number; sample: string }>();
    const sources: SpitzerSourceLead[] = [];
    for (const row of records) {
      const aorKey = Number(row.id);
      if (!Number.isSafeInteger(aorKey) || aorKey < 1) throw new TypeError(`Spitzer returned an invalid AORKEY ${row.id}.`);
      const raw = rows.find(entry => entry.reqkey === row.id);
      const instrument = row.mode.split(' ')[0] ?? row.mode;
      const group = groups.get(row.mode) ?? { telescope: 'Spitzer', instrument: row.mode, records: 0, sample: row.id };
      group.records++; groups.set(row.mode, group);
      if (group.records <= 3) sources.push({ aorKey, targetName: raw?.targetname ?? '', instrument, mode: row.mode,
        startIso: row.startIso, evidence: pin });
    }
    return { service: SPITZER_SEARCH, state: rows.length >= LIMIT ? 'overflow' : records.length ? 'sampled' : 'empty-in-scope', scope,
      reason: `${records.length} AOR(s) in this bounded query. AOR title and sky position do not prove target detection.`,
      instruments: [...groups.values()], sources, evidence: [pin] };
  } catch (error) { return { service: SPITZER_SEARCH, state: 'unavailable', scope, reason: errorText(error), instruments: [] }; }
}
