/** A line mask for one star: which atomic lines its spectrum shows, how deep each is, and how strongly each answers to a
 * magnetic field.
 *
 * Positions, oscillator strengths, levels, damping constants and Landé factors are Kurucz's (kurucz.mts). Each line's
 * depth is the central depth Korg computes for it alone in a MARCS model atmosphere of the star's catalogued temperature,
 * gravity and metallicity (korg/depths.jl; toolchain.json pins the code). That is how masks for this method have been made
 * since Donati et al. (1997, MNRAS 291, 658), who took the depths from Kurucz's model atmospheres. Nothing is fitted to
 * the star's own spectrum.
 *
 * The candidate lines (the list between the spectrograph's limits, neutral and singly ionised atoms heavier than helium
 * with a Landé factor) and each atmosphere's depths are kept under output/espadons/depths, so that a star observed in
 * several runs, or two stars of the same parameters, are computed once. A new atmosphere takes about two minutes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import type { AtomicLine } from './kurucz.mts';
import { lineDataPin, loadAtomicLines } from './line-data.mts';
import type { Atmosphere } from './program.mts';
import { runJulia, toolchainPaths } from './toolchain.mts';

export const C_KMS = 299792.458, EV_PER_CM = 1.239841984e-4;
/** The wavelengths ESPaDOnS records, nm. */
export const SPAN_NM = [370, 1050] as const;
/** The shallowest line a mask keeps: SpecpolFlow's own tutorials cut at a tenth of the continuum. */
export const MINIMUM_DEPTH = 0.1;
const KEPT = resolve(WORKSPACE, 'output/espadons/depths');
export interface MaskLine { /** Wavelength in air at rest, nm. */ readonly restNm: number; /** The line's own central depth, before rotation and the instrument spread it. */ readonly depth: number; readonly lande: number; readonly element: number; readonly charge: number }
export type Candidate = Pick<AtomicLine, 'nm' | 'logGf' | 'element' | 'charge' | 'lowerCm' | 'lande' | 'damping'>;

/** The lines a mask can hold, in order of wavelength. */
export const candidates = (lines: readonly AtomicLine[]): Candidate[] => lines.filter(line => line.charge <= 1 && line.element > 2 && Number.isFinite(line.lande) && line.logGf > -7).sort((a, b) => a.nm - b.nm);
const species = (line: Pick<Candidate, 'element' | 'charge'>) => `${line.element}.${String(line.charge).padStart(2, '0')}`;
/** The candidates as korg/depths.jl reads them, with the Landé factor as a last column it ignores. */
export const candidateTable = (lines: readonly Candidate[]) => `${lines.map(line => [line.nm.toFixed(4), line.logGf.toFixed(3), species(line), (line.lowerCm * EV_PER_CM).toFixed(4), ...line.damping.map(value => value.toFixed(2)), line.lande.toFixed(4)].join('\t')).join('\n')}\n`;
export function parseCandidateTable(text: string): Candidate[] {
  return text.trimEnd().split('\n').map((row, i) => { const f = row.split('\t'), n = f.map(Number); if (f.length !== 8 || !n.every(Number.isFinite)) throw new TypeError(`Line ${i + 1} of the candidate table is not eight numbers.`);
    return { nm: n[0]!, logGf: n[1]!, element: Math.floor(n[2]! + 1e-6), charge: Math.round((n[2]! % 1) * 100), lowerCm: n[3]! / EV_PER_CM, damping: [n[4]!, n[5]!, n[6]!], lande: n[7]! }; }); }

/** The mask of the candidates at least `minimumDepth` deep. */
export function starMask(lines: readonly Candidate[], depths: ArrayLike<number>, minimumDepth = MINIMUM_DEPTH): MaskLine[] {
  if (depths.length !== lines.length) throw new RangeError(`${depths.length} depths for ${lines.length} lines.`);
  const mask: MaskLine[] = []; lines.forEach((line, i) => { const depth = depths[i]!; if (!(depth >= 0 && depth <= 1)) throw new RangeError(`Line ${i + 1} has depth ${depth}.`); if (depth >= minimumDepth) mask.push({ restNm: line.nm, depth, lande: line.lande, element: line.element, charge: line.charge }); });
  return mask; }

/** The candidate lines, from the kept table when it was made from the pinned list, else from the list itself. */
async function keptCandidates() { const pin = await lineDataPin(), key = `${pin.name} ${pin.bytes}`, table = resolve(KEPT, 'lines.tsv'), stamp = resolve(KEPT, 'lines.key');
  if (await readFile(stamp, 'utf8').catch(() => '') === key) return { table, lines: parseCandidateTable(await readFile(table, 'utf8')), pin };
  const lines = candidates((await loadAtomicLines(...SPAN_NM)).lines); await mkdir(KEPT, { recursive: true }); await writeFile(table, candidateTable(lines)); await writeFile(stamp, key);
  return { table, lines, pin }; }

/** A star's mask with what it was made from. */
export async function lineMask(atmosphere: Atmosphere, minimumDepth = MINIMUM_DEPTH) {
  const { table, lines, pin } = await keptCandidates(), tools = await toolchainPaths(), teff = atmosphere.effectiveTemperatureK.value, logg = atmosphere.logGravity.value, metallicity = atmosphere.metallicity?.value ?? 0;
  const name = `${teff}-${logg}-${metallicity}`, file = resolve(KEPT, `${name}.tsv`), stamp = resolve(KEPT, `${name}.json`), key = JSON.stringify([pin.name, pin.bytes, lines.length, tools.pins.descriptor]);
  let made = await readFile(stamp, 'utf8').then(text => JSON.parse(text) as { key: string; korg: string; synthesised: number }, () => undefined);
  if (made?.key !== key) { let printed: string; try { printed = runJulia(tools, [resolve(import.meta.dirname, 'korg/depths.jl'), table, String(teff), String(logg), String(metallicity), file]); }
    catch (error) { if (error instanceof Error && error.message.includes('interpolate_marcs')) throw new RangeError(`Korg has no model atmosphere for ${teff} K, log g ${logg}, [M/H] ${metallicity}: its MARCS grid does not reach these values (it starts at 2,800 K), so no line mask can be made for this star.`); throw error; }
    const summary = JSON.parse(printed.trim().split('\n').at(-1)!) as { korg: string; synthesised: number };
    made = { key, korg: summary.korg, synthesised: summary.synthesised }; await writeFile(stamp, JSON.stringify(made)); }
  const depths = (await readFile(file, 'utf8')).trimEnd().split('\n').map(Number);
  return { lines: starMask(lines, depths, minimumDepth), candidates: lines.length, synthesised: made.synthesised, korg: made.korg, pin, teff, logg, metallicity };
}
