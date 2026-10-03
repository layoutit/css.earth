/** A draft spec for a nearby main-sequence A, F or G star whose disc the CHARA Array resolved (Boyajian et al. 2012, ApJ 746, 101;
 * doi:10.1088/0004-637X/746/1/101): the radius from the limb-darkened angular diameter and the Hipparcos parallax, the effective temperature from that
 * diameter and the bolometric flux, and the mass the paper reads from Yonsei-Yale isochrones at that radius and temperature. One
 * VizieR request per star (J/ApJ/746/101, targets), read by HD number.
 *
 * The star is placed at the Hipparcos parallax the paper computed its radius with (van Leeuwen 2007, the table's Plx), so the radius
 * and the distance agree, and a star too bright for a Gaia parallax still has a place.
 *
 * The radius and temperature are measured; the mass is a model's. The draft says so in the mass's citation. A row with no mass (the
 * paper fits no isochrone to it) is drafted "unmeasured": GM stays the records' unpublished 0 and no limb law is chosen.
 *
 * The star is shown by the name SIMBAD prefers for it (display-name.mts); one with a proper name is a map target. */
import { VIZIER_ASU, type Archive } from './archives.mts';
import { preferredName, simbadIdentifiers } from './display-name.mts';

export const CHARA = { source: 'J/ApJ/746/101/targets', paper: 'https://doi.org/10.1088/0004-637X/746/1/101', credit: 'Boyajian et al. (2012), ApJ 746, 101' };
const COLUMNS = ['HD', 'SpT', 'Plx', 'e_Plx', 'D(LD)', 'e_D(LD)', 'R', 'e_R', 'Teff', 'e_Teff', 'M', 'e_M'] as const;

/** The table row of one HD number, as VizieR serves it. */
export function parseCharaRow(tsv: string, hd: string) {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#') && !/^[-\t ]+$/u.test(line));
  const header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [], rows = lines.slice(2).map(line => line.split('\t').map(cell => cell.trim())).filter(row => row[header.indexOf('HD')] === hd);
  if (rows.length !== 1) throw new Error(`${CHARA.credit} has ${rows.length} rows for HD ${hd}, not one.`);
  const cell = (name: typeof COLUMNS[number]) => rows[0]![header.indexOf(name)] ?? '';
  const pair = (name: 'Plx' | 'D(LD)' | 'R' | 'Teff' | 'M') => { const value = Number(cell(name)), error = Number(cell(`e_${name}`)); if (!cell(name) || !Number.isFinite(value) || !Number.isFinite(error)) throw new Error(`${CHARA.credit}, HD ${hd}: ${name} is empty.`); return [value, error] as const; };
  return { hd, spectralType: cell('SpT'), parallax: pair('Plx'), diameter: pair('D(LD)'), radius: pair('R'), teff: pair('Teff'), mass: cell('M') ? pair('M') : undefined };
}

export function draftFromChara(row: ReturnType<typeof parseCharaRow>, identifiers: readonly string[]) {
  const preferred = preferredName(identifiers), name = preferred?.name ?? `HD ${row.hd}`, hd = `HD ${row.hd}`;
  const cite = ([value, uncertainty]: readonly [number, number], what: string) => ({ value, uncertainty, source: `${CHARA.credit}, ${hd}: ${what}, ${value} +/- ${uncertainty}`, url: CHARA.paper });
  const radius = cite(row.radius, `radius in solar radii, from the limb-darkened angular diameter ${row.diameter[0]} +/- ${row.diameter[1]} mas (CHARA) and the Hipparcos parallax`);
  const mass = row.mass ? cite(row.mass, 'mass in solar masses, from Yonsei-Yale isochrones at the measured radius and temperature (a model value)') : 'unmeasured';
  const parsecs = 1000 / row.parallax[0], wider = radius.value >= 1.05 ? `${radius.value.toFixed(1)} times the Sun's width` : radius.value <= 0.95 ? `${Math.round(radius.value * 100)}% of the Sun's width` : `the Sun's width`;
  return {
    // An id starts with a letter: a star named by its Flamsteed number (18 Scorpii) takes its HD number as its id.
    id: (/^\d/u.test(name) ? hd : name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''), name, system: `${name} system`, parent: 'milky-way', target: hd,
    ...(name === hd ? {} : { aliases: [hd] }), ...(preferred?.step === 'proper' ? { featured: true } : {}),
    description: `A naked-eye star ${parsecs.toFixed(1)} parsecs away, ${wider}: its disc was measured with the CHARA Array.`,
    paper: { url: CHARA.paper, credit: CHARA.credit },
    // The star sits at the parallax its radius was computed with, and a star too bright for a Gaia parallax still has a place.
    distance: { value: Number(parsecs.toFixed(3)), uncertainty: Number((parsecs * row.parallax[1] / row.parallax[0]).toFixed(3)),
      source: `${CHARA.credit}, ${hd}: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), ${row.parallax[0]} +/- ${row.parallax[1]} mas, inverted`, url: CHARA.paper },
    radius, mass, temperature: cite(row.teff, 'effective temperature in K, from the angular diameter and the bolometric flux'),
    // The reader text is the table row in words, cited to it; nothing the row does not hold.
    text: { card: `A naked-eye star ${parsecs.toFixed(0)} parsecs away whose disc the CHARA Array measured: ${wider}.`,
      introduction: `Its disc spans ${row.diameter[0]} milliarcseconds, which gives ${radius.value} solar radii and ${row.teff[0].toLocaleString('en-US')} K at its surface.`,
      locator: `Tables 5 and 10, ${hd}: limb-darkened diameter, R, Teff` },
    planets: [], companions: [],
  };
}

/** `new-object --from-chara HD... --out spec.json`. */
export async function draftsFromChara(names: readonly string[], archive: Archive) {
  const stars: Record<string, unknown>[] = [], report: string[] = [];
  for (const hd of names.map(value => value.replace(/^HD\s*/iu, '').trim())) {
    if (!/^\d{1,6}$/u.test(hd)) throw new Error(`${CHARA.credit} is read by HD number, not ${hd}.`);
    const tsv = await archive.text(VIZIER_ASU, { '-source': CHARA.source, HD: `=${hd}`, '-out': COLUMNS.join(','), '-out.max': '5' });
    const row = parseCharaRow(tsv, hd), star = draftFromChara(row, await simbadIdentifiers(archive, `HD ${hd}`));
    stars.push(star);
    report.push(`HD ${hd}: drafted as ${star.name} from ${CHARA.credit}${row.mass ? '' : '; the paper gives no mass, so none is recorded'}.`);
  }
  return { stars, report };
}
