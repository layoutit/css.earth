#!/usr/bin/env node
/** Pin one star's polarimetric ESPaDOnS spectra of one observing run as a program.
 *
 *   node packages/telescope-cli/src/archives/espadons/archive.mts <program id> --name <star> --ra <degrees> --dec <degrees> --from <MJD> --to <MJD> [--object <object id>] [--radius 0.02]
 *   node packages/telescope-cli/src/archives/espadons/archive.mts --runs --ra <degrees> --dec <degrees> [--radius 0.02]
 *
 * The archive is asked for every polarimetric product within the radius of the place, between the two days (cadc.mts). Each
 * is recorded by its artifact URI and byte count with what the archive's catalogue says of it: the name the observer typed,
 * the proposal, the start and the length of the sequence. The star's temperature, gravity and radial velocity are looked up
 * in the catalogues (catalogue.mts) and written as the `atmosphere` and `radialVelocity` blocks, each value with its source.
 * A program that already exists keeps the blocks it has, which a person may have corrected; only the observations are
 * refreshed.
 *
 * `--runs` pins nothing: it lists the star's products grouped into runs (a gap of 20 days starts a new run), to choose a span from.
 *
 * The program is written to packages/telescope-cli/src/archives/espadons/programs/<program id>.json. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { flagValue, positionalArguments } from '@cssearth/core';
import { polarimetricProducts, type ArchivedProduct } from './cadc.mts';
import { starParameters } from './catalogue.mts';
import { parseProgram, programPath, PROGRAM_SCHEMA, PROGRAMS } from './program.mts';

const DAY0 = Date.UTC(1858, 10, 17), day = (mjd: number) => new Date(DAY0 + mjd * 86400000).toISOString().slice(0, 10);
/** A star's products as runs: a new run starts after `gapDays` without a spectrum. */
export function runsOf(products: readonly ArchivedProduct[], gapDays = 20) { const runs: ArchivedProduct[][] = [];
  for (const product of products) { const last = runs.at(-1); if (last && product.mjdStart - last.at(-1)!.mjdStart <= gapDays) last.push(product); else runs.push([product]); }
  return runs.map(run => ({ from: day(run[0]!.mjdStart), to: day(run.at(-1)!.mjdStart), fromMjd: Math.floor(run[0]!.mjdStart), toMjd: Math.ceil(run.at(-1)!.mjdStart + 0.2), spectra: run.length, days: Number((run.at(-1)!.mjdStart - run[0]!.mjdStart).toFixed(1)),
    proposals: [...new Set(run.map(product => product.proposal))], names: [...new Set(run.map(product => product.targetName))] })); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), VALUES = ['--name', '--ra', '--dec', '--from', '--to', '--object', '--radius'], number = (flag: string, fallback?: number) => { const text = flagValue(args, flag); if (text === undefined) { if (fallback === undefined) throw new TypeError(`${flag} is required.`); return fallback; }
    const value = Number(text); if (!Number.isFinite(value)) throw new TypeError(`${flag} ${text} is not a number.`); return value; };
  const ra = number('--ra'), dec = number('--dec'), radius = number('--radius', 0.02);
  if (args.includes('--runs')) { for (const run of runsOf(await polarimetricProducts(ra, dec, radius))) console.log(`${run.from} to ${run.to} (MJD ${run.fromMjd} to ${run.toMjd}): ${run.spectra} spectra over ${run.days} d; proposals ${run.proposals.join(', ')}; typed names ${run.names.join(', ')}`); }
  else {
    const [id] = positionalArguments(args, VALUES), name = flagValue(args, '--name'), object = flagValue(args, '--object');
    if (!id || !name) throw new TypeError('Usage: archive.mts <program id> --name <star> --ra <degrees> --dec <degrees> --from <MJD> --to <MJD> [--object <object id>] [--radius 0.02]');
    const span = { fromMjd: number('--from'), toMjd: number('--to') }, observations = await polarimetricProducts(ra, dec, radius, span);
    if (!observations.length) throw new Error(`The archive holds no polarimetric ESPaDOnS product within ${radius} degrees of ${ra}, ${dec} between MJD ${span.fromMjd} and ${span.toMjd}.`);
    const kept = await readFile(programPath(id), 'utf8').then(text => JSON.parse(text) as Record<string, unknown>, () => ({} as Record<string, unknown>));
    const looked: Pick<Awaited<ReturnType<typeof starParameters>>, 'atmosphere' | 'radialVelocity' | 'notes'> = kept.atmosphere && kept.radialVelocity ? { notes: [] } : await starParameters(name, ra, dec), atmosphere = kept.atmosphere ?? looked.atmosphere, radialVelocity = kept.radialVelocity ?? looked.radialVelocity;
    const program = parseProgram({ schema: PROGRAM_SCHEMA, id, target: { name, ...(object ? { object } : {}), raDegrees: ra, decDegrees: dec, radiusDegrees: radius }, span, observations, ...(atmosphere ? { atmosphere } : {}), ...(radialVelocity ? { radialVelocity } : {}), ...(kept.star ? { star: kept.star } : {}), ...(kept.published ? { published: kept.published } : {}) });
    await mkdir(PROGRAMS, { recursive: true }); await writeFile(programPath(id), `${JSON.stringify(program, null, 2)}\n`);
    console.log(`${id}: ${observations.length} polarimetric spectra of ${name}, ${day(observations[0]!.mjdStart)} to ${day(observations.at(-1)!.mjdStart)}; typed names ${[...new Set(observations.map(observation => observation.targetName))].join(', ')}.${program.atmosphere ? ` Mask atmosphere ${program.atmosphere.effectiveTemperatureK.value} K, log g ${program.atmosphere.logGravity.value}.` : ''}${program.radialVelocity ? ` Radial velocity ${program.radialVelocity.value} km/s.` : ''}${looked.notes.length ? ` ${looked.notes.join(' ')}` : ''}${program.star ? '' : ' Add the star block (v sin i, tilt, period, maximum degree, each with its source) before mapping.'}`);
  }
}
