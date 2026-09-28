/** An object's investigation ledger: every source, route, lens or frame examined for it, what was decided, the evidence and what
 * would reopen the decision. It lives beside the body README, outside `source/`, so recording an investigation never changes
 * preparation inputs.
 *
 * A facility keeps the same ledger in src/facilities/<facility id>/investigations.json: what was examined about a telescope's
 * archive, data policy and reduction software, and what was run from it. Every facility ledger answers the same three sweep
 * entries (FACILITY_SWEEP), so facilities compare side by side. */
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { readInvestigationSurveys, type InvestigationSurvey } from './investigation-survey.ts';

export const INVESTIGATION_LEDGER_SCHEMA = 'cssearth-investigation-ledger@1';
export const INVESTIGATION_LEDGER_FILE = 'investigations.json';
export const INVESTIGATION_STATUSES = ['included', 'excluded', 'unresolved', 'deferred'] as const;
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export interface InvestigationEntry {
  id: string; subject: string; status: InvestigationStatus; finding: string; revisitWhen?: string;
  /** The shared record this decision leans on (data/investigations), when the reasoning is not this body's own. */
  survey?: string;
  evidence: string[];
}
export interface InvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; objectId: string; entries: InvestigationEntry[] }
export interface FacilityInvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; facilityId: string; entries: InvestigationEntry[] }

/** The questions every facility ledger answers first. */
export const FACILITY_SWEEP = ['archive-access', 'data-policy', 'reduction-software'] as const;

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
export function parseInvestigationLedger(value: unknown, objectId: string, surveys: ReadonlyMap<string, InvestigationSurvey> = new Map()): InvestigationLedger {
  const context = `${objectId} investigation ledger`, raw = record(value, ['schema', 'objectId', 'entries'], [], context);
  if (raw.objectId !== objectId) fail(context, `expects objectId ${objectId}`);
  return { schema: INVESTIGATION_LEDGER_SCHEMA, objectId, entries: parseEntries(raw, context, surveys) };
}

/** Validate one facility ledger: the object ledger's entries, led by the sweep entries every facility answers. */
export function parseFacilityLedger(value: unknown, facilityId: string, surveys: ReadonlyMap<string, InvestigationSurvey> = new Map()): FacilityInvestigationLedger {
  const context = `${facilityId} facility ledger`, raw = record(value, ['schema', 'facilityId', 'entries'], [], context);
  if (raw.facilityId !== facilityId) fail(context, `expects facilityId ${facilityId}`);
  return { schema: INVESTIGATION_LEDGER_SCHEMA, facilityId, entries: parseEntries(raw, context, surveys) };
}

function parseEntries(raw: Record<string, unknown>, context: string, surveys: ReadonlyMap<string, InvestigationSurvey>): InvestigationEntry[] {
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
    // A shared record supplies the finding, subject, evidence and revisit condition it is quoted for.
    const survey = typeof value.survey === 'string' ? surveys.get(value.survey) : undefined;
    const text = (key: string, fallback?: string) => typeof value[key] === 'string' && value[key] ? String(value[key]) : fallback;
    const revisitWhen = text('revisitWhen', survey?.revisitWhen);
    return { id, subject: text('subject', survey?.subject) ?? id, status: value.status, finding: text('finding', survey?.finding) ?? '',
      ...(revisitWhen === undefined ? {} : { revisitWhen }), ...(survey ? { survey: survey.id } : {}),
      evidence: [...(survey ? survey.evidence : []), ...(Array.isArray(value.evidence) ? value.evidence.filter((item): item is string => typeof item === 'string') : [])] };
  });
}

/** Every ledger under src/objects, in object order. A ledger belongs to an object package that has a descriptor. */
export async function readInvestigationLedgers(root: string) {
  const surveys = await readInvestigationSurveys(root, evidenceLink);
  const objects = resolve(root, 'src/objects'), ledgers: InvestigationLedger[] = [];
  const directories = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const objectId of directories) {
    let text: string;
    try { text = await readFile(resolve(objects, objectId, INVESTIGATION_LEDGER_FILE), 'utf8'); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    await access(resolve(objects, objectId, 'object.json'));
    ledgers.push(parseInvestigationLedger(JSON.parse(text), objectId, surveys));
  }
  return ledgers;
}

/** Every facility ledger under src/facilities, in id order. */
export async function readFacilityLedgers(root: string) {
  const facilities = resolve(root, 'src/facilities'), ledgers: FacilityInvestigationLedger[] = [];
  const surveys = await readInvestigationSurveys(root, evidenceLink);
  let directories: string[];
  try { directories = (await readdir(facilities, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return ledgers; throw error; }
  for (const facilityId of directories) ledgers.push(parseFacilityLedger(JSON.parse(await readFile(resolve(facilities, facilityId, INVESTIGATION_LEDGER_FILE), 'utf8')), facilityId, surveys));
  return ledgers;
}
