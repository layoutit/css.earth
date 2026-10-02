/** The limb darkening of a neutron star's hydrogen atmosphere, from the NSX emergent-intensity table that NICER pulse-profile fits
 * read (Ho & Lai 2001, MNRAS 327, 1081; Ho & Heinke 2009, Nature 462, 71; table `nsx_H_v200804.out`, distributed with X-PSI).
 *
 * The table lists log10(I_nu / Teff^3) for 35 effective temperatures, 14 surface gravities, 166 photon energies E/kTeff and 67
 * emission cosines mu, in that nesting order, with -60 where the model does not reach (its README). Integrating I_nu over photon
 * energy at one temperature and gravity gives the bolometric intensity at each mu; its ratio to the value at mu = 1 is the limb
 * profile. Temperature and gravity are read between the table's nodes, linearly in the logarithm of the intensity. */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const NSX_GRID = { temperatures: 35, gravities: 14, energies: 166, cosines: 67 } as const;
export interface NsxTable { readonly log10Temperature: readonly number[]; readonly log10Gravity: readonly number[]; readonly log10EnergyOverKt: readonly number[];
  readonly mu: readonly number[]; readonly log10Intensity: Float64Array }

const UNREACHED = -50;

/** Read the table's five columns: log10(E/kTeff), mu, log10(I_nu/Teff^3), log10 Teff, log10 g. */
export async function readNsxTable(path: string): Promise<NsxTable> {
  const { temperatures, gravities, energies, cosines } = NSX_GRID, rows = temperatures * gravities * energies * cosines;
  const log10Intensity = new Float64Array(rows), mu: number[] = [], log10EnergyOverKt: number[] = [], log10Temperature: number[] = [], log10Gravity: number[] = [];
  let row = 0;
  for await (const line of createInterface({ input: createReadStream(path) })) {
    const cells = line.trim().split(/\s+/u);
    if (cells.length < 5) continue;
    if (row >= rows) throw new RangeError(`${path}: more than the ${rows} rows of an NSX table.`);
    const [energy, cosine, intensity, temperature, gravity] = cells.map(Number);
    if (![energy, cosine, intensity, temperature, gravity].every(Number.isFinite)) throw new TypeError(`${path}: row ${row + 1} is not five numbers.`);
    if (row < cosines) mu.push(cosine!);
    if (row % cosines === 0 && row < energies * cosines) log10EnergyOverKt.push(energy!);
    if (row % (energies * cosines) === 0 && row < gravities * energies * cosines) log10Gravity.push(gravity!);
    if (row % (gravities * energies * cosines) === 0) log10Temperature.push(temperature!);
    log10Intensity[row++] = intensity!;
  }
  if (row !== rows) throw new RangeError(`${path}: ${row} rows, not the ${rows} of an NSX table.`);
  if (mu[0] !== 1) throw new RangeError(`${path}: the first emission cosine is ${mu[0]}, not 1.`);
  return { log10Temperature, log10Gravity, log10EnergyOverKt, mu, log10Intensity };
}

const bracket = (nodes: readonly number[], value: number, label: string) => {
  if (!(value >= nodes[0]! && value <= nodes.at(-1)!)) throw new RangeError(`${label} ${value} is outside the NSX table's ${nodes[0]} to ${nodes.at(-1)}.`);
  const upper = Math.max(1, nodes.findIndex(node => node >= value)), lower = upper - 1;
  return { lower, upper, share: (value - nodes[lower]!) / (nodes[upper]! - nodes[lower]!) };
};

/** The bolometric intensity at each of the table's emission cosines, as a share of the intensity at mu = 1. */
export function nsxLimbProfile(table: NsxTable, log10Temperature: number, log10Gravity: number): { readonly mu: readonly number[]; readonly intensity: readonly number[] } {
  const gravities = table.log10Gravity.length, energies = table.log10EnergyOverKt.length, cosines = table.mu.length;
  if (table.log10Intensity.length !== table.log10Temperature.length * gravities * energies * cosines) throw new RangeError('The NSX intensities do not fill their grid.');
  const t = bracket(table.log10Temperature, log10Temperature, 'log10 Teff'), g = bracket(table.log10Gravity, log10Gravity, 'log10 g');
  const at = (temperature: number, gravity: number, energy: number, cosine: number) => table.log10Intensity[((temperature * gravities + gravity) * energies + energy) * cosines + cosine]!;
  // I_nu d(nu) = I_nu E d(ln E): the integrand per unit ln E, up to a constant the ratio cancels.
  const integrand = (energy: number, cosine: number) => {
    const log = (1 - t.share) * (1 - g.share) * at(t.lower, g.lower, energy, cosine) + t.share * (1 - g.share) * at(t.upper, g.lower, energy, cosine)
      + (1 - t.share) * g.share * at(t.lower, g.upper, energy, cosine) + t.share * g.share * at(t.upper, g.upper, energy, cosine);
    return log < UNREACHED ? 0 : 10 ** (log + table.log10EnergyOverKt[energy]!);
  };
  const total = table.mu.map((_, cosine) => {
    let sum = 0;
    for (let energy = 0; energy < energies - 1; energy++) sum += (integrand(energy, cosine) + integrand(energy + 1, cosine)) / 2 * (table.log10EnergyOverKt[energy + 1]! - table.log10EnergyOverKt[energy]!);
    return sum;
  });
  return { mu: table.mu, intensity: total.map(value => value / total[0]!) };
}

/** The least-squares quadratic law I(mu)/I(1) = 1 - u1 (1 - mu) - u2 (1 - mu)^2 through a profile, with its largest miss. Cosines
 * under `floor` are left out of the fit: the last few degrees of the limb are a sliver of the disc and bend the law elsewhere. */
export function fitQuadraticLimb(profile: { readonly mu: readonly number[]; readonly intensity: readonly number[] }, floor = 0.05) {
  let xx = 0, xxx = 0, xxxx = 0, xy = 0, xxy = 0;
  profile.mu.forEach((mu, index) => {
    if (mu < floor) return;
    const x = 1 - mu, y = 1 - profile.intensity[index]!;
    xx += x * x; xxx += x ** 3; xxxx += x ** 4; xy += x * y; xxy += x * x * y;
  });
  const determinant = xx * xxxx - xxx * xxx, u1 = (xy * xxxx - xxy * xxx) / determinant, u2 = (xx * xxy - xxx * xy) / determinant;
  const largestMiss = Math.max(...profile.mu.map((mu, index) => mu < floor ? 0 : Math.abs(1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2 - profile.intensity[index]!)));
  return { u1, u2, largestMiss };
}

/** log10 of the surface gravity in cm/s^2 of a non-rotating star of `massSolar` and `radiusKm`, with the general-relativistic factor
 * (1 - 2GM/Rc^2)^(-1/2) the atmosphere models are computed for. */
export function neutronStarLog10Gravity(massSolar: number, radiusKm: number) {
  const gm = 1.3271244004193938e20 * massSolar, radius = radiusKm * 1000, compactness = 2 * gm / (radius * 299792458 ** 2);
  if (!(compactness > 0 && compactness < 1)) throw new RangeError(`A star of ${massSolar} solar masses and ${radiusKm} km is inside its own horizon.`);
  return Math.log10(gm / radius ** 2 / Math.sqrt(1 - compactness) * 100);
}
