import type { MessierObject } from './types';

/** Rendered survey products, distinct from individual archive exposures and calibration maps. */
export const surveyImages = [
  { id: 'dss2', hips: 'CDS/P/DSS2/color', title: 'DSS2 · Optical', bands: 'Photographic blue / red · synthetic green',
    description: 'Optical structure and dust lanes; bright cores can saturate.',
    sourceUrl: 'https://archive.stsci.edu/dss/', propertiesUrl: 'https://alasky.cds.unistra.fr/DSS/DSSColor/properties',
    credit: 'STScI / NASA · Palomar / UK Schmidt plates · CDS colour mosaic' },
  { id: 'wise', hips: 'CDS/P/allWISE/color', title: 'WISE · Infrared', bands: 'RGB: 22 / 4.6 / 3.4 μm',
    description: 'Warm dust and stars in mapped infrared colour; lower angular resolution than optical surveys.',
    sourceUrl: 'https://irsa.ipac.caltech.edu/Missions/wise.html', propertiesUrl: 'https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1/properties',
    credit: 'NASA / JPL-Caltech / UCLA / IPAC · CDS colour mosaic' },
  { id: '2mass', hips: 'CDS/P/2MASS/color', title: '2MASS · Near infrared', bands: 'RGB: Ks / H / J',
    description: 'Stellar structure through dust; diffuse gas may be faint or absent in these bands.',
    sourceUrl: 'https://irsa.ipac.caltech.edu/Missions/2mass.html', propertiesUrl: 'https://alasky.cds.unistra.fr/2MASS/Color/properties',
    credit: 'UMass / IPAC-Caltech · NASA / NSF · CDS colour mosaic' },
] as const;
export type SurveyImage = typeof surveyImages[number];

/** Common north-up sky window, not a claim that emission ends at the catalogue boundary. */
export function surveyFieldDegrees(majorArcsec: number | null) {
  return majorArcsec === null ? 1 : Math.max(0.03, Math.min(20, majorArcsec / 3600 * 1.25));
}
export function surveyImageUrl(survey: SurveyImage, object: MessierObject, fieldDegrees: number, pixels: 512 | 2048) {
  const url = new URL('https://alasky.cds.unistra.fr/hips-image-services/hips2fits');
  const values = { hips: survey.hips, width: pixels, height: pixels, fov: fieldDegrees,
    projection: 'TAN', coordsys: 'icrs', ra: object.raDegrees, dec: object.decDegrees, rotation_angle: 0, format: 'jpg' };
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, String(value));
  return url.href;
}
