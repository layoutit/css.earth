import { PREPARED_URANUS_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_URANUS_SKY_SUN } from "../runtime/preparedSkySun.mjs";

const scene = (filename) => `/scenes/uranus/${filename}`;
const dpr = (name) => [`${name}.webp`, `${name}@2x.webp`];
const materialRows = (lens) => Array.from({ length: 16 }, (_, rowIndex) =>
  `uranus-orbit-material-${lens}-row-${String(rowIndex).padStart(2, "0")}.webp`);

export const URANUS_RUNTIME_ASSET_URLS = Object.freeze([
  "uranus-atmosphere-spectrum.svg",
  ...["normal", "methane", "near-infrared"].flatMap((lens) =>
    [...dpr(`uranus-surface-${lens}`), ...dpr(`uranus-poles-${lens}`)]),
  ...["normal", "methane", "near-infrared"].map((lens) =>
    `uranus-lens-${lens}.webp`),
  ...["normal", "methane", "near-infrared"].flatMap((lens) =>
    dpr(`uranus-fixed-material-${lens}`)),
  ...["normal", "methane", "near-infrared"].flatMap((lens) =>
    dpr(`uranus-fixed-material-${lens}-shadowless`)),
  ...["normal", "methane", "near-infrared"].flatMap(materialRows),
  ...dpr("uranus-moon-billboards"),
  "uranus-moon-orbit-arcs.svg",
  "uranus-moon-orbit-arcs@2x.svg",
  "uranus-photometric-phase-curve.svg",
  ...dpr("uranus-rings"),
  ...dpr("uranus-ring-shadow-plane"),
  ...PREPARED_URANUS_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_URANUS_SKY_SUN.asset.url,
  PREPARED_URANUS_SKY_SUN.asset.url2x,
  "uranus-temperature-pressure-profile.svg",
].map((url) => url.startsWith("/") ? url : scene(url)));
