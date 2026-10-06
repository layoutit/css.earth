#!/usr/bin/env node
/** What the Canadian archive holds of ESPaDOnS polarised spectra for this project's stars, and how far each star has come.
 *
 *   node packages/telescope-cli/src/archives/espadons/archive-ledger.mts [--local]     writes src/sources/espadons/ledger.json and docs/espadons-ledger.md
 *
 * The archive is asked once: every polarimetric product grouped by the name its observer typed, with the mean of the
 * target positions, the count and the first and last night. Each name is given to the nearest shipped star within
 * `MATCH_DEGREES` of it. A star's state comes from the programs and receipts beside this code, matched by place, never from
 * a constant:
 *
 *   `mapped`: a receipt at the star's place holds a map with the verdict mapped.
 *   `reduced, no map`: receipts exist and none holds such a map; the ledger says why with the receipt's own reason.
 *   `pinned`: a program exists and no receipt does.
 *   `held`: spectra, and no program yet.
 *
 * `--local` asks the archive nothing: it retakes the states from the programs and receipts. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { tapRows } from '@cssearth/telescope/node';
import { isCommand, ledgerFiles, REPOSITORY, runArchiveLedger, type ArchiveLedger } from '../ledger.mts';
import { namedShippedObjects, readJsonOrNull, type NamedShippedObject } from '../targets.mts';
import { CADC_TAP } from './cadc.mts';
import { MAP_SCHEMA, PROGRAMS, PROGRAM_SCHEMA, receiptPath } from './program.mts';

const SCHEMA = 'cssearth-espadons-ledger@1', LEDGER_JSON = 'src/sources/espadons/ledger.json';
/** How far a typed target may lie from a star and be the star, degrees: the search radius of a program. */
export const MATCH_DEGREES = 0.02;
/** A star with fewer spectra than this cannot be mapped and is only counted. */
export const LISTED_FROM = 6;
export type StarState = 'mapped' | 'reduced, no map' | 'pinned' | 'held';
export interface ArchiveTarget { readonly name: string; readonly raDegrees: number; readonly decDegrees: number; readonly spectra: number; readonly firstMjd: number; readonly lastMjd: number }
export interface LedgerStar { readonly id: string; readonly spectra: number; readonly typedNames: readonly string[]; readonly firstYear: number; readonly lastYear: number; readonly axis: 'measured' | 'display convention' | 'none';
  readonly state: StarState; readonly programs: readonly string[]; readonly maps: readonly { readonly program: string; readonly middleUtc: string; readonly meanGauss: number }[]; readonly reasons: readonly string[] }
export interface EspadonsLedger { readonly schema: typeof SCHEMA; readonly surveyed: string; readonly archive: { readonly targetNames: number; readonly spectra: number }; readonly shippedStars: number; readonly stars: readonly LedgerStar[] }
interface Local { readonly program: string; readonly raDegrees: number; readonly decDegrees: number; readonly receipt?: { readonly mapped: boolean; readonly reason?: string; readonly middleUtc?: string; readonly meanGauss?: number } }

const year = (mjd: number) => new Date((mjd - 40587) * 86400000).getUTCFullYear();
const apart = (a: { raDegrees: number; decDegrees: number }, raDeg: number, decDeg: number) => Math.hypot((a.raDegrees - raDeg) * Math.cos(decDeg * Math.PI / 180), a.decDegrees - decDeg);

/** Each archive target given to the nearest star within reach; of two stars at the same distance, the first by id. */
export function assignTargets(targets: readonly ArchiveTarget[], stars: readonly NamedShippedObject[]): Map<string, ArchiveTarget[]> { const given = new Map<string, ArchiveTarget[]>(), placed = stars.filter(star => star.position).sort((a, b) => a.id.localeCompare(b.id));
  for (const target of targets) { let best: NamedShippedObject | undefined, distance = MATCH_DEGREES;
    for (const star of placed) { const d = apart(target, star.position!.raDeg, star.position!.decDeg); if (d < distance) { best = star; distance = d; } }
    if (best) given.set(best.id, [...given.get(best.id) ?? [], target]); }
  return given; }

