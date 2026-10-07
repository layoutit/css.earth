/** Every paper whose table is read of a star's TESS light, in the order they are asked: Colman et al. (2024), for any
 * target of the mission's first 26 sectors (published.mts), then Canto Martins et al. (2020), for a TESS Object of
 * Interest (canto-martins.mts). Each is an entry of the published-verdict kind. */
import { CANTO_MARTINS_2020 } from './canto-martins.mts';
import { COLMAN_2024, publishedLookup, type PublishedLookup } from './published.mts';

export const PUBLISHED: readonly PublishedLookup[] = [publishedLookup(COLMAN_2024), publishedLookup(CANTO_MARTINS_2020)];
