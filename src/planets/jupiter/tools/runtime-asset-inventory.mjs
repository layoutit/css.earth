import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_RINGS } from "../runtime/preparedRings.mjs";
import { PREPARED_JUPITER_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_JUPITER_SKY_SUN } from "../runtime/preparedSkySun.mjs";

const scene = (filename) => `/scenes/jupiter/${filename}`;

export const JUPITER_RUNTIME_ASSET_URLS = Object.freeze([
  ...PREPARED_JUPITER_LIGHTING.rows.map(({ url }) => url),
  PREPARED_JUPITER_LIGHTING.shadowless.url,
  ...PREPARED_JUPITER_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_JUPITER_SKY_SUN.asset.url,
  PREPARED_JUPITER_SKY_SUN.asset.url2x,
  ...Object.values(PREPARED_JUPITER_RINGS.assets).flatMap(({ url, url2x }) =>
    [url, url2x]),
  "jupiter-surface.webp",
  "jupiter-surface@2x.webp",
  "jupiter-poles.webp",
  "jupiter-poles@2x.webp",
  "jupiter-moon-billboards.webp",
  "jupiter-moon-billboards@2x.webp",
  "jupiter-moon-orbit-arcs.svg",
  "jupiter-moon-orbit-arcs@2x.svg",
  "jupiter-lens-normal.webp",
  "jupiter-lens-ultraviolet.webp",
  "jupiter-lens-ultraviolet@2x.webp",
  "jupiter-lens-ultraviolet-poles.webp",
  "jupiter-lens-ultraviolet-poles@2x.webp",
  "jupiter-lens-ultraviolet-thumbnail.webp",
  "jupiter-lens-methane.webp",
  "jupiter-lens-methane@2x.webp",
  "jupiter-lens-methane-poles.webp",
  "jupiter-lens-methane-poles@2x.webp",
  "jupiter-lens-methane-thumbnail.webp",
  "jupiter-photometric-phase-curve.svg",
  "jupiter-reflectance-spectrum.svg",
  "jupiter-temperature-pressure-profile.svg",
].map((url) => url.startsWith("/") ? url : scene(url)));