/** One star's row, from the targets given to it and the programs and receipts at its place. */
export function ledgerStar(star: NamedShippedObject, targets: readonly ArchiveTarget[], locals: readonly Local[], axis: LedgerStar['axis']): LedgerStar {
  const here = locals.filter(local => apart(local, star.position!.raDeg, star.position!.decDeg) < MATCH_DEGREES), receipts = here.filter(local => local.receipt), maps = receipts.filter(local => local.receipt!.mapped);
  return { id: star.id, spectra: targets.reduce((sum, target) => sum + target.spectra, 0), typedNames: targets.map(target => target.name).sort(), firstYear: year(Math.min(...targets.map(target => target.firstMjd))), lastYear: year(Math.max(...targets.map(target => target.lastMjd))), axis,
    state: maps.length ? 'mapped' : receipts.length ? 'reduced, no map' : here.length ? 'pinned' : 'held', programs: here.map(local => local.program).sort(),
    maps: maps.map(local => ({ program: local.program, middleUtc: local.receipt!.middleUtc ?? '', meanGauss: local.receipt!.meanGauss ?? NaN })).sort((a, b) => a.middleUtc.localeCompare(b.middleUtc)),
    reasons: [...new Set(receipts.filter(local => !local.receipt!.mapped).map(local => `${local.program}: ${local.receipt!.reason ?? 'no map'}`))].sort() }; }

/** What a ledger already records of each run. A receipt stays in ignored output/, so on a machine that has not reduced a
 * run, its result is the one the ledger file holds. */
export function recordedResults(ledger: unknown): Map<string, NonNullable<Local['receipt']>> { const out = new Map<string, NonNullable<Local['receipt']>>();
  if (!isRecord(ledger) || !Array.isArray(ledger.stars)) return out;
  for (const star of ledger.stars) { if (!isRecord(star)) continue;
    for (const map of Array.isArray(star.maps) ? star.maps : []) if (isRecord(map) && typeof map.program === 'string' && typeof map.middleUtc === 'string' && typeof map.meanGauss === 'number') out.set(map.program, { mapped: true, middleUtc: map.middleUtc, meanGauss: map.meanGauss });
    for (const reason of Array.isArray(star.reasons) ? star.reasons : []) { const cut = typeof reason === 'string' ? reason.indexOf(': ') : -1; if (cut > 0) out.set((reason as string).slice(0, cut), { mapped: false, reason: (reason as string).slice(cut + 2) }); } }
  return out; }

/** The programs beside this code, each with its receipt when this machine has reduced it and else with what the ledger records. */
async function localPrograms(): Promise<Local[]> { const out: Local[] = [], recorded = recordedResults(await readJsonOrNull(resolve(REPOSITORY, LEDGER_JSON)));
  for (const file of (await readdir(PROGRAMS)).filter(name => name.endsWith('.json')).sort()) { const program = await readJsonOrNull(resolve(PROGRAMS, file));
    if (!isRecord(program) || program.schema !== PROGRAM_SCHEMA || !isRecord(program.target)) continue; const id = requireString(program.id, `${file} id`), receipt = await readJsonOrNull(receiptPath(id));
    const map = isRecord(receipt) && receipt.schema === MAP_SCHEMA && isRecord(receipt.map) ? receipt.map : undefined, verdict = map && isRecord(map.verdict) ? map.verdict : undefined, chosen = map && isRecord(map.chosen) ? map.chosen : undefined;
    out.push({ program: id, raDegrees: requireFiniteNumber(program.target.raDegrees, `${id} raDegrees`), decDegrees: requireFiniteNumber(program.target.decDegrees, `${id} decDegrees`),
      ...(isRecord(receipt) && receipt.schema === MAP_SCHEMA ? { receipt: { mapped: verdict?.mapped === true, ...(typeof verdict?.reason === 'string' ? { reason: verdict.reason } : map ? {} : { reason: 'averaged, not mapped: the program has no star block' }), ...(typeof map?.middleUtc === 'string' ? { middleUtc: map.middleUtc } : {}), ...(typeof chosen?.meanGauss === 'number' ? { meanGauss: chosen.meanGauss } : {}) } } : recorded.has(id) ? { receipt: recorded.get(id)! } : {}) }); }
  return out; }
