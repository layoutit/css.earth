#!/usr/bin/env node
import { findOne } from './find-product.mts';
/**
 * One planet's emission light curve from a joint Eureka! Stage 5 fit of several reduced visits.
 *
 *   node tools/objects/jwst/joint-emission.mts <joint directory> <output root> <csv> [--export-only] [--planet <n>]
 *
 * A joint directory (tools/objects/jwst/programs/<id>) names the visits in the order the parameter file numbers them, each by
 * its reduce-tso work directory under the output root, and pins the Stage 5 control and parameter files. The run:
 *
 * 1. Fits every visit jointly with Eureka! Stage 5 (least squares), reading each visit's Stage 4 light curve.
 * 2. Removes the instrument and the star from the fitted table: (data - GP) / systematics, the detrended flux.
 * 3. Removes everything Eureka! modelled except the planet's own emission (the other planets' eclipses and phase curves and every
 *    transit), by subtracting the astrophysical model and adding back the planet's sinusoid phase curve times its eclipse.
 * 4. Writes time, flux, error, a mask for every transit of every planet from its fitted orbit (padded 10 minutes), and an indicator column per visit after the first:
 *    the light-curve form an eclipse-map-fit recipe reads.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { eurekaToolchain } from './toolchain.mts';
import { renderSettings } from './reduce-tso.mts';

const EXPORT = `
import json, sys, numpy as np
from astropy.table import Table
table, out = sys.argv[1:3]
t = Table.read(table, format='ascii.ecsv')
systematics = np.prod([np.asarray(t[k]) for k in ('polynomial', 'xpos', 'xwidth', 'ypos', 'ywidth') if k in t.colnames], axis=0)
data, gp, astro, err = (np.asarray(t[k]) for k in ('lcdata', 'GP', 'astrophysical model', 'lcerr'))
np.savetxt(out, np.column_stack([np.asarray(t['time']), (data - gp) / systematics, err / systematics, astro]), delimiter=',', header='time,flux,err,astro', comments='')
print(len(data))
`;

const overlap = (z: number, r: number) => {
  if (z >= 1 + r) return 0;
  if (z <= 1 - r) return Math.PI * r * r;
  const k0 = Math.acos((r * r + z * z - 1) / (2 * r * z)), k1 = Math.acos((1 - r * r + z * z) / (2 * z));
  return r * r * k0 + k1 - Math.sqrt(Math.max(0, 4 * z * z - (1 + z * z - r * r) ** 2)) / 2;
};

/** Fits the visits jointly with Eureka! Stage 5 into <output root>/<id>/Stage5. */
export async function fitJoint(jointDirectory: string, outputRoot: string) {
  const joint = requireRecord(JSON.parse(await readFile(resolve(jointDirectory, 'joint.json'), 'utf8')) as unknown, 'joint.json');
  if (joint.schema !== 'cssearth-jwst-joint-fit@1') throw new TypeError(`${jointDirectory}: unexpected joint-fit schema.`);
  const eventName = requireString(joint.eventName), toolchain = await eurekaToolchain(requireString(joint.crdsContext));
  const visits = requireArray(joint.visits).map(value => requireString(requireRecord(value, 'visit').work));
  const stage4 = await Promise.all(visits.map(async work => (await findOne(resolve(outputRoot, work, 'Stage4'), /_LCData\.h5$/u)).replace(/\/[^/]+$/u, '')));
  const relative = (path: string) => path.slice(resolve(outputRoot).length + 1);
  const work = resolve(outputRoot, requireString(joint.id));
  await mkdir(work, { recursive: true });
  let control = renderSettings(await readFile(resolve(jointDirectory, requireString(joint.control)), 'utf8'),
    { topdir: `${resolve(outputRoot)}/`, inputdir: relative(stage4[0]!), outputdir: `${requireString(joint.id)}/Stage5` });
  control = control.replace(/^(inputdirlist[ \t]+)[^#\n]*/mu, (_, lead: string) => `${lead}${JSON.stringify(stage4.slice(1).map(relative)).replaceAll('"', "'")}  `);
  await writeFile(resolve(work, `S5_${eventName}.ecf`), control);
  await writeFile(resolve(work, requireString(joint.parameters)), await readFile(resolve(jointDirectory, requireString(joint.parameters))));
  const fit = spawnSync(toolchain.python, ['-c', `from eureka.S5_lightcurve_fitting import s5_fit\ns5_fit.fitlc('${eventName}', ecf_path='${work}')`],
    { cwd: outputRoot, env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 1 << 28 });
  await writeFile(resolve(work, 'S5.log'), `${fit.stdout}${fit.stderr}`);
  if (fit.status !== 0) throw new Error(`Eureka! Stage 5 failed; see ${resolve(work, 'S5.log')}.`);
}

/** Writes the planet's emission light curve from the joint fit's Stage 5 output. */
export async function writeEmission(jointDirectory: string, outputRoot: string, csv: string, planet = 0) {
  const joint = requireRecord(JSON.parse(await readFile(resolve(jointDirectory, 'joint.json'), 'utf8')) as unknown, 'joint.json');
  const toolchain = await eurekaToolchain(requireString(joint.crdsContext));
  const visits = requireArray(joint.visits).map(value => requireString(requireRecord(value, 'visit').work));
  const work = resolve(outputRoot, requireString(joint.id)), stage5 = resolve(work, 'Stage5');
  const control = await readFile(resolve(work, `S5_${requireString(joint.eventName)}.ecf`), 'utf8');
  const table = await findOne(stage5, /_Table_Save_shared\.txt$/u), parameters = await findOne(stage5, /^S5_lsq_fitparams_shared\.csv$/u);
  const detrended = resolve(work, 'detrended.csv');
  const exported = spawnSync(toolchain.python, ['-c', EXPORT, table, detrended], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8' });
  if (exported.status !== 0) throw new Error(`Exporting the fitted table failed: ${exported.stderr}`);

  // Free parameters come from the fit; fixed ones (the other planet's eclipse time in each eclipse visit, for one) only from the
  // parameter file, and Eureka! used them as written.
  const fixed = (await readFile(resolve(work, requireString(joint.parameters)), 'utf8')).split('\n').map(line => line.trim().split(/\s+/u))
    .filter(fields => fields[2] === "'fixed'" && Number.isFinite(Number(fields[1]))).map(([key, value]) => [key!, Number(value)] as const);
  const fitted = new Map([...fixed, ...(await readFile(parameters, 'utf8')).trim().split('\n').slice(1).map(line => line.split(',')).map(([key, value]) => [key!, Number(value)] as const)]);
  const value = (key: string) => { const v = fitted.get(key); if (v === undefined || !Number.isFinite(v)) throw new Error(`The fit has no ${key}.`); return v; };
  const [, ...rows] = (await readFile(detrended, 'utf8')).trim().split('\n');
  const table4 = rows.map(row => row.split(',').map(Number));
  // Eureka! writes the visits in order; each keeps its Stage 4 integrations after the control file's leading clip.
  const clip = Number(/^manual_clip[ \t]+\[\[None, *(\d+)\]\]/mu.exec(control)?.[1] ?? 0);
  const lengths = await Promise.all(visits.map(async name => (await readFile(resolve(outputRoot, name, 'light-curves/ours-white.csv'), 'utf8')).trim().split('\n').length - 1 - clip));
  if (lengths.reduce((sum, n) => sum + n, 0) !== table4.length) throw new Error(`The visits' ${lengths.join('+')} integrations do not make the fitted table's ${table4.length}.`);
  const channel = lengths.flatMap((n, c) => Array<number>(n).fill(c));
  // Eureka! names the first planet's parameters bare and the others with _pl<n>; each visit's eclipse time adds _ch<n>.
  const suffixOf = (index: number) => (index === 0 ? '' : `_pl${index}`);
  const planets: number[] = [];
  for (let index = 0; fitted.has(`rp${suffixOf(index)}`); index++) planets.push(index);
  if (!planets.includes(planet)) throw new Error(`The fit has no planet ${planet}.`);
  const model = (index: number) => {
    const named = (key: string) => `${key}${suffixOf(index)}`;
    const period = value(named('per')), a = value(named('a')), inclination = value(named('inc')) * Math.PI / 180, rp = value(named('rp'));
    const transitTime = value(named('t0')), fp = fitted.get(named('fp')) ?? 0;
    // The phase curve as the fit modelled it: a sinusoid (AmpCos1, AmpSin1) or a quasi-Lambertian |cos(phi/2)|^gamma. A planet
    // whose dayside flux is held at 0 has neither.
    // As in Eureka!, a sinusoid whose amplitudes are all 0 and a quasi-Lambertian curve with gamma 0 are switched off.
    const amplitudes = { cosine: fitted.get(named('AmpCos1')) ?? 0, sine: fitted.get(named('AmpSin1')) ?? 0 }, quasi = fitted.get(named('quasi_gamma')) ?? 0;
    const cosine = amplitudes.cosine !== 0 || amplitudes.sine !== 0 ? amplitudes.cosine : undefined, sine = amplitudes.sine, gamma = quasi !== 0 ? quasi : undefined;
    if (fp !== 0 && (cosine === undefined) === (gamma === undefined)) throw new Error(`The fit gives planet ${index} ${cosine === undefined ? 'no' : 'two'} phase curves.`);
    const phase = (phi: number) => cosine !== undefined ? 1 + cosine * (Math.cos(phi) - 1) + sine * Math.sin(phi) : Math.abs(Math.cos(phi / 2)) ** gamma!;
    const separation = (phi: number) => a * Math.sqrt(Math.sin(phi) ** 2 + (Math.cos(inclination) * Math.cos(phi)) ** 2);
    return {
      fp, ...(cosine === undefined ? { gamma } : { cosine, sine }),
      // The emission as Eureka! modelled it: the phase curve times the eclipse, at each visit's fitted eclipse time.
      emission: (time: number, visit: number) => {
        if (fp === 0) return 0;
        const eclipse = fitted.get(`${named('t_secondary')}_ch${visit}`) ?? value(named('t_secondary')), phi = 2 * Math.PI * (time - eclipse) / period;
        return fp * phase(phi) * (Math.cos(phi) > 0 ? 1 - overlap(separation(phi), rp) / (Math.PI * rp * rp) : 1);
      },
      // In front of the star and overlapping its disc, from the planet's own fitted orbit.
      transiting: (time: number) => { const phi = 2 * Math.PI * (time - transitTime) / period; return Math.cos(phi) > 0 && separation(phi) < 1 + rp; },
    };
  };
  const models = planets.map(model), own = models[planet]!;
  const emission = table4.map(([time], i) => own.emission(time!, channel[i]!));
  // Every transit of every planet is masked, padded by 10 minutes on each side: the eigenmap fit models emission only.
  const masked = table4.map(([time]) => models.some(m => m.transiting(time! - 10 / 1440) || m.transiting(time!) || m.transiting(time! + 10 / 1440)));
  // Outside transits the fitted astrophysical model is the star plus every planet's emission; a mismatch means the emission here
  // is not the one the fit subtracted.
  let worst = 0;
  table4.forEach(([time, , , astro], i) => { if (!masked[i]) worst = Math.max(worst, Math.abs(astro! - 1 - models.reduce((sum, m) => sum + m.emission(time!, channel[i]!), 0))); });
  if (worst > 5e-6) throw new Error(`Outside transits the fitted model differs from the star plus the planets' emission by up to ${(worst * 1e6).toFixed(1)} ppm.`);
  const header = ['time', 'flux', 'error', 'mask', ...lengths.slice(1).map((_, c) => `visit${c + 1}`)];
  const lines = table4.map(([time, flux, error, astro], i) => [time!.toFixed(8), (1 + flux! - astro! + emission[i]!).toFixed(9), error!.toExponential(6),
    masked[i] ? 1 : 0, ...lengths.slice(1).map((_, c) => (channel[i] === c + 1 ? 1 : 0))].join(','));
  await writeFile(csv, `${header.join(',')}\n${lines.join('\n')}\n`);
  const { emission: _emission, transiting: _transiting, ...planetParameters } = own;
  return { rows: lines.length, masked: masked.filter(Boolean).length, worstResidualPpm: worst * 1e6, ...planetParameters };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [jointDirectory, outputRoot, csv, ...rest] = process.argv.slice(2);
  if (!jointDirectory || !outputRoot || !csv) throw new TypeError('Usage: joint-emission <joint directory> <output root> <csv> [--export-only] [--planet <n>]');
  // --planet picks the planet by its number in the fit: 0 (the default) is the first, whose parameters carry no suffix.
  const planet = Number(rest[rest.indexOf('--planet') + 1] ?? 0);
  if (rest.includes('--planet') && !(Number.isSafeInteger(planet) && planet >= 0)) throw new TypeError('--planet takes a planet number.');
  // --export-only rewrites the light curve from an existing Stage 5 run, as the fit left it.
  if (!rest.includes('--export-only')) await fitJoint(resolve(jointDirectory), resolve(outputRoot));
  console.log(JSON.stringify(await writeEmission(resolve(jointDirectory), resolve(outputRoot), resolve(csv), rest.includes('--planet') ? planet : 0)));
}
