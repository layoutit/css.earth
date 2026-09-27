/** A draft spec for a Cepheid from Groenewegen (2013, A&A 550, A70; arXiv:1212.5478): the mean radius and the distance of a
 * Baade-Wesselink analysis, which compares how fast the pulsating surface moves with how its angular size changes, for 128 Galactic,
 * 36 LMC and 6 SMC Cepheids (VizieR J/A+A/550/A70, table10). Its uncertainties are the paper's Monte-Carlo ones.
 *
 * The paper gives no temperature or mass: the draft leaves them out and names them, and the spec parser refuses it until a person
 * cites them. Its colour is the Planck spectrum at that temperature, because the paper's E(B-V) reddens every spectrum of the star
 * and its light changes through the pulsation. */
import { VIZIER_ASU, type Archive } from './archives.mts';

export const CEPHEIDS = { source: 'J/A+A/550/A70/table10', paper: 'https://arxiv.org/abs/1212.5478', credit: 'Groenewegen (2013), A&A 550, A70' };
const WHERE: Readonly<Record<string, string>> = { G: 'the Milky Way', L: 'the Large Magellanic Cloud', S: 'the Small Magellanic Cloud' };
const COLUMNS = ['Loc', 'Name', 'E(B-V)', 'e_E(B-V)', 'Per', 'Dist', 'e.D', 'Rad', 'e.R'] as const;

export function parseCepheidRow(tsv: string, name: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  const rows = lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row[header.indexOf('Name')]!.toLowerCase() === name.trim().toLowerCase());
  if (rows.length !== 1) throw new Error(`Groenewegen (2013) table10 has ${rows.length} rows for ${name}, not one; its names are as the paper writes them (HV 1005, DEL CEP).`);
  const cell = (column: typeof COLUMNS[number]) => rows[0]![header.indexOf(column)] ?? '';
  const value = (column: typeof COLUMNS[number]) => { const number = Number(cell(column)); if (!cell(column) || !Number.isFinite(number)) throw new Error(`Groenewegen (2013) ${name}: ${column} is empty.`); return number; };
  return { name: cell('Name'), where: WHERE[cell('Loc')] ?? 'the Milky Way', reddening: [value('E(B-V)'), value('e_E(B-V)')] as const, periodDays: value('Per'),
    distance: [value('Dist'), value('e.D')] as const, radius: [value('Rad'), value('e.R')] as const };
}

export function draftFromCepheid(row: ReturnType<typeof parseCepheidRow>) {
  const cite = ([value, uncertainty]: readonly [number, number], what: string) => ({ value, uncertainty, source: `${CEPHEIDS.credit}, table10, ${row.name}: ${what} ${value} +/- ${uncertainty} (Monte-Carlo)`, url: CEPHEIDS.paper });
  const id = row.name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
  return {
    spec: {
      id, name: row.name, system: `${row.name} system`, target: row.name, paper: { url: CEPHEIDS.paper, credit: CEPHEIDS.credit },
      description: `A Cepheid in ${row.where} that pulsates every ${row.periodDays.toFixed(2)} days; its mean radius is ${row.radius[0]} solar radii.`,
      radius: cite(row.radius, 'Baade-Wesselink mean radius (solar radii)'), distance: cite(row.distance, 'Baade-Wesselink distance (pc)'),
      color: { skip: ['stis-ngsl', 'gaia-xp', 'pulkovo', 'kiehling', 'kharitonov', 'burnashev'],
        reason: `Interstellar dust reddens every spectrum of this star, E(B-V) = ${row.reddening[0]} +/- ${row.reddening[1]} (${CEPHEIDS.credit}, table10), and its light changes through each pulsation` },
      planets: [], companions: [],
      notes: ['The star pulsates; it is drawn at its mean radius.'],
    },
    missing: ['temperature (a mean effective temperature, cited)', 'mass (cited, or "gaia-flame")'],
  };
}

/** `new-object --from-cepheids NAME... --out spec.json`. */
export async function draftsFromCepheids(names: readonly string[], archive: Archive) {
  const tsv = await archive.text(VIZIER_ASU, { '-source': CEPHEIDS.source, '-out': COLUMNS.join(','), '-out.max': '500' }), stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const name of names) {
    const { spec, missing } = draftFromCepheid(parseCepheidRow(tsv, name));
    stars.push(spec);
    report.push(`${spec.name}: add ${missing.join(' and ')}; radius and distance are ${CEPHEIDS.credit}'s.`);
  }
  return { stars, report };
}