const axisOf = async (id: string): Promise<LedgerStar['axis']> => { const record = await readJsonOrNull(resolve(REPOSITORY, 'src/objects', id, 'source/preparation/rotation.json'));
  return !isRecord(record) ? 'none' : record.schema === 'cssearth-display-orientation@1' && !/inclination/iu.test(String(record.source ?? '')) ? 'display convention' : 'measured'; };
async function rows(targets: readonly ArchiveTarget[]): Promise<{ stars: LedgerStar[]; shipped: number }> { const shipped = (await namedShippedObjects(readJsonOrNull)).filter(star => star.position && star.position.radiusDeg < 0.05), given = assignTargets(targets, shipped), locals = await localPrograms(), stars: LedgerStar[] = [];
  for (const star of shipped) { const own = given.get(star.id); if (own) stars.push(ledgerStar(star, own, locals, await axisOf(star.id))); }
  return { stars: stars.sort((a, b) => b.spectra - a.spectra || a.id.localeCompare(b.id)), shipped: shipped.length }; }

export function parseLedger(value: unknown): EspadonsLedger { const record = requireRecord(value, 'ESPaDOnS ledger'); if (record.schema !== SCHEMA) throw new TypeError('Unsupported ESPaDOnS ledger.');
  const archive = requireRecord(record.archive, 'ledger archive'); return { schema: SCHEMA, surveyed: requireString(record.surveyed, 'surveyed'), archive: { targetNames: requireFiniteNumber(archive.targetNames, 'targetNames'), spectra: requireFiniteNumber(archive.spectra, 'spectra') },
    shippedStars: requireFiniteNumber(record.shippedStars, 'shippedStars'), stars: requireArray(record.stars, 'ledger stars') as LedgerStar[] }; }

