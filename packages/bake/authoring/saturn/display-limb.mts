/**
 * Saturn's limb law for each display channel.
 *
 * Hubble OPAL publishes one Minnaert exponent per filter, in the README of its Saturn maps. A display channel shows a
 * range of wavelengths, so no single filter is its law. Each channel takes the README's exponents weighted by the light
 * that channel shows: Saturn's full-disc albedo (Karkoschka 1998, PDS 1995LOW.TAB) times a 5,772 K Planck spectrum,
 * through the CIE 1931 observer into linear sRGB, the computation behind the body's whole-disc color. Between two
 * filters the exponent is interpolated in wavelength, and outside them the nearest one holds; that join is ours. The
 * methane-band filters are left out: a narrow absorption band says nothing of the continuum beside it.
 *
 * A weighted sum of Minnaert laws is not a Minnaert law. Each channel records the exponent that fits its weighted
 * profile best over the flood-lit disc, weighted by projected area, out to the emission angle the map's data reached,
 * and the command prints how far that power law departs from the profile.
 *
 *   node packages/bake/authoring/saturn/display-limb.mts --albedo=<1995low.tab> [--write]
 *
 * Reads the per-filter records in src/objects/saturn/source/photometry/ and checks the spectrum against the recorded
 * whole-disc color; --write stores the three display records beside them. Preparation only.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { spectrumLinearSrgb } from '@cssearth/bake/objects/stellar';
import { PHOTOMETRIC_MODEL_SCHEMA, loadPhotometricModelRecord } from '@cssearth/bake/photometry';

/** The Sun's effective temperature in NASA's Sun fact sheet: the illuminant of the whole-disc color record. */
const SOLAR_KELVIN = 5772;
const PLANCK_H = 6.62607015e-34, LIGHT_C = 299792458, BOLTZMANN_K = 1.380649e-23;
const VISIBLE_NM = Array.from({ length: 401 }, (_, i) => 380 + i);
const CHANNELS = ['red', 'green', 'blue'] as const;

export interface FilterExponent { readonly wavelengthNm: number; readonly coefficient: number }

/** The exponent at a wavelength: linear between two filters, the nearest filter's outside them. */
export function exponentAt(filters: readonly FilterExponent[], wavelengthNm: number): number {
  const sorted = [...filters].sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  if (!sorted.length) throw new TypeError('A display limb law needs at least one filter.');
  if (wavelengthNm <= sorted[0]!.wavelengthNm) return sorted[0]!.coefficient;
  for (let i = 1; i < sorted.length; i++) {
    const low = sorted[i - 1]!, high = sorted[i]!;
    if (wavelengthNm <= high.wavelengthNm) return low.coefficient + (high.coefficient - low.coefficient) * (wavelengthNm - low.wavelengthNm) / (high.wavelengthNm - low.wavelengthNm);
  }
  return sorted.at(-1)!.coefficient;
}

/**
 * Each display channel's flood-lit limb profile, mu^(2k - 1) weighted by the light the channel shows, and the Minnaert
 * exponent that fits it best over the disc out to `maximumEmissionDegrees`.
 */
export function displayLimbExponents({ filters, light, colorMatching, maximumEmissionDegrees, steps = 1024 }: {
  filters: readonly FilterExponent[]; light: (wavelengthNm: number) => number; colorMatching: Map<number, readonly number[]>; maximumEmissionDegrees: number; steps?: number;
}) {
  const whole = spectrumLinearSrgb(VISIBLE_NM, light, colorMatching), limit = Math.sin(maximumEmissionDegrees * Math.PI / 180);
  const radii = Array.from({ length: steps }, (_, step) => (step + 0.5) / steps * limit);
  const profiles = radii.map(radius => {
    const mu = Math.sqrt(1 - radius * radius), lit = spectrumLinearSrgb(VISIBLE_NM, wavelength => light(wavelength) * mu ** (2 * exponentAt(filters, wavelength) - 1), colorMatching);
    return { radius, mu, factors: [lit[0] / whole[0], lit[1] / whole[1], lit[2] / whole[2]] as const };
  });
  return CHANNELS.map((channel, index) => {
    let best = { coefficient: Number.NaN, error: Infinity };
    for (let thousandth = 300; thousandth <= 1300; thousandth++) {
      const coefficient = thousandth / 1000;
      let error = 0;
      for (const { radius, mu, factors } of profiles) error += (mu ** (2 * coefficient - 1) - factors[index]!) ** 2 * radius;
      if (error < best.error) best = { coefficient, error };
    }
    const departure = Math.max(...profiles.map(({ mu, factors }) => Math.abs(mu ** (2 * best.coefficient - 1) - factors[index]!)));
    return { channel, coefficient: best.coefficient, departure, discMean: 2 / (2 * best.coefficient + 1) };
  });
}

