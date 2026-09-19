#!/usr/bin/env node
/** The calibration a MANUAL ALMA delivery applied, read from the reduction script it ships beside the data.
 *
 *   node tools/objects/interferometry/alma-manual-calibration.mts <uid___....ms.scriptForCalibration.py> [<casapy log>]
 *
 * A pipeline delivery ships `<execution>.ms.calapply.txt`, one applycal line per intent, and `alma-calibration.mts` reads it. A
 * manual delivery ships no such record: the calibration is the reduction script an ALMA data reducer wrote by hand, numbered
 * steps of CASA calls, and the solved tables beside it in `calibration/<execution>.calibration.tgz`. This module reads that
 * script into the same kind of validated record — which data were flagged, which tables were applied to which field, what was
 * split out — so the route replays the steps the script states instead of a reading of it.
 *
 * The script is read, never executed. It was written for CASA 4.5.0, whose `T`/`F` aliases, `print` statement and
 * `recipes.almahelpers` no longer exist, and running it would also re-solve every table the delivery already carries. A call
 * this parser cannot account for inside a replayed step is an error, so a delivery that did something else stops the route
 * rather than being calibrated differently.
 *
 * One value the script does not state is the Tsys spectral-window map: it calls `tsysspwmap(...)` and passes the result. That
 * function is not in casatasks, so the map is read from the delivery's own CASA log, where applycal logged the list it was
 * given. `loggedSpectralWindowMap` does that; nothing here computes a map. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** A Python value as the script writes it. A bare name (`T`, `tsysmap`, a loop variable) is kept as a name, and `str(i)` as a
 * call, because resolving either needs the script around it. */
export type PythonValue = string | number | boolean | readonly PythonValue[] | PythonName | PythonCall;
export interface PythonName { readonly name: string }
export interface PythonCall { readonly call: string; readonly arguments: readonly PythonValue[] }

export const isName = (value: PythonValue): value is PythonName => typeof value === 'object' && value !== null && 'name' in value;
export const isCall = (value: PythonValue): value is PythonCall => typeof value === 'object' && value !== null && 'call' in value;

/** One CASA call the script makes, with the step it sits in and the loop variable it is under, if any. */
export interface ScriptCall {
  readonly task: string;
  readonly step: number;
  readonly line: number;
  readonly keywords: ReadonlyMap<string, PythonValue>;
  readonly positional: readonly PythonValue[];
  /** `for <variable> in [<values>]:` above this call, innermost first. */
  readonly loops: readonly { readonly variable: string; readonly values: readonly PythonValue[] }[];
}

