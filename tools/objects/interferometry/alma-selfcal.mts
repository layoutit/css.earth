#!/usr/bin/env node
/** The self-calibration a delivery carries, read from the record the pipeline wrote with it.
 *
 * `hifa_restoredata` restores the calibration that was solved per execution block, and states that it does not recover
 * self-calibration. The delivery carries it anyway: `auxproducts/pipeline-*.selfcal.json` names the tables, how to interpolate
 * them, which spectral windows map to which, and the mode to apply them in, and the `sc_workdir` directory beside it holds the tables.
 *
 * The spectral-window map is the trap. Solutions after the first interval are solved with `combine='spw'`, so one solution
 * covers every window, and the map that spreads it is an array indexed by the ABSOLUTE spectral-window id of the measurement
 * set the table was solved against — for this delivery, 26 entries of 25. Split the targets with `reindex=True` and the windows
 * renumber to 0-3, the map points at windows that no longer mean what it says, and applycal does not fail: it interpolates the
 * wrong solution and flags more. The pipeline splits with `reindex=False` for this reason, and so does this route. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export interface SelfCalibration {
  /** The measurement set the tables were solved against; its name is what the pipeline split the targets to. */
  readonly measurementSet: string;
  readonly target: string;
  /** The solution interval the pipeline kept, and whether it solved phase only. */
  readonly solutionInterval: string;
  readonly phaseOnly: boolean;
  readonly tables: readonly string[];
  readonly interpolation: readonly string[];
  /** One map per table, each indexed by absolute spectral-window id. */
  readonly spectralWindowMaps: readonly (readonly number[])[];
  readonly applyMode: string;
  readonly succeeded: boolean;
}

const stringList = (value: unknown, context: string) => requireArray(value, context).map(entry => requireString(entry, context));

/** The self-calibration of one target, as its record states it. */
export function parseSelfCalibration(json: unknown): SelfCalibration {
  const root = requireRecord(json, 'selfcal record');
  const targets = Object.entries(root).find(([key]) => key.endsWith('_targets'));
  if (!targets) throw new TypeError('A selfcal record names a targets entry.');
  const first = requireRecord(requireArray(targets[1], 'targets')[0], 'target');
  const library = requireRecord(first.sc_lib, 'sc_lib');
  // The outcome is recorded beside the library, not inside it.
  const succeeded = first.sc_success === true;
  const solutionInterval = requireString(library.final_solint, 'final_solint');
  const phaseOnly = library.final_solint_mode === 'p';
  const entry = Object.entries(library).find(([key]) => key.endsWith('.ms'));
  if (!entry) throw new TypeError('A selfcal record names the measurement set its tables were solved against.');
  const [measurementSet, body] = [entry[0], requireRecord(entry[1], 'measurement set')];
  const tables = stringList(body.gaintable_final ?? body.gaintable, 'gaintable_final');
  const interpolation = stringList(body.applycal_interpolate_final, 'applycal_interpolate_final');
  const applyMode = requireString(body.applycal_mode_final, 'applycal_mode_final');
  const solint = requireRecord(body[solutionInterval], `solution interval ${solutionInterval}`);
  const spectralWindowMaps = requireArray(solint.spwmap, 'spwmap').map(map => requireArray(map, 'spwmap entry').map(value => requireFiniteNumber(value, 'spectral window')));
  if (tables.length !== interpolation.length) throw new TypeError('A selfcal record gives one interpolation per table.');
  if (spectralWindowMaps.length !== tables.length) throw new TypeError('A selfcal record gives one spectral-window map per table.');
  const target = /^Target_(.+?)_uid___/u.exec(tables[0] ?? '')?.[1];
  return { measurementSet, target: target ?? 'unknown', solutionInterval, phaseOnly, tables, interpolation,
    spectralWindowMaps, applyMode, succeeded };
}

/** The highest spectral window a map addresses: the split that feeds it must keep window ids at least this high. */
export function highestMappedWindow(selfcal: SelfCalibration) {
  return Math.max(0, ...selfcal.spectralWindowMaps.flatMap(map => map.map((_, index) => index)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = process.argv[2];
  if (!path) throw new TypeError('Usage: alma-selfcal.mts <pipeline-*.selfcal.json>');
  const selfcal = parseSelfCalibration(JSON.parse(await readFile(path, 'utf8')));
  console.log(`${selfcal.target}: ${selfcal.succeeded ? 'succeeded' : 'did not succeed'}, ${selfcal.phaseOnly ? 'phase only' : 'phase and amplitude'} at ${selfcal.solutionInterval}`);
  console.log(`  ${selfcal.tables.length} table(s), applied ${selfcal.applyMode} with ${selfcal.interpolation.join(', ')}`);
  console.log(`  spectral-window maps address windows up to ${highestMappedWindow(selfcal)}; the split must not renumber them`);
  for (const table of selfcal.tables) console.log(`  ${table}`);
}
