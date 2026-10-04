/** Draft the stars the IAU has named (iau-names.mts) that the universe does not hold yet: `new-object --from-iau all | NAME...`.
 *
 * Each name is found in SIMBAD by the WGSN's designation (else its Hipparcos number, else the name SIMBAD spells) and drafted by the
 * first route whose source measures it, papers and their archives first:
 * 1. a planet host the NASA Exoplanet Archive lists, with the planets it measures (from-archive.mts);
 * 2. Gaia DR3 FLAME, when the archive's flags vouch for it (gaia.mts);
 * 3. McDonald, Zijlstra & Watson (2017), inside the paper's well-fit subset (hipparcos.mts).
 * A star already placed (within DUPLICATE_ARCSEC of SIMBAD's position, or by the same Gaia DR3 source) is not drafted: the report
 * names its id, for `--rename`. A name another body already carries (Saturn's moon Atlas) and a name no route measures are
 * reported with the reason; nothing is drafted for them.
 *
 * Every drafted star is shown by its IAU name and is a map target; its other designations are its aliases. A star without planets
 * takes its name's slug as its id; a planet host keeps its designation's id, which its planets' ids are made from. */
import { GAIA_TAP, type Archive } from './archives.mts';
import { adql, csv, SIMBAD_TAP } from '../companions.mts';
import { preferredName } from '../display-name.mts';
import { draftFromGaia, gaiaDraftQuery, parseGaiaDraftRow } from './gaia.mts';
import { draftsFromHipparcos, starQuotes } from './hipparcos.mts';
import { readIauNames, type IauName } from './iau-names.mts';
import { duplicateName, duplicateStar, existingBodies, slug } from '../identity.mts';
import { spelledOut } from '../prose.mts';
import { renamed } from '../rename.mts';

const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const CONCURRENCY = 4;
type Spec = Record<string, any>;

/** The SIMBAD object a WGSN row names: its J2000 position and every designation. */
async function simbadObject(archive: Archive, row: IauName) {
  const keys = [row.designation !== '-' && row.designation, row.hip && `HIP ${row.hip}`, row.simbad && `NAME ${row.simbad}`].filter((key): key is string => !!key);
  for (const key of keys) {
    const rows = csv(await archive.text(SIMBAD_TAP, adql(`SELECT b.ra, b.dec, a.id FROM ident AS n JOIN basic AS b ON b.oid = n.oidref JOIN ident AS a ON a.oidref = n.oidref WHERE n.id = '${key.replaceAll("'", "''")}'`)));
    if (rows.length) return { key, ra: Number(rows[0]!.ra), dec: Number(rows[0]!.dec), identifiers: rows.map(r => String(r.id ?? '').replace(/^"|"$/gu, '').replace(/\s+/gu, ' ').trim()).filter(Boolean) };
  }
  return undefined;
}

/** A designation as a reader meets it: SIMBAD's Bayer and Flamsteed forms spelled out (`* tet01 Eri` is Theta1 Eridani). */
const readable = (designation: string) => designation.startsWith('* ') ? spelledOut(designation.slice(2).trim().replace(/^([a-z]+)\./u, '$1').replace(/^([a-z]+)0(\d) /u, '$1$2 ')) : designation;

/** A drafted star under its IAU name: the name, system and drafted text take it (planet and companion designations stay), and the
 * old name and the star's SIMBAD designations the WGSN and the catalogues give (Bayer or Flamsteed spelled out, HD, HIP) become
 * aliases. It is a map target. */
export function named(spec: Spec, row: IauName, id: string | undefined, identifiers: readonly string[]): Spec {
  const old = String(spec.name), out: Spec = JSON.parse(JSON.stringify(spec));
  if (old !== row.name) {
    renamed(out, old, row.name, true);
    for (const entry of [...out.planets ?? [], ...out.companions ?? []]) renamed(entry, old, row.name, true);
  }
  const bayer = preferredName(identifiers.filter(i => !i.startsWith('NAME')))?.name, catalogue = identifiers.filter(i => /^(?:HD|HIP) \d+$/u.test(i));
  const designation = identifiers.includes(row.designation) ? [readable(row.designation)] : [];
  out.name = row.name; out.system = `${row.name} system`;
  out.aliases = [...new Set([...(out.aliases ?? []).map(String).map(readable), old, ...designation, ...bayer ? [bayer] : [], ...catalogue])].filter(alias => alias !== row.name);
  out.featured = true;
  if (id) out.id = id;
  return out;
}

