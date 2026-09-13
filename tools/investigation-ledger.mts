/** An object's investigation ledger: every source, route, lens or frame examined for it, what was decided, the evidence and what
 * would reopen the decision. It lives beside the body README, outside `source/`, so recording an investigation never changes
 * preparation inputs. */
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from './source-values.mts';

export const INVESTIGATION_LEDGER_SCHEMA = 'cssearth-investigation-ledger@1';
export const INVESTIGATION_LEDGER_FILE = 'investigations.json';
export const INVESTIGATION_STATUSES = ['included', 'excluded', 'unresolved', 'deferred'] as const;
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export interface InvestigationCheck { date: string; commit: string; pr?: number }
export interface InvestigationEntry {
  id: string; subject: string; status: InvestigationStatus; finding: string; revisitWhen?: string;
  evidence: string[]; checked: InvestigationCheck[];
}
export interface InvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; objectId: string; entries: InvestigationEntry[] }

const IDENTIFIER = /^[a-z0-9][a-z0-9-]*$/;
const COMMIT = /^[0-9a-f]{40}$/;
const REPOSITORY = 'https://github.com/layoutit/css.earth/';
// A repository link names the version it describes: a commit's file, tree or commit page, or a pull request.
const PINNED_REPOSITORY_LINK = /^https:\/\/github\.com\/layoutit\/css\.earth\/(?:(?:blob|tree|commit)\/[0-9a-f]{40}|pull\/[1-9][0-9]*)(?:[/#?]|$)/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
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

function calendarDate(value: unknown, context: string) {
  const text = line(value, context), parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) fail(context, 'expects a calendar date as YYYY-MM-DD');
  return text;
}

function evidenceLink(value: unknown, context: string) {
  const url = line(value, context);
  if (!url.startsWith('https://')) fail(context, 'expects an https link');
  if (url.startsWith(REPOSITORY) && !PINNED_REPOSITORY_LINK.test(url)) fail(context, 'expects a repository link pinned to a commit or a pull request');
  return url;
}

function check(value: unknown, context: string): InvestigationCheck {
  const raw = record(value, ['date', 'commit'], ['pr'], context), commit = line(raw.commit, `${context} commit`);
  if (!COMMIT.test(commit)) fail(context, 'expects the full 40-character commit that holds the checked version');
  if (raw.pr === undefined) return { date: calendarDate(raw.date, `${context} date`), commit };
  if (typeof raw.pr !== 'number' || !Number.isSafeInteger(raw.pr) || raw.pr < 1) fail(context, 'expects a pull request number');
  return { date: calendarDate(raw.date, `${context} date`), commit, pr: raw.pr };
}

/** Validate one ledger against the object package that owns it. */
export function parseInvestigationLedger(value: unknown, objectId: string): InvestigationLedger {
  const context = `${objectId} investigation ledger`, raw = record(value, ['schema', 'objectId', 'entries'], [], context);
  if (raw.schema !== INVESTIGATION_LEDGER_SCHEMA) fail(context, `expects schema ${INVESTIGATION_LEDGER_SCHEMA}`);
  if (raw.objectId !== objectId) fail(context, `expects objectId ${objectId}`);
  if (!Array.isArray(raw.entries) || !raw.entries.length) fail(context, 'expects at least one entry');
  const ids = new Set<string>();
  const entries = raw.entries.map((value: unknown, index): InvestigationEntry => {
    const where = `${context} entry ${index + 1}`;
    const entry = record(value, ['id', 'subject', 'status', 'finding', 'evidence', 'checked'], ['revisitWhen'], where);
    const id = line(entry.id, `${where} id`);
    if (!IDENTIFIER.test(id) || ids.has(id)) fail(where, 'expects a unique lowercase id');
    ids.add(id);
    if (!isStatus(entry.status)) fail(where, `expects status ${INVESTIGATION_STATUSES.join(', ')}`);
    const status = entry.status, revisitWhen = entry.revisitWhen === undefined ? undefined : line(entry.revisitWhen, `${where} revisitWhen`);
    // An included source is in use. Every other decision names the new evidence that would reopen it.
    if (status === 'included' && revisitWhen !== undefined) fail(where, 'an included entry has no revisit condition');
    if (status !== 'included' && revisitWhen === undefined) fail(where, 'names what would reopen the decision in revisitWhen');
    if (!Array.isArray(entry.evidence) || !entry.evidence.length) fail(where, 'expects at least one evidence link');
    if (!Array.isArray(entry.checked) || !entry.checked.length) fail(where, 'expects at least one check');
    return { id, subject: line(entry.subject, `${where} subject`), status, finding: line(entry.finding, `${where} finding`),
      ...(revisitWhen === undefined ? {} : { revisitWhen }),
      evidence: entry.evidence.map((link: unknown, k) => evidenceLink(link, `${where} evidence ${k + 1}`)),
      checked: entry.checked.map((item: unknown, k) => check(item, `${where} check ${k + 1}`)) };
  });
  return { schema: INVESTIGATION_LEDGER_SCHEMA, objectId, entries };
}

/** Every ledger under src/objects, in object order. A ledger belongs to an object package that has a descriptor. */
export async function readInvestigationLedgers(root: string) {
  const objects = resolve(root, 'src/objects'), ledgers: InvestigationLedger[] = [];
  const directories = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const objectId of directories) {
    let text: string;
    try { text = await readFile(resolve(objects, objectId, INVESTIGATION_LEDGER_FILE), 'utf8'); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
    await access(resolve(objects, objectId, 'object.json'));
    ledgers.push(parseInvestigationLedger(JSON.parse(text), objectId));
  }
  return ledgers;
}