export function guide(ledger: EspadonsLedger): string { const listed = ledger.stars.filter(star => star.spectra >= LISTED_FROM), count = (state: StarState) => ledger.stars.filter(star => star.state === state).length, total = ledger.stars.reduce((sum, star) => sum + star.spectra, 0);
  const row = (star: LedgerStar) => `| [${star.id}](../src/objects/${star.id}/README.md) | ${star.spectra} | ${star.firstYear === star.lastYear ? star.firstYear : `${star.firstYear} to ${star.lastYear}`} | ${star.typedNames.slice(0, 3).join(', ')}${star.typedNames.length > 3 ? `, and ${star.typedNames.length - 3} more` : ''} | ${star.axis} | ${star.state}${star.maps.length ? `: ${star.maps.map(map => `\`${map.program}\` (${map.meanGauss.toFixed(map.meanGauss < 10 ? 1 : 0)} G)`).join(', ')}` : ''} |`;
  const reasons = ledger.stars.flatMap(star => star.reasons.map(reason => `- **${star.id}**, ${reason}`));
  return `# What the archive holds of ESPaDOnS polarised spectra

Written by \`packages/telescope-cli/src/archives/espadons/archive-ledger.mts\` from the [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) on ${ledger.surveyed}.
The counts are the archive's own, from one grouped query. Every state is worked out from the programs in
\`packages/telescope-cli/src/archives/espadons/programs\` and the receipts \`reduce.mts\` writes under ignored \`output/espadons\`; a run
not reduced on this machine keeps the result recorded here. [A star's magnetic map from archived
spectra](stellar-magnetic-maps-from-spectra.md) describes what a map is made with and what it cannot do.

The archive holds ${ledger.archive.spectra.toLocaleString('en-US')} polarised spectra under ${ledger.archive.targetNames.toLocaleString('en-US')} typed target names. ${ledger.stars.length} of the ${ledger.shippedStars.toLocaleString('en-US')} stars this project ships have some: ${total.toLocaleString('en-US')} spectra.
${listed.length} stars have ${LISTED_FROM} or more and are listed. Mapped: ${count('mapped')}. Reduced without a map: ${count('reduced, no map')}. Pinned: ${count('pinned')}. Held: ${count('held')}.

Spectra alone do not make a map. A star also needs its rotation period, the tilt of its axis and its projected rotation
speed from papers, a field strong enough to detect, and spectra spread through a rotation. "Axis" says whether the star's
page already draws a measured tilt or only a display convention.

| star | spectra | years | names typed by observers | axis on its page | state |
|---|---|---|---|---|---|
${listed.map(row).join('\n')}
${reasons.length ? `\n## Reduced without a map\n\n${reasons.join('\n')}\n` : ''}`; }

export const ESPADONS_LEDGER: ArchiveLedger<EspadonsLedger> = { schema: SCHEMA, files: ledgerFiles(LEDGER_JSON, 'docs/espadons-ledger.md'), indent: 1, guide, writes: 'always',
  survey: async () => { const answered = await tapRows(CADC_TAP, "SELECT o.target_name, AVG(o.targetPosition_coordinates_cval1) AS ra, AVG(o.targetPosition_coordinates_cval2) AS dec, COUNT(*) AS n, MIN(p.time_bounds_lower) AS first, MAX(p.time_bounds_lower) AS last FROM caom2.Observation o JOIN caom2.Plane p ON o.obsID=p.obsID WHERE o.collection='CFHT' AND o.instrument_name='ESPaDOnS' AND p.productID LIKE '%p' AND p.calibrationLevel=2 GROUP BY o.target_name", 10000);
    const targets = answered.map((row): ArchiveTarget => ({ name: row.target_name ?? '', raDegrees: Number(row.ra), decDegrees: Number(row.dec), spectra: Number(row.n), firstMjd: Number(row.first), lastMjd: Number(row.last) })).filter(target => [target.raDegrees, target.decDegrees, target.spectra, target.firstMjd, target.lastMjd].every(Number.isFinite));
    // Only the targets that fall on a shipped star are kept for the local pass; a star shipped later needs the archive asked again.
    const { stars, shipped } = await rows(targets), kept = new Set(stars.flatMap(star => star.typedNames)); return { schema: SCHEMA, surveyed: new Date().toISOString().slice(0, 10), archive: { targetNames: answered.length, spectra: answered.reduce((sum, row) => sum + Number(row.n), 0) }, shippedStars: shipped, stars, targets: targets.filter(target => kept.has(target.name)) } as EspadonsLedger & { targets: ArchiveTarget[] }; },
  local: { parse: value => ({ ...parseLedger(value), targets: requireArray(requireRecord(value, 'ledger').targets, 'ledger targets') }) as EspadonsLedger, writes: 'always',
    refresh: async previous => { const targets = (previous as EspadonsLedger & { targets: ArchiveTarget[] }).targets, { stars, shipped } = await rows(targets); return { ...previous, shippedStars: shipped, stars }; } },
  summary: ledger => [`${ledger.stars.length} shipped stars have polarised ESPaDOnS spectra; ${ledger.stars.filter(star => star.spectra >= LISTED_FROM).length} have ${LISTED_FROM} or more; ${ledger.stars.filter(star => star.state === 'mapped').length} mapped.`] };

if (isCommand(import.meta.url)) await runArchiveLedger(ESPADONS_LEDGER);
