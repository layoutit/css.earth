const scene = (fileName) => `/scenes/mercury/${fileName}`;
const dpr = (stem) => [`${stem}.webp`, `${stem}@2x.webp`];
const lightingRows = Array.from({ length: 32 }, (_, rowIndex) =>
  [1, 2].map((density) => `mercury-lighting-${density}x-row-${
    String(rowIndex).padStart(2, "0")
  }.webp`)).flat();

export const MERCURY_RUNTIME_ASSET_URLS = Object.freeze([
  ...["normal", "enhanced", "topography"].flatMap((lens) =>
    dpr(`mercury-surface-${lens}`)),
  ...dpr("mercury-poles"),
  ...lightingRows,
  ...dpr("mercury-interior-outer"),
  ...dpr("mercury-interior-outer-poles"),
  ...dpr("mercury-interior-core"),
  ...dpr("mercury-interior-core-poles"),
  ...dpr("mercury-interior-section"),
  ...["front", "right", "back", "left", "top", "bottom"].flatMap((face) => [
    ...dpr(`mercury-starfield-${face}-standard`),
    ...dpr(`mercury-starfield-${face}`),
  ]),
  ...dpr("mercury-directional-sun"),
  "mercury-photometric-phase-curve.svg",
  "mercury-surface-albedo.svg",
  "mercury-lens-normal.webp",
  "mercury-lens-enhanced.webp",
  "mercury-lens-topography.webp",
  "mercury-lens-interior.webp",
].map(scene));
