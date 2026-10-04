/** An object's investigation ledger: every source, route, dataset or frame examined for it, what was decided, the evidence and what
 * would reopen the decision. It lives beside the body README, outside `source/`, so recording an investigation never changes
 * preparation inputs.
 *
 * A facility keeps the same ledger in src/facilities/<facility id>/investigations.json: what was examined about a telescope's
 * archive, data policy and reduction software, and what was run from it. Every facility ledger answers the same three sweep
 * entries (FACILITY_SWEEP), so facilities compare side by side. */
import { evidenceLink, parseInvestigationLedger as parseSharedInvestigationLedger, parseFacilityLedger as parseSharedFacilityLedger, type InvestigationStatus, type InvestigationEntry, type InvestigationLedger, type FacilityInvestigationLedger } from '@cssearth/objects';
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from '@cssearth/core';
import { readInvestigationSurveys, type InvestigationSurvey } from './investigation-survey.ts';

export { evidenceLink } from '@cssearth/objects';
export const INVESTIGATION_LEDGER_FILE = 'investigations.json';
/** The questions every facility ledger answers first. */
export const FACILITY_SWEEP = ['archive-access', 'data-policy', 'reduction-software'] as const;

function expandInvestigationEntry(surveys: ReadonlyMap<string, InvestigationSurvey>) {
 return (value: Record<string, unknown>, id: string, status: InvestigationStatus): InvestigationEntry => {
    // A shared record supplies the finding, subject, evidence and revisit condition it is quoted for.
    const survey = typeof value.survey === 'string' ? surveys.get(value.survey) : undefined;
    const text = (key: string, fallback?: string) => typeof value[key] === 'string' && value[key] ? String(value[key]) : fallback;
    const revisitWhen = text('revisitWhen', survey?.revisitWhen);
    return { id, subject: text('subject', survey?.subject) ?? id, status, finding: text('finding', survey?.finding) ?? '',
      ...(revisitWhen === undefined ? {} : { revisitWhen }), ...(survey ? { survey: survey.id } : {}),
      evidence: [...(survey ? survey.evidence : []), ...(Array.isArray(value.evidence) ? value.evidence.filter((item): item is string => typeof item === 'string') : [])] };
 };
}
export function parseInvestigationLedger(value: unknown, objectId: string, surveys: ReadonlyMap<string, InvestigationSurvey> = new Map()): InvestigationLedger {
 return parseSharedInvestigationLedger(value, objectId, expandInvestigationEntry(surveys));
}
export function parseFacilityLedger(value: unknown, facilityId: string, surveys: ReadonlyMap<string, InvestigationSurvey> = new Map()): FacilityInvestigationLedger {
 return parseSharedFacilityLedger(value, facilityId, expandInvestigationEntry(surveys));
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
