/** A star's MEarth light curve, found in the MEarth Project's public data release and read as it is published.
 *
 * MEarth watched nearby mid-to-late M dwarfs from the ground, one star a field, with eight 0.4 m telescopes at each of
 * two sites (Berta et al. 2012, AJ 144, 145; Irwin et al. 2015). Its eleventh and last data release (1 August 2022)
 * holds every target's light curves as text files, one a star and a telescope, and its release notes (README.txt,
 * prepared by Jonathan Irwin) describe each column. MEarth-South's are the light curves Newton et al. (2018, AJ 156,
 * 217) searched for rotation (newton.mts).
 *
 * A file's magnitudes are differential, and the release notes say what is left in them on purpose: an offset between
 * the two sides of the meridian and at every change of the instrument (a "segment", column `S`), and the "common mode"
 * (column `CM`), the change all the M dwarfs observed in the same half hour share, which scales by a factor of the star's
 * own. Both "must be re-fit" with the star's variability, and the release's own corrected column is "strongly advised
 * against" for it. So nothing here corrects a light curve. The paper's model does, through its authors' own code: sfit
 * (tools.py; toolchain.json pins it) fits each segment's baseline, the common mode's scale and a sinusoid at one period
 * together (Newton et al. 2016, ApJ 821, 93, Sect. III.1), and the light curve mapped is "the data with the common mode
 * and varying baseline magnitudes removed", which is what the paper's authors inspect.
 *
 * What is this module's and is printed in neither paper is said where it is done: which of a star's light curves is read
 * (`longest`), a night's light as one point (`nightly`) and where a season begins (`seasonsOf`). */
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { medianAveraged, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { USER_AGENT } from '../tess/mast.mts';
import { runTool, toolchainPaths } from './toolchain.mts';

/** The release that is read, with its notes; and MEarth-South's part of it: its index of targets, the folder of its
 * files, the site's longitude and the size of a pixel on the sky, both from the release notes ("Instrument description"). */
export const MEARTH_RELEASE = { name: 'Data Release 11', posted: '2022-08-01', page: 'https://lweb.cfa.harvard.edu/MEarth/DataDR11.html', notes: 'https://lweb.cfa.harvard.edu/MEarth/DR11/README.txt' } as const;
export const MEARTH_SOUTH = { site: 'MEarth-South', index: 'https://lweb.cfa.harvard.edu/MEarth/DR11/south2014-2022/index.html', files: 'https://lweb.cfa.harvard.edu/MEarth/DR11/south2014-2022/lc/', longitudeDegrees: -(70 + 48 / 60 + 0.5 / 3600), pixelArcsec: 0.84 } as const;
/** The zero of the clock a kept light curve's times are on, a barycentric Julian date: the files print the date whole. */
export const MEARTH_TIME_ZERO = 2450000;

/** The names of a star's light curve files in the release's index: one a telescope (`2MASSJhhmmssss-ddmmsss_telnn_yyyy-yyyy.txt`). */
export function filesOf(index: string, twomass: string): string[] {
  if (!/^\d{8}[+-]\d{7}$/u.test(twomass)) throw new TypeError(`${twomass} is not a 2MASS designation.`);
  const found = new Set<string>(); for (const [, name] of index.matchAll(/href="lc\/(2MASSJ\d{8}[+-]\d{7}_tel\d{2}_\d{4}-\d{4}\.txt)"/gu)) if (name!.startsWith(`2MASSJ${twomass}_`)) found.add(name!);
  return [...found].sort();
}

const fetched = async (url: string) => { const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(600_000) }); if (!response.ok) throw new Error(`The MEarth release answered ${response.status} for ${url}.`); return response; };
/** The release's index of MEarth-South's targets: one request, kept at `kept` when a path is given, so every star of every run reads it once. */
export async function southIndex(kept?: string): Promise<string> {
  const held = kept === undefined ? undefined : await readFile(kept, 'utf8').catch(() => undefined); if (held !== undefined) return held;
  const text = await (await fetched(MEARTH_SOUTH.index)).text(); if (!text.includes('href="lc/2MASSJ')) throw new TypeError('The MEarth release\'s index lists no light curve.');
  if (kept !== undefined) { await mkdir(dirname(kept), { recursive: true }); const part = `${kept}.${process.pid}.part`; await writeFile(part, text); await rename(part, kept); }
  return text;
}
/** One file of the release, written under `directory` as it is served; one already there is kept. */
export async function fetchLightCurve(filename: string, directory: string): Promise<{ readonly filename: string; readonly file: string; readonly url: string; readonly bytes: number }> {
  const url = `${MEARTH_SOUTH.files}${encodeURIComponent(filename)}`, path = resolve(directory, filename), held = await stat(path).then(info => info.size, () => 0);
  if (held > 0) return { filename, file: path, url, bytes: held };
  const response = await fetched(url), bytes = Buffer.from(await response.arrayBuffer()), declared = Number(response.headers.get('content-length') ?? bytes.length);
  if (bytes.length === 0 || bytes.length !== declared) throw new Error(`${filename} arrived as ${bytes.length} bytes of the ${declared} the release declared.`);
  await mkdir(directory, { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  return { filename, file: path, url, bytes: bytes.length };
}

/** The columns of a light curve file, in order, as the release notes list them ("Light curve file contents"). */
export const COLUMNS = ['BJD', 'Mag', 'e_Mag', 'tExp', 'DMag', 'FWHM', 'Ellip', 'Airmass', 'X', 'Y', 'Angle', 'Sky', 'Peak', 'S', 'V', 'R', 'F', 'CM', 'Corr_Mag'] as const;
/** One file, read: what its header says of it, and the columns the paper's model takes. `aperturePixels` is the radius
 * of the photometric aperture and `deblended` the header's flag that the target's detection was de-blended, which "can
 * indicate the presence of a nearby star that may contaminate the aperture photometry" (release notes). */
export interface MearthLightCurve { readonly telescope: string; readonly filter: string; readonly twomass: string; readonly aperturePixels?: number; readonly deblended?: boolean;
  /** Barycentric Julian dates (TDB) of mid-exposure, differential magnitudes and their uncertainties, each exposure's segment, and the common mode at its time. */
  readonly bjd: readonly number[]; readonly magnitude: readonly number[]; readonly error: readonly number[]; readonly segment: readonly number[]; readonly commonMode: readonly number[] }
export function parseLightCurve(text: string): MearthLightCurve {
  const header = new Map<string, string>(), bjd: number[] = [], magnitude: number[] = [], error: number[] = [], segment: number[] = [], commonMode: number[] = []; let titled = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) { const pair = /^#\s*(\w+(?:\[\d+\])?)\s*=\s*(\S+)/u.exec(line); if (pair) header.set(pair[1]!, pair[2]!); else if (line.slice(1).trim().split(/\s+/u).join(' ') === COLUMNS.join(' ')) titled = true; continue; }
    if (!line.trim()) continue;
    const cells = line.trim().split(/\s+/u); if (!titled || cells.length !== COLUMNS.length) throw new TypeError('A MEarth light curve file does not hold the columns its release notes list.');
    const value = (column: typeof COLUMNS[number]) => { const number = Number(cells[COLUMNS.indexOf(column)]); if (!Number.isFinite(number)) throw new TypeError(`A MEarth light curve file holds a ${column} that is not a number.`); return number; };
    bjd.push(value('BJD')); magnitude.push(value('Mag')); error.push(value('e_Mag')); segment.push(value('S')); commonMode.push(value('CM')); }
  const need = (key: string) => { const found = header.get(key); if (found === undefined) throw new TypeError(`A MEarth light curve file's header holds no ${key}.`); return found; }, aperture = Number(header.get('aperture')), deblend = header.get('deblend');
  if (bjd.length < 2 || !error.every(one => one > 0)) throw new TypeError('A MEarth light curve file holds no light curve, or an uncertainty that is not positive.');
  // The release sorts a file by time; the model does not ask for it, and a season's limits do.
  const order = bjd.map((_, index) => index).sort((a, b) => bjd[a]! - bjd[b]!), sorted = (values: readonly number[]) => order.map(index => values[index]!);
  return { telescope: need('telescope'), filter: need('filter'), twomass: need('twomass'), ...(Number.isFinite(aperture) && aperture > 0 ? { aperturePixels: aperture } : {}), ...(deblend === undefined ? {} : { deblended: deblend !== '0' }),
    bjd: sorted(bjd), magnitude: sorted(magnitude), error: sorted(error), segment: sorted(segment), commonMode: sorted(commonMode) };
}

const kept = (curve: MearthLightCurve, keep: (index: number) => boolean): MearthLightCurve => { const at = curve.bjd.map((_, index) => index).filter(keep), pick = (values: readonly number[]) => at.map(index => values[index]!);
  return { ...curve, bjd: pick(curve.bjd), magnitude: pick(curve.magnitude), error: pick(curve.error), segment: pick(curve.segment), commonMode: pick(curve.commonMode) }; };
/** A light curve's exposures taken before `lastBjd`: the light a paper analysed ends on a day the paper prints. */
export const before = (curve: MearthLightCurve, lastBjd: number): MearthLightCurve => kept(curve, index => curve.bjd[index]! < lastBjd);
/** How far from its median an exposure may lie, in standard deviations, to be fitted: "we remove data deviating from the
 * median by more than 5σ, where we use the median absolute deviation scaled to the Gaussian-equivalent RMS", which
 * "is done to remove flares and (in some cases) eclipses" (Newton et al. 2016, Sect. III.1). */
export const CLIP_DEVIATIONS = 5, MAD_TO_SIGMA = 1.4826;
export function clipped(curve: MearthLightCurve): MearthLightCurve { if (!curve.bjd.length) return curve;
  const median = medianAveraged([...curve.magnitude]), sigma = MAD_TO_SIGMA * medianAveraged(curve.magnitude.map(one => Math.abs(one - median)));
  return kept(curve, index => Math.abs(curve.magnitude[index]! - median) < CLIP_DEVIATIONS * sigma); }

/** The night an exposure belongs to: nights are counted from one local noon at the site to the next. A Julian date
 * begins at noon in Greenwich, so the count changes at the site's own noon when the longitude, as a share of a turn,
 * is added. */
export const nightOf = (bjd: number, longitudeDegrees: number = MEARTH_SOUTH.longitudeDegrees) => Math.floor(bjd + longitudeDegrees / 360);
export const nightsOf = (curve: Pick<MearthLightCurve, 'bjd'>, longitudeDegrees: number = MEARTH_SOUTH.longitudeDegrees) => new Set(curve.bjd.map(one => nightOf(one, longitudeDegrees))).size;
/** The star's longest dataset: of its light curves, one a telescope, the one with the most nights. The table of Newton
 * et al. (2018) prints the number of nights "in longest dataset" for each star, and its number for a star is this light
 * curve's (newton.mts sets the two beside each other). The paper fits all of a star's light curves together, each with
 * a sinusoid of its own, so one light curve is corrected the same whether or not the others are fitted with it. Reading
 * only the longest is this module's: some of the others are a few nights of one long run of exposures, taken to follow
 * a planet's transit, and a baseline cannot be told from a sinusoid of a hundred days in them. */
export function longest<Curve extends Pick<MearthLightCurve, 'bjd'>>(curves: readonly Curve[]): Curve | undefined {
  return [...curves].filter(curve => curve.bjd.length > 0).sort((a, b) => nightsOf(b) - nightsOf(a) || b.bjd.length - a.bjd.length)[0]; }

/** What sfit fitted to a light curve at one period, and the light curve with its baselines and common mode taken off. */
export interface MearthModel { /** The baseline magnitude of each segment that holds an exposure, in the order of the segments' numbers. */ readonly baselines: readonly number[]; readonly commonModeScale: number;
  /** The sinusoid's semi-amplitude, magnitudes. */ readonly semiAmplitude: number; readonly corrected: readonly number[] }
/** The paper's sinusoid model of a light curve at `periodDays`, by its authors' code (tools.py `model`). */
export async function modelled(curve: MearthLightCurve, periodDays: number): Promise<MearthModel & { readonly sfit: string; readonly chiSquaredNull: number; readonly chiSquared: number }> {
  if (!(periodDays > 0)) throw new RangeError('The model is fitted at a rotation period.');
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'mearth-')), job = join(directory, 'job.json'), base = Math.floor(curve.bjd[0]!);
  try { await writeFile(job, JSON.stringify({ periodDays, curves: [{ time: curve.bjd.map(one => one - base), magnitude: curve.magnitude, error: curve.error, commonMode: curve.commonMode, segment: curve.segment }] }));
    const answer = requireRecord(runTool(python, ['model', job]), 'sfit\'s answer'), fit = requireRecord(requireArray(answer.curves, 'curves')[0], 'the fitted light curve'), number = (key: string) => requireFiniteNumber(fit[key], key);
    const corrected = requireArray(fit.corrected, 'corrected').map((one, index) => requireFiniteNumber(one, `corrected[${index}]`)); if (corrected.length !== curve.bjd.length) throw new Error('sfit returned a light curve of another length.');
    return { sfit: requireString(answer.sfit, 'sfit version'), chiSquaredNull: requireFiniteNumber(answer.chiSquaredNull, 'chiSquaredNull'), chiSquared: requireFiniteNumber(answer.chiSquared, 'chiSquared'),
      baselines: requireArray(fit.baselines, 'baselines').map((one, index) => requireFiniteNumber(one, `baselines[${index}]`)), commonModeScale: number('commonModeScale'), semiAmplitude: Number(Math.hypot(number('sine'), number('cosine')).toFixed(6)), corrected }; }
  finally { await rm(directory, { recursive: true, force: true }); }
}

