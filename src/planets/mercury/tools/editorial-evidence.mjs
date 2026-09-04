export function extractMercuryEditorialEvidence(editorial) {
  if (editorial?.id !== "mercury" || editorial.sourceId !== 107747 ||
      !Array.isArray(editorial.sections)) {
    throw new Error("Mercury editorial source is incompatible.");
  }
  const size = sectionText(editorial, "Size and Distance");
  const orbit = sectionText(editorial, "Orbit and Rotation");
  const introduction = sectionText(editorial, "Introduction");
  const surface = sectionText(editorial, "Surface");
  requireStatement(editorial, "Moons", /doesn't have moons/u);
  requireStatement(editorial, "Rings", /doesn't have rings/u);

  return Object.freeze({
    averageDistanceMillionKm: numberFrom(
      size,
      /average distance[^()]+\(([\d,]+) million kilometers\)/u,
      "average distance",
    ),
    radiusKm: numberFrom(
      size,
      /radius[^()]+\(([\d,]+) kilometers\)/u,
      "radius",
    ),
    lightTimeMinutes: numberFrom(
      size,
      /takes sunlight ([\d.]+) minutes/u,
      "light time",
    ),
    orbitalPeriodEarthDays: numberFrom(
      orbit,
      /around the Sun every ([\d,]+) days/u,
      "orbital period",
    ),
    siderealRotationEarthDays: numberFrom(
      orbit,
      /one rotation every ([\d,]+) Earth days/u,
      "sidereal rotation",
    ),
    solarDayEarthDays: numberFrom(
      orbit,
      /equals ([\d,]+) Earth days/u,
      "solar day",
    ),
    axialTiltDegrees: numberFrom(
      orbit,
      /tilted just ([\d.]+) degrees/u,
      "axial tilt",
    ),
    dayMaximumCelsius: numberFrom(
      introduction,
      /highs of [^()]+\(([-\d]+)°C\)/u,
      "day maximum",
    ),
    nightMinimumCelsius: numberFrom(
      surface,
      /minus [^()]+\(minus ([\d]+) degrees Celsius\)/u,
      "night minimum",
      -1,
    ),
    moonCount: 0,
    ringCount: 0,
  });
}

function sectionText(editorial, heading) {
  const section = editorial.sections.find((item) => item.heading === heading);
  if (!section || !Array.isArray(section.paragraphs) ||
      section.paragraphs.some((paragraph) => typeof paragraph !== "string")) {
    throw new Error(`Mercury editorial source has no ${heading} evidence.`);
  }
  return section.paragraphs.join(" ");
}

function requireStatement(editorial, heading, pattern) {
  if (!pattern.test(sectionText(editorial, heading))) {
    throw new Error(`Mercury editorial ${heading} evidence drifted.`);
  }
}

function numberFrom(text, pattern, label, multiplier = 1) {
  const match = text.match(pattern);
  if (!match) throw new Error(`Mercury editorial ${label} evidence drifted.`);
  const value = Number(match[1].replaceAll(",", "")) * multiplier;
  if (!Number.isFinite(value)) {
    throw new Error(`Mercury editorial ${label} value is invalid.`);
  }
  return value;
}
