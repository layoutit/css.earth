/** The name a star is shown by, chosen from the designations SIMBAD lists for it, in one order of preference:
 *
 * 1. a proper name (SIMBAD `NAME Betelgeuse`);
 * 2. a Bayer or Flamsteed designation (`* alf Ori`, `* 55 Cnc`), spelled out as a reader meets it (Alpha Orionis, 55 Cancri);
 * 3. a variable-star designation (`V* RR Lyr`, `HV 2827`, `VHK 45`: the Harvard variables, and van den Bergh, Herbst & Kowal's
 *    1975 variables of M33);
 * 4. a catalogue number that reads as a name: HD, HIP, GJ, then the surveys in `SURVEYS`, in that order;
 * 5. nothing: a designation that is only a position or a source number (2MASS J…, Gaia DR3 …, M31V J…) is kept as the star's name
 *    only when nothing above exists, and the caller keeps what it had.
 *
 * The designations not chosen stay the star's aliases, so search finds each. Nothing here writes a name SIMBAD does not list:
 * steps 1 to 3 drop SIMBAD's own prefix and spell out the constellation, step 4 returns the identifier as SIMBAD writes it. */
import type { Archive } from './archives.mts';
import { adql, csv, SIMBAD_TAP } from './companions.mts';
import { spelledOut } from './prose.mts';

/** Catalogues before surveys; among surveys, those that name stars a reader has met (planet hosts) before the wide photometric ones. */
const CATALOGUES = ['HD', 'HIP', 'GJ'] as const;
const SURVEYS = ['WASP', 'Kepler', 'K2', 'TOI', 'HAT-P', 'HATS', 'KELT', 'TrES', 'XO', 'CoRoT', 'OGLE', 'DIRECT', 'TYC', 'BD', 'CD', 'CPD'] as const;
const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();
const starts = (identifier: string, prefix: string) => identifier.startsWith(`${prefix} `) || identifier.startsWith(`${prefix}-`) || identifier.startsWith(`${prefix}+`);

export type NameStep = 'proper' | 'bayer-flamsteed' | 'variable' | 'catalogue';
export function preferredName(identifiers: readonly string[]): { readonly name: string; readonly step: NameStep; readonly identifier: string } | undefined {
  const ids = identifiers.map(collapse), found = (test: (id: string) => boolean) => ids.find(test);
  const proper = found(id => id.startsWith('NAME '));
  if (proper) return { name: proper.slice(5), step: 'proper', identifier: proper };
  const bayer = found(id => id.startsWith('* '));
  if (bayer) return { name: spelledOut(bayer.slice(2)), step: 'bayer-flamsteed', identifier: bayer };
  const variable = found(id => id.startsWith('V* ')) ?? found(id => /^(?:HV|VHK) \d+$/u.test(id));
  if (variable) return { name: variable.startsWith('V* ') ? spelledOut(variable.slice(3)) : variable, step: 'variable', identifier: variable };
  for (const prefix of [...CATALOGUES, ...SURVEYS]) {
    const identifier = found(id => starts(id, prefix));
    if (identifier) return { name: identifier, step: 'catalogue', identifier };
  }
  return undefined;
}

/** Every designation SIMBAD lists for the star it knows as `target`; none when SIMBAD does not know it. */
export async function simbadIdentifiers(archive: Archive, target: string): Promise<string[]> {
  const rows = csv(await archive.text(SIMBAD_TAP, adql(`SELECT a.id FROM ident AS n JOIN ident AS a ON n.oidref = a.oidref WHERE n.id = '${target.replaceAll("'", "''")}'`)));
  return rows.map(row => collapse(String(row.id ?? '').replace(/^"|"$/gu, ''))).filter(Boolean);
}
