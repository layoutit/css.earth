#!/usr/bin/env node
/** The ALMA pipeline's flags, replayed by selection rather than restored by row.
 *
 * A delivery ships its final flags as a flag version: one boolean per row of the measurement set the pipeline imported. Row order
 * is whatever that CASA's importasdm produced, and a different CASA can order the same visibilities differently. Restored onto
 * R Doradus' band 8 execution imported with CASA 6.7, the pipeline's flags landed on other baselines in 189 of 216 integrations:
 * good data was dropped, DV03 was kept, and the image carried 7.8% less weight than the pipeline's.
 *
 * Every flag the pipeline applied to the calibration set is also recorded by selection: the `hifa_flagdata` command file kept in
 * the weblog (intents, online flags, auto-correlations, shadowing), and the inline `flagdata` calls in `casa_commands.log` that
 * later stages wrote (DV03 `nmedian`). Those select by antenna, time, spectral window and intent, so they land on the same
 * visibilities whatever the row order. The pipeline also logged, per spectral window and field, how much of each antenna it had
 * flagged; the replay is checked against that before anything is calibrated. */

/** The commands `hifa_flagdata` applied, from the weblog's `<vis>-agent_flagcmds.txt`. Summaries are reports, not flags. */
export function agentFlagCommands(text: string) {
  const commands = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const applied = commands.filter(line => !/\bmode='summary'/u.test(line));
  if (!applied.length) throw new TypeError('The hifa_flagdata command file applies nothing.');
  return applied;
}

/** One flagdata call, gathered from its opening to its closing parenthesis, ignoring parentheses inside quotes. */
function calls(log: string, task: string) {
  const found: { text: string; at: number }[] = [];
  for (let index = log.indexOf(`${task}(`); index >= 0; index = log.indexOf(`${task}(`, index + 1)) {
    if (index > 0 && /[\w.]/u.test(log[index - 1]!)) continue;
    let depth = 0, quote = '';
    for (let cursor = index + task.length; cursor < log.length; cursor++) {
      const character = log[cursor]!;
      if (quote) { if (character === quote) quote = ''; continue; }
      if (character === "'" || character === '"') quote = character;
      else if (character === '(') depth += 1;
      else if (character === ')') { depth -= 1; if (depth === 0) { found.push({ text: log.slice(index, cursor + 1), at: index }); break; } }
    }
  }
  return found;
}

/** The double-quoted commands of an `inpfile=[...]` list. Brackets inside a command, as in `clipminmax=[0,1]`, do not end it. */
function quotedItems(call: string) {
  const start = call.indexOf('inpfile=[');
  if (start < 0) return null;
  const items: string[] = [];
  let quote = '', item = '';
  for (let cursor = start + 'inpfile=['.length; cursor < call.length; cursor++) {
    const character = call[cursor]!;
    if (quote) { if (character === quote) { if (quote === '"') items.push(item); quote = ''; item = ''; } else item += character; continue; }
    if (character === '"' || character === "'") quote = character;
    else if (character === ']') return items;
  }
  throw new TypeError('An inpfile list never closes.');
}

export interface LoggedFlagging {
  /** The time buffer the pipeline applied the command file with, in seconds before and after each online flag. */
  readonly tbuff: readonly [number, number];
  /** Inline flagdata commands later stages applied to the calibration set, in the order they ran. */
  readonly inline: readonly string[];
}

/** What `casa_commands.log` says the pipeline applied to one measurement set before it saved `Pipeline_Final`. A file-based call
 * other than the command file, or an inline item that is not a plain selection, is an error: the replay would be incomplete. */
export function loggedFlagging(log: string, visibilities: string): LoggedFlagging {
  const final = log.search(/versionname='Pipeline_Final'/u);
  if (final < 0) throw new TypeError('The command log never saves Pipeline_Final, so where the calibration flags end is unknown.');
  const onSet = calls(log, 'flagdata').filter(call => call.at < final && call.text.includes(`vis='${visibilities}'`) && /action='apply'/u.test(call.text));
  let tbuff: [number, number] | null = null;
  const inline: string[] = [];
  for (const { text } of onSet) {
    const file = /inpfile='([^']+)'/u.exec(text);
    if (file) {
      if (!file[1]!.endsWith('.flagcmds.txt')) throw new TypeError(`The pipeline applied a flag file this route does not have: ${file[1]}`);
      const buffer = /tbuff=\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/u.exec(text);
      if (!buffer) throw new TypeError('The command file was applied without a two-sided time buffer this route reads.');
      tbuff = [Number(buffer[1]), Number(buffer[2])];
      continue;
    }
    const list = quotedItems(text);
    if (!list) throw new TypeError(`A flagdata call on ${visibilities} names neither a file nor a command list.`);
    for (const raw of list) {
      const command = raw.replace(/\s+/gu, ' ').trim();
      if (/\bmode='summary'/u.test(command)) continue;
      if (/\bmode='(?!manual)/u.test(command)) throw new TypeError(`An inline flag command is not a plain selection: ${command}`);
      inline.push(command);
    }
  }
  if (!tbuff) throw new TypeError('The command log never applies the hifa_flagdata command file.');
  return { tbuff, inline };
}

/** The pipeline's own count of what it had flagged, per spectral window and antenna, for one field: the `AntSpw` summaries
 * `hif_applycal` wrote to its CASA log after the calibration was applied. Fractions, 0 to 1. */
export function pipelineFlagSummary(casaLog: string, visibilities: string, field: string) {
  const lines = casaLog.split('\n');
  const start = lines.findIndex(line => line.includes(`Executing flagdata(vis='${visibilities}'`) && line.includes("fieldcnt=True mode='summary' name='AntSpw"));
  if (start < 0) throw new TypeError(`The log holds no per-antenna flag summary for ${visibilities}.`);
  const windows = [...lines[start]!.matchAll(/spw='(\d+)' fieldcnt=True mode='summary'/gu)].map(match => Number(match[1]));
  const summary = new Map<number, Map<string, number>>();
  let current: { spw: number; field: string } | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/Executing /u.test(line)) break;
    const header = /Summary_(\d+)::getResult\s+Field (\S+) breakdown/u.exec(line);
    if (header) { current = { spw: windows[Number(header[1])]!, field: header[2]! }; continue; }
    const antenna = /Summary_(\d+)::getResult\s+antenna (\S+) flagged: ([\d.e+]+) total: ([\d.e+]+)/u.exec(line);
    if (!antenna || !current || current.field !== field || windows[Number(antenna[1])] !== current.spw) continue;
    const perAntenna = summary.get(current.spw) ?? new Map<string, number>();
    perAntenna.set(antenna[2]!, Number(antenna[3]) / Number(antenna[4]));
    summary.set(current.spw, perAntenna);
  }
  if (summary.size !== windows.length) throw new TypeError(`The summary covers ${summary.size} of ${windows.length} windows for ${field}.`);
  return summary;
}
