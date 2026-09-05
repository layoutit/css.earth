import { prepareAtmosphereFrame } from "../../../../tools/prepared-atmosphere.mjs";
import { PREPARED_EARTH_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  earthSourceManifest,
  validateEarthSourceGroup,
} from "./source-manifest.mjs";

export const EARTH_MATERIAL_TILE_SIZE = 504;
export const EARTH_MATERIAL_PRESENTATION_SIZE = 720;
export const EARTH_MATERIAL_FRAMES_PER_SHARD = 4;

export async function readEarthAtmosphereModel() {
  await validateEarthSourceGroup("atmosphere");
  const atmospherePath = resolve(
    import.meta.dirname,
    "../source/openspace/earth-atmosphere.asset",
  );
  const presentationResponsePath = resolve(
    import.meta.dirname,
    "../source/atmosphere/google-earth-pro-presentation-response.json",
  );
  const [text, presentationResponse] = await Promise.all([
    readFile(atmospherePath, "utf8"),
    readFile(presentationResponsePath, "utf8").then(JSON.parse),
  ]);
  const source = earthSourceManifest().inputs.find(
    ({ id }) => id === "openspace-earth-atmosphere-config",
  );
  if (!source) throw new Error("Earth atmosphere source manifest entry is missing.");
  if (presentationResponse.schema !==
      "cssearth-google-earth-pro-atmosphere-presentation-response@1" ||
      presentationResponse.observedResponse?.exposure !== 0.2 ||
      presentationResponse.observedResponse?.exposureRole !==
        "camera-response-not-body-irradiance" ||
      presentationResponse.cleanRoomTransfer?.bodySunIntensitySource !==
        "openspace-body-atmosphere-model" ||
      presentationResponse.transferPolicy?.googlePixelsRedistributed !== false ||
      presentationResponse.transferPolicy?.googleShaderBytesRedistributed !== false) {
    throw new Error("Google Earth Pro atmosphere response is incompatible.");
  }

  const [outerRadiusKm, innerRadiusKm] = captureNumbers(
    text,
    /AtmosphereHeight\s*=\s*([\d.]+)\s*-\s*([\d.]+)/u,
    "atmosphere height",
  );
  const planetRadiusKm = captureNumber(
    text,
    /PlanetRadius\s*=\s*([\d.]+)/u,
    "planet radius",
  );
  if (innerRadiusKm !== planetRadiusKm || outerRadiusKm <= planetRadiusKm) {
    throw new Error("OpenSpace Earth atmosphere radii are inconsistent.");
  }

  const rayleighBlock = captureText(
    text,
    /Rayleigh\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*--\[\[/u,
    "Rayleigh block",
  );
  const mieBlock = captureText(
    text,
    /-- Default\s+Mie\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*Debug/u,
    "Mie block",
  );
  const wavelengthsNanometers = captureList(
    rayleighBlock,
    /Wavelengths\s*=\s*\{([^}]+)\}/u,
    "Rayleigh wavelengths",
  );
  const rayleighScatteringPerKm = captureList(
    rayleighBlock,
    /Scattering\s*=\s*\{([^}]+)\}/u,
    "Rayleigh scattering",
  );
  const mieScatteringPerKm = captureList(
    mieBlock,
    /Scattering\s*=\s*\{([^}]+)\}/u,
    "Mie scattering",
  );
  if (wavelengthsNanometers.length !== 3 ||
      rayleighScatteringPerKm.length !== 3 ||
      mieScatteringPerKm.length !== 3) {
    throw new Error("OpenSpace Earth atmosphere RGB coefficients are incomplete.");
  }

  return deepFreeze({
    schema: "cssearth-openspace-atmosphere-source@1",
    authority: "OpenSpace RenderableAtmosphere",
    sourceId: source.id,
    sourceSha256: source.expectedSha256,
    planetRadiusKm,
    atmosphereHeightKm: outerRadiusKm - innerRadiusKm,
    outerRadiusRatio: outerRadiusKm / planetRadiusKm,
    sunIntensity: captureNumber(
      text,
      /SunIntensity\s*=\s*([\d.]+)/u,
      "Sun intensity",
    ),
    rayleigh: {
      wavelengthsNanometers,
      scatteringPerKm: rayleighScatteringPerKm,
      scaleHeightKm: captureNumber(
        rayleighBlock,
        /H_R\s*=\s*([\d.]+)/u,
        "Rayleigh scale height",
      ),
    },
    mie: {
      scatteringPerKm: mieScatteringPerKm,
      scaleHeightKm: captureNumber(
        mieBlock,
        /H_M\s*=\s*([\d.]+)/u,
        "Mie scale height",
      ),
      anisotropy: captureNumber(
        mieBlock,
        /^\s*G\s*=\s*([\d.]+)/mu,
        "Mie anisotropy",
      ),
    },
    presentationResponse,
  });
}