/** A light curve as one point a night: the median of the night's magnitudes at the mean of their times. Newton et al.
 * (2018, Figs. 6 and 7) show the light of Proxima Centauri and of GJ 1132 that way, "median combined into one day
 * bins", after the offsets of their fit are taken off. A star here turns once in some hundred days, so a night is a
 * hundredth of a turn; a flare the clip left lasts minutes of it. Mapping the nightly medians and not every exposure is
 * this module's choice. */
export function nightly(bjd: readonly number[], magnitude: readonly number[], longitudeDegrees: number = MEARTH_SOUTH.longitudeDegrees): { readonly bjd: number[]; readonly magnitude: number[]; readonly exposures: number[] } {
  const nights = new Map<number, { times: number[]; magnitudes: number[] }>();
  for (const [index, time] of bjd.entries()) { const night = nightOf(time, longitudeDegrees), held = nights.get(night) ?? { times: [], magnitudes: [] }; held.times.push(time); held.magnitudes.push(magnitude[index]!); nights.set(night, held); }
  const ordered = [...nights].sort(([a], [b]) => a - b).map(([, held]) => held);
  return { bjd: ordered.map(held => held.times.reduce((sum, one) => sum + one, 0) / held.times.length), magnitude: ordered.map(held => medianAveraged(held.magnitudes)), exposures: ordered.map(held => held.times.length) };
}

