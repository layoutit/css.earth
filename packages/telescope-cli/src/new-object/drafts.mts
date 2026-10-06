/** Draft specs from an archive or a catalogue, one route per source: `new-object --from-<route> NAME... --out spec.json`. Each route
 * reads its source for the names given and returns the spec entries and a line per name; the spec is written in one place. A draft
 * names what its source lacks, and the spec parser refuses it until a person has cited the rest. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Archive } from './archives/archives.mts';

export interface Drafts { readonly stars: readonly unknown[]; readonly pictures?: readonly unknown[]; readonly coronae?: readonly unknown[]; readonly magneticMaps?: readonly unknown[]; readonly brightnessMaps?: readonly unknown[]; readonly report: readonly string[] }
interface Context { readonly root: string; readonly progress: (line: string) => void; readonly archive: Archive }
export const DRAFT_ROUTES: Readonly<Record<string, { readonly names: string; readonly draft: (names: readonly string[], context: Context) => Promise<Drafts> }>> = {
  // Transiting planet hosts from the NASA Exoplanet Archive's default parameter sets (from-archive.mts).
  archive: { names: 'HOST', draft: async (names, { root, progress }) => (await import('./generate.mts')).draftsFromArchive(names, { root, progress }) },
  // Both stars of an eclipsing binary from DEBCat (debcat.mts).
  debcat: { names: 'SYSTEM', draft: async (names, { archive }) => (await import('./archives/debcat.mts')).draftsFromDebcat(names, archive) },
  // A Kepler-field giant weighed by its oscillations, from APOKASC-3 (apokasc.mts).
  apokasc: { names: 'KIC', draft: async (names, { archive }) => (await import('./archives/apokasc.mts')).draftsFromApokasc(names, archive) },
  // A Cepheid's Baade-Wesselink radius and distance from Groenewegen (2013) (cepheids.mts).
  cepheids: { names: 'NAME', draft: async (names, { archive }) => (await import('./archives/cepheids.mts')).draftsFromCepheids(names, archive) },
  // A K2-field giant, far above or below the Galactic plane, weighed by its oscillations, from Khan et al. (2023) (k2.mts).
  k2: { names: 'EPIC', draft: async (names, { archive }) => (await import('./archives/k2.mts')).draftsFromK2(names, archive) },
  // A giant near the ecliptic poles, from the same paper's TESS + APOGEE table (k2.mts).
  tess: { names: 'TIC', draft: async (names, { archive }) => (await import('./archives/k2.mts')).draftsFromTess(names, archive) },
  // A star anywhere on the sky from Gaia DR3 alone: FLAME radius and mass, GSP-Phot temperature, its parallax (gaia.mts).
  gaia: { names: 'SOURCE_ID', draft: async (names, { archive }) => (await import('./archives/gaia.mts')).draftsFromGaia(names, archive) },
  // A Hipparcos star from the model-atmosphere fit to its light (McDonald, Zijlstra & Watson 2017), inside the paper's well-fit subset (hipparcos.mts).
  hipparcos: { names: 'HIP', draft: async (names, { archive }) => (await import('./archives/hipparcos.mts')).draftsFromHipparcos(names, archive) },
  // The stars the IAU has named that the universe lacks, each by the first route that measures it (iau.mts).
  iau: { names: 'all | NAME', draft: async (names, context) => (await import('./archives/iau.mts')).draftsFromIau(names, context) },
  // A nearby A, F or G star whose disc the CHARA Array measured (Boyajian et al. 2012) (chara.mts).
  chara: { names: 'HD', draft: async (names, { archive }) => (await import('./archives/chara.mts')).draftsFromChara(names, archive) },
  // A bright star whose disc the Navy Precision Optical Interferometer measured (Baines et al. 2018, 2021) (npoi.mts).
  npoi: { names: 'HD', draft: async (names, { archive }) => (await import('./archives/npoi.mts')).draftsFromNpoi(names, archive) },
  // A Cepheid Hubble found in another galaxy (Hoffmann et al. 2016), placed by its catalogue row: HOST (N4536) or HOST/ID (sh0es.mts).
  sh0es: { names: 'HOST[/ID]', draft: async (names, { archive }) => (await import('./archives/sh0es.mts')).draftsFromSh0es(names, archive) },
  // A Cepheid in the Andromeda Galaxy: Hubble's V1, or those Hubble measured for its distance (Li et al. 2021) (m31-cepheids.mts).
  m31cepheids: { names: 'all | V1 | ID', draft: async (names, { archive, root }) => (await import('./archives/m31-cepheids.mts')).draftsFromM31Cepheids(names, archive, root) },
  // A Cepheid of the Triangulum Galaxy that Hubble measured for its distance (Breuval et al. 2023) (m33-cepheids.mts).
  m33cepheids: { names: 'all | ID', draft: async (names, { archive, root }) => (await import('./archives/m33-cepheids.mts')).draftsFromM33Cepheids(names, archive, root) },
  // A star of another galaxy from any VizieR table that lists it with a position and a period (tables/table-stars.mts); `telescope stars GALAXY` finds the tables.
  table: { names: 'CLASS:GALAXY=TABLE[#ROW]', draft: async (names, { archive, root }) => (await import('./archives/tables/table-stars.mts')).draftsFromTable(names, archive, root) },
  // A picture ESA publishes for Hubble or Webb, as one more dataset of a page that shows a shaped layer bank (pictures/pictures.mts).
  esa: { names: 'HOST=PAGE_URL', draft: async (names, context) => (await import('./pictures/pictures.mts')).draftsFromEsa(names, context) },
  // A star's corona derived from the magnetic maps its page already shows, with its ROSAT X-ray flux (corona/corona.mts).
  magnetic: { names: 'HOST', draft: async (names, context) => (await import('./corona/corona.mts')).draftsFromMagneticMaps(names, context) },
  // A star's magnetic maps, reduced by this repository from archived polarised spectra, as datasets of its page (magnetic/maps.mts).
  spectra: { names: 'HOST', draft: async (names, context) => (await import('./magnetic/maps.mts')).draftsFromReducedPrograms(names, context) },
  // A star's brightness map, made by this repository from a mission's light curves of it, as a dataset of its page (brightness/brightness.mts).
  pixels: { names: 'all | HOST', draft: async (names, context) => (await import('./brightness/brightness.mts')).draftsFromReducedPixels(names, context) },
};

/** Draft `names` through `route` and write the spec file at `out`. */
export async function writeDrafts(route: string, names: readonly string[], out: string, context: Context) {
  const source = DRAFT_ROUTES[route];
  if (!source) throw new TypeError(`No draft route ${route}; the routes are ${Object.keys(DRAFT_ROUTES).map(key => `--from-${key}`).join(', ')}.`);
  if (!names.length) throw new TypeError(`Usage: new-object --from-${route} ${source.names}... --out spec.json`);
  const { stars, pictures, coronae, magneticMaps, brightnessMaps, report } = await source.draft(names, context), path = resolve(context.root, out);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(brightnessMaps ? { brightnessMaps } : magneticMaps ? { magneticMaps } : coronae ? { coronae } : pictures ? { pictures } : { stars }, null, 2)}\n`);
  return { path, entries: (brightnessMaps ?? magneticMaps ?? coronae ?? pictures ?? stars).length, report };
}
