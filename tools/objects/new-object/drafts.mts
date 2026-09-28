/** Draft specs from an archive or a catalogue, one route per source: `new-object --from-<route> NAME... --out spec.json`. Each route
 * reads its source for the names given and returns the spec entries and a line per name; the spec is written in one place. A draft
 * names what its source lacks, and the spec parser refuses it until a person has cited the rest. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Archive } from './archives.mts';

export interface Drafts { readonly stars: readonly unknown[]; readonly report: readonly string[] }
interface Context { readonly root: string; readonly progress: (line: string) => void; readonly archive: Archive }
export const DRAFT_ROUTES: Readonly<Record<string, { readonly names: string; readonly draft: (names: readonly string[], context: Context) => Promise<Drafts> }>> = {
  // Transiting planet hosts from the NASA Exoplanet Archive's default parameter sets (from-archive.mts).
  archive: { names: 'HOST', draft: async (names, { root, progress }) => (await import('./generate.mts')).draftsFromArchive(names, { root, progress }) },
  // Both stars of an eclipsing binary from DEBCat (debcat.mts).
  debcat: { names: 'SYSTEM', draft: async (names, { archive }) => (await import('./debcat.mts')).draftsFromDebcat(names, archive) },
  // A Kepler-field giant weighed by its oscillations, from APOKASC-3 (apokasc.mts).
  apokasc: { names: 'KIC', draft: async (names, { archive }) => (await import('./apokasc.mts')).draftsFromApokasc(names, archive) },
  // A Cepheid's Baade-Wesselink radius and distance from Groenewegen (2013) (cepheids.mts).
  cepheids: { names: 'NAME', draft: async (names, { archive }) => (await import('./cepheids.mts')).draftsFromCepheids(names, archive) },
  // A K2-field giant, far above or below the Galactic plane, weighed by its oscillations, from Khan et al. (2023) (k2.mts).
  k2: { names: 'EPIC', draft: async (names, { archive }) => (await import('./k2.mts')).draftsFromK2(names, archive) },
  // A giant near the ecliptic poles, from the same paper's TESS + APOGEE table (k2.mts).
  tess: { names: 'TIC', draft: async (names, { archive }) => (await import('./k2.mts')).draftsFromTess(names, archive) },
};

/** Draft `names` through `route` and write the spec file at `out`. */
export async function writeDrafts(route: string, names: readonly string[], out: string, context: Context) {
  const source = DRAFT_ROUTES[route];
  if (!source) throw new TypeError(`No draft route ${route}; the routes are ${Object.keys(DRAFT_ROUTES).map(key => `--from-${key}`).join(', ')}.`);
  if (!names.length) throw new TypeError(`Usage: new-object --from-${route} ${source.names}... --out spec.json`);
  const { stars, report } = await source.draft(names, context), path = resolve(context.root, out);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify({ stars }, null, 2)}\n`);
  return { path, entries: stars.length, report };
}
