import { mountCataloguePoints } from './catalogue-points.js';
import type { VolumeCameraPublication } from '../volume/types.js';
const PARSEC_M = 3.085677581491367e16;
/** Keep the distant population at Local Group scale; remove it around the Milky Way. */
export function backgroundPointsOpacity(distanceM: number): number {
  const near = 200_000 * PARSEC_M, far = 500_000 * PARSEC_M;
  if (!(distanceM > near)) return 0;
  if (distanceM >= far) return 1;
  const t = Math.log(distanceM / near) / Math.log(far / near);
  return t * t * (3 - 2 * t);
}
/** A background bank, and the camera distance it begins at: it is fetched there and fades in over the next doubling. */
export interface BackgroundPointBank { readonly url: string; readonly fromDistanceM?: number }

/**
 * The galaxies beyond the Local Group: prepared catalogue point banks (the field and its nested levels around the Milky
 * Way), each fetched the first time the camera is far enough out to show it. A far survey (DESI's shells, 0.7 Gpc and
 * beyond) begins farther out, so the Local Group and Nearby Universe never download it.
 */
export function mountBackgroundPoints(host: HTMLElement, before: Element, sources: readonly BackgroundPointBank[], fetchJson: (url: string) => Promise<unknown>) {
  const banks = sources.map(source => ({ from: source.fromDistanceM, bank: mountCataloguePoints({ host, before, url: source.url, fetchJson }) }));
  return {
    publish(publication: VolumeCameraPublication, distanceM: number) {
      const opacity = backgroundPointsOpacity(distanceM);
      for (const { from, bank } of banks) {
        const t = from === undefined ? 1 : Math.max(0, Math.min(1, Math.log(distanceM / from) / Math.LN2));
        bank.publish(publication, opacity * t * t * (3 - 2 * t));
      }
    },
    destroy() { for (const { bank } of banks) bank.destroy(); },
  };
}
