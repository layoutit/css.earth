/** A draft spec for an eclipsing binary from DEBCat (Southworth 2015, ASPC 496, 164; arXiv:1411.1219), the catalogue of detached
 * eclipsing binaries whose masses and radii are measured to about 2%: one row of its page gives both stars' masses, radii, log g and
 * log Teff with their errors, the period and the papers they come from. The draft places the primary as a star and the secondary as its
 * companion on that period, at the separation Kepler's third law gives for the two masses.
 *
 * DEBCat lists no inclination, eccentricity or eclipse time, and rounds the period too coarsely to time eclipses. The draft leaves them
 * out and names them with the paper to read them from, and the spec parser refuses the draft until a person has copied them in: the
 * tool never fills a gap. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Archive } from './archives.mts';

export const DEBCAT = 'https://www.astro.keele.ac.uk/jkt/debcat/';
export const DEBCAT_CREDIT = 'DEBCat (Southworth 2015, ASPC 496, 164)';

/** A value and its error; DEBCat leaves the error out for some values. */
type Measured = readonly [value: number, error: number | undefined];
export interface DebcatRow {
  readonly name: string; readonly periodDays: number;
  readonly mass: readonly [Measured, Measured]; readonly radius: readonly [Measured, Measured]; readonly logg: readonly [Measured, Measured]; readonly logTeff: readonly [Measured, Measured];
  readonly references: readonly { readonly label: string; readonly url: string }[];
}

const text = (html: string) => html.replace(/<[^>]*>/gu, ' ').replace(/&plusmn;/gu, '±').replace(/&nbsp;/gu, ' ').replace(/&amp;/gu, '&').replace(/\s+/gu, ' ').trim();
/** DEBCat links the papers over http; a spec cites https, and an ADS link by the bibcode ADS serves today. */
const httpsReference = (url: string) => url.replace(/^http:\/\/adsabs\.harvard\.edu\/abs\//u, 'https://ui.adsabs.harvard.edu/abs/').replace(/^http:\/\//u, 'https://');

/** Every system on the DEBCat page, read or with the reason it cannot be: a cell that does not read as a value, with or without
 * "± error", for both stars (some rows leave a temperature empty). Only the systems a draft asks for must read. */
export function parseDebcat(html: string): ({ readonly name: string } & ({ readonly row: DebcatRow } | { readonly error: string }))[] {
  const rows: ({ readonly name: string } & ({ readonly row: DebcatRow } | { readonly error: string }))[] = [];
  for (const row of html.split(/<TR\b/iu).slice(1)) {
    const cells = [...row.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/giu)].map(match => match[1]!);
    if (cells.length < 11 || !/sim-id\?Ident=/u.test(cells[0]!)) continue;
    const name = text(cells[0]!);
    try { rows.push({ name, row: readRow(name, cells) }); } catch (error) { rows.push({ name, error: (error as Error).message }); }
  }
  return rows;
}

