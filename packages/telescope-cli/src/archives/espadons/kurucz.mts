/** Atomic lines with their effective Landé factors, from Kurucz's `gfall` list.
 *
 * kurucz.harvard.edu/linelists.html gives the 160-column record: wavelength in nm (in air above 200 nm), log gf, the
 * element number plus charge/100, each of the two levels with its energy in cm⁻¹, its J and its label, and at the end the
 * Landé g of the even level and of the odd level, each times 1000. Three things are done to it here:
 *
 * - Fields 17 and 19, the log share of a hyperfine component and of an isotope, are added to log gf, and the components of
 *   one transition are joined into one line at their strength-weighted wavelength. Unjoined, manganese, vanadium and cobalt
 *   count many times over.
 * - The list does not say which of a line's two levels is the even one. For each ion that is decided by its own lines: the
 *   g that LS coupling gives each level from the term in its label is compared with the two tabulated values both ways
 *   round, and the way that agrees for most of the ion's lines is used for all of them. An ion whose lines cannot decide is
 *   left out.
 * - The effective Landé factor of a line is g_eff = (g1 + g2)/2 + (g1 - g2) [J1(J1+1) - J2(J2+1)] / 4.
 *
 * The three damping constants of a record (columns 81 to 98: the logarithms of the radiative, Stark and van der Waals
 * widths, 0 where Kurucz gives none) are carried unchanged for the code that computes line depths (mask.mts). */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export interface AtomicLine { /** Wavelength in air, nm. */ readonly nm: number; readonly logGf: number; readonly element: number; /** 0 neutral, 1 singly ionised, and so on. */ readonly charge: number;
  /** Energy of the lower level, cm⁻¹. */ readonly lowerCm: number; readonly lande: number;
  /** Kurucz's log damping constants: radiative, Stark and van der Waals; 0 where the list has none. */ readonly damping: readonly [number, number, number] }
interface Entry { nm: number; logGf: number; damping: [number, number, number]; code: number; e1: number; j1: number; label1: string; e2: number; j2: number; label2: string; gEven: number; gOdd: number }

const L_OF: Readonly<Record<string, number>> = { S: 0, P: 1, D: 2, F: 3, G: 4, H: 5, I: 6, K: 7, L: 8, M: 9, N: 10 };
/** The Landé g of LS coupling for a level, from the term at the end of its label ("a 5D", "(4F)4p y5D"). */
export function lsLande(label: string, J: number): number | undefined { const term = /(\d)([SPDFGHIKLMN])\*?\s*$/u.exec(label.trim()); if (!term || J === 0) return undefined;
  const S = (Number(term[1]) - 1) / 2, L = L_OF[term[2]!]!; return 1 + (J * (J + 1) + S * (S + 1) - L * (L + 1)) / (2 * J * (J + 1)); }
export const effectiveLande = (g1: number, J1: number, g2: number, J2: number) => 0.5 * (g1 + g2) + 0.25 * (g1 - g2) * (J1 * (J1 + 1) - J2 * (J2 + 1));

/** One record of the list, or undefined for a record outside the span or without Landé factors. */
export function parseEntry(record: string, fromNm: number, toNm: number): Entry | undefined {
  const nm = Number(record.slice(0, 11)); if (!(nm >= fromNm && nm <= toNm)) return undefined;
  const even = record.slice(144, 149), odd = record.slice(149, 154); if (!even.trim() || !odd.trim()) return undefined;
  const share = (Number(record.slice(109, 115)) || 0) + (Number(record.slice(118, 124)) || 0);
  const entry = { nm, logGf: Number(record.slice(11, 18)) + share, damping: [Number(record.slice(80, 86)) || 0, Number(record.slice(86, 92)) || 0, Number(record.slice(92, 98)) || 0] as [number, number, number], code: Number(record.slice(18, 24)), e1: Number(record.slice(24, 36)), j1: Number(record.slice(36, 41)), label1: record.slice(42, 52), e2: Number(record.slice(52, 64)), j2: Number(record.slice(64, 69)), label2: record.slice(70, 80), gEven: Number(even) / 1000, gOdd: Number(odd) / 1000 };
  return [entry.logGf, entry.code, entry.e1, entry.j1, entry.e2, entry.j2, entry.gEven, entry.gOdd].every(Number.isFinite) ? entry : undefined;
}

/** The lines of a set of records between two wavelengths, hyperfine and isotopic components joined, each with its effective Landé factor. */
export function atomicLines(records: Iterable<string>, fromNm: number, toNm: number): { readonly lines: AtomicLine[]; readonly entries: number; readonly undecided: readonly number[] } {
  const transitions: Entry[] = [], open = new Map<string, Entry>(), votes = new Map<number, [number, number]>(); let entries = 0;
  for (const record of records) { const entry = parseEntry(record, fromNm, toNm); if (!entry) continue; entries++;
    const ls1 = lsLande(entry.label1, entry.j1), ls2 = lsLande(entry.label2, entry.j2);
    if (ls1 !== undefined && ls2 !== undefined && Math.abs(entry.gEven - entry.gOdd) >= 0.05) { const firstEven = Math.abs(ls1 - entry.gEven) + Math.abs(ls2 - entry.gOdd), firstOdd = Math.abs(ls1 - entry.gOdd) + Math.abs(ls2 - entry.gEven);
      if (Math.abs(firstEven - firstOdd) > 0.05) { const vote = votes.get(entry.code) ?? [0, 0]; vote[firstEven < firstOdd ? 0 : 1]++; votes.set(entry.code, vote); } }
    const key = `${entry.code}|${Math.round(Math.abs(entry.e1))}|${Math.round(Math.abs(entry.e2))}|${entry.j1}|${entry.j2}`, held = open.get(key);
    if (held && Math.abs(held.nm - entry.nm) < 0.1) { const a = 10 ** held.logGf, b = 10 ** entry.logGf; held.nm = (held.nm * a + entry.nm * b) / (a + b); held.logGf = Math.log10(a + b); }
    else { transitions.push(entry); open.set(key, entry); } }
  const undecided = new Set<number>(), lines: AtomicLine[] = [];
  for (const entry of transitions) { const vote = votes.get(entry.code); if (!vote || vote[0] === vote[1]) { undecided.add(entry.code); continue; }
    const [g1, g2] = vote[0] > vote[1] ? [entry.gEven, entry.gOdd] : [entry.gOdd, entry.gEven];
    lines.push({ nm: Number(entry.nm.toFixed(4)), logGf: Number(entry.logGf.toFixed(3)), element: Math.floor(entry.code + 1e-6), charge: Math.round((entry.code % 1) * 100), lowerCm: Math.min(Math.abs(entry.e1), Math.abs(entry.e2)), lande: Number(effectiveLande(g1, entry.j1, g2, entry.j2).toFixed(4)), damping: entry.damping }); }
  return { lines, entries, undecided: [...undecided].sort((a, b) => a - b) };
}

/** The same, from the list on disk. */
export async function readAtomicLines(path: string, fromNm: number, toNm: number) {
  const records: string[] = [];
  for await (const record of createInterface({ input: createReadStream(path, 'latin1') })) { const nm = Number(record.slice(0, 11)); if (nm >= fromNm && nm <= toNm) records.push(record); }
  return atomicLines(records, fromNm, toNm);
}
