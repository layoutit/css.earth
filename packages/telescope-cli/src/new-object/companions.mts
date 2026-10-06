/** The other stars of a planet host's system, for the archive draft (from-archive.mts).
 *
 * A wide companion is found in El-Badry, Rix & Heintz (2021)'s catalogue of Gaia EDR3 binaries (VizieR J/MNRAS/506/2269), kept
 * only when the paper's chance-alignment probability R is below 0.1, named by SIMBAD, and given the temperature, radius and mass of
 * the TESS Input Catalog v8.2 (Stassun et al. 2019, VizieR IV/39/tic82). It becomes a placed star at its own Gaia DR3 position, bound
 * to its host (`boundTo`) and so inside the host's system: at these separations the measured positions are the stars' places, so no
 * orbit is involved. A pair too close for Gaia to separate is not in the catalogue and is not added. */
import type { Archive } from './archives/archives.mts';
import { hostId as idFor } from './names/identity.mts';

// VizieR's ASU service, as the color routes use it: its TAP mirror (tapvizier) sends an incomplete certificate chain that Node refuses.
export const VIZIER_ASU = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';
export const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
/** El-Badry et al. (2021) section 3: pairs with R below 0.1 are bound with high confidence. */
export const CHANCE_ALIGNMENT_MAX = 0.1;
const EL_BADRY = { url: 'https://arxiv.org/abs/2101.05282', credit: 'El-Badry, Rix & Heintz (2021), MNRAS 506, 2269' };
export const TIC = { url: 'https://doi.org/10.3847/1538-3881/ab3467', credit: 'Stassun et al. (2019), AJ 158, 138 (TIC v8.2)' };

/** One line's cells. A quoted cell may hold commas and doubled quotes: 1,357 SIMBAD identifiers hold a comma (2026-10-06). */
const cells = (line: string) => {
  const out: string[] = [];
  for (let i = 0; ; i++) {
    if (line[i] === '"') {
      let cell = '';
      for (i++; i < line.length && (line[i] !== '"' || line[i + 1] === '"'); i++) { if (line[i] === '"') i++; cell += line[i]; }
      out.push(cell); i++;
    } else { const end = line.indexOf(',', i); out.push(line.slice(i, end < 0 ? line.length : end)); i = end < 0 ? line.length : end; }
    if (line[i] !== ',') return out;
  }
};
export const csv = (text: string) => { const [header, ...lines] = text.trim().split(/\r?\n/u); const keys = cells(header!); return lines.filter(Boolean).map(line => Object.fromEntries(cells(line).map((cell, i) => [keys[i]!, cell]))); };
export const adql = (query: string) => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: query });
/** An ASU TSV answer's rows: the header is the first line after the comments, the rows follow the dashed separator line (the unit
 * line between them can be blank). */
const tsv = (text: string) => {
  const lines = text.split(/\r?\n/u).filter(line => !line.startsWith('#')), start = lines.findIndex(line => line.trim()), dashes = lines.findIndex(line => /^-+(?:\t-+)*\s*$/u.test(line));
  if (start < 0 || dashes < 0) return [];
  const keys = lines[start]!.split('\t').map(key => key.trim());
  return lines.slice(dashes + 1).filter(line => line.trim()).map(row => Object.fromEntries(row.split('\t').map((cell, i) => [keys[i]!, cell.trim()])));
};
const vizier = (archive: Archive, source: string, constraint: Record<string, string>, out: string) => archive.text(`${VIZIER_ASU}?${new URLSearchParams({ '-source': source, ...constraint, '-out': out })}`).then(tsv);

/** The TESS Input Catalog v8.2 row of Gaia DR3 source `gaia`: its TIC number, temperature, radius and mass with their errors. */
export const ticRow = async (archive: Archive, gaia: string) => (await vizier(archive, 'IV/39/tic82', { GAIA: gaia }, 'TIC,Teff,s_Teff,Rad,s_Rad,Mass,s_Mass'))[0];

/** The bound wide companions of the star with Gaia DR3 `gaia`, as placed-star spec entries of `system`. `held(gaia, name)` names a
 * star the universe already holds; such a companion is noted, not drafted again. */
