#!/usr/bin/env node
/** Score the recipe against every published run: each reduced program that has a `published` block, beside what its paper
 * prints.
 *
 *   node packages/telescope-cli/src/archives/espadons/benchmark.mts [--knee <slope>] [--only <text in the program id>] [--quiet]
 *
 * A receipt keeps every step of its run's ladder (reduce.mts), so a rule for choosing the step is scored here without
 * fitting anything again. For each run: the chosen step's mean field against the published one, and its toroidal share
 * against the published share. Runs reduce.mts gave no map to show (field not detected, or a fit that does not describe the
 * spectra) are listed with the reason and not scored. Over the scored runs: the median ratio of mean fields, its spread (the rms of log ratios, as a
 * factor), and the mean and rms difference of toroidal shares. This is how `KNEE` is settled: on the papers, not on taste. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { parseProgram, PROGRAMS, PROGRAM_SCHEMA, type EspadonsProgram } from './program.mts';
import { chooseFit, KNEE } from './reduce.mts';

export interface LadderStep { readonly target: number; readonly chiSquare: number; readonly meanGauss: number; readonly toroidalPercent: number; readonly axisymmetricPercent: number }
export interface Scored { readonly id: string; readonly spectra: number; readonly target: number; readonly steps: number; readonly meanGauss: number; readonly toroidalPercent: number; readonly axisymmetricPercent: number; readonly publishedMeanGauss?: number; readonly publishedToroidalPercent?: number }
/** The programs with a star and a published block of the same tilt and period, each with its receipt's ladder when it has been reduced and a field was found. */
export async function benchmarkRuns(only?: string) { const runs: { program: EspadonsProgram; spectra?: number; ladder?: LadderStep[]; /** Why reduce.mts made no map to show of this run. */ refused?: string }[] = [];
  for (const name of (await readdir(PROGRAMS)).filter(file => file.endsWith('.json') && !file.endsWith('.map.json')).sort()) { const value = JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as { schema?: string }; if (value.schema !== PROGRAM_SCHEMA) continue;
    const program = parseProgram(value); if (!program.published || program.published.otherGeometry || !program.star || (only && !program.id.includes(only))) continue;
    const map = await readFile(resolve(PROGRAMS, `${program.id}.map.json`), 'utf8').then(text => (JSON.parse(text) as { map?: unknown }).map, () => undefined);
    if (map === undefined) { runs.push({ program }); continue; }
    const record = requireRecord(map, `${program.id} map`), verdict = record.verdict;
    if (!isRecord(verdict)) { runs.push({ program }); continue; }   // a receipt of an earlier reduction, which gave no verdict
    if (verdict.mapped !== true) { runs.push({ program, refused: String(verdict.reason) }); continue; }
    const ladder = requireArray(record.ladder ?? [], 'ladder').map(entry => { const step = requireRecord(entry, 'ladder step'), number = (key: string) => requireFiniteNumber(step[key], key);
      return { target: number('target'), chiSquare: number('chiSquare'), meanGauss: number('meanGauss'), toroidalPercent: number('toroidalPercent'), axisymmetricPercent: number('axisymmetricPercent') }; });
    runs.push({ program, spectra: requireFiniteNumber(record.spectraUsed, 'spectraUsed'), ladder }); }
  return runs; }
export function score(runs: Awaited<ReturnType<typeof benchmarkRuns>>, knee = KNEE): Scored[] { const out: Scored[] = [];
  for (const { program, ladder, spectra } of runs) { if (!ladder?.length || spectra === undefined) continue; const chosen = chooseFit(ladder, knee);
    out.push({ id: program.id, spectra, target: chosen.target, steps: ladder.length, meanGauss: chosen.meanGauss, toroidalPercent: chosen.toroidalPercent, axisymmetricPercent: chosen.axisymmetricPercent,
      ...(program.published!.meanGauss ? { publishedMeanGauss: program.published!.meanGauss.value } : {}), ...(program.published!.toroidalPercent ? { publishedToroidalPercent: program.published!.toroidalPercent.value } : {}) }); }
  return out; }
/** Over the scored runs: the median of ours / published mean field, the rms of its logarithm as a factor, and the mean and rms difference of toroidal shares in points. */
export function summary(scored: readonly Scored[]) { const ratios = scored.filter(run => run.publishedMeanGauss).map(run => Math.log(run.meanGauss / run.publishedMeanGauss!)).sort((a, b) => a - b), toroidal = scored.filter(run => run.publishedToroidalPercent !== undefined).map(run => run.toroidalPercent - run.publishedToroidalPercent!);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)]! : NaN, rms = (values: readonly number[]) => Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
  return { runs: scored.length, fieldRatioMedian: Math.exp(median), fieldRatioSpread: Math.exp(rms(ratios)), toroidalMeanDifference: toroidal.reduce((s, v) => s + v, 0) / toroidal.length, toroidalRmsDifference: rms(toroidal), withField: ratios.length, withToroidal: toroidal.length }; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), kneeText = flagValue(args, '--knee'), knee = kneeText === undefined ? KNEE : Number(kneeText);
  const runs = await benchmarkRuns(flagValue(args, '--only')), scored = score(runs, knee);
  if (!args.includes('--quiet')) for (const run of scored) console.log(`${run.id.padEnd(28)} ${String(run.spectra).padStart(3)} spectra  target ${String(run.target).padStart(4)} of ${String(run.steps).padStart(2)} steps  mean ${run.meanGauss.toFixed(1).padStart(7)} G (published ${String(run.publishedMeanGauss ?? '-').padStart(6)})  toroidal ${run.toroidalPercent.toFixed(0).padStart(3)}% (published ${String(run.publishedToroidalPercent ?? '-').padStart(3)})  axisymmetric ${run.axisymmetricPercent.toFixed(0).padStart(3)}%`);
  const total = summary(scored);
  console.log(`${total.runs} runs, knee ${knee}: mean field ours / published, median ${total.fieldRatioMedian.toFixed(2)}, spread a factor ${total.fieldRatioSpread.toFixed(2)} (${total.withField} runs); toroidal share ours - published, mean ${total.toroidalMeanDifference.toFixed(0)} points, rms ${total.toroidalRmsDifference.toFixed(0)} (${total.withToroidal} runs)`);
  const refused = runs.filter(run => run.refused), missing = runs.filter(run => !run.ladder && !run.refused).map(run => run.program.id);
  if (refused.length) { console.log(`${refused.length} runs reduced without a map to show:`); for (const run of refused) console.log(`  ${run.program.id}: ${run.refused!.split(':')[0]}${run.program.published!.meanGauss ? ` (published mean ${run.program.published!.meanGauss.value} G)` : ''}`); }
  if (missing.length) console.log(`not reduced: ${missing.join(', ')}`);
}
