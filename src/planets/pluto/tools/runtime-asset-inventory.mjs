import { PREPARED_PLUTO_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_PLUTO_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_PLUTO_LENSES } from "../runtime/preparedLenses.mjs";

export const PLUTO_RUNTIME_ASSET_URLS = Object.freeze([
  ...PREPARED_PLUTO_LENSES.controls.flatMap((lens) => [
    lens.surfaceUrl,
    lens.surface2xUrl,
    lens.polesUrl,
    lens.poles2xUrl,
    lens.thumbnailUrl,
  ]),
  PREPARED_PLUTO_LENSES.material.one,
  PREPARED_PLUTO_LENSES.material.two,
  ...PREPARED_PLUTO_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_PLUTO_SKY_SUN.asset.url,
  PREPARED_PLUTO_SKY_SUN.asset.url2x,
]);
