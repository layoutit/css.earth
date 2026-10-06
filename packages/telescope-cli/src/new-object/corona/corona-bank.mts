/** A star's corona derived from the magnetic maps its page already shows, as a volume bank attached to the star. A spec
 * entry names the star, the maps, and the three numbers the amount of gas follows from: the X-ray flux, and a coronal
 * temperature and a mass loss that are either measured and cited or taken from a published relation. The generator reads
 * and computes (`@cssearth/bake/objects/stellar`, corona/); every sentence it writes says the corona is derived here and
 * names what is measured. Nothing here reads a file: corona.mts brings the star's records and its maps. */
import { CORONA_DISPLAY, JOHNSTONE_GUEDEL_2015, SECONDS_PER_YEAR, SHEET_CORONA, SOLAR_MASS_G, WOOD_2021, coronaExposureGain, coronaPeakValue, coronalTemperatureFromSurfaceFlux,
  expandSurfaceField, hydrostaticCorona, massLossFromSurfaceFlux, neutralLine, openShare, parkerWind, sheetCoronaDensity, synthesizeSurfaceField, xraySurfaceFlux } from '@cssearth/bake/objects/stellar';
import { encodeDensityKtx2 } from '@cssearth/bake/density';
import { VOLUME_PROVENANCE_SCHEMA } from '@cssearth/bake/volume';
import { INVESTIGATION_LEDGER_SCHEMA, NEBULA_DELIVERY_SCHEMA, OBJECT_SCHEMA, PREPARED_VOLUME_DATASET_INDEX_SCHEMA, PUBLISHED_MODEL_PARAMETERS_SCHEMA, VOLUME_PRESENTATION_SOURCE_SCHEMA, VOLUME_RECIPE_SCHEMA, VOLUME_SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { json, type PackageFiles } from '../dataset.mts';

export const CORONA_GRID = Object.freeze({ size: 96, halfUnits: 4, slabs: 32 });
/** The surface map is read on 2° cells and expanded to this degree; the maps are published to degree 15 at most. */
export const CORONA_MAP = Object.freeze({ width: 180, height: 90, lmax: 15 });
export const CORONA_GENERATOR = 'packages/telescope-cli/src/new-object/corona/corona-bank.mts';
const PARSEC_M = 3.085677581491367e16, ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, STATUSES = ['included', 'excluded', 'deferred'] as const;

/** A source an entry cites; `checked` is the day a person read it, the run's day when absent. */
export interface CoronaSource { readonly catalogueId: string; readonly url: string; readonly label: string; readonly locator: string; readonly checked?: string }
export interface CoronaLedgerEntry { readonly id: string; readonly subject: string; readonly status: typeof STATUSES[number]; readonly finding: string; readonly evidence: readonly string[] }
export interface CoronaMapEntry { /** The dataset of the star's page that draws this map's radial field. */ readonly surface: string; readonly id: string; readonly label: string }
export interface CoronaEntry {
  readonly host: string; readonly bank: string; readonly maps: readonly CoronaMapEntry[];
  /** The star's X-ray flux at Earth, erg s⁻¹ cm⁻², in the catalogue's band. */
  readonly xray: CoronaSource & { readonly fluxErgCm2S: number; readonly band: string };
  /** A measured coronal temperature, or the relation that gives one from the X-ray flux. */
  readonly temperature: (CoronaSource & { readonly kelvin: number }) | { readonly relation: 'johnstone-guedel-2015' };
  /** A measured mass loss in units of the Sun's, or the relation that gives one from the X-ray flux. */
  readonly massLoss: (CoronaSource & { readonly solar: number }) | { readonly relation: 'wood-2021' };
  readonly ledger: readonly CoronaLedgerEntry[];
}
type Json = Record<string, unknown>;

const RELATIONS = Object.freeze({
  'johnstone-guedel-2015': { catalogueId: 'arxiv-1505-00643', url: 'https://arxiv.org/abs/1505.00643', label: 'Johnstone & Güdel (2015), A&A 578, A129', locator: `Equation 4: T = ${JOHNSTONE_GUEDEL_2015.coefficientMK} F_X^${JOHNSTONE_GUEDEL_2015.index} million kelvin` },
  'wood-2021': { catalogueId: 'arxiv-2105-00019', url: 'https://arxiv.org/abs/2105.00019', label: 'Wood et al. (2021), ApJ 915, 37', locator: `Section 5.1 and Table 3: mass loss per unit surface rises as F_X^${WOOD_2021.index}` },
} satisfies Record<string, CoronaSource>);
/** The method's own papers, cited in every bank's provenance. */
const METHOD = Object.freeze([
  { id: 'potential-field', url: 'https://doi.org/10.1007/BF00145734', role: 'Altschuler & Newkirk (1969), Solar Physics 9, 131: the potential field of a surface map out to a source surface' },
  { id: 'source-surface', url: 'https://doi.org/10.1007/BF00146478', role: 'Schatten, Wilcox & Ness (1969), Solar Physics 6, 442: the source surface' },
  { id: 'streamer-belt', url: 'https://doi.org/10.1086/511416', role: 'Wang, Sheeley & Rich (2007), ApJ 658, 1340: the Sun\'s streamer belt follows the neutral line of that field' },
  { id: 'wind-solution', url: 'https://doi.org/10.1086/146579', role: 'Parker (1958), ApJ 128, 664: the isothermal wind' },
  { id: 'radiative-loss', url: 'https://doi.org/10.1086/155949', role: 'Rosner, Tucker & Vaiana (1978), ApJ 220, 643: the power radiated per unit emission measure' },
]);

/** A spec file's `coronae`. */
export function parseCoronae(value: unknown): CoronaEntry[] {
  const entries = requireArray(requireRecord(value, 'corona spec').coronae, 'coronae').map((entry, index): CoronaEntry => {
    const at = `coronae[${index}]`, input = requireRecord(entry, at), text = (record: Json, key: string, where: string) => { const found = requireString(record[key], `${where}.${key}`).trim(); if (!found) throw new TypeError(`${where}.${key} is empty.`); return found; };
    const id = (record: Json, key: string, where: string) => { const found = text(record, key, where); if (!ID.test(found)) throw new TypeError(`${where}.${key} ${JSON.stringify(found)} is not an id (lower case, digits, hyphens).`); return found; };
    const known = new Set(['host', 'bank', 'maps', 'xray', 'temperature', 'massLoss', 'ledger']), unknown = Object.keys(input).filter(key => !known.has(key));
    if (unknown.length) throw new TypeError(`${at}: unknown fields ${unknown.join(', ')}.`);
    const source = (record: Json, where: string): CoronaSource => { const url = text(record, 'url', where); if (!/^https:\/\//u.test(url)) throw new TypeError(`${where}.url ${url}: an https address.`);
      return { catalogueId: id(record, 'catalogueId', where), url, label: text(record, 'label', where), locator: text(record, 'locator', where), ...(record.checked === undefined ? {} : { checked: text(record, 'checked', where) }) }; };
    const positive = (record: Json, key: string, where: string) => { const found = requireFiniteNumber(record[key], `${where}.${key}`); if (!(found > 0)) throw new RangeError(`${where}.${key} must be positive.`); return found; };
    const maps = requireArray(input.maps, `${at}.maps`).map((one, i) => { const map = requireRecord(one, `${at}.maps[${i}]`); return { surface: id(map, 'surface', `${at}.maps[${i}]`), id: id(map, 'id', `${at}.maps[${i}]`), label: text(map, 'label', `${at}.maps[${i}]`) }; });
    if (!maps.length) throw new TypeError(`${at}.maps names no map.`);
    if (new Set(maps.map(map => map.id)).size !== maps.length) throw new TypeError(`${at}.maps: two maps share an id.`);
    const xray = requireRecord(input.xray, `${at}.xray`), temperature = requireRecord(input.temperature, `${at}.temperature`), massLoss = requireRecord(input.massLoss, `${at}.massLoss`);
    if (temperature.relation !== undefined && temperature.relation !== 'johnstone-guedel-2015') throw new TypeError(`${at}.temperature.relation is "johnstone-guedel-2015", or the entry cites a measured kelvin.`);
    if (massLoss.relation !== undefined && massLoss.relation !== 'wood-2021') throw new TypeError(`${at}.massLoss.relation is "wood-2021", or the entry cites a measured value in units of the Sun's.`);
    const ledger = input.ledger === undefined ? [] : requireArray(input.ledger, `${at}.ledger`).map((one, i): CoronaLedgerEntry => { const where = `${at}.ledger[${i}]`, record = requireRecord(one, where), status = text(record, 'status', where);
      if (!(STATUSES as readonly string[]).includes(status)) throw new TypeError(`${where}.status is one of ${STATUSES.join(', ')}.`);
      return { id: id(record, 'id', where), subject: text(record, 'subject', where), status: status as CoronaLedgerEntry['status'], finding: text(record, 'finding', where), evidence: requireArray(record.evidence, `${where}.evidence`).map(item => requireString(item, `${where}.evidence`)) }; });
    return { host: id(input, 'host', at), bank: id(input, 'bank', at), maps,
      xray: { ...source(xray, `${at}.xray`), fluxErgCm2S: positive(xray, 'fluxErgCm2S', `${at}.xray`), band: text(xray, 'band', `${at}.xray`) },
      temperature: temperature.relation ? { relation: 'johnstone-guedel-2015' } : { ...source(temperature, `${at}.temperature`), kelvin: positive(temperature, 'kelvin', `${at}.temperature`) },
      massLoss: massLoss.relation ? { relation: 'wood-2021' } : { ...source(massLoss, `${at}.massLoss`), solar: positive(massLoss, 'solar', `${at}.massLoss`) }, ledger };
  });
  if (new Set(entries.map(entry => entry.bank)).size !== entries.length) throw new TypeError('coronae: two entries write the same bank.');
  return entries;
}

/** What the star's own records give: its place, size and mass, its catalogue color, and its drawn body frame. */
export interface CoronaStar {
  readonly id: string; readonly name: string; readonly colorHex: string; readonly massSolar: number; readonly radiusSolar: number; readonly radiusM: number;
  /** The star's place in the scene, metres from the Sun in ICRF. */
  readonly originM: readonly [number, number, number];
  /** The direction, in the map's frame, of a place given in the grid's axes (west, north, away from Earth): colatitude and
   * east longitude in radians. The frame is the one the star's surface maps are drawn in. */
  readonly bodyFromGrid: (x: number, y: number, z: number) => readonly [number, number];
  readonly inclinationDegrees: number; readonly rotationRecord: string;
}
/** One map as the star's page reads it: the sampler of its radial field in gauss by east longitude and latitude in
 * degrees, and the star's manifest entry for its file. */
export interface CoronaMapInput { readonly entry: CoronaMapEntry; readonly sample: (longitude: number, latitude: number) => number | null; readonly science: Json; readonly manifestInput: Json }
export interface CoronaInputs { readonly star: CoronaStar; readonly maps: readonly CoronaMapInput[]; readonly host: { readonly content: Json; readonly text: Json }; readonly checked: string }

const sci = (value: number) => { const exponent = Math.floor(Math.log10(value)); return `${(value / 10 ** exponent).toFixed(1)} × 10^${exponent}`; };
const times = (factor: number) => factor >= 10 ? factor.toFixed(0) : factor.toFixed(1);
/** A density by radius, tabulated in the logarithm from the surface to the edge of the grid. */
function tabulated(density: (radii: number) => number) {
  const count = 480, top = Math.log(CORONA_GRID.halfUnits * 1.001), table = Float64Array.from({ length: count + 1 }, (_, i) => Math.log(density(Math.exp(top * i / count))));
  return (radii: number) => { const at = Math.max(0, Math.min(count - 1e-9, Math.log(Math.max(1, radii)) / top * count)), i = Math.floor(at); return Math.exp(table[i]! + (table[i + 1]! - table[i]!) * (at - i)); };
}

/** The amount of gas: the star's X-ray output, temperature and mass loss, and the two models they set. `refused` names why
 * the method does not hold for a star. */
export function coronaPhysics(entry: CoronaEntry, star: Pick<CoronaStar, 'massSolar' | 'radiusSolar' | 'originM'>) {
  const distanceCm = Math.hypot(...star.originM) * 100, xrayLuminosityErgS = entry.xray.fluxErgCm2S * 4 * Math.PI * distanceCm ** 2, surfaceFlux = xraySurfaceFlux(xrayLuminosityErgS, star.radiusSolar);
  const measuredTemperature = 'kelvin' in entry.temperature, kelvin = 'kelvin' in entry.temperature ? entry.temperature.kelvin : coronalTemperatureFromSurfaceFlux(surfaceFlux);
  const measuredMassLoss = 'solar' in entry.massLoss, massLossSolar = 'solar' in entry.massLoss ? entry.massLoss.solar : massLossFromSurfaceFlux(surfaceFlux, star.radiusSolar);
  const body = { massSolar: star.massSolar, radiusSolar: star.radiusSolar };
  const wind = parkerWind({ massLossGramsPerSecond: massLossSolar * WOOD_2021.solarMassLossSolarMassesPerYear * SOLAR_MASS_G / SECONDS_PER_YEAR, kelvin, ...body });
  const atRest = hydrostaticCorona({ xrayLuminosityErgS, kelvin, ...body, outerRadii: CORONA_GRID.halfUnits });
  const [lowFlux, highFlux] = JOHNSTONE_GUEDEL_2015.surfaceFluxRange;
  const refused = wind.criticalRadii < 1 ? `gas at ${(kelvin / 1e6).toFixed(1)} million kelvin is not held by this star: the wind would pass the speed of sound ${wind.criticalRadii.toFixed(2)} radii from the centre, inside the star. Cite a measured wind temperature, or leave the star out.`
    : !measuredTemperature && (surfaceFlux < lowFlux || surfaceFlux > highFlux) ? `its X-ray surface flux, ${sci(surfaceFlux)} erg s⁻¹ cm⁻², is outside the range the temperature relation was fitted on (${sci(lowFlux)} to ${sci(highFlux)}).` : undefined;
  return { xrayLuminosityErgS, surfaceFlux, kelvin, measuredTemperature, massLossSolar, measuredMassLoss, wind, atRest, ...(refused ? { refused } : {}) };
}
export type CoronaPhysics = ReturnType<typeof coronaPhysics>;

/** One map's corona: the field's harmonics, its neutral line and open share, and the density they place. */
export function deriveCorona(map: CoronaMapInput, physics: CoronaPhysics) {
  const { width, height, lmax } = CORONA_MAP, radial = new Float64Array(width * height);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const value = map.sample((column + 0.5) * 360 / width, 90 - (row + 0.5) * 180 / height);
    if (value === null || !Number.isFinite(value)) throw new Error(`${map.entry.surface}: the map has no value at longitude ${((column + 0.5) * 360 / width).toFixed(0)}, latitude ${(90 - (row + 0.5) * 180 / height).toFixed(0)}.`);
    radial[row * width + column] = value;
  }
  const harmonics = expandSurfaceField({ width, height, radial }, lmax), back = synthesizeSurfaceField(harmonics, width, height);
  let weight = 0, absolute = 0, square = 0, residual = 0;
  for (let row = 0; row < height; row++) { const area = Math.sin((row + 0.5) * Math.PI / height);
    for (let column = 0; column < width; column++) { const i = row * width + column; weight += area; absolute += area * Math.abs(radial[i]!); square += area * radial[i]! ** 2; residual += area * (radial[i]! - back[i]!) ** 2; } }
  const line = neutralLine(harmonics), open = openShare(harmonics, SHEET_CORONA.sourceRadii);
  const corona = sheetCoronaDensity({ neutralDistanceDegrees: line.distanceDegrees, atRest: tabulated(physics.atRest.density), wind: tabulated(physics.wind.density), openShare: open });
  return { ...corona, measured: { meanAbsGauss: absolute / weight, harmonicsResidual: Math.sqrt(residual / square), neutralLineCells: line.cells, skyWithin10DegreesOfLine: line.shareWithin(10),
    openShare: open.shares.map(([radii, share]) => ({ radii, share })), electronsPerCm3OffSheet: [1.2, 2, 3, 4].map(radii => ({ radii, density: corona.offSheet(radii) })),
    sheetOverOffSheetAt2Radii: Math.max(corona.offSheet(2), physics.atRest.density(2)) / corona.offSheet(2) } };
}

type Display = (x: number, y: number, z: number, radii: number) => number;
/** Encode a display field as the RGBA8 grid the slab baker reads; its channel transfer squares the byte back. */
function encodeGrid(display: Display) {
  const { size, halfUnits } = CORONA_GRID, step = 2 * halfUnits / size, rgba = new Uint8Array(size ** 3 * 4);
  let filled = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, z = -halfUnits + (k + 0.5) * step, radii = Math.hypot(x, y, z);
    const value = radii < 1 || radii > halfUnits ? 0 : display(x, y, z, radii);
    if (!(value > 0)) continue;
    filled++;
    const byte = Math.round(255 * Math.sqrt(value)), o = 4 * ((k * size + j) * size + i);
    rgba[o] = byte; rgba[o + 1] = byte; rgba[o + 2] = byte;
  }
  return { ktx2: Buffer.from(encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: rgba }, 9)), filled };
}
/** The grid seen from Earth, as raw RGBA: the display value summed along each line of sight through the exposure, over the
 * star's disc. corona.mts writes it as a PNG. */
