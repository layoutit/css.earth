import { mountCataloguePoints } from './catalogue-points.js';
import type { VolumeCameraPublication } from '../volume/types.js';
/** The galaxies beyond the Local Group draw at this share of their dots' own opacity: a backdrop behind the object in view.
 * A presentation choice, set by eye in the app. */
const BACKGROUND_OPACITY = 0.7;
/** A background bank, and the camera distance it begins at: it is fetched there and fades in over the next doubling. */
export interface BackgroundPointBank { readonly url: string; readonly fromDistanceM?: number }

/**
 * The galaxies beyond the Local Group: prepared catalogue point banks (the field and its nested levels around the Milky
 * Way), each fetched the first time the camera is far enough out to show it. A far survey (DESI's shells, 0.7 Gpc and
 * beyond) begins farther out, so the Local Group and Nearby Universe never download it.
 */
export function mountBackgroundPoints(host: HTMLElement, before: Element, sources: readonly BackgroundPointBank[], loadBank: (url: string) => Promise<unknown>) {
  const banks = sources.map(source => ({ from: source.fromDistanceM, bank: mountCataloguePoints({ host, before, url: source.url, loadBank }) }));
  return {
    /** `outside` is how far the camera is out of our galaxy (volumeOutsideFade): the galaxies beyond show only there. */
    publish(publication: VolumeCameraPublication, distanceM: number, outside: number) {
      const opacity = BACKGROUND_OPACITY * Math.max(0, Math.min(1, outside));
      for (const { from, bank } of banks) {
        const t = from === undefined ? 1 : Math.max(0, Math.min(1, Math.log(distanceM / from) / Math.LN2));
        bank.publish(publication, opacity * t * t * (3 - 2 * t));
      }
    },
    destroy() { for (const { bank } of banks) bank.destroy(); },
  };
}