/** The Sun's mean longitude, degrees, `days` after the epoch J2000.0 (Julian date 2451545.0), and the tilt of the
 * ecliptic: the low-precision formulas for the Sun of The Astronomical Almanac (section C). The mean longitude is within
 * two degrees of the true one, which is two days of a season's limit. */
export const SUN = { epochJd: 2451545.0, meanLongitudeDegrees: 280.460, degreesPerDay: 0.9856474, obliquityDegrees: 23.439 } as const;
const YEAR_DAYS = 360 / SUN.degreesPerDay, RAD = Math.PI / 180;
/** The first day after J2000.0, as a Julian date, on which the Sun passes the star's ecliptic longitude: the star is then
 * behind the Sun, or as near it as it gets, and cannot be watched from the ground. */
export function conjunctionJd(raDegrees: number, decDegrees: number): number {
  const longitude = Math.atan2(Math.sin(raDegrees * RAD) * Math.cos(SUN.obliquityDegrees * RAD) + Math.tan(decDegrees * RAD) * Math.sin(SUN.obliquityDegrees * RAD), Math.cos(raDegrees * RAD)) / RAD;
  return SUN.epochJd + ((((longitude - SUN.meanLongitudeDegrees) % 360) + 360) % 360) / SUN.degreesPerDay;
}
/** One season of a star's light: the nights between two of the star's conjunctions with the Sun, named by the year its
 * middle falls in, when the star is opposite the Sun. Times are on the kept clock (MEARTH_TIME_ZERO); the light is a
 * share of the season's mean. */
