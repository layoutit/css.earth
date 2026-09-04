export const PLANETARY_SCALE_LABEL =
  "Planets by mean distance from the Sun, logarithmic scale";

const TRACK_START_PERCENT = 6;
const TRACK_END_PERCENT = 100;

// Map the catalog's positive AU distances logarithmically between the fixed
// 6% and 100% track bounds. This keeps the inner planets readable while
// preserving their strict distance order.
export function positionPlanetsByDistance(planets) {
  if (!Array.isArray(planets) || planets.length < 2) {
    throw new TypeError("Planetary scale requires at least two planets.");
  }
  const firstDistance = planets[0].distanceAu;
  const lastDistance = planets.at(-1).distanceAu;
  if (!Number.isFinite(firstDistance) || firstDistance <= 0 ||
      !Number.isFinite(lastDistance) || lastDistance <= firstDistance) {
    throw new TypeError("Planetary scale distance bounds are invalid.");
  }

  const logarithmicSpan = Math.log(lastDistance / firstDistance);
  return Object.freeze(planets.map((planet) => {
    if (!Number.isFinite(planet.distanceAu) || planet.distanceAu < firstDistance ||
        planet.distanceAu > lastDistance) {
      throw new TypeError(`Planetary scale distance is invalid: ${planet.id}.`);
    }
    const progress = Math.log(planet.distanceAu / firstDistance) / logarithmicSpan;
    const position = TRACK_START_PERCENT +
      progress * (TRACK_END_PERCENT - TRACK_START_PERCENT);
    return Object.freeze({
      ...planet,
      scalePositionPercent: Number(position.toFixed(4)),
    });
  }));
}
