import { readPreparedTransform } from '../navigation/prepared-camera-basis.js';
import { multiplyPreparedMatrix4, preparedRotationMatrix4, serializePreparedMatrix4 } from '../prepared-data/prepared-ellipsoid-projection.js';
import type { Matrix4 } from '../solar-system/types.js';

export interface PreparedPlanarRotationOptions { element: HTMLElement; width: number; height?: number; }

export function createPreparedPlanarRotationPublisher({
  element,
  width,
  height = width,
}: PreparedPlanarRotationOptions) {
  if (!element || element.nodeType !== 1 || element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      typeof element.style.transform !== "string" ||
      element.style.transform.length === 0) {
    throw new TypeError("Prepared planar rotation requires a projected element.");
  }
  const projection = readPreparedTransform(element.style.transform);
  const translate = (x: number, y: number): Matrix4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
  const toCentre = translate(width / 2, height / 2), fromCentre = translate(-width / 2, -height / 2);
  let publishedDegrees = Number.NaN;
  return (degrees: number) => {
    if (!Number.isFinite(degrees)) {
      throw new TypeError("Prepared planar rotation must be finite.");
    }
    if (degrees === publishedDegrees) return false;
    const localRotation = multiplyPreparedMatrix4(multiplyPreparedMatrix4(toCentre,
      preparedRotationMatrix4('z', degrees)), fromCentre);
    element.style.removeProperty("rotate");
    element.style.transform = serializePreparedMatrix4(multiplyPreparedMatrix4(projection, localRotation));
    publishedDegrees = degrees;
    return true;
  };
}
