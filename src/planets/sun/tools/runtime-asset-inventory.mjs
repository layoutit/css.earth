const scene = (fileName) => `/scenes/sun/${fileName}`;
const dpr = (stem) => [`${stem}.webp`, `${stem}@2x.webp`];

export const SUN_RUNTIME_ASSET_URLS = Object.freeze([
  ...["photosphere", "magnetic", "chromosphere", "corona"].flatMap((lens) => [
    ...dpr(`sun-surface-${lens}`),
    ...dpr(`sun-poles-${lens}`),
    ...dpr(`sun-corona-${lens}`),
    ...dpr(`sun-limb-${lens}`),
    `sun-lens-${lens}.webp`,
  ]),
  ...["front", "right", "back", "left", "top", "bottom"].flatMap(
    (face) => [
      ...dpr(`sun-starfield-${face}-standard`),
      ...dpr(`sun-starfield-${face}`),
    ],
  ),
].map(scene));
