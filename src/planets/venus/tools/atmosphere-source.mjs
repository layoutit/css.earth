import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { VENUS_SOURCE_ROOT } from "./preparation-paths.mjs";

const ATMOSPHERE_SOURCE_PATH = resolve(
  VENUS_SOURCE_ROOT,
  "openspace/atmosphere.asset",
);

export async function readVenusAtmosphereSource() {
  return parseVenusAtmosphereSource(await readFile(ATMOSPHERE_SOURCE_PATH, "utf8"));
}

export function parseVenusAtmosphereSource(source) {
  const rayleigh = requiredSection(source, /Rayleigh\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*-- Default/u,
    "Rayleigh");
  const mie = requiredSection(source, /Mie\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*Debug/u,
    "Mie");
  const model = Object.freeze({
    atmosphereHeightKm: difference(source, "AtmosphereHeight"),
    planetRadiusKm: scalar(source, "PlanetRadius"),
    averageGroundReflectance: scalar(source, "PlanetAverageGroundReflectance"),
    groundRadianceEmission: scalar(source, "GroundRadianceEmission"),
    sunIntensity: scalar(source, "SunIntensity"),
    rayleigh: Object.freeze({
      wavelengthsNm: Object.freeze(vector(rayleigh, "Wavelengths")),
      scatteringPerKm: Object.freeze(vector(rayleigh, "Scattering")),
      scaleHeightKm: scalar(rayleigh, "H_R"),
    }),
    mie: Object.freeze({
      scatteringPerKm: Object.freeze(vector(mie, "Scattering")),
      extinctionPerKm: Object.freeze(expressionVector(mie, "Extinction")),
      scaleHeightKm: scalar(mie, "H_M"),
      phaseG: scalar(mie, "G"),
    }),
  });
  for (const [label, values] of [
    ["Rayleigh wavelengths", model.rayleigh.wavelengthsNm],
    ["Rayleigh scattering", model.rayleigh.scatteringPerKm],
    ["Mie scattering", model.mie.scatteringPerKm],
    ["Mie extinction", model.mie.extinctionPerKm],
  ]) {
    if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new TypeError(`Venus ${label} must contain three positive values.`);
    }
  }
  if (model.atmosphereHeightKm <= 0 || model.planetRadiusKm <= 0 ||
      model.rayleigh.scaleHeightKm <= 0 || model.mie.scaleHeightKm <= 0 ||
      model.mie.phaseG < -1 || model.mie.phaseG > 1) {
    throw new TypeError("Venus OpenSpace atmosphere parameters are invalid.");
  }
  return model;
}

export function deriveVenusPreparedMaterial(source) {
  const rayleighOpticalDepth = source.rayleigh.scatteringPerKm.map(
    (coefficient) => coefficient * source.rayleigh.scaleHeightKm,
  );
  const mieScatteringOpticalDepth = source.mie.scatteringPerKm.map(
    (coefficient) => coefficient * source.mie.scaleHeightKm,
  );
  const mieExtinctionOpticalDepth = source.mie.extinctionPerKm.map(
    (coefficient) => coefficient * source.mie.scaleHeightKm,
  );
  const scatteringOpticalDepth = rayleighOpticalDepth.map(
    (value, channel) => value + mieScatteringOpticalDepth[channel],
  );
  const extinctionOpticalDepth = rayleighOpticalDepth.map(
    (value, channel) => value + mieExtinctionOpticalDepth[channel],
  );
  const visibleResponse = scatteringOpticalDepth.map((value) => 1 - Math.exp(-value));
  const maximumResponse = Math.max(...visibleResponse);
  const emissionWhitening = source.groundRadianceEmission * 0.5;
  const color = visibleResponse.map((value) => Math.round(255 * mix(
    value / maximumResponse,
    1,
    emissionWhitening,
  )));
  return Object.freeze({
    outerRadiusScale: 1 + source.atmosphereHeightKm / source.planetRadiusKm,
    color: Object.freeze(color),
    maximumAlpha: mean(visibleResponse),
    limbExponent: 1 + source.rayleigh.scaleHeightKm /
      (source.rayleigh.scaleHeightKm + source.mie.scaleHeightKm),
    nightFloor: 0.1 + source.groundRadianceEmission * 0.15,
    fadeStartAltitudeKm: source.atmosphereHeightKm - source.rayleigh.scaleHeightKm,
    rayleighOpticalDepth: Object.freeze(rayleighOpticalDepth),
    mieScatteringOpticalDepth: Object.freeze(mieScatteringOpticalDepth),
    mieExtinctionOpticalDepth: Object.freeze(mieExtinctionOpticalDepth),
    extinctionOpticalDepth: Object.freeze(extinctionOpticalDepth),
  });
}

function requiredSection(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new TypeError(`Venus OpenSpace ${label} section is missing.`);
  return match[1];
}

function scalar(source, key) {
  const match = source.match(new RegExp(
    `^\\s*${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`,
    "mu",
  ));
  if (!match) throw new TypeError(`Venus OpenSpace ${key} is missing.`);
  return Number(match[1]);
}

function difference(source, key) {
  const match = source.match(new RegExp(
    `^\\s*${key}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)`,
    "mu",
  ));
  if (!match) throw new TypeError(`Venus OpenSpace ${key} difference is missing.`);
  return Number(match[1]) - Number(match[2]);
}

function vector(source, key) {
  const match = source.match(new RegExp(
    `^\\s*${key}\\s*=\\s*\\{([^}]+)\\}`,
    "mu",
  ));
  if (!match) throw new TypeError(`Venus OpenSpace ${key} vector is missing.`);
  return match[1].split(",").map((value) => Number(value.trim()));
}

function expressionVector(source, key) {
  const match = source.match(new RegExp(
    `^\\s*${key}\\s*=\\s*\\{([^}]+)\\}`,
    "mu",
  ));
  if (!match) throw new TypeError(`Venus OpenSpace ${key} vector is missing.`);
  return match[1].split(",").map((expression) => {
    const division = expression.trim().match(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/u,
    );
    if (!division) throw new TypeError(`Venus OpenSpace ${key} expression is invalid.`);
    return Number(division[1]) / Number(division[2]);
  });
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}
