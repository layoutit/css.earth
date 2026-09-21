import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, HOSTED_PLANET_IDS, STAR_IDS, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { binAverage, bandTemperatureTable, fitLightCurveMap, lightCurveSamples, temperatureGrid, type LightCurve, type Systematic } from '../eclipse-map/light-curve-map.mts';
import { bareRockFromEclipseDepth, bareRockTemperature, fitBareRock } from '../eclipse-map/bare-rock.mts';
import { measureTransitShift } from '../eclipse-map/transit-timing.mts';
import { readTarMember } from './tar-member.mts';
import { array, boolean, number, optional, shape, text } from './source-records.mts';

const inside = (path: string) => { if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('An eclipse-map input must be inside the source directory.'); return path; };
const systematic = (value: unknown): Systematic => {
  const { kind } = shape({ kind: text })(value);
  if (kind === 'time') return { kind };
  if (kind === 'exponential-ramp') return { kind, timeConstantsDays: shape({ timeConstantsDays: array(number) })(value).timeConstantsDays };
  if (kind === 'column') return { kind, column: shape({ column: text })(value).column };
  throw new TypeError(`Unknown systematics kind ${kind}.`);
};
const ephemeris = shape({ transitTimeBmjdTdb: number, periodDays: number, source: text });
const inputs = { path: text, sampling: text, units: text, planet: text, host: text, lightCurve: shape({ encoding: text }), band: shape({ encoding: text, path: text }), star: shape({ encoding: text, path: text }), ephemeris: optional(ephemeris) };
const profile = shape({
  ...inputs,
  fit: shape({ degrees: array(number), eigencurves: array(number), positive: boolean, transitExclusionPhase: number, gridHeight: number, systematics: array(systematic), transitFromLightCurve: boolean, longitudeSymmetric: optional(boolean) }),
});
const bareRockProfile = shape({ ...inputs, fit: shape({ transitExclusionPhase: number, gridHeight: number, systematics: array(systematic), transitFromLightCurve: boolean }) });

/** Whitespace-separated numbers, one per line (a deposit's single-column text files). */
const numbers = (bytes: Uint8Array) => Float64Array.from(Buffer.from(bytes).toString('utf8').trim().split(/\s+/u), Number);

/** A comma-separated table with a header row, as the JWST reduction exports its light curves and count spectra. */
export function readCsvColumns(bytes: Uint8Array) {
  const [header, ...rows] = Buffer.from(bytes).toString('utf8').trim().split(/\r?\n/u);
  const names = header!.split(',').map(name => name.trim()), columns = new Map(names.map(name => [name, new Float64Array(rows.length)]));
  rows.forEach((row, r) => {
    const cells = row.split(',');
    if (cells.length !== names.length) throw new TypeError(`CSV row ${r + 2} has ${cells.length} cells, not ${names.length}.`);
    cells.forEach((cell, c) => { columns.get(names[c]!)![r] = Number(cell); });
  });
  return columns;
}

/** The first two columns of every row of an SVO VOTable (Filter Profile Service or theoretical spectra service): wavelength in
 * angstroms and the second quantity in the table's own units, checked against the declared units. */
export function readSvoTable(bytes: Uint8Array, expectedUnits: readonly [string, string]) {
  const xml = Buffer.from(bytes).toString('utf8');
  const units = [...xml.matchAll(/<FIELD\b([^>]*)>/gu)].slice(0, 2).map(match => /unit="([^"]*)"/u.exec(match[1]!)?.[1] ?? '');
  if (units.length !== 2) throw new TypeError('The VOTable does not declare two columns.');
  if (units[0]!.toLowerCase() !== expectedUnits[0].toLowerCase() || units[1]!.toLowerCase() !== expectedUnits[1].toLowerCase()) {
    throw new TypeError(`The VOTable columns are ${units.join(', ')}, not ${expectedUnits.join(', ')}.`);
  }
  const wavelength: number[] = [], values: number[] = [];
  for (const match of xml.matchAll(/<TR>\s*<TD>([^<]*)<\/TD>\s*<TD>([^<]*)<\/TD>/gu)) { wavelength.push(Number(match[1])); values.push(Number(match[2])); }
  if (!wavelength.length || [...wavelength, ...values].some(value => !Number.isFinite(value))) throw new TypeError('The VOTable has no finite rows.');
  return { wavelengthMicrons: Float64Array.from(wavelength, a => a / 1e4), values: Float64Array.from(values) };
}

