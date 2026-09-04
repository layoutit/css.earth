import { PREPARED_SATURN_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_SATURN_SKY_SUN } from "../runtime/preparedSkySun.mjs";

const scene = (filename) => `/scenes/saturn/${filename}`;
const pad = (value) => String(value).padStart(2, "0");
const rows = (prefix, count, suffix = "") => Array.from(
  { length: count },
  (_, index) => `${prefix}${pad(index)}${suffix}.webp`,
);
const dpr = (name) => [`${name}.webp`, `${name}@2x.webp`];
const materialVariants = ["normal", "methane", "thermal", "ultraviolet"]
  .flatMap((lens) => [
    lens,
    `${lens}-no-shadows`,
    `${lens}-ringless`,
    `${lens}-ringless-no-shadows`,
  ]);
const materialBase = (prefix, variant) => variant === "normal"
  ? prefix
  : `${prefix}-${variant}`;

export const SATURN_RUNTIME_ASSET_URLS = Object.freeze([
  "saturn-atmosphere-spectrum.svg",
  ...materialVariants.flatMap((variant) => {
    const base = materialBase("saturn-interior-atmosphere", variant);
    return [
      `${base}.webp`,
      `${base}-default.webp`,
      ...rows(`${base}-row-`, 8),
    ];
  }),
  ...dpr("saturn-interior-core-poles"),
  ...dpr("saturn-interior-core"),
  ...dpr("saturn-interior-metallic-poles"),
  ...dpr("saturn-interior-metallic"),
  ...["methane", "normal", "thermal", "ultraviolet"].flatMap((lens) =>
    dpr(`saturn-interior-outer-poles-${lens}`)),
  ...dpr("saturn-interior-section"),
  ...["methane", "normal", "thermal", "ultraviolet"].map((lens) =>
    `saturn-lens-${lens}.webp`),
  ...dpr("saturn-moon-billboards"),
  "saturn-moon-orbit-arcs.svg",
  "saturn-moon-orbit-arcs@2x.svg",
  ...dpr("saturn-moon-shadows"),
  ...rows("saturn-moon-shadows-row-", 16),
  ...rows("saturn-moon-shadows-row-", 16, "@2x"),
  ...materialVariants.flatMap((variant) => {
    const base = materialBase("saturn-orbit-material", variant);
    return [
      `${base}.webp`,
      `${base}-default.webp`,
      ...rows(`${base}-row-`, 16),
    ];
  }),
  "saturn-poles.webp",
  "saturn-poles-methane.webp",
  "saturn-poles-thermal.webp",
  "saturn-poles-ultraviolet.webp",
  "saturn-photometric-phase-curve.svg",
  ...["a", "b-inner", "b-outer", "c"].flatMap((plate) =>
    dpr(`saturn-ring-motion-${plate}`)),
  "saturn-ring-shadow.webp",
  ...["", "-methane", "-thermal", "-ultraviolet"].flatMap((lens) =>
    dpr(`saturn-rings${lens}`)),
  ...PREPARED_SATURN_STARFIELD.faces.flatMap(({
    url,
    url2x,
    highContrastUrl,
    highContrastUrl2x,
  }) => [url, url2x, highContrastUrl, highContrastUrl2x]),
  PREPARED_SATURN_SKY_SUN.asset.url,
  PREPARED_SATURN_SKY_SUN.asset.url2x,
  "saturn-surface-body.jpg",
  ...["methane", "thermal", "ultraviolet"].flatMap((lens) =>
    dpr(`saturn-surface-${lens}`)),
  "saturn-temperature-pressure-profile.svg",
  "saturn-view-interior.webp",
  "saturn-weather.webp",
].map((url) => url.startsWith("/") ? url : scene(url)));