export async function draftsFromIau(names: readonly string[], { root, archive, progress }: { readonly root: string; readonly archive: Archive; readonly progress: (line: string) => void }) {
  const { rows } = await readIauNames(), wanted = names.includes('all') ? rows : rows.filter(row => names.includes(row.name));
  const unknown = names.filter(name => name !== 'all' && !rows.some(row => row.name === name));
  if (unknown.length) throw new Error(`Not in the IAU Catalog of Star Names (src/references/iau-star-names): ${unknown.join(', ')}.`);
  const universe = await existingBodies(root), ids = new Set(universe.ids), taken = (id: string) => ids.has(id);
  // The archive's hosts, by name and by Gaia DR3 source: SIMBAD may not list the archive's name (TrES-3 is "NAME TrES-3 Parent Star").
  const hosts = new Map<string, string>();
  for (const r of csv(await archive.text(NASA_TAP, { query: 'select distinct hostname, gaia_dr3_id from pscomppars', format: 'csv' }))) {
    const hostname = String(r.hostname ?? '').replace(/\s+/gu, ' ').trim(), gaiaId = String(r.gaia_dr3_id ?? '').replace(/\s+/gu, ' ').trim();
    if (hostname) { hosts.set(hostname, hostname); if (gaiaId) hosts.set(gaiaId, hostname); }
  }
  const results: { stars: Spec[]; line: string }[] = [];
  let next = 0;
  const draft = async (row: IauName): Promise<{ stars: Spec[]; line: string }> => {
    const found = await simbadObject(archive, row);
    if (!found) return { stars: [], line: `${row.name}: left out, SIMBAD knows none of ${[row.designation, row.hip && `HIP ${row.hip}`, row.simbad].filter(Boolean).join(', ')}.` };
    const gaia = found.identifiers.find(id => /^Gaia DR3 \d+$/u.test(id))?.slice(9);
    const placed = (gaia && universe.gaia?.get(gaia)) ?? duplicateStar(universe, { ra: found.ra, dec: found.dec, epoch: 2000 });
    if (placed) return { stars: [], line: `${row.name}: already in the universe as ${placed}; name it with --rename ${placed}.` };
    // The universe holds one body per name (generate.mts refuses a second): Saturn's moon Atlas is not the Pleiad Atlas.
    const namesake = duplicateName(universe, row.name);
    if (namesake) return { stars: [], line: `${row.name}: left out; another body, ${namesake}, already carries the name.` };
    const reasons: string[] = [];
    const host = found.identifiers.map(id => hosts.get(id)).find((name): name is string => !!name);
    if (host) {
      const { draftsFromArchive } = await import('../generate.mts'), drafted = await draftsFromArchive([host], { root, progress });
      const star = (drafted.stars as Spec[]).find(spec => !('host' in spec) && (spec.planets?.length ?? 0) > 0);
      if (star) return { stars: [named(star, row, undefined, found.identifiers), ...(drafted.stars as Spec[]).filter(spec => spec !== star)], line: `${row.name}: ${host}, from the NASA Exoplanet Archive (${drafted.report.join('; ')}).` };
      reasons.push(`the NASA Exoplanet Archive drafts no planet of ${host} (${drafted.report.join('; ')})`);
    }
    const id = [row.name, ...found.identifiers.filter(i => /^HD \d+$/u.test(i))].map(slug).find(candidate => /^[a-z]/u.test(candidate) && !taken(candidate));
    if (gaia) {
      try {
        const spec = draftFromGaia(parseGaiaDraftRow(await archive.text(GAIA_TAP, { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: gaiaDraftQuery(gaia) }), gaia));
        // SIMBAD's name for the README: the WGSN designation, else the HD or HIP number, else the key that found it.
        const target = [row.designation, ...found.identifiers.filter(i => /^(?:HD|HIP) \d+$/u.test(i))].find(i => found.identifiers.includes(i)) ?? found.key;
        const quotes = await starQuotes(archive, found.identifiers, row.name, [row.designation]);
        return { stars: [named({ ...spec, target, text: { ...spec.text, ...quotes ? { quotes } : {} } }, row, id, found.identifiers)], line: `${row.name}: Gaia DR3 ${gaia}, from FLAME${quotes ? `; quotes ${quotes.title}` : '; no Wikipedia quotes'}.` };
      } catch (error) { reasons.push((error as Error).message); }
    } else reasons.push('SIMBAD links no Gaia DR3 source');
    const hip = row.hip || found.identifiers.find(i => /^HIP \d+$/u.test(i))?.slice(4);
    if (hip) {
      try {
        const drafted = await draftsFromHipparcos([hip], archive, taken), star = drafted.stars[0] as Spec;
        // A Hipparcos number two named components share (ε Boötis A and B) names the pair's SIMBAD object, not this component.
        if (star.name !== row.name) throw new Error(`HIP ${hip} is ${star.name} in SIMBAD and the IAU catalogue, not ${row.name}`);
        return { stars: [named(star, row, undefined, found.identifiers)], line: `${row.name}: ${drafted.report.join(' ')}` };
      } catch (error) { reasons.push((error as Error).message); }
    } else reasons.push('no Hipparcos number for McDonald et al. (2017)');
    return { stars: [], line: `${row.name}: left out; ${reasons.join('; ')}.` };
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, async () => {
    for (let i = next++; i < wanted.length; i = next++) {
      const row = wanted[i]!;
      try { results[i] = await draft(row); } catch (error) { results[i] = { stars: [], line: `${row.name}: left out; ${(error as Error).message.split('\n')[0]}` }; }
      for (const star of results[i]!.stars) if (typeof star.id === 'string') ids.add(star.id);
      progress(results[i]!.line);
    }
  }));
  return { stars: results.flatMap(result => result.stars), report: results.map(result => result.line) };
}