export async function wideCompanions(archive: Archive, host: { readonly id: string; readonly gaia: string; readonly name: string; readonly system: string }, held: (gaia: string, name: string) => string | undefined): Promise<{ companions: Record<string, unknown>[]; notes: string[] }> {
  const pairs = (await Promise.all(['Source1', 'Source2'].map(column => vizier(archive, 'J/MNRAS/506/2269/catalog', { [column]: host.gaia }, 'Source1,Source2,sepAU,R')))).flat()
    .filter(pair => Number(pair.R) < CHANCE_ALIGNMENT_MAX);
  const companions: Record<string, unknown>[] = [], notes: string[] = [];
  for (const pair of pairs) {
    const gaia = pair.Source1 === host.gaia ? pair.Source2! : pair.Source1!, separation = Math.round(Number(pair.sepAU));
    const [named] = csv(await archive.text(SIMBAD_TAP, adql(`SELECT b.main_id FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = 'Gaia DR3 ${gaia}'`)));
    const name = (named?.main_id ?? `Gaia DR3 ${gaia}`).replace(/^(?:\*+|NAME|V\*)\s+/u, '').replace(/\s+/gu, ' ').trim();
    const already = held(gaia, name);
    if (already) { notes.push(`${name}, the bound companion of ${host.name} ${separation} AU away, is already in the universe as ${already}`); continue; }
    const tic = await ticRow(archive, gaia);
    const value = (key: string) => tic?.[key] ? Number(tic[key]) : undefined;
    if (!tic?.TIC || value('Teff') === undefined || value('Rad') === undefined || value('Mass') === undefined) {
      notes.push(`${name} (Gaia DR3 ${gaia}), the bound companion of ${host.name} ${separation} AU away, has no temperature, radius and mass in TIC v8.2; not added`); continue;
    }
    const cite = (key: string, error: string, label: string) => ({ value: value(key)!, ...(value(error) ? { uncertainty: value(error)! } : {}), source: `${TIC.credit}, ${label} of TIC ${tic.TIC} (VizieR IV/39/tic82)`, url: TIC.url });
    const teff = Math.round(value('Teff')!), au = separation.toLocaleString('en-US');
    const fit = (budget: number, ...drafts: string[]) => drafts.find(draft => draft.length <= budget) ?? drafts.at(-1)!;
    // The bond as the astronomy record carries it (`boundTo`, `sources.binary`): it puts the star inside its host's system.
    const chance = Number(pair.R).toExponential(1).replace(/e([+-])0*(\d)/u, (_, sign: string, digits: string) => `e${sign === '-' ? '-' : ''}${digits}`);
    const bond = `El-Badry, Rix & Heintz (2021, MNRAS 506, 2269) list ${host.name} and ${name} in their Gaia EDR3 wide-binary catalogue (VizieR J/MNRAS/506/2269, source_id ${host.gaia} and ${gaia}), ${au} AU apart on the sky, with a chance-alignment probability of ${chance}: the pair is bound. No orbit of the pair is published, and the Gaia astrometry alone does not constrain one, so the star is placed by its own astrometry and carries no orbit.`;
    companions.push({ id: idFor({ hostname: name, gaiaDr3: `Gaia DR3 ${gaia}` }), name, system: host.system, gaia, boundTo: { host: host.id, source: bond },
      description: `Star bound to ${host.name}, ${au} AU away.`, paper: EL_BADRY,
      radius: cite('Rad', 's_Rad', 'the radius'), temperature: cite('Teff', 's_Teff', 'the effective temperature'), mass: cite('Mass', 's_Mass', 'the mass'),
      text: { card: fit(110, `${name} is a star of ${teff.toLocaleString('en-US')} K, bound to ${host.name} ${au} AU away.`, `A star of ${teff.toLocaleString('en-US')} K, bound to ${host.name}.`),
        introduction: fit(180, `${name} shares its motion through space with ${host.name}, ${au} AU away, so the two are a bound pair. Both are placed where Gaia measures them.`, `${name} moves through space with ${host.name}, ${au} AU away: a bound pair, both placed where Gaia measures them.`),
        locator: `J/MNRAS/506/2269 catalog: source_id ${host.gaia} and ${gaia}, sep_AU ${pair.sepAU}, R_chance_align ${pair.R}` },
      notes: [`${name}'s orbit around ${host.name} is not measured; both stars are placed at their Gaia DR3 positions, which is where they are`] });
  }
  return { companions, notes };
}
