#!/usr/bin/env node
/** The calibration an ALMA pipeline run applied, read from the record it ships beside the data.
 *
 * Every delivered ALMA member observing unit set carries `<execution>.ms.calapply.txt` in its auxiliary tar: one `applycal(...)`
 * line per intent, naming the calibration tables, which field each was solved on, how to interpolate and which spectral windows
 * map to which. Replaying those lines against the measurement set imported from the raw ASDM reproduces the calibrated data the
 * archive imaged, without the ALMA pipeline package: `hifa_restoredata` does the same three steps this route does — import,
 * restore flags, apply.
 *
 * The record is read, never guessed. A line this parser cannot account for is an error, so a pipeline version that writes
 * something new stops the route instead of silently calibrating differently. */

export interface CalibrationApplication {
  /** The measurement set the pipeline wrote this for; every line in one file names the same one. */
  readonly vis: string;
  readonly field: string;
  readonly intent: string;
  readonly spw: string;
  readonly antenna: string;
  /** One entry per calibration table, in the order applycal takes them. */
  readonly tables: readonly CalibrationTable[];
}
export interface CalibrationTable {
  readonly gaintable: string;
  readonly gainfield: string;
  readonly interp: string;
  readonly spwmap: readonly number[];
  readonly calwt: boolean;
}

const CALL = /^applycal\((?<arguments>.*)\)\s*$/u;

/** Split a comma-separated argument list at the top level, so quoted strings and bracketed lists stay whole. */
function topLevelParts(text: string) {
  const parts: string[] = [];
  let depth = 0, quote = false, start = 0;
  for (let i = 0; i < text.length; i++) {
    const character = text[i]!;
    if (quote) { if (character === "'") quote = false; continue; }
    if (character === "'") quote = true;
    else if (character === '[') depth += 1;
    else if (character === ']') depth -= 1;
    else if (character === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  if (quote || depth !== 0) throw new SyntaxError('An applycal line ends inside a quote or a list.');
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(part => part.length > 0);
}

/** The Python literals applycal is written with: a quoted string, a boolean, an integer, or a list of those. */
function literal(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) throw new SyntaxError(`Unterminated string in an applycal argument: ${trimmed}`);
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'True') return true;
  if (trimmed === 'False') return false;
  if (trimmed.startsWith('[')) {
    if (!trimmed.endsWith(']')) throw new SyntaxError(`Unterminated list in an applycal argument: ${trimmed}`);
    const inner = trimmed.slice(1, -1).trim();
    return inner.length === 0 ? [] : topLevelParts(inner).map(part => literal(part));
  }
  if (/^-?\d+$/u.test(trimmed)) return Number(trimmed);
  throw new SyntaxError(`An applycal argument is not a string, boolean, integer or list: ${trimmed}`);
}

function stringOf(value: unknown, name: string) {
  if (typeof value !== 'string') throw new TypeError(`applycal ${name} is not a string.`);
  return value;
}
function listOf(value: unknown, name: string) {
  if (!Array.isArray(value)) throw new TypeError(`applycal ${name} is not a list.`);
  return value;
}

/** One applycal line as its arguments, with the per-table arguments zipped into one record each. */
export function parseApplycal(line: string): CalibrationApplication {
  const match = CALL.exec(line.trim());
  if (!match?.groups) throw new SyntaxError('Not an applycal call.');
  const values = new Map<string, unknown>();
  for (const part of topLevelParts(match.groups.arguments!)) {
    const split = part.indexOf('=');
    if (split < 1) throw new SyntaxError(`An applycal argument is not a keyword: ${part}`);
    const name = part.slice(0, split).trim();
    if (values.has(name)) throw new SyntaxError(`applycal repeats the argument ${name}.`);
    values.set(name, literal(part.slice(split + 1)));
  }
  const required = ['vis', 'field', 'intent', 'spw', 'antenna', 'gaintable', 'gainfield', 'spwmap', 'interp', 'calwt'];
  const missing = required.filter(name => !values.has(name));
  if (missing.length) throw new TypeError(`applycal is missing ${missing.join(', ')}.`);
  const extra = [...values.keys()].filter(name => !required.includes(name));
  // An argument this route does not replay would change the calibration silently.
  if (extra.length) throw new TypeError(`applycal states arguments this route does not replay: ${extra.join(', ')}.`);
  const gaintable = listOf(values.get('gaintable'), 'gaintable').map(value => stringOf(value, 'gaintable entry'));
  const gainfield = listOf(values.get('gainfield'), 'gainfield').map(value => stringOf(value, 'gainfield entry'));
  const interp = listOf(values.get('interp'), 'interp').map(value => stringOf(value, 'interp entry'));
  const calwt = listOf(values.get('calwt'), 'calwt').map(value => {
    if (typeof value !== 'boolean') throw new TypeError('applycal calwt entry is not a boolean.');
    return value;
  });
  const spwmap = listOf(values.get('spwmap'), 'spwmap').map(value => listOf(value, 'spwmap entry').map(entry => {
    if (typeof entry !== 'number') throw new TypeError('applycal spwmap entry is not an integer.');
    return entry;
  }));
  const counts = new Set([gaintable.length, gainfield.length, interp.length, calwt.length, spwmap.length]);
  if (counts.size !== 1) throw new TypeError('applycal per-table arguments differ in length.');
  if (!gaintable.length) throw new TypeError('applycal names no calibration table.');
  return {
    vis: stringOf(values.get('vis'), 'vis'), field: stringOf(values.get('field'), 'field'),
    intent: stringOf(values.get('intent'), 'intent'), spw: stringOf(values.get('spw'), 'spw'),
    antenna: stringOf(values.get('antenna'), 'antenna'),
    tables: gaintable.map((table, index) => ({ gaintable: table, gainfield: gainfield[index]!, interp: interp[index]!, spwmap: spwmap[index]!, calwt: calwt[index]! })),
  };
}

/** Every applycal in one calapply record, in the order the pipeline wrote them. Comments and blank lines are skipped; any
 * other line is an error, because a step this route does not replay would leave the data differently calibrated. */
export function parseCalibrationRecord(text: string): CalibrationApplication[] {
  const applications: CalibrationApplication[] = [];
  for (const [index, line] of text.split('\n').entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith('applycal(')) throw new SyntaxError(`Line ${index + 1} of the calapply record is not an applycal call.`);
    applications.push(parseApplycal(trimmed));
  }
  if (!applications.length) throw new TypeError('The calapply record applies no calibration.');
  const sets = new Set(applications.map(application => application.vis));
  if (sets.size !== 1) throw new TypeError('One calapply record calibrates one measurement set.');
  return applications;
}

/** The calibration tables the record needs, once each, in first use order. */
export function requiredTables(applications: readonly CalibrationApplication[]) {
  const seen = new Set<string>();
  for (const application of applications) for (const table of application.tables) seen.add(table.gaintable);
  return [...seen];
}
