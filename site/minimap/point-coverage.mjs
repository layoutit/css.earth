/** A later opaque circle may retire only the fully covered interior of an
 * earlier marker. Keep a raster guard between their edges; partial coverage,
 * translucent foregrounds and uncertain geometry must continue drawing. */
export function minimapPointCovered(point, foreground, guard) {
  if (!foreground.opaque || foreground.alpha !== 1 || foreground.index <= point.index ||
      !(guard > 0) || !Number.isFinite(guard)) return false;
  const clearance = foreground.radius - point.radius - guard;
  if (!(clearance > 0) || !Number.isFinite(clearance)) return false;
  const dx = foreground.x - point.x, dy = foreground.y - point.y;
  return dx * dx + dy * dy < clearance * clearance;
}