/** An SVO filter profile. A unitless transmission, or a photon-counting response in electrons per photon (`ephot`, as the Filter
 * Profile Service gives JWST filters) when the profile declares a photon-counting detector (DetectorType 1): either way the counted
 * signal scales with the response times lambda times the star's intensity. */
export function readSvoFilter(bytes: Uint8Array) {
  const xml = Buffer.from(bytes).toString('utf8');
  const detector = /<PARAM name="DetectorType"[^>]*value="([^"]*)"/u.exec(xml)?.[1];
  const second = /<FIELD\b[^>]*>[\s\S]*?<FIELD\b[^>]*unit="([^"]*)"/u.exec(xml)?.[1] ?? '';
  if (second.toLowerCase() === 'ephot' && detector !== '1') throw new TypeError('An electrons-per-photon filter profile must declare a photon-counting detector.');
  return readSvoTable(bytes, ['Angstrom', second.toLowerCase() === 'ephot' ? 'ephot' : '']);
}

/** The instrument band a light curve or eclipse depth summed, weighted by a stellar model spectrum. */
async function loadBand(read: (path: string) => Promise<Buffer>, recipe: { band: { encoding: string; path: string }; star: { encoding: string; path: string } }) {
  if (recipe.star.encoding !== 'svo-model-spectrum') throw new TypeError(`Unknown stellar spectrum encoding ${recipe.star.encoding}.`);
  // Model surface flux, erg s^-1 cm^-2 A^-1, to the disc-averaged intensity in W m^-3 sr^-1: times 1e7, over pi.
  const model = readSvoTable(await read(recipe.star.path), ['ANGSTROM', 'ERG/CM2/S/A']);
  // The model is kept over 0.5 to 30 microns: its far-ultraviolet rows print wavelengths too coarsely to increase.
  const span = Array.from(model.wavelengthMicrons.keys()).filter(i => model.wavelengthMicrons[i]! >= 0.5 && model.wavelengthMicrons[i]! <= 30);
  const stellar = { wavelengthMicrons: Float64Array.from(span, i => model.wavelengthMicrons[i]!), values: Float64Array.from(span, i => model.values[i]! * 1e7 / Math.PI) };
  let band;
  if (recipe.band.encoding === 'svo-filter') {
    // A filter transmission: counted photons scale with transmission times lambda times the star's intensity.
    const filter = readSvoFilter(await read(recipe.band.path));
    const intensity = binAverage(stellar, filter.wavelengthMicrons), spacing = filter.wavelengthMicrons.map((w, i, all) => ((all[Math.min(all.length - 1, i + 1)]! - all[Math.max(0, i - 1)]!) / 2));
    band = { wavelengthMicrons: filter.wavelengthMicrons, stellarIntensity: intensity, counts: filter.values.map((t, i) => Math.max(0, t) * filter.wavelengthMicrons[i]! * intensity[i]! * spacing[i]!) };
  } else if (recipe.band.encoding === 'count-spectrum-csv') {
    // The star's own extracted counts per detector column: the light curve summed exactly these over its wavelength range.
    const spec = shape({ wavelength: text, counts: text, minimumMicrons: number, maximumMicrons: number })(recipe.band);
    const table = readCsvColumns(await read(recipe.band.path)), wavelength = table.get(spec.wavelength), counts = table.get(spec.counts);
    if (!wavelength || !counts) throw new TypeError('The count spectrum lacks its wavelength or counts column.');
    const rows = Array.from(wavelength.keys()).filter(i => wavelength[i]! >= spec.minimumMicrons && wavelength[i]! <= spec.maximumMicrons && Number.isFinite(counts[i]!));
    const centres = Float64Array.from(rows, i => wavelength[i]!);
    band = { wavelengthMicrons: centres, stellarIntensity: binAverage(stellar, centres), counts: Float64Array.from(rows, i => Math.max(0, counts[i]!)) };
  } else throw new TypeError(`Unknown band encoding ${recipe.band.encoding}.`);
  return band;
}

