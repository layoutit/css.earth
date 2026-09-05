const FACT_IDS = Object.freeze([
  "classification",
  "distance-from-sun",
  "distance-from-earth",
  "diameter",
  "radius",
  "orbital-period",
  "galactic-orbit",
  "rotation-period",
  "axial-tilt",
  "orbital-inclination",
  "orbital-eccentricity",
  "density",
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
  "age",
  "solar-system-mass",
  "photosphere-temperature",
  "core-temperature",
  "magnetic-cycle",
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

  return authoredFacts
    .map((fact, sourceIndex) => ({ fact, sourceIndex }))
    .sort((left, right) =>
      (FACT_RANK.get(left.fact.id) ?? FACT_IDS.length) -
        (FACT_RANK.get(right.fact.id) ?? FACT_IDS.length) ||
      left.sourceIndex - right.sourceIndex)
    .map(({ fact }) => fact);
}
