#!/usr/bin/env node
/** Pin one star's polarimetric ESPaDOnS spectra of one observing run as a program.
 *
 *   node packages/telescope-cli/src/archives/espadons/archive.mts <program id> --name <star> --ra <degrees> --dec <degrees> --from <MJD> --to <MJD> [--object <object id>] [--radius 0.02]
 *   node packages/telescope-cli/src/archives/espadons/archive.mts --runs --ra <degrees> --dec <degrees> [--radius 0.02]
 *   node packages/telescope-cli/src/archives/espadons/archive.mts --ledger
 *
 * The archive is asked for every polarimetric product within the radius of the place, between the two days (cadc.mts). Each
 * is recorded by its artifact URI and byte count with what the archive's catalogue says of it: the name the observer typed,
 * the proposal, the start and the length of the sequence. The star's temperature, gravity and radial velocity are looked up
 * in the catalogues (catalogue.mts) and written as the `atmosphere` and `radialVelocity` blocks, each value with its source.
 * A program that already exists keeps the blocks it has, which a person may have corrected; only the observations are
 * refreshed.
 *
 * With `--object`, a program without a `star` block takes it from the star's own measurements record
 * (src/objects/<object id>/source/measurements.json, which the generator's --metadata pass fills from the catalogues):
 * rotation period, projected rotation speed and tilt, each cited as the record cites it.
 *
 * `--ledger` pins every run worth mapping of every star the ledger lists: at least RUN_SPECTRA spectra spread over at least
 * ROTATION_SHARE of a rotation, of a star whose rotation is known, from its record or from the program of a map its page
 * already shows. A run a program already covers is left alone.
 *
 * `--runs` pins nothing: it lists the star's products grouped into runs (a gap of 20 days starts a new run), to choose a span from.
 *
 * The program is written to packages/telescope-cli/src/archives/espadons/programs/<program id>.json. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, isRecord, positionalArguments } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { polarimetricProducts, type ArchivedProduct } from './cadc.mts';
import { starParameters } from './catalogue.mts';
import { parseProgram, programPath, PROGRAM_SCHEMA, PROGRAMS, type EspadonsProgram, type MappedStar } from './program.mts';

/** A run worth mapping: at least this many spectra, spread over at least this share of a rotation. A shorter run shows one
 * side of the star, and a map of it would draw the far side from nothing. */
export const RUN_SPECTRA = 6, ROTATION_SHARE = 0.5;
/** The degree a map is fitted to when no paper maps the star. */
const EXAMPLE_DEGREE = { value: 15, source: "ZDIpy's own example input (inzdi.dat), which fits to degree 15 and leaves its entropy to remove what the spectra do not ask for; no paper maps this star" };

/** A star's rotation from a measurements record, or undefined when the record lacks the period, the speed or the tilt. */
export function recordedStar(record: unknown, path: string): MappedStar | undefined {
  if (!isRecord(record)) return undefined;
  const cited = (field: string, source: string) => typeof record[field] === 'number' && typeof record[source] === 'string' ? { value: record[field], source: `${path}, ${field}: ${record[source]}` } : undefined;
  const period = cited('rotationPeriodDays', 'rotationPeriodSource'), speed = cited('projectedRotationSpeedKmS', 'projectedRotationSpeedSource'), tilt = cited('spinInclinationDegrees', 'spinInclinationSource');
  return period && speed && tilt ? { vsiniKmS: speed, inclinationDegrees: tilt, periodDays: period, maximumDegree: EXAMPLE_DEGREE } : undefined;
}
const recordOf = async (object: string) => { const path = `src/objects/${object}/source/measurements.json`; return recordedStar(JSON.parse(await readFile(resolve(WORKSPACE, path), 'utf8').catch(() => 'null')) as unknown, path); };

const DAY0 = Date.UTC(1858, 10, 17), day = (mjd: number) => new Date(DAY0 + mjd * 86400000).toISOString().slice(0, 10);
/** A star's products as runs: a new run starts after `gapDays` without a spectrum. */
export function runsOf(products: readonly ArchivedProduct[], gapDays = 20) { const runs: ArchivedProduct[][] = [];
  for (const product of products) { const last = runs.at(-1); if (last && product.mjdStart - last.at(-1)!.mjdStart <= gapDays) last.push(product); else runs.push([product]); }
  return runs.map(run => ({ from: day(run[0]!.mjdStart), to: day(run.at(-1)!.mjdStart), fromMjd: Math.floor(run[0]!.mjdStart), toMjd: Math.ceil(run.at(-1)!.mjdStart + 0.2), spectra: run.length, days: Number((run.at(-1)!.mjdStart - run[0]!.mjdStart).toFixed(1)),
    proposals: [...new Set(run.map(product => product.proposal))], names: [...new Set(run.map(product => product.targetName))] })); }