/** What a light-curve fit reads: the light curve, the band it summed against a stellar model spectrum, and the planet's orbit, with
 * the transit time optionally taken from the light curve itself. */
async function loadLightCurveInputs(root: string, recipe: ReturnType<typeof bareRockProfile>) {
  if (recipe.sampling !== 'bilinear') throw new TypeError('A light-curve map samples bilinearly.');
  if (recipe.units !== 'K') throw new TypeError('A light-curve map is a brightness temperature in K.');
  const read = async (path: string) => readFile(resolve(root, inside(path)));
  const source = await read(recipe.path);
  let curve: LightCurve;
  if (recipe.lightCurve.encoding === 'tar-text-columns') {
    const members = shape({ time: text, flux: text, error: text })(recipe.lightCurve);
    curve = { time: numbers(readTarMember(source, members.time)), flux: numbers(readTarMember(source, members.flux)), error: numbers(readTarMember(source, members.error)), columns: new Map() };
  } else if (recipe.lightCurve.encoding === 'csv') {
    const spec = shape({ time: text, flux: text, error: text, mask: text, skipLeading: number, columns: array(text) })(recipe.lightCurve);
    const table = readCsvColumns(source), column = (name: string) => { const values = table.get(name); if (!values) throw new TypeError(`The light curve has no ${name} column.`); return values; };
    if (!Number.isSafeInteger(spec.skipLeading) || spec.skipLeading < 0) throw new TypeError('skipLeading must be a whole number of integrations.');
    // Integrations flagged by the reduction, and the leading ones the recipe drops, are removed before the fit.
    const mask = column(spec.mask), keep = Array.from(mask.keys()).filter(i => i >= spec.skipLeading && mask[i] === 0);
    const pick = (values: Float64Array) => Float64Array.from(keep, i => values[i]!);
    curve = { time: pick(column(spec.time)), flux: pick(column(spec.flux)), error: pick(column(spec.error)), columns: new Map(spec.columns.map(name => [name, pick(column(name))])) };
  } else throw new TypeError(`Unknown light-curve encoding ${recipe.lightCurve.encoding}.`);

  const band = await loadBand(read, recipe);

  const planetId = HOSTED_PLANET_IDS.find(id => id === recipe.planet), hostId = STAR_IDS.find(id => id === recipe.host);
  if (!planetId || !hostId) throw new TypeError(`${recipe.planet} is not a hosted planet or ${recipe.host} is not a placed star.`);
  const radiusRatio = BODIES[planetId].meanRadiusKm / BODIES[hostId].meanRadiusKm;
  // Eclipse timing moves longitude (about 0.04 degrees per second for WASP-43b, 0.5 for HD 189733b), so a recipe can take the transit
  // time from its own light curve instead of an ephemeris propagated to the visit; light time across the orbit is always modelled.
  // A package orbit carries one reference transit and period; transit-timing variations move a planet's events by hours over the
  // years since (TRAPPIST-1b's osculating elements of 2015 put its 2022 eclipses two hours early). A recipe can give the linear
  // ephemeris of its own observations instead; the shape of the orbit stays the package's.
  let orbit = hostedOrbit(planetId), transitShiftSeconds = 0, transitFit: ReturnType<typeof measureTransitShift> | null = null;
  if (recipe.ephemeris) {
    if (!(recipe.ephemeris.periodDays > 0) || !Number.isFinite(recipe.ephemeris.transitTimeBmjdTdb)) throw new TypeError('An ephemeris needs a transit time and a positive period.');
    orbit = { ...orbit, transitTimeBmjdTdb: recipe.ephemeris.transitTimeBmjdTdb, periodDays: recipe.ephemeris.periodDays };
  }
  if (recipe.fit.transitFromLightCurve) {
    transitFit = measureTransitShift(curve, orbit, starAstrometry(hostId), radiusRatio);
    transitShiftSeconds = transitFit.shiftSeconds;
    orbit = { ...orbit, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb + transitShiftSeconds / 86400 };
  }
  return { curve, band, orbit, host: starAstrometry(hostId), stellarRadiusKm: BODIES[hostId].meanRadiusKm, radiusRatio, transitShiftSeconds, transitFit };
}

