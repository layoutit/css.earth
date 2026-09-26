// Selected-body locator: four open corners with 5px arms and 1.5px strokes, around the body the world emphasises. One
// inline SVG serves every body: the world moves it into the emphasised marker, and its paths fill with `currentColor`, so
// they take that marker's colour by inheritance. The resting corners fill a 16px square. The hover corners keep the same
// arms on a 20px square drawn at 16px, so the marker's 1.25 hover scale restores them to 5px.
const ARM = 5, STROKE = 1.5, SVG = 'http://www.w3.org/2000/svg';

/** The eight arm rectangles of a locator on a `size` pixel square, as one SVG path. */
export function locatorCornerPath(size: number): string {
  const far = size - ARM, edge = size - STROKE;
  return [
    `M0 0h${ARM}v${STROKE}H0z`, `M0 0h${STROKE}v${ARM}H0z`,
    `M${far} 0h${ARM}v${STROKE}h-${ARM}z`, `M${edge} 0H${size}v${ARM}h-${STROKE}z`,
    `M0 ${edge}h${ARM}V${size}H0z`, `M0 ${far}h${STROKE}v${ARM}H0z`,
    `M${far} ${edge}h${ARM}V${size}h-${ARM}z`, `M${edge} ${far}H${size}v${ARM}h-${STROKE}z`,
  ].join('');
}

/** The one locator the world moves between markers: resting and hover corners, both in `currentColor`. */
export function createContextLocator(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'context-locator');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const resting = document.createElementNS(SVG, 'path');
  resting.setAttribute('class', 'context-locator-resting');
  resting.setAttribute('fill', 'currentColor');
  resting.setAttribute('d', locatorCornerPath(16));
  const hovered = document.createElementNS(SVG, 'path');
  hovered.setAttribute('class', 'context-locator-hovered');
  hovered.setAttribute('fill', 'currentColor');
  hovered.setAttribute('transform', 'scale(0.8)');
  hovered.setAttribute('d', locatorCornerPath(20));
  svg.append(resting, hovered);
  return svg;
}
