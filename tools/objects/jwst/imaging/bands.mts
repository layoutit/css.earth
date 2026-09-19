/** The JWST imaging bands this repository reads, and how each is recognised in MAST products. NIRCam records its long-wave
 * narrow filters in the pupil wheel behind F444W, so F405N and F470N are FILTER F444W with the narrow filter as PUPIL; MIRI has
 * no pupil wheel. Level-3 and level-2 imaging products are surface brightness in MJy/sr after the pipeline's photom step.
 * A coronagraph band also names its focal-plane mask (CORONMSK): NIRCam's round masks sit behind the MASKRND Lyot stop in the
 * pupil wheel.
 * A cube band is one setting of an integral-field unit: NIRSpec's grating and the order-blocking filter that goes with it. Its
 * level-3 product is a spectral cube (_s3d), not a mosaic, and the spec3 stage builds it. */
export interface JwstBand {
  readonly id: string;
  readonly label: string;
  readonly instrument: 'NIRCAM' | 'MIRI' | 'NIRSPEC';
  readonly filter: string;
  readonly pupil?: string;
  readonly coronagraph?: string;
  /** A cube band's disperser (GRATING). */
  readonly grating?: string;
}
export const JWST_UNITS_REFERENCE = 'https://jwst-pipeline.readthedocs.io/en/latest/jwst/photom/main.html';

/** NIRCam coronagraphy: every filter observed behind a coronagraph in the public archive (MAST, September 2026), behind each
 * of module A's five occulters. The round masks sit behind the MASKRND Lyot stop and the bars behind MASKBAR; short-wave
 * filters are also observed behind the long-wave masks, on the short-wave detector. */
const CORONAGRAPH_FILTERS: readonly (readonly [string, string])[] = [['F182M', '1.82'], ['F187N', '1.87'], ['F200W', '2.00'], ['F210M', '2.10'], ['F212N', '2.12'],
  ['F250M', '2.50'], ['F300M', '3.00'], ['F335M', '3.35'], ['F356W', '3.56'], ['F360M', '3.60'], ['F410M', '4.10'], ['F430M', '4.30'], ['F444W', '4.44'], ['F460M', '4.60'], ['F480M', '4.80']];
export const NIRCAM_OCCULTERS: Readonly<Record<string, { readonly pupil: string; readonly mask: string }>> = Object.freeze({
  '210R': { pupil: 'MASKRND', mask: 'MASKA210R' }, '335R': { pupil: 'MASKRND', mask: 'MASKA335R' }, '430R': { pupil: 'MASKRND', mask: 'MASKA430R' },
  SWB: { pupil: 'MASKBAR', mask: 'MASKASWB' }, LWB: { pupil: 'MASKBAR', mask: 'MASKALWB' } });
const coronagraphBands = () => CORONAGRAPH_FILTERS.flatMap(([filter, micrometres]) => Object.entries(NIRCAM_OCCULTERS).map(([occulter, { pupil, mask }]) =>
  band(`NIRCAM-${filter}-MASK${occulter}`, `JWST NIRCam ${filter} ${micrometres} µm behind the MASK${occulter} coronagraph`, 'NIRCAM', filter, pupil, mask)));

/** NIRSpec's integral-field settings: each grating with its filter, and the wavelengths it covers in micrometres. */
const NIRSPEC_CUBES: readonly (readonly [string, string, string])[] = [['G140M', 'F070LP', '0.90–1.27'], ['G140M', 'F100LP', '0.97–1.89'], ['G235M', 'F170LP', '1.66–3.17'], ['G395M', 'F290LP', '2.87–5.27'],
  ['G140H', 'F070LP', '0.95–1.27'], ['G140H', 'F100LP', '0.97–1.89'], ['G235H', 'F170LP', '1.66–3.17'], ['G395H', 'F290LP', '2.87–5.27'], ['PRISM', 'CLEAR', '0.60–5.30']];
const cubeBands = () => NIRSPEC_CUBES.map(([grating, filter, range]) => Object.freeze({ id: `NIRSPEC-${grating}-${filter}`, label: `JWST NIRSpec integral-field cube, ${grating} ${range} µm`,
  instrument: 'NIRSPEC' as const, filter, grating }));

const band = (id: string, label: string, instrument: JwstBand['instrument'], filter: string, pupil?: string, coronagraph?: string): JwstBand =>
  Object.freeze({ id, label, instrument, filter, ...(pupil ? { pupil } : {}), ...(coronagraph ? { coronagraph } : {}) });
export const JWST_BANDS: Readonly<Record<string, JwstBand>> = Object.freeze(Object.fromEntries([
  band('NIRCAM-F090W', 'JWST NIRCam F090W 0.90 µm', 'NIRCAM', 'F090W', 'CLEAR'),
  band('NIRCAM-F187N', 'JWST NIRCam F187N 1.87 µm (Paschen α)', 'NIRCAM', 'F187N', 'CLEAR'),
  band('NIRCAM-F212N', 'JWST NIRCam F212N 2.12 µm (H₂ 1-0 S(1))', 'NIRCAM', 'F212N', 'CLEAR'),
  band('NIRCAM-F356W', 'JWST NIRCam F356W 3.56 µm', 'NIRCAM', 'F356W', 'CLEAR'),
  band('NIRCAM-F405N', 'JWST NIRCam F405N 4.05 µm (Brackett α)', 'NIRCAM', 'F444W', 'F405N'),
  band('NIRCAM-F444W', 'JWST NIRCam F444W 4.44 µm', 'NIRCAM', 'F444W', 'CLEAR'),
  band('NIRCAM-F470N', 'JWST NIRCam F470N 4.71 µm', 'NIRCAM', 'F444W', 'F470N'),
  band('MIRI-F770W', 'JWST MIRI F770W 7.7 µm', 'MIRI', 'F770W'),
  band('MIRI-F1130W', 'JWST MIRI F1130W 11.3 µm', 'MIRI', 'F1130W'),
  band('MIRI-F1280W', 'JWST MIRI F1280W 12.8 µm', 'MIRI', 'F1280W'),
  band('MIRI-F1800W', 'JWST MIRI F1800W 18 µm', 'MIRI', 'F1800W'),
  ...coronagraphBands(),
  ...cubeBands(),
].map(entry => [entry.id, entry])));

/** The band a product's primary header describes, or undefined. */
export function bandOfHeader(header: Record<string, unknown>): JwstBand | undefined {
  if (header.TELESCOP !== 'JWST') return undefined;
  if (header.INSTRUME === 'NIRSPEC') return header.EXP_TYPE === 'NRS_IFU' ? Object.values(JWST_BANDS).find(entry => entry.grating === header.GRATING && entry.filter === header.FILTER) : undefined;
  return Object.values(JWST_BANDS).find(entry => !entry.grating && entry.instrument === header.INSTRUME && entry.filter === header.FILTER &&
    (entry.instrument === 'MIRI' || entry.pupil === header.PUPIL) && (entry.coronagraph === undefined || entry.coronagraph === header.CORONMSK));
}