/** Comments removed, quotes respected: a selection string may hold a `#`, and an ALMA spectral-window name always does. */
function withoutComments(text: string) {
  let out = '', quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const character = text[i]!;
    if (quote) { out += character; if (character === quote) quote = null; continue; }
    if (character === "'" || character === '"') { quote = character; out += character; continue; }
    if (character === '#') { while (i < text.length && text[i] !== '\n') i += 1; out += '\n'; continue; }
    out += character;
  }
  return out;
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\\']);
function skip(text: string, at: number) {
  while (at < text.length && WHITESPACE.has(text[at]!)) at += 1;
  return at;
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/u;
const NAME = /^[A-Za-z_][\w.]*/u;

/** One Python literal, name or call, from `at`. Only the forms an ALMA reduction script writes are accepted. */
export function readValue(text: string, at: number): { value: PythonValue; next: number } {
  let index = skip(text, at);
  const character = text[index];
  if (character === undefined) throw new SyntaxError('A value is missing at the end of the script.');
  if (character === "'" || character === '"') {
    const end = text.indexOf(character, index + 1);
    if (end < 0) throw new SyntaxError('A string in the script is not terminated.');
    return { value: text.slice(index + 1, end), next: end + 1 };
  }
  if (character === '[' || character === '(') {
    const close = character === '[' ? ']' : ')';
    const values: PythonValue[] = [];
    index = skip(text, index + 1);
    while (text[index] !== close) {
      const read = readValue(text, index);
      values.push(read.value);
      index = skip(text, read.next);
      if (text[index] === ',') index = skip(text, index + 1);
      else if (text[index] !== close) throw new SyntaxError(`A list in the script is not separated by commas near ${text.slice(index, index + 20)}`);
    }
    return { value: values, next: index + 1 };
  }
  const number = NUMBER.exec(text.slice(index));
  // A name may begin with a digit nowhere, so a numeric match is a number unless a name matches the same place.
  if (number && !NAME.test(text.slice(index))) return { value: Number(number[0]), next: index + number[0].length };
  const name = NAME.exec(text.slice(index));
  if (!name) throw new SyntaxError(`Not a value the script parser reads: ${text.slice(index, index + 20)}`);
  const after = skip(text, index + name[0].length);
  if (text[after] === '(') {
    const read = readValue(text, after);
    return { value: { call: name[0], arguments: read.value as readonly PythonValue[] }, next: read.next };
  }
  // CASA 4's aliases for the booleans; every other bare name is kept as one.
  if (name[0] === 'T' || name[0] === 'True') return { value: true, next: index + name[0].length };
  if (name[0] === 'F' || name[0] === 'False') return { value: false, next: index + name[0].length };
  return { value: { name: name[0] }, next: index + name[0].length };
}

const TASK = /(?:^|\n)([ \t]*)(?:[A-Za-z_]\w*\s*=\s*)?([A-Za-z_][\w.]*)\s*\(/u;
/** Python statements that begin a parenthesised expression rather than a call. */
const KEYWORDS = new Set(['if', 'elif', 'else', 'while', 'for', 'print', 'return', 'assert', 'del', 'with', 'except', 'not', 'and', 'or', 'in', 'lambda', 'yield', 'raise']);
const STEP = /(?:^|\n)\s*mystep\s*=\s*(\d+)/u;
const LOOP = /(?:^|\n)([ \t]*)for\s+(\w+)\s+in\s+(\[[^\]]*\])\s*:/u;

/** Every CASA call the script makes, in order, each tagged with the numbered step it sits in. */
export function parseScriptCalls(source: string): ScriptCall[] {
  const text = withoutComments(source);
  const lineOf = (index: number) => text.slice(0, index).split('\n').length;
  const calls: ScriptCall[] = [];
  let step = -1;
  const loops: { variable: string; values: readonly PythonValue[]; indent: number }[] = [];
  for (let at = 0; at < text.length;) {
    const rest = text.slice(at);
    const matches = [STEP.exec(rest), LOOP.exec(rest), TASK.exec(rest)]
      .map((match, kind) => (match ? { match, kind, index: match.index } : null))
      .filter(entry => entry !== null)
      .sort((a, b) => a.index - b.index);
    const first = matches[0];
    if (!first) break;
    const start = at + first.index;
    if (first.kind === 0) { step = Number(first.match[1]); at = start + first.match[0].length; continue; }
    if (first.kind === 1) {
      const indent = first.match[1]!.length;
      while (loops.length && loops.at(-1)!.indent >= indent) loops.pop();
      loops.push({ variable: first.match[2]!, values: readValue(first.match[3]!, 0).value as readonly PythonValue[], indent });
      at = start + first.match[0].length; continue;
    }
    const indent = first.match[1]!.length, task = first.match[2]!;
    if (KEYWORDS.has(task)) { at = start + first.match[0].length; continue; }
    while (loops.length && loops.at(-1)!.indent >= indent) loops.pop();
    const open = start + first.match[0].length - 1, close = balancedExtent(text, open);
    const keywords = new Map<string, PythonValue>();
    const positional: PythonValue[] = [];
    // A logging or shell call writes Python this parser does not model — string concatenation, subscripting — and its
    // arguments are never replayed, so it is recorded by name alone. A task the replay may run must parse.
    try {
      for (const part of topLevelParts(text.slice(open + 1, close - 1))) {
        const split = /^\s*([A-Za-z_]\w*)\s*=(?!=)/u.exec(part);
        if (split) keywords.set(split[1]!, readValue(part, split[0].length).value);
        else positional.push(readValue(part, 0).value);
      }
    } catch (error) {
      if (REPLAYABLE.has(task)) throw error;
      keywords.clear(); positional.length = 0;
    }
    calls.push({ task, step, line: lineOf(start), keywords, positional, loops: loops.map(loop => ({ variable: loop.variable, values: loop.values })).reverse() });
    at = close;
  }
  return calls;
}

/** The index just past the `)` that closes the `(` at `open`, with quotes and nested brackets respected. */
function balancedExtent(text: string, open: number) {
  let depth = 0, quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const character = text[i]!;
    if (quote) { if (character === quote) quote = null; continue; }
    if (character === "'" || character === '"') quote = character;
    else if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') { depth -= 1; if (depth === 0) return i + 1; }
  }
  throw new SyntaxError('A call in the script is never closed.');
}