function captureText(text, expression, label) {
  const value = text.match(expression)?.[1];
  if (!value) throw new Error(`OpenSpace Earth ${label} is missing.`);
  return value;
}

function captureNumber(text, expression, label) {
  const value = Number(captureText(text, expression, label));
  if (!Number.isFinite(value)) {
    throw new Error(`OpenSpace Earth ${label} is not finite.`);
  }
  return value;
}

function captureNumbers(text, expression, label) {
  const match = text.match(expression);
  if (!match) throw new Error(`OpenSpace Earth ${label} is missing.`);
  const values = match.slice(1).map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`OpenSpace Earth ${label} is not finite.`);
  }
  return values;
}

function captureList(text, expression, label) {
  return captureText(text, expression, label)
    .split(",")
    .map((value) => Number(value.trim()));
}

function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") deepFreeze(nested);
  }
  return Object.freeze(value);
}

export const EARTH_ATMOSPHERE_ILLUMINATION = Object.freeze({
  frameCount: 128, minimumLightViewZ: -1, maximumLightViewZ: 1,
  baseLightAzimuthDegrees: 0,
});
export const EARTH_ATMOSPHERE_DEFAULT_FRAME = Math.round(
  (1 + viewSunDirectionToPreparedLightDirection(PREPARED_EARTH_SKY_SUN.referenceViewDirection)[2]) / 2 *
    (EARTH_ATMOSPHERE_ILLUMINATION.frameCount - 1));

export function earthAtmosphereProfile(model) {
  const response = model.presentationResponse;
  return {
    radiusKm: model.planetRadiusKm, heightKm: model.atmosphereHeightKm,
    layers: [
      { ...model.rayleigh, phase: "rayleigh", weight: 1 },
      { ...model.mie, phase: "mie", weight: response.cleanRoomTransfer.mieContribution },
    ],
    transfer: { mode: "scattering-rgb",
      intensity: model.sunIntensity, exposure: response.observedResponse.exposure,
      alphaScale: response.observedResponse.skyAlphaLuminanceScale,
      maximumAlpha: response.cleanRoomTransfer.earthMaximumOpacity, limbConcentration: true },
  };
}

export function prepareEarthAtmosphereFrame({ size, frame = EARTH_ATMOSPHERE_DEFAULT_FRAME, model }) {
  const z = -1 + 2 * frame / (EARTH_ATMOSPHERE_ILLUMINATION.frameCount - 1);
  if (!Number.isInteger(frame) || Math.abs(z) > 1) throw new RangeError("Invalid Earth atmosphere frame.");
  // The existing prepared material plane spans the atmospheric outer radius.
  const radius = size * .468 / model.outerRadiusRatio;
  return prepareAtmosphereFrame({
    width: size, disc: { centerX: size / 2, centerY: size / 2, radiusX: radius, radiusY: radius },
    profile: earthAtmosphereProfile(model),
    lightDirection: [Math.sqrt(Math.max(0, 1 - z * z)), 0, z],
  });
}