const transitReport = (transitFit: ReturnType<typeof measureTransitShift> | null) => transitFit ? { transitFit: { shiftUncertaintySeconds: transitFit.uncertaintySeconds,
  radiusRatio: transitFit.radiusRatio, limbDarkening: transitFit.limbDarkening, reducedChiSquared: transitFit.reducedChiSquared,
  samples: transitFit.samples, model: transitFit.fit.model, software: transitFit.fit.software } } : {};

/** A map of brightness temperature fitted from a light curve at preparation time: the eigencurve fit on the package's own orbit,
 * then the band conversion against a stellar model spectrum (see `tools/objects/eclipse-map/light-curve-map.mts`). */
export async function loadEclipseMapFit(root: string, value: unknown) {
  const recipe = profile(value), { curve, band, orbit, host, stellarRadiusKm, radiusRatio, transitShiftSeconds, transitFit } = await loadLightCurveInputs(root, recipe);
  const result = fitLightCurveMap(curve, recipe.fit, orbit, host, radiusRatio, { stellarRadiusKm });
  // Temperatures are taken on the fit's own grid, the cells positivity was enforced on; a finer grid can dip below zero between them.
  const table = bandTemperatureTable(band, { minimumK: 20 }), height = recipe.fit.gridHeight, width = 2 * height;
  if (!Number.isSafeInteger(height) || height < 2) throw new TypeError('The fit grid needs a whole height of at least 2.');
  const grid = temperatureGrid(result.basis, result.fit, table, radiusRatio, height);
  const cell = (x: number, y: number) => { const v = grid.temperatures[y * width + ((x % width) + width) % width]!; return Number.isFinite(v) ? v : null; };
  const lonStep = 360 / width, latStep = 180 / height;
  return {
    width, height, fit: result, band, radiusRatio, orbit, transitShiftSeconds,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const px = (((longitude + 180) % 360 + 360) % 360) / lonStep - 0.5, y = Math.max(0, Math.min(height - 1, (latitude + 90) / latStep - 0.5));
      const x0 = Math.floor(px), y0 = Math.min(height - 2, Math.floor(y)), dx = px - x0, dy = y - y0;
      const corners = [cell(x0, y0), cell(x0 + 1, y0), cell(x0, y0 + 1), cell(x0 + 1, y0 + 1)];
      if (corners.some(v => v === null)) return null;
      const [a, b, c, d] = corners as number[];
      return a! * (1 - dx) * (1 - dy) + b! * dx * (1 - dy) + c! * (1 - dx) * dy + d! * dx * dy;
    },
    report: { format: 'eclipse-map-fit', units: 'K', transitShiftSeconds, ...transitReport(transitFit),
      degree: result.basis.lmax, eigencurves: result.fit.ncurves, candidates: result.candidates, samples: result.samples, chiSquared: result.fit.chiSquared,
      bic: result.fit.bic, rampTimeConstantDays: result.rampTimeConstantDays, stellarCorrection: result.fit.stellarCorrection, hotspot: result.hotspot },
  };
}

/** A bare rock fitted to a light curve at preparation time (see `tools/objects/eclipse-map/bare-rock.mts`): one substellar
 * temperature, drawn as the planet's temperature, with nothing on the night side. */