export function coronaPreview(display: Display, color: readonly [number, number, number], exposureGain: number, pixels = 192) {
  const { halfUnits } = CORONA_GRID, step = 2 * halfUnits / pixels, dz = 0.04, rgba = Buffer.alloc(pixels * pixels * 4);
  for (let row = 0; row < pixels; row++) for (let column = 0; column < pixels; column++) {
    const x = -halfUnits + (column + 0.5) * step, y = halfUnits - (row + 0.5) * step, impact = Math.hypot(x, y), o = 4 * (row * pixels + column);
    let sum = 0;
    if (impact >= 1) for (let z = -halfUnits; z < halfUnits; z += dz) { const radii = Math.hypot(impact, z + dz / 2); if (radii <= halfUnits) sum += display(x, y, z + dz / 2, radii) * dz; }
    rgba[o] = Math.round(255 * color[0]); rgba[o + 1] = Math.round(255 * color[1]); rgba[o + 2] = Math.round(255 * color[2]);
    rgba[o + 3] = Math.round(255 * (impact < 1 ? 1 : -Math.expm1(-exposureGain * sum)));
  }
  return { rgba, pixels };
}

export interface CoronaFiles { readonly files: PackageFiles; readonly readme: string; readonly previews: readonly { readonly path: string; readonly rgba: Buffer; readonly pixels: number }[]; readonly report: string }

