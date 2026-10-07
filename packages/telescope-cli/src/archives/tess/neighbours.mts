/** The Gaia sources around a star, counted for its page to say.
 *
 * A mission's light curve of a star adds up pixels (21 arcseconds wide for TESS, 4 for K2), and other stars near it fall
 * in them. Gaia DR3 lists them: CDS X-Match returns every Gaia source within a radius of each star in one request, with
 * its magnitude in Gaia's red band. The star is the source at its place; the rest are neighbours, and their share is
 * their summed flux over everyone's. The count is stated in a star's texts. Nothing is refused on it: the light curves
 * are the missions' own, which correct for crowding, and no published method here sets a limit on it. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { USER_AGENT } from './mast.mts';

export const XMATCH = 'https://cdsxmatch.u-strasbg.fr/xmatch/api/v1/sync', GAIA_TABLE = 'I/355/gaiadr3', GAIA_EPOCH_YEAR = 2016;
/** Three TESS pixels: how far from a star another star's light still falls in the pixels added up for it. */
export const NEIGHBOUR_ARCSEC = 63;
/** How far from a star's place at Gaia's epoch its own Gaia source may lie. */
export const OWN_ARCSEC = 3;
export interface PixelLight { /** The star's own Gaia DR3 source and its magnitude (red band, or G where Gaia gives no red one). */ readonly gaiaDr3: string; readonly magnitude: number;
  readonly neighbours: number; /** The neighbours' share of all the light in the circle, 0 to 1. */ readonly neighbourShare: number;
  readonly brightest?: { readonly gaiaDr3: string; readonly magnitude: number; readonly arcsec: number } }

const cells = (line: string) => line.split(',');
/** X-Match's CSV answer as each star's light: its own source is the nearest within OWN_ARCSEC. A star with no source there is left out. */
export function parseNeighbours(csv: string, radiusArcsec = NEIGHBOUR_ARCSEC): Map<string, PixelLight> {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), names = cells(header ?? ''), at = (name: string) => names.indexOf(name), [distance, id, source, red, green] = [at('angDist'), at('id'), at('Source'), at('RPmag'), at('Gmag')];
  if ([distance, id, source, red, green].some(index => index! < 0)) throw new TypeError('X-Match did not answer with Gaia DR3 sources.');
  const byStar = new Map<string, { gaiaDr3: string; magnitude: number; arcsec: number }[]>();
  for (const line of lines) { const row = cells(line), magnitude = Number(row[red!] || row[green!]); if (!row[id!] || !row[source!] || !Number.isFinite(magnitude) || !(row[red!] || row[green!])) continue;
    byStar.set(row[id!]!, [...byStar.get(row[id!]!) ?? [], { gaiaDr3: row[source!]!, magnitude, arcsec: Number(row[distance!]) }]); }
  const out = new Map<string, PixelLight>(), flux = (magnitude: number) => 10 ** (-0.4 * magnitude);
  for (const [star, sources] of byStar) { const own = sources.filter(one => one.arcsec <= OWN_ARCSEC).sort((a, b) => a.arcsec - b.arcsec)[0]; if (!own) continue;
    const others = sources.filter(one => one !== own && one.arcsec <= radiusArcsec).sort((a, b) => a.magnitude - b.magnitude), theirs = others.reduce((sum, one) => sum + flux(one.magnitude), 0), brightest = others[0];
    out.set(star, { gaiaDr3: own.gaiaDr3, magnitude: own.magnitude, neighbours: others.length, neighbourShare: Number((theirs / (theirs + flux(own.magnitude))).toFixed(4)),
      ...(brightest ? { brightest: { gaiaDr3: brightest.gaiaDr3, magnitude: brightest.magnitude, arcsec: Number(brightest.arcsec.toFixed(1)) } } : {}) }); }
  return out;
}

/** What each mission's pixels can follow. Kepler's and K2's are 4 arcseconds wide and the pixels added up for a star reach
 * some four of them; their photometer follows stars far fainter than TESS, and its apertures take in a bright star's bleed. */
/** How far from a star its neighbours are counted, by mission: three TESS pixels, four of K2's and of Kepler's. */
export const PIXELS = { TESS: { radiusArcsec: NEIGHBOUR_ARCSEC }, K2: { radiusArcsec: 16 }, Kepler: { radiusArcsec: 16 } } as const;

/** X-Match's answer for `stars`, which are at their places at Gaia's epoch: one request for all of them, as CSV with its header. */
export async function askNeighbours(stars: readonly { readonly id: string; readonly raDegrees: number; readonly decDegrees: number }[]): Promise<string> {
  const form = new FormData(); for (const [key, value] of Object.entries({ request: 'xmatch', distMaxArcsec: String(NEIGHBOUR_ARCSEC), RESPONSEFORMAT: 'csv', colRA1: 'ra', colDec1: 'dec', cat2: `vizier:${GAIA_TABLE}`, cols2: 'Source,Gmag,RPmag' })) form.set(key, value);
  form.set('cat1', new Blob([`id,ra,dec\n${stars.map(star => `${star.id},${star.raDegrees.toFixed(6)},${star.decDegrees.toFixed(6)}`).join('\n')}\n`], { type: 'text/csv' }), 'stars.csv');
  const response = await fetch(XMATCH, { method: 'POST', body: form, headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(1_800_000) });
  if (!response.ok) throw new Error(`CDS X-Match answered ${response.status} for the Gaia sources around ${stars.length} stars.`);
  return response.text();
}

/** Each star's light, by star id, with what is kept from earlier runs: `kept` is X-Match's answers so far and `asked` the
 * stars they cover, one id a line. Only the stars not yet asked are asked, in one request, and both files grow. */
export async function pixelLight(stars: readonly { readonly id: string; readonly raDegrees: number; readonly decDegrees: number }[], kept?: { readonly csv: string; readonly asked: string }, radiusArcsec = NEIGHBOUR_ARCSEC): Promise<Map<string, PixelLight>> {
  const held = kept ? await readFile(kept.csv, 'utf8').catch(() => '') : '', asked = new Set(kept ? (await readFile(kept.asked, 'utf8').catch(() => '')).split('\n').filter(Boolean) : []), fresh = stars.filter(star => !asked.has(star.id));
  if (!fresh.length) return parseNeighbours(held, radiusArcsec);
  const answer = await askNeighbours(fresh), csv = held ? `${held.trimEnd()}\n${answer.split(/\r?\n/u).slice(1).join('\n')}` : answer;
  if (kept) { await mkdir(dirname(kept.csv), { recursive: true }); await writeFile(kept.csv, csv); await writeFile(kept.asked, [...asked, ...fresh.map(star => star.id)].map(id => `${id}\n`).join('')); }
  return parseNeighbours(csv, radiusArcsec);
}
