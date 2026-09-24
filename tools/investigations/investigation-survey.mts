/** A shared investigation record: one archive survey, documentation set or route that many bodies were checked against.
 *
 * The reasoning belongs to the survey and is written once; a body's ledger entry names the survey, states the decision it
 * reached for that body, and pins when it was checked. Copying the same paragraph into hundreds of ledgers buried the
 * body-specific findings among them. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '../../src/platform/records.mts';

export const INVESTIGATION_SURVEY_SCHEMA = 'cssearth-investigation-survey@1';
export const INVESTIGATION_SURVEY_DIRECTORY = 'data/investigations';

export interface InvestigationSurvey {
  schema: typeof INVESTIGATION_SURVEY_SCHEMA;
  id: string;
  subject: string;
  finding: string;
  /** What every body quoting this record leans on. Empty when the evidence is each body's own file, which stays on the entry. */
  evidence: string[];
  revisitWhen?: string;
}

const IDENTIFIER = /^[a-z0-9][a-z0-9-]*$/;
function fail(context: string, message: string): never { throw new TypeError(`${context}: ${message}.`); }

function line(value: unknown, context: string) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\n\r]/.test(value)) fail(context, 'expects one trimmed line of text');
  return value;
}

/** Validate one shared record. Its evidence follows the ledger's own rule: an https link, pinned when it is this repository. */
export function parseInvestigationSurvey(value: unknown, id: string, evidenceLink: (value: unknown, context: string) => string): InvestigationSurvey {
  const context = `${id} investigation survey`;
  if (!isRecord(value)) fail(context, 'expects an object');
  for (const key of ['schema', 'id', 'subject', 'finding']) if (!Object.hasOwn(value, key)) fail(context, `needs ${key}`);
  for (const key of Object.keys(value)) if (!['schema', 'id', 'subject', 'finding', 'evidence', 'revisitWhen'].includes(key)) fail(context, `has unknown field ${key}`);
  if (value.schema !== INVESTIGATION_SURVEY_SCHEMA) fail(context, `expects schema ${INVESTIGATION_SURVEY_SCHEMA}`);
  if (value.id !== id) fail(context, `expects id ${id}`);
  if (!IDENTIFIER.test(id)) fail(context, 'expects a lowercase identifier');
  const links = value.evidence === undefined ? [] : value.evidence;
  if (!Array.isArray(links)) fail(context, 'expects evidence links');
  // A shared record's evidence is what every body quoting it leans on, so it names no single body's files.
  for (const link of links) if (typeof link === 'string' && /\/src\/objects\//.test(link)) fail(context, 'expects evidence that is not one body\'s own file');
  const finding = line(value.finding, `${context} finding`);
  return { schema: INVESTIGATION_SURVEY_SCHEMA, id, subject: line(value.subject, `${context} subject`), finding,
    evidence: links.map((link: unknown, index) => evidenceLink(link, `${context} evidence ${index + 1}`)),
    ...(value.revisitWhen === undefined ? {} : { revisitWhen: line(value.revisitWhen, `${context} revisitWhen`) }) };
}

/** Every shared record, by id. */
export async function readInvestigationSurveys(root: string, evidenceLink: (value: unknown, context: string) => string) {
  const directory = resolve(root, INVESTIGATION_SURVEY_DIRECTORY);
  const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort();
  const surveys = new Map<string, InvestigationSurvey>();
  for (const file of files) {
    const id = file.slice(0, -'.json'.length);
    surveys.set(id, parseInvestigationSurvey(JSON.parse(await readFile(resolve(directory, file), 'utf8')), id, evidenceLink));
  }
  return surveys;
}
