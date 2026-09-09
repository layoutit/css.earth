const FACT_IDS = Object.freeze([
  "parent",
  "distance-from-parent",
  "distance-from-sun",
  "distance-from-earth",
  "diameter",
  "radius",
  "orbital-period",
  "galactic-orbit",
  "rotation-period",
  "dimensions",
  "mass",
  "gravity",
  "axial-tilt",
  "orbital-inclination",
  "orbital-eccentricity",
  "density",
  "geometric-albedo",
  "moon-count",
  "ring-system",
  "surface-temperature",
  "minimum-temperature",
  "surface-pressure",
  "ocean-coverage",
  "atmosphere-composition",
  "wind-speed",
  "great-red-spot-depth",
  "ring-span",
  "ring-thickness",
  "ring-radius",
  "ring-width",
  "age",
  "solar-system-mass",
  "photosphere-temperature",
  "core-temperature",
  "activity-cycle",
  "magnetic-cycle",
  "discovery",
  "impact",
]);

const FACT_RANK = new Map(FACT_IDS.map((id, index) => [id, index]));

export function orderFacts(facts = [], moreFacts = []) {
  const authoredFacts = [...facts, ...moreFacts];
  const ids = new Set();

  for (const fact of authoredFacts) {
    if (typeof fact.id !== "string" || fact.id.length === 0) {
      throw new TypeError(`Factsheet entry ${JSON.stringify(fact.label)} needs a semantic id.`);
    }
    if (ids.has(fact.id)) {
      throw new TypeError(`Factsheet semantic id ${JSON.stringify(fact.id)} is duplicated.`);
    }
    ids.add(fact.id);
  }

  // For satellites, the parent orbit describes the body more directly than
  // the whole system's heliocentric orbit. Keep the same four core fields.
  const rank = (id) => id === "distance-from-sun" && ids.has("distance-from-parent")
    ? FACT_RANK.get("rotation-period") + 0.5
    : FACT_RANK.get(id) ?? FACT_IDS.length;

  return authoredFacts
    .map((fact, sourceIndex) => ({ fact, sourceIndex }))
    .sort((left, right) =>
      rank(left.fact.id) - rank(right.fact.id) ||
      left.sourceIndex - right.sourceIndex)
    .map(({ fact }) => fact);
}
