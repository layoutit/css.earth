#!/usr/bin/env node
/** Compare a reduced program with what a paper printed about the same run: the oracle for reduce.mts.
 *
 *   node packages/telescope-cli/src/archives/espadons/compare.mts <program id>
 *
 * The program's `published` block holds numbers a person transcribed with where each is printed. Three are compared:
 * the longitudinal field of each spectrum, matched by mid-exposure time (within a minute); the mean field strength of the
 * map; and the toroidal share of its energy. A paper's map is another fit of other choices to partly other spectra, so the
 * map numbers are set side by side, not required to agree; the longitudinal fields measure the same thing from the same
 * spectra and are. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord } from '@cssearth/core';
import { PROGRAMS, readProgram, type PublishedRun } from './program.mts';

export interface FieldPair { readonly utc: string; readonly ours: number; readonly oursError: number; readonly published: number; readonly publishedError: number }
/** Our longitudinal fields beside the published ones of the same spectra, and how they agree. */
export function compareFields(ours: readonly { readonly utc: string; readonly gauss: number; readonly error: number }[], published: NonNullable<PublishedRun['longitudinalFields']>) {
  const pairs: FieldPair[] = [];
  for (const row of published) { const at = Date.parse(`${row.utc}Z`), match = ours.find(one => Math.abs(Date.parse(`${one.utc}Z`) - at) <= 60_000); if (match) pairs.push({ utc: row.utc, ours: match.gauss, oursError: match.error, published: row.gauss, publishedError: row.error }); }
  if (pairs.length < 3) return { pairs };
  const n = pairs.length, ma = pairs.reduce((s, p) => s + p.ours, 0) / n, mb = pairs.reduce((s, p) => s + p.published, 0) / n; let ab = 0, aa = 0, bb = 0, square = 0, chi = 0;
  for (const p of pairs) { ab += (p.ours - ma) * (p.published - mb); aa += (p.ours - ma) ** 2; bb += (p.published - mb) ** 2; square += (p.ours - p.published) ** 2; chi += (p.ours - p.published) ** 2 / (p.oursError ** 2 + p.publishedError ** 2); }
  return { pairs, meanOurs: ma, meanPublished: mb, correlation: ab / Math.sqrt(aa * bb), rmsDifference: Math.sqrt(square / n), /** Mean squared difference in units of the two error bars combined; 1 or less is agreement within the errors. */ reducedChiSquare: chi / n };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2]; if (!id) throw new TypeError('Usage: compare.mts <program id>');
  const program = await readProgram(id), receipt = requireRecord(JSON.parse(await readFile(resolve(PROGRAMS, `${id}.map.json`), 'utf8')), 'map receipt');
  if (!program.published) throw new Error(`${id} has no published block to compare with.`);
  console.log(`${id} against ${program.published.paper}`);
  const spectra = requireArray(requireRecord(receipt.profiles, 'receipt profiles').spectra, 'receipt spectra').map(entry => requireRecord(entry, 'receipt spectrum')).filter(entry => entry.used !== false).map(entry => { const field = requireRecord(entry.longitudinal, 'longitudinal'); return { utc: String(entry.utc), gauss: Number(field.gauss), error: Number(field.error) }; });
  if (program.published.longitudinalFields) { const result = compareFields(spectra, program.published.longitudinalFields);
    for (const pair of result.pairs) console.log(`  ${pair.utc}: ${pair.ours.toFixed(1)} ± ${pair.oursError.toFixed(1)} G; published ${pair.published.toFixed(1)} ± ${pair.publishedError.toFixed(1)} G`);
    if (result.correlation !== undefined) console.log(`longitudinal field of ${result.pairs.length} spectra (${program.published.longitudinalSource ?? 'published table'}): mean ${result.meanOurs!.toFixed(2)} G against ${result.meanPublished!.toFixed(2)} G; correlation ${result.correlation.toFixed(2)}; rms difference ${result.rmsDifference!.toFixed(2)} G; ${result.reducedChiSquare!.toFixed(2)} in units of the combined errors`);
    const unmatched = program.published.longitudinalFields.length - result.pairs.length; if (unmatched) console.log(`  ${unmatched} published spectra have no valid spectrum of ours within a minute.`); }
  const chosen = receipt.map === undefined ? undefined : requireRecord(receipt.map, 'receipt map').chosen;
  if (chosen !== undefined) { const map = requireRecord(receipt.map, 'receipt map'), fit = requireRecord(chosen, 'chosen fit');
    if (program.published.meanGauss) console.log(`mean field: ${Number(fit.meanGauss).toFixed(1)} G from ${String(map.spectraUsed)} spectra; published ${program.published.meanGauss.value} G (${program.published.meanGauss.source})${program.published.spectra ? ` from ${program.published.spectra.value} spectra` : ''}`);
    if (program.published.toroidalPercent) console.log(`toroidal share of the energy: ${Number(fit.toroidalPercent).toFixed(0)}%; published ${program.published.toroidalPercent.value}% (${program.published.toroidalPercent.source})`);
    console.log(`fit: reduced chi-square ${Number(fit.chiSquare).toFixed(2)} (${Number(fit.chiSquareNoField).toFixed(2)} with no field)`); }
  if (program.published.note) console.log(`note: ${program.published.note}`);
}
