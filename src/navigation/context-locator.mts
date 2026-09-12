// Selected-body locator: four open corners with 5px arms and 1.5px strokes.
// The resting image fills a 16px square. The hover image keeps the same arms on
// a 20px square and is drawn at 16px, so the leaf's 1.25 hover scale restores
// them to 5px. Plain SVG markup, built from the swatch; no raster encoding.
const ARM = 5, STROKE = 1.5;

function cornerPath(size: number): string {
  const far = size - ARM, edge = size - STROKE;
  return [
    `M0 0h${ARM}v${STROKE}H0z`, `M0 0h${STROKE}v${ARM}H0z`,
    `M${far} 0h${ARM}v${STROKE}h-${ARM}z`, `M${edge} 0H${size}v${ARM}h-${STROKE}z`,
    `M0 ${edge}h${ARM}V${size}H0z`, `M0 ${far}h${STROKE}v${ARM}H0z`,
    `M${far} ${edge}h${ARM}V${size}h-${ARM}z`, `M${edge} ${far}H${size}v${ARM}h-${STROKE}z`,
  ].join('');
}

function locatorImage(hex: string, size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<path fill="${hex}" d="${cornerPath(size)}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Resting and hovered locator images for one validated swatch colour. */
export function contextLocatorImages(hex: string): readonly [string, string] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new TypeError('Invalid locator color.');
  return [locatorImage(hex, 16), locatorImage(hex, 20)];
}
