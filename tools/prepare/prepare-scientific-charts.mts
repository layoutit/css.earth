import { refuseDirectRun } from '../cli/library-entry.mts';
import { isArray, requireRecord, requireFiniteNumber, shape, text, number, optional, array, dictionary } from '@cssearth/core';

import {decodeProfile} from "../objects/terrestrial-layers/source-records.mts";
const phaseFields={maximumAngleDegrees:number,qualification:optional(text),segments:array(shape({maximumAngleDegrees:number,kind:text,coefficients:array(number),constant:optional(number)}))};
const parsePhase=shape(phaseFields);
const parseContext=shape({schema:text,sources:shape({photometricPhase:requireRecord}),planets:dictionary(shape({phase:parsePhase}))});

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderPhotometricPhaseChart } from "../objects/content/chart-svg.ts";

const projectRoot = resolve(import.meta.dirname, "../..");
const contextPath = resolve(
  projectRoot,
  "site/source/scientific-charts/planetary-context.json",
);

export async function prepareScientificCharts({
  planetIds,
  outputRoot = resolve(projectRoot, "public/scenes"),
}: {planetIds?:readonly string[];outputRoot?:string} = {}) {
  const context = validateScientificChartsContext(JSON.parse(await readFile(contextPath, "utf8")));
  const availablePlanetIds = Object.keys(context.planets);
  const selectedPlanetIds = planetIds ?? availablePlanetIds;
  if (!isArray(selectedPlanetIds) || selectedPlanetIds.length === 0 ||
      selectedPlanetIds.some((objectId) => !availablePlanetIds.includes(objectId))) {
    throw new TypeError("Scientific chart planet selection is incompatible.");
  }
  const outputs = [];
  for (const objectId of selectedPlanetIds) {
    const planet = context.planets[objectId];
    const outputDirectory = resolve(outputRoot, objectId);
    await mkdir(outputDirectory, { recursive: true });
    const phasePoints = samplePhaseCurve(planet.phase);
    const phaseSvg = renderPhotometricPhaseChart({
      id: objectId,
      title: `${titleCase(objectId)} photometric phase curve`,
      description: `V-band dimming of ${titleCase(objectId)} as phase angle increases from zero to ${planet.phase.maximumAngleDegrees} degrees.`,
      metadata: {
        source: context.sources.photometricPhase,
        objectId,
        samples: phasePoints.length,
        maximumAngleDegrees: planet.phase.maximumAngleDegrees,
        qualification: planet.phase.qualification ?? null,
        measurement: "V-band magnitude change relative to zero-degree phase",
      },
      points: phasePoints,
    });
    const phaseOutput = resolve(
      outputDirectory,
      `${objectId}-photometric-phase-curve.svg`,
    );
    await writeFile(phaseOutput, phaseSvg);
    outputs.push(phaseOutput);
  }
  return Object.freeze(outputs);
}

export function samplePhaseCurve(value:unknown, sampleCount = 181) {
  const phase=validatePhase(value);
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

export function evaluatePhaseMagnitude(value:unknown, phaseAngle:number) {
  const phase=validatePhase(value);
  if (!Number.isFinite(phaseAngle) || phaseAngle < 0 ||
      phaseAngle > phase.maximumAngleDegrees) {
    throw new RangeError("Photometric phase angle is outside the source model.");
  }
  const segment = phase.segments.find(({ maximumAngleDegrees }) =>
    phaseAngle <= maximumAngleDegrees);
  if (!segment) throw new RangeError("Photometric phase segment is missing.");
  if (segment.kind === "polynomialMagnitude") {
    return polynomial(segment.coefficients, phaseAngle);
  }
  const normalizedAngle = phaseAngle / 180;
  const albedo = polynomial(segment.coefficients, normalizedAngle);
  if (albedo <= 0) {
    throw new RangeError("Photometric phase albedo polynomial became non-positive.");
  }
  return requireFiniteNumber(segment.constant) - 2.5 * Math.log10(albedo);
}

export function validateScientificChartsContext(value: unknown) {
  const context=decodeProfile(parseContext,value,"Planetary scientific context is incompatible.");
  const requiredPlanets = [
    "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
  ];
  if (context?.schema !== "cssearth-planetary-scientific-context@1" ||
      Object.keys(context.planets ?? {}).join(",") !== requiredPlanets.join(",") ||
      !context.sources?.photometricPhase) {
    throw new TypeError("Planetary scientific context is incompatible.");
  }
  for (const objectId of requiredPlanets) {
    const planet = context.planets[objectId];
    validatePhase(planet.phase);
  }
  return context;
}

function validatePhase(value:unknown) {
  const phase=decodeProfile(parsePhase,value,"Photometric phase source is incompatible.");
  if (!phase || !Number.isFinite(phase.maximumAngleDegrees) ||
      phase.maximumAngleDegrees <= 0 || phase.maximumAngleDegrees > 180 ||
      !isArray(phase.segments) || phase.segments.length === 0 ||
      phase.segments[phase.segments.length-1].maximumAngleDegrees !== phase.maximumAngleDegrees ||
      phase.segments.some((segment, index) =>
        !Number.isFinite(segment.maximumAngleDegrees) ||
        index > 0 && segment.maximumAngleDegrees <=
          phase.segments[index - 1].maximumAngleDegrees ||
        !["polynomialMagnitude", "albedoPolynomialMagnitude"].includes(segment.kind) ||
        !isArray(segment.coefficients) || segment.coefficients.length < 2 ||
        segment.coefficients.some((coefficient) => !Number.isFinite(coefficient)) ||
        segment.kind === "albedoPolynomialMagnitude" &&
          !Number.isFinite(segment.constant))) {
    throw new TypeError("Photometric phase source is incompatible.");
  }
  return phase;
}

function polynomial(coefficients:readonly number[], value:number) {
  return coefficients.reduceRight(
    (total, coefficient) => total * value + coefficient,
    0,
  );
}

function titleCase(value:string) {
  return value[0].toUpperCase() + value.slice(1);
}

refuseDirectRun(import.meta);
