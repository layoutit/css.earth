export function createPreparedPlanarRotationPublisher({
  element,
  width,
  height = width,
}) {
  if (!(element instanceof HTMLElement) ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      typeof element.style.transform !== "string" ||
      element.style.transform.length === 0) {
    throw new TypeError("Prepared planar rotation requires a projected element.");
  }
  const projection = new DOMMatrix(element.style.transform);
  let publishedDegrees = Number.NaN;
  return (degrees) => {
    if (!Number.isFinite(degrees)) {
      throw new TypeError("Prepared planar rotation must be finite.");
    }
    if (degrees === publishedDegrees) return false;
    const localRotation = new DOMMatrix()
      .translate(width / 2, height / 2)
      .rotate(degrees)
      .translate(-width / 2, -height / 2);
    element.style.removeProperty("rotate");
    element.style.transform = projection.multiply(localRotation).toString();
    publishedDegrees = degrees;
    return true;
  };
}