function readRow(name: string, cells: readonly string[]): DebcatRow {
  {
    const pair = (index: number, label: string): readonly [Measured, Measured] => {
      const parts = cells[index]!.split(/<BR>/iu).map(text);
      const read = (part: string | undefined): Measured => { const match = /^(-?[\d.]+)(?:\s*±\s*([\d.]+))?$/u.exec(part ?? ''); if (!match) throw new TypeError(`DEBCat ${name}: ${label} "${part ?? ''}" is not a value.`); return [Number(match[1]), match[2] === undefined ? undefined : Number(match[2])]; };
      return [read(parts[0]), read(parts[1])];
    };
    const periodDays = Number(text(cells[1]!));
    if (!(periodDays > 0)) throw new TypeError(`DEBCat ${name}: period "${text(cells[1]!)}" is not positive.`);
    const references = [...cells[10]!.matchAll(/([^<>]*?)\(\s*<A HREF="([^"]+)">([^<]*)<\/A>\s*\)/giu)].map(match => ({ label: `${text(match[1]!)} (${text(match[3]!)})`, url: httpsReference(match[2]!.trim()) }));
    return { name, periodDays, mass: pair(4, 'mass'), radius: pair(5, 'radius'), logg: pair(6, 'log g'), logTeff: pair(7, 'log Teff'), references };
  }
}

const AU_SOLAR_RADII = 215.032, YEAR_DAYS = 365.25;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

/** The draft spec of one system and the orbit elements a person must copy from its paper. */
export function draftFromDebcat(row: DebcatRow): { readonly spec: Record<string, unknown>; readonly missing: readonly string[] } {
  const paper = row.references[0];
  if (!paper) throw new TypeError(`DEBCat ${row.name}: no paper is linked, so its values cannot be cited.`);
  const from = `as ${DEBCAT_CREDIT} lists it from ${paper.label}`;
  const cite = ([value, uncertainty]: Measured, what: string) => ({ value, ...(uncertainty ? { uncertainty } : {}), source: `${what} ${value}${uncertainty ? ` +/- ${uncertainty}` : ' (no error listed)'}, ${from}`, url: paper.url });
  const temperature = (logT: Measured, star: string) => {
    const kelvin = Math.round(10 ** logT[0]);
    return { value: kelvin, ...(logT[1] ? { uncertainty: Math.round(kelvin * Math.LN10 * logT[1]) } : {}), source: `${star} log Teff ${logT[0]}${logT[1] ? ` +/- ${logT[1]}` : ' (no error listed)'}, ${from}: ${kelvin} K`, url: paper.url };
  };
  const [m1, m2] = row.mass, [r1, r2] = row.radius, id = slug(row.name);
  const separationAu = ((m1[0] + m2[0]) * (row.periodDays / YEAR_DAYS) ** 2) ** (1 / 3), aOverR1 = Number((separationAu * AU_SOLAR_RADII / r1[0]).toFixed(4));
  const words = (star: 'primary' | 'secondary', m: Measured, r: Measured) => `The ${star} star of the eclipsing binary ${row.name}, ${m[0]} solar masses and ${r[0]} solar radii; the two stars eclipse each other every ${row.periodDays} days.`;
  const spec = {
    id: `${id}-a`, name: `${row.name} A`, system: `${row.name} system`, description: words('primary', m1, r1), target: row.name,
    paper: { url: paper.url, credit: paper.label },
    radius: cite(r1, 'Primary radius (solar radii)'), mass: cite(m1, 'Primary mass (solar masses)'), temperature: temperature(row.logTeff[0], 'Primary'),
    gravity: cite(row.logg[0], 'Primary log g'),
    planets: [],
    companions: [{
      id: `${id}-b`, name: `${row.name} B`, description: words('secondary', m2, r2), paper: { url: paper.url, credit: paper.label },
      radius: cite(r2, 'Secondary radius (solar radii)'), mass: cite(m2, 'Secondary mass (solar masses)'), temperature: temperature(row.logTeff[1], 'Secondary'),
      // DEBCat rounds the period to a thousandth of a day, too coarse to time eclipses years on: it only sizes the orbit here.
      orbit: { elements: { semiMajorAxisStellarRadii: aOverR1 },
        source: `Separation derived here by Kepler's third law from the two masses and the period ${row.periodDays} d ${from}: ${separationAu.toFixed(5)} au, ${aOverR1} primary radii`, url: paper.url },
    }],
    notes: [`Masses, radii and temperatures as ${DEBCAT_CREDIT} (${DEBCAT}) lists them from ${row.references.map(reference => reference.label).join('; ')}.`],
  };
  return { spec, missing: [`periodDays with the eclipse ephemeris it belongs to (DEBCat's ${row.periodDays} d is rounded)`, 'inclinationDegrees', 'eccentricity', 'argumentOfPeriapsisDegrees (when eccentric)', 'transitTimeBmjdTdb with its epoch (inferior- or superior-conjunction, or periastron)'] };
}

/** `new-object --from-debcat SYSTEM... --out spec.json`: the drafts, and for each the elements to copy from its paper. */
export async function specFromDebcat(names: readonly string[], out: string, archive: Archive) {
  const rows = parseDebcat(await archive.text(DEBCAT)), stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const name of names) {
    const entry = rows.find(candidate => candidate.name.toLowerCase() === name.trim().toLowerCase());
    if (!entry) throw new Error(`DEBCat has no system named ${name}; its names are GCVS, then Bayer, Flamsteed, HR, HD, TIC or Tycho (${DEBCAT}).`);
    if ('error' in entry) throw new Error(entry.error);
    const row = entry.row;
    const { spec, missing } = draftFromDebcat(row);
    stars.push(spec);
    report.push(`${row.name}: copy ${missing.join(', ')} from ${row.references[0]!.label} (${row.references[0]!.url}) into ${String(spec.id)}'s companion orbit; add distance if Gaia DR3 cannot place it.`);
  }
  const path = resolve(out);
  await writeFile(path, `${JSON.stringify({ stars }, null, 2)}\n`);
  return { path, report, entries: stars.length };
}
