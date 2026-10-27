/** Conservative IR-only PSF subtraction before common-beam smoothing. No density is edited here. */
import { readFile } from 'node:fs/promises';
import type { SkyProjection } from '@cssearth/fits';
import { PC, type Inputs, type Star } from '../physics/types.mts';
import type { IrBand, BandName } from './types.mts';

interface Grid { width: number; height: number; projection: SkyProjection; pixelArcsec: number }
interface BandFlux { accepted: boolean; fluxJy: number | null; sigmaJy: number | null }
interface Point { name: string; ra: number; dec: number; W3: BandFlux; W4: BandFlux }
interface Primary { hip: number; names: string[]; ra: number; dec: number }
interface Catalogue { points: Point[]; primaries: Primary[] }
interface ResponseRow { wave: number; qe: number }
interface PsfBudget { requestedFluxJy: number; subtractedFluxJy: number; outsideGridFluxJy: number; unavailableFluxJy: number; reservedCoreFluxJy: number; modifiedPixels: number }
const CATALOGUE = 'src/objects/milky-way-pleiades-dust/source/inputs/wise-points.json';
const PSF: Record<BandName, number> = { WISE3: 9.5, WISE4: 16.8, MIPS24: 6, MIPS70: 18 };
const RESERVATION_ARCSEC = 36, SOLAR_RADIUS_M = 6.957e8;
const LN2_8_SQRT = Math.sqrt(8 * Math.LN2), ARCSEC_RAD = Math.PI / (180 * 3600);
let cataloguePromise: Promise<Catalogue> | undefined;
const responseCache = new Map<string, Promise<ResponseRow[]>>();
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function number(value: unknown, name: string): number { if (!finite(value)) throw Error(`Invalid ${name}`); return value; }
function array(value: unknown, name: string): unknown[] { if (!Array.isArray(value)) throw Error(`Invalid ${name}`); return value; }
function position(value: Record<string, unknown>): { ra: number; dec: number } {
  const ra = number(value.ra, 'RA'), dec = number(value.dec, 'declination');
  if (ra < 0 || ra >= 360 || Math.abs(dec) > 90) throw Error('Point outside celestial coordinate range.'); return { ra, dec };
}
function parseFlux(value: unknown): BandFlux {
  if (!record(value) || typeof value.accepted !== 'boolean') throw Error('Invalid qualified band record.');
  if (!value.accepted) return { accepted: false, fluxJy: null, sigmaJy: null };
  const fluxJy = number(value.fluxJy, 'accepted flux'), sigmaJy = number(value.sigmaFluxJy, 'accepted flux uncertainty');
  if (!(fluxJy > 0) || sigmaJy < 0) throw Error('Accepted source flux/error has an invalid sign.');
  return { accepted: true, fluxJy, sigmaJy };
}
async function readCatalogue(): Promise<Catalogue> {
  const raw: unknown = JSON.parse(await readFile(CATALOGUE, 'utf8')); if (!record(raw)) throw Error('Invalid compact-source catalogue.');
  const points = array(raw.points, 'points').map(value => {
    if (!record(value) || typeof value.designation !== 'string' || value.ext_flg !== 0) throw Error('Point catalogue is not the qualified ext_flg=0 selection.');
    return { name: value.designation, ...position(value), W3: parseFlux(value.W3), W4: parseFlux(value.W4) };
  });
  const primaries = array(raw.primaryStars, 'primary systems').map(value => {
    if (!record(value)) throw Error('Invalid primary star.');
    const hip = number(value.hip, 'HIP'), names = array(value.names, 'primary names').map(name => { if (typeof name !== 'string') throw Error('Invalid primary name.'); return name; });
    if (!Number.isSafeInteger(hip) || hip <= 0 || !names.length) throw Error('Invalid primary identity.'); return { hip, names, ...position(value) };
  });
  if (primaries.length !== 7 || new Set(primaries.map(primary => primary.hip)).size !== 7) throw Error('Seven unique primary systems are required.');
  return { points, primaries };
}
function validateBand(band: IrBand, grid: Grid): void {
  if (!Number.isSafeInteger(grid.width) || !Number.isSafeInteger(grid.height) || grid.width < 1 || grid.height < 1 || !finite(grid.pixelArcsec) || grid.pixelArcsec <= 0 || grid.width * grid.height > 30_000_000) throw Error('Invalid compact-clean grid.');
  const n = grid.width * grid.height;
  if (!(band.data instanceof Float32Array) || !(band.variance instanceof Float32Array) || !(band.validity instanceof Uint8Array) || band.data.length !== n || band.variance.length !== n || band.validity.length !== n || !(band.name in PSF)) throw Error('IR band arrays/name do not match the grid.');
  for (let p = 0; p < n; p++) if (band.validity[p] && (!Number.isFinite(band.data[p]) || !Number.isFinite(band.variance[p]) || band.variance[p]! < 0)) throw Error('A valid IR observation has nonfinite data/variance.');
}

