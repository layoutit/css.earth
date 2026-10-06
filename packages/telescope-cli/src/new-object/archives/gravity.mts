/** The surface gravity a star's limb law is read at, when its mass is unmeasured.
 *
 * 1. **Published.** SIMBAD's compilation of spectroscopic measurements (mesFe_h) is searched at the star's J2000 position. A paper
 *    that analysed the star's own spectra comes before a survey pipeline (SURVEY_PIPELINES). Within the chosen class the most
 *    recent paper is used; a paper that measured several spectra (a pulsating star through its cycle) gives the median of its
 *    values. When the spec gives the class's published range, a value outside it is not used.
 * 2. **Bounded.** No value published: the limb law is read across the range the spec cites for the star's class, and drawn at
 *    the gravity whose law is closest to all the others. The largest difference to any of them is recorded; the gravity is
 *    marked unmeasured and never becomes a fact of the star.
 *
 * Either way the README states the spread of limb laws across the published values or the range, measured on the same grid.
 *
 * A draft route whose paper measures no mass cites the published value as the spec's `gravity` (citedGravity), so the generator
 * reads the limb law at it as at any cited gravity. */
import { interpolateQuadraticLimbDarkening } from '@cssearth/bake/objects/stellar';
import { VIZIER_ASU, type Archive } from './archives.mts';
import { SIMBAD_TAP } from '../companions.mts';
import { GRIDS } from '../darkening/limb.mts';
import type { Cited } from '../spec-types.mts';

/** Survey pipelines, which fit gravities for large samples with one automated model; a star's own analysis comes first. */
export const SURVEY_PIPELINES: Readonly<Record<string, string>> = {
  '2013AJ....146..134K': 'RAVE DR4', '2020AJ....160...83S': 'RAVE DR6', '2018MNRAS.478.4513B': 'GALAH DR2', '2021MNRAS.506..150B': 'GALAH DR3',
  '2022ApJS..259...35A': 'SDSS DR17 (APOGEE)', '2022AJ....163..152S': 'APOGEE Net', '2022A&A...663A...4S': 'a comparison of survey pipelines (Soubiran et al. 2022)',
};

export interface GravityRange { readonly min: number; readonly max: number; readonly source: string; readonly url: string }
export interface PublishedGravity { readonly logg: number; readonly bibcode: string; readonly title: string; readonly measurements: number; readonly survey: boolean }
export interface GravityChoice {
  readonly logg: number;
  /** Whether the gravity is a published value (a fact of the star) or a display choice inside a cited range. */
  readonly kind: 'published' | 'bounded';
  readonly source: string; readonly url: string;
  /** The gravities the spread was measured over, and the largest limb difference across them, as a fraction of the centre. */
  readonly span: readonly [number, number]; readonly spread: number;
  readonly sentence: string;
}

const tsv = (text: string) => {
  const [header, ...lines] = text.trim().split(/\r?\n/u), keys = header!.split('\t').map(key => key.replace(/^"|"$/gu, ''));
  return lines.filter(Boolean).map(line => Object.fromEntries(line.split('\t').map((cell, i) => [keys[i]!, cell.replace(/^"|"$/gu, '').trim()])));
};

