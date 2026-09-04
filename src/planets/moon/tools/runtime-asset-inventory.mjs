import { PREPARED_MOON_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_MOON_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_MOON_LENSES } from "../runtime/preparedLenses.mjs";

export const MOON_RUNTIME_ASSET_URLS = Object.freeze([
  ...PREPARED_MOON_LENSES.controls.flatMap((lens) => [
    lens.surfaceUrl,
    lens.surface2xUrl,
    lens.polesUrl,
    lens.poles2xUrl,
    lens.thumbnailUrl,
  ]),
  PREPARED_MOON_LENSES.material.one,
  PREPARED_MOON_LENSES.material.two,
  ...PREPARED_MOON_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_MOON_SKY_SUN.asset.url,
  PREPARED_MOON_SKY_SUN.asset.url2x,
]);
