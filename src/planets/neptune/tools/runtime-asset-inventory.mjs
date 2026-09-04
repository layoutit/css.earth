import { PREPARED_NEPTUNE_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_NEPTUNE_SKY_SUN } from "../runtime/preparedSkySun.mjs";

const scene = (filename) => `/scenes/neptune/${filename}`;
const dpr = (name) => [`${name}.webp`, `${name}@2x.webp`];
const orbitRows = (lens) => Array.from(
  { length: 16 },
  (_, row) =>
    `neptune-orbit-material-${lens}-row-${String(row).padStart(2, "0")}.webp`,
);

export const NEPTUNE_RUNTIME_ASSET_URLS = Object.freeze([
  "neptune-atmosphere-spectrum.svg",
  "neptune-photometric-phase-curve.svg",
  "neptune-temperature-pressure-profile.svg",
  ...PREPARED_NEPTUNE_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_NEPTUNE_SKY_SUN.asset.url,
  PREPARED_NEPTUNE_SKY_SUN.asset.url2x,
  ...dpr("neptune-moon-dots"),
  "neptune-moon-orbit-arcs.svg",
  "neptune-moon-orbit-arcs@2x.svg",
  "neptune-orbit-bank.f64z",
  ...dpr("neptune-rings"),
  ...["normal", "methane", "near-infrared"].flatMap((lens) => [
    ...dpr(`neptune-surface-${lens}`),
    `neptune-poles-${lens}.webp`,
    `neptune-material-${lens}.webp`,
    `neptune-material-${lens}-shadowless.webp`,
    `neptune-lens-${lens}.webp`,
    ...orbitRows(lens),
  ]),
].map((url) => url.startsWith("/") ? url : scene(url)));