export async function loadBareRockFit(root: string, value: unknown) {
  const recipe = bareRockProfile(value), { curve, band, orbit, host, stellarRadiusKm, radiusRatio, transitShiftSeconds, transitFit } = await loadLightCurveInputs(root, recipe);
  if (recipe.fit.systematics.some(entry => entry.kind === 'exponential-ramp')) throw new TypeError('A bare-rock fit takes linear systematics only.');
  const samples = lightCurveSamples(curve, recipe.fit, orbit);
  const fit = fitBareRock({ time: samples.time, flux: samples.flux, error: samples.error, systematics: samples.columns(null) }, bandTemperatureTable(band, { minimumK: 20 }),
    orbit, host, radiusRatio, { gridHeight: recipe.fit.gridHeight, lightTravel: { stellarRadiusKm } });
  return {
    fit, band, radiusRatio, orbit, transitShiftSeconds,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      return bareRockTemperature(fit.substellarK, longitude, latitude);
    },
    report: { format: 'bare-rock-fit', units: 'K', transitShiftSeconds, ...transitReport(transitFit), substellarK: fit.substellarK, substellarRangeK: [fit.lowerK, fit.upperK],
      samples: fit.samples, chiSquared: fit.chiSquared, bic: fit.bic, stellarCorrection: fit.stellarCorrection },
  };
}

const depthRecord = shape({ schema: text, planet: text, eclipseDepthPpm: shape({ low: number, high: number }), source: text });
const bareRockEclipseProfile = shape({ path: text, sampling: text, units: text, planet: text, host: text, band: shape({ encoding: text, path: text }), star: shape({ encoding: text, path: text }) });

/** A bare rock drawn from a measured eclipse depth, for a planet whose day-night pattern is not measured: the substellar temperature
 * whose rock shows the depth at secondary eclipse (see `tools/objects/eclipse-map/bare-rock.mts`). The record gives the depth as a
 * range; the rock is drawn at its middle and the range is reported. */
export async function loadBareRockEclipse(root: string, value: unknown) {
  const recipe = bareRockEclipseProfile(value);
  if (recipe.sampling !== 'bilinear') throw new TypeError('A bare rock samples bilinearly.');
  if (recipe.units !== 'K') throw new TypeError('A bare rock is a brightness temperature in K.');
  const read = async (path: string) => readFile(resolve(root, inside(path)));
  const record = depthRecord(JSON.parse((await read(recipe.path)).toString('utf8')));
  if (record.schema !== 'cssearth-eclipse-depth@1' || record.planet !== recipe.planet) throw new TypeError(`${recipe.path} is not an eclipse depth of ${recipe.planet}.`);
  const { low, high } = record.eclipseDepthPpm;
  if (!(low > 0 && high >= low)) throw new TypeError('An eclipse depth range needs 0 < low <= high.');
  const planetId = HOSTED_PLANET_IDS.find(id => id === recipe.planet), hostId = STAR_IDS.find(id => id === recipe.host);
  if (!planetId || !hostId) throw new TypeError(`${recipe.planet} is not a hosted planet or ${recipe.host} is not a placed star.`);
  const radiusRatio = BODIES[planetId].meanRadiusKm / BODIES[hostId].meanRadiusKm, band = await loadBand(read, recipe), table = bandTemperatureTable(band, { minimumK: 20 });
  const at = (ppm: number) => bareRockFromEclipseDepth(ppm * 1e-6, table, radiusRatio);
  const substellarK = at((low + high) / 2), lowerK = at(low), upperK = at(high);
  return {
    substellarK, lowerK, upperK, radiusRatio, band,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      return bareRockTemperature(substellarK, longitude, latitude);
    },
    report: { format: 'bare-rock-eclipse', units: 'K', eclipseDepthPpm: [low, high], substellarK, substellarRangeK: [lowerK, upperK] },
  };
}
