import { isRecord } from '@cssearth/core';
import { INVESTIGATION_LEDGER_SCHEMA } from './source-schema-identifiers.js';

export const INVESTIGATION_STATUSES = ['included', 'excluded', 'unresolved', 'deferred'] as const;
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export interface InvestigationEntry {
  id: string; subject: string; status: InvestigationStatus; finding: string; revisitWhen?: string;
  /** The shared record this decision leans on (src/sources/investigations), when the reasoning is not this body's own. */
  survey?: string;
  evidence: string[];
}
export interface InvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; objectId: string; entries: InvestigationEntry[] }
export interface FacilityInvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; facilityId: string; entries: InvestigationEntry[] }

export type InvestigationEntryExpansion = (value: Record<string, unknown>, id: string, status: InvestigationStatus) => InvestigationEntry;
function plainInvestigationEntry(value: Record<string, unknown>, id: string, status: InvestigationStatus): InvestigationEntry {
 return { id, status, subject: typeof value.subject === 'string' && value.subject ? value.subject : id, finding: typeof value.finding === 'string' && value.finding ? value.finding : '',
 ...(typeof value.revisitWhen === 'string' && value.revisitWhen ? { revisitWhen: value.revisitWhen } : {}),
 evidence: Array.isArray(value.evidence) ? value.evidence.filter((item): item is string => typeof item === 'string') : [] };
}
const isStatus = (value: unknown): value is InvestigationStatus => INVESTIGATION_STATUSES.some(status => status === value);
function fail(context: string, message: string): never { throw new TypeError(`${context}: ${message}.`); }

function record(value: unknown, required: readonly string[], optional: readonly string[], context: string) {
  if (!isRecord(value)) fail(context, 'expects an object');
  for (const key of required) if (!Object.hasOwn(value, key)) fail(context, `needs ${key}`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(context, `has unknown field ${key}`);
  return value;
}

function line(value: unknown, context: string) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\n\r]/.test(value)) fail(context, 'expects one trimmed line of text');
  return value;
}

/** A ledger is a notebook: an evidence item is one line of text, a link or a note. */
export function evidenceLink(value: unknown, context: string) { return line(value, context); }

/** Validate one ledger against the object package that owns it. */
export function parseInvestigationLedger(value: unknown, objectId: string, expandEntry: InvestigationEntryExpansion = plainInvestigationEntry): InvestigationLedger {
  const context = `${objectId} investigation ledger`, raw = record(value, ['schema', 'objectId', 'entries'], [], context);
  if (raw.objectId !== objectId) fail(context, `expects objectId ${objectId}`);
  return { schema: INVESTIGATION_LEDGER_SCHEMA, objectId, entries: parseEntries(raw, context, expandEntry) };
}

/** Validate one facility ledger: the object ledger's entries, led by the sweep entries every facility answers. */
export function parseFacilityLedger(value: unknown, facilityId: string, expandEntry: InvestigationEntryExpansion = plainInvestigationEntry): FacilityInvestigationLedger {
  const context = `${facilityId} facility ledger`, raw = record(value, ['schema', 'facilityId', 'entries'], [], context);
  if (raw.facilityId !== facilityId) fail(context, `expects facilityId ${facilityId}`);
  return { schema: INVESTIGATION_LEDGER_SCHEMA, facilityId, entries: parseEntries(raw, context, expandEntry) };
}

function parseEntries(raw: Record<string, unknown>, context: string, expandEntry: InvestigationEntryExpansion): InvestigationEntry[] {
  if (raw.schema !== INVESTIGATION_LEDGER_SCHEMA) fail(context, `expects schema ${INVESTIGATION_LEDGER_SCHEMA}`);
  if (!Array.isArray(raw.entries)) fail(context, 'expects entries');
  const ids = new Set<string>();
  return raw.entries.map((value: unknown, index): InvestigationEntry => {
    const where = `${context} entry ${index + 1}`;
    if (!isRecord(value)) fail(where, 'expects an object');
    const id = line(value.id, `${where} id`);
    if (ids.has(id)) fail(where, `repeats id ${id}`);
    ids.add(id);
    if (!isStatus(value.status)) fail(where, `expects status ${INVESTIGATION_STATUSES.join(', ')}`);
    return expandEntry(value, id, value.status);
  });
}