/** Saturn's albedo from the PDS table's eight columns: air wavelength is the second, Saturn's albedo the fifth. */
export function readSaturnAlbedo(table: string): (wavelengthNm: number) => number {
  const rows = table.split(/\r?\n/u).filter(line => line.trim()).map(line => { const cells = line.trim().split(/\s+/u).map(Number); return { cells: cells.length, wavelength: cells[1]!, albedo: cells[4]! }; });
  if (rows.length < 2 || rows.some(row => row.cells !== 8 || !Number.isFinite(row.wavelength) || !Number.isFinite(row.albedo))) throw new TypeError('The albedo table is not the 1995LOW.TAB layout.');
  if (rows[0]!.wavelength > VISIBLE_NM[0]! || rows.at(-1)!.wavelength < VISIBLE_NM.at(-1)!) throw new RangeError('The albedo table does not cover 380-780 nm.');
  return wavelength => {
    const next = Math.max(1, rows.findIndex(row => row.wavelength >= wavelength)), low = rows[next - 1]!, high = rows[next]!;
    return low.albedo + (high.albedo - low.albedo) * (wavelength - low.wavelength) / (high.wavelength - low.wavelength);
  };
}

const planck = (wavelengthNm: number) => { const metres = wavelengthNm * 1e-9; return 1 / (metres ** 5 * Math.expm1(PLANCK_H * LIGHT_C / (metres * BOLTZMANN_K * SOLAR_KELVIN))); };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const albedoPath = process.argv.find(argument => argument.startsWith('--albedo='))?.slice('--albedo='.length);
  if (!albedoPath) throw new TypeError('Usage: display-limb.mts --albedo=<1995low.tab> [--write]');
  const source = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/saturn/source'), photometry = resolve(source, 'photometry');
  // The README's continuum filters: every per-filter record beside the display records, by the wavelength its filter states.
  const paths = (await readdir(photometry)).filter(name => /^opal-2025-minnaert-f\d+[nmw]\.json$/u.test(name)).sort();
  const records = await Promise.all(paths.map(name => loadPhotometricModelRecord(source, `photometry/${name}`)));
  const filters = records.map(record => {
    const wavelengthNm = Number(/(\d+) nm/u.exec(record.filter)?.[1]), model = record.model;
    if (!Number.isFinite(wavelengthNm) || model.family !== 'separable' || model.disk.family !== 'minnaert') throw new TypeError(`${record.id} is not a Minnaert record with a stated wavelength.`);
    return { id: record.id, wavelengthNm, coefficient: model.disk.coefficient };
  });
  const ranges = records.map(record => JSON.stringify(record.fit));
  if (new Set(ranges).size !== 1) throw new Error('The per-filter records state different fitted ranges.');
  const fit = records[0]!.fit;
  if (!fit.emissionDegrees) throw new TypeError('The per-filter records state no emission range.');
  const albedo = readSaturnAlbedo(await readFile(resolve(albedoPath), 'latin1')), light = (wavelength: number) => planck(wavelength) * albedo(wavelength);
  const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  // The same spectrum gives the recorded whole-disc color; a different table or observer would not.
  const recorded = JSON.parse(await readFile(resolve(photometry, 'karkoschka-1998-whole-disc-color.json'), 'utf8')).linearSrgb as number[];
  const whole = spectrumLinearSrgb(VISIBLE_NM, light, colorMatching);
  for (const channel of [1, 2]) if (Math.abs(whole[channel]! / whole[0] - recorded[channel]! / recorded[0]!) > 5e-4)
    throw new Error(`The spectrum's ${CHANNELS[channel]}/red ratio ${(whole[channel]! / whole[0]).toFixed(4)} is not the recorded whole-disc color's ${(recorded[channel]! / recorded[0]!).toFixed(4)}.`);
  const result = displayLimbExponents({ filters, light, colorMatching, maximumEmissionDegrees: fit.emissionDegrees[1] });
  console.log('filters', filters.map(filter => `${filter.wavelengthNm} nm ${filter.coefficient}`).join(', '));
  for (const { channel, coefficient, departure, discMean } of result) console.log(`${channel}: k ${coefficient.toFixed(3)}, flood-disc mean ${discMean.toFixed(4)}, largest departure from the weighted profile ${departure.toFixed(4)}`);
  if (process.argv.includes('--write')) {
    for (const { channel, coefficient } of result) await writeFile(resolve(photometry, `opal-2025-minnaert-display-${channel}.json`), JSON.stringify({
      schema: PHOTOMETRIC_MODEL_SCHEMA, id: `opal-2025-minnaert-display-${channel}`, instrument: 'Hubble WFC3/UVIS (OPAL)',
      filter: `sRGB ${channel}: the README's continuum filters weighted by Saturn's sunlit spectrum through the CIE 1931 observer`, quantity: 'radiance-factor',
      model: { family: 'separable', disk: { family: 'minnaert', coefficient, coefficientPerDegree: 0 } }, fit,
    }, null, 2) + '\n');
    console.log('wrote the three display records');
  }
}
