import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_MARS_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_MARS_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_MARS_SKY_SUN } from "../runtime/preparedSkySun.mjs";

const scene = (filename) => `/scenes/mars/${filename}`;

export const MARS_RUNTIME_ASSET_URLS = Object.freeze([
  ...PREPARED_MARS_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_MARS_SKY_SUN.asset.url,
  PREPARED_MARS_SKY_SUN.asset.url2x,
  ...Object.values(PREPARED_MARS_LIGHTING.banks).flatMap((bank) =>
    bank.rows.map(({ url }) => url)),
  PREPARED_MARS_MOONS.billboardAtlas.url,
  PREPARED_MARS_MOONS.billboardAtlas.url2x,
  "mars-surface.webp",
  "mars-surface@2x.webp",
  "mars-poles.webp",
  "mars-poles@2x.webp",
  "mars-lens-normal.webp",
  "mars-lens-elevation.webp",
  "mars-lens-elevation@2x.webp",
  "mars-lens-elevation-poles.webp",
  "mars-lens-elevation-poles@2x.webp",
  "mars-lens-elevation-thumbnail.webp",
  "mars-lens-thermal.webp",
  "mars-lens-thermal@2x.webp",
  "mars-lens-thermal-poles.webp",
  "mars-lens-thermal-poles@2x.webp",
  "mars-lens-thermal-thumbnail.webp",
  "mars-photometric-phase-curve.svg",
  "mars-reflectance-spectrum.svg",
  "mars-temperature-pressure-profile.svg",
].map((url) => url.startsWith("/") ? url : scene(url)));
