const scene = (filename) => `/scenes/venus/${filename}`;
const dpr = (name) => [`${name}.webp`, `${name}@2x.webp`];

export const VENUS_RUNTIME_ASSET_URLS = Object.freeze([
  "venus-atmosphere-spectrum.svg",
  "venus-photometric-phase-curve.svg",
  "venus-temperature-pressure-profile.svg",
  "venus-venera-9.gif",
  "venus-venera-10.gif",
  "venus-venera-13.jpg",
  "venus-venera-14.jpg",
  ...dpr("venus-material"),
  ...dpr("venus-observation-material"),
  ...dpr("venus-lighting"),
  ...["clouds", "radar", "elevation"].flatMap((lens) => [
    ...dpr(`venus-${lens}`),
    ...dpr(`venus-poles-${lens}`),
    `venus-lens-${lens}.webp`,
  ]),
  ...["front", "right", "back", "left", "top", "bottom"].flatMap(
    (face) => [
      ...dpr(`venus-starfield-${face}-standard`),
      ...dpr(`venus-starfield-${face}`),
    ],
  ),
  ...dpr("venus-directional-sun"),
].map(scene));