/** Split an argument list at the top level, so quoted strings, lists and nested calls stay whole. */
function topLevelParts(text: string) {
  const parts: string[] = [];
  let depth = 0, quote: string | null = null, start = 0;
  for (let i = 0; i < text.length; i++) {
    const character = text[i]!;
    if (quote) { if (character === quote) quote = null; continue; }
    if (character === "'" || character === '"') quote = character;
    else if (character === '[' || character === '(') depth += 1;
    else if (character === ']' || character === ')') depth -= 1;
    else if (character === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  if (quote || depth !== 0) throw new SyntaxError('An argument list ends inside a quote or a bracket.');
  return [...parts, text.slice(start)].map(part => part.trim()).filter(part => part.length > 0);
}

/** The module-level assignments a script makes, last one wins. An ALMA imaging script sets its image parameters as plain
 * variables and then hands the names to `clean`, so reading the call alone would read nothing. Only a right-hand side this
 * parser models is kept; `myimages = glob.glob('*.image')` is not one and is left out. */
export function parseScriptAssignments(source: string) {
  const text = withoutComments(source), assignments = new Map<string, PythonValue>();
  for (const match of text.matchAll(/(?:^|\n)([A-Za-z_]\w*)\s*=\s*(?!=)([^\n]*)/gu)) {
    const value = (() => { try { return readValue(match[2]!, 0); } catch { return null; } })();
    if (!value || skip(match[2]!, value.next) !== match[2]!.length) continue;
    if (isCall(value.value) || isName(value.value)) continue;
    assignments.set(match[1]!, value.value);
  }
  return assignments;
}

/** A value with the call's loop variables substituted; `str(x)` of a resolved value is its text. Anything still unresolved is
 * returned as it was, so the caller decides whether it may stand. */
export function resolveValue(value: PythonValue, bindings: ReadonlyMap<string, PythonValue>): PythonValue {
  if (Array.isArray(value)) return value.map(entry => resolveValue(entry, bindings));
  if (isName(value)) return bindings.get(value.name) ?? value;
  if (isCall(value)) {
    if (value.call !== 'str' || value.arguments.length !== 1) return value;
    const inner = resolveValue(value.arguments[0]!, bindings);
    return typeof inner === 'string' || typeof inner === 'number' ? String(inner) : value;
  }
  return value;
}

/** One call per iteration of the loops it sits in, with the loop variables bound. A script that loops over more than one value
 * writes the same call once per value, which is what the replay must do. */
export function expandCall(call: ScriptCall): { readonly keywords: ReadonlyMap<string, PythonValue> }[] {
  let bindings: Map<string, PythonValue>[] = [new Map()];
  for (const loop of call.loops) {
    bindings = bindings.flatMap(binding => loop.values.map(value => new Map([...binding, [loop.variable, value]])));
  }
  return bindings.map(binding => ({ keywords: new Map([...call.keywords].map(([name, value]) => [name, resolveValue(value, binding)])) }));
}

const text = (value: PythonValue | undefined, what: string) => {
  if (typeof value !== 'string') throw new TypeError(`${what} is not a string in the reduction script.`);
  return value;
};
const numeric = (value: PythonValue | undefined, what: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${what} is not a number in the reduction script.`);
  return value;
};
const flag = (value: PythonValue | undefined, what: string, fallback: boolean) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError(`${what} is not a boolean in the reduction script.`);
  return value;
};

/** One flagdata or flagcmd call, as the selections it applies. */
export interface ManualFlag {
  readonly task: 'flagdata' | 'flagcmd';
  readonly mode: string;
  readonly selections: Readonly<Record<string, string>>;
  readonly autocorrelations: boolean;
}

/** One applycal call: which field gets which tables, and how the spectral windows map. `tsysmap` is left named, because the
 * script computes it and only the delivery's log states what it came to. */
export interface ManualApplication {
  readonly field: string;
  readonly spw: string;
  readonly interpolation: string;
  readonly calibrateWeights: boolean;
  readonly tables: readonly { readonly gaintable: string; readonly gainfield: string; readonly spwmap: readonly number[] | { readonly named: string } }[];
}

export interface ManualSplit {
  readonly outputVisibilities: string;
  readonly dataColumn: string;
  readonly spw: string;
  readonly antenna: string;
  readonly keepFlags: boolean;
}

/** The flux-density scale the reducer set on the flux calibrator, which every gain solution after it carries. The paper that
 * re-reduced these data corrected exactly this number, so it is read out rather than left inside the script. */
export interface ManualFluxScale {
  readonly field: string;
  readonly standard: string;
  readonly fluxDensityJy: number;
  readonly spectralIndex: number;
  readonly referenceFrequency: string;
}

export interface ManualCalibration {
  /** The CASA version the script refuses to run under anything but. */
  readonly casaVersion: string;
  readonly measurementSet: string;
  readonly referenceAntenna: string | null;
  /** The observing intents the script's header lists, by intent. */
  readonly intents: ReadonlyMap<string, readonly string[]>;
  readonly steps: ReadonlyMap<number, string>;
  readonly importAsdm: ReadonlyMap<string, PythonValue>;
  readonly aprioriFlags: readonly ManualFlag[];
  /** Step 7: the Tsys, water-vapour and antenna-position tables, applied per field. */
  readonly observatoryApplications: readonly ManualApplication[];
  readonly scienceSplit: ManualSplit;
  readonly initialFlags: readonly ManualFlag[];
  readonly fluxScale: ManualFluxScale;
  /** Step 17: the bandpass, gain and flux-scale tables, applied per field. */
  readonly calibratorApplications: readonly ManualApplication[];
  readonly finalSplit: ManualSplit;
  /** Steps whose only product is a table the delivery already carries, or a plot. The replay does not run them. */
  readonly solvedSteps: readonly number[];
}

const VERSION = /re\.search\('\^([\d.]+)',\s*casadef\.casa_version\)/u;
const REFERENCE_ANTENNA = /#\s*Using reference antenna\s*=\s*(\w+)/u;
const INTENT = /^#\s*([A-Z_]+):\s*(.*)$/u;
const STEP_TITLE = /^(?:\s*step_title\s*=\s*\{)?\s*(\d+):\s*'(.*?)'\s*[,}]?\s*$/u;

/** The steps a replay performs, and what each is for. Every other step solves a table the delivery ships or draws a plot. */
const REPLAYED = new Map([[0, 'import'], [3, 'a-priori flags'], [7, 'observatory calibration'], [8, 'science split'],
  [10, 'initial flags'], [11, 'flux-density scale'], [17, 'calibrator calibration'], [18, 'calibrated split']]);
/** Tasks a replayed step may call. `flagcmd` with `action='plot'` and the `es.*`/`aU.*` helpers of analysisUtils draw plots;
 * they are recognised and dropped, and anything else stops the read. */
const REPLAYABLE = new Set(['importasdm', 'flagdata', 'flagcmd', 'applycal', 'split', 'setjy', 'tsysspwmap']);
const IGNORED = new Set(['os.system', 'print', 'rmtables', 'casalog.post', 'casalog.setlogfile', 'listobs', 'flagmanager']);

const flagOf = (call: { keywords: ReadonlyMap<string, PythonValue> }, task: 'flagdata' | 'flagcmd'): ManualFlag => {
  const selections: Record<string, string> = {};
  for (const key of ['spw', 'intent', 'field', 'antenna', 'timerange', 'uvrange', 'correlation', 'scan']) {
    const value = call.keywords.get(key);
    if (value !== undefined) selections[key] = text(value, `flag ${key}`);
  }
  return { task, mode: task === 'flagcmd' ? 'table' : text(call.keywords.get('mode'), 'flagdata mode'),
    selections, autocorrelations: flag(call.keywords.get('autocorr'), 'flagdata autocorr', false) };
};

function applicationOf(call: { keywords: ReadonlyMap<string, PythonValue> }): ManualApplication {
  const tables = (call.keywords.get('gaintable') ?? []) as readonly PythonValue[];
  const fields = (call.keywords.get('gainfield') ?? []) as readonly PythonValue[];
  const maps = (call.keywords.get('spwmap') ?? []) as readonly PythonValue[];
  if (!Array.isArray(tables) || !tables.length) throw new TypeError('An applycal in the reduction script names no calibration table.');
  if (!Array.isArray(fields) || fields.length !== tables.length) throw new TypeError('An applycal in the reduction script gives one gainfield per table.');
  if (maps.length && maps.length !== tables.length) throw new TypeError('An applycal in the reduction script gives one spectral-window map per table.');
  return {
    field: text(call.keywords.get('field'), 'applycal field'), spw: text(call.keywords.get('spw') ?? '', 'applycal spw'),
    interpolation: text(call.keywords.get('interp'), 'applycal interp'),
    calibrateWeights: flag(call.keywords.get('calwt'), 'applycal calwt', true),
    tables: tables.map((table, index) => {
      const map = maps[index];
      return { gaintable: text(table, 'applycal gaintable'), gainfield: text(fields[index], 'applycal gainfield'),
        spwmap: isName(map) ? { named: map.name } : ((map ?? []) as readonly PythonValue[]).map(value => numeric(value, 'applycal spwmap entry')) };
    }),
  };
}

const splitOf = (call: { keywords: ReadonlyMap<string, PythonValue> }): ManualSplit => ({
  outputVisibilities: text(call.keywords.get('outputvis'), 'split outputvis'),
  dataColumn: text(call.keywords.get('datacolumn'), 'split datacolumn'),
  spw: text(call.keywords.get('spw') ?? '', 'split spw'), antenna: text(call.keywords.get('antenna') ?? '', 'split antenna'),
  keepFlags: flag(call.keywords.get('keepflags'), 'split keepflags', true),
});

/** One manual reduction script as the calibration it applies. */
export function parseManualCalibration(source: string): ManualCalibration {
  const version = VERSION.exec(source);
  if (!version) throw new TypeError('The reduction script states no CASA version; this is not an ALMA manual calibration script.');
  const steps = new Map<number, string>();
  const intents = new Map<string, readonly string[]>();
  for (const line of source.split('\n')) {
    const title = STEP_TITLE.exec(line);
    if (title) steps.set(Number(title[1]), title[2]!);
    const intent = INTENT.exec(line.trim());
    if (intent) intents.set(intent[1]!, intent[2]!.split(',').map(name => name.trim()).filter(name => name.length > 0));
  }
  if (!steps.size) throw new TypeError('The reduction script lists no numbered steps.');
  const calls = parseScriptCalls(source);
  const inStep = (step: number) => calls.filter(call => call.step === step);
  for (const step of REPLAYED.keys()) {
    const unknown = inStep(step).find(call => !REPLAYABLE.has(call.task) && !IGNORED.has(call.task) && !/^(es|aU)\./u.test(call.task));
    if (unknown) throw new TypeError(`Step ${step} of the reduction script calls ${unknown.task} on line ${unknown.line}, which this route does not replay.`);
  }
  const one = (step: number, task: string) => {
    const found = inStep(step).filter(call => call.task === task);
    if (found.length !== 1) throw new TypeError(`Step ${step} of the reduction script calls ${task} ${found.length} times; one was expected.`);
    return found[0]!;
  };
  const measurementSet = text(one(8, 'split').keywords.get('vis'), 'split vis');
  const importCall = one(0, 'importasdm');
  const expanded = (step: number, task: string) => inStep(step).filter(call => call.task === task).flatMap(call => expandCall(call));
  const observatory = expanded(7, 'applycal').map(call => applicationOf(call));
  const calibrator = expanded(17, 'applycal').map(call => applicationOf(call));
  if (!observatory.length) throw new TypeError('The reduction script applies no observatory calibration.');
  if (!calibrator.length) throw new TypeError('The reduction script applies no bandpass or gain calibration.');
  const setjy = one(11, 'setjy'), density = setjy.keywords.get('fluxdensity');
  if (!Array.isArray(density) || !density.length) throw new TypeError('The reduction script sets no flux density on the flux calibrator.');
  return {
    casaVersion: version[1]!, measurementSet, referenceAntenna: REFERENCE_ANTENNA.exec(source)?.[1] ?? null, intents, steps,
    importAsdm: importCall.keywords,
    aprioriFlags: inStep(3).filter(call => call.task === 'flagdata' || (call.task === 'flagcmd' && call.keywords.get('action') === 'apply'))
      .map(call => flagOf(call, call.task as 'flagdata' | 'flagcmd')),
    observatoryApplications: observatory,
    scienceSplit: splitOf(one(8, 'split')),
    initialFlags: inStep(10).filter(call => call.task === 'flagdata').map(call => flagOf(call, 'flagdata')),
    fluxScale: { field: text(setjy.keywords.get('field'), 'setjy field'), standard: text(setjy.keywords.get('standard'), 'setjy standard'),
      fluxDensityJy: numeric(density[0], 'setjy fluxdensity'), spectralIndex: numeric(setjy.keywords.get('spix'), 'setjy spix'),
      referenceFrequency: text(setjy.keywords.get('reffreq'), 'setjy reffreq') },
    calibratorApplications: calibrator,
    finalSplit: splitOf(one(18, 'split')),
    solvedSteps: [...steps.keys()].filter(step => !REPLAYED.has(step)).sort((a, b) => a - b),
  };
}

/** The calibration tables the script applies, once each, in first use order. */
export function manualTables(calibration: ManualCalibration) {
  const seen = new Set<string>();
  for (const application of [...calibration.observatoryApplications, ...calibration.calibratorApplications]) {
    for (const table of application.tables) seen.add(table.gaintable);
  }
  return [...seen];
}

/** The spectral-window maps the script names but does not state, as the delivery's own CASA log records them.
 *
 * `tsysspwmap` is in the ALMA analysis recipes, not in casatasks, so a replay cannot call it. It does not have to: applycal
 * logs the list it was handed, and the log of the run that produced the delivered tables is shipped in `log/`. One map per
 * table it was logged for; a log that states two different maps for one table stops the read. */
export function loggedSpectralWindowMap(log: string, table: string) {
  const escaped = table.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(String.raw`table=${escaped}\s+select=\s*interp=\S*\s+spwmap=\[([\d,\s]*)\]`, 'gu');
  const found = new Set<string>();
  for (const match of log.matchAll(pattern)) found.add(match[1]!.replaceAll(/\s+/gu, ''));
  if (found.size === 0) throw new Error(`The delivery's log records no spectral-window map for ${table}.`);
  if (found.size > 1) throw new Error(`The delivery's log records ${found.size} different spectral-window maps for ${table}.`);
  const only = [...found][0]!;
  return only.length === 0 ? [] : only.split(',').map(value => {
    const window = Number(value);
    if (!Number.isInteger(window) || window < 0) throw new TypeError(`The logged spectral-window map for ${table} holds ${value}.`);
    return window;
  });
}

/** Every named map in the script, resolved from the log. A name the log cannot answer stops the route. */
export function resolveNamedMaps(calibration: ManualCalibration, log: string) {
  const resolved = new Map<string, readonly number[]>();
  for (const application of [...calibration.observatoryApplications, ...calibration.calibratorApplications]) {
    for (const table of application.tables) {
      if (Array.isArray(table.spwmap) || resolved.has(table.gaintable)) continue;
      resolved.set(table.gaintable, loggedSpectralWindowMap(log, table.gaintable));
    }
  }
  return resolved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [script, log] = process.argv.slice(2);
  if (!script) throw new TypeError('Usage: alma-manual-calibration.mts <scriptForCalibration.py> [<casapy log>]');
  const calibration = parseManualCalibration(await readFile(script, 'utf8'));
  console.log(`${calibration.measurementSet}, reduced by hand for CASA ${calibration.casaVersion}, reference antenna ${calibration.referenceAntenna ?? 'unstated'}`);
  console.log(`  ${calibration.steps.size} steps, ${calibration.solvedSteps.length} of them solving tables the delivery ships`);
  console.log(`  a-priori flags: ${calibration.aprioriFlags.map(entry => `${entry.task} ${entry.mode}`).join(', ')}`);
  console.log(`  observatory calibration on fields ${calibration.observatoryApplications.map(entry => entry.field).join(', ')} over spw ${calibration.observatoryApplications[0]!.spw}`);
  console.log(`  science split to ${calibration.scienceSplit.outputVisibilities} of spw ${calibration.scienceSplit.spw}`);
  console.log(`  flux scale: ${calibration.fluxScale.field} at ${calibration.fluxScale.fluxDensityJy.toFixed(4)} Jy, spectral index ${calibration.fluxScale.spectralIndex.toFixed(4)}, ${calibration.fluxScale.referenceFrequency}`);
  console.log(`  calibrator calibration on fields ${calibration.calibratorApplications.map(entry => entry.field).join(', ')}`);
  console.log(`  calibrated split to ${calibration.finalSplit.outputVisibilities}, antennas ${calibration.finalSplit.antenna}`);
  for (const table of manualTables(calibration)) console.log(`  table ${table}`);
  if (log) for (const [table, map] of resolveNamedMaps(calibration, await readFile(log, 'utf8'))) console.log(`  logged spectral-window map for ${table}: [${map.join(', ')}]`);
}