/** Pin one run. `given` is what another program of the same star already holds of it: its atmosphere, velocity and rotation. */
async function pin(id: string, name: string, ra: number, dec: number, radius: number, span: { readonly fromMjd: number; readonly toMjd: number }, object?: string, given?: Pick<EspadonsProgram, 'atmosphere' | 'radialVelocity' | 'star'>) {
  const observations = await polarimetricProducts(ra, dec, radius, span);
  if (!observations.length) throw new Error(`The archive holds no polarimetric ESPaDOnS product within ${radius} degrees of ${ra}, ${dec} between MJD ${span.fromMjd} and ${span.toMjd}.`);
  const kept = await readFile(programPath(id), 'utf8').then(text => JSON.parse(text) as Record<string, unknown>, () => ({} as Record<string, unknown>));
  const looked: Pick<Awaited<ReturnType<typeof starParameters>>, 'atmosphere' | 'radialVelocity' | 'notes'> = (kept.atmosphere ?? given?.atmosphere) && (kept.radialVelocity ?? given?.radialVelocity) ? { notes: [] } : await starParameters(name, ra, dec), atmosphere = kept.atmosphere ?? given?.atmosphere ?? looked.atmosphere, radialVelocity = kept.radialVelocity ?? given?.radialVelocity ?? looked.radialVelocity;
  const star = kept.star ?? given?.star ?? (object ? await recordOf(object) : undefined);
  const program = parseProgram({ schema: PROGRAM_SCHEMA, id, target: { name, ...(object ? { object } : {}), raDegrees: ra, decDegrees: dec, radiusDegrees: radius }, span, observations, ...(atmosphere ? { atmosphere } : {}), ...(radialVelocity ? { radialVelocity } : {}), ...(star ? { star } : {}), ...(kept.published ? { published: kept.published } : {}) });
  await mkdir(PROGRAMS, { recursive: true }); await writeFile(programPath(id), `${JSON.stringify(program, null, 2)}\n`);
  console.log(`${id}: ${observations.length} polarimetric spectra of ${name}, ${day(observations[0]!.mjdStart)} to ${day(observations.at(-1)!.mjdStart)}; typed names ${[...new Set(observations.map(observation => observation.targetName))].join(', ')}.${program.atmosphere ? ` Mask atmosphere ${program.atmosphere.effectiveTemperatureK.value} K, log g ${program.atmosphere.logGravity.value}.` : ''}${program.radialVelocity ? ` Radial velocity ${program.radialVelocity.value} km/s.` : ''}${looked.notes.length ? ` ${looked.notes.join(' ')}` : ''}${program.star ? '' : ' Add the star block (v sin i, tilt, period, maximum degree, each with its source) before mapping.'}`);
  return program;
}

/** `--ledger`: every run worth mapping of every ledger star whose rotation is known, pinned once. */
async function pinLedger() {
  const ledger = JSON.parse(await readFile(resolve(WORKSPACE, 'src/sources/espadons/ledger.json'), 'utf8')) as { stars: { id: string; typedNames: string[]; maps: { program: string }[] }[]; targets: { name: string; raDegrees: number; decDegrees: number; spectra: number }[] };
  const programs = await Promise.all((await readdir(PROGRAMS)).filter(file => file.endsWith('.json')).map(async file => parseProgram(JSON.parse(await readFile(resolve(PROGRAMS, file), 'utf8')))));
  const used = new Set(programs.map(program => program.id)); let pinned = 0;
  for (const star of ledger.stars) {
    // A star with a map on its page is mapped again as that map was; any other star, from its own record.
    const shown = programs.find(program => program.star && star.maps.some(map => map.program === program.id)), rotation = shown?.star ?? await recordOf(star.id);
    const typed = ledger.targets.filter(target => star.typedNames.includes(target.name)).sort((a, b) => b.spectra - a.spectra)[0];
    if (!rotation || !typed) continue;
    const here = programs.filter(program => Math.hypot((program.target.raDegrees - typed.raDegrees) * Math.cos(typed.decDegrees * Math.PI / 180), program.target.decDegrees - typed.decDegrees) < 0.02);
    for (const run of runsOf(await polarimetricProducts(typed.raDegrees, typed.decDegrees))) {
      if (run.spectra < RUN_SPECTRA || run.days < ROTATION_SHARE * rotation.periodDays.value || here.some(program => program.span.fromMjd <= run.toMjd && program.span.toMjd >= run.fromMjd)) continue;
      const month = `${star.id}-${run.from.slice(0, 7)}`, id = used.has(month) ? `${star.id}-${run.from}` : month; used.add(id);
      await pin(id, shown?.target.name ?? typed.name, typed.raDegrees, typed.decDegrees, 0.02, { fromMjd: run.fromMjd, toMjd: run.toMjd }, star.id, shown); pinned++; } }
  console.log(`${pinned} run(s) pinned.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), VALUES = ['--name', '--ra', '--dec', '--from', '--to', '--object', '--radius'], number = (flag: string, fallback?: number) => { const text = flagValue(args, flag); if (text === undefined) { if (fallback === undefined) throw new TypeError(`${flag} is required.`); return fallback; }
    const value = Number(text); if (!Number.isFinite(value)) throw new TypeError(`${flag} ${text} is not a number.`); return value; };
  if (args.includes('--ledger')) { await pinLedger(); process.exit(0); }
  const ra = number('--ra'), dec = number('--dec'), radius = number('--radius', 0.02);
  if (args.includes('--runs')) { for (const run of runsOf(await polarimetricProducts(ra, dec, radius))) console.log(`${run.from} to ${run.to} (MJD ${run.fromMjd} to ${run.toMjd}): ${run.spectra} spectra over ${run.days} d; proposals ${run.proposals.join(', ')}; typed names ${run.names.join(', ')}`); }
  else {
    const [id] = positionalArguments(args, VALUES), name = flagValue(args, '--name'), object = flagValue(args, '--object');
    if (!id || !name) throw new TypeError('Usage: archive.mts <program id> --name <star> --ra <degrees> --dec <degrees> --from <MJD> --to <MJD> [--object <object id>] [--radius 0.02]');
    await pin(id, name, ra, dec, radius, { fromMjd: number('--from'), toMjd: number('--to') }, object);
  }
}
