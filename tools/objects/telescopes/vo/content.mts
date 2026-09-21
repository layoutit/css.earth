/** Native content, rather than archive MIME or ObsCore classification, chooses a VO product profile. */
import { readFitsHdus } from '../../interferometry/fits-table.mts';

export type VoContentProfile = {
  readonly member: string;
  readonly family: 'raster' | 'events' | 'oifits' | 'fits-table' | 'unknown';
  readonly profile: string | null;
  readonly state: 'confirmed' | 'non-qualifiable';
  readonly reason: string;
};

/**
 * This is deliberately a small, versioned dispatch boundary.  A recognised
 * native format is retained and named even when this legacy VO qualifier has
 * no executable handler for it.  It must never fall through to an image.
 */
export function inspectVoFits(member: string, bytes: Buffer): VoContentProfile {
  let hdus;
  try { hdus = readFitsHdus(bytes); }
  catch (error) {
    return { member, family: 'unknown', profile: null, state: 'non-qualifiable', reason: `FITS content could not be validated: ${String(error)}` };
  }
  const names = new Set(hdus.map(hdu => hdu.extname.toUpperCase()));
  if (names.has('EVENTS')) {
    const gti = names.has('GTI');
    return { member, family: 'events', profile: 'fits-events@1', state: 'non-qualifiable',
      reason: gti ? 'FITS EVENTS and GTI extensions are present; the VO route has no GTI-preserving event qualifier.' : 'FITS EVENTS extension is present, but no GTI-preserving event qualifier is registered.' };
  }
  if (['OI_VIS', 'OI_VIS2', 'OI_T3'].some(name => names.has(name))) {
    return { member, family: 'oifits', profile: 'oifits-observable@1', state: 'non-qualifiable',
      reason: names.has('OI_WAVELENGTH') ? 'OIFITS observables are present; this VO route has no OIFITS qualification handoff.' : 'OIFITS observable table lacks OI_WAVELENGTH; it is not qualifiable.' };
  }
  if (hdus.some(hdu => hdu.header.XTENSION === 'BINTABLE')) {
    return { member, family: 'fits-table', profile: 'fits-bintable@1', state: 'non-qualifiable', reason: 'FITS binary table is present; this VO route has no table qualification handoff.' };
  }
  if (hdus.some(hdu => typeof hdu.header.NAXIS === 'number' && hdu.header.NAXIS >= 2 && hdu.header.XTENSION !== 'BINTABLE')) {
    return { member, family: 'raster', profile: 'fits-raster@1', state: 'confirmed', reason: 'Validated FITS image array.' };
  }
  return { member, family: 'unknown', profile: null, state: 'non-qualifiable', reason: 'FITS contains no supported image, event, OIFITS, or binary-table profile.' };
}