/** Every published spectroscopic gravity within an arcsecond of the star, with its paper. */
export async function publishedGravities(archive: Archive, ra: number, dec: number, where: string) {
  const query = `SELECT b.main_id, m.log_g, m.bibcode, r.title FROM mesFe_h AS m JOIN basic AS b ON b.oid = m.oidref LEFT JOIN ref AS r ON r.bibcode = m.bibcode ` +
    `WHERE m.log_g IS NOT NULL AND CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${ra}, ${dec}, ${1 / 3600})) = 1`;
  const rows = tsv(await archive.text(SIMBAD_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', QUERY: query }));
  const objects = new Set(rows.map(row => row.main_id));
  if (objects.size > 1) throw new Error(`${where}: SIMBAD holds gravities for ${[...objects].join(' and ')} within 1 arcsecond; name the star's own.`);
  return rows.map(row => ({ logg: Number(row.log_g), bibcode: String(row.bibcode), title: String(row.title ?? '') })).filter(row => Number.isFinite(row.logg));
}

/** The largest mass inferred for any star: an initial 320 solar masses, in the cluster R136 (Crowther et al. 2010, MNRAS 408, 731,
 * https://arxiv.org/abs/1007.3284). A published gravity that implies more, with the star's own published radius, contradicts that
 * radius and is not used: Beta Gruis's one value, log g 3.47, would give a giant of 154 solar radii 2,500 solar masses. */
export const LARGEST_STELLAR_MASS_SOLAR = 320;
const GM_SUN_KM3_S2 = 132712440041.93938, SOLAR_RADIUS_KM = 695700;
/** The mass, in solar masses, of a star of `radiusSolar` whose surface gravity is `logg` (cgs): g R^2 / G. */
export const impliedMassSolar = (logg: number, radiusSolar: number): number => 10 ** logg * (radiusSolar * SOLAR_RADIUS_KM * 1e5) ** 2 / (GM_SUN_KM3_S2 * 1e15);

const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; };

/** The published value the rule chooses, or null when none is usable. */
export function choosePublished(rows: readonly { logg: number; bibcode: string; title: string }[], range?: GravityRange): PublishedGravity | null {
  const usable = rows.filter(row => !range || (row.logg >= range.min && row.logg <= range.max));
  for (const survey of [false, true]) {
    const candidates = usable.filter(row => (row.bibcode in SURVEY_PIPELINES) === survey);
    if (!candidates.length) continue;
    const bibcode = [...new Set(candidates.map(row => row.bibcode))].sort((a, b) => b.slice(0, 4).localeCompare(a.slice(0, 4)) || a.localeCompare(b))[0]!;
    const own = candidates.filter(row => row.bibcode === bibcode);
    return { logg: Number(median(own.map(row => row.logg)).toFixed(2)), bibcode, title: own[0]!.title, measurements: own.length, survey };
  }
  return null;
}

/** The quadratic laws of the first grid that covers the star at any of `loggs`, from one wide request per grid: each gravity's
 * law, or null where that grid does not reach it. With `all`, the grid must reach every gravity. */
async function lawsAcross(archive: Archive, teffK: number, loggs: readonly number[], where: string, all: boolean) {
  const lo = Math.min(...loggs), hi = Math.max(...loggs), reasons: string[] = [];
  // The spread is measured on the plane-parallel grids, read by temperature and gravity alone.
  for (const grid of GRIDS.filter(entry => !entry.columns.mass)) {
    const text = await archive.text(VIZIER_ASU, grid.form(`${Math.floor(teffK - 1000)}..${Math.ceil(teffK + 1000)}`, `${(lo - 0.5).toFixed(2)}..${(hi + 0.5).toFixed(2)}`));
    const rewritten = (grid.rewrite ?? []).reduce((out, { pattern, flags, replacement }) => out.replace(new RegExp(pattern, `${flags}u`), replacement), text.replace(/^#.*\n/gmu, '').replace(/^\s*\n/gmu, ''));
    const laws = loggs.map(logg => { try { return interpolateQuadraticLimbDarkening(rewritten, { law: 'quadratic', source: 'grid', path: grid.file, teffK, logg, models: grid.modelColumns, columns: grid.columns }); } catch (error) { reasons.push(`${grid.cite} at log g ${logg}: ${(error as Error).message}`); return null; } });
    if (all ? laws.every(Boolean) : laws.some(Boolean)) return laws;
  }
  throw new Error(`${where}: no limb grid covers ${teffK} K ${all ? 'across' : 'anywhere in'} log g ${lo}..${hi} (${reasons.slice(0, 3).join('; ')}).`);
}

/** A published choice as a spec's cited `gravity` (spec.mts): the value, the rule's sentence under the compilation it was read from, and the paper. */
export function citedGravity(choice: GravityChoice): Cited {
  if (choice.kind !== 'published') throw new TypeError(`A spec cites a published gravity; log g ${choice.logg} is a display choice inside a range.`);
  return { value: choice.logg, source: `SIMBAD's compilation of spectroscopic measurements (mesFe_h): ${choice.sentence}`, url: choice.url };
}

/** Intensity relative to the centre across the disc, mu from 0 to 1, for a quadratic law. */
const profile = ({ u1, u2 }: { u1: number; u2: number }) => Array.from({ length: 101 }, (_, i) => { const x = 1 - i / 100; return 1 - u1 * x - u2 * x * x; });
const difference = (a: readonly number[], b: readonly number[]) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));

/** Choose the gravity a star's limb is read at (header). Null when the star has no published value and the spec gives no range. */
export async function chooseGravity({ archive, ra, dec, teffK, range, where, radiusSolar, contradicted }: { archive: Archive; ra: number; dec: number; teffK: number; range?: GravityRange; where: string;
  /** The star's published radius: a gravity that with it implies more than any star's mass is left out, and `contradicted` is told why. */
  radiusSolar?: number; contradicted?: (sentence: string) => void }): Promise<GravityChoice | null> {
  const every = await publishedGravities(archive, ra, dec, where), tooMassive = radiusSolar === undefined ? [] : every.filter(row => impliedMassSolar(row.logg, radiusSolar) > LARGEST_STELLAR_MASS_SOLAR);
  const rows = every.filter(row => !tooMassive.includes(row)), published = choosePublished(rows, range);
  if (tooMassive.length && !rows.length) contradicted?.(`the published gravit${tooMassive.length === 1 ? 'y' : 'ies'}, ${tooMassive.map(row => `log g ${row.logg} (${row.bibcode})`).join(', ')}, would give this star of ${Number(radiusSolar!.toFixed(1))} solar radii ${Math.round(Math.min(...tooMassive.map(row => impliedMassSolar(row.logg, radiusSolar!)))).toLocaleString('en-US')} solar masses or more, above the ${LARGEST_STELLAR_MASS_SOLAR} that Crowther et al. (2010) infer for the most massive star, so ${tooMassive.length === 1 ? 'it contradicts' : 'they contradict'} the radius and ${tooMassive.length === 1 ? 'is' : 'are'} not used`);
  if (published) {
    const values = rows.filter(row => !range || (row.logg >= range.min && row.logg <= range.max)).map(row => row.logg);
    const gravities = [...new Set([...values, published.logg])], span = [Math.min(...values), Math.max(...values)] as const;
    // The spread is measured where a plane-parallel grid reaches every published value; elsewhere (a hot giant only Howarth's files
    // reach) it is not measured, and the sentence says nothing of it.
    const laws = await lawsAcross(archive, teffK, gravities, where, true).then(found => found.map(law => profile(law!)), () => null);
    const spread = laws ? Math.max(0, ...laws.map(law => difference(law, laws[gravities.indexOf(published.logg)]!))) : Number.NaN;
    // A label that already says what the paper is (the comparison of pipelines) stands as written; a survey's name is called its pipeline.
    const pipeline = SURVEY_PIPELINES[published.bibcode];
    return { logg: published.logg, kind: 'published', source: `${published.bibcode}${published.title ? ` ("${published.title}")` : ''}${pipeline ? `, ${/^an? /u.test(pipeline) ? pipeline : `the ${pipeline} pipeline`}` : ''}`,
      url: `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(published.bibcode)}`, span, spread,
      sentence: `log g ${published.logg} from ${published.bibcode}${published.measurements > 1 ? `, the median of its ${published.measurements} spectra` : ''}${pipeline ? ` (${pipeline}, a survey pipeline: no analysis of this star's own spectra is published)` : ''}; ` +
        `the ${values.length} published value${values.length === 1 ? '' : 's'} span log g ${span[0]} to ${span[1]}${Number.isFinite(spread) ? `, across which the limb law changes by at most ${(spread * 100).toFixed(1)}% of the centre brightness` : ''}` };
  }
  if (!range) return null;
  // Every 0.05 dex inside the cited range, on round values.
  const first = Math.ceil(range.min / 0.05 - 1e-9), last = Math.floor(range.max / 0.05 + 1e-9);
  const loggs = Array.from({ length: last - first + 1 }, (_, i) => Number(((first + i) * 0.05).toFixed(2)));
  // The grid may not reach the whole range (ATLAS starts at log g 0): the part it covers is the part the limb can be read at.
  const laws = await lawsAcross(archive, teffK, loggs, where, false);
  const covered = loggs.filter((_, i) => laws[i]), profiles = laws.flatMap(law => law ? [profile(law)] : []);
  const worst = profiles.map(candidate => Math.max(...profiles.map(other => difference(candidate, other))));
  const best = worst.indexOf(Math.min(...worst)), logg = covered[best]!, span = [covered[0]!, covered.at(-1)!] as const;
  return { logg, kind: 'bounded', source: range.source, url: range.url, span, spread: worst[best]!,
    sentence: `no gravity of this star is published (${rows.length ? `only values outside ${range.min} to ${range.max}` : 'none in SIMBAD'}); ${range.source} gives the class's range, log g ${range.min} to ${range.max}. ` +
      `Across log g ${span[0]} to ${span[1]}, the part the grid covers, the limb laws differ by at most ${(worst[best]! * 100).toFixed(1)}% of the centre brightness from the one drawn, at log g ${logg}, the gravity closest to all of them; log g ${logg} is a display choice, not a measurement` };
}
