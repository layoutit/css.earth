#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { renderPhotometricPhaseChart } from "../src/platform/scientific-chart-svg.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const contextPath = resolve(
  projectRoot,
  "site/source/scientific-charts/planetary-context.json",
);

export async function prepareScientificCharts({
  planetIds,
  outputRoot = resolve(projectRoot, "public/scenes"),
} = {}) {
  const context = JSON.parse(await readFile(contextPath, "utf8"));
  validateContext(context);
  const availablePlanetIds = Object.keys(context.planets);
  const selectedPlanetIds = planetIds ?? availablePlanetIds;
  if (!Array.isArray(selectedPlanetIds) || selectedPlanetIds.length === 0 ||
      selectedPlanetIds.some((planetId) => !availablePlanetIds.includes(planetId))) {
    throw new TypeError("Scientific chart planet selection is incompatible.");
  }
  const outputs = [];
  for (const planetId of selectedPlanetIds) {
    const planet = context.planets[planetId];
    const outputDirectory = resolve(outputRoot, planetId);
    await mkdir(outputDirectory, { recursive: true });
    const phasePoints = samplePhaseCurve(planet.phase);
    const phaseSvg = renderPhotometricPhaseChart({
      id: planetId,
      title: `${titleCase(planetId)} photometric phase curve`,
      description: `V-band dimming of ${titleCase(planetId)} as phase angle increases from zero to ${planet.phase.maximumAngleDegrees} degrees.`,
      metadata: {
        source: context.sources.photometricPhase,
        planetId,
        samples: phasePoints.length,
        maximumAngleDegrees: planet.phase.maximumAngleDegrees,
        qualification: planet.phase.qualification ?? null,
        measurement: "V-band magnitude change relative to zero-degree phase",
      },
      points: phasePoints,
    });
    const phaseOutput = resolve(
      outputDirectory,
      `${planetId}-photometric-phase-curve.svg`,
    );
    await writeFile(phaseOutput, phaseSvg);
    outputs.push(phaseOutput);
  }
  return Object.freeze(outputs);
}

export function samplePhaseCurve(phase, sampleCount = 181) {
  validatePhase(phase);
  if (!Number.isInteger(sampleCount) || sampleCount < 3) {
    throw new TypeError("Photometric phase sample count is incompatible.");
  }
  const zeroMagnitude = evaluatePhaseMagnitude(phase, 0);
  return Object.freeze(Array.from({ length: sampleCount }, (_, index) => {
    const phaseAngle = phase.maximumAngleDegrees * index / (sampleCount - 1);
    return Object.freeze({
      phaseAngle,
      dimmingMagnitude: evaluatePhaseMagnitude(phase, phaseAngle) - zeroMagnitude,
    });
  }));
}

export function evaluatePhaseMagnitude(phase, phaseAngle) {
  validatePhase(phase);
  if (!Number.isFinite(phaseAngle) || phaseAngle < 0 ||
      phaseAngle > phase.maximumAngleDegrees) {
    throw new RangeError("Photometric phase angle is outside the source model.");
  }
  const segment = phase.segments.find(({ maximumAngleDegrees }) =>
    phaseAngle <= maximumAngleDegrees);
  if (segment.kind === "polynomialMagnitude") {
    return polynomial(segment.coefficients, phaseAngle);
  }
  const normalizedAngle = phaseAngle / 180;
  const albedo = polynomial(segment.coefficients, normalizedAngle);
  if (albedo <= 0) {
    throw new RangeError("Photometric phase albedo polynomial became non-positive.");
  }
  return segment.constant - 2.5 * Math.log10(albedo);
}

function validateContext(context) {
  const requiredPlanets = [
    "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
  ];
  if (context?.schema !== "cssearth-planetary-scientific-context@1" ||
      Object.keys(context.planets ?? {}).join(",") !== requiredPlanets.join(",") ||
      !context.sources?.photometricPhase) {
    throw new TypeError("Planetary scientific context is incompatible.");
  }
  for (const planetId of requiredPlanets) {
    const planet = context.planets[planetId];
    validatePhase(planet.phase);
  }
}

function validatePhase(phase) {
  if (!phase || !Number.isFinite(phase.maximumAngleDegrees) ||
      phase.maximumAngleDegrees <= 0 || phase.maximumAngleDegrees > 180 ||
      !Array.isArray(phase.segments) || phase.segments.length === 0 ||
      phase.segments.at(-1).maximumAngleDegrees !== phase.maximumAngleDegrees ||
      phase.segments.some((segment, index) =>
        !Number.isFinite(segment.maximumAngleDegrees) ||
        index > 0 && segment.maximumAngleDegrees <=
          phase.segments[index - 1].maximumAngleDegrees ||
        !["polynomialMagnitude", "albedoPolynomialMagnitude"].includes(segment.kind) ||
        !Array.isArray(segment.coefficients) || segment.coefficients.length < 2 ||
        segment.coefficients.some((coefficient) => !Number.isFinite(coefficient)) ||
        segment.kind === "albedoPolynomialMagnitude" &&
          !Number.isFinite(segment.constant))) {
    throw new TypeError("Photometric phase source is incompatible.");
  }
}

function polynomial(coefficients, value) {
  return coefficients.reduceRight(
    (total, coefficient) => total * value + coefficient,
    0,
  );
}

function titleCase(value) {
  return value[0].toUpperCase() + value.slice(1);
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const planetArgument = process.argv.find((argument) =>
    argument.startsWith("--planet="));
  const planetIds = planetArgument ? [planetArgument.slice("--planet=".length)] : undefined;
  const outputs = await prepareScientificCharts({ planetIds });
  console.log(`Prepared ${outputs.length} source-backed scientific charts.`);
}
