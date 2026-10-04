/** A star's measured spectrum is its own only when no other star shares the instrument's aperture. A ground spectrophotometer, and
 * Gaia's BP/RP window, take a close pair as one source: Capella's two giants, Spica's two B stars, Izar and its A-type companion 2.9
 * arcseconds away. The color of such a spectrum is the pair's, not the star's.
 *
 * Before a measured spectrum colors a star, the generator reads the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466;
 * VizieR B/wds/wds) around it. A companion within `NEARBY_ARCSEC` whose share of the pair's light exceeds `BLEND_LIMIT` stops the
 * generation with the catalogue's numbers, and a person decides: skip the spectral routes with that reason (`color.skip`, so the color
 * is a Planck spectrum at the star's own temperature: right when both stars are drawn, as one spectrum cannot be split between two
 * discs), or keep the spectrum and say what is known of the companion (`color.companion`: an unconfirmed occultation pair, a flux ratio
 * a paper measured smaller than the catalogue's magnitudes say, or a companion that is not drawn and whose share bounds the error:
 * a measurement with a stated companion is preferred to a model color). The sentence is printed with the color.
 *
 * The limit is the color cross-check's own tolerance: a companion giving a fraction f of the light can move a color channel by at
 * most f of its range, so under CROSS_CHECK_AGREEMENT levels of 255 it cannot move the color further than two spectra of one star
 * are allowed to differ. `NEARBY_ARCSEC` is only how far the question is asked, not an aperture: beyond it a person is not consulted. */
import { CROSS_CHECK_AGREEMENT } from '@cssearth/bake/objects/stellar';
import { VIZIER_ASU, type Archive } from './archives/archives.mts';

export const NEARBY_ARCSEC = 10;
export const BLEND_LIMIT = CROSS_CHECK_AGREEMENT / 255;
export const WDS_CREDIT = 'Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds)';
/** The fainter star's share of a pair's light, from its magnitude difference. */
export const lightShare = (deltaMagnitude: number) => 1 / (1 + 10 ** (0.4 * deltaMagnitude));

export interface WdsPair { readonly wds: string; readonly discoverer: string; readonly components: string; readonly separationArcsec: number; readonly primaryMagnitude: number; readonly secondaryMagnitude: number; readonly share: number }

/** The pairs of one star in a VizieR B/wds/wds response whose primary is the star itself (components blank, AB, Aa,Ab, AC, …). */
export function parseWdsPairs(tsv: string): WdsPair[] {
  const lines = tsv.split('\n').filter(line => line.trim() && !line.startsWith('#')), header = lines[0]?.split('\t').map(cell => cell.trim()) ?? [];
  const column = (name: string) => header.indexOf(name);
  if (['WDS', 'Disc', 'Comp', 'sep2', 'mag1', 'mag2'].some(name => column(name) < 0)) return [];
  return lines.slice(1).map(line => line.split('\t').map(cell => cell.trim())).flatMap(cells => {
    const number = (name: string) => cells[column(name)] ? Number(cells[column(name)]) : Number.NaN;
    const separationArcsec = number('sep2'), primaryMagnitude = number('mag1'), secondaryMagnitude = number('mag2'), components = cells[column('Comp')] ?? '';
    if (![separationArcsec, primaryMagnitude, secondaryMagnitude].every(Number.isFinite) || !(components === '' || components.startsWith('A'))) return [];
    return [{ wds: cells[column('WDS')]!, discoverer: (cells[column('Disc')] ?? '').replace(/\s+/gu, ' '), components, separationArcsec, primaryMagnitude, secondaryMagnitude,
      share: lightShare(secondaryMagnitude - primaryMagnitude) }];
  });
}

/** The nearby companion that gives the most light, when that is more than a spectrum's color can absorb. */
export async function blendingCompanion(archive: Archive, at: { readonly ra: number; readonly dec: number }) {
  const tsv = await archive.text(VIZIER_ASU, { '-source': 'B/wds/wds', '-c': `${at.ra.toFixed(5)} ${at.dec >= 0 ? '+' : ''}${at.dec.toFixed(5)}`, '-c.rs': '40', '-out': 'WDS,Disc,Comp,Obs2,sep2,mag1,mag2', '-out.max': '60' });
  // A separation of -1 is the catalogue's "not measured" (an occultation pair): it is close, so it counts.
  const near = parseWdsPairs(tsv).filter(pair => pair.separationArcsec <= NEARBY_ARCSEC && pair.share > BLEND_LIMIT).sort((a, b) => b.share - a.share);
  return near[0];
}

/** The refusal a person answers in the spec, with the catalogue's numbers. */
export const blendRefusal = (id: string, route: string, pair: WdsPair) =>
  `${id}: the ${route} spectrum would blend a companion. ${WDS_CREDIT} lists WDS ${pair.wds} ${pair.discoverer}${pair.components ? ` ${pair.components}` : ''}: ${pair.separationArcsec < 0 ? 'separation not measured' : `${pair.separationArcsec} arcsec apart`}, magnitudes ${pair.primaryMagnitude} and ${pair.secondaryMagnitude}, so the companion gives ${(pair.share * 100).toFixed(1)}% of the light (the color check allows ${(BLEND_LIMIT * 100).toFixed(1)}%). `
  + 'Skip the spectral routes with that reason (color.skip and color.reason), or keep the spectrum and say what is known of the companion (color.companion).';
