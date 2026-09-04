import { PREPARED_EARTH_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_EARTH_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { EARTH_MATERIAL_FRAMES_PER_SHARD } from "./atmosphere-model.mjs";

const scene = (filename) => `/scenes/earth/${filename}`;
const materialAssets = ["lighting", "atmosphere"].flatMap((role) => [
  `earth-${role}-default.webp`,
  `earth-${role}-default@2x.webp`,
  ...(role === "lighting" ? [
    `earth-${role}-shadowless.webp`,
    `earth-${role}-shadowless@2x.webp`,
  ] : []),
  ...Array.from({ length: 128 / EARTH_MATERIAL_FRAMES_PER_SHARD },
    (_, rowIndex) => {
    const prefix = `earth-${role}-row-${String(rowIndex).padStart(2, "0")}`;
    return [`${prefix}.webp`, `${prefix}@2x.webp`];
  }).flat(),
]);
const interiorAssets = ["mantle", "outer-core", "inner-core"].flatMap(
  (layer) => [
    `earth-interior-${layer}.webp`,
    `earth-interior-${layer}@2x.webp`,
    `earth-interior-${layer}-poles.webp`,
    `earth-interior-${layer}-poles@2x.webp`,
  ],
);

export const EARTH_RUNTIME_ASSET_URLS = Object.freeze([
  "earth-atmosphere-spectrum.svg",
  "earth-photometric-phase-curve.svg",
  "earth-interior-outer-poles.webp",
  "earth-interior-outer-poles@2x.webp",
  "earth-interior-outer.webp",
  "earth-interior-outer@2x.webp",
  "earth-interior-section.webp",
  "earth-interior-section@2x.webp",
  "earth-lens-night-lights.webp",
  "earth-lens-normal.webp",
  "earth-lens-topography.webp",
  "earth-night-lights.webp",
  "earth-night-lights-poles.webp",
  ...PREPARED_EARTH_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_EARTH_SKY_SUN.asset.url,
  PREPARED_EARTH_SKY_SUN.asset.url2x,
  "earth-surface.webp",
  "earth-surface-poles.webp",
  "earth-temperature-pressure-profile.svg",
  "earth-topography.webp",
  "earth-topography-poles.webp",
  "earth-view-interior.webp",
  ...materialAssets,
  ...interiorAssets,
].map((url) => url.startsWith("/") ? url : scene(url)));
