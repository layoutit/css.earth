/** The JWST imaging bands this repository reads, and how each is recognised in MAST products. NIRCam records its long-wave
 * narrow filters in the pupil wheel behind F444W, so F405N and F470N are FILTER F444W with the narrow filter as PUPIL; MIRI has
 * no pupil wheel. Level-3 and level-2 imaging products are surface brightness in MJy/sr after the pipeline's photom step.
 * A coronagraph band also names its focal-plane mask (CORONMSK): NIRCam's round masks sit behind the MASKRND Lyot stop in the
 * pupil wheel.
 * A cube band is one setting of an integral-field unit. NIRSpec's is a grating and the order-blocking filter that goes with it;
 * MIRI's medium-resolution spectrometer has no filter wheel at all, and a setting is a detector channel and a sub-band. Either
 * way the level-3 product is a spectral cube (_s3d), not a mosaic, and the spec3 stage builds it. */
export interface JwstBand {
  readonly id: string;
  readonly label: string;
  readonly instrument: 'NIRCAM' | 'MIRI' | 'NIRSPEC';
  /** The filter wheel's element. A MIRI MRS band has none: it is named by its channel and sub-band instead. */
  readonly filter?: string;
  readonly pupil?: string;
  readonly coronagraph?: string;
  /** A NIRSpec cube band's disperser (GRATING). */
  readonly grating?: string;
  /** A MIRI MRS cube band's detector channel, '1' to '4' (CHANNEL on its level-3 cube). */
  readonly channel?: string;
  /** A MIRI MRS cube band's grating-wheel setting, SHORT, MEDIUM or LONG (BAND). */
  readonly subBand?: string;
  /** A MIRI MRS cube band's detector: the one exposure set its channel is read out on. */
  readonly detector?: string;
}
export const JWST_UNITS_REFERENCE = 'https://jwst-pipeline.readthedocs.io/en/latest/jwst/photom/main.html';

/** True for a band whose level-3 product is a spectral cube built by spec3, rather than a mosaic. */
export const isCubeBand = (band: JwstBand): boolean => band.grating !== undefined || band.subBand !== undefined;
/** MAST's observing mode for a band: the instrument and what it was doing. */
export const bandMode = (band: Pick<JwstBand, 'instrument' | 'coronagraph' | 'grating' | 'subBand'>): string =>
  `${band.instrument}/${band.coronagraph ? 'CORON' : band.grating ?? band.subBand ? 'IFU' : 'IMAGE'}`;

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

/** MIRI's medium-resolution spectrometer. One exposure sets the grating wheel to a sub-band (SHORT, MEDIUM or LONG) and reads
 * two channels at once: channels 1 and 2 on the MIRIFUSHORT detector, 3 and 4 on MIRIFULONG. A cube is one channel in one
 * sub-band, so twelve cubes cover 5–28 µm, each on its own plate scale, which the cube states and nothing here declares.
 * The sub-band wavelength ranges below are the instrument documentation's
 * (https://jwst-docs.stsci.edu/jwst-mid-infrared-instrument/miri-observing-modes/miri-medium-resolution-spectroscopy); channel 1
 * SHORT is also measured, from MAST's own cube of Europa (4.9004 to 5.7396 µm, docs/jwst-imaging.md). */
const MIRI_MRS_DETECTORS: Readonly<Record<string, string>> = Object.freeze({ '1': 'MIRIFUSHORT', '2': 'MIRIFUSHORT', '3': 'MIRIFULONG', '4': 'MIRIFULONG' });
const MIRI_MRS: readonly (readonly [string, string, string])[] = [
  ['1', 'SHORT', '4.90–5.74'], ['1', 'MEDIUM', '5.66–6.63'], ['1', 'LONG', '6.53–7.65'],
  ['2', 'SHORT', '7.51–8.77'], ['2', 'MEDIUM', '8.67–10.13'], ['2', 'LONG', '10.02–11.70'],
  ['3', 'SHORT', '11.55–13.47'], ['3', 'MEDIUM', '13.34–15.57'], ['3', 'LONG', '15.41–17.98'],
  ['4', 'SHORT', '17.70–20.95'], ['4', 'MEDIUM', '20.69–24.48'], ['4', 'LONG', '24.40–27.90']];
const mrsBands = () => MIRI_MRS.map(([channel, subBand, range]) => Object.freeze({ id: `MIRI-MRS-CH${channel}-${subBand}`,
  label: `JWST MIRI integral-field cube, channel ${channel} ${subBand.toLowerCase()} ${range} µm`,
  instrument: 'MIRI' as const, channel, subBand, detector: MIRI_MRS_DETECTORS[channel]! }));

/** The wavelengths each cube band covers, in micrometres, taken from the same tables its label is written from. A reader that
 * needs what a cube mode covers takes it from here instead of restating it. An imaging band names a filter, not a width, so it
 * has no entry. */
const coverage = (range: string): readonly [number, number] => { const [from, to] = range.split('–').map(Number); return [from!, to!]; };
export const JWST_CUBE_COVERAGE: Readonly<Record<string, readonly [number, number]>> = Object.freeze(Object.fromEntries([
  ...NIRSPEC_CUBES.map(([grating, filter, range]) => [`NIRSPEC-${grating}-${filter}`, coverage(range)] as const),
  ...MIRI_MRS.map(([channel, subBand, range]) => [`MIRI-MRS-CH${channel}-${subBand}`, coverage(range)] as const)]));

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
  band('MIRI-F2100W', 'JWST MIRI F2100W 21 µm', 'MIRI', 'F2100W'),
  band('MIRI-F2550W', 'JWST MIRI F2550W 25.5 µm', 'MIRI', 'F2550W'),
  // MIRI's coronagraphs each have their own filter, and the level-3 header names the mask (CORONMSK).
  band('MIRI-F1550C-4QPM', 'JWST MIRI F1550C 15.5 µm behind the four-quadrant phase mask', 'MIRI', 'F1550C', undefined, '4QPM_1550'),
  band('MIRI-F2300C-LYOT', 'JWST MIRI F2300C 23 µm behind the Lyot coronagraph', 'MIRI', 'F2300C', undefined, 'LYOT_2300'),
  ...coronagraphBands(),
  ...cubeBands(),
  ...mrsBands(),
].map(entry => [entry.id, entry])));

/** The band a product's primary header describes, or undefined. A MIRI MRS level-3 cube names one channel (CHANNEL '1'); a
 * level-2 exposure names the two its detector reads at once ('12'), and is not a band. */
export function bandOfHeader(header: Record<string, unknown>): JwstBand | undefined {
  if (header.TELESCOP !== 'JWST') return undefined;
  if (header.INSTRUME === 'NIRSPEC') return header.EXP_TYPE === 'NRS_IFU' ? Object.values(JWST_BANDS).find(entry => entry.grating === header.GRATING && entry.filter === header.FILTER) : undefined;
  if (header.EXP_TYPE === 'MIR_MRS') return Object.values(JWST_BANDS).find(entry => entry.instrument === header.INSTRUME && entry.channel === header.CHANNEL && entry.subBand === header.BAND);
  return Object.values(JWST_BANDS).find(entry => !isCubeBand(entry) && entry.instrument === header.INSTRUME && entry.filter === header.FILTER &&
    (entry.instrument === 'MIRI' || entry.pupil === header.PUPIL) && (entry.coronagraph === undefined || entry.coronagraph === header.CORONMSK));
}