export interface MearthSeason { readonly season: number; readonly nights: number; readonly exposures: number; /** From the first night to the last, days. */ readonly spanDays: number; readonly time: readonly number[]; readonly flux: readonly number[] }
/** A star's light, one point a night, cut into its seasons, oldest first. A star's spots change within months, and a
 * light curve from the ground is years long with a gap each year where the star is near the Sun: a map is made of one
 * season, as it is made of one quarter of a Kepler star's four years. The papers fit a star's years as one sinusoid, an
 * assumption they make "for the purposes of period detection" (Newton et al. 2018, Sect. III.1), and show GJ 1132's
 * spots changing in the time it takes to turn once. Cutting at the conjunction is this module's. */
export function seasonsOf(light: { readonly bjd: readonly number[]; readonly magnitude: readonly number[]; readonly exposures: readonly number[] }, raDegrees: number, decDegrees: number): MearthSeason[] {
  const first = conjunctionJd(raDegrees, decDegrees), parts = new Map<number, number[]>();
  for (const [index, time] of light.bjd.entries()) { const turn = Math.floor((time - first) / YEAR_DAYS); parts.set(turn, [...parts.get(turn) ?? [], index]); }
  return [...parts].sort(([a], [b]) => a - b).map(([turn, at]) => { const flux = at.map(index => 10 ** (-0.4 * light.magnitude[index]!)), mean = flux.reduce((sum, one) => sum + one, 0) / flux.length;
    // The year of the season's middle, half a year after the conjunction that begins it.
    const season = new Date((first + (turn + 0.5) * YEAR_DAYS - 2440587.5) * 86400000).getUTCFullYear();
    return { season, nights: at.length, exposures: at.reduce((sum, index) => sum + light.exposures[index]!, 0), spanDays: Number((light.bjd[at.at(-1)!]! - light.bjd[at[0]!]!).toFixed(1)),
      time: at.map(index => Number((light.bjd[index]! - MEARTH_TIME_ZERO).toFixed(5))), flux: flux.map(one => Number((one / mean).toFixed(6))) }; });
}