/** Abramowitz-Stegun erf approximation; pixel-integrated Gaussians, not center-sampled peaks. */
function erf(value: number): number {
  const sign = value < 0 ? -1 : 1, x = Math.abs(value), t = 1 / (1 + .3275911 * x);
  const polynomial = (((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592;
  return sign * (1 - polynomial * t * Math.exp(-x * x));
}
function integratedKernel(center: number, sigmaPixel: number): { first: number; weights: number[] } {
  const first = Math.floor(center - 6 * sigmaPixel - .5), last = Math.ceil(center + 6 * sigmaPixel + .5), root2Sigma = Math.SQRT2 * sigmaPixel;
  const weights: number[] = [];
  for (let pixel = first; pixel <= last; pixel++) weights.push(Math.max(0, .5 * (erf((pixel + .5 - center) / root2Sigma) - erf((pixel - .5 - center) / root2Sigma))));
  const sum = weights.reduce((a, b) => a + b, 0); if (!(sum > 0)) throw Error('Empty Gaussian kernel.');
  return { first, weights: weights.map(weight => weight / sum) };
}
function subtractPsf(band: IrBand, width: number, height: number, pixelArcsec: number, x: number, y: number, fwhmArcsec: number, fluxJy: number, sigmaFluxJy: number, reserved?: Uint8Array): PsfBudget {
  if (![x, y, fluxJy, sigmaFluxJy, fwhmArcsec].every(Number.isFinite) || fluxJy < 0 || sigmaFluxJy < 0 || fwhmArcsec <= 0) throw Error('Invalid Gaussian point model.');
  const budget: PsfBudget = { requestedFluxJy: fluxJy, subtractedFluxJy: 0, outsideGridFluxJy: 0, unavailableFluxJy: 0, reservedCoreFluxJy: 0, modifiedPixels: 0 };
  const sigmaPixel = fwhmArcsec / LN2_8_SQRT / pixelArcsec, kernelX = integratedKernel(x, sigmaPixel), kernelY = integratedKernel(y, sigmaPixel);
  const jyToMJySrPixel = 1 / ((pixelArcsec * ARCSEC_RAD) ** 2 * 1e6);
  // Normalize against the full kernel, including pixels outside the image. Edge sources never gain flux.
  for (let j = 0; j < kernelY.weights.length; j++) for (let i = 0; i < kernelX.weights.length; i++) {
    const px = kernelX.first + i, py = kernelY.first + j, weight = kernelX.weights[i]! * kernelY.weights[j]!, partJy = fluxJy * weight;
    if (px < 0 || py < 0 || px >= width || py >= height) { budget.outsideGridFluxJy += partJy; continue; }
    const p = py * width + px;
    if (reserved?.[p]) { budget.reservedCoreFluxJy += partJy; continue; }
    if (!band.validity[p]) { budget.unavailableFluxJy += partJy; continue; }
    const amplitude = weight * jyToMJySrPixel;
    band.data[p] = band.data[p]! - fluxJy * amplitude;
    band.variance[p] = band.variance[p]! + (sigmaFluxJy * amplitude) ** 2;
    budget.subtractedFluxJy += partJy; if (weight > 0) budget.modifiedPixels++;
  }
  return budget;
}
async function responseRows(band: 'WISE3' | 'WISE4'): Promise<ResponseRow[]> {
  let pending = responseCache.get(band);
  if (!pending) {
    pending = (async () => {
      const rows: ResponseRow[] = [], text = await readFile(`.local/infrared/heating/raw/RSR-W${band === 'WISE3' ? 3 : 4}.txt`, 'utf8');
      for (const line of text.split(/\r?\n/u)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const fields = line.trim().split(/\s+/u), wave = Number(fields[0]), qe = Number(fields[1]);
        if (!Number.isFinite(wave) || wave <= 0 || !Number.isFinite(qe) || qe < 0) throw Error('Invalid local WISE photon response.'); rows.push({ wave, qe });
      }
      rows.sort((a, b) => a.wave - b.wave);
      if (rows.length < 20 || rows.some((row, i) => i > 0 && row.wave <= rows[i - 1]!.wave)) throw Error('WISE response is too short or nonmonotone.'); return rows;
    })(); responseCache.set(band, pending);
  }
  return pending;
}
function photosphereJy(star: Star, wavelengthMicron: number): number {
  const distanceM = Math.hypot(star.at[0], star.at[1], 136 + star.at[2]) * PC, radiusM = star.radiusSolar * SOLAR_RADIUS_M;
  if (!(star.temperatureK > 0) || !(radiusM > 0) || !(distanceM > 0) || ![star.temperatureK, radiusM, distanceM].every(Number.isFinite)) throw Error('Invalid independent primary photosphere inputs.');
  const h = 6.62607015e-34, c = 299792458, k = 1.380649e-23, nu = c / (wavelengthMicron * 1e-6);
  return Math.PI * 2 * h * nu ** 3 / c ** 2 / Math.expm1(h * nu / (k * star.temperatureK)) * (radiusM / distanceM) ** 2 / 1e-26;
}
async function primaryFluxJy(star: Star, band: BandName): Promise<number> {
  if (band === 'MIPS24' || band === 'MIPS70') return photosphereJy(star, band === 'MIPS24' ? 23.68 : 71.42);
  const response = await responseRows(band); let numerator = 0, denominator = 0;
  for (let i = 1; i < response.length; i++) {
    const a = response[i - 1]!, b = response[i]!, dx = b.wave - a.wave, wa = a.qe / a.wave, wb = b.qe / b.wave;
    numerator += .5 * dx * (wa * photosphereJy(star, a.wave) + wb * photosphereJy(star, b.wave)); denominator += .5 * dx * (wa + wb);
  }
  if (!(denominator > 0)) throw Error('Zero WISE photon response.'); return numerator / denominator;
}
function genericFlux(point: Point, band: BandName): { fluxJy: number; sigmaJy: number; method: string; spectralIndex?: number } | undefined {
  if (band === 'MIPS70') return undefined;
  if (band === 'WISE3' || band === 'WISE4') {
    const value = band === 'WISE3' ? point.W3 : point.W4;
    return value.accepted && value.fluxJy !== null && value.sigmaJy !== null ? { fluxJy: value.fluxJy, sigmaJy: value.sigmaJy, method: 'qualified constant-Fnu catalogue flux' } : undefined;
  }
  if (!point.W4.accepted || point.W4.fluxJy === null || point.W4.sigmaJy === null) return undefined;
  const f4 = point.W4.fluxJy, e4 = point.W4.sigmaJy, frequencyRatio = 22.08 / 23.68;
  if (point.W3.accepted && point.W3.fluxJy !== null && point.W3.sigmaJy !== null) {
    const f3 = point.W3.fluxJy, e3 = point.W3.sigmaJy, denominator = Math.log(22.08 / 11.56), spectralIndex = Math.log(f3 / f4) / denominator, t = Math.log(frequencyRatio) / denominator;
    const fluxJy = f4 * frequencyRatio ** spectralIndex;
    return { fluxJy, sigmaJy: fluxJy * Math.sqrt((t * e3 / f3) ** 2 + ((1 - t) * e4 / f4) ** 2 + .15 ** 2), spectralIndex, method: 'accepted W3/W4 Fnu power-law extrapolation22.08to23.68um; adopted15% SED uncertainty' };
  }
  const fluxJy = f4 * frequencyRatio ** 2;
  return { fluxJy, sigmaJy: Math.hypot(e4 * frequencyRatio ** 2, .3 * fluxJy), spectralIndex: 2, method: 'W4-only Rayleigh-Jeans extrapolation; adopted30% SED uncertainty' };
}

export async function cleanBand(band: IrBand, grid: Grid, inputs: Inputs): Promise<Record<string, unknown>> {
  validateBand(band, grid); cataloguePromise ??= readCatalogue(); const catalogue = await cataloguePromise;
  const inputGroups = new Map<number, Star[]>();
  for (const star of inputs.stars) { const list = inputGroups.get(star.hip) ?? []; list.push(star); inputGroups.set(star.hip, list); }
  if (inputGroups.size !== 7 || catalogue.primaries.some(star => !inputGroups.has(star.hip))) throw Error('Physical stars and seven reserved catalogue systems differ.');
  const n = grid.width * grid.height, reserved = new Uint8Array(n), primaryCenters = catalogue.primaries.map(star => ({ star, point: grid.projection.pixelOf(star.ra, star.dec) }));
  let newlyUnavailablePixels = 0, reservedPixels = 0, beforeValid = 0;
  for (const value of band.validity) if (value) beforeValid++;
  const radiusPixel = RESERVATION_ARCSEC / grid.pixelArcsec;
  for (const { point } of primaryCenters) {
    if (!point) continue;
    const [x, y] = point;
    for (let py = Math.max(0, Math.ceil(y - radiusPixel)); py <= Math.min(grid.height - 1, Math.floor(y + radiusPixel)); py++) for (let px = Math.max(0, Math.ceil(x - radiusPixel)); px <= Math.min(grid.width - 1, Math.floor(x + radiusPixel)); px++) {
      if (Math.hypot(px - x, py - y) > radiusPixel) continue;
      const p = py * grid.width + px;
      if (!reserved[p]) { reserved[p] = 1; reservedPixels++; if (band.validity[p]) newlyUnavailablePixels++; }
      band.validity[p] = 0; band.variance[p] = Infinity; // Keep observed data values; missing measurements are not zero dust.
    }
  }
  const removals: Record<string, unknown>[] = [], primaryRemovals: Record<string, unknown>[] = [];
  let skippedNoAcceptedBand = 0, skippedOutsideProjection = 0, spectralIndexExtrapolations = 0, rayleighJeansExtrapolations = 0;
  for (const source of catalogue.points) {
    const flux = genericFlux(source, band.name);
    if (!flux) { skippedNoAcceptedBand++; continue; }
    const p = grid.projection.pixelOf(source.ra, source.dec);
    if (!p) { skippedOutsideProjection++; continue; }
    const budget = subtractPsf(band, grid.width, grid.height, grid.pixelArcsec, p[0], p[1], PSF[band.name], flux.fluxJy, flux.sigmaJy, reserved);
    if (band.name === 'MIPS24') { if (source.W3.accepted) spectralIndexExtrapolations++; else rayleighJeansExtrapolations++; }
    removals.push({ designation: source.name, ra: source.ra, dec: source.dec, ...flux, ...budget });
  }
  for (const { star, point } of primaryCenters) {
    const components = inputGroups.get(star.hip)!;
    const componentFluxes = await Promise.all(components.map(component => primaryFluxJy(component, band.name))), fluxJy = componentFluxes.reduce((a, b) => a + b, 0), sigmaJy = .5 * fluxJy;
    const budget = point ? subtractPsf(band, grid.width, grid.height, grid.pixelArcsec, point[0], point[1], PSF[band.name], fluxJy, sigmaJy, reserved) : undefined;
    primaryRemovals.push({ hip: star.hip, names: components.map(component => component.name), components: components.map((component, i) => ({ name: component.name, temperatureK: component.temperatureK, radiusSolar: component.radiusSolar, fluxJy: componentFluxes[i] })),
      fluxJy, sigmaJy, method: band.name.startsWith('WISE') ? 'independent T/R blackbodies integrated through local QE RSR; flat-Fnu equivalent' : 'independent T/R monochromatic photospheres; no MIPS color correction',
      adoptedFractionalPhotosphereUncertainty: .5, reservationRadiusArcsec: RESERVATION_ARCSEC, ...budget });
  }
  const totalFlux = removals.reduce((sum, entry) => sum + number(entry.subtractedFluxJy, 'subtracted flux'), 0), primaryWingFlux = primaryRemovals.reduce((sum, entry) => sum + (finite(entry.subtractedFluxJy) ? entry.subtractedFluxJy : 0), 0);
  return { success: true, band: band.name, operation: 'IR-only fixed unit-integral Gaussian point subtraction; no local flux/shape fitting', sourceCatalogue: CATALOGUE,
    grid: { width: grid.width, height: grid.height, pixelArcsec: grid.pixelArcsec }, sourcePsfFwhmArcsec: PSF[band.name], beforeCommon18ArcsecBlur: true,
    genericSources: { modeled: removals.length, withObservedSubtraction: removals.filter(entry => number(entry.subtractedFluxJy, 'subtracted flux') > 0).length, skippedNoAcceptedBand, skippedOutsideProjection, subtractedFluxJy: totalFlux, spectralIndexExtrapolations, rayleighJeansExtrapolations },
    primarySystems: { count: primaryRemovals.length, sourceComponents: inputs.stars.length, wingFluxJySubtracted: primaryWingFlux, independentPhysicalFluxes: true, AtlasUnresolvedComponentsSummedOnce: true },
    missingObservations: { reservationRadiusArcsec: RESERVATION_ARCSEC, reservedPixels, newlyUnavailablePixels, areaArcsec2: reservedPixels * grid.pixelArcsec ** 2, beforeValid, afterValid: beforeValid - newlyUnavailablePixels,
      dataValuesRetainedInsideReservation: true, densityEdited: false, policy: 'All seven primary cores unavailable for fine NH; other IR bands/coarse prior may constrain positive columns. Alcyone reject-table contamination is not replaced by the wrong neighbour.' },
    uncertainty: 'Source amplitude uncertainty added as (sigmaFlux*unitFluxPSF)^2 to band variance. It is spatially correlated across each PSF; this diagonal variance does not encode full covariance.',
    removals, primaryRemovals,
    limitations: ['Fixed Gaussian atlas PSFs approximate local asymmetric PRFs; no diffraction-spike/halo model', 'No artifact-position table is used as a complete pixel mask', 'No optical image read; no diffuse filaments or local source gains fitted', 'Negative point-subtracted data retained; no zero clipping', 'Primary blackbodies omit gravity darkening/free-free;36arcsec cores reserved,50% photosphere uncertainty adopted', 'MIPS24 generic22to23.68um extrapolation is a short-band approximation; W4-only RJ and15/30% SED errors are adopted', 'MIPS70 generic sources are intentionally not subtracted; coarse check only', 'Finite field clips PSF flux without renormalizing the in-field wings'] };
}

/** Small exact-operator pilot; memory only, no data acquisition or full pipeline. */
export function compactCleanSelfCheck(): Record<string, unknown> {
  const cases: Record<string, unknown>[] = [], width = 129, height = 129, pixelArcsec = 3, omegaMJy = (pixelArcsec * ARCSEC_RAD) ** 2 * 1e6;
  for (const fwhm of [6, 9.5, 16.8, 18]) {
    const n = width * height, band: IrBand = { name: 'WISE3', data: new Float32Array(n), variance: new Float32Array(n), validity: new Uint8Array(n).fill(1) };
    const fluxJy = 1.234, sigmaJy = .123, budget = subtractPsf(band, width, height, pixelArcsec, 64.37, 63.81, fwhm, fluxJy, sigmaJy);
    let recoveredJy = 0, recoveredSigmaJy = 0;
    for (let p = 0; p < n; p++) { recoveredJy -= band.data[p]! * omegaMJy; recoveredSigmaJy += Math.sqrt(band.variance[p]!) * omegaMJy; }
    const relativeFluxError = Math.abs(recoveredJy / fluxJy - 1), relativeSigmaError = Math.abs(recoveredSigmaJy / sigmaJy - 1);
    if (relativeFluxError > 2e-7 || relativeSigmaError > 2e-7 || Math.abs(budget.requestedFluxJy - budget.subtractedFluxJy) > 1e-10) throw Error('Unit-flux Gaussian conservation pilot failed.');
    cases.push({ fwhmArcsec: fwhm, relativeFluxError, relativeSigmaError });
  }
  const edge: IrBand = { name: 'WISE4', data: new Float32Array(width * height), variance: new Float32Array(width * height), validity: new Uint8Array(width * height).fill(1) };
  const edgeBudget = subtractPsf(edge, width, height, pixelArcsec, -.25, 64.3, 16.8, 1, .1);
  if (!(edgeBudget.subtractedFluxJy > 0 && edgeBudget.subtractedFluxJy < 1 && edgeBudget.outsideGridFluxJy > 0) || Math.abs(edgeBudget.subtractedFluxJy + edgeBudget.outsideGridFluxJy - 1) > 1e-10) throw Error('PSF edge clipping pilot failed.');
  return { success: true, signal: 'IR_COMPACT_UNIT_FLUX_PASS', cases, edgeClipping: edgeBudget, writes: 0 };
}
