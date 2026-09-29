/** A prepared bank of catalogue points the app fetches and draws as dots (`packages/renderer/src/universe/catalogue-points.ts`). */
export const CATALOGUE_POINTS_SCHEMA = 'cssearth-catalogue-points@1';
/** The most points a published bank may hold: enough for the Milky Way's stacked levels (32,829 dots). The renderer
 * projects the drawn prefix of a bank every frame and refuses a larger one; the bake never publishes a larger one. A
 * fuller catalogue is a bake input that a merge or stack thins first (packages/bake/src/volume/node/catalogue-banks.ts). */
export const MAX_CATALOGUE_POINTS = 40000;