/** Every record of one star's corona bank and the star's own dataset steps. `readme` is written only where the bank has none. */
export function coronaFiles(entry: CoronaEntry, inputs: CoronaInputs): CoronaFiles {
  const { star, checked } = inputs, { bank } = entry, at = `src/objects/${bank}`, s = `${at}/source`, files: PackageFiles = new Map(), physics = coronaPhysics(entry, star);
  if (physics.refused) throw new Error(`${star.name}: ${physics.refused}`);
  const color = [1, 3, 5].map(offset => Number((Number.parseInt(star.colorHex.slice(offset, offset + 2), 16) / 255).toFixed(3))) as [number, number, number];
  const distanceM = Math.hypot(...star.originM), distancePc = distanceM / PARSEC_M, raDeg = (Math.atan2(star.originM[1], star.originM[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(star.originM[2] / distanceM) * 180 / Math.PI;
  const radiusArcsec = star.radiusM / distanceM * 206264.80624709636, exposureGain = coronaExposureGain(), million = (physics.kelvin / 1e6).toFixed(1);
  const temperatureSource: CoronaSource = 'kelvin' in entry.temperature ? entry.temperature : RELATIONS['johnstone-guedel-2015'], massLossSource: CoronaSource = 'solar' in entry.massLoss ? entry.massLoss : RELATIONS['wood-2021'];
  const scatter = (10 ** WOOD_2021.scatterDex).toFixed(0), lowest = (10 ** -WOOD_2021.lowestDex).toFixed(0);
  const temperatureWords = physics.measuredTemperature ? `${million} million kelvin, measured (${temperatureSource.label})` : `${million} million kelvin, not measured: the temperature stars of this X-ray output have (${temperatureSource.label})`;
  const massLossWords = physics.measuredMassLoss ? `${times(physics.massLossSolar)} times the Sun's, measured (${massLossSource.label})`
    : `${times(physics.massLossSolar)} times the Sun's, not measured: what the X-ray output suggests (${massLossSource.label}), uncertain by a factor of ${scatter} or more`;
  /** The three numbers as a reader meets them, each said to be measured or not. */
  const amount = `How much gas there is follows from three numbers. The star's X-ray output is measured (${entry.xray.label}). Its coronal temperature, ${million} million kelvin, is ${physics.measuredTemperature ? `measured (${temperatureSource.label})` : `not measured: it is the temperature stars of this X-ray output have (${temperatureSource.label})`}. `
    + `Its mass loss, ${times(physics.massLossSolar)} times the Sun's, is ${physics.measuredMassLoss ? `measured (${massLossSource.label}).` : `not measured${physics.measuredTemperature ? '' : ' either'}: it is what the X-ray output suggests (${massLossSource.label}). Stars with a measured wind lie within a factor of ${scatter} of that relation, and one is ${lowest} times below it.`}`;
  const frame = `The rotation axis is ${star.inclinationDegrees.toFixed(0)}° from the line of sight, as the map was fitted`, conventions = 'where the axis points on the sky and the star\'s rotation phase today are conventions.';
  const orientation = `${frame}, and the corona is drawn in the same frame as the star's own maps; ${conventions}`;
  const derived = 'No telescope has imaged this corona, and this is not a published result: it is derived here from the star\'s magnetic map by a standard method.';
  /** The test of the method, said where its result is shown (docs/stellar-corona-from-magnetic-maps.md holds the numbers). */
  const tested = 'The method was tested on the one star with a published simulation of its corona, ε Eridani, where its density is within a factor of two of the simulation\'s on average, and on the Sun, whose corona is measured dense along the same line.';

  const datasets = inputs.maps.map(map => {
    const corona = deriveCorona(map, physics), mapCredit = requireString(map.manifestInput.displayCredit ?? map.manifestInput.credit, `${star.id} manifest credit`), mapUrl = requireString(map.manifestInput.sourceUrl, `${star.id} manifest sourceUrl`);
    const display: Display = (x, y, z, radii) => { const [theta, phi] = star.bodyFromGrid(x, y, z); return coronaPeakValue(corona.density(radii, theta, phi), corona.onSheet(radii), radii); };
    return { map, corona, display, mapCredit, mapUrl, id: map.entry.id, label: `Derived corona · ${map.entry.label}`, input: `map-${map.entry.id}`,
      title: `${star.name}’s corona, derived from its magnetic field of ${map.entry.label}`,
      summary: `Derived here, not an image: gas placed by the magnetic field mapped in ${map.entry.label}.`,
      description: `${derived} The map of the star's surface magnetic field from ${map.entry.label} (${mapCredit}) is continued outward as a field with no electric currents, out to ${SHEET_CORONA.sourceRadii} stellar radii, where the wind is taken to pull it straight. Gas at rest fills a sheet about the line where that field reverses, as the Sun's bright streamers do; the wind fills the rest. ${amount} It is shown the way coronagraph pictures are: at each distance from the star brightness is proportional to the density there, and only the steep fall-off with distance is compressed. ${tested} ${orientation}`,
      detail: `${CORONA_GRID.size}³ grid, 1 to ${CORONA_GRID.halfUnits} stellar radii`,
      facts: [
        { id: 'kind', label: 'Kind', value: 'Derived here from an observed magnetic map; not an observation and not a published result' },
        { id: 'map', label: 'Magnetic map', value: `${map.entry.label}, mean strength ${corona.measured.meanAbsGauss.toFixed(1)} gauss (${mapCredit})` },
        { id: 'xray', label: 'X-ray output', value: `${sci(physics.xrayLuminosityErgS)} erg per second, ${entry.xray.band} (${entry.xray.label})` },
        { id: 'temperature', label: 'Temperature', value: temperatureWords[0]!.toUpperCase() + temperatureWords.slice(1) },
        { id: 'mass-loss', label: 'Mass loss', value: massLossWords[0]!.toUpperCase() + massLossWords.slice(1) },
        { id: 'density', label: 'Density at 2 radii', value: `${sci(corona.offSheet(2))} electrons per cm³ away from the sheet, ${times(corona.measured.sheetOverOffSheetAt2Radii)} times that on it` },
        { id: 'orientation', label: 'Orientation', value: `Rotation axis ${star.inclinationDegrees.toFixed(0)}° from the line of sight, as the map was fitted; its direction on the sky and the rotation phase are conventions` },
        { id: 'filter', label: 'Brightness', value: `Proportional to density at each distance; the gas on the sheet is fully bright. The fall-off with distance is compressed (log₁₀ density, ${sci(CORONA_DISPLAY.densityRangePerCm3[0])} to ${sci(CORONA_DISPLAY.densityRangePerCm3[1])} cm⁻³)` },
      ] };
  });
  const defaultDataset = datasets.at(-1)!.id, previews: CoronaFiles['previews'][number][] = [], built: string[] = [];
  for (const dataset of datasets) {
    const grid = encodeGrid(dataset.display); built.push(`${dataset.id} ${grid.filled} voxels`);
    files.set(`${s}/density-${dataset.id}.ktx2`, grid.ktx2);
    files.set(`${s}/volume-${dataset.id}.json`, json({ schema: VOLUME_RECIPE_SCHEMA,
      grid: { path: `density-${dataset.id}.ktx2`, dimensions: [CORONA_GRID.size, CORONA_GRID.size, CORONA_GRID.size], encoding: 'sqrt-density-unorm8',
        bounds: { min: [-CORONA_GRID.halfUnits, -CORONA_GRID.halfUnits, -CORONA_GRID.halfUnits], max: [CORONA_GRID.halfUnits, CORONA_GRID.halfUnits, CORONA_GRID.halfUnits] } },
      material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', emission: [{ channel: 0, color, strength: 1 }], absorption: [], emissionTransfer: 'shared-opacity', exposureGain },
      bake: { sliceCounts: { x: CORONA_GRID.slabs, y: CORONA_GRID.slabs, z: CORONA_GRID.slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4, cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
      anchors: [{ id: star.id, referencePositionM: [0, 0, 0] }], provenance: { path: 'provenance.json' } }));
    previews.push({ path: `${s}/previews/${dataset.id}.png`, ...coronaPreview(dataset.display, color, exposureGain) });
  }

  const sources = [entry.xray, temperatureSource, massLossSource].filter((source, index, all) => all.findIndex(one => one.catalogueId === source.catalogueId) === index);
  const measured = { star: { id: star.id, massSolar: star.massSolar, radiusSolar: star.radiusSolar, radiusArcsec, distancePc, sceneOriginRaDecDeg: [raDeg, decDeg], inclinationDegrees: star.inclinationDegrees },
    xray: { fluxErgCm2S: entry.xray.fluxErgCm2S, band: entry.xray.band, luminosityErgS: physics.xrayLuminosityErgS, surfaceFluxErgCm2S: physics.surfaceFlux },
    temperature: { kelvin: physics.kelvin, measured: physics.measuredTemperature }, massLoss: { solar: physics.massLossSolar, measured: physics.measuredMassLoss, solarMassLossSolarMassesPerYear: WOOD_2021.solarMassLossSolarMassesPerYear },
    wind: { soundKmS: physics.wind.soundKmS, criticalRadii: physics.wind.criticalRadii, speedAtSurfaceKmS: physics.wind.speedKmS(1), speedAt4RadiiKmS: physics.wind.speedKmS(4) },
    atRest: { scaleHeightRadii: physics.atRest.scaleHeightRadii, basePerCm3: physics.atRest.basePerCm3, emissionMeasureCm3: physics.atRest.emissionMeasure },
    method: { ...SHEET_CORONA, harmonicDegree: CORONA_MAP.lmax, mapCells: [CORONA_MAP.width, CORONA_MAP.height] },
    maps: Object.fromEntries(datasets.map(dataset => [dataset.id, { label: dataset.map.entry.label, surface: dataset.map.entry.surface, ...dataset.corona.measured }])),
    display: { ...CORONA_DISPLAY, color, exposureGain } };
  files.set(`${s}/provenance.json`, json({ schema: VOLUME_PROVENANCE_SCHEMA, title: `${star.name} corona: derived from ${datasets.length === 1 ? 'an observed magnetic map' : `${datasets.length} observed magnetic maps`} of the star`,
    kind: 'derived-from-an-observed-magnetic-map-through-a-stated-model', authors: [...new Set(datasets.map(dataset => requireString(dataset.map.manifestInput.credit, `${star.id} manifest credit`)))],
    organizations: ['cssEarth (the derivation)'], license: { spdx: 'CC-BY-4.0', note: `The grids are computed here. The magnetic maps keep their own terms (${requireString(datasets[0]!.map.manifestInput.license, `${star.id} manifest license`)}); the other inputs are published numbers cited under normal scholarly citation.` },
    sources: [...datasets.map(dataset => ({ id: dataset.input, url: dataset.mapUrl, role: `The magnetic map of ${dataset.map.entry.label}: ${requireString(dataset.map.manifestInput.title, `${star.id} manifest title`)}` })),
      ...sources.map(source => ({ id: source.catalogueId, url: source.url, role: `${source.label}: ${source.locator}` })), ...METHOD],
    paper: { citation: 'No paper: the derivation is this repository\'s, by the method of docs/stellar-corona-from-magnetic-maps.md.' }, measured, models: Object.fromEntries(datasets.map(dataset => [dataset.id, dataset.description])),
    limitations: ['No telescope has imaged this corona, and no paper publishes this result: every grid is derived here.',
      'The field has no electric currents and is taken radial from the source surface outward; the place of the dense sheet follows from the map, and against the published simulation of ε Eridani the derived density is within a factor of two on average.',
      'The amount of gas is set by one X-ray flux, one temperature and one mass loss for the whole star.' + (physics.measuredMassLoss ? '' : ' The mass loss is not measured for this star; it sets how bright the gas away from the sheet is drawn.'),
      'A magnetic map resolves only the large-scale field, and misses the hemisphere the star never turns toward us.',
      'The position angle of the rotation axis on the sky and the rotation phase are conventions, not measurements.', 'The star\'s spin is left out of the gas balance.',
      'The radial filter, the logarithmic scale, the two radial fades and the exposure are display choices.'] }));

  const description = `${star.name}’s corona, derived here from ${datasets.length === 1 ? 'an observed map' : `${datasets.length} observed maps`} of the star’s surface magnetic field and its X-ray output. One unit is one stellar radius. It is not an observation and not a published result.`;
  const recipeOf = (id: string) => ({ path: `${s}/volume-${id}.json` });
  files.set(`${s}/delivery.json`, json({ schema: NEBULA_DELIVERY_SCHEMA, id: bank, method: 'density-grid', request: recipeOf(defaultDataset),
    inputPins: [{ path: `${s}/provenance.json` }, ...datasets.map(dataset => ({ path: `${s}/density-${dataset.id}.ktx2` }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc, imageRotationDegrees: 0, arcsecPerUnit: radiusArcsec }, sourceUrl: datasets.at(-1)!.mapUrl, description, defaultDataset, framingRadiusUnits: CORONA_GRID.halfUnits,
    // The corona belongs to the star. It is not a place of its own; its datasets are listed by the star.
    attachedTo: star.id, acceptedLabResult: `${bank}-density-grids`, compactInputs: recipeOf(defaultDataset), compactMethod: 'density-grid',
    grids: datasets.map(dataset => ({ id: dataset.id, label: dataset.label, sourceUrl: dataset.mapUrl, recipe: recipeOf(dataset.id) })) }));
  files.set(`${s}/presentation.json`, json({ schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, objectId: bank, name: `${star.name} corona`, defaultDataset, bank: { path: `${at}/prepared/datasets.json` },
    recipes: datasets.map(dataset => ({ id: dataset.id, path: `${s}/volume-${dataset.id}.json` })), sharedInputs: [], inputEvidence: [],
    datasets: datasets.map(dataset => ({ id: dataset.id, label: dataset.label, title: dataset.title, description: dataset.description, summary: dataset.summary, detail: dataset.detail, facts: dataset.facts, input: dataset.input,
      preview: { path: `${s}/previews/${dataset.id}.png`, authoredFrom: dataset.input } })) }));
  files.set(`${s}/corona-parameters.json`, json({ schema: PUBLISHED_MODEL_PARAMETERS_SCHEMA, objectId: bank, citation: sources.map(source => `${source.label}: ${source.locator}`).join('; '), ...measured,
    notes: `The published numbers this corona's amount of gas follows from, and what ${CORONA_GENERATOR} computes from them and from the star's magnetic maps.` }));

  // The manifest: each dataset's map, as the star's own manifest records it, and the published numbers.
  const local = (reason: string) => ({ kind: 'local', reason });
  const bound: Json[] = datasets.map(dataset => { const from = dataset.map.manifestInput;
    return { id: dataset.input, dependencies: [], sourceBinding: from.sourceBinding, path: `src/objects/${star.id}/source/${requireString(from.path, `${star.id} manifest path`)}`, origin: from.origin, sourceUrl: from.sourceUrl, title: from.title, credit: from.credit, displayCredit: from.displayCredit,
      acquisition: `The file the ${star.id} package holds for its own dataset ${dataset.map.entry.surface}; ${requireString(from.acquisition, `${star.id} manifest acquisition`)}`, license: from.license, datasetId: dataset.id }; });
  bound.push({ id: 'corona-parameters', dependencies: [], sourceBinding: { kind: 'catalogued', references: sources.map(source => ({ catalogueId: source.catalogueId, role: 'material', evidence: source.url })) },
    path: `${s}/corona-parameters.json`, origin: entry.xray.url, sourceUrl: entry.xray.url, title: `${star.name} · X-ray flux, coronal temperature and mass loss`, credit: sources.map(source => source.label).join('; '), displayCredit: entry.xray.label,
    acquisition: 'Published numbers transcribed from their sources, and the quantities this package computes from them. This record identifies the transcription; the sources are the origin.', license: 'Published numbers cited under normal scholarly citation; the sources are not redistributed here.' });
  files.set(`${s}/manifest.json`, json({ schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs: bound,
    documents: ['delivery.json', 'presentation.json', 'provenance.json'].map(name => ({ id: name.replace(/[^a-z0-9-]+/gu, '-'), path: `${s}/${name}`, sourceBinding: local('Object-owned delivery, provenance or presentation record; the inputs it cites are bound above.') })),
    generatedIntermediates: datasets.flatMap(dataset => [`density-${dataset.id}.ktx2`, `volume-${dataset.id}.json`, `previews/${dataset.id}.png`]).map(name => ({ id: name.replace(/[^a-z0-9-]+/gu, '-'), path: `${s}/${name}`, generator: CORONA_GENERATOR,
      sourceBinding: local(`Density grid, slab recipe or preview written by ${CORONA_GENERATOR} from the inputs bound above.`) })) }));
  files.set(`${at}/object.json`, json({ schema: OBJECT_SCHEMA, id: bank, type: 'volume-dataset-bank', properties: { preparation: { source: 'source/delivery.json' }, host: star.id }, prepared: { format: PREPARED_VOLUME_DATASET_INDEX_SCHEMA, url: 'prepared/datasets.json' } }));
  const first = datasets[0]!.corona.measured, last = datasets.at(-1)!.corona.measured;
  files.set(`${at}/investigations.json`, json({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId: bank, entries: [
    { id: 'derived-corona', subject: `${star.name}: a corona derived from ${datasets.length === 1 ? 'its magnetic map' : `its ${datasets.length} magnetic maps`}`, status: 'included',
      finding: `The potential field of each map to degree ${CORONA_MAP.lmax}, with its source surface at ${SHEET_CORONA.sourceRadii} radii, reproduces the map with an rms residual of ${(100 * Math.min(first.harmonicsResidual, last.harmonicsResidual)).toFixed(0)}% to ${(100 * Math.max(...datasets.map(dataset => dataset.corona.measured.harmonicsResidual))).toFixed(0)}%. X-ray luminosity ${sci(physics.xrayLuminosityErgS)} erg/s (${entry.xray.locator}); temperature ${temperatureWords}; mass loss ${massLossWords}. The wind passes the speed of sound ${physics.wind.criticalRadii.toFixed(2)} radii out.`,
      evidence: [...new Set([...datasets.map(dataset => dataset.mapUrl), ...sources.map(source => source.url)])] }, ...entry.ledger] }));

  // The star's page: one dataset for the corona, with a step for each map.
  const content = structuredClone(inputs.host.content), shown = requireRecord(content.datasets, `${star.id} content datasets`), controls = requireArray(shown.controls, `${star.id} dataset controls`).map(control => requireRecord(control, `${star.id} dataset control`));
  const group = 'derived-corona', opening = requireString(shown.defaultDataset, `${star.id} default dataset`), thumbnail = controls.find(control => control.id === opening)?.thumbnail ?? `${star.id}-dataset-${opening}.webp`;
  shown.controls = [...controls.filter(control => !(isRecord(control.volume) && control.volume.objectId === bank)), ...datasets.map(dataset => ({ id: `corona-${dataset.id}`, label: 'Derived corona', thumbnail, volume: { objectId: bank, datasetId: dataset.id, surface: opening },
    notes: `${derived} Gas at rest is placed along the line where the field of the ${dataset.map.entry.label} map reverses, and the wind everywhere else. ${amount} Drawn out to ${CORONA_GRID.halfUnits} stellar radii in the star's own color; at each distance brightness is proportional to density.`,
    ...(datasets.length > 1 ? { step: { group, label: dataset.map.entry.label, autoplay: false, opens: 'last' } } : {}) }))];
  files.set(`src/objects/${star.id}/source/content/object.json`, json(content));
  const text = structuredClone(inputs.host.text), texts = requireRecord(text.datasets, `${star.id} text datasets`);
  for (const key of Object.keys(texts)) if (key.startsWith('corona-') && !datasets.some(dataset => `corona-${dataset.id}` === key)) delete texts[key];
  for (const dataset of datasets) { const key = `corona-${dataset.id}`, before = texts[key], cited = isRecord(before) && Array.isArray(before.sources) ? before.sources.filter(isRecord) : [];
    const read = (source: { catalogueId: string; url: string; label: string }) => { const day = cited.find(one => one.catalogueId === source.catalogueId && one.url === source.url && one.label === source.label)?.checked; return typeof day === 'string' ? day : undefined; };
    const reference = requireArray(requireRecord(dataset.map.manifestInput.sourceBinding, `${star.id} map binding`).references, `${star.id} map binding references`).map(reference => requireRecord(reference, `${star.id} map binding reference`))[0]!;
    const mapSource = { catalogueId: requireString(reference.catalogueId, `${star.id} map catalogue id`), url: dataset.mapUrl, label: `${dataset.mapCredit}: the magnetic map` };
    texts[key] = { title: `Derived corona, ${dataset.map.entry.label}`, detail: 'Derived, not an image', summary: `Derived here from the field mapped in ${dataset.map.entry.label}. Brightness follows density at each distance.`,
      sources: [mapSource, ...sources.map(source => ({ catalogueId: source.catalogueId, url: source.url, label: source.label, ...(source.checked ? { checked: source.checked } : {}) }))].map(source => ({ catalogueId: source.catalogueId, url: source.url, label: source.label, checked: ('checked' in source ? source.checked : undefined) ?? read(source) ?? checked })) }; }
  files.set(`src/objects/${star.id}/text.json`, json(text));

  const table = datasets.map(dataset => { const m = dataset.corona.measured; return `| ${dataset.map.entry.label} | ${m.meanAbsGauss.toFixed(1)} | ${(100 * m.harmonicsResidual).toFixed(0)}% | ${m.openShare.map(one => one.share.toFixed(2)).join(', ')} | ${(100 * m.skyWithin10DegreesOfLine).toFixed(0)}% |`; }).join('\n');
  const readme = `# ${star.name} corona\n\nThis package draws the corona of [${star.name}](../${star.id}/README.md) as prepared volumes attached to the star. No telescope has imaged this corona, and no paper publishes what is drawn: each grid is derived here from one of the star's observed magnetic maps, by the method of [the shared note](../../../docs/stellar-corona-from-magnetic-maps.md). The star lists it as "Derived corona"${datasets.length > 1 ? `, with one step for each of ${datasets.length} maps` : ''}.\n\n## Sources\n\n` +
    `- **Magnetic ${datasets.length > 1 ? 'maps' : 'map'}:** ${[...new Set(datasets.map(dataset => `${requireString(dataset.map.manifestInput.credit, 'credit')} ([source](${dataset.mapUrl}))`))].join('; ')}: the radial field the star's own package draws, read from the same files.\n` +
    `- **X-ray output:** ${entry.xray.label} ([source](${entry.xray.url})), ${entry.xray.locator}: ${sci(entry.xray.fluxErgCm2S)} erg s⁻¹ cm⁻² at Earth in ${entry.xray.band}, which at ${distancePc.toFixed(2)} pc is ${sci(physics.xrayLuminosityErgS)} erg s⁻¹, or ${sci(physics.surfaceFlux)} erg s⁻¹ from each cm² of the surface.\n` +
    `- **Temperature:** ${temperatureWords} ([source](${temperatureSource.url}), ${temperatureSource.locator}).\n- **Mass loss:** ${massLossWords} ([source](${massLossSource.url}), ${massLossSource.locator}).\n` +
    `- **Mass and radius:** ${star.massSolar.toFixed(2)} solar masses and ${star.radiusSolar.toFixed(2)} solar radii, the values [the star's package](../${star.id}/README.md) cites.\n- **Recipe:** \`telescope new-object\` with a \`coronae\` entry ([\`corona-bank.mts\`](../../../${CORONA_GENERATOR})) writes everything in \`source/\`; the numbers it used are in \`source/corona-parameters.json\`.\n\n` +
    `**Every grid is a density in three dimensions.** Each voxel takes the density at its own place about the star. Nothing is a sky image given depth.\n\n## What the maps give\n\n| Map | Mean field (gauss) | Left out by the harmonics | Open share of the sphere at ${first.openShare.map(one => one.radii).join(', ')} radii | Sky within 10° of the reversal line |\n| --- | --- | --- | --- | --- |\n${table}\n\n` +
    `The wind leaves the surface at ${physics.wind.speedKmS(1).toFixed(0)} km/s and passes the speed of sound ${physics.wind.criticalRadii.toFixed(2)} radii out. Gas at rest has ${sci(physics.atRest.basePerCm3)} electrons per cm³ at the surface and falls by e every ${physics.atRest.scaleHeightRadii.toFixed(2)} radii at first.\n\n` +
    `**Orientation.** ${frame}, in the frame the star's own maps are drawn in (\`${star.rotationRecord}\`); ${conventions}\n\n## Known problems\n\n- It is a derivation, not a measurement or a published model. Against the one star with a published simulation, ε Eridani, the method's density is within a factor of two on average ([the shared note](../../../docs/stellar-corona-from-magnetic-maps.md)).\n` +
    (physics.measuredMassLoss ? '' : `- The mass loss is not measured. It sets how bright the gas away from the sheet is drawn, not where the sheet is.\n`) + (physics.measuredTemperature ? '' : `- The temperature is not measured; it is the one the X-ray output suggests.\n`) +
    `- A magnetic map shows only the large-scale field and misses the part of the star that never turns toward us.\n- The direction of the rotation axis on the sky and the rotation phase are conventions.\n`;
  return { files, readme, previews, report: `${datasets.length} map(s); L_X ${sci(physics.xrayLuminosityErgS)} erg/s, ${million} MK${physics.measuredTemperature ? '' : ' (relation)'}, mass loss ${times(physics.massLossSolar)} solar${physics.measuredMassLoss ? '' : ' (relation)'}, sonic point ${physics.wind.criticalRadii.toFixed(2)} R; ${built.join(', ')}` };
}
